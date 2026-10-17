//! The dice: whose they are and the value on top.

use crate::cell::BOARD_SIZE;

/// Highest value of a die.
pub const MAX_VALUE: u8 = 6;

/// One of the two players, and the color of their dice.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Side {
    /// The Whites (`white`), who play first and start at row 1.
    White,
    /// The Blacks (`black`), who start at row 11.
    Black,
}

impl Side {
    /// Both sides, Whites first.
    pub const ALL: [Side; 2] = [Side::White, Side::Black];

    /// The other side.
    pub const fn opponent(self) -> Side {
        match self {
            Side::White => Side::Black,
            Side::Black => Side::White,
        }
    }

    /// The row of the player's own back row: 1 for the Whites, 11 for the
    /// Blacks.
    pub const fn back_row(self) -> u8 {
        match self {
            Side::White => 1,
            Side::Black => BOARD_SIZE,
        }
    }

    /// The row where a die of this side wins: the back row of the opponent.
    pub const fn goal_row(self) -> u8 {
        self.opponent().back_row()
    }

    /// 0 for the Whites, 1 for the Blacks.
    pub(crate) const fn index(self) -> usize {
        match self {
            Side::White => 0,
            Side::Black => 1,
        }
    }
}

/// A die on the board: its side and the value on top, from 1 to 6.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Die {
    side: Side,
    value: u8,
}

impl Die {
    /// A die of `side` showing `value`.
    ///
    /// # Panics
    ///
    /// If `value` is outside 1 to 6.
    pub const fn new(side: Side, value: u8) -> Die {
        assert!(value >= 1 && value <= MAX_VALUE, "die value must be 1 to 6");
        Die { side, value }
    }

    /// Whose die it is.
    pub const fn side(self) -> Side {
        self.side
    }

    /// The value on top, from 1 to 6.
    pub const fn value(self) -> u8 {
        self.value
    }
}
