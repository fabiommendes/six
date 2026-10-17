//! How a game ends (`regras/seks/05-fim-do-jogo.md`).
//!
//! After every play the engine checks, in this order:
//!
//! 1. the mover's die ended a move on the opponent's back row: the mover wins;
//! 2. the opponent has no play: the mover wins;
//! 3. the position has now occurred 3 times, or 100 plays in a row had no
//!    capture: draw.
//!
//! A win comes before a draw, as checkmate on the 50th move wins in chess.
//! When both draws happen at once, the reported reason is the repetition.

use crate::die::Side;

/// Plays in a row without a capture that draw the game: 50 by each player.
pub const MAX_PLIES_WITHOUT_CAPTURE: u8 = 100;

/// Occurrences of a position that draw the game.
pub const REPETITIONS_FOR_DRAW: usize = 3;

/// Why a side won.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum WinReason {
    /// A die ended a move on the opponent's back row.
    BackRow,
    /// The opponent has no play left: no dice, or only 6s with no free
    /// cell around.
    NoPlay,
}

/// Why the game was drawn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum DrawReason {
    /// The same position, with the same side to move, for the third time.
    Repetition,
    /// 100 plays in a row without a capture.
    NoCapture,
}

/// The result of a finished game.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Outcome {
    Win { winner: Side, reason: WinReason },
    Draw(DrawReason),
}
