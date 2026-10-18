//! Tactical facts about a position that every bot needs: whether a side can
//! win on the back row in one move or shot (`regras/seks/05-fim-do-jogo.md`,
//! `regras/seks/03-turno.md#atirar`).

use seks_engine::{shots, Board, Cell, Command, Die, Side, BOARD_SIZE, CENTER, MAX_VALUE};

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

/// The shot of `side` that lands on the opponent's back row, if it has one.
fn winning_shot(board: &Board, side: Side) -> Option<Command> {
    shots(board, side)
        .find(|to| to.row() == side.goal_row())
        .map(|to| Command::Shoot { to })
}

/// A move or a shot that wins at once for `side` by reaching the opponent's
/// back row, if it has one. It does not look at whose turn it is.
pub fn winning_move(board: &Board, side: Side) -> Option<Command> {
    if let Some(shot) = winning_shot(board, side) {
        return Some(shot);
    }
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
/// or a shot to the opponent's back row: a threat to win, which the
/// opponent must answer. Cheaper than applying the command: commands far
/// from the goal row are ruled out without looking further, unless they
/// arm or open a shot. It ignores the captures of `command`.
pub fn creates_threat(board: &Board, command: Command, side: Side) -> bool {
    let near = |cell: Cell| rows_to_goal(cell, side) <= MAX_VALUE;
    let mut after = *board;
    match command {
        Command::Move { from, to } => {
            let value = from
                .column()
                .abs_diff(to.column())
                .max(from.row().abs_diff(to.row()));
            after.set(from, None);
            after.set(to, Some(Die::new(side, value)));
            // A move off a line of the center may open a shot.
            if !near(from) && !near(to) {
                return winning_shot(&after, side).is_some();
            }
        }
        Command::Increment { at } => {
            let die = board.get(at).expect("a legal increment is on a die");
            after.set(at, Some(Die::new(side, die.value() + 1)));
            if !near(at) {
                return at == CENTER && winning_shot(&after, side).is_some();
            }
        }
        Command::Shoot { to } => {
            let shooter = board
                .get(CENTER)
                .expect("a legal shot starts on the center");
            after.set(CENTER, None);
            after.set(to, Some(shooter));
        }
    }
    can_win_now(&after, side)
}

/// The threats of `side` to win at once, as bits by `Cell::index`: the
/// cells on the clear paths of its moves and shots to the opponent's back
/// row (the landing cells of the moves included), and the targets of its
/// winning shots. A move of the other side stops every such threat only if
/// it lands on a path cell, moves a target away, or captures; a shot of the
/// other side may stop them too.
pub fn threat_paths(board: &Board, side: Side) -> (u128, u128) {
    let mut paths = 0;
    let mut targets = 0;
    for to in shots(board, side).filter(|to| to.row() == side.goal_row()) {
        targets |= 1u128 << to.index();
        let columns = (to.column() as i8 - CENTER.column() as i8).signum();
        let rows = (to.row() as i8 - CENTER.row() as i8).signum();
        let mut at = CENTER.offset(columns, rows).expect("on the line");
        while at != to {
            paths |= 1u128 << at.index();
            at = at.offset(columns, rows).expect("on the line");
        }
    }
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
    (paths, targets)
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
    fn a_shot_to_the_back_row_wins_and_is_a_threat_to_answer() {
        // The white 6 in f6 shoots b1 in f11 (the first die up the f file).
        let state = GameState::from_diagram(
            "
            .. .. .. .. .. b1 .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. w6 .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            b1 .. .. .. .. .. .. .. .. .. ..
            ",
            Side::Black,
        )
        .unwrap();
        let win = winning_move(state.board(), Side::White).unwrap();
        assert_eq!(win.to_string(), "f6xf11");
        let (paths, targets) = threat_paths(state.board(), Side::White);
        assert_eq!(targets, 1u128 << Cell::new(6, 11).index());
        for row in 7..=10 {
            assert!(paths & (1u128 << Cell::new(6, row).index()) != 0);
        }
        assert!(paths & (1u128 << Cell::new(6, 11).index()) == 0);
    }

    #[test]
    fn incrementing_a_5_in_the_center_threatens_a_shot() {
        let state = GameState::from_diagram(
            "
            .. .. .. .. .. .. .. .. .. .. b1
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. b1 b1 .. .. .. .. ..
            .. .. .. .. .. w5 .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            b1 .. .. .. .. .. .. .. .. .. ..
            ",
            Side::White,
        )
        .unwrap();
        // The 5 cannot reach row 11: e7 and f7 block it, and k11 is taken.
        // As a 6 it can shoot k11.
        let center = Command::Increment { at: CENTER };
        assert!(!can_win_now(state.board(), Side::White));
        assert!(creates_threat(state.board(), center, Side::White));
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
