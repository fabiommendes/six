//! Rules engine of Seks: pure, deterministic and free of I/O. The state is a
//! value ([`GameState`], `Copy`); applying a command returns the new state
//! and its events. The rules are in `regras/seks/` and the terms in its
//! `GLOSSARY.md` (the `en:` lines name the code).
//!
//! Where things live (each module's `//!` has the details):
//!
//! - Geometry: `cell` (coordinates 1 to 11 as in the rules, row 1 on the
//!   Whites' side, and the only conversion to an array index), `die` (`Side`
//!   and `Die`), `board` (the 121 cells), `diagram` (text diagram of a
//!   board, to write positions in tests).
//! - State: `state` (`GameState`), `history` and `zobrist` (hashes of the
//!   positions since the last capture, for the repetition draw), `outcome`
//!   (how a game ends).
//! - Plays: `command` (`Command` and the list of legal ones), `apply` (what
//!   a play changes) and `capture` (custody), `event` (`GameEvent`, `Transition`, `GameError`),
//!   `engine` (`Engine`, the entry points), `notation` (text of cells and
//!   commands).
//! - `wire` (feature `wire`): the JSON adapter and the TypeScript types for
//!   the web client and the server. The domain types have no serde.

//! # Playing
//!
//! ```
//! use seks_engine::{legal_commands, Command, Engine, GameEvent};
//!
//! let state = Engine::new_game();
//! let command: Command = "b2-b4".parse().unwrap();
//! assert!(legal_commands(&state).contains(&command));
//! let transition = Engine::command(&state, command).unwrap();
//! assert!(matches!(transition.events[0], GameEvent::Moved { value: 2, .. }));
//! ```
//!
//! # Positions for tests
//!
//! `GameState::from_diagram` reads a position from 11 lines of text, row 11
//! (the Blacks) on top and row 1 (the Whites) at the bottom. A cell is `..`
//! when empty, or `w`/`b` and the value: `w3`, `b6`.
//!
//! ```
//! use seks_engine::{GameState, Side};
//!
//! let state = GameState::from_diagram("
//!     .. .. .. .. .. .. .. .. .. .. b1
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     w3 .. .. .. .. .. .. .. .. .. ..
//! ", Side::White).unwrap();
//! assert_eq!(state.board().count(Side::White), 1);
//! ```
//!
//! `Board` prints in the same format, which helps in failing tests.

#![warn(unreachable_pub)]

mod apply;
mod board;
mod capture;
mod cell;
mod command;
mod diagram;
mod die;
mod engine;
mod event;
mod history;
mod notation;
mod outcome;
mod state;
mod zobrist;

#[cfg(feature = "wire")]
pub mod wire;

#[cfg(test)]
mod testing;
#[cfg(test)]
mod tests;

pub use board::Board;
pub use capture::captures;
pub use cell::{Cell, BOARD_SIZE, CELL_COUNT, DIRECTIONS};
pub use command::{legal_commands, legal_commands_into, Command};
pub use diagram::DiagramError;
pub use die::{Die, Side, MAX_VALUE};
pub use engine::Engine;
pub use event::{GameError, GameEvent, Transition};
pub use notation::NotationError;
pub use outcome::{
    DrawReason, Outcome, WinReason, MAX_PLIES_WITHOUT_CAPTURE, REPETITIONS_FOR_DRAW,
};
pub use state::GameState;
