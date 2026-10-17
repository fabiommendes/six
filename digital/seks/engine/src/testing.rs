//! Helpers shared by the tests.

use crate::{Cell, GameState, Side};

/// The cell at `column` and `row` (the numbering of the rules).
pub(crate) fn cell(column: u8, row: u8) -> Cell {
    Cell::new(column, row)
}

/// A position from a diagram, with `to_move` to play.
pub(crate) fn position(diagram: &str, to_move: Side) -> GameState {
    GameState::from_diagram(diagram, to_move).expect("valid diagram")
}
