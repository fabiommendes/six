//! Applying a legal command to a state: the one place where the board, the
//! turn, the counters and the hash history change together.

use crate::capture::{find, Captures};
use crate::cell::{Cell, CENTER};
use crate::command::{distance, Command};
use crate::die::Die;
use crate::outcome;
use crate::state::GameState;
use crate::zobrist;

/// What `apply` did, for the events.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Applied {
    /// The value the die shows after the play.
    pub(crate) value: u8,
    /// The die a shot captured, `None` for a move or an increment.
    pub(crate) shot: Option<(Cell, Die)>,
    /// The dice the play captured by custody; all `None` for an increment.
    pub(crate) captured: Captures,
}

/// Applies `command`, which must be legal (see `command::validate`), passes
/// the turn and sets the outcome if the game ended.
pub(crate) fn apply(state: &mut GameState, command: Command) -> Applied {
    let mover = state.to_move;
    let mut hash = state.history.current();
    let mut captured = [None; 4];
    let mut shot = None;
    let mut reached_goal = false;
    let value = match command {
        Command::Move { from, to } => {
            let die = state.board.get(from).expect("a legal move starts on a die");
            let value = distance(from, to).expect("a legal move is a straight line");
            let moved = Die::new(mover, value);
            hash ^= zobrist::die_key(from, die) ^ zobrist::die_key(to, moved);
            state.board.set(from, None);
            state.board.set(to, Some(moved));
            reached_goal = to.row() == mover.goal_row();
            captured = find(&state.board, to, mover);
            for (cell, die) in captured.into_iter().flatten() {
                hash ^= zobrist::die_key(cell, die);
                state.board.set(cell, None);
            }
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
        Command::Shoot { to } => {
            let shooter = state
                .board
                .get(CENTER)
                .expect("a legal shot starts on the center");
            let target = state.board.get(to).expect("a legal shot hits a die");
            hash ^= zobrist::die_key(CENTER, shooter)
                ^ zobrist::die_key(to, target)
                ^ zobrist::die_key(to, shooter);
            state.board.set(CENTER, None);
            state.board.set(to, Some(shooter));
            shot = Some((to, target));
            reached_goal = to.row() == mover.goal_row();
            captured = find(&state.board, to, mover);
            for (cell, die) in captured.into_iter().flatten() {
                hash ^= zobrist::die_key(cell, die);
                state.board.set(cell, None);
            }
            shooter.value()
        }
    };
    hash ^= zobrist::turn_key();
    state.to_move = mover.opponent();
    if shot.is_some() || captured.iter().any(Option::is_some) {
        // The only irreversible play: no earlier position can come back.
        state.plies_without_capture = 0;
        state.history.restart(hash);
    } else {
        state.plies_without_capture += 1;
        state.history.push(hash);
    }
    state.outcome = outcome::after_play(state, reached_goal);
    Applied {
        value,
        shot,
        captured,
    }
}
