//! A die of the bag: the number it shows and its suit.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

/// Suits of the bag. The stones have a fifth suit that counts as any.
pub const SUITS: u8 = 4;

/// The suit that is wild in the variant with a wild suit.
pub const WILD_SUIT: u8 = 3;

/// A die with a number and a suit. Rolling a die changes the number only.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Die {
    /// 1 to 6.
    pub value: u8,
    /// 0 to 3.
    pub suit: u8,
}

impl Die {
    pub const fn new(value: u8, suit: u8) -> Die {
        Die { value, suit }
    }

    /// Whether the die is wild: the suit 3 in the variant with a wild suit
    /// (see [`crate::experiment`]). It counts as any suit in a flush.
    pub fn is_wild(&self) -> bool {
        self.suit == WILD_SUIT && crate::experiment::wild_suit()
    }

    /// Whether the number and the suit are in range.
    pub fn is_valid(&self) -> bool {
        (1..=6).contains(&self.value) && self.suit < SUITS
    }
}
