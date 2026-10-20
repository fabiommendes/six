//! What a player does in a turn, what happens as a result, and why a
//! command may be refused (`regras/liu/03-rodada.md#turno`).

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

use crate::window::{PlaceError, Pos};

/// A play. `die` is an index into the market.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum Command {
    /// Takes a die of the market and puts it in the window.
    PlaceFromMarket { die: usize, at: Pos },
    /// Takes a die of the market into the hand and puts the die that was in
    /// the hand in the window.
    PlaceFromHand { die: usize, at: Pos },
    /// With an empty hand, takes a die of the market into the hand.
    Keep { die: usize },
    /// With a die in the hand, returns it to the market and rolls the whole
    /// market again. The same player then places or keeps a die.
    Reroll,
    /// Does nothing. Always allowed, but not right after a reroll.
    Pass,
}

/// Why a game ended (`regras/liu/05-fim-do-jogo.md`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum EndReason {
    /// A player completed the window.
    WindowComplete { player: usize },
    /// The bag ran out while the market was being filled.
    BagEmpty,
    /// A whole round passed without a die put in a window.
    NoPlacement,
}

/// Something that happened, in order, for an interface to show.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(tag = "kind", rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum Event {
    /// Dice drawn from the bag and rolled into the market, in order.
    MarketFilled {
        drawn: Vec<u8>,
    },
    /// A round began with `first` to play: the owner of the seal number
    /// with the most dice in the market.
    RoundStarted {
        round: u16,
        first: usize,
    },
    Placed {
        player: usize,
        value: u8,
        at: Pos,
        #[cfg_attr(feature = "wire", serde(rename = "fromHand"))]
        from_hand: bool,
    },
    /// A die of the market went to the hand.
    Kept {
        player: usize,
        value: u8,
    },
    /// The die of the hand went back to the market, and the market was
    /// rolled again: `market` is the new market.
    Rerolled {
        player: usize,
        returned: u8,
        market: Vec<u8>,
    },
    Passed {
        player: usize,
    },
    /// The player drew a die from the bag, turned to the seal number, into
    /// the hand.
    SealBonus {
        player: usize,
        value: u8,
    },
    GameOver {
        reason: EndReason,
    },
}

/// Why a command was refused. Nothing changes then.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameError {
    GameOver,
    /// No die with this index in the market.
    NoSuchDie {
        die: usize,
    },
    HandEmpty,
    HandFull,
    /// After a reroll the player must place or keep a die.
    MustTake,
    Place(PlaceError),
}

impl std::fmt::Display for GameError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GameError::GameOver => write!(f, "the game is over"),
            GameError::NoSuchDie { die } => write!(f, "no die {die} in the market"),
            GameError::HandEmpty => write!(f, "the hand is empty"),
            GameError::HandFull => write!(f, "the hand already holds a die"),
            GameError::MustTake => write!(f, "after a reroll, place or keep a die"),
            GameError::Place(error) => write!(f, "the die cannot go there: {error:?}"),
        }
    }
}

impl std::error::Error for GameError {}

impl From<PlaceError> for GameError {
    fn from(error: PlaceError) -> GameError {
        GameError::Place(error)
    }
}
