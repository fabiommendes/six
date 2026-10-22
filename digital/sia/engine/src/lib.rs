//! Rules engine of the Sia: pure and free of I/O. The dice come from a
//! seeded generator kept in the state, so a game replays exactly. The rules
//! are in `regras/sia/` and the terms in its `GLOSSARY.md` (the `en:` lines
//! name the code: the stones are the 9 dice of the middle row).
//!
//! - `die`: `Die`, a number and a suit.
//! - `formation`: the formations, their order, and the best one a side can
//!   still become (the base of the claim proof).
//! - `state`: `GameState`, the preparation and the turns, and `apply`, which
//!   plays a `Command`.
//! - `command`: `Command`, `Event`, `EndReason`, `GameError`.
//! - `rng`: the dice rolls and the suits of the bag.
//! - `wire` (feature `wire`): the JSON adapter and the TypeScript types.
//!
//! A turn is a sequence of commands of one player: an optional `Reroll`,
//! any number of `Claim`, then a `Place` (or a `Pass` with no room). The
//! `Place` or the `Pass` ends the turn.
//!
//! ```
//! use sia_engine::GameState;
//!
//! let (state, _events) = GameState::new(42);
//! let command = state.legal_commands()[0];
//! let (next, events) = state.apply(command).unwrap();
//! assert!(!events.is_empty());
//! assert_ne!(next, state);
//! ```

#![warn(unreachable_pub)]

mod command;
mod die;
pub mod experiment;
mod formation;
mod rng;
mod state;

#[cfg(feature = "wire")]
pub mod wire;

pub use command::{Command, EndReason, Event, GameError, Rolled};
pub use die::{Die, SUITS, WILD_SUIT};
pub use formation::{best_completion, formation, is_flush, Formation, FormationKind};
pub use rng::Rng;
pub use state::{
    GameState, Player, Side, Step, DEFAULT_HAND_SIZE, HAND_SIZES, NEIGHBORS_TO_WIN, PLAYERS,
    SIDE_DICE, STONES, STONES_TO_WIN,
};
