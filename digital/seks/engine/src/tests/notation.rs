//! The text notation of cells and commands.

use crate::testing::{cell, inc, mv};
use crate::{Cell, Command, GameError, NotationError};

#[test]
fn cells_are_a_column_letter_and_a_row_number() {
    assert_eq!(cell(1, 1).to_string(), "a1");
    assert_eq!(cell(6, 2).to_string(), "f2");
    assert_eq!(cell(11, 11).to_string(), "k11");
    assert_eq!(cell(1, 11).to_string(), "a11");
    assert_eq!("a1".parse::<Cell>(), Ok(cell(1, 1)));
    assert_eq!("k11".parse::<Cell>(), Ok(cell(11, 11)));
    assert_eq!("f10".parse::<Cell>(), Ok(cell(6, 10)));
}

#[test]
fn commands_are_a_move_with_a_dash_or_an_increment_with_a_plus() {
    assert_eq!(mv((2, 2), (2, 4)).to_string(), "b2-b4");
    assert_eq!(inc((3, 11)).to_string(), "c11+");
    assert_eq!("b2-b4".parse::<Command>(), Ok(mv((2, 2), (2, 4))));
    assert_eq!("c11+".parse::<Command>(), Ok(inc((3, 11))));
}

#[test]
fn every_cell_round_trips() {
    for cell in Cell::all() {
        assert_eq!(cell.to_string().parse::<Cell>(), Ok(cell));
    }
}

#[test]
fn every_command_round_trips() {
    for from in Cell::all() {
        let increment = Command::Increment { at: from };
        assert_eq!(increment.to_string().parse::<Command>(), Ok(increment));
        for to in Cell::all() {
            let command = Command::Move { from, to };
            assert_eq!(command.to_string().parse::<Command>(), Ok(command));
        }
    }
}

#[test]
fn bad_cells_are_refused() {
    for text in [
        "", "a", "1", "a0", "a12", "a111", "l1", "A1", "a01", "a+1", "a-1", " a1", "a1 ", "1a",
        "aa", "a1b", "é1",
    ] {
        assert!(text.parse::<Cell>().is_err(), "{text:?}");
    }
}

#[test]
fn bad_commands_are_refused() {
    for text in [
        "", "-", "+", "a1", "a1-", "-a1", "a1--b2", "a1-b2-c3", "a1+b2", "a1++", "a1 - b2",
        "a1-b2 ", "a1-b0", "a1-l1", "A1-b2", "a1=b2", "a1b2",
    ] {
        assert!(text.parse::<Command>().is_err(), "{text:?}");
    }
}

#[test]
fn reading_a_command_does_not_check_that_it_is_legal() {
    assert_eq!("a1-a1".parse::<Command>(), Ok(mv((1, 1), (1, 1))));
}

#[test]
fn the_error_says_what_was_expected() {
    let error: NotationError = "z9".parse::<Cell>().unwrap_err();
    assert_eq!(error.to_string(), "\"z9\" is not a cell like a1 or k11");
    let error = "b2".parse::<Command>().unwrap_err();
    assert_eq!(
        error.to_string(),
        "\"b2\" is not a command like b2-b4, b2+ or f6xb10"
    );
}

#[test]
fn game_errors_use_the_notation() {
    let error = GameError::IllegalMove {
        from: cell(2, 2),
        to: cell(6, 6),
    };
    assert_eq!(error.to_string(), "the die at b2 cannot move to f6");
}
