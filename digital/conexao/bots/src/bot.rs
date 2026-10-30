//! The bots and their names.

use conexao_engine::{Game, Move, Rng};

use crate::eval::{evaluate, Terms, WIN};

/// The names [`by_name`] knows. Suffixes on the greedy bots switch features
/// off, to measure them: `-blind` drops the capture terms of the evaluation,
/// and `-flat` judges every empty square for a 2. They combine, as in
/// `lookahead-flat-blind`.
pub const BOTS: [&str; 5] = ["random", "greedy", "noblock", "lookahead", "search"];

pub trait Bot: Send {
    fn choose(&mut self, game: &Game) -> Move;
}

pub fn by_name(name: &str, seed: u64) -> Result<Box<dyn Bot>, String> {
    let rng = Rng::new(seed);
    let mut base = name;
    let mut terms = Terms::ALL;
    loop {
        if let Some(rest) = base.strip_suffix("-blind") {
            terms.captures = false;
            base = rest;
        } else if let Some(rest) = base.strip_suffix("-flat") {
            terms.values = false;
            base = rest;
        } else {
            break;
        }
    }
    Ok(match base {
        "random" if terms == Terms::ALL => Box::new(Random(rng)),
        "greedy" => Box::new(Greedy {
            rng,
            block: true,
            terms,
        }),
        "noblock" => Box::new(Greedy {
            rng,
            block: false,
            terms,
        }),
        "lookahead" => Box::new(Lookahead {
            rng,
            width: 8,
            terms,
        }),
        "search" => Box::new(Search {
            rng,
            depth: 3,
            width: 8,
            terms,
        }),
        _ => return Err(format!("unknown bot {name:?}, known: {}", BOTS.join(", "))),
    })
}

/// A uniformly random legal move.
pub struct Random(pub Rng);

impl Bot for Random {
    fn choose(&mut self, game: &Game) -> Move {
        let moves = game.legal_moves();
        moves[self.0.below(moves.len())]
    }
}

fn child(game: &Game, mv: Move) -> Game {
    let mut next = game.clone();
    next.play(mv).expect("a legal move");
    next
}

/// The legal moves with the score of the position after each, best first,
/// ties in random order.
fn ranked(game: &Game, rng: &mut Rng, block: bool, terms: Terms) -> Vec<(i32, Move)> {
    let me = game.turn;
    let mut moves: Vec<Move> = game
        .legal_moves()
        .into_iter()
        .filter(|m| block || !matches!(m, Move::Block { .. }))
        .collect();
    if moves.is_empty() {
        moves = game.legal_moves();
    }
    rng.shuffle(&mut moves);
    let mut scored: Vec<(i32, Move)> = moves
        .into_iter()
        .map(|m| (evaluate(&child(game, m), me, terms), m))
        .collect();
    scored.sort_by_key(|&(s, _)| -s);
    scored
}

/// The move to the best position by [`evaluate`], one ply deep. With `block`
/// off it never blocks, to measure what the action is worth.
pub struct Greedy {
    pub rng: Rng,
    pub block: bool,
    pub terms: Terms,
}

impl Bot for Greedy {
    fn choose(&mut self, game: &Game) -> Move {
        ranked(game, &mut self.rng, self.block, self.terms)[0].1
    }
}

/// Takes the `width` best greedy moves and keeps the one whose best greedy
/// reply leaves the best position.
pub struct Lookahead {
    pub rng: Rng,
    pub width: usize,
    pub terms: Terms,
}

impl Bot for Lookahead {
    fn choose(&mut self, game: &Game) -> Move {
        let me = game.turn;
        let candidates = ranked(game, &mut self.rng, true, self.terms);
        if candidates[0].0 >= WIN - 300 {
            return candidates[0].1;
        }
        let mut best = (i32::MIN, candidates[0].1);
        for &(_, mv) in candidates.iter().take(self.width) {
            let next = child(game, mv);
            let value = if next.outcome.is_some() {
                evaluate(&next, me, self.terms)
            } else {
                -ranked(&next, &mut self.rng, true, self.terms)[0].0
            };
            if value > best.0 {
                best = (value, mv);
            }
        }
        best.1
    }
}

/// Alpha-beta to `depth` plies, over the `width` best greedy moves of each
/// position; the last ply is the greedy ranking itself.
pub struct Search {
    pub rng: Rng,
    pub depth: u32,
    pub width: usize,
    pub terms: Terms,
}

impl Search {
    /// The value of `game` for the player to move.
    fn value(&mut self, game: &Game, depth: u32, mut alpha: i32, beta: i32) -> i32 {
        if game.outcome.is_some() {
            return evaluate(game, game.turn, self.terms);
        }
        let ranked = ranked(game, &mut self.rng, true, self.terms);
        if depth <= 1 || ranked[0].0 > WIN - 300 {
            return ranked[0].0;
        }
        let mut best = i32::MIN + 1;
        for &(_, mv) in ranked.iter().take(self.width) {
            let v = -self.value(&child(game, mv), depth - 1, -beta, -alpha);
            best = best.max(v);
            alpha = alpha.max(v);
            if alpha >= beta {
                break;
            }
        }
        best
    }
}

impl Bot for Search {
    fn choose(&mut self, game: &Game) -> Move {
        let ranked = ranked(game, &mut self.rng, true, self.terms);
        if self.depth <= 1 || ranked[0].0 > WIN - 300 {
            return ranked[0].1;
        }
        let (mut alpha, beta) = (i32::MIN + 1, i32::MAX);
        let mut best = ranked[0].1;
        for &(_, mv) in ranked.iter().take(self.width) {
            let v = -self.value(&child(game, mv), self.depth - 1, -beta, -alpha);
            if v > alpha {
                alpha = v;
                best = mv;
            }
        }
        best
    }
}
