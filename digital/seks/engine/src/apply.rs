//! Applying a legal command to a state: the one place where the board, the
//! turn, the counters and the hash history change together.

use crate::command::{distance, Command};
use crate::die::Die;
use crate::state::GameState;
use crate::zobrist;

/// What `apply` did, for the events.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Applied {
    /// The value the die shows after the play.
    pub(crate) value: u8,
}

/// Applies `command`, which must be legal (see `command::validate`), and
/// passes the turn.
pub(crate) fn apply(state: &mut GameState, command: Command) -> Applied {
    let mover = state.to_move;
    let mut hash = state.history.current();
    let value = match command {
        Command::Move { from, to } => {
            let die = state.board.get(from).expect("a legal move starts on a die");
            let value = distance(from, to).expect("a legal move is a straight line");
            let moved = Die::new(mover, value);
            hash ^= zobrist::die_key(from, die) ^ zobrist::die_key(to, moved);
            state.board.set(from, None);
            state.board.set(to, Some(moved));
            value
        }
        Command::Increment { at } => {
            let die = state.board.get(at).expect("a legal increment is on a die");
            let value = die.value() + 1;
            let incremented = Die::new(mover, value);
            hash ^= zobrist::die_key(at, die) ^ zobrist::die_key(at, incremented);
            state.board.set(at, Some(incremented));
            value
        }
    };
    hash ^= zobrist::turn_key();
    state.to_move = mover.opponent();
    state.plies_without_capture += 1;
    state.history.push(hash);
    Applied { value }
}
