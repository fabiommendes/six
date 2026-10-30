//! Rules engine of the dice connection game, a prototype whose rules are
//! still a proposal in `dev/rfc/jogo-de-conexao.md`.
//!
//! - `game`: the board, the moves, the neighbor limit and the end of the
//!   game.
//! - `rng`: the seeded generator the bots and batches share.
//!
//! The engine takes one move at a time and lists the legal ones: it is built
//! for bot batches, not yet for an interface.

#![warn(unreachable_pub)]

mod game;
mod rng;

pub use game::{
    neighbors, pos, Color, Die, Game, Goal, Move, Outcome, Pos, Rules, Source, CAPTURE_VALUE,
    CELLS, SIZE,
};
pub use rng::Rng;
