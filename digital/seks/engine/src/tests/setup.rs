//! `regras/seks/02-preparacao.md` (and the translation of the initial-grid
//! tests of the prototype).

use crate::testing::cell;
use crate::{Cell, Die, GameState, Side};

fn die(side: Side, value: u8) -> Option<Die> {
    Some(Die::new(side, value))
}

#[test]
fn each_side_starts_with_16_dice() {
    let board = *GameState::initial().board();
    assert_eq!(board.count(Side::White), 16);
    assert_eq!(board.count(Side::Black), 16);
}

#[test]
fn the_whites_start_on_rows_1_and_2() {
    let state = GameState::initial();
    for column in 1..=11 {
        let back = if column % 2 == 1 {
            die(Side::White, 1)
        } else {
            None
        };
        let front = if column == 6 {
            None
        } else {
            die(Side::White, 2)
        };
        assert_eq!(
            state.die_at(cell(column, 1)),
            back,
            "row 1, column {column}"
        );
        assert_eq!(
            state.die_at(cell(column, 2)),
            front,
            "row 2, column {column}"
        );
    }
}

#[test]
fn the_blacks_start_on_rows_11_and_10() {
    let state = GameState::initial();
    for column in 1..=11 {
        let back = if column % 2 == 1 {
            die(Side::Black, 1)
        } else {
            None
        };
        let front = if column == 6 {
            None
        } else {
            die(Side::Black, 2)
        };
        assert_eq!(
            state.die_at(cell(column, 11)),
            back,
            "row 11, column {column}"
        );
        assert_eq!(
            state.die_at(cell(column, 10)),
            front,
            "row 10, column {column}"
        );
    }
}

#[test]
fn the_other_rows_start_empty() {
    let state = GameState::initial();
    for cell in Cell::all().filter(|cell| (3..=9).contains(&cell.row())) {
        assert_eq!(state.die_at(cell), None, "{cell:?}");
    }
}

#[test]
fn the_position_is_symmetric_between_the_sides() {
    let state = GameState::initial();
    for (at, die) in state.board().dice() {
        let mirror = cell(at.column(), 12 - at.row());
        assert_eq!(
            state.die_at(mirror),
            Some(Die::new(die.side().opponent(), die.value())),
            "{at:?}"
        );
    }
}

#[test]
fn the_whites_play_first() {
    assert_eq!(GameState::initial().to_move(), Side::White);
}

#[test]
fn the_back_rows_are_1_for_the_whites_and_11_for_the_blacks() {
    assert_eq!(Side::White.back_row(), 1);
    assert_eq!(Side::Black.back_row(), 11);
    assert_eq!(Side::White.goal_row(), 11);
    assert_eq!(Side::Black.goal_row(), 1);
}
