//! Batches of games between two bots, played on threads, and their
//! statistics.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use shesh_engine::{EndReason, Event, GameState, Rules, PLAYERS};

use crate::by_name;

/// Games longer than this are counted as stalled and dropped.
pub const MAX_TURNS: u16 = 3_000;

pub struct Config {
    /// The names of the two bots.
    pub bots: [String; 2],
    /// Seeds; with rotation each seed is played twice, with the bots
    /// swapped.
    pub seeds: u64,
    pub first_seed: u64,
    pub rotate: bool,
    pub threads: usize,
    pub rules: Rules,
}

/// One game, seen from the bots: `seat[bot]` is the player the bot played.
#[derive(Clone, Debug, Default)]
pub struct Record {
    pub seed: u64,
    pub seat: [usize; 2],
    /// The player who moved first.
    pub first: usize,
    /// `None` when the game stalled.
    pub end: Option<EndReason>,
    pub turns: u16,
    pub points: [u8; PLAYERS],
    /// The most dice a player had in play at once (board and reserve).
    pub max_dice: [u8; PLAYERS],
    pub captures: u32,
    pub wears: u32,
    /// Points worn away for good.
    pub worn_away: u32,
    pub touches: u32,
    pub fusions: u32,
    /// Points that went over 6 in a fusion.
    pub fused_away: u32,
    pub extra_turns: u32,
    pub extra_by_player: [u32; PLAYERS],
    pub passes: u32,
    /// Captures by the value of the eating die before it ate.
    pub captures_by_value: [u32; 7],
    /// Wears by the value of the wearing die.
    pub wears_by_value: [u32; 7],
}

pub fn play(config: &Config, seed: u64, swapped: bool) -> Result<Record, String> {
    let bot_at = |player: usize| usize::from(swapped) ^ player;
    let mut bots = [
        by_name(&config.bots[bot_at(0)], seed.wrapping_mul(31))?,
        by_name(&config.bots[bot_at(1)], seed.wrapping_mul(37))?,
    ];
    let mut state = GameState::with_rules(config.rules, seed);
    let mut record = Record {
        seed,
        seat: [bot_at(0), bot_at(1)],
        first: state.to_move(),
        ..Record::default()
    };
    while state.end().is_none() && state.turn() < MAX_TURNS {
        let command = bots[state.to_move()].choose(&state);
        let (next, events) = state.apply(command).map_err(|e| e.to_string())?;
        for event in events {
            match event {
                Event::Captured { value, taken, .. } => {
                    record.captures += 1;
                    record.captures_by_value[(value + taken - 1) as usize] += 1;
                }
                Event::Worn { value, .. } => {
                    record.wears += 1;
                    record.worn_away += u32::from(value);
                    record.wears_by_value[value as usize] += 1;
                }
                Event::Touched { .. } => record.touches += 1,
                Event::Fused { lost, .. } => {
                    record.fusions += 1;
                    record.fused_away += u32::from(lost);
                }
                Event::ExtraTurn { player } => {
                    record.extra_turns += 1;
                    record.extra_by_player[player] += 1;
                }
                Event::Passed { .. } => record.passes += 1,
                _ => {}
            }
        }
        state = next;
        for player in 0..PLAYERS {
            record.max_dice[player] = record.max_dice[player].max(state.dice(player));
        }
    }
    record.end = state.end();
    record.turns = state.turn();
    record.points = [state.points(0), state.points(1)];
    Ok(record)
}

/// Plays the batch on `config.threads` threads, in no fixed order.
pub fn run(config: &Config) -> Result<Vec<Record>, String> {
    for name in &config.bots {
        by_name(name, 0)?;
    }
    let jobs = config.seeds * if config.rotate { 2 } else { 1 };
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
                let (seed, swapped) = if config.rotate {
                    (config.first_seed + job / 2, job % 2 == 1)
                } else {
                    (config.first_seed + job, false)
                };
                match play(config, seed, swapped) {
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
    let ended: Vec<&Record> = records.iter().filter(|r| r.end.is_some()).collect();
    let n = ended.len().max(1) as f64;
    let rate = |count: usize| 100.0 * count as f64 / n;
    let _ = writeln!(
        out,
        "{} games ({} stalled), rules {:?}",
        records.len(),
        records.len() - ended.len(),
        config.rules
    );
    for (bot, name) in config.bots.iter().enumerate() {
        let wins = ended
            .iter()
            .filter(|r| r.end.unwrap().winner() == r.seat[bot])
            .count();
        let home = ended
            .iter()
            .filter(|r| {
                r.end
                    == Some(EndReason::AllHome {
                        player: r.seat[bot],
                    })
            })
            .count();
        let _ = writeln!(
            out,
            "  bot {bot} {name:<8} wins {:5.1}% ({:5.1}% by all dice home)",
            rate(wins),
            rate(home)
        );
    }
    let first_wins = ended
        .iter()
        .filter(|r| r.end.unwrap().winner() == r.first)
        .count();
    let by_points = ended
        .iter()
        .filter(|r| matches!(r.end, Some(EndReason::Points { .. })))
        .count();
    let _ = writeln!(out, "first player wins {:5.1}%", rate(first_wins));
    let uneven: Vec<&&Record> = ended
        .iter()
        .filter(|r| r.extra_by_player[0] != r.extra_by_player[1])
        .collect();
    let more_extra = uneven
        .iter()
        .filter(|r| {
            let winner = r.end.unwrap().winner();
            r.extra_by_player[winner] > r.extra_by_player[1 - winner]
        })
        .count();
    if !uneven.is_empty() {
        let _ = writeln!(
            out,
            "player with more extra turns wins {:5.1}% of {} games",
            100.0 * more_extra as f64 / uneven.len() as f64,
            uneven.len()
        );
    }
    let _ = writeln!(
        out,
        "end by 10 points {:5.1}%, by all dice home {:5.1}%",
        rate(by_points),
        rate(ended.len() - by_points)
    );
    let mut turns: Vec<u16> = ended.iter().map(|r| r.turns).collect();
    turns.sort_unstable();
    let at = |q: f64| {
        turns
            .get(((turns.len() as f64 - 1.0) * q) as usize)
            .copied()
            .unwrap_or(0)
    };
    let _ = writeln!(
        out,
        "turns: mean {:.1}, p10 {}, median {}, p90 {}, max {}",
        turns.iter().map(|&t| f64::from(t)).sum::<f64>() / n,
        at(0.1),
        at(0.5),
        at(0.9),
        at(1.0)
    );
    let mean = |f: &dyn Fn(&Record) -> f64| ended.iter().map(|r| f(r)).sum::<f64>() / n;
    let _ = writeln!(
        out,
        "per game: captures {:.1}, wears {:.1} (points worn {:.1}), touches {:.1}, fusions {:.1} (points over 6 {:.1}), extra turns {:.1}, passes {:.1}",
        mean(&|r| f64::from(r.captures)),
        mean(&|r| f64::from(r.wears)),
        mean(&|r| f64::from(r.worn_away)),
        mean(&|r| f64::from(r.touches)),
        mean(&|r| f64::from(r.fusions)),
        mean(&|r| f64::from(r.fused_away)),
        mean(&|r| f64::from(r.extra_turns)),
        mean(&|r| f64::from(r.passes)),
    );
    let _ = writeln!(
        out,
        "points at the end: winner {:.1}, loser {:.1}",
        mean(&|r| f64::from(r.points[r.end.unwrap().winner()])),
        mean(&|r| f64::from(r.points[1 - r.end.unwrap().winner()])),
    );
    let max_dice = ended.iter().flat_map(|r| r.max_dice).max().unwrap_or(0);
    let mut dice_hist = [0usize; 32];
    for r in &ended {
        for d in r.max_dice {
            dice_hist[(d as usize).min(31)] += 1;
        }
    }
    let p99 = {
        let total: usize = dice_hist.iter().sum();
        let mut seen = 0;
        dice_hist
            .iter()
            .position(|&c| {
                seen += c;
                seen * 100 >= total * 99
            })
            .unwrap_or(0)
    };
    let _ = writeln!(out, "dice of one player in play: max {max_dice}, p99 {p99}");
    let sum = |f: &dyn Fn(&Record) -> [u32; 7]| {
        ended.iter().fold([0u32; 7], |mut acc, r| {
            for (a, b) in acc.iter_mut().zip(f(r)) {
                *a += b;
            }
            acc
        })
    };
    let _ = writeln!(
        out,
        "captures by eater value 1-6: {:?}",
        &sum(&|r| r.captures_by_value)[1..]
    );
    let _ = writeln!(
        out,
        "wears by wearer value 1-6:   {:?}",
        &sum(&|r| r.wears_by_value)[1..]
    );
    out
}
