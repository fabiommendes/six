//! Commands: the plays a side may make, which ones are legal, and the check
//! that a command is one of them (`regras/seks/03-turno.md`).
//!
//! A turn is exactly one play, and passing is not a play, so there is no
//! command for it.

use crate::board::Board;
use crate::cell::{Cell, CENTER, DIRECTIONS};
use crate::die::{Side, MAX_VALUE};
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
    /// The 6 in the center cell shoots the die of the opponent in `to`, the
    /// first die in one of the 8 directions: it captures it and takes its
    /// cell, still showing 6. Then it captures by custody and wins on the
    /// back row as a die that ended a move.
    Shoot { to: Cell },
}

/// Every legal command of the side to move. Empty when the game is over.
///
/// The order is fixed: by cell index of the die; for each die, its moves
/// direction by direction (north, then counterclockwise: northwest, west, ...,
/// northeast), nearest cell first, then its shots in the same direction
/// order, and its increment last. On the first turn of the game there are
/// no increments (`regras/seks/02-preparacao.md`).
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
    let first_turn = state.is_first_turn();
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
        if from == CENTER {
            commands.extend(shots(&state.board, state.to_move).map(|to| Command::Shoot { to }));
        }
        if die.value() < MAX_VALUE && !first_turn {
            commands.push(Command::Increment { at: from });
        }
    }
}

/// The cells `side` can shoot at: none unless the center cell holds a 6 of
/// `side`; then, in each of the 8 directions, the first die on the line if
/// it belongs to the opponent.
pub fn shots(board: &Board, side: Side) -> impl Iterator<Item = Cell> + '_ {
    let armed = board
        .get(CENTER)
        .is_some_and(|die| die.side() == side && die.value() == MAX_VALUE);
    DIRECTIONS
        .into_iter()
        .filter(move |_| armed)
        .filter_map(move |(columns, rows)| {
            let mut at = CENTER;
            loop {
                at = at.offset(columns, rows)?;
                if let Some(die) = board.get(at) {
                    return (die.side() != side).then_some(at);
                }
            }
        })
}

/// Whether `command` is in [`legal_commands`], without building the list.
pub(crate) fn validate(state: &GameState, command: Command) -> Result<(), GameError> {
    if state.outcome.is_some() {
        return Err(GameError::GameOver);
    }
    match command {
        Command::Increment { at } => {
            let die = own_die(state, at)?;
            if state.is_first_turn() {
                Err(GameError::FirstTurnMustMove { at })
            } else if die.value() < MAX_VALUE {
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
        Command::Shoot { to } => {
            if shots(&state.board, state.to_move).any(|target| target == to) {
                Ok(())
            } else {
                Err(GameError::IllegalShot { to })
            }
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
