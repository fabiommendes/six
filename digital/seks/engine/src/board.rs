//! The board: which die, if any, is in each of the 121 cells.

use std::fmt;

use crate::cell::{Cell, BOARD_SIZE, CELL_COUNT};
use crate::diagram::{self, DiagramError};
use crate::die::{Die, Side};

/// The 121 cells of the board. A small `Copy` value: cloning it is a copy of
/// 242 bytes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Board {
    cells: [Option<Die>; CELL_COUNT],
}

impl Board {
    /// A board with no dice.
    pub const fn empty() -> Board {
        Board {
            cells: [None; CELL_COUNT],
        }
    }

    /// The starting position (`regras/seks/02-preparacao.md`): per side, a
    /// back row of 1s in the odd columns and a front row of 2s in every
    /// column but the 6th.
    pub fn initial() -> Board {
        let mut board = Board::empty();
        for side in Side::ALL {
            let (back, front) = match side {
                Side::White => (1, 2),
                Side::Black => (BOARD_SIZE, BOARD_SIZE - 1),
            };
            for column in (1..=BOARD_SIZE).step_by(2) {
                board.set(Cell::new(column, back), Some(Die::new(side, 1)));
            }
            for column in (1..=BOARD_SIZE).filter(|&column| column != 6) {
                board.set(Cell::new(column, front), Some(Die::new(side, 2)));
            }
        }
        board
    }

    /// Reads a board from the text diagram of the crate docs
    /// (`GameState::from_diagram` reads a whole game).
    pub fn from_diagram(text: &str) -> Result<Board, DiagramError> {
        diagram::parse(text)
    }

    /// The die in `cell`, if any.
    pub fn get(&self, cell: Cell) -> Option<Die> {
        self.cells[cell.index()]
    }

    /// Puts `die` in `cell`, or empties it. Positions built this way are
    /// taken as they are: nothing checks them against the rules.
    pub fn set(&mut self, cell: Cell, die: Option<Die>) {
        self.cells[cell.index()] = die;
    }

    /// Every die with its cell, in cell index order.
    pub fn dice(&self) -> impl Iterator<Item = (Cell, Die)> + '_ {
        self.cells
            .iter()
            .enumerate()
            .filter_map(|(index, die)| die.map(|die| (Cell::from_index(index), die)))
    }

    /// How many dice `side` has on the board.
    pub fn count(&self, side: Side) -> usize {
        self.cells
            .iter()
            .flatten()
            .filter(|die| die.side() == side)
            .count()
    }
}

/// The text diagram: see the crate docs.
impl fmt::Display for Board {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        diagram::write(self, f)
    }
}
