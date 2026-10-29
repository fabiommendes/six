//! What a player does in a turn, what happens as a result, and why a
//! command may be refused.
//!
//! The engine rolls the binary dice at the start of every turn; the player
//! then moves one die by the roll, or passes when no die can move.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

/// A play of the player to move, with the roll of the turn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum Command {
    /// Puts the die of value `value` from the reserve on the square of the
    /// roll. With the ordered entry (the rules), only the smallest die of
    /// the reserve can enter.
    Enter { value: u8 },
    /// Moves the die on square `from` (1 to 17) forward by the roll.
    Move { from: u8 },
    /// Only when no die can move.
    Pass,
}

/// Why a game ended.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum EndReason {
    /// The player reached 10 points.
    Points { player: usize },
    /// A player took every die off the track, with an empty reserve, and
    /// `player` had more points (or ended it on a tie; see
    /// `Rules::all_home_wins`).
    AllHome { player: usize },
}

impl EndReason {
    pub fn winner(self) -> usize {
        match self {
            EndReason::Points { player } | EndReason::AllHome { player } => player,
        }
    }
}

/// Something that happened, in order, for an interface or a statistic.
/// `square` is always in the numbering of the track of `player`.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum Event {
    /// The start of a turn and its roll.
    Rolled {
        player: usize,
        roll: u8,
    },
    Entered {
        player: usize,
        value: u8,
        square: u8,
    },
    Moved {
        player: usize,
        from: u8,
        to: u8,
    },
    /// The die joined another die of the player: `lost` is what went over 6.
    Fused {
        player: usize,
        square: u8,
        value: u8,
        lost: u8,
    },
    /// The die, of value `value`, landed on a die of the other player
    /// not smaller and went back to the reserve: the other die lost
    /// `value` for good and shows `left` (0: it left the game).
    Worn {
        player: usize,
        square: u8,
        value: u8,
        left: u8,
    },
    /// The die, bigger, ate a die of value `taken`, which went back to the
    /// reserve of its owner: the die now shows its value minus `taken` plus
    /// 1 (`value`), and the player gained a die of value `taken` in the
    /// reserve.
    Captured {
        player: usize,
        square: u8,
        value: u8,
        taken: u8,
    },
    /// The die stopped right behind a die of the other player, which now
    /// shows `value` (a 1 does not lose).
    Touched {
        player: usize,
        square: u8,
        value: u8,
    },
    /// A die of value `value` left the track: `points` is the new total.
    Exited {
        player: usize,
        value: u8,
        points: u8,
    },
    /// The die stopped on a rosette: the player rolls again.
    ExtraTurn {
        player: usize,
    },
    Passed {
        player: usize,
    },
    Ended {
        reason: EndReason,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameError {
    Ended,
    /// The command is not among `legal_commands`.
    Illegal(Command),
}

impl std::fmt::Display for GameError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GameError::Ended => write!(f, "the game has ended"),
            GameError::Illegal(command) => write!(f, "illegal command {command:?}"),
        }
    }
}

impl std::error::Error for GameError {}
