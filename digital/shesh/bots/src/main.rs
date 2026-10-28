//! `shesh-bots`: batches between bots of the Shesh.
//!
//! ```text
//! shesh-bots batch --bots A,B [--games G] [--seed S] [--no-rotate]
//!                  [--threads T] [--extra-turn] [--free-entry]
//!                  [--home-wins]
//! ```
//!
//! With one bot in `--bots`, both seats play it. `--games` counts seeds:
//! with rotation (the default) each seed is played twice, with the bots
//! swapped. For experiments (see `Rules`): `--extra-turn` gives a roll
//! again on the rosettes, `--free-entry` lets any die of the reserve enter,
//! and `--home-wins` makes taking every die home win whatever the points.

use shesh_bots::batch::{self, Config};
use shesh_bots::DEFAULT_THREADS;
use shesh_engine::Rules;

const USAGE: &str = "usage: shesh-bots batch --bots A,B [--games G] [--seed S] [--no-rotate] [--threads T] [--extra-turn] [--free-entry] [--home-wins]";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("batch") => run_batch(&args[1..]),
        _ => Err(USAGE.into()),
    };
    if let Err(error) = result {
        eprintln!("shesh-bots: {error}");
        std::process::exit(1);
    }
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
    let mut config = Config {
        bots: ["greedy".into(), "greedy".into()],
        seeds: 1_000,
        first_seed: 1,
        rotate: true,
        threads: DEFAULT_THREADS.min(std::thread::available_parallelism().map_or(1, |n| n.get())),
        rules: Rules::default(),
    };
    let mut i = 0;
    while i < args.len() {
        let flag = args[i].as_str();
        match flag {
            "--bots" => {
                let names: Vec<&str> = value(args, &mut i, flag)?.split(',').collect();
                config.bots = match names[..] {
                    [one] => [one.into(), one.into()],
                    [a, b] => [a.into(), b.into()],
                    _ => return Err("--bots takes one or two names".into()),
                };
            }
            "--games" => config.seeds = number(value(args, &mut i, flag)?, flag)?,
            "--seed" => config.first_seed = number(value(args, &mut i, flag)?, flag)?,
            "--threads" => config.threads = number(value(args, &mut i, flag)?, flag)?,
            "--no-rotate" => config.rotate = false,
            "--extra-turn" => config.rules.extra_turn = true,
            "--free-entry" => config.rules.ordered_entry = false,
            "--home-wins" => config.rules.all_home_wins = true,
            _ => return Err(format!("unknown flag {flag:?}\n{USAGE}")),
        }
        i += 1;
    }
    let records = batch::run(&config)?;
    print!("{}", batch::summary(&config, &records));
    Ok(())
}
