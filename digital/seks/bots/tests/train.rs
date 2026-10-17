//! Training steps: self-play is reproducible (R5 of
//! `dev/issues/bots-do-seks.md`), and tuning lowers the loss.

use std::num::NonZeroUsize;

use seks_bots::eval::Weights;
use seks_bots::openings::generate;
use seks_bots::train::dataset;
use seks_bots::train::selfplay::SelfPlay;
use seks_bots::train::tune::{tune, Tune};

fn selfplay(threads: usize) -> Vec<u8> {
    let run = SelfPlay {
        bot: "ab:nodes=800,tt=1".into(),
        openings: generate(4, 6, 9, |_| true),
        games: 12,
        seed: 3,
        threads: NonZeroUsize::new(threads).unwrap(),
        noise: 40,
        noise_plies: 6,
        max_plies: 400,
        first_game: 0,
    };
    let mut bytes = Vec::new();
    let produced = run.run(&mut bytes, &|_| {}).unwrap();
    assert_eq!(produced.games, 12);
    bytes
}

#[test]
fn the_same_settings_and_seed_write_the_same_data_with_any_threads() {
    let one = selfplay(1);
    assert_eq!(one, selfplay(3));
    let samples = dataset::read(&mut one.as_slice()).unwrap();
    assert!(samples.len() > 12 * 10);
    // Each game is numbered, in order.
    assert_eq!(samples[0].game, 0);
    assert_eq!(samples.last().unwrap().game, 11);
}

#[test]
fn tuning_does_not_worsen_the_validation_loss() {
    let bytes = selfplay(4);
    let samples = dataset::read(&mut bytes.as_slice()).unwrap();
    let settings = Tune {
        epochs: 30,
        patience: 30,
        threads: NonZeroUsize::new(2).unwrap(),
        ..Tune::default()
    };
    let (weights, report) = tune(&samples, &Weights::hand(), &settings, &mut |_, _, _| {}).unwrap();
    assert!(report.validation_loss <= report.validation_loss_before);
    assert!(report.k > 0.0);
    let read = Weights::from_json(&weights.to_json()).unwrap();
    assert!(read
        .values
        .iter()
        .zip(&weights.values)
        .all(|(a, b)| (a - b).abs() <= 0.005));
}
