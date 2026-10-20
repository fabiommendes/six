//! `legal_commands` and `Engine::command` agree on what is legal.

use std::collections::HashSet;

use crate::testing::{position, sparse};
use crate::{legal_commands, legal_commands_into, Cell, Command, Engine, GameState, Side};

/// Every command that could be written for the board: all pairs of cells and
/// all increments.
fn every_command() -> Vec<Command> {
    let mut commands: Vec<Command> = Cell::all()
        .flat_map(|from| Cell::all().map(move |to| Command::Move { from, to }))
        .collect();
    commands.extend(Cell::all().map(|at| Command::Increment { at }));
    commands
}

/// Checks that `command` accepts exactly the commands in `legal_commands`,
/// that `step` agrees with `command`, and returns the number of legal ones.
pub(super) fn assert_consistent(state: &GameState) -> usize {
    let legal = legal_commands(state);
    let legal_set: HashSet<Command> = legal.iter().copied().collect();
    assert_eq!(
        legal_set.len(),
        legal.len(),
        "duplicates in the list\n{}",
        state.board()
    );
    for command in every_command() {
        let result = Engine::command(state, command);
        assert_eq!(
            result.is_ok(),
            legal_set.contains(&command),
            "{command:?} on\n{}",
            state.board()
        );
        assert_eq!(
            Engine::step(state, command).ok(),
            result.ok().map(|transition| transition.state),
            "{command:?}"
        );
    }
    legal.len()
}

#[test]
fn the_initial_position_has_a_consistent_list() {
    assert!(assert_consistent(&GameState::initial()) > 0);
}

#[test]
fn a_position_with_captures_and_blocked_dice_has_a_consistent_list() {
    let state = position(
        "
        .. .. .. .. .. .. .. .. .. .. b6
        .. .. .. .. .. .. .. .. .. w1 w1
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. w3 b2 w4 .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        .. .. .. .. .. .. .. .. .. .. ..
        w6 w1 .. .. .. .. .. .. .. .. ..
        b1 w1 .. .. .. .. .. .. .. .. ..
        ",
        Side::White,
    );
    assert_consistent(&state);
    assert_consistent(&GameState {
        to_move: Side::Black,
        ..state
    });
}

#[test]
fn legal_commands_into_replaces_the_buffer() {
    let state = GameState::initial();
    let mut buffer = vec![Command::Increment {
        at: Cell::new(6, 6),
    }];
    legal_commands_into(&state, &mut buffer);
    assert_eq!(buffer, legal_commands(&state));
}

#[test]
fn a_side_with_only_blocked_6s_has_no_commands() {
    let state = sparse(
        Side::Black,
        &["b6@1,1", "w1@2,1", "w1@1,2", "w1@2,2", "w1@6,6"],
    );
    assert!(legal_commands(&state).is_empty());
    assert_eq!(assert_consistent(&state), 0);
}

/// The number of positions after `depth` plies, counting every legal command.
fn perft(state: &GameState, depth: u32) -> u64 {
    let commands = legal_commands(state);
    if depth == 1 {
        return commands.len() as u64;
    }
    commands
        .into_iter()
        .map(|command| perft(&Engine::step(state, command).unwrap(), depth - 1))
        .sum()
}

#[test]
fn perft_of_the_initial_position() {
    // An independent move generator written over the prototype's `Grid`
    // (`digital/seks/prototipo/seks/grid.py`), which also supplied the
    // captures, counted 98, 9,604 and 949,032, before the Whites had to move
    // on the first turn. Without the 16 increments of the first turn, the
    // first two follow: 98 - 16 = 82 and 82 * 98 = 8,036.
    let state = GameState::initial();
    assert_eq!(perft(&state, 1), 82);
    assert_eq!(perft(&state, 2), 8_036);
    assert_eq!(perft(&state, 3), 792_820);
}
