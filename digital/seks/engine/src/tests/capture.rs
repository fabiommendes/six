//! `regras/seks/04-captura.md` (and the capture tests of the prototype).

use crate::testing::{after, cell, inc, mv, play, sparse};
use crate::{Die, GameEvent, Side, Transition};

/// The cells where dice were captured, in event order.
fn captured_cells(transition: &Transition) -> Vec<(u8, u8)> {
    transition
        .events
        .iter()
        .filter_map(|event| match event {
            GameEvent::Captured { at, .. } => Some((at.column(), at.row())),
            _ => None,
        })
        .collect()
}

#[test]
fn a_move_that_flanks_an_adversary_captures_it() {
    // Prototype `test_captures_sandwiched_adversary`: the white die walks to
    // (6, 6), the black die at (7, 6) is between it and the white die at (8, 6).
    let state = sparse(Side::White, &["w3@6,3", "b3@7,6", "w2@8,6", "b1@1,11"]);
    let transition = play(&state, mv((6, 3), (6, 6)));
    assert_eq!(
        transition.events,
        vec![
            GameEvent::Moved {
                side: Side::White,
                from: cell(6, 3),
                to: cell(6, 6),
                value: 3
            },
            GameEvent::Captured {
                at: cell(7, 6),
                die: Die::new(Side::Black, 3)
            },
        ]
    );
    assert_eq!(transition.state.die_at(cell(7, 6)), None);
    assert_eq!(
        transition.state.die_at(cell(6, 6)),
        Some(Die::new(Side::White, 3))
    );
    assert_eq!(
        transition.state.die_at(cell(8, 6)),
        Some(Die::new(Side::White, 2))
    );
}

#[test]
fn a_captured_die_leaves_the_board_for_good() {
    let state = sparse(Side::White, &["w3@6,3", "b3@7,6", "w2@8,6", "b1@1,11"]);
    let next = after(&state, mv((6, 3), (6, 6)));
    assert_eq!(next.board().count(Side::Black), 1);
    assert_eq!(next.board().count(Side::White), 2);
}

#[test]
fn the_blacks_capture_too() {
    let state = sparse(Side::Black, &["b3@6,9", "w3@7,6", "b2@8,6", "w1@1,1"]);
    let transition = play(&state, mv((6, 9), (6, 6)));
    assert_eq!(captured_cells(&transition), vec![(7, 6)]);
}

#[test]
fn there_is_no_capture_without_a_die_on_the_other_side() {
    // Prototype `test_no_capture_without_partner`.
    let state = sparse(Side::White, &["w3@6,3", "b3@7,6", "b1@1,11"]);
    let transition = play(&state, mv((6, 3), (6, 6)));
    assert_eq!(captured_cells(&transition), vec![]);
    assert_eq!(
        transition.state.die_at(cell(7, 6)),
        Some(Die::new(Side::Black, 3))
    );
}

#[test]
fn an_adversary_between_the_mover_and_an_empty_cell_is_safe() {
    let state = sparse(Side::White, &["w3@6,3", "b3@7,6", "w2@9,6", "b1@1,11"]);
    assert_eq!(captured_cells(&play(&state, mv((6, 3), (6, 6)))), vec![]);
}

#[test]
fn a_move_can_capture_in_up_to_four_directions_at_once() {
    // The die walks from (3, 3) to (6, 6), flanking a black die on each side.
    let state = sparse(
        Side::White,
        &[
            "w3@3,3", "b2@6,7", "w2@6,8", "b6@5,6", "w2@4,6", "b1@7,6", "w1@8,6", "b3@6,5",
            "w5@6,4", "b1@1,11",
        ],
    );
    let transition = play(&state, mv((3, 3), (6, 6)));
    // North, west, south, east.
    assert_eq!(
        captured_cells(&transition),
        vec![(6, 7), (5, 6), (6, 5), (7, 6)]
    );
    assert_eq!(transition.state.board().count(Side::Black), 1);
}

#[test]
fn the_value_of_the_dice_does_not_matter() {
    for victim in 1..=6 {
        for mover in 1..=6 {
            let dice = [
                format!("w{mover}@6,6"),
                format!("b{victim}@7,7"),
                "w1@7,8".to_string(),
                "b1@1,11".to_string(),
            ];
            let state = sparse(Side::White, &[&dice[0], &dice[1], &dice[2], &dice[3]]);
            // The die steps to (7, 6): the victim is north of it and the
            // partner above the victim.
            let transition = play(&state, mv((6, 6), (7, 6)));
            assert_eq!(
                captured_cells(&transition),
                vec![(7, 7)],
                "{mover} vs {victim}"
            );
        }
    }
}

#[test]
fn a_1_and_a_2_capture_a_6() {
    let state = sparse(Side::White, &["w1@5,5", "b6@6,6", "w2@6,7", "b1@1,11"]);
    let transition = play(&state, mv((5, 5), (6, 5)));
    assert_eq!(
        transition.events[1],
        GameEvent::Captured {
            at: cell(6, 6),
            die: Die::new(Side::Black, 6)
        }
    );
}

#[test]
fn only_one_die_is_captured_per_direction() {
    // Two black dice in a row between the mover and another white die.
    let state = sparse(
        Side::White,
        &["w3@4,3", "b2@5,6", "b2@6,6", "w2@7,6", "b1@1,11"],
    );
    let transition = play(&state, mv((4, 3), (4, 6)));
    assert_eq!(captured_cells(&transition), vec![]);
    assert_eq!(transition.state.board().count(Side::Black), 3);
}

#[test]
fn diagonals_do_not_capture() {
    // The die walks to (6, 6); on each diagonal there is a black die with a
    // white die behind it.
    for (columns, rows) in [(1, 1), (1, -1), (-1, 1), (-1, -1)] {
        let at = |steps: i8| ((6 + columns * steps) as u8, (6 + rows * steps) as u8);
        let (victim, partner) = (at(1), at(2));
        let dice = [
            format!("b2@{},{}", victim.0, victim.1),
            format!("w2@{},{}", partner.0, partner.1),
        ];
        let state = sparse(Side::White, &["w3@6,3", &dice[0], &dice[1], "b1@1,11"]);
        let transition = play(&state, mv((6, 3), (6, 6)));
        assert_eq!(
            captured_cells(&transition),
            vec![],
            "diagonal {columns},{rows}"
        );
        assert_eq!(transition.state.board().count(Side::Black), 2);
    }
}

#[test]
fn the_edge_of_the_board_does_not_count_as_a_die_of_the_mover() {
    // Prototype `test_no_capture_at_board_edge`: the black die is in the last
    // column and the mover lands next to it.
    let state = sparse(Side::White, &["w3@7,3", "b3@11,6", "b1@1,11"]);
    let transition = play(&state, mv((7, 3), (10, 6)));
    assert_eq!(captured_cells(&transition), vec![]);
    assert_eq!(
        transition.state.die_at(cell(11, 6)),
        Some(Die::new(Side::Black, 3))
    );
}

#[test]
fn a_move_next_to_an_edge_does_not_wrap_around_the_board() {
    // Prototype `test_no_capture_across_the_left_edge`: a black die and a
    // white die in the last columns must not be read as the neighbors west of
    // column 1, in the same row or in the one below.
    for row in [5, 6] {
        let dice = [
            "w3@4,3".to_string(),
            format!("b3@11,{row}"),
            format!("w2@10,{row}"),
            "b1@1,11".to_string(),
        ];
        let state = sparse(Side::White, &[&dice[0], &dice[1], &dice[2], &dice[3]]);
        let transition = play(&state, mv((4, 3), (1, 6)));
        assert_eq!(captured_cells(&transition), vec![], "row {row}");
    }
}

#[test]
fn a_move_next_to_the_top_and_bottom_edges_does_not_wrap_around() {
    // Prototype `test_no_capture_across_the_top_edge`, for both ends.
    let state = sparse(Side::White, &["w3@5,8", "b3@5,1", "w2@5,2", "b1@1,11"]);
    assert_eq!(captured_cells(&play(&state, mv((5, 8), (5, 11)))), vec![]);
    let state = sparse(Side::Black, &["b3@5,4", "w3@5,11", "b2@5,10", "w1@1,1"]);
    assert_eq!(captured_cells(&play(&state, mv((5, 4), (5, 1)))), vec![]);
}

#[test]
fn a_die_that_stops_between_two_adversary_dice_is_safe() {
    let state = sparse(Side::White, &["w3@6,3", "b2@5,6", "b2@7,6", "b1@1,11"]);
    let transition = play(&state, mv((6, 3), (6, 6)));
    assert_eq!(captured_cells(&transition), vec![]);
    assert_eq!(
        transition.state.die_at(cell(6, 6)),
        Some(Die::new(Side::White, 3))
    );
}

#[test]
fn a_die_between_two_adversary_dice_stays_safe_when_they_play_elsewhere() {
    let state = sparse(Side::White, &["w3@6,3", "b2@5,6", "b2@7,6", "b1@1,11"]);
    let state = after(&state, mv((6, 3), (6, 6)));
    // The Blacks move another die: the white die between them is not touched.
    let transition = play(&state, mv((1, 11), (1, 10)));
    assert_eq!(captured_cells(&transition), vec![]);
    assert_eq!(
        transition.state.die_at(cell(6, 6)),
        Some(Die::new(Side::White, 3))
    );
}

#[test]
fn an_increment_never_captures() {
    // The black die is already between two white dice, one of which is
    // incremented.
    let state = sparse(Side::White, &["w2@5,6", "b3@6,6", "w2@7,6", "b1@1,11"]);
    let transition = play(&state, inc((5, 6)));
    assert_eq!(captured_cells(&transition), vec![]);
    assert_eq!(
        transition.state.die_at(cell(6, 6)),
        Some(Die::new(Side::Black, 3))
    );
    assert_eq!(transition.events.len(), 1);
}

#[test]
fn an_adversary_already_between_two_dice_is_not_captured_by_other_moves() {
    // Detalhe: the black die at (6, 6) was between the white dice at (5, 6) and
    // (7, 6) before the move, and the die that moves is neither of them.
    let state = sparse(
        Side::White,
        &["w2@5,6", "b3@6,6", "w2@7,6", "w3@9,3", "b1@1,11"],
    );
    for command in [mv((9, 3), (9, 6)), mv((9, 3), (6, 3)), mv((9, 3), (8, 4))] {
        let transition = play(&state, command);
        assert_eq!(captured_cells(&transition), vec![], "{command:?}");
        assert_eq!(
            transition.state.die_at(cell(6, 6)),
            Some(Die::new(Side::Black, 3))
        );
    }
}

#[test]
fn a_die_next_to_a_cell_already_flanked_does_not_capture_it_sideways() {
    // The mover lands above the sandwiched black die: the vertical custody
    // has no white die below it, and the horizontal one is not looked at.
    let state = sparse(
        Side::White,
        &["w2@5,6", "b3@6,6", "w2@7,6", "w2@6,9", "b1@1,11"],
    );
    let transition = play(&state, mv((6, 9), (6, 7)));
    assert_eq!(captured_cells(&transition), vec![]);
}

#[test]
fn a_black_die_next_to_one_white_die_is_captured_when_another_arrives_opposite() {
    // The white die at (5, 6) alone does nothing; the capture happens when
    // the second white die arrives as the other end.
    let state = sparse(Side::White, &["w2@5,6", "b3@6,6", "w2@7,8", "b1@1,11"]);
    let transition = play(&state, mv((7, 8), (7, 6)));
    assert_eq!(captured_cells(&transition), vec![(6, 6)]);
}

#[test]
fn a_move_that_ends_the_game_still_captures() {
    // The captures of the move that reaches the back row are real; the
    // result does not depend on them (see `tests/ending.rs`).
    let state = sparse(Side::White, &["w3@6,8", "b2@7,11", "w2@8,11", "b1@1,1"]);
    let transition = play(&state, mv((6, 8), (6, 11)));
    assert_eq!(captured_cells(&transition), vec![(7, 11)]);
}
