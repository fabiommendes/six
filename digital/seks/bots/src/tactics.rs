//! Tactical facts about a position that every bot needs: whether a side can
//! win on the back row in one move (`regras/seks/05-fim-do-jogo.md`).

use seks_engine::{Board, Cell, Command, Die, Side, BOARD_SIZE, MAX_VALUE};

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
    // Only dice at most 6 rows from the goal row can reach it.
    let rows = match side {
        Side::White => BOARD_SIZE - MAX_VALUE..=BOARD_SIZE - 1,
        Side::Black => 2..=1 + MAX_VALUE,
    };
    for row in rows {
        for column in 1..=BOARD_SIZE {
            let from = Cell::new(column, row);
            let Some(die) = board.get(from).filter(|die| die.side() == side) else {
                continue;
            };
            for columns in [0, -1, 1] {
                if let Some(win) = goal_move(board, from, side, die.value(), columns) {
                    return Some(win);
                }
            }
        }
    }
    None
}

/// Whether `command`, a legal command of `side`, leaves `side` with a move
/// to the opponent's back row: a threat to win, which the opponent must
/// answer. Cheaper than applying the command: commands far from the goal
/// row are ruled out without looking further.
pub fn creates_threat(board: &Board, command: Command, side: Side) -> bool {
    let near = |cell: Cell| rows_to_goal(cell, side) <= MAX_VALUE;
    let mut after = *board;
    match command {
        Command::Move { from, to } => {
            if !near(from) && !near(to) {
                return false;
            }
            let value = from
                .column()
                .abs_diff(to.column())
                .max(from.row().abs_diff(to.row()));
            after.set(from, None);
            after.set(to, Some(Die::new(side, value)));
        }
        Command::Increment { at } => {
            if !near(at) {
                return false;
            }
            let die = board.get(at).expect("a legal increment is on a die");
            after.set(at, Some(Die::new(side, die.value() + 1)));
        }
    }
    can_win_now(&after, side)
}

/// The cells on the clear paths of `side` to the opponent's back row, the
/// landing cells included, as bits by `Cell::index`. A move of the other
/// side stops every such threat only if it lands on one of these cells or
/// captures the threatening die.
pub fn threat_paths(board: &Board, side: Side) -> u128 {
    let mut paths = 0;
    for (from, die) in board.dice().filter(|(_, die)| die.side() == side) {
        for columns in [0, -1, 1] {
            if let Some(Command::Move { from, to }) =
                goal_move(board, from, side, die.value(), columns)
            {
                let mut at = from;
                while at != to {
                    at = at.offset(columns, forward(side)).expect("on the path");
                    paths |= 1u128 << at.index();
                }
            }
        }
    }
    paths
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
    fn creates_threat_agrees_with_applying_the_command() {
        use crate::rng::Rng;
        use seks_engine::{legal_commands, Engine, Outcome};
        for seed in 0..20 {
            let mut rng = Rng::new(seed);
            let mut state = GameState::initial();
            while state.outcome().is_none() {
                let me = state.to_move();
                let commands = legal_commands(&state);
                // The search never asks when the side to move wins at once.
                let skip = can_win_now(state.board(), me);
                for &command in commands.iter().filter(|_| !skip) {
                    let next = Engine::step(&state, command).unwrap();
                    if matches!(next.outcome(), Some(Outcome::Win { .. })) {
                        continue;
                    }
                    // Captures may open paths too; compare without them.
                    if seks_engine::captures(&state, command) > 0 {
                        continue;
                    }
                    assert_eq!(
                        creates_threat(state.board(), command, me),
                        can_win_now(next.board(), me),
                        "{command}\n{}",
                        state.board()
                    );
                }
                state = Engine::step(&state, commands[rng.below(commands.len())]).unwrap();
            }
        }
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
