//! Batches of games between bots, played on threads, and their statistics.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use missoes_engine::{Game, Kind, Mission, Rules};

use crate::by_name;

pub struct Config {
    /// The names of the bots, one per player.
    pub bots: Vec<String>,
    /// Seeds; with rotation each seed is played once per seating, the bots
    /// shifted one seat each time.
    pub seeds: u64,
    pub first_seed: u64,
    pub rotate: bool,
    pub threads: usize,
    pub rules: Rules,
}

const KINDS: usize = Kind::ALL.len();
const MISSIONS: usize = Mission::ALL.len();

fn mission_index(mission: Mission) -> usize {
    Mission::ALL.iter().position(|&m| m == mission).unwrap()
}

/// One game, seen from the bots: every per-bot field is indexed by bot.
#[derive(Clone, Debug, Default)]
pub struct Record {
    /// The share of the win of each bot: 1 for a lone winner, split on a
    /// tie.
    pub wins: Vec<f64>,
    pub points: Vec<i32>,
    pub rounds: u16,
    pub stalled: bool,
    pub buys: Vec<u32>,
    pub sacrifices: Vec<u32>,
    /// Reserve dice cashed for money.
    pub cashed: Vec<u32>,
    /// Sabotages of each bot: `[paid with a point, paid with a die]`.
    pub sabotages: Vec<[u32; 2]>,
    /// Dice bought by each bot, by kind (in `Kind::ALL` order).
    pub bought: Vec<[u32; KINDS]>,
    /// Markers that ended on each mission (in `Mission::ALL` order).
    pub markers: [u32; MISSIONS],
    /// Points each mission gave.
    pub mission_points: [i64; MISSIONS],
    /// Times each mission was sabotaged.
    pub sabotaged: [u32; MISSIONS],
    /// The bots leading at half the game.
    pub leaders_at_half: Vec<usize>,
}

pub fn play(config: &Config, seed: u64, shift: usize) -> Result<Record, String> {
    let n = config.bots.len();
    // Player p is played by bot (p + shift) % n.
    let bot_of = |p: usize| (p + shift) % n;
    let mut players = (0..n)
        .map(|p| by_name(&config.bots[bot_of(p)], seed.wrapping_mul(31 + p as u64)))
        .collect::<Result<Vec<_>, _>>()?;
    let mut game = Game::new(
        Rules {
            players: n,
            ..config.rules
        },
        seed,
    );
    let mut record = Record {
        wins: vec![0.0; n],
        points: vec![0; n],
        buys: vec![0; n],
        sacrifices: vec![0; n],
        cashed: vec![0; n],
        sabotages: vec![[0; 2]; n],
        bought: vec![[0; KINDS]; n],
        ..Record::default()
    };
    let mut leaders = Vec::new();
    while !game.is_over() {
        let log = game.play_round(&mut players)?;
        leaders.push(game.leaders());
        for p in 0..n {
            let m = mission_index(log.missions[p]);
            record.markers[m] += 1;
            record.mission_points[m] += log.deltas[p] as i64;
            record.sacrifices[bot_of(p)] += log.sacrifices[p];
            record.cashed[bot_of(p)] += log.cashed[p];
            if let Some(kind) = log.bought[p] {
                let k = Kind::ALL.iter().position(|&x| x == kind).unwrap();
                record.buys[bot_of(p)] += 1;
                record.bought[bot_of(p)][k] += 1;
            }
        }
        for &(p, mission, by_point) in &log.sabotages {
            record.sabotages[bot_of(p)][usize::from(!by_point)] += 1;
            record.sabotaged[mission_index(mission)] += 1;
        }
    }
    record.rounds = game.round;
    record.stalled = game.round >= game.rules.max_rounds;
    let winners = game.winners();
    for &p in &winners {
        record.wins[bot_of(p)] = 1.0 / winners.len() as f64;
    }
    for p in 0..n {
        record.points[bot_of(p)] = game.points[p];
    }
    if let Some(half) = leaders.get(leaders.len() / 2) {
        record.leaders_at_half = half.iter().map(|&p| bot_of(p)).collect();
    }
    Ok(record)
}

/// Plays the batch on `config.threads` threads, in no fixed order.
pub fn run(config: &Config) -> Result<Vec<Record>, String> {
    for name in &config.bots {
        by_name(name, 0)?;
    }
    let n = config.bots.len() as u64;
    let shifts = if config.rotate { n } else { 1 };
    let jobs = config.seeds * shifts;
    let next = AtomicU64::new(0);
    let records = Mutex::new(Vec::new());
    let error = Mutex::new(None);
    std::thread::scope(|scope| {
        for _ in 0..config.threads.max(1) {
            scope.spawn(|| loop {
                let job = next.fetch_add(1, Ordering::Relaxed);
                if job >= jobs {
                    break;
                }
                let seed = config.first_seed + job / shifts;
                match play(config, seed, (job % shifts) as usize) {
                    Ok(record) => records.lock().unwrap().push(record),
                    Err(e) => *error.lock().unwrap() = Some(e),
                }
            });
        }
    });
    match error.into_inner().unwrap() {
        Some(e) => Err(e),
        None => Ok(records.into_inner().unwrap()),
    }
}

/// The text summary of a batch.
pub fn summary(config: &Config, records: &[Record]) -> String {
    use std::fmt::Write;
    let mut out = String::new();
    let n = config.bots.len();
    let games = records.len().max(1) as f64;
    let pct = |x: f64| 100.0 * x / games;
    let sum = |f: &dyn Fn(&Record) -> f64| records.iter().map(f).sum::<f64>();
    let stalled = records.iter().filter(|r| r.stalled).count();
    let _ = writeln!(
        out,
        "{} games ({stalled} stalled), {:?}",
        records.len(),
        Rules {
            players: n,
            ..config.rules
        }
    );
    for (bot, name) in config.bots.iter().enumerate() {
        let _ = writeln!(
            out,
            "  bot {bot} {name:<10} wins {:5.1}%  points {:5.1}  buys {:4.1}  cashed {:4.1}  sacrifices {:4.1}  sabotages {:.2} by point, {:.2} by die",
            pct(sum(&|r| r.wins[bot])),
            sum(&|r| r.points[bot] as f64) / games,
            sum(&|r| r.buys[bot] as f64) / games,
            sum(&|r| r.cashed[bot] as f64) / games,
            sum(&|r| r.sacrifices[bot] as f64) / games,
            sum(&|r| r.sabotages[bot][0] as f64) / games,
            sum(&|r| r.sabotages[bot][1] as f64) / games,
        );
    }
    let mut rounds: Vec<u16> = records.iter().map(|r| r.rounds).collect();
    rounds.sort_unstable();
    let at = |q: f64| rounds[((rounds.len() - 1) as f64 * q) as usize];
    let total_rounds = sum(&|r| r.rounds as f64);
    let _ = writeln!(
        out,
        "  rounds: mean {:.1}, p10 {}, median {}, p90 {}",
        total_rounds / games,
        at(0.1),
        at(0.5),
        at(0.9)
    );
    let ties = records
        .iter()
        .filter(|r| r.wins.iter().filter(|&&w| w > 0.0).count() > 1)
        .count();
    let half = sum(&|r| {
        if r.leaders_at_half.is_empty() {
            return 0.0;
        }
        r.leaders_at_half.iter().map(|&b| r.wins[b]).sum::<f64>() / r.leaders_at_half.len() as f64
    });
    let _ = writeln!(
        out,
        "  ties {:.1}%, leader at half the game wins {:.1}%",
        pct(ties as f64),
        pct(half)
    );
    let markers: f64 = sum(&|r| r.markers.iter().map(|&m| m as f64).sum::<f64>());
    let _ = write!(
        out,
        "  missions (% of markers, points per marker, sabotages per game):"
    );
    for (m, mission) in Mission::ALL.iter().enumerate() {
        let count = sum(&|r| r.markers[m] as f64);
        let points = sum(&|r| r.mission_points[m] as f64);
        let _ = write!(
            out,
            " {} {:.1}% {:.2} {:.2};",
            mission.name(),
            100.0 * count / markers.max(1.0),
            points / count.max(1.0),
            sum(&|r| r.sabotaged[m] as f64) / games
        );
    }
    let _ = writeln!(out);
    for (bot, name) in config.bots.iter().enumerate() {
        let _ = write!(out, "  bought by bot {bot} {name}, per game:");
        for (k, kind) in Kind::ALL.iter().enumerate() {
            let count = sum(&|r| r.bought[bot][k] as f64);
            if count > 0.0 {
                let _ = write!(out, " {} {:.2}", kind.name(), count / games);
            }
        }
        let _ = writeln!(out);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(bots: &[&str]) -> Config {
        Config {
            bots: bots.iter().map(|&b| b.into()).collect(),
            seeds: 10,
            first_seed: 1,
            rotate: true,
            threads: 2,
            rules: Rules::default(),
        }
    }

    #[test]
    fn every_bot_plays_legal_games_to_the_end() {
        for bots in [
            &["random", "greedy"][..],
            &["nobuy", "nosabotage", "random", "greedy"],
        ] {
            let records = run(&config(bots)).unwrap();
            assert_eq!(records.len(), 10 * bots.len());
            for r in &records {
                assert!(!r.stalled);
                assert!((r.wins.iter().sum::<f64>() - 1.0).abs() < 1e-9);
            }
        }
    }

    #[test]
    fn greedy_beats_random() {
        let records = run(&config(&["greedy", "random"])).unwrap();
        let wins: f64 = records.iter().map(|r| r.wins[0]).sum();
        assert!(wins > 15.0, "{wins}");
    }
}
