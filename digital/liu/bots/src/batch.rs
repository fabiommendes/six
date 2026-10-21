//! Batches of games between bots, in threads.
//!
//! Each seed is one deal (the seals and the dice of the generator). With
//! rotation, a seed is played once per seat order: the bots shift one seat
//! at a time, so every bot plays every seat of the same deal.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Instant;

use liu_engine::{EndReason, GameState};
use serde::Serialize;

use crate::bot::by_name;
use crate::rng::derive;
use crate::stats::Tally;

/// What to play.
#[derive(Clone, Debug)]
pub struct Config {
    /// One spec per seat.
    pub bots: Vec<String>,
    /// Deals.
    pub seeds: usize,
    pub first_seed: u64,
    /// Plays every deal once per seat order.
    pub rotate: bool,
    pub threads: usize,
}

impl Config {
    pub fn games(&self) -> usize {
        self.seeds * if self.rotate { self.bots.len() } else { 1 }
    }
}

/// One game, as a line of the JSONL file.
#[derive(Clone, Debug, Serialize)]
pub struct Record {
    pub seed: u64,
    pub rotation: usize,
    /// The spec at each seat.
    pub bots: Vec<String>,
    pub winners: Vec<usize>,
    pub points: Vec<u8>,
    pub dice: Vec<u8>,
    pub rounds: u16,
    pub commands: u32,
    /// `windowComplete` or `noPlacement`.
    pub end: &'static str,
    /// Milliseconds per decision of each seat: mean and maximum.
    pub mean_ms: Vec<f64>,
    pub max_ms: Vec<f64>,
}

impl Record {
    /// The share of the win of `seat`: 1 / winners, or 0.
    pub fn share(&self, seat: usize) -> f64 {
        if self.winners.contains(&seat) {
            1.0 / self.winners.len() as f64
        } else {
            0.0
        }
    }
}

/// Plays one game with `bots` at the seats.
pub fn play(bots: &[String], seed: u64, rotation: usize) -> Result<Record, String> {
    let mut players = bots
        .iter()
        .map(|spec| by_name(spec))
        .collect::<Result<Vec<_>, _>>()?;
    let (mut state, _) = GameState::new(bots.len(), seed);
    let mut spent = vec![(0.0, 0.0, 0u32); bots.len()];
    let mut commands = 0;
    while !state.is_over() {
        let seat = state.to_move();
        let started = Instant::now();
        let command = players[seat].choose(&state, derive(seed, u64::from(commands)));
        let ms = started.elapsed().as_secs_f64() * 1000.0;
        let (total, max, count) = &mut spent[seat];
        *total += ms;
        *max = f64::max(*max, ms);
        *count += 1;
        state = state
            .apply(command)
            .map_err(|e| format!("{} played an illegal command: {e}", bots[seat]))?
            .0;
        commands += 1;
    }
    let scores = state.scores();
    Ok(Record {
        seed,
        rotation,
        bots: bots.to_vec(),
        winners: state.winners().expect("the game is over"),
        points: scores.iter().map(|s| s.points).collect(),
        dice: scores.iter().map(|s| s.dice).collect(),
        rounds: state.round(),
        commands,
        end: match state.end().expect("the game is over") {
            EndReason::WindowComplete { .. } => "windowComplete",
            EndReason::NoPlacement => "noPlacement",
        },
        mean_ms: spent
            .iter()
            .map(|&(total, _, n)| total / f64::from(n.max(1)))
            .collect(),
        max_ms: spent.iter().map(|&(_, max, _)| max).collect(),
    })
}

/// Plays the batch; `done` sees every record as it finishes, in any order.
/// Returns the records in the order of the games.
pub fn run(config: &Config, done: &(dyn Fn(&Record) + Sync)) -> Result<Vec<Record>, String> {
    for spec in &config.bots {
        by_name(spec)?;
    }
    let n = config.bots.len();
    let rotations = if config.rotate { n } else { 1 };
    let games = config.games();
    let next = AtomicUsize::new(0);
    let records = Mutex::new(vec![None; games]);
    let failure = Mutex::new(None);
    std::thread::scope(|scope| {
        for _ in 0..config.threads.max(1) {
            scope.spawn(|| loop {
                let game = next.fetch_add(1, Ordering::Relaxed);
                if game >= games || failure.lock().unwrap().is_some() {
                    return;
                }
                let (deal, rotation) = (game / rotations, game % rotations);
                let seed = config.first_seed + deal as u64;
                let bots: Vec<String> = (0..n)
                    .map(|seat| config.bots[(seat + n - rotation) % n].clone())
                    .collect();
                match play(&bots, seed, rotation) {
                    Ok(record) => {
                        done(&record);
                        records.lock().unwrap()[game] = Some(record);
                    }
                    Err(error) => *failure.lock().unwrap() = Some(error),
                }
            });
        }
    });
    if let Some(error) = failure.into_inner().unwrap() {
        return Err(error);
    }
    Ok(records
        .into_inner()
        .unwrap()
        .into_iter()
        .flatten()
        .collect())
}

/// Totals of one spec over its seats in a batch.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Summary {
    pub spec: String,
    pub seats: usize,
    /// Sum of the shares of the win.
    pub wins: f64,
    pub points: f64,
    pub dice: f64,
    pub mean_ms: f64,
    pub max_ms: f64,
}

/// One summary per distinct spec, in the order of `bots`.
pub fn summarize(bots: &[String], records: &[Record]) -> Vec<Summary> {
    let mut specs: Vec<&String> = Vec::new();
    for spec in bots {
        if !specs.contains(&spec) {
            specs.push(spec);
        }
    }
    specs
        .into_iter()
        .map(|spec| {
            let mut s = Summary {
                spec: spec.clone(),
                ..Summary::default()
            };
            let mut ms = 0.0;
            for record in records {
                for seat in (0..record.bots.len()).filter(|&i| &record.bots[i] == spec) {
                    s.seats += 1;
                    s.wins += record.share(seat);
                    s.points += f64::from(record.points[seat]);
                    s.dice += f64::from(record.dice[seat]);
                    ms += record.mean_ms[seat];
                    s.max_ms = s.max_ms.max(record.max_ms[seat]);
                }
            }
            let seats = s.seats.max(1) as f64;
            s.points /= seats;
            s.dice /= seats;
            s.mean_ms = ms / seats;
            s
        })
        .collect()
}

/// Wins, draws (a shared win) and losses of the bot at the seats with
/// `spec` against the others, in games of 2 players.
pub fn tally(spec: &str, records: &[Record]) -> Tally {
    let mut tally = Tally::default();
    for record in records.iter().filter(|r| r.bots.len() == 2) {
        let Some(seat) = record.bots.iter().position(|b| b == spec) else {
            continue;
        };
        if record.bots[1 - seat] == spec {
            continue;
        }
        match record.share(seat) {
            1.0 => tally.wins += 1,
            s if s > 0.0 => tally.draws += 1,
            _ => tally.losses += 1,
        }
    }
    tally
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rotation_seats_every_bot_everywhere() {
        let config = Config {
            bots: vec!["greedy".into(), "random".into(), "random".into()],
            seeds: 2,
            first_seed: 10,
            rotate: true,
            threads: 2,
        };
        let records = run(&config, &|_| {}).unwrap();
        assert_eq!(records.len(), 6);
        for (i, record) in records.iter().enumerate() {
            assert_eq!(record.seed, 10 + (i / 3) as u64);
            assert_eq!(record.bots[i % 3], "greedy");
        }
        let summaries = summarize(&config.bots, &records);
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].seats, 6);
        assert_eq!(summaries[1].seats, 12);
        let shares: f64 = summaries.iter().map(|s| s.wins).sum();
        assert!((shares - 6.0).abs() < 1e-9);
    }
}
