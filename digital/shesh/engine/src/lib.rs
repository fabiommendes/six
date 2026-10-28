//! Rules engine of the Shesh, a race game in the line of the Royal Game of
//! Ur: pure and free of I/O. The rolls come from a seeded generator kept in
//! the state, so a game replays exactly. The rules are still a proposal, in
//! `dev/rfc/jogo-de-corrida.md`; they are not in `regras/` yet.
//!
//! - `state`: `GameState`, the turns, and `apply`, which plays a `Command`.
//! - `command`: `Command`, `Event`, `EndReason`, `GameError`.
//! - `rng`: the rolls of the binary dice.
//!
//! ```
//! use shesh_engine::GameState;
//!
//! let state = GameState::new(42);
//! let command = state.legal_commands()[0];
//! let (next, events) = state.apply(command).unwrap();
//! assert!(!events.is_empty());
//! assert_ne!(next, state);
//! ```

#![warn(unreachable_pub)]

mod command;
mod rng;
mod state;

#[cfg(feature = "wire")]
pub mod wire;

pub use command::{Command, EndReason, Event, GameError};
pub use rng::Rng;
pub use state::{
    GameState, Rules, BINARY_DICE, EXIT, MAX_VALUE, PLAYERS, POINTS_TO_WIN, ROSETTES, SHARED,
    SQUARES,
};
