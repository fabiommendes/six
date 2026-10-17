//! `regras/seks/05-fim-do-jogo.md` (and the winning tests of the prototype).

use crate::history::PositionHistory;
use crate::testing::{after, cell, inc, mv, play, sparse};
use crate::{
    legal_commands, Command, DrawReason, Engine, GameError, GameEvent, GameState, Outcome, Side,
    WinReason,
};

fn white_wins(reason: WinReason) -> Option<Outcome> {
    Some(Outcome::Win {
        winner: Side::White,
        reason,
    })
}

fn black_wins(reason: WinReason) -> Option<Outcome> {
    Some(Outcome::Win {
        winner: Side::Black,
        reason,
    })
}

// ---------------------------------------------------------------------------
// The back row
// ---------------------------------------------------------------------------

#[test]
fn a_white_die_that_ends_a_move_on_row_11_wins() {
    let state = sparse(Side::White, &["w3@6,8", "b1@1,1"]);
    let transition = play(&state, mv((6, 8), (6, 11)));
    assert_eq!(transition.state.outcome(), white_wins(WinReason::BackRow));
    assert_eq!(
        transition.events.last(),
        Some(&GameEvent::GameEnded {
            outcome: white_wins(WinReason::BackRow).unwrap()
        })
    );
}

#[test]
fn a_black_die_that_ends_a_move_on_row_1_wins() {
    let state = sparse(Side::Black, &["b3@6,4", "w1@11,11"]);
    let next = after(&state, mv((6, 4), (6, 1)));
    assert_eq!(next.outcome(), black_wins(WinReason::BackRow));
}

#[test]
fn a_die_of_any_value_wins_on_the_back_row() {
    // Detalhe: the win holds with a die of any value (the value is the
    // distance walked, so a die from row 11 - value reaches it).
    for value in 1..=6 {
        let from = 11 - value;
        let die = format!("w{value}@6,{from}");
        let state = sparse(Side::White, &[&die, "b1@1,1"]);
        let next = after(&state, mv((6, from), (6, 11)));
        assert_eq!(
            next.outcome(),
            white_wins(WinReason::BackRow),
            "value {value}"
        );
        assert_eq!(next.die_at(cell(6, 11)).unwrap().value(), value);
    }
}

#[test]
fn a_move_to_the_own_back_row_or_the_middle_does_not_win() {
    let state = sparse(Side::White, &["w3@6,4", "b1@1,9"]);
    assert_eq!(after(&state, mv((6, 4), (6, 1))).outcome(), None);
    assert_eq!(after(&state, mv((6, 4), (6, 7))).outcome(), None);
    let state = sparse(Side::Black, &["b3@6,8", "w1@1,3"]);
    assert_eq!(after(&state, mv((6, 8), (6, 11))).outcome(), None);
}

#[test]
fn a_move_to_row_10_does_not_win() {
    let state = sparse(Side::White, &["w3@6,7", "b1@1,1"]);
    assert_eq!(after(&state, mv((6, 7), (6, 10))).outcome(), None);
}

#[test]
fn incrementing_never_wins() {
    // Prototype `test_increment_never_wins`: a die standing on the opponent's
    // back row (a built position) does not win by being incremented.
    let state = sparse(Side::White, &["w1@6,11", "b1@1,1"]);
    assert_eq!(after(&state, inc((6, 11))).outcome(), None);
}

#[test]
fn the_captures_of_the_winning_move_do_not_change_the_result() {
    // Detalhe: the move to row 11 captures the only black die, which would
    // also leave the Blacks without a play; the win is still by the back row.
    let state = sparse(Side::White, &["w3@6,8", "b2@7,11", "w2@8,11"]);
    let transition = play(&state, mv((6, 8), (6, 11)));
    assert_eq!(transition.state.board().count(Side::Black), 0);
    assert_eq!(transition.state.outcome(), white_wins(WinReason::BackRow));
}

#[test]
fn a_winning_move_that_captures_reports_the_capture_before_the_end() {
    let state = sparse(Side::White, &["w3@6,8", "b2@7,11", "w2@8,11", "b1@1,1"]);
    let events = play(&state, mv((6, 8), (6, 11))).events;
    assert!(matches!(events[0], GameEvent::Moved { .. }));
    assert!(matches!(events[1], GameEvent::Captured { .. }));
    assert!(matches!(events[2], GameEvent::GameEnded { .. }));
    assert_eq!(events.len(), 3);
}

#[test]
fn nothing_is_legal_after_the_game_ends() {
    let state = sparse(Side::White, &["w3@6,8", "b1@1,1"]);
    let over = after(&state, mv((6, 8), (6, 11)));
    assert!(legal_commands(&over).is_empty());
    assert_eq!(
        Engine::command(&over, mv((6, 11), (6, 10))),
        Err(GameError::GameOver)
    );
    assert_eq!(Engine::step(&over, inc((6, 11))), Err(GameError::GameOver));
}

// ---------------------------------------------------------------------------
// The opponent without a play
// ---------------------------------------------------------------------------

#[test]
fn capturing_the_last_opponent_die_wins() {
    // Prototype `test_capturing_the_last_opponent_die_wins`.
    let state = sparse(Side::White, &["w3@6,3", "w2@8,6", "b3@7,6"]);
    let next = after(&state, mv((6, 3), (6, 6)));
    assert_eq!(next.outcome(), white_wins(WinReason::NoPlay));
}

#[test]
fn blocking_every_opponent_play_wins() {
    // Prototype `test_blocking_every_opponent_play_wins`: a black 6 in the
    // corner, walled in by white dice, can neither move nor be incremented.
    let state = sparse(
        Side::White,
        &["b6@1,11", "w1@2,11", "w1@1,10", "w1@2,10", "w1@6,3"],
    );
    let next = after(&state, mv((6, 3), (6, 4)));
    assert_eq!(next.outcome(), white_wins(WinReason::NoPlay));
}

#[test]
fn blocking_with_the_last_free_cell_wins() {
    let state = sparse(Side::White, &["b6@1,11", "w1@2,11", "w1@2,10", "w1@1,8"]);
    let next = after(&state, mv((1, 8), (1, 9)));
    assert_eq!(next.outcome(), None, "(1, 10) is still free");
    let state = sparse(Side::White, &["b6@1,11", "w1@2,11", "w1@2,10", "w1@1,9"]);
    let next = after(&state, mv((1, 9), (1, 10)));
    assert_eq!(next.outcome(), white_wins(WinReason::NoPlay));
}

#[test]
fn the_game_goes_on_while_the_opponent_can_play() {
    // Prototype `test_game_goes_on_while_the_opponent_can_play`.
    let state = sparse(Side::White, &["w3@6,3", "w2@8,6", "b3@7,6"]);
    let next = after(&state, mv((6, 3), (6, 4)));
    assert_eq!(next.outcome(), None);
    assert_eq!(next.to_move(), Side::Black);
}

#[test]
fn a_6_with_a_free_neighbor_still_has_a_play() {
    let state = sparse(Side::White, &["b6@1,11", "w1@2,11", "w1@1,10", "w1@6,3"]);
    assert_eq!(after(&state, mv((6, 3), (6, 4))).outcome(), None);
}

#[test]
fn a_blocked_die_below_6_still_has_its_increment() {
    let state = sparse(
        Side::White,
        &["b5@1,11", "w1@2,11", "w1@1,10", "w1@2,10", "w1@6,3"],
    );
    assert_eq!(after(&state, mv((6, 3), (6, 4))).outcome(), None);
}

#[test]
fn the_opponent_is_tested_after_an_increment_too() {
    // "Depois da sua jogada": a play that changes nothing around the opponent
    // still ends the game if it has no play.
    let state = sparse(Side::White, &["b6@1,11", "w1@2,11", "w1@1,10", "w1@2,10"]);
    let next = after(&state, inc((2, 11)));
    assert_eq!(next.outcome(), white_wins(WinReason::NoPlay));
}

#[test]
fn the_blacks_win_by_leaving_the_whites_without_a_play() {
    let state = sparse(
        Side::Black,
        &["w6@1,1", "b1@2,1", "b1@1,2", "b1@2,2", "b1@6,9"],
    );
    let next = after(&state, mv((6, 9), (6, 8)));
    assert_eq!(next.outcome(), black_wins(WinReason::NoPlay));
}

// ---------------------------------------------------------------------------
// Draws
// ---------------------------------------------------------------------------

/// Plays `commands` from `state`, checking that the game goes on, and
/// returns the last state.
fn play_all(state: GameState, commands: &[Command]) -> GameState {
    commands.iter().fold(state, |state, &command| {
        assert_eq!(state.outcome(), None, "ended before {command:?}");
        after(&state, command)
    })
}

/// Four plies after which every die is back: the white die at `a` goes to
/// `b` and back, the black die at `c` goes to `d` and back.
fn out_and_back(a: (u8, u8), b: (u8, u8), c: (u8, u8), d: (u8, u8)) -> [Command; 4] {
    [mv(a, b), mv(c, d), mv(b, a), mv(d, c)]
}

#[test]
fn the_third_occurrence_of_a_position_draws() {
    let start = sparse(Side::White, &["w1@5,5", "b1@8,8"]);
    let cycle = out_and_back((5, 5), (5, 6), (8, 8), (8, 7));
    let once = play_all(start, &cycle);
    assert_eq!(once.board(), start.board());
    assert_eq!(once.position_hash(), start.position_hash());
    let twice = play_all(once, &cycle[..3]);
    assert_eq!(twice.outcome(), None);
    let last = play(&twice, cycle[3]);
    assert_eq!(
        last.state.outcome(),
        Some(Outcome::Draw(DrawReason::Repetition))
    );
    assert_eq!(
        last.events.last(),
        Some(&GameEvent::GameEnded {
            outcome: Outcome::Draw(DrawReason::Repetition)
        })
    );
}

#[test]
fn the_initial_position_counts_as_an_occurrence() {
    // Two corner dice go out and back, twice: the initial position is the
    // 1st, 2nd and 3rd occurrence at plies 0, 4 and 8.
    let cycle = out_and_back((1, 1), (2, 1), (1, 11), (2, 11));
    let state = play_all(GameState::initial(), &cycle);
    assert_eq!(state.outcome(), None);
    let state = play_all(state, &cycle[..3]);
    assert_eq!(state.outcome(), None);
    let state = after(&state, cycle[3]);
    assert_eq!(state.outcome(), Some(Outcome::Draw(DrawReason::Repetition)));
}

#[test]
fn the_repetitions_do_not_need_to_be_in_a_row() {
    // The initial position comes back after a cycle of two corner dice and
    // again after a cycle of two other dice, with different positions in
    // between.
    let first = out_and_back((1, 1), (2, 1), (1, 11), (2, 11));
    let second = out_and_back((3, 1), (4, 1), (3, 11), (4, 11));
    let state = play_all(GameState::initial(), &first);
    assert_eq!(state.outcome(), None);
    let state = play_all(state, &second[..3]);
    assert_eq!(state.outcome(), None);
    let state = after(&state, second[3]);
    assert_eq!(state.outcome(), Some(Outcome::Draw(DrawReason::Repetition)));
}

#[test]
fn two_occurrences_do_not_draw() {
    let cycle = out_and_back((1, 1), (2, 1), (1, 11), (2, 11));
    let state = play_all(GameState::initial(), &cycle);
    assert_eq!(state.outcome(), None);
    assert_eq!(state.plies_without_capture(), 4);
}

#[test]
fn the_same_board_with_the_other_side_to_move_is_another_position() {
    // The white die walks a triangle of three plies and the black die goes
    // out and back in two, so the board repeats after 5 plies, but with the
    // Blacks to move. Counting boards alone, the third occurrence would be at
    // ply 12; counting positions with the side to move, it is at ply 24.
    let triangle = [(1, 1), (2, 1), (2, 2)];
    let mut commands = Vec::new();
    for ply in 0..30 {
        let own_ply = ply / 2;
        if ply % 2 == 0 {
            commands.push(mv(triangle[own_ply % 3], triangle[(own_ply + 1) % 3]));
        } else if own_ply % 2 == 0 {
            commands.push(mv((11, 11), (10, 11)));
        } else {
            commands.push(mv((10, 11), (11, 11)));
        }
    }
    let start = sparse(Side::White, &["w1@1,1", "b1@11,11"]);
    let mut state = start;
    let mut same_board = Vec::new();
    for (index, &command) in commands.iter().enumerate() {
        state = after(&state, command);
        let ply = index + 1;
        if state.board() == start.board() {
            same_board.push(ply);
            assert_ne!(state.position_hash() == start.position_hash(), ply % 2 == 1);
        }
        if ply < 24 {
            assert_eq!(state.outcome(), None, "ply {ply}");
        } else {
            assert_eq!(state.outcome(), Some(Outcome::Draw(DrawReason::Repetition)));
            break;
        }
    }
    assert_eq!(same_board, vec![5, 12, 17, 24]);
}

/// A path of `length` cells, one step apart, that snakes along rows from
/// `(1, first_row)`, going up (`rows` = 1) or down (`rows` = -1).
fn snake(first_row: u8, rows: i8, length: usize) -> Vec<(u8, u8)> {
    let mut cells = vec![(1u8, first_row)];
    let (mut column, mut row, mut direction) = (1i8, first_row as i8, 1i8);
    while cells.len() < length {
        let next_column = column + direction;
        if (1..=11).contains(&next_column) {
            column = next_column;
        } else {
            row += rows;
            direction = -direction;
        }
        cells.push((column as u8, row as u8));
    }
    cells
}

/// Plies of two dice that never repeat a position or capture: the white die
/// snakes up from row 1 and the black die snakes down from row 11. `plies`
/// plies, the Whites first.
fn walk(plies: usize) -> Vec<Command> {
    let white = snake(1, 1, plies / 2 + 2);
    let black = snake(11, -1, plies / 2 + 2);
    (0..plies)
        .map(|ply| {
            let path = if ply % 2 == 0 { &white } else { &black };
            mv(path[ply / 2], path[ply / 2 + 1])
        })
        .collect()
}

#[test]
fn the_walk_helper_never_repeats_a_position() {
    let start = sparse(Side::White, &["w1@1,1", "b1@1,11"]);
    let mut hashes = vec![start.position_hash()];
    let mut state = start;
    for command in walk(98) {
        state = after(&state, command);
        hashes.push(state.position_hash());
    }
    hashes.sort_unstable();
    hashes.dedup();
    assert_eq!(hashes.len(), 99);
}

#[test]
fn a_hundred_plies_without_a_capture_draw() {
    let start = sparse(Side::White, &["w1@1,1", "b1@1,11"]);
    let commands = walk(100);
    let state = play_all(start, &commands[..99]);
    assert_eq!(state.outcome(), None);
    assert_eq!(state.plies_without_capture(), 99);
    let last = play(&state, commands[99]);
    assert_eq!(
        last.state.outcome(),
        Some(Outcome::Draw(DrawReason::NoCapture))
    );
    assert_eq!(
        last.events.last(),
        Some(&GameEvent::GameEnded {
            outcome: Outcome::Draw(DrawReason::NoCapture)
        })
    );
}

#[test]
fn increments_count_as_plies_without_a_capture() {
    let start = sparse(Side::White, &["w1@1,1", "b1@1,11"]);
    let state = play_all(start, &[inc((1, 1)), inc((1, 11))]);
    assert_eq!(state.plies_without_capture(), 2);
}

/// A position for the capture tests: a white die at (3, 6) that captures by
/// walking to (5, 6), and two walkers far from it.
fn with_capture_available() -> GameState {
    sparse(
        Side::White,
        &["w3@3,6", "b2@6,6", "w1@7,6", "w1@1,1", "b1@1,11"],
    )
}

#[test]
fn a_capture_resets_the_count_of_plies() {
    let mut state = with_capture_available();
    state.plies_without_capture = 60;
    let state = after(&state, mv((3, 6), (5, 6)));
    assert_eq!(state.board().count(Side::Black), 1);
    assert_eq!(state.plies_without_capture(), 0);
    assert_eq!(state.history.as_slice(), &[state.position_hash()]);
}

#[test]
fn the_hundred_plies_are_counted_from_the_last_capture() {
    // 60 plies before the capture would draw the game after 40 more if the
    // capture did not reset the count.
    let mut state = with_capture_available();
    state.plies_without_capture = 60;
    let mut state = after(&state, mv((3, 6), (5, 6)));
    // The black die at (1, 11) and the white die at (1, 1) snake for 99 plies.
    let white = snake(1, 1, 60);
    let black = snake(11, -1, 60);
    for ply in 0..99 {
        let path = if ply % 2 == 0 { &black } else { &white };
        state = after(&state, mv(path[ply / 2], path[ply / 2 + 1]));
        assert_eq!(state.outcome(), None, "ply {ply}");
    }
    assert_eq!(state.plies_without_capture(), 99);
}

#[test]
fn the_hundredth_ply_after_a_capture_draws() {
    let mut state = with_capture_available();
    state.plies_without_capture = 60;
    let mut state = after(&state, mv((3, 6), (5, 6)));
    let white = snake(1, 1, 60);
    let black = snake(11, -1, 60);
    for ply in 0..100 {
        let path = if ply % 2 == 0 { &black } else { &white };
        state = after(&state, mv(path[ply / 2], path[ply / 2 + 1]));
    }
    assert_eq!(state.outcome(), Some(Outcome::Draw(DrawReason::NoCapture)));
}

#[test]
fn a_capture_on_the_hundredth_ply_does_not_draw() {
    let mut state = with_capture_available();
    state.plies_without_capture = 99;
    let next = after(&state, mv((3, 6), (5, 6)));
    assert_eq!(next.outcome(), None);
    assert_eq!(next.plies_without_capture(), 0);
}

#[test]
fn the_history_never_outgrows_its_capacity() {
    let start = sparse(Side::White, &["w1@1,1", "b1@1,11"]);
    let state = play_all(start, &walk(99));
    assert_eq!(state.history.as_slice().len(), 100);
    let state = after(&state, walk(100)[99]);
    assert_eq!(state.history.as_slice().len(), crate::history::CAPACITY);
}

// ---------------------------------------------------------------------------
// Order: a win comes before a draw
// ---------------------------------------------------------------------------

#[test]
fn reaching_the_back_row_on_the_hundredth_ply_wins() {
    let mut state = sparse(Side::White, &["w3@6,8", "b1@1,1"]);
    state.plies_without_capture = 99;
    let next = after(&state, mv((6, 8), (6, 11)));
    assert_eq!(next.outcome(), white_wins(WinReason::BackRow));
}

#[test]
fn leaving_the_opponent_without_a_play_on_the_hundredth_ply_wins() {
    let mut state = sparse(
        Side::White,
        &["b6@1,11", "w1@2,11", "w1@1,10", "w1@2,10", "w1@6,3"],
    );
    state.plies_without_capture = 99;
    let next = after(&state, mv((6, 3), (6, 4)));
    assert_eq!(next.outcome(), white_wins(WinReason::NoPlay));
}

/// Makes the position that `command` would reach count as already seen twice.
fn seen_twice_after(state: &GameState, command: Command) -> GameState {
    let reached = after(state, command).position_hash();
    let mut history = PositionHistory::new(0);
    for hash in [reached, 1, reached, state.position_hash()] {
        history.push(hash);
    }
    GameState { history, ..*state }
}

#[test]
fn a_win_comes_before_a_repetition_draw() {
    // Not reachable by play (a position with a die on the back row ends the
    // game), so the history is built by hand.
    let state = sparse(Side::White, &["w3@6,8", "b1@1,1"]);
    let command = mv((6, 8), (6, 11));
    let state = seen_twice_after(&state, command);
    assert_eq!(
        after(&state, command).outcome(),
        white_wins(WinReason::BackRow)
    );
}

#[test]
fn a_repetition_comes_before_the_hundred_plies_in_the_reported_reason() {
    let state = sparse(Side::White, &["w1@5,5", "b1@8,8"]);
    let command = mv((5, 5), (5, 6));
    let mut state = seen_twice_after(&state, command);
    state.plies_without_capture = 99;
    assert_eq!(
        after(&state, command).outcome(),
        Some(Outcome::Draw(DrawReason::Repetition))
    );
}
