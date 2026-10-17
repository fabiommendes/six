//! Batches: reproducible with any number of threads, and their game files
//! replay to the same ending (R2 of `dev/issues/bots-do-seks.md`).

use std::num::NonZeroUsize;

use seks_bots::batch::{untimed, Batch, Record, Summary};
use seks_bots::game_file::GameFile;
use seks_bots::openings::generate;

fn batch(bots: [&str; 2], games: usize, threads: usize) -> Batch {
    Batch {
        bots: bots.map(String::from),
        openings: generate(10, 6, 3, |_| true),
        games,
        seed: 11,
        threads: NonZeroUsize::new(threads).unwrap(),
        max_plies: 1000,
        games_out: None,
    }
}

fn untimed_records(batch: &Batch) -> Vec<Record> {
    batch.run(&|_| {}).unwrap().iter().map(untimed).collect()
}

#[test]
fn the_same_seed_gives_the_same_records_with_1_and_4_threads() {
    let one = untimed_records(&batch(["random", "greedy"], 40, 1));
    let four = untimed_records(&batch(["random", "greedy"], 40, 4));
    assert_eq!(one, four);
    assert_eq!(one.len(), 40);
    // Each opening is played once with each color.
    assert_eq!((one[0].opening, one[0].white.as_str()), (0, "a"));
    assert_eq!((one[1].opening, one[1].white.as_str()), (0, "b"));
}

#[test]
fn a_thousand_games_of_random_against_greedy_end_without_error() {
    let records = batch(["random", "greedy"], 1000, 4).run(&|_| {}).unwrap();
    let summary = Summary::new(&["random".into(), "greedy".into()], &records);
    assert_eq!(summary.games, 1000);
    assert_eq!(summary.errors, 0);
    assert!(summary.losses > summary.wins);
}

#[test]
fn game_files_replay_to_their_ending() {
    let dir = std::env::temp_dir().join(format!("seks-bots-replay-{}", std::process::id()));
    let mut batch = batch(["greedy", "random"], 6, 2);
    batch.games_out = Some(dir.clone());
    let records = batch.run(&|_| {}).unwrap();
    for record in &records {
        let path = dir.join(format!("game-{:05}.json", record.game));
        let text = std::fs::read_to_string(&path).unwrap();
        let file: GameFile = serde_json::from_str(&text).unwrap();
        file.replay().unwrap();
        assert_eq!(file.end, record.end);
        assert_eq!(file.commands.len(), record.plies as usize);
        // A tampered ending is caught.
        let mut wrong = file.clone();
        wrong.winner = None;
        wrong.end = seks_bots::game_file::End::Repetition;
        assert!(wrong.replay().is_err());
    }
    std::fs::remove_dir_all(dir).unwrap();
}
