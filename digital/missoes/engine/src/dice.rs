//! The kinds of dice and their faces.

use crate::Rng;

/// A kind of die. Every kind has six printed faces.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Kind {
    Common,
    /// A common die of its own color: the sum of the rolled gold dice
    /// orders the purchases.
    Gold,
    /// A gold die with high faces: 3 4 4 5 5 6.
    HighGold,
    One,
    Low,
    High,
    Even,
    Odd,
    /// 0 0 0 1 1 1: a 0 rerolls another die of the player.
    Binary,
    /// 1 1 2 2 0 0: moves another die of the player up or down by the
    /// face; a 0 rerolls another die.
    Modifier,
}

impl Kind {
    pub const ALL: [Kind; 10] = [
        Kind::Common,
        Kind::Gold,
        Kind::HighGold,
        Kind::One,
        Kind::Low,
        Kind::High,
        Kind::Even,
        Kind::Odd,
        Kind::Binary,
        Kind::Modifier,
    ];

    /// The kinds sold in the market, besides the two golds.
    pub const SPECIAL: [Kind; 7] = [
        Kind::One,
        Kind::Low,
        Kind::High,
        Kind::Even,
        Kind::Odd,
        Kind::Binary,
        Kind::Modifier,
    ];

    pub fn faces(self) -> [i8; 6] {
        match self {
            Kind::Common | Kind::Gold => [1, 2, 3, 4, 5, 6],
            Kind::HighGold => [3, 4, 4, 5, 5, 6],
            Kind::One => [1; 6],
            Kind::Low => [1, 1, 2, 2, 3, 3],
            Kind::High => [4, 4, 5, 5, 6, 6],
            Kind::Even => [2, 2, 4, 4, 6, 6],
            Kind::Odd => [1, 1, 3, 3, 5, 5],
            Kind::Binary => [0, 0, 0, 1, 1, 1],
            Kind::Modifier => [1, 1, 2, 2, 0, 0],
        }
    }

    pub fn is_gold(self) -> bool {
        matches!(self, Kind::Gold | Kind::HighGold)
    }

    pub fn roll(self, rng: &mut Rng) -> Rolled {
        Rolled {
            kind: self,
            face: self.faces()[rng.below(6)],
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Kind::Common => "common",
            Kind::Gold => "gold",
            Kind::HighGold => "highgold",
            Kind::One => "one",
            Kind::Low => "low",
            Kind::High => "high",
            Kind::Even => "even",
            Kind::Odd => "odd",
            Kind::Binary => "binary",
            Kind::Modifier => "modifier",
        }
    }
}

/// A rolled die: its kind and the face on top.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rolled {
    pub kind: Kind,
    pub face: i8,
}

impl Rolled {
    /// A 0 of a binary or a modifier: it rerolls another die.
    pub fn is_zero(self) -> bool {
        matches!(self.kind, Kind::Binary | Kind::Modifier) && self.face == 0
    }

    /// The value the die adds to a mission: none for a binary on 0 and for
    /// a modifier.
    pub fn value(self) -> Option<u8> {
        match self.kind {
            Kind::Modifier => None,
            Kind::Binary if self.face == 0 => None,
            _ => Some(self.face as u8),
        }
    }
}
