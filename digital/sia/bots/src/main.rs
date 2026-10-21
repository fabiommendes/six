//! `sia-bots`: batches between bots of Sia.
//!
//! ```text
//! sia-bots batch --bots A,B [--games G] [--seed S] [--hand-size N]
//!                [--no-rotate] [--threads T] [--out FILE.jsonl]
//! ```
//!
//! `--bots` takes the two specs (see `sia_bots::by_name`), comma separated
//! (a `key=value` piece belongs to the spec before it); with one spec, both
//! seats play it. `--games` counts deals: with rotation (the default) each
//! deal is played twice, with the seats swapped. `--hand-size` changes the
//! dice in a hand (7 by default) for experiments. The summary goes to the
//! standard output; `--out` writes one JSON line per game.

use std::io::Write;
use std::sync::Mutex;

use sia_bots::batch::{self, Config};
use sia_bots::DEFAULT_THREADS;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("batch") => run_batch(&args[1..]),
        _ => Err("usage: sia-bots batch --bots A,B [--games G] [--seed S] [--hand-size N] [--no-rotate] [--threads T] [--out FILE]".into()),
    };
    if let Err(error) = result {
        eprintln!("sia-bots: {error}");
        std::process::exit(1);
    }
}

/// The specs of `--bots`: comma separated, where a `key=value` piece
/// belongs to the spec before it (`pimc:turns=8,temp=1,greedy`).
fn split_bots(text: &str) -> Vec<String> {
    let mut bots: Vec<String> = Vec::new();
    for piece in text.split(',') {
        let argument = piece.contains('=') && !piece.contains(':') && !piece.starts_with('@');
        match bots.last_mut() {
            Some(last) if argument => {
                last.push(',');
                last.push_str(piece);
            }
            _ => bots.push(piece.to_string()),
        }
    }
    bots
}

fn value<'a>(args: &'a [String], i: &mut usize, flag: &str) -> Result<&'a str, String> {
    *i += 1;
    args.get(*i)
        .map(String::as_str)
        .ok_or(format!("{flag} needs a value"))
}

fn number<T: std::str::FromStr>(text: &str, flag: &str) -> Result<T, String> {
    text.parse()
        .map_err(|_| format!("{flag}: bad number {text:?}"))
}

fn run_batch(args: &[String]) -> Result<(), String> {
    let mut bots: Vec<String> = Vec::new();
    let mut config = Config::new(Vec::new());
    config.threads =
        DEFAULT_THREADS.min(std::thread::available_parallelism().map_or(1, |n| n.get()));
    let mut out = None;
    let mut i = 0;
    while i < args.len() {
        let flag = args[i].as_str();
        match flag {
            "--bots" => bots = split_bots(value(args, &mut i, flag)?),
            "--games" => config.seeds = number(value(args, &mut i, flag)?, flag)?,
            "--seed" => config.first_seed = number(value(args, &mut i, flag)?, flag)?,
            "--threads" => config.threads = number(value(args, &mut i, flag)?, flag)?,
            "--hand-size" => config.hand_size = number(value(args, &mut i, flag)?, flag)?,
            "--out" => out = Some(value(args, &mut i, flag)?.to_string()),
            "--no-rotate" => config.rotate = false,
            _ => return Err(format!("unknown flag {flag:?}")),
        }
        i += 1;
    }
    if bots.is_empty() || bots.len() > 2 {
        return Err("--bots takes one or two specs".into());
    }
    if !sia_engine::HAND_SIZES.contains(&config.hand_size) {
        return Err(format!("--hand-size {} outside 2 to 10", config.hand_size));
    }
    if bots.len() == 1 {
        bots.push(bots[0].clone());
    }
    config.bots = bots;
    let file = match &out {
        Some(path) => Some(Mutex::new(
            std::fs::File::create(path).map_err(|e| format!("{path}: {e}"))?,
        )),
        None => None,
    };
    let records = batch::run(&config, &|record| {
        if let Some(file) = &file {
            let line = serde_json::to_string(record).expect("records serialize");
            writeln!(file.lock().unwrap(), "{line}").expect("the output file is writable");
        }
    })?;
    println!("{} games, hand of {}", records.len(), config.hand_size);
    print!("{}", batch::report(&records));
    for s in batch::summarize(&config.bots, &records) {
        let (low, high) = sia_bots::stats::wilson(s.wins.round() as u64, s.seats as u64);
        println!(
            "{}: {} seats, wins {:.1} ({:.1}% [{:.1}, {:.1}]), {:.2} stones, {:.2} ms per decision (max {:.1})",
            s.spec,
            s.seats,
            s.wins,
            100.0 * s.wins / s.seats as f64,
            100.0 * low,
            100.0 * high,
            s.stones,
            s.mean_ms,
            s.max_ms,
        );
    }
    if config.bots[0] != config.bots[1] {
        let tally = batch::tally(&config.bots[0], &records);
        let (low, high) = tally.elo_interval();
        println!(
            "{} vs {}: +{} ={} -{}, Elo {:+.0} [{:+.0}, {:+.0}]",
            config.bots[0],
            config.bots[1],
            tally.wins,
            tally.draws,
            tally.losses,
            tally.elo(),
            low,
            high
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::split_bots;

    #[test]
    fn bot_arguments_stay_with_their_spec() {
        assert_eq!(
            split_bots("pimc:turns=8,temp=1,greedy,@a.json"),
            ["pimc:turns=8,temp=1", "greedy", "@a.json"]
        );
    }
}
