//! The complete state of a game: a small `Copy` value.

use crate::board::Board;
use crate::cell::Cell;
use crate::diagram::DiagramError;
use crate::die::{Die, Side};
use crate::history::PositionHistory;
use crate::outcome::Outcome;
use crate::zobrist;

/// A game in progress or finished.
///
/// Besides the board and whose turn it is, it keeps as rule state what the
/// draws need: the number of plays since the last capture and the hashes of
/// the positions since then (`dev/adr/0003-*`). It is about 1.1 KB and
/// `Copy`, so searches may copy it freely.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GameState {
    pub(crate) board: Board,
    pub(crate) to_move: Side,
    pub(crate) plies_without_capture: u8,
    pub(crate) history: PositionHistory,
    pub(crate) outcome: Option<Outcome>,
}

impl GameState {
    /// The start of a game: the initial position, the Whites to move.
    pub fn initial() -> GameState {
        GameState::from_board(Board::initial(), Side::White)
    }

    /// A game from the position in `diagram` (see the crate docs), with
    /// `to_move` to play. The count of plays without a capture is 0 and the
    /// position counts once for repetition. No outcome is derived: the
    /// position is taken as it is, even if a side has no play.
    pub fn from_diagram(diagram: &str, to_move: Side) -> Result<GameState, DiagramError> {
        Board::from_diagram(diagram).map(|board| GameState::from_board(board, to_move))
    }

    pub(crate) fn from_board(board: Board, to_move: Side) -> GameState {
        GameState {
            board,
            to_move,
            plies_without_capture: 0,
            history: PositionHistory::new(zobrist::hash_position(&board, to_move)),
            outcome: None,
        }
    }

    /// The board.
    pub fn board(&self) -> &Board {
        &self.board
    }

    /// The die in `cell`, if any.
    pub fn die_at(&self, cell: Cell) -> Option<Die> {
        self.board.get(cell)
    }

    /// The side that plays next. After a play that ends the game this is the
    /// side that would have played next; see [`GameState::outcome`].
    pub fn to_move(&self) -> Side {
        self.to_move
    }

    /// The result, once the game is over.
    pub fn outcome(&self) -> Option<Outcome> {
        self.outcome
    }

    /// Plays in a row, by both sides, since the last capture. The game is
    /// drawn at 100.
    pub fn plies_without_capture(&self) -> u8 {
        self.plies_without_capture
    }

    /// The Zobrist hash of the current position, side to move included.
    /// Equal positions have equal hashes; use it for transposition tables.
    pub fn position_hash(&self) -> u64 {
        self.history.current()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_game_starts_with_the_whites_to_move_and_no_outcome() {
        let state = GameState::initial();
        assert_eq!(state.to_move(), Side::White);
        assert_eq!(state.outcome(), None);
        assert_eq!(state.plies_without_capture(), 0);
    }

    #[test]
    fn the_stored_hash_is_the_hash_of_the_position() {
        let state = GameState::initial();
        assert_eq!(
            state.position_hash(),
            zobrist::hash_position(state.board(), Side::White)
        );
    }

    #[test]
    fn the_state_is_copy_and_small() {
        fn assert_copy<T: Copy>() {}
        assert_copy::<GameState>();
        assert!(std::mem::size_of::<GameState>() < 1200);
    }
}
