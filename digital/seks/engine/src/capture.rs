//! Capture by custody (`regras/seks/04-captura.md`). The other capture, the
//! shot of a 6 in the center cell, is in `command` and `apply`.
//!
//! Only the die that just moved, or shot, can capture by custody, and always
//! as one end of the custody: after a move, the engine looks at the 4 orthogonal neighbors of
//! the cell where the die stopped. A die of the opponent there is captured if
//! the next cell in the same direction has a die of the mover. So a die that
//! was already between two of the mover's dice, and the dice next to a cell
//! where nothing moved, are never looked at.

use crate::board::Board;
use crate::cell::{Cell, ORTHOGONALS};
use crate::command::Command;
use crate::die::{Die, Side};
use crate::state::GameState;

/// The dice captured by one move, one slot per direction: north, west, south,
/// east.
pub(crate) type Captures = [Option<(Cell, Die)>; 4];

/// The dice that the die of `mover` standing in `to` captures.
pub(crate) fn find(board: &Board, to: Cell, mover: Side) -> Captures {
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

/// How many dice `command` would capture in `state`, without applying it:
/// the same custody check that `Engine::command` runs, on the board before
/// the move, plus the die a shot hits. 0 for an increment. The answer is
/// only meaningful for a legal command.
///
/// The board before the move is enough because the cell the die leaves can
/// only matter as the far end of a custody along the path, and the path is
/// empty. The same holds for the center cell a shot leaves.
pub fn captures(state: &GameState, command: Command) -> u8 {
    let custody = |to| {
        find(&state.board, to, state.to_move)
            .iter()
            .flatten()
            .count() as u8
    };
    match command {
        Command::Move { to, .. } => custody(to),
        Command::Shoot { to } => 1 + custody(to),
        Command::Increment { .. } => 0,
    }
}
