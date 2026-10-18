//! `regras/seks/03-turno.md` (and the movement tests of the prototype).

use std::collections::HashSet;

use crate::testing::{after, cell, inc, mv, play, sparse};
use crate::{legal_commands, Command, Die, Engine, GameError, GameEvent, GameState, Side};

/// The legal moves (not increments) of the die in `from`, as destinations.
fn destinations(state: &GameState, from: (u8, u8)) -> HashSet<(u8, u8)> {
    legal_commands(state)
        .into_iter()
        .filter_map(|command| match command {
            Command::Move { from: start, to } if start == cell(from.0, from.1) => {
                Some((to.column(), to.row()))
            }
            _ => None,
        })
        .collect()
}

/// Every legal command of the die in `at`.
fn plays_of(state: &GameState, at: (u8, u8)) -> Vec<Command> {
    let at = cell(at.0, at.1);
    legal_commands(state)
        .into_iter()
        .filter(|command| match command {
            Command::Move { from, .. } => *from == at,
            Command::Increment { at: target } => *target == at,
            Command::Shoot { .. } => at == crate::CENTER,
        })
        .collect()
}

fn set(cells: &[(u8, u8)]) -> HashSet<(u8, u8)> {
    cells.iter().copied().collect()
}

#[test]
fn a_die_moves_up_to_its_value_in_all_8_directions() {
    let state = sparse(Side::White, &["w3@6,6", "b1@1,11"]);
    let mut expected = HashSet::new();
    for (columns, rows) in [
        (0, 1),
        (-1, 1),
        (-1, 0),
        (-1, -1),
        (0, -1),
        (1, -1),
        (1, 0),
        (1, 1),
    ] {
        for distance in 1..=3 {
            expected.insert(((6 + columns * distance) as u8, (6 + rows * distance) as u8));
        }
    }
    assert_eq!(expected.len(), 24);
    assert_eq!(destinations(&state, (6, 6)), expected);
}

#[test]
fn a_die_showing_1_moves_one_cell() {
    let state = sparse(Side::White, &["w1@6,6", "b1@1,11"]);
    assert_eq!(destinations(&state, (6, 6)).len(), 8);
}

#[test]
fn a_die_does_not_leave_the_board() {
    let state = sparse(Side::White, &["w3@1,1", "b1@11,11"]);
    let expected: HashSet<(u8, u8)> = (2..=4).flat_map(|n| [(1, n), (n, 1), (n, n)]).collect();
    assert_eq!(destinations(&state, (1, 1)), expected);
}

#[test]
fn a_die_does_not_jump_over_dice() {
    // Own die to the north, enemy die to the east, both adjacent.
    let state = sparse(Side::White, &["w3@6,6", "w1@6,7", "b1@7,6"]);
    let reachable = destinations(&state, (6, 6));
    for blocked in [(6, 7), (6, 8), (6, 9), (7, 6), (8, 6), (9, 6)] {
        assert!(!reachable.contains(&blocked), "{blocked:?}");
    }
    assert!(reachable.contains(&(5, 5)));
}

#[test]
fn a_die_is_blocked_by_a_die_farther_along_the_line() {
    let state = sparse(Side::White, &["w4@6,6", "b1@6,8"]);
    let north: HashSet<_> = destinations(&state, (6, 6))
        .into_iter()
        .filter(|&(column, row)| column == 6 && row > 6)
        .collect();
    assert_eq!(north, set(&[(6, 7)]));
}

#[test]
fn a_die_does_not_end_on_an_occupied_cell() {
    let state = sparse(Side::White, &["w2@6,6", "w1@6,8", "b1@8,8", "b1@4,4"]);
    let reachable = destinations(&state, (6, 6));
    for occupied in [(6, 8), (8, 8), (4, 4)] {
        assert!(!reachable.contains(&occupied), "{occupied:?}");
    }
    assert!(reachable.contains(&(7, 7)));
}

#[test]
fn moving_leaves_the_distance_walked_as_the_value() {
    let state = sparse(Side::White, &["w4@6,6", "b1@1,11"]);
    for (to, value) in [
        ((6, 7), 1),
        ((6, 8), 2),
        ((8, 8), 2),
        ((6, 9), 3),
        ((6, 10), 4),
    ] {
        let next = after(&state, mv((6, 6), to));
        assert_eq!(
            next.die_at(cell(to.0, to.1)),
            Some(Die::new(Side::White, value)),
            "to {to:?}"
        );
        assert_eq!(next.die_at(cell(6, 6)), None);
    }
}

#[test]
fn a_move_never_leaves_a_die_with_a_higher_value() {
    let state = sparse(Side::White, &["w5@6,6", "b1@1,11"]);
    for command in legal_commands(&state) {
        if let Command::Move { to, .. } = command {
            let value = after(&state, command).die_at(to).unwrap().value();
            assert!(value <= 5, "{command:?}");
        }
    }
}

#[test]
fn a_move_passes_the_turn() {
    let state = sparse(Side::White, &["w2@6,6", "b1@1,11"]);
    let next = after(&state, mv((6, 6), (6, 8)));
    assert_eq!(next.to_move(), Side::Black);
    let back = after(&next, mv((1, 11), (1, 10)));
    assert_eq!(back.to_move(), Side::White);
}

#[test]
fn an_increment_adds_1_in_the_same_cell_and_passes_the_turn() {
    let state = sparse(Side::White, &["w2@6,6", "b1@1,11"]);
    let next = after(&state, inc((6, 6)));
    assert_eq!(next.die_at(cell(6, 6)), Some(Die::new(Side::White, 3)));
    assert_eq!(next.board().count(Side::White), 1);
    assert_eq!(next.to_move(), Side::Black);
}

#[test]
fn a_6_cannot_be_incremented() {
    let state = sparse(Side::White, &["w6@6,6", "b1@1,11"]);
    assert_eq!(
        Engine::command(&state, inc((6, 6))),
        Err(GameError::CannotIncrement { at: cell(6, 6) })
    );
    assert!(!legal_commands(&state).contains(&inc((6, 6))));
}

#[test]
fn every_die_below_6_can_be_incremented() {
    for value in 1..=5 {
        let dice = [format!("w{value}@6,6"), "b1@1,11".to_string()];
        let state = sparse(Side::White, &[&dice[0], &dice[1]]);
        assert!(legal_commands(&state).contains(&inc((6, 6))), "{value}");
    }
}

#[test]
fn passing_is_not_allowed() {
    let state = sparse(Side::White, &["w2@6,6", "b1@1,11"]);
    // A move to the same cell is not a move.
    assert_eq!(
        Engine::command(&state, mv((6, 6), (6, 6))),
        Err(GameError::IllegalMove {
            from: cell(6, 6),
            to: cell(6, 6)
        })
    );
    // Every legal command changes the position.
    for command in legal_commands(&state) {
        assert_ne!(after(&state, command).board(), state.board(), "{command:?}");
    }
}

#[test]
fn a_6_with_all_8_directions_blocked_has_no_play() {
    // Surrounded by dice of both sides, away from the center (where it
    // could shoot; see `tests::shot`).
    let state = sparse(
        Side::White,
        &[
            "w6@4,4", "w1@3,3", "w1@4,3", "w1@5,3", "b1@3,4", "b1@5,4", "b1@3,5", "b1@4,5",
            "b1@5,5",
        ],
    );
    assert_eq!(plays_of(&state, (4, 4)), vec![]);
}

#[test]
fn a_6_in_the_corner_is_blocked_by_the_edge_and_three_dice() {
    let state = sparse(Side::White, &["w6@1,1", "b1@2,1", "b1@1,2", "b1@2,2"]);
    assert!(destinations(&state, (1, 1)).is_empty());
    assert!(!legal_commands(&state).contains(&inc((1, 1))));
}

#[test]
fn a_surrounded_die_below_6_still_has_its_increment() {
    let state = sparse(Side::White, &["w5@1,1", "b1@2,1", "b1@1,2", "b1@2,2"]);
    assert_eq!(plays_of(&state, (1, 1)), vec![inc((1, 1))]);
}

#[test]
fn a_side_cannot_move_the_dice_of_the_other() {
    let state = sparse(Side::White, &["w2@6,6", "b2@8,8"]);
    assert_eq!(
        Engine::command(&state, mv((8, 8), (8, 9))),
        Err(GameError::NotYourDie { at: cell(8, 8) })
    );
    assert_eq!(
        Engine::command(&state, inc((8, 8))),
        Err(GameError::NotYourDie { at: cell(8, 8) })
    );
}

#[test]
fn an_empty_cell_has_no_die_to_play() {
    let state = sparse(Side::White, &["w2@6,6", "b2@8,8"]);
    assert_eq!(
        Engine::command(&state, mv((3, 3), (3, 4))),
        Err(GameError::NotYourDie { at: cell(3, 3) })
    );
    assert_eq!(
        Engine::command(&state, inc((3, 3))),
        Err(GameError::NotYourDie { at: cell(3, 3) })
    );
}

#[test]
fn moves_off_the_lines_or_too_far_are_refused() {
    let state = sparse(Side::White, &["w3@6,6", "b1@1,11"]);
    // A knight's move, two odd shapes, and 4 cells along a line and a diagonal.
    for to in [(7, 8), (8, 7), (9, 8), (6, 10), (10, 10)] {
        assert_eq!(
            Engine::command(&state, mv((6, 6), to)).map(|_| ()),
            Err(GameError::IllegalMove {
                from: cell(6, 6),
                to: cell(to.0, to.1)
            }),
            "{to:?}"
        );
    }
}

#[test]
fn a_refused_command_leaves_the_state_unchanged() {
    let state = GameState::initial();
    let copy = state;
    assert!(Engine::command(&state, mv((2, 2), (6, 6))).is_err());
    assert_eq!(state, copy);
}

#[test]
fn applying_a_command_does_not_change_the_input_state() {
    let state = GameState::initial();
    let copy = state;
    let _ = play(&state, mv((2, 2), (2, 4)));
    assert_eq!(state, copy);
}

#[test]
fn a_move_emits_a_moved_event_with_the_new_value() {
    let state = sparse(Side::White, &["w4@6,6", "b1@1,11"]);
    let transition = play(&state, mv((6, 6), (6, 8)));
    assert_eq!(
        transition.events,
        vec![GameEvent::Moved {
            side: Side::White,
            from: cell(6, 6),
            to: cell(6, 8),
            value: 2
        }]
    );
}

#[test]
fn an_increment_emits_an_incremented_event_with_the_new_value() {
    let state = sparse(Side::Black, &["w4@6,6", "b2@1,11"]);
    let transition = play(&state, inc((1, 11)));
    assert_eq!(
        transition.events,
        vec![GameEvent::Incremented {
            side: Side::Black,
            at: cell(1, 11),
            value: 3
        }]
    );
}

// Translated from the prototype (`test_game.py`), column = i + 1, row = 11 - j.

#[test]
fn prototype_dice_move_up_to_their_value_in_straight_lines() {
    // Prototype: the die at (1, 9) of the initial position.
    let state = GameState::initial();
    assert_eq!(
        destinations(&state, (2, 2)),
        set(&[(1, 3), (2, 3), (2, 1), (3, 3), (2, 4), (4, 4)])
    );
}

#[test]
fn prototype_movements_are_blocked_by_other_dice() {
    // Prototype: a 1 on the back row can only step into the empty cells next
    // to it; the corner die at (0, 10).
    let state = GameState::initial();
    assert_eq!(destinations(&state, (1, 1)), set(&[(2, 1)]));
}

#[test]
fn prototype_move_sets_die_value_to_distance_and_passes_turn() {
    let state = after(&GameState::initial(), mv((2, 2), (2, 4)));
    assert_eq!(state.die_at(cell(2, 4)), Some(Die::new(Side::White, 2)));
    assert_eq!(state.die_at(cell(2, 2)), None);
    assert_eq!(state.to_move(), Side::Black);
}

#[test]
fn prototype_short_move_lowers_die_value() {
    let state = after(&GameState::initial(), mv((2, 2), (2, 3)));
    assert_eq!(state.die_at(cell(2, 3)), Some(Die::new(Side::White, 1)));
}

#[test]
fn prototype_incrementing_raises_the_die_and_passes_turn() {
    let state = after(&GameState::initial(), inc((2, 2)));
    assert_eq!(state.die_at(cell(2, 2)), Some(Die::new(Side::White, 3)));
    assert_eq!(state.to_move(), Side::Black);
}

#[test]
fn prototype_die_with_six_cannot_be_incremented() {
    let state = sparse(Side::White, &["w6@2,2", "b1@1,11"]);
    assert!(Engine::command(&state, inc((2, 2))).is_err());
    assert_eq!(state.to_move(), Side::White);
}

#[test]
fn prototype_cannot_select_opponent_die() {
    let state = GameState::initial();
    assert_eq!(
        Engine::command(&state, inc((2, 10))),
        Err(GameError::NotYourDie { at: cell(2, 10) })
    );
}

#[test]
fn prototype_invalid_destination_is_refused() {
    let state = GameState::initial();
    assert_eq!(
        Engine::command(&state, mv((2, 2), (6, 6))),
        Err(GameError::IllegalMove {
            from: cell(2, 2),
            to: cell(6, 6)
        })
    );
    assert_eq!(state.to_move(), Side::White);
}
