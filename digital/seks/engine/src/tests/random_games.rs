//! Random games: invariants that hold on every ply, whatever the play.

use crate::outcome::has_play;
use crate::testing::TestRng;
use crate::zobrist::hash_position;
use crate::{
    captures, legal_commands, Engine, GameEvent, GameState, Outcome, Side,
    MAX_PLIES_WITHOUT_CAPTURE,
};

use super::commands::assert_consistent;

/// More than any game can last: a capture is needed every 100 plies and
/// there are 32 dice.
const PLY_LIMIT: usize = 4000;

fn check_invariants(state: &GameState) {
    assert_eq!(
        state.position_hash(),
        hash_position(state.board(), state.to_move())
    );
    assert!(state.plies_without_capture() <= MAX_PLIES_WITHOUT_CAPTURE);
    assert_eq!(
        state.history.as_slice().len(),
        state.plies_without_capture() as usize + 1
    );
    assert!(state.board().count(Side::White) <= 16);
    assert!(state.board().count(Side::Black) <= 16);
    if state.outcome().is_none() {
        // The check done by `step` agrees with the list of plays.
        for side in Side::ALL {
            let flipped = GameState {
                to_move: side,
                ..*state
            };
            assert_eq!(
                has_play(state.board(), side),
                !legal_commands(&flipped).is_empty(),
                "{side:?}\n{}",
                state.board()
            );
        }
    }
}

/// Plays a random game and returns its length and outcome.
fn random_game(seed: u64) -> (usize, Outcome) {
    let mut rng = TestRng(seed);
    let mut state = Engine::new_game();
    for ply in 0..PLY_LIMIT {
        check_invariants(&state);
        if let Some(outcome) = state.outcome() {
            return (ply, outcome);
        }
        if ply < 3 || ply % 150 == 0 {
            assert_consistent(&state);
        }
        let commands = legal_commands(&state);
        let command = commands[rng.below(commands.len())];
        let transition = Engine::command(&state, command).unwrap();
        assert_eq!(Engine::step(&state, command), Ok(transition.state));
        let taken = transition
            .events
            .iter()
            .filter(|event| matches!(event, GameEvent::Captured { .. }))
            .count();
        assert_eq!(captures(&state, command) as usize, taken);
        let before = state.board().count(Side::White) + state.board().count(Side::Black);
        let after = transition.state.board().count(Side::White)
            + transition.state.board().count(Side::Black);
        assert_eq!(before - taken, after);
        state = transition.state;
    }
    panic!("seed {seed}: the game did not end in {PLY_LIMIT} plies");
}

#[test]
fn random_games_end_and_keep_their_invariants() {
    let mut outcomes = Vec::new();
    for seed in 0..60 {
        outcomes.push(random_game(seed));
    }
    // Games differ, and are the same on a second run.
    assert!(outcomes.iter().any(|(length, _)| *length != outcomes[0].0));
    assert_eq!(random_game(7), outcomes[7]);
}
