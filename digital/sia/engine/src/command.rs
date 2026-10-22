//! What a player does in a turn, what happens as a result, and why a
//! command may be refused (`regras/sia/03-turno.md`).
//!
//! A turn is a sequence of commands of the same player: an optional
//! `Reroll`, any number of `Claim`, then a `Place` (or a `Pass`, when no die
//! fits). The engine then draws the new dice and passes the turn.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

use crate::die::Die;
use crate::formation::Formation;

/// A play of the player to move. Indexes of dice are positions in the hand
/// as it is before the command.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum Command {
    /// Step 1. Loses the die `lost` of the own hand for ever and rolls
    /// again the dice of the hand of `target` (the own or the other) whose
    /// bit is set in `dice` (bit `i` is the die at index `i`). Only at the
    /// start of the turn; the own hand needs 2 dice or more, the dice to
    /// roll must be at least one and, in the own hand, not the lost one.
    Reroll {
        target: usize,
        lost: usize,
        dice: u16,
    },
    /// Step 2. Takes a stone, proving it is the player's.
    Claim { stone: usize },
    /// Step 3. Puts the die `die` of the hand on the side of the player at
    /// `stone`. Ends the turn after the draw.
    Place { die: usize, stone: usize },
    /// Step 3, instead of `Place` (experiment `place_on_opponent` only): puts
    /// the die `die` of the hand on the side of the opponent at `stone`,
    /// which must have room. The hand is not refilled for it: the die counts
    /// as lost. Needs 2 dice or more in the hand.
    PlaceOnOpponent { die: usize, stone: usize },
    /// Step 3 when no stone has room on the side of the player: ends the
    /// turn.
    Pass,
}

/// Why a game ended (`regras/sia/05-fim-do-jogo.md`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum EndReason {
    /// A player took the fifth stone.
    Stones { player: usize },
    /// A player took the third neighbor stone. (Checked before the fifth
    /// stone, when one claim does both.)
    Neighbors { player: usize },
    /// Nobody could put a die: the stones left were resolved and the one
    /// with more stones wins, or the game is drawn.
    NoRoom,
}

/// A die rolled again.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Rolled {
    /// Position in the hand before the reroll.
    pub index: usize,
    pub from: Die,
    pub to: Die,
}

/// Something that happened, in order, for an interface to show.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum Event {
    /// The preparation: the numbers of the stones, from left to right.
    StonesRolled {
        stones: Vec<u8>,
    },
    /// Dice drawn from the bag and rolled into a hand, in order: the
    /// preparation or the end of a turn.
    Drawn {
        player: usize,
        dice: Vec<Die>,
    },
    /// A turn began.
    TurnStarted {
        player: usize,
        turn: u16,
    },
    /// The player lost `lost` (at `lost_index` of the own hand) and rolled
    /// again some dice of the hand of `target`.
    Rerolled {
        player: usize,
        target: usize,
        lost: Die,
        #[cfg_attr(feature = "wire", serde(rename = "lostIndex"))]
        lost_index: usize,
        rolled: Vec<Rolled>,
    },
    /// The player took a stone with `formation`. `proven` is true when the
    /// other side was incomplete and the claim was a proof.
    Claimed {
        player: usize,
        stone: usize,
        formation: Formation,
        proven: bool,
    },
    /// The player put the die at `hand_index` on `stone`. `completes` is
    /// true when it was the third die of the side. (A `PlaceOnOpponent`,
    /// experiment only, gives the same event: the die lands on the side of
    /// the opponent. Reusing it keeps the wire events as they are.)
    Placed {
        player: usize,
        die: Die,
        #[cfg_attr(feature = "wire", serde(rename = "handIndex"))]
        hand_index: usize,
        stone: usize,
        completes: bool,
    },
    /// The player could not put a die and ended the turn.
    Passed {
        player: usize,
    },
    /// At the end of the game by lack of room, a stone went to `player`,
    /// or to nobody.
    Awarded {
        stone: usize,
        player: Option<usize>,
    },
    GameEnded {
        reason: EndReason,
    },
}

/// Why a command was refused. Nothing changes then.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameError {
    GameOver,
    /// The reroll is only the first step of the turn.
    RerollClosed,
    NoSuchPlayer {
        player: usize,
    },
    /// The own hand needs 2 dice or more to reroll.
    HandTooSmall,
    NoSuchDie {
        die: usize,
    },
    /// No die selected to roll, or one outside the hand.
    BadRoll,
    /// The die lost cannot also be rolled.
    LostRolled,
    NoSuchStone {
        stone: usize,
    },
    StoneTaken {
        stone: usize,
    },
    SideFull {
        stone: usize,
    },
    /// The claim is not proven.
    NotProven {
        stone: usize,
    },
    /// Placing on the opponent is not part of the rules in force.
    PlaceOnOpponentClosed,
    /// Passing is only for a player with no room to put a die.
    MustPlace,
}

impl std::fmt::Display for GameError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GameError::GameOver => write!(f, "the game is over"),
            GameError::RerollClosed => write!(f, "rerolling is only the first step of the turn"),
            GameError::NoSuchPlayer { player } => write!(f, "no player {player}"),
            GameError::HandTooSmall => write!(f, "the hand needs 2 dice to reroll"),
            GameError::NoSuchDie { die } => write!(f, "no die {die} in the hand"),
            GameError::BadRoll => write!(f, "choose at least one die of the hand to roll"),
            GameError::LostRolled => write!(f, "the lost die cannot be rolled"),
            GameError::NoSuchStone { stone } => write!(f, "no stone {stone}"),
            GameError::StoneTaken { stone } => write!(f, "the stone {stone} is already taken"),
            GameError::SideFull { stone } => write!(f, "the side of the stone {stone} is full"),
            GameError::NotProven { stone } => write!(f, "the stone {stone} is not proven yours"),
            GameError::PlaceOnOpponentClosed => {
                write!(f, "placing on the opponent is not in the rules")
            }
            GameError::MustPlace => write!(f, "a die fits: place one"),
        }
    }
}

impl std::error::Error for GameError {}
