//! Self-play of the simple bots: every pairing finishes its games without
//! an engine error (R5 of `dev/issues/motor-do-seks-em-rust.md`).
//! 800 games: out of `just check`, run by `just seks-bots-slow-test`.

use seks_bots::by_name;
use seks_bots::game::play;
use seks_engine::GameState;

/// More than any game can last: a capture is needed every 100 plies and
/// there are 32 dice.
const MAX_PLIES: u32 = 4000;

fn play_games(white: &str, black: &str, games: u64) {
    let mut bots = [by_name(white).unwrap(), by_name(black).unwrap()];
    for seed in 0..games {
        let [w, b] = &mut bots;
        let game = play(
            [w.as_mut(), b.as_mut()],
            &GameState::initial(),
            seed,
            MAX_PLIES,
        )
        .unwrap_or_else(|error| panic!("{white} vs {black}, seed {seed}: {error}"));
        assert!(
            game.outcome.is_some(),
            "{white} vs {black}, seed {seed}: no end in {MAX_PLIES} plies"
        );
    }
}

#[test]
#[ignore = "slow: just seks-bots-slow-test"]
fn random_against_random() {
    play_games("random", "random", 200);
}

#[test]
#[ignore = "slow: just seks-bots-slow-test"]
fn random_against_greedy() {
    play_games("random", "greedy", 200);
    play_games("greedy", "random", 200);
}

#[test]
#[ignore = "slow: just seks-bots-slow-test"]
fn greedy_against_greedy() {
    play_games("greedy", "greedy", 200);
}
