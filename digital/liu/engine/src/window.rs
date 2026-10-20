//! The window of a player: the dice laid out in rows and columns from the
//! seal (`regras/liu/04-janela.md`).
//!
//! Positions are relative to the seal, which sits at row 0, column 0. Rows
//! grow downwards and columns to the right. The region of 4 by 4 cells is not
//! fixed, so every position from -3 to 3 may hold a die while the window is
//! small.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

/// Side of the region a window must fit in.
pub const SIDE: i8 = 4;

/// Dice of a complete window.
pub const FULL: usize = (SIDE * SIDE) as usize;

/// A cell of a window, relative to the seal.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Pos {
    pub row: i8,
    pub col: i8,
}

impl Pos {
    pub const SEAL: Pos = Pos { row: 0, col: 0 };

    pub const fn new(row: i8, col: i8) -> Pos {
        Pos { row, col }
    }

    fn neighbours(self) -> [Pos; 4] {
        let Pos { row, col } = self;
        [
            Pos::new(row - 1, col),
            Pos::new(row + 1, col),
            Pos::new(row, col - 1),
            Pos::new(row, col + 1),
        ]
    }
}

/// A die in a window.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Placed {
    pub at: Pos,
    pub value: u8,
}

/// Why a die cannot go to a cell.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PlaceError {
    /// Not a number from 1 to 6.
    BadValue,
    Occupied,
    NotTouching,
    TooWide,
    Repeats,
}

/// The dice of one player, the seal first.
/// Crosses JSON as the list of its dice (`Placed[]`), checked when read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Window {
    dice: Vec<Placed>,
}

#[cfg(feature = "wire")]
impl Serialize for Window {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.dice.serialize(serializer)
    }
}

#[cfg(feature = "wire")]
impl<'de> Deserialize<'de> for Window {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Window, D::Error> {
        let dice = Vec::<Placed>::deserialize(deserializer)?;
        Window::from_dice(&dice).map_err(serde::de::Error::custom)
    }
}

/// The rows and columns a window may still use: every cell of every region
/// of 4 by 4 cells that holds all its dice.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Bounds {
    pub top: i8,
    pub bottom: i8,
    pub left: i8,
    pub right: i8,
}

impl Bounds {
    pub fn contains(&self, at: Pos) -> bool {
        (self.top..=self.bottom).contains(&at.row) && (self.left..=self.right).contains(&at.col)
    }
}

impl Window {
    /// A window with only the seal.
    pub fn new(seal: u8) -> Window {
        Window {
            dice: vec![Placed {
                at: Pos::SEAL,
                value: seal,
            }],
        }
    }

    /// A window from its dice, the seal first at row 0, column 0. Checks
    /// every rule of placement, as if the dice had been put in that order.
    pub fn from_dice(dice: &[Placed]) -> Result<Window, String> {
        let Some((seal, rest)) = dice.split_first() else {
            return Err("a window has at least the seal".into());
        };
        if seal.at != Pos::SEAL || !(1..=6).contains(&seal.value) {
            return Err("the first die of a window is the seal, at 0,0".into());
        }
        let mut window = Window::new(seal.value);
        for die in rest {
            window.place(die.at, die.value).map_err(|error| {
                format!(
                    "die {} at {},{}: {error:?}",
                    die.value, die.at.row, die.at.col
                )
            })?;
        }
        Ok(window)
    }

    pub fn dice(&self) -> &[Placed] {
        &self.dice
    }

    pub fn len(&self) -> usize {
        self.dice.len()
    }

    pub fn is_empty(&self) -> bool {
        self.dice.is_empty()
    }

    pub fn is_complete(&self) -> bool {
        self.dice.len() == FULL
    }

    pub fn seal(&self) -> u8 {
        self.dice[0].value
    }

    pub fn value_at(&self, at: Pos) -> Option<u8> {
        self.dice
            .iter()
            .find(|die| die.at == at)
            .map(|die| die.value)
    }

    pub fn bounds(&self) -> Bounds {
        let rows = self.dice.iter().map(|die| die.at.row);
        let cols = self.dice.iter().map(|die| die.at.col);
        let (top, bottom) = (rows.clone().min().unwrap(), rows.max().unwrap());
        let (left, right) = (cols.clone().min().unwrap(), cols.max().unwrap());
        Bounds {
            top: bottom - (SIDE - 1),
            bottom: top + (SIDE - 1),
            left: right - (SIDE - 1),
            right: left + (SIDE - 1),
        }
    }

    /// Whether a die of `value` may go to `at`, and why not.
    pub fn check(&self, at: Pos, value: u8) -> Result<(), PlaceError> {
        if self.value_at(at).is_some() {
            return Err(PlaceError::Occupied);
        }
        if !at.neighbours().iter().any(|&n| self.value_at(n).is_some()) {
            return Err(PlaceError::NotTouching);
        }
        if !self.bounds().contains(at) {
            return Err(PlaceError::TooWide);
        }
        let repeats = self
            .dice
            .iter()
            .any(|die| die.value == value && (die.at.row == at.row || die.at.col == at.col));
        if repeats {
            return Err(PlaceError::Repeats);
        }
        Ok(())
    }

    /// Every cell where a die of `value` may go, row by row.
    pub fn targets(&self, value: u8) -> Vec<Pos> {
        let bounds = self.bounds();
        let mut targets = Vec::new();
        for row in bounds.top..=bounds.bottom {
            for col in bounds.left..=bounds.right {
                let at = Pos::new(row, col);
                if self.check(at, value).is_ok() {
                    targets.push(at);
                }
            }
        }
        targets
    }

    pub fn fits(&self, value: u8) -> bool {
        !self.targets(value).is_empty()
    }

    pub fn place(&mut self, at: Pos, value: u8) -> Result<(), PlaceError> {
        if !(1..=6).contains(&value) {
            return Err(PlaceError::BadValue);
        }
        self.check(at, value)?;
        self.dice.push(Placed { at, value });
        Ok(())
    }

    /// The values of every complete line, the rows first, top to bottom,
    /// then the columns, left to right.
    pub fn complete_lines(&self) -> Vec<Line> {
        let mut lines = Vec::new();
        let mut rows: Vec<i8> = self.dice.iter().map(|die| die.at.row).collect();
        rows.sort_unstable();
        rows.dedup();
        for row in rows {
            let mut values: Vec<(i8, u8)> = self
                .dice
                .iter()
                .filter(|d| d.at.row == row)
                .map(|d| (d.at.col, d.value))
                .collect();
            if values.len() == SIDE as usize {
                values.sort_unstable();
                lines.push(Line {
                    kind: LineKind::Row,
                    index: row,
                    values: values.iter().map(|&(_, v)| v).collect(),
                });
            }
        }
        let mut cols: Vec<i8> = self.dice.iter().map(|die| die.at.col).collect();
        cols.sort_unstable();
        cols.dedup();
        for col in cols {
            let mut values: Vec<(i8, u8)> = self
                .dice
                .iter()
                .filter(|d| d.at.col == col)
                .map(|d| (d.at.row, d.value))
                .collect();
            if values.len() == SIDE as usize {
                values.sort_unstable();
                lines.push(Line {
                    kind: LineKind::Column,
                    index: col,
                    values: values.iter().map(|&(_, v)| v).collect(),
                });
            }
        }
        lines
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum LineKind {
    Row,
    Column,
}

/// A complete row or column of a window.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Line {
    pub kind: LineKind,
    /// The row or column, relative to the seal.
    pub index: i8,
    /// The values, left to right or top to bottom.
    pub values: Vec<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn window(dice: &[(i8, i8, u8)]) -> Window {
        let dice: Vec<Placed> = dice
            .iter()
            .map(|&(row, col, value)| Placed {
                at: Pos::new(row, col),
                value,
            })
            .collect();
        Window::from_dice(&dice).unwrap()
    }

    #[test]
    fn a_die_must_touch_by_a_side() {
        let w = Window::new(4);
        assert_eq!(w.check(Pos::new(1, 1), 2), Err(PlaceError::NotTouching));
        assert_eq!(w.check(Pos::new(0, 1), 2), Ok(()));
        assert_eq!(w.check(Pos::new(0, 0), 2), Err(PlaceError::Occupied));
    }

    #[test]
    fn a_number_does_not_repeat_in_a_row_or_column_even_with_gaps() {
        let w = window(&[(0, 0, 4), (0, 1, 2), (1, 1, 5), (2, 1, 3), (2, 2, 1)]);
        // Row 2 already has a 3 two cells away.
        assert_eq!(w.check(Pos::new(2, 0), 3), Err(PlaceError::Repeats));
        // Column 1 has the 2 at the top.
        assert_eq!(w.check(Pos::new(3, 1), 2), Err(PlaceError::Repeats));
        assert_eq!(w.check(Pos::new(3, 1), 6), Ok(()));
    }

    #[test]
    fn the_window_fits_a_region_of_4_by_4() {
        let w = window(&[(0, 0, 4), (0, -1, 1), (0, 1, 2), (0, 2, 6)]);
        assert_eq!(w.check(Pos::new(0, 3), 3), Err(PlaceError::TooWide));
        assert_eq!(w.check(Pos::new(0, -2), 3), Err(PlaceError::TooWide));
        assert_eq!(w.check(Pos::new(-1, 2), 3), Ok(()));
        assert_eq!(w.targets(3).len(), 8);
        assert_eq!(
            w.bounds(),
            Bounds {
                top: -3,
                bottom: 3,
                left: -1,
                right: 2
            }
        );
    }

    #[test]
    fn from_dice_checks_the_seal_and_the_rules() {
        assert!(Window::from_dice(&[]).is_err());
        let off = [Placed {
            at: Pos::new(0, 1),
            value: 3,
        }];
        assert!(Window::from_dice(&off).is_err());
        let repeat = [
            Placed {
                at: Pos::SEAL,
                value: 3,
            },
            Placed {
                at: Pos::new(0, 1),
                value: 3,
            },
        ];
        assert!(Window::from_dice(&repeat).is_err());
    }

    #[test]
    fn complete_lines_are_listed_in_order() {
        let w = window(&[
            (0, 0, 4),
            (0, 1, 2),
            (0, 2, 6),
            (0, 3, 1),
            (1, 3, 5),
            (2, 3, 3),
            (3, 3, 2),
        ]);
        let lines = w.complete_lines();
        assert_eq!(lines.len(), 2);
        assert_eq!(
            lines[0],
            Line {
                kind: LineKind::Row,
                index: 0,
                values: vec![4, 2, 6, 1]
            }
        );
        assert_eq!(
            lines[1],
            Line {
                kind: LineKind::Column,
                index: 3,
                values: vec![1, 5, 3, 2]
            }
        );
    }
}
