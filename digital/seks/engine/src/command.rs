//! Commands: the plays a side may make, which ones are legal, and the check
//! that a command is one of them (`regras/seks/03-turno.md`).
//!
//! A turn is exactly one play, and passing is not a play, so there is no
//! command for it.

use crate::cell::{Cell, DIRECTIONS};
use crate::die::MAX_VALUE;
use crate::event::GameError;
use crate::state::GameState;

/// A play of the side to move.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Command {
    /// Moves the die in `from` in a straight line to the empty cell `to`, at
    /// most as many cells as its value. It ends showing the cells it walked.
    Move { from: Cell, to: Cell },
    /// Adds 1 to the value of the die in `at`, which stays there. Never
    /// captures.
    Increment { at: Cell },
}

/// Every legal command of the side to move. Empty when the game is over.
///
/// The order is fixed: by cell index of the die; for each die, its moves
/// direction by direction (north, then counterclockwise: northwest, west, ...,
/// northeast), nearest cell first, and its increment last.
pub fn legal_commands(state: &GameState) -> Vec<Command> {
    let mut commands = Vec::with_capacity(128);
    legal_commands_into(state, &mut commands);
    commands
}

/// Like [`legal_commands`], but replaces the contents of `commands`, so a
/// search can reuse one buffer.
pub fn legal_commands_into(state: &GameState, commands: &mut Vec<Command>) {
    commands.clear();
    if state.outcome.is_some() {
        return;
    }
    for (from, die) in state.board.dice() {
        if die.side() != state.to_move {
            continue;
        }
        for (columns, rows) in DIRECTIONS {
            let mut to = from;
            for _ in 0..die.value() {
                match to.offset(columns, rows) {
                    Some(next) if state.board.get(next).is_none() => to = next,
                    _ => break,
                }
                commands.push(Command::Move { from, to });
            }
        }
        if die.value() < MAX_VALUE {
            commands.push(Command::Increment { at: from });
        }
    }
}

/// Whether `command` is in [`legal_commands`], without building the list.
pub(crate) fn validate(state: &GameState, command: Command) -> Result<(), GameError> {
    if state.outcome.is_some() {
        return Err(GameError::GameOver);
    }
    match command {
        Command::Increment { at } => {
            let die = own_die(state, at)?;
            if die.value() < MAX_VALUE {
                Ok(())
            } else {
                Err(GameError::CannotIncrement { at })
            }
        }
        Command::Move { from, to } => {
            let die = own_die(state, from)?;
            let illegal = GameError::IllegalMove { from, to };
            let distance = distance(from, to).ok_or(illegal)?;
            if distance > die.value() {
                return Err(illegal);
            }
            let columns = (to.column() as i8 - from.column() as i8).signum();
            let rows = (to.row() as i8 - from.row() as i8).signum();
            let mut cursor = from;
            for _ in 0..distance {
                cursor = cursor.offset(columns, rows).ok_or(illegal)?;
                if state.board.get(cursor).is_some() {
                    return Err(illegal);
                }
            }
            Ok(())
        }
    }
}

/// The number of cells between `from` and `to` if they are on a straight
/// line of the 8 directions and are different cells.
pub(crate) fn distance(from: Cell, to: Cell) -> Option<u8> {
    let columns = from.column().abs_diff(to.column());
    let rows = from.row().abs_diff(to.row());
    let straight = columns == 0 || rows == 0 || columns == rows;
    (straight && (columns, rows) != (0, 0)).then(|| columns.max(rows))
}

fn own_die(state: &GameState, at: Cell) -> Result<crate::Die, GameError> {
    state
        .board
        .get(at)
        .filter(|die| die.side() == state.to_move)
        .ok_or(GameError::NotYourDie { at })
}
