//! Small queries for searches: repetitions, captures without applying,
//! positions built from boards.

use crate::testing::{after, cell, mv, play, position, sparse};
use crate::{captures, legal_commands, Board, Command, Die, GameState, Side, DIRECTIONS};

#[test]
fn repetitions_counts_the_current_position() {
    let mut state = GameState::initial();
    assert_eq!(state.repetitions(), 1);
    for (round, expected) in [(1, 2), (2, 3)] {
        for command in [mv((1, 1), (2, 1)), mv((1, 11), (2, 11)), mv((2, 1), (1, 1))] {
            state = after(&state, command);
            // The positions after the first three plies repeat once per round.
            assert_eq!(state.repetitions(), round, "round {round}");
        }
        state = after(&state, mv((2, 11), (1, 11)));
        assert_eq!(state.repetitions(), expected);
    }
}

#[test]
fn repetitions_restarts_after_a_capture() {
    let state = sparse(Side::White, &["w3@3,6", "b2@6,6", "w1@7,6", "b1@1,11"]);
    let state = after(&state, mv((3, 6), (5, 6)));
    assert_eq!(state.repetitions(), 1);
}

#[test]
fn captures_counts_the_dice_a_move_would_take() {
    let state = sparse(
        Side::White,
        &[
            "w3@3,3", "b2@6,7", "w2@6,8", "b6@5,6", "w2@4,6", "b1@7,6", "w1@8,6", "b3@6,5",
            "w5@6,4", "b1@1,11",
        ],
    );
    assert_eq!(captures(&state, mv((3, 3), (6, 6))), 4);
    assert_eq!(captures(&state, mv((3, 3), (5, 5))), 0);
    assert_eq!(captures(&state, Command::Increment { at: cell(3, 3) }), 0);
}

#[test]
fn captures_agrees_with_the_events_of_every_legal_command() {
    let positions = [
        GameState::initial(),
        sparse(
            Side::White,
            &[
                "w3@3,3", "b2@6,7", "w2@6,8", "b6@5,6", "w2@4,6", "b1@7,6", "w1@8,6", "b3@6,5",
            ],
        ),
        sparse(
            Side::Black,
            &["b3@6,9", "w3@7,6", "b2@8,6", "w1@6,6", "b2@5,7", "w4@9,6"],
        ),
    ];
    for state in positions {
        for command in legal_commands(&state) {
            let events = play(&state, command).events;
            let taken = events
                .iter()
                .filter(|event| matches!(event, crate::GameEvent::Captured { .. }))
                .count();
            assert_eq!(captures(&state, command) as usize, taken, "{command}");
        }
    }
}

#[test]
fn a_board_built_with_set_equals_the_one_from_a_diagram() {
    let mut board = Board::empty();
    board.set(cell(1, 1), Some(Die::new(Side::White, 1)));
    board.set(cell(11, 11), Some(Die::new(Side::Black, 6)));
    board.set(cell(5, 5), Some(Die::new(Side::Black, 2)));
    board.set(cell(5, 5), None);
    let from_diagram = position(
        "
        .. .. .. .. .. .. .. .. .. .. b6
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        w1 .. .. .. .. .. .. .. .. .. ..
        ",
        Side::Black,
    );
    let from_board = GameState::from_board(board, Side::Black);
    assert_eq!(from_board, from_diagram);
    assert_eq!(from_board.position_hash(), from_diagram.position_hash());
}

#[test]
fn directions_are_the_8_distinct_unit_steps() {
    let mut seen = DIRECTIONS.to_vec();
    seen.sort_unstable();
    seen.dedup();
    assert_eq!(seen.len(), 8);
    assert!(DIRECTIONS.iter().all(|&(columns, rows)| columns.abs() <= 1
        && rows.abs() <= 1
        && (columns, rows) != (0, 0)));
}

#[test]
fn every_legal_move_follows_one_of_the_directions() {
    let state = GameState::initial();
    for command in legal_commands(&state) {
        if let Command::Move { from, to } = command {
            let columns = (to.column() as i8 - from.column() as i8).signum();
            let rows = (to.row() as i8 - from.row() as i8).signum();
            assert!(DIRECTIONS.contains(&(columns, rows)), "{command}");
        }
    }
}
