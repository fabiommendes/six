//! Capture by custody (`regras/seks/04-captura.md`).
//!
//! Only the die that just moved can capture, and always as one end of the
//! custody: after a move, the engine looks at the 4 orthogonal neighbors of
//! the cell where the die stopped. A die of the opponent there is captured if
//! the next cell in the same direction has a die of the mover. So a die that
//! was already between two of the mover's dice, and the dice next to a cell
//! where nothing moved, are never looked at.

use crate::board::Board;
use crate::cell::{Cell, ORTHOGONALS};
use crate::die::{Die, Side};

/// The dice captured by one move, one slot per direction: north, west, south,
/// east.
pub(crate) type Captures = [Option<(Cell, Die)>; 4];

/// The dice that the die of `mover` standing in `to` captures.
pub(crate) fn captures(board: &Board, to: Cell, mover: Side) -> Captures {
    ORTHOGONALS.map(|(columns, rows)| {
        let victim = to.offset(columns, rows)?;
        let die = board.get(victim).filter(|die| die.side() != mover)?;
        let partner = victim.offset(columns, rows)?;
        board
            .get(partner)
            .filter(|partner| partner.side() == mover)
            .map(|_| (victim, die))
    })
}
