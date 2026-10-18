//! `regras/seks/03-turno.md#atirar`: the shot of a 6 in the center cell.

use crate::testing::{after, cell, play, sparse};
use crate::{
    captures, legal_commands, Command, Die, Engine, GameError, GameEvent, GameState, Outcome, Side,
    WinReason, CENTER,
};

fn shoot(to: (u8, u8)) -> Command {
    Command::Shoot {
        to: cell(to.0, to.1),
    }
}

/// The shots among the legal commands, in their order.
fn shots_of(state: &GameState) -> Vec<Command> {
    legal_commands(state)
        .into_iter()
        .filter(|command| matches!(command, Command::Shoot { .. }))
        .collect()
}

#[test]
fn the_center_is_column_6_of_row_6() {
    assert_eq!(CENTER, cell(6, 6));
    assert_eq!(CENTER.to_string(), "f6");
}

#[test]
fn a_6_in_the_center_shoots_the_first_die_of_each_line_at_any_distance() {
    // North: the first die (f9) is shot, the one behind it (f10) is not.
    // Northwest: 3 cells away (c9). West: on the edge (a6). South: an own
    // die (f4) blocks the line to f2. Southeast: 2 cells away (h4).
    let state = sparse(
        Side::White,
        &[
            "w6@6,6", "b1@6,9", "b1@6,10", "b4@3,9", "b1@1,6", "w1@6,4", "b1@6,2", "b2@8,4",
        ],
    );
    assert_eq!(
        shots_of(&state),
        vec![shoot((6, 9)), shoot((3, 9)), shoot((1, 6)), shoot((8, 4))]
    );
}

#[test]
fn the_shots_come_after_the_moves_of_the_center_die() {
    let state = sparse(Side::White, &["w6@6,6", "b1@6,8"]);
    let commands = legal_commands(&state);
    assert_eq!(commands.last(), Some(&shoot((6, 8))));
}

#[test]
fn only_a_6_of_the_side_to_move_in_the_center_shoots() {
    // A 5 in the center.
    assert!(shots_of(&sparse(Side::White, &["w5@6,6", "b1@6,8"])).is_empty());
    // A 6 next to the center.
    assert!(shots_of(&sparse(Side::White, &["w6@6,5", "b1@6,8"])).is_empty());
    // A 6 of the other side in the center.
    assert!(shots_of(&sparse(Side::White, &["b6@6,6", "w1@6,8", "w1@1,1"])).is_empty());
}

#[test]
fn a_5_in_the_center_shoots_after_an_increment() {
    let state = sparse(Side::White, &["w5@6,6", "b1@6,8", "b1@1,11"]);
    let state = after(&state, crate::testing::inc((6, 6)));
    let state = after(&state, crate::testing::mv((1, 11), (2, 11)));
    assert_eq!(shots_of(&state), vec![shoot((6, 8))]);
}

#[test]
fn the_shot_captures_the_target_and_the_6_takes_its_cell() {
    let state = sparse(Side::White, &["w6@6,6", "b3@6,9", "b1@1,11"]);
    let transition = play(&state, shoot((6, 9)));
    let board = transition.state.board();
    assert_eq!(board.get(CENTER), None);
    assert_eq!(board.get(cell(6, 9)), Some(Die::new(Side::White, 6)));
    assert_eq!(board.count(Side::Black), 1);
    assert_eq!(
        transition.events,
        vec![
            GameEvent::Shot {
                side: Side::White,
                from: CENTER,
                to: cell(6, 9)
            },
            GameEvent::Captured {
                at: cell(6, 9),
                die: Die::new(Side::Black, 3)
            },
        ]
    );
}

#[test]
fn the_shot_resets_the_count_of_plies_without_capture() {
    let state = sparse(Side::White, &["w5@6,6", "b3@6,9", "b1@1,11"]);
    let state = after(&state, crate::testing::inc((6, 6)));
    let state = after(&state, crate::testing::mv((1, 11), (2, 11)));
    assert_eq!(state.plies_without_capture(), 2);
    assert_eq!(after(&state, shoot((6, 9))).plies_without_capture(), 0);
}

#[test]
fn after_the_shot_the_6_captures_by_custody_as_a_die_that_moved() {
    let state = sparse(
        Side::White,
        &["w6@6,6", "b1@6,9", "b2@7,9", "w1@8,9", "b1@1,11"],
    );
    assert_eq!(captures(&state, shoot((6, 9))), 2);
    let transition = play(&state, shoot((6, 9)));
    assert_eq!(transition.state.board().get(cell(7, 9)), None);
    assert_eq!(
        &transition.events[1..],
        &[
            GameEvent::Captured {
                at: cell(6, 9),
                die: Die::new(Side::Black, 1)
            },
            GameEvent::Captured {
                at: cell(7, 9),
                die: Die::new(Side::Black, 2)
            },
        ]
    );
}

#[test]
fn a_shot_that_lands_on_the_opponent_back_row_wins() {
    let state = sparse(Side::White, &["w6@6,6", "b1@6,11", "b1@1,10"]);
    assert_eq!(
        after(&state, shoot((6, 11))).outcome(),
        Some(Outcome::Win {
            winner: Side::White,
            reason: WinReason::BackRow
        })
    );
    // The Blacks, on the southwest diagonal to a1.
    let state = sparse(Side::Black, &["b6@6,6", "w1@1,1", "w1@11,2"]);
    assert_eq!(
        after(&state, shoot((1, 1))).outcome(),
        Some(Outcome::Win {
            winner: Side::Black,
            reason: WinReason::BackRow
        })
    );
}

#[test]
fn the_engine_refuses_the_shots_that_are_not_legal() {
    let state = sparse(
        Side::White,
        &["w6@6,6", "b1@6,8", "b1@6,9", "w1@7,7", "b1@8,8"],
    );
    for to in [(6, 9), (8, 8), (7, 7), (5, 5), (6, 6)] {
        assert_eq!(
            Engine::command(&state, shoot(to)),
            Err(GameError::IllegalShot {
                to: cell(to.0, to.1)
            }),
            "{to:?}"
        );
    }
    let state = sparse(Side::White, &["w5@6,6", "b1@6,8"]);
    assert_eq!(
        Engine::command(&state, shoot((6, 8))),
        Err(GameError::IllegalShot { to: cell(6, 8) })
    );
}

#[test]
fn a_surrounded_6_in_the_center_can_still_shoot_its_neighbors() {
    let state = sparse(
        Side::White,
        &[
            "w6@6,6", "w1@5,5", "w1@6,5", "w1@7,5", "b1@5,6", "b1@7,6", "b1@5,7", "b1@6,7",
            "b1@7,7",
        ],
    );
    assert_eq!(
        shots_of(&state),
        vec![
            shoot((6, 7)),
            shoot((5, 7)),
            shoot((5, 6)),
            shoot((7, 6)),
            shoot((7, 7))
        ]
    );
}

#[test]
fn a_player_whose_only_play_is_a_shot_is_not_out_of_plays() {
    // The Blacks fill the last free cell around the white 6, diagonally so
    // that nothing is captured. Without the shot, the Whites would have no
    // play.
    let state = sparse(
        Side::Black,
        &[
            "w6@6,6", "b6@6,5", "b6@7,5", "b6@5,6", "b6@7,6", "b6@5,7", "b6@6,7", "b6@7,7",
            "b2@3,3",
        ],
    );
    let next = after(&state, crate::testing::mv((3, 3), (5, 5)));
    assert_eq!(next.outcome(), None);
    assert_eq!(shots_of(&next).len(), 8);
    assert_eq!(legal_commands(&next).len(), 8);
}

#[test]
fn the_notation_of_a_shot_is_the_center_x_and_the_target() {
    assert_eq!(shoot((2, 10)).to_string(), "f6xb10");
    assert_eq!("f6xb10".parse::<Command>(), Ok(shoot((2, 10))));
    assert!("e6xb10".parse::<Command>().is_err());
    assert!("f6x".parse::<Command>().is_err());
}
