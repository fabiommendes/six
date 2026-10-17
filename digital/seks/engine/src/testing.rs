//! Helpers shared by the tests. Coordinates are `(column, row)` pairs with the
//! numbering of the rules.

use crate::{Board, Cell, Command, Die, Engine, GameState, Side, Transition};

/// The cell at `column` and `row`.
pub(crate) fn cell(column: u8, row: u8) -> Cell {
    Cell::new(column, row)
}

/// A position from a diagram, with `to_move` to play.
pub(crate) fn position(diagram: &str, to_move: Side) -> GameState {
    GameState::from_diagram(diagram, to_move).expect("valid diagram")
}

/// A position with only the given dice, each written `"w3@6,6"`: side
/// (`w` or `b`), value, `@`, column, `,` and row.
pub(crate) fn sparse(to_move: Side, dice: &[&str]) -> GameState {
    let mut board = Board::empty();
    for text in dice {
        let (die, at) = text.split_once('@').expect("die as `w3@6,6`");
        let (column, row) = at.split_once(',').expect("cell as `6,6`");
        let side = match &die[..1] {
            "w" => Side::White,
            "b" => Side::Black,
            other => panic!("unknown side {other:?}"),
        };
        let value = die[1..].parse().expect("die value");
        let at = cell(column.parse().expect("column"), row.parse().expect("row"));
        board.set(at, Some(Die::new(side, value)));
    }
    GameState::from_board(board, to_move)
}

/// `Command::Move` between two `(column, row)` pairs.
pub(crate) fn mv(from: (u8, u8), to: (u8, u8)) -> Command {
    Command::Move {
        from: cell(from.0, from.1),
        to: cell(to.0, to.1),
    }
}

/// `Command::Increment` at a `(column, row)` pair.
pub(crate) fn inc(at: (u8, u8)) -> Command {
    Command::Increment {
        at: cell(at.0, at.1),
    }
}

/// Applies a command that must be legal.
pub(crate) fn play(state: &GameState, command: Command) -> Transition {
    Engine::command(state, command)
        .unwrap_or_else(|error| panic!("{command:?} refused: {error}\n{}", state.board()))
}

/// The state after a command that must be legal.
pub(crate) fn after(state: &GameState, command: Command) -> GameState {
    play(state, command).state
}
