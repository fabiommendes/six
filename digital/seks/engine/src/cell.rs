//! Cells of the board and the directions between them.
//!
//! A [`Cell`] uses the numbering of the rules (`regras/seks/02-preparacao.md`):
//! columns and rows both go from 1 to 11, and row 1 is the back row of the
//! Whites, row 11 the back row of the Blacks. The position of a cell in the
//! array that stores the board comes from [`Cell::index`] and nowhere else:
//! row-major from the Whites' side, so index 0 is column 1 of row 1 and
//! index 120 is column 11 of row 11.
//!
//! "North" is towards higher rows (towards the Blacks), "east" towards higher
//! columns.

/// Number of columns, and of rows, of the board.
pub const BOARD_SIZE: u8 = 11;

/// Number of cells of the board.
pub const CELL_COUNT: usize = BOARD_SIZE as usize * BOARD_SIZE as usize;

/// The 8 directions a die may move in, as `(columns, rows)` offsets.
pub(crate) const DIRECTIONS: [(i8, i8); 8] = [
    (0, 1),
    (-1, 1),
    (-1, 0),
    (-1, -1),
    (0, -1),
    (1, -1),
    (1, 0),
    (1, 1),
];

/// The 4 directions that may capture: north, west, south, east.
pub(crate) const ORTHOGONALS: [(i8, i8); 4] = [(0, 1), (-1, 0), (0, -1), (1, 0)];

/// A cell of the board. Always inside the board: the constructors reject
/// anything else.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Cell {
    column: u8,
    row: u8,
}

impl Cell {
    /// The cell at `column` and `row`, both from 1 to 11.
    ///
    /// # Panics
    ///
    /// If `column` or `row` is outside 1 to 11. Use [`Cell::try_new`] for
    /// input that may be wrong.
    pub const fn new(column: u8, row: u8) -> Cell {
        match Cell::try_new(column, row) {
            Some(cell) => cell,
            None => panic!("cell outside the board: columns and rows go from 1 to 11"),
        }
    }

    /// The cell at `column` and `row`, or `None` if either is outside 1 to 11.
    pub const fn try_new(column: u8, row: u8) -> Option<Cell> {
        if column >= 1 && column <= BOARD_SIZE && row >= 1 && row <= BOARD_SIZE {
            Some(Cell { column, row })
        } else {
            None
        }
    }

    /// The cell stored at `index` of the board array (inverse of
    /// [`Cell::index`]).
    ///
    /// # Panics
    ///
    /// If `index` is 121 or more.
    pub const fn from_index(index: usize) -> Cell {
        assert!(index < CELL_COUNT, "cell index outside the board");
        Cell {
            column: (index % BOARD_SIZE as usize) as u8 + 1,
            row: (index / BOARD_SIZE as usize) as u8 + 1,
        }
    }

    /// The column, from 1 to 11.
    pub const fn column(self) -> u8 {
        self.column
    }

    /// The row, from 1 to 11. Row 1 is the back row of the Whites.
    pub const fn row(self) -> u8 {
        self.row
    }

    /// Position of the cell in the board array, from 0 to 120. The only place
    /// where coordinates become an index.
    pub const fn index(self) -> usize {
        (self.row as usize - 1) * BOARD_SIZE as usize + (self.column as usize - 1)
    }

    /// All the cells, in index order.
    pub fn all() -> impl Iterator<Item = Cell> {
        (0..CELL_COUNT).map(Cell::from_index)
    }

    /// The cell `columns` to the east and `rows` to the north, or `None` if
    /// that is outside the board.
    pub const fn offset(self, columns: i8, rows: i8) -> Option<Cell> {
        let column = self.column as i16 + columns as i16;
        let row = self.row as i16 + rows as i16;
        if column < 1 || row < 1 || column > 255 || row > 255 {
            return None;
        }
        Cell::try_new(column as u8, row as u8)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn index_runs_row_major_from_the_whites_side() {
        assert_eq!(Cell::new(1, 1).index(), 0);
        assert_eq!(Cell::new(11, 1).index(), 10);
        assert_eq!(Cell::new(1, 2).index(), 11);
        assert_eq!(Cell::new(11, 11).index(), 120);
    }

    #[test]
    fn index_and_from_index_are_inverse_over_the_whole_board() {
        for (i, cell) in Cell::all().enumerate() {
            assert_eq!(cell.index(), i);
            assert_eq!(Cell::from_index(i), cell);
        }
        assert_eq!(Cell::all().count(), CELL_COUNT);
    }

    #[test]
    fn try_new_rejects_coordinates_outside_1_to_11() {
        assert_eq!(Cell::try_new(0, 5), None);
        assert_eq!(Cell::try_new(5, 0), None);
        assert_eq!(Cell::try_new(12, 5), None);
        assert_eq!(Cell::try_new(5, 12), None);
        assert_eq!(Cell::try_new(255, 255), None);
        assert!(Cell::try_new(1, 11).is_some());
    }

    #[test]
    #[should_panic(expected = "outside the board")]
    fn new_panics_outside_the_board() {
        Cell::new(12, 1);
    }

    #[test]
    fn offset_stops_at_the_edges() {
        let corner = Cell::new(1, 1);
        assert_eq!(corner.offset(-1, 0), None);
        assert_eq!(corner.offset(0, -1), None);
        assert_eq!(corner.offset(1, 1), Some(Cell::new(2, 2)));
        assert_eq!(Cell::new(11, 11).offset(1, 0), None);
        assert_eq!(Cell::new(11, 11).offset(0, 1), None);
        assert_eq!(Cell::new(5, 5).offset(-4, 6), Some(Cell::new(1, 11)));
    }
}
