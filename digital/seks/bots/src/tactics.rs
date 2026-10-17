//! Tactical facts about a position that every bot needs: whether a side can
//! win on the back row in one move (`regras/seks/05-fim-do-jogo.md`).

use seks_engine::{Board, Cell, Command, Side, BOARD_SIZE};

/// The row offset of a step towards the goal row of `side`.
pub(crate) const fn forward(side: Side) -> i8 {
    match side {
        Side::White => 1,
        Side::Black => -1,
    }
}

/// Rows between `cell` and the goal row of `side`: 0 on the goal row, 10 on
/// the own back row.
pub(crate) const fn rows_to_goal(cell: Cell, side: Side) -> u8 {
    match side {
        Side::White => BOARD_SIZE - cell.row(),
        Side::Black => cell.row() - 1,
    }
}

/// The row of `cell` counted from the back row of `side`: 1 on the own back
/// row, 11 on the goal row.
pub(crate) const fn relative_row(cell: Cell, side: Side) -> u8 {
    BOARD_SIZE - rows_to_goal(cell, side)
}

/// The move of the die in `from` that lands on the goal row of its side in
/// direction `columns` (-1, 0 or 1), if the die reaches it and the path is
/// clear. `value` is the value of the die.
fn goal_move(board: &Board, from: Cell, side: Side, value: u8, columns: i8) -> Option<Command> {
    let distance = rows_to_goal(from, side);
    if distance == 0 || distance > value {
        return None;
    }
    let mut to = from;
    for _ in 0..distance {
        to = to.offset(columns, forward(side))?;
        if board.get(to).is_some() {
            return None;
        }
    }
    Some(Command::Move { from, to })
}

/// A move that wins at once for `side` by reaching the opponent's back row,
/// if it has one. It does not look at whose turn it is.
pub fn winning_move(board: &Board, side: Side) -> Option<Command> {
    board
        .dice()
        .filter(|(_, die)| die.side() == side)
        .find_map(|(from, die)| {
            [0, -1, 1]
                .into_iter()
                .find_map(|columns| goal_move(board, from, side, die.value(), columns))
        })
}

/// Whether `side` has a move that reaches the opponent's back row.
pub fn can_win_now(board: &Board, side: Side) -> bool {
    winning_move(board, side).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use seks_engine::GameState;

    #[test]
    fn finds_a_straight_and_a_diagonal_win_and_respects_blocks() {
        let state = GameState::from_diagram(
            "
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. b1 .. .. .. .. .. .. .. ..
            w3 .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            ",
            Side::White,
        )
        .unwrap();
        // w3 at a8: a11 straight is 3 rows away and clear.
        let win = winning_move(state.board(), Side::White).unwrap();
        assert_eq!(win.to_string(), "a8-a11");
        // b1 at c9 is 8 rows from row 1: no win.
        assert!(!can_win_now(state.board(), Side::Black));
    }

    #[test]
    fn a_die_in_the_way_blocks_the_win() {
        let state = GameState::from_diagram(
            "
            .. .. .. .. .. .. .. .. .. .. ..
            w1 b1 .. .. .. .. .. .. .. .. ..
            w2 .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            ",
            Side::White,
        )
        .unwrap();
        // w2 at a9: a10 holds w1 and b10 holds b1, so only w1 wins.
        let win = winning_move(state.board(), Side::White).unwrap();
        assert_eq!(win.to_string(), "a10-a11");
        let mut board = *state.board();
        board.set(Cell::new(1, 10), None);
        board.set(Cell::new(1, 9), None);
        board.set(Cell::new(1, 8), Some(seks_engine::Die::new(Side::White, 3)));
        board.set(Cell::new(1, 9), Some(seks_engine::Die::new(Side::Black, 1)));
        board.set(Cell::new(2, 9), Some(seks_engine::Die::new(Side::Black, 1)));
        // w3 at a8: a9 and b9 are taken, so neither path is clear.
        assert!(!can_win_now(&board, Side::White));
    }

    #[test]
    fn relative_rows_mirror_between_the_sides() {
        let cell = Cell::new(4, 3);
        assert_eq!(relative_row(cell, Side::White), 3);
        assert_eq!(relative_row(cell, Side::Black), 9);
        assert_eq!(rows_to_goal(cell, Side::White), 8);
        assert_eq!(rows_to_goal(cell, Side::Black), 2);
    }
}
