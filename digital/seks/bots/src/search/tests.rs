use seks_engine::{Board, Cell, Die, Side};

use super::*;
use crate::eval::Weights;

/// Plain negamax over the same tree: the same terminal scores, wins in one
/// and quiescence at the leaves, with no pruning, table or ordering.
fn minimax(searcher: &mut Searcher, state: &GameState, depth: i32, ply: usize) -> i32 {
    if let Some(score) = Searcher::terminal(state, ply) {
        return score;
    }
    if can_win_now(state.board(), state.to_move()) {
        return WIN - (ply as i32 + 1);
    }
    if depth == 0 {
        return searcher.quiescence(state, -INFINITY, INFINITY, ply, 0, &mut || false);
    }
    legal_commands(state)
        .into_iter()
        .map(|command| {
            let child = Engine::step(state, command).unwrap();
            -minimax(searcher, &child, depth - 1, ply + 1)
        })
        .max()
        .unwrap()
}

/// Positions with `per_side` dice of each side in random cells away from
/// the back rows, where no side wins at once.
fn small_positions(count: usize, per_side: usize) -> Vec<GameState> {
    let mut rng = Rng::new(5);
    let mut positions = Vec::new();
    while positions.len() < count {
        let mut board = Board::empty();
        for side in Side::ALL {
            let mut placed = 0;
            while placed < per_side {
                let cell = Cell::new(1 + rng.below(11) as u8, 2 + rng.below(9) as u8);
                if board.get(cell).is_none() {
                    board.set(cell, Some(Die::new(side, 1 + rng.below(6) as u8)));
                    placed += 1;
                }
            }
        }
        let to_move = Side::ALL[rng.below(2)];
        if !can_win_now(&board, Side::White) && !can_win_now(&board, Side::Black) {
            positions.push(GameState::from_board(board, to_move));
        }
    }
    positions
}

fn searcher() -> Searcher {
    Searcher::new(Evaluator::new(&Weights::hand()), 1)
}

#[test]
fn alpha_beta_scores_like_minimax_up_to_depth_3() {
    let mut reference = searcher();
    let mut search = searcher();
    search.options = Options {
        extension: false,
        late_reductions: false,
        null_move: false,
        pruning: false,
    };
    for (i, state) in small_positions(12, 2).iter().enumerate() {
        for depth in 1..=3 {
            search.clear();
            let expected = minimax(&mut reference, state, depth, 0);
            let found = search.node(state, depth, -INFINITY, INFINITY, 0, &mut || false);
            assert_eq!(
                found,
                expected,
                "position {i}, depth {depth}\n{}",
                state.board()
            );
        }
    }
}

#[test]
fn a_node_limit_gives_the_same_result_every_time() {
    let state = small_positions(1, 6)[0];
    let limits = Limits {
        depth: 20,
        nodes: 3000,
    };
    let mut a = searcher();
    let mut b = searcher();
    let first = a.search(&state, limits, 0, 0, &mut || false);
    assert_eq!(first, b.search(&state, limits, 0, 0, &mut || false));
    assert!(first.depth >= 1);
}

#[test]
fn the_stop_callback_stops_after_the_first_iteration() {
    let state = GameState::initial();
    let mut search = searcher();
    let result = search.search(&state, Limits::default(), 0, 0, &mut || true);
    assert_eq!(result.depth, 1);
}

#[test]
fn noise_picks_among_moves_near_the_best() {
    let state = GameState::initial();
    let limits = Limits {
        depth: 2,
        nodes: u64::MAX,
    };
    let mut search = searcher();
    let best = search.search(&state, limits, 0, 0, &mut || false);
    let picks: std::collections::HashSet<Command> = (0..20)
        .map(|seed| {
            let result = search.search(&state, limits, 30, seed, &mut || false);
            assert!(result.score >= best.score - 30);
            result.command
        })
        .collect();
    assert!(picks.len() > 1);
}

#[test]
fn contempt_makes_a_draw_cost_the_root_side() {
    let mut search = searcher();
    assert_eq!((search.draw(0), search.draw(1)), (0, 0));
    search.contempt = 50;
    assert_eq!(
        (search.draw(0), search.draw(1), search.draw(2)),
        (-50, 50, -50)
    );
}
