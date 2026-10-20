//! Rules engine of the Liu: pure and free of I/O. The dice rolls come from
//! a seeded generator kept in the state, so a game replays exactly. The
//! rules are in `regras/liu/` and the terms in its `GLOSSARY.md` (the `en:`
//! lines name the code).
//!
//! - `window`: the window of a player (`Window`, `Pos`), where a die may go
//!   and the complete lines.
//! - `state`: `GameState`, the preparation, the market and the rounds, and
//!   `apply`, which plays a `Command`.
//! - `command`: `Command`, `Event`, `EndReason`, `GameError`.
//! - `score`: the points of a window with its best code, and the winners.
//! - `rng`: the dice rolls.
//! - `wire` (feature `wire`): the JSON adapter and the TypeScript types.
//!
//! ```
//! use liu_engine::{Command, GameState};
//!
//! let (state, _events) = GameState::new(2, 42);
//! let command = state.legal_commands()[0];
//! let (next, events) = state.apply(command).unwrap();
//! assert!(!events.is_empty());
//! assert_ne!(next, state);
//! # let _ = Command::Pass;
//! ```

#![warn(unreachable_pub)]

mod command;
mod rng;
mod score;
mod state;
mod window;

#[cfg(feature = "wire")]
pub mod wire;

pub use command::{Command, EndReason, Event, GameError};
pub use rng::Rng;
pub use score::{is_run, score, winners, LineScore, Score, RUNS};
pub use state::{GameState, Player, DICE_PER_PLAYER, MAX_PLAYERS, MIN_PLAYERS};
pub use window::{Bounds, Line, LineKind, PlaceError, Placed, Pos, Window, FULL, SIDE};
