//! Batches of games between bots, in threads.
//!
//! Each seed is one deal (the stones and the dice of the generator). With
//! rotation, a seed is played once per seat order: the two bots swap
//! seats, so each plays both seats of the same deal.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Instant;

use serde::Serialize;
use sia_engine::{Command, EndReason, Event, FormationKind, GameState, DEFAULT_HAND_SIZE};

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
    /// Dice in a hand at the start; the rules say 7.
    pub hand_size: u8,
}

impl Config {
    pub fn new(bots: Vec<String>) -> Config {
        Config {
            bots,
            seeds: 100,
            first_seed: 0,
            rotate: true,
            threads: crate::DEFAULT_THREADS,
            hand_size: DEFAULT_HAND_SIZE,
        }
    }

    pub fn games(&self) -> usize {
        self.seeds * if self.rotate { self.bots.len() } else { 1 }
    }
}

/// A stone taken by a claim.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct ClaimRecord {
    pub seat: usize,
    pub turn: u16,
    /// Index of the formation kind, 0 (sum) to 7 (straight flush).
    pub kind: usize,
    pub sum: u8,
    /// The claim was a proof against an incomplete side.
    pub proven: bool,
}

/// A reroll.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct RerollRecord {
    pub seat: usize,
    pub turn: u16,
    /// The hand rolled was the other player's.
    pub other: bool,
    /// Dice lost before this reroll.
    pub lost_before: u8,
    /// Dice rolled.
    pub rolled: usize,
}

/// One game, as a line of the JSONL file.
#[derive(Clone, Debug, Serialize)]
pub struct Record {
    pub seed: u64,
    pub rotation: usize,
    /// The spec at each seat.
    pub bots: Vec<String>,
    /// The seat that played first.
    pub first: usize,
    pub winners: Vec<usize>,
    /// Stones of each seat at the end.
    pub stones: Vec<usize>,
    pub turns: u16,
    pub commands: u32,
    /// `stones`, `neighbors` or `noRoom`.
    pub end: &'static str,
    pub claims: Vec<ClaimRecord>,
    /// Kind of the formation of each stone won at the end by lack of room.
    pub awards: Vec<usize>,
    /// Kind of every complete side at the end, taken or not.
    pub sides: Vec<usize>,
    pub rerolls: Vec<RerollRecord>,
    /// Dice lost by each seat.
    pub lost: Vec<u8>,
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
pub fn play(bots: &[String], seed: u64, rotation: usize, hand_size: u8) -> Result<Record, String> {
    let mut players = bots
        .iter()
        .map(|spec| by_name(spec))
        .collect::<Result<Vec<_>, _>>()?;
    let (mut state, _) = GameState::with_hand_size(hand_size, seed);
    let first = state.to_move();
    let mut spent = vec![(0.0, 0.0, 0u32); bots.len()];
    let mut commands = 0;
    let mut claims = Vec::new();
    let mut awards = Vec::new();
    let mut rerolls = Vec::new();
    while !state.is_over() {
        let seat = state.to_move();
        let turn = state.turn();
        let started = Instant::now();
        let command = players[seat].choose(&state, derive(seed, u64::from(commands)));
        let ms = started.elapsed().as_secs_f64() * 1000.0;
        let (total, max, count) = &mut spent[seat];
        *total += ms;
        *max = f64::max(*max, ms);
        *count += 1;
        let lost_before = state.player(seat).lost;
        let (next, events) = state
            .apply(command)
            .map_err(|e| format!("{} played {command:?}: {e}", bots[seat]))?;
        for event in events {
            match event {
                Event::Claimed {
                    player,
                    formation,
                    proven,
                    ..
                } => claims.push(ClaimRecord {
                    seat: player,
                    turn,
                    kind: formation.kind.index(),
                    sum: formation.sum,
                    proven,
                }),
                Event::Awarded {
                    stone,
                    player: Some(player),
                } => {
                    awards.push(
                        next.formation_of(player, stone)
                            .map_or(0, |f| f.kind.index()),
                    );
                }
                Event::Rerolled { target, rolled, .. } => rerolls.push(RerollRecord {
                    seat,
                    turn,
                    other: target != seat,
                    lost_before,
                    rolled: rolled.len(),
                }),
                _ => {}
            }
        }
        debug_assert!(!matches!(command, Command::Pass) || state.open_stones(seat).is_empty());
        state = next;
        commands += 1;
    }
    let sides = (0..2)
        .flat_map(|p| (0..sia_engine::STONES).map(move |s| (p, s)))
        .filter_map(|(p, s)| state.formation_of(p, s).map(|f| f.kind.index()))
        .collect();
    Ok(Record {
        seed,
        rotation,
        bots: bots.to_vec(),
        first,
        winners: state.winners().expect("the game is over"),
        stones: (0..2).map(|p| state.stones_of(p)).collect(),
        turns: state.turn(),
        commands,
        end: match state.end().expect("the game is over") {
            EndReason::Stones { .. } => "stones",
            EndReason::Neighbors { .. } => "neighbors",
            EndReason::NoRoom => "noRoom",
        },
        claims,
        awards,
        sides,
        rerolls,
        lost: (0..2).map(|p| state.player(p).lost).collect(),
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
                match play(&bots, seed, rotation, config.hand_size) {
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
    /// Stones at the end.
    pub stones: f64,
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
                    s.stones += record.stones[seat] as f64;
                    ms += record.mean_ms[seat];
                    s.max_ms = s.max_ms.max(record.max_ms[seat]);
                }
            }
            let seats = s.seats.max(1) as f64;
            s.stones /= seats;
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

/// A text report of a batch: how the games end, how long they last, the
/// first player, the formations of the stones and the rerolls.
pub fn report(records: &[Record]) -> String {
    use std::fmt::Write;
    let n = records.len() as f64;
    let mut out = String::new();
    let count = |end: &str| records.iter().filter(|r| r.end == end).count();
    let turns: Vec<f64> = records.iter().map(|r| f64::from(r.turns)).collect();
    let mean = turns.iter().sum::<f64>() / n;
    let mut sorted = turns.clone();
    sorted.sort_by(f64::total_cmp);
    let _ = writeln!(
        out,
        "ends: stones {} ({:.1}%), neighbors {} ({:.1}%), noRoom {} ({:.1}%)",
        count("stones"),
        100.0 * count("stones") as f64 / n,
        count("neighbors"),
        100.0 * count("neighbors") as f64 / n,
        count("noRoom"),
        100.0 * count("noRoom") as f64 / n,
    );
    let _ = writeln!(
        out,
        "turns: mean {:.1}, median {}, p10 {}, p90 {}, max {}; commands {:.1}",
        mean,
        sorted[sorted.len() / 2],
        sorted[sorted.len() / 10],
        sorted[sorted.len() * 9 / 10],
        sorted[sorted.len() - 1],
        records.iter().map(|r| f64::from(r.commands)).sum::<f64>() / n,
    );
    let first_wins: f64 = records.iter().map(|r| r.share(r.first)).sum();
    let (low, high) = crate::stats::wilson(first_wins.round() as u64, records.len() as u64);
    let _ = writeln!(
        out,
        "first player wins {:.1}% [{:.1}, {:.1}]",
        100.0 * first_wins / n,
        100.0 * low,
        100.0 * high
    );
    let _ = writeln!(out, "formation          claims  (proven)  awards   sides");
    let total = |f: &dyn Fn(&Record) -> Vec<usize>, kind: usize| -> usize {
        records
            .iter()
            .map(|r| f(r).iter().filter(|&&k| k == kind).count())
            .sum()
    };
    let claims_all: usize = records.iter().map(|r| r.claims.len()).sum();
    let awards_all: usize = records.iter().map(|r| r.awards.len()).sum();
    let sides_all: usize = records.iter().map(|r| r.sides.len()).sum();
    for kind in (0..FormationKind::ALL.len()).rev() {
        let claims = total(&|r| r.claims.iter().map(|c| c.kind).collect(), kind);
        let proven = records
            .iter()
            .map(|r| {
                r.claims
                    .iter()
                    .filter(|c| c.kind == kind && c.proven)
                    .count()
            })
            .sum::<usize>();
        let awards = total(&|r| r.awards.clone(), kind);
        let sides = total(&|r| r.sides.clone(), kind);
        let pct = |k: usize, all: usize| 100.0 * k as f64 / all.max(1) as f64;
        let _ = writeln!(
            out,
            "{:<16} {:>6.1}%  {:>6.1}%  {:>6.1}%  {:>6.1}%",
            format!("{:?}", FormationKind::ALL[kind]),
            pct(claims, claims_all),
            pct(proven, claims),
            pct(awards, awards_all),
            pct(sides, sides_all),
        );
    }
    let _ = writeln!(
        out,
        "claims per game {:.2} ({:.0}% proven), awards at the end {:.2}",
        claims_all as f64 / n,
        100.0
            * records
                .iter()
                .map(|r| r.claims.iter().filter(|c| c.proven).count())
                .sum::<usize>() as f64
            / claims_all.max(1) as f64,
        awards_all as f64 / n,
    );
    let all: Vec<&RerollRecord> = records.iter().flat_map(|r| &r.rerolls).collect();
    let own = all.iter().filter(|r| !r.other).count();
    let rolled = all.iter().map(|r| r.rolled).sum::<usize>();
    let _ = writeln!(
        out,
        "rerolls per game {:.2}: own hand {:.2}, other hand {:.2}; {:.2} dice rolled each; dice lost per game {:.2}",
        all.len() as f64 / n,
        own as f64 / n,
        (all.len() - own) as f64 / n,
        rolled as f64 / all.len().max(1) as f64,
        records.iter().map(|r| r.lost.iter().map(|&l| f64::from(l)).sum::<f64>()).sum::<f64>() / n,
    );
    let mut by_lost = [0usize; 10];
    for r in &all {
        by_lost[r.lost_before as usize] += 1;
    }
    let _ = writeln!(out, "rerolls by dice already lost: {:?}", &by_lost[..5]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rotation_seats_every_bot_in_both_seats() {
        let config = Config {
            seeds: 3,
            first_seed: 10,
            threads: 2,
            ..Config::new(vec!["greedy".into(), "random".into()])
        };
        let records = run(&config, &|_| {}).unwrap();
        assert_eq!(records.len(), 6);
        for (i, record) in records.iter().enumerate() {
            assert_eq!(record.seed, 10 + (i / 2) as u64);
            assert_eq!(record.bots[i % 2], "greedy");
        }
        let summaries = summarize(&config.bots, &records);
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].seats, 6);
        let shares: f64 = summaries.iter().map(|s| s.wins).sum();
        assert!((shares - 6.0).abs() < 1e-9);
        assert!(report(&records).contains("first player wins"));
    }

    #[test]
    fn the_hand_size_is_played() {
        let config = Config {
            seeds: 2,
            threads: 1,
            hand_size: 6,
            ..Config::new(vec!["random".into(), "random".into()])
        };
        assert_eq!(run(&config, &|_| {}).unwrap().len(), 4);
    }
}
