//! What a command did, for the log and the animation of an interface, and
//! the errors for commands the engine refuses.
//!
//! The engine keeps no history: [`crate::Engine::command`] returns the events
//! of one command in a [`Transition`], and callers that show a log keep them.
//! Simulations use [`crate::Engine::step`], which makes none.

use std::fmt;

use crate::cell::Cell;
use crate::die::{Die, Side};
use crate::outcome::Outcome;
use crate::state::GameState;

/// The result of applying a command: the new state and what happened. The
/// state the command was applied to is unchanged.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Transition {
    pub state: GameState,
    /// In the order they happened: the move, increment or shot, then the
    /// captures (the die shot, then north, west, south, east of the cell where
    /// the die stopped), then the end of the game.
    pub events: Vec<GameEvent>,
}

/// One thing that happened in a [`Transition`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameEvent {
    /// A die of `side` moved from `from` to `to`, and now shows `value`, the
    /// number of cells it walked.
    Moved {
        side: Side,
        from: Cell,
        to: Cell,
        value: u8,
    },
    /// A die of `side` in `at` was incremented and now shows `value`.
    Incremented { side: Side, at: Cell, value: u8 },
    /// The 6 of `side` in `from`, the center cell, shot the die in `to` and
    /// took its cell, still showing 6. A `Captured` event for the die in
    /// `to` follows.
    Shot { side: Side, from: Cell, to: Cell },
    /// `die` was captured in `at` and left the board.
    Captured { at: Cell, die: Die },
    /// The game ended with `outcome`.
    GameEnded { outcome: Outcome },
}

/// A command the engine refused. The state is unchanged.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameError {
    /// The game is over: no command is legal.
    GameOver,
    /// There is no die of the side to move in `at`.
    NotYourDie { at: Cell },
    /// The die in `from` cannot reach `to`: not a straight line, farther
    /// than its value, blocked by a die on the way, or `to` is occupied.
    IllegalMove { from: Cell, to: Cell },
    /// The die in `at` shows 6, the maximum.
    CannotIncrement { at: Cell },
    /// It is the first turn of the game: the Whites must move, so the die in
    /// `at` cannot be incremented.
    FirstTurnMustMove { at: Cell },
    /// The side to move has no 6 in the center cell, or `to` is not the
    /// first die of the opponent on one of its 8 lines.
    IllegalShot { to: Cell },
}

impl fmt::Display for GameError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GameError::GameOver => f.write_str("the game is over"),
            GameError::NotYourDie { at } => {
                write!(f, "no die of the side to move at {at}")
            }
            GameError::IllegalMove { from, to } => {
                write!(f, "the die at {from} cannot move to {to}")
            }
            GameError::CannotIncrement { at } => {
                write!(f, "the die at {at} already shows 6")
            }
            GameError::FirstTurnMustMove { at } => {
                write!(f, "the die at {at} cannot be incremented on the first turn")
            }
            GameError::IllegalShot { to } => {
                write!(f, "no 6 in the center can shoot the die at {to}")
            }
        }
    }
}

impl std::error::Error for GameError {}
