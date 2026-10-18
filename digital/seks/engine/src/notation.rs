//! Stable text notation for cells and commands, for game files, openings,
//! the command line and the server protocol.
//!
//! - A cell is a column letter, `a` to `k`, and a row number, 1 to 11: `a1` is
//!   the corner of the Whites' back row, `k11` the opposite corner, `f2` the
//!   empty cell of the Whites' front row.
//! - A move is `from-to`: `b2-b4`.
//! - An increment is the cell and `+`: `b2+`.
//! - A shot is the center cell, `x` and the cell of the target: `f6xb10`.
//!
//! `Display` writes exactly this, in lowercase, and `FromStr` reads exactly
//! this and nothing else (no spaces, no capitals, no leading zeros), so the
//! text of a command round-trips. Reading a command does not check that it is
//! legal.

use std::fmt;
use std::str::FromStr;

use crate::cell::{Cell, BOARD_SIZE, CENTER};
use crate::command::Command;

/// Text that is not a cell or a command in the notation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NotationError {
    text: String,
    expected: &'static str,
}

impl NotationError {
    fn new(text: &str, expected: &'static str) -> NotationError {
        NotationError {
            text: text.to_string(),
            expected,
        }
    }
}

impl fmt::Display for NotationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?} is not {}", self.text, self.expected)
    }
}

impl std::error::Error for NotationError {}

impl fmt::Display for Cell {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", (b'a' + self.column() - 1) as char, self.row())
    }
}

impl FromStr for Cell {
    type Err = NotationError;

    fn from_str(text: &str) -> Result<Cell, NotationError> {
        let error = || NotationError::new(text, "a cell like a1 or k11");
        let mut chars = text.chars();
        let letter = chars.next().ok_or_else(error)?;
        let digits = chars.as_str();
        let column = match letter {
            'a'..='k' => letter as u8 - b'a' + 1,
            _ => return Err(error()),
        };
        let well_formed = !digits.is_empty()
            && digits.len() <= 2
            && digits.bytes().all(|byte| byte.is_ascii_digit())
            && !digits.starts_with('0');
        if !well_formed {
            return Err(error());
        }
        let row: u8 = digits.parse().map_err(|_| error())?;
        debug_assert!(column <= BOARD_SIZE);
        Cell::try_new(column, row).ok_or_else(error)
    }
}

impl fmt::Display for Command {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Command::Move { from, to } => write!(f, "{from}-{to}"),
            Command::Increment { at } => write!(f, "{at}+"),
            Command::Shoot { to } => write!(f, "{CENTER}x{to}"),
        }
    }
}

impl FromStr for Command {
    type Err = NotationError;

    fn from_str(text: &str) -> Result<Command, NotationError> {
        let error = || NotationError::new(text, "a command like b2-b4, b2+ or f6xb10");
        if let Some(at) = text.strip_suffix('+') {
            return Ok(Command::Increment {
                at: at.parse().map_err(|_| error())?,
            });
        }
        if let Some((from, to)) = text.split_once('x') {
            if from.parse::<Cell>().map_err(|_| error())? != CENTER {
                return Err(error());
            }
            return Ok(Command::Shoot {
                to: to.parse().map_err(|_| error())?,
            });
        }
        let (from, to) = text.split_once('-').ok_or_else(error)?;
        Ok(Command::Move {
            from: from.parse().map_err(|_| error())?,
            to: to.parse().map_err(|_| error())?,
        })
    }
}
