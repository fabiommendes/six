//! How a game ends (`regras/seks/05-fim-do-jogo.md`).
//!
//! After every play the engine checks, in this order:
//!
//! 1. the mover's die ended a move, or a shot, on the opponent's back row:
//!    the mover wins;
//! 2. the opponent has no play: the mover wins;
//! 3. the position has now occurred 3 times, or 100 plays in a row had no
//!    capture: draw.
//!
//! A win comes before a draw, as checkmate on the 50th move wins in chess.
//! When both draws happen at once, the reported reason is the repetition.

use crate::board::Board;
use crate::cell::DIRECTIONS;
use crate::command::shots;
use crate::die::{Side, MAX_VALUE};
use crate::state::GameState;

/// Plays in a row without a capture that draw the game: 50 by each player.
pub const MAX_PLIES_WITHOUT_CAPTURE: u8 = 100;

/// Occurrences of a position that draw the game.
pub const REPETITIONS_FOR_DRAW: usize = 3;

/// Why a side won.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum WinReason {
    /// A die ended a move, or a shot, on the opponent's back row.
    BackRow,
    /// The opponent has no play left: no dice, or only 6s with no free
    /// cell around and no shot.
    NoPlay,
}

/// Why the game was drawn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum DrawReason {
    /// The same position, with the same side to move, for the third time.
    Repetition,
    /// 100 plays in a row without a capture.
    NoCapture,
}

/// The result of a finished game.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Outcome {
    Win { winner: Side, reason: WinReason },
    Draw(DrawReason),
}

/// Whether `side` has any play: a die below 6 can be incremented, any die
/// with a free cell around can move to it, and a 6 in the center cell may
/// have a shot.
pub(crate) fn has_play(board: &Board, side: Side) -> bool {
    shots(board, side).next().is_some()
        || board
            .dice()
            .filter(|(_, die)| die.side() == side)
            .any(|(cell, die)| {
                die.value() < MAX_VALUE
                    || DIRECTIONS.iter().any(|&(columns, rows)| {
                        cell.offset(columns, rows)
                            .is_some_and(|next| board.get(next).is_none())
                    })
            })
}

/// The outcome of the position `state` reached by a play of the opponent of
/// `state.to_move()`, which ended on the opponent's back row if
/// `reached_goal`.
pub(crate) fn after_play(state: &GameState, reached_goal: bool) -> Option<Outcome> {
    let mover = state.to_move().opponent();
    if reached_goal {
        return Some(Outcome::Win {
            winner: mover,
            reason: WinReason::BackRow,
        });
    }
    if !has_play(state.board(), state.to_move()) {
        return Some(Outcome::Win {
            winner: mover,
            reason: WinReason::NoPlay,
        });
    }
    if state.history.current_occurrences() >= REPETITIONS_FOR_DRAW {
        return Some(Outcome::Draw(DrawReason::Repetition));
    }
    if state.plies_without_capture() >= MAX_PLIES_WITHOUT_CAPTURE {
        return Some(Outcome::Draw(DrawReason::NoCapture));
    }
    None
}
