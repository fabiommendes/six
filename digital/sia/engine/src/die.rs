//! A die of the bag: the number it shows and its suit.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

/// Suits of the bag: 0 to 3. The stones have a fifth suit that counts as any.
pub const SUITS: u8 = 4;

/// The suit of the joker, outside the bag: the color of the stones. Every
/// player has one, and it counts as any suit in a flush.
pub const JOKER_SUIT: u8 = 4;

/// A die with a number and a suit. Rolling a die changes the number only.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Die {
    /// 1 to 6.
    pub value: u8,
    /// 0 to 3, or 4 for the joker.
    pub suit: u8,
}

impl Die {
    pub const fn new(value: u8, suit: u8) -> Die {
        Die { value, suit }
    }

    /// Whether the die is the joker of its player: it counts as any suit.
    pub fn is_joker(&self) -> bool {
        self.suit == JOKER_SUIT
    }

    /// Whether the number and the suit are in range.
    pub fn is_valid(&self) -> bool {
        (1..=6).contains(&self.value) && self.suit <= JOKER_SUIT
    }
}
