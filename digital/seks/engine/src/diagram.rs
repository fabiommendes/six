//! Text diagram of a board, to write positions in tests and to print them.
//!
//! Eleven lines, from row 11 (top, the Blacks' back row) to row 1 (bottom,
//! the Whites' back row), as the board looks to the Whites. Each line has 11
//! cells separated by whitespace, from column 1 to column 11. A cell is `..`
//! (or `.`) when empty, `w` and a value from 1 to 6 for a white die, `b` and
//! a value for a black die. Blank lines are ignored.
//!
//! ```
//! # use seks_engine::Board;
//! let board = Board::from_diagram("
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     .. .. .. .. .. .. .. .. .. .. ..
//!     w1 .. .. .. .. .. .. .. .. .. b6
//! ").unwrap();
//! assert_eq!(board.count(seks_engine::Side::White), 1);
//! ```

use std::fmt;

use crate::board::Board;
use crate::cell::{Cell, BOARD_SIZE};
use crate::die::{Die, Side, MAX_VALUE};

/// Why a diagram could not be read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DiagramError {
    /// The diagram does not have 11 lines.
    WrongRowCount { found: usize },
    /// A line does not have 11 cells. `row` is the row the line stands for.
    WrongColumnCount { row: u8, found: usize },
    /// A cell is not `..`, `.`, or `w`/`b` and a value from 1 to 6.
    BadCell { row: u8, column: u8, text: String },
}

impl fmt::Display for DiagramError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DiagramError::WrongRowCount { found } => {
                write!(f, "diagram needs {BOARD_SIZE} rows, found {found}")
            }
            DiagramError::WrongColumnCount { row, found } => {
                write!(f, "row {row} needs {BOARD_SIZE} cells, found {found}")
            }
            DiagramError::BadCell { row, column, text } => {
                write!(f, "bad cell {text:?} at column {column} of row {row}")
            }
        }
    }
}

impl std::error::Error for DiagramError {}

pub(crate) fn parse(text: &str) -> Result<Board, DiagramError> {
    let lines: Vec<&str> = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();
    if lines.len() != BOARD_SIZE as usize {
        return Err(DiagramError::WrongRowCount { found: lines.len() });
    }
    let mut board = Board::empty();
    for (line, row) in lines.iter().zip((1..=BOARD_SIZE).rev()) {
        let tokens: Vec<&str> = line.split_whitespace().collect();
        if tokens.len() != BOARD_SIZE as usize {
            return Err(DiagramError::WrongColumnCount {
                row,
                found: tokens.len(),
            });
        }
        for (token, column) in tokens.iter().zip(1..=BOARD_SIZE) {
            let die = parse_cell(token).ok_or_else(|| DiagramError::BadCell {
                row,
                column,
                text: (*token).to_string(),
            })?;
            board.set(Cell::new(column, row), die);
        }
    }
    Ok(board)
}

/// `Some(None)` is an empty cell, `None` is a bad token.
fn parse_cell(token: &str) -> Option<Option<Die>> {
    if token == "." || token == ".." {
        return Some(None);
    }
    let mut chars = token.chars();
    let side = match chars.next()? {
        'w' => Side::White,
        'b' => Side::Black,
        _ => return None,
    };
    let value = chars.next()?.to_digit(10)? as u8;
    if chars.next().is_some() || !(1..=MAX_VALUE).contains(&value) {
        return None;
    }
    Some(Some(Die::new(side, value)))
}

pub(crate) fn write(board: &Board, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    for row in (1..=BOARD_SIZE).rev() {
        for column in 1..=BOARD_SIZE {
            if column > 1 {
                f.write_str(" ")?;
            }
            match board.get(Cell::new(column, row)) {
                None => f.write_str("..")?,
                Some(die) => {
                    let letter = match die.side() {
                        Side::White => 'w',
                        Side::Black => 'b',
                    };
                    write!(f, "{letter}{}", die.value())?;
                }
            }
        }
        if row > 1 {
            f.write_str("\n")?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const EMPTY_ROW: &str = ".. .. .. .. .. .. .. .. .. .. ..";

    fn diagram_with(rows: &[&str]) -> String {
        rows.join("\n")
    }

    #[test]
    fn display_and_parse_round_trip_the_initial_board() {
        let board = Board::initial();
        assert_eq!(Board::from_diagram(&board.to_string()).unwrap(), board);
    }

    #[test]
    fn display_puts_the_blacks_on_top_and_the_whites_at_the_bottom() {
        let text = Board::initial().to_string();
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 11);
        assert_eq!(lines[0], "b1 .. b1 .. b1 .. b1 .. b1 .. b1");
        assert_eq!(lines[1], "b2 b2 b2 b2 b2 .. b2 b2 b2 b2 b2");
        assert_eq!(lines[9], "w2 w2 w2 w2 w2 .. w2 w2 w2 w2 w2");
        assert_eq!(lines[10], "w1 .. w1 .. w1 .. w1 .. w1 .. w1");
    }

    #[test]
    fn parse_reads_the_first_line_as_row_11_and_the_first_cell_as_column_1() {
        let mut rows = vec![EMPTY_ROW; 11];
        rows[0] = "b3 .. .. .. .. .. .. .. .. .. ..";
        rows[10] = ".. .. .. .. .. .. .. .. .. .  w6";
        let board = Board::from_diagram(&diagram_with(&rows)).unwrap();
        assert_eq!(board.get(Cell::new(1, 11)), Some(Die::new(Side::Black, 3)));
        assert_eq!(board.get(Cell::new(11, 1)), Some(Die::new(Side::White, 6)));
        assert_eq!(board.dice().count(), 2);
    }

    #[test]
    fn parse_ignores_blank_lines_and_indentation() {
        let text = format!("\n  {EMPTY_ROW}\n\n{}\n", [EMPTY_ROW; 10].join("\n"));
        assert_eq!(Board::from_diagram(&text).unwrap(), Board::empty());
    }

    #[test]
    fn parse_reports_the_wrong_number_of_rows() {
        let text = diagram_with(&[EMPTY_ROW; 10]);
        assert_eq!(
            Board::from_diagram(&text),
            Err(DiagramError::WrongRowCount { found: 10 })
        );
    }

    #[test]
    fn parse_reports_the_wrong_number_of_cells() {
        let mut rows = vec![EMPTY_ROW; 11];
        rows[2] = ".. .. ..";
        assert_eq!(
            Board::from_diagram(&diagram_with(&rows)),
            Err(DiagramError::WrongColumnCount { row: 9, found: 3 })
        );
    }

    #[test]
    fn parse_reports_bad_cells() {
        for bad in ["w0", "w7", "x3", "w", "w33", "3"] {
            let mut rows = vec![EMPTY_ROW; 11];
            let line = format!("{bad} .. .. .. .. .. .. .. .. .. ..");
            rows[4] = &line;
            assert_eq!(
                Board::from_diagram(&diagram_with(&rows)),
                Err(DiagramError::BadCell {
                    row: 7,
                    column: 1,
                    text: bad.to_string()
                }),
                "token {bad:?}"
            );
        }
    }
}
