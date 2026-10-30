//! `missoes-bots`: batches between bots of the mission and dice-pool game.
//!
//! ```text
//! missoes-bots batch --bots A,B[,C,D] [--games G] [--seed S] [--no-rotate]
//!                    [--threads T] [--goal P] [--hand H] [--start-common C]
//!                    [--start-gold G] [--market-each M] [--market-one O]
//!                    [--market-gold G] [--market-high-gold H] [--bought-waits]
//!                    [--no-sacrifice] [--bonus B] [--parity-minus M]
//!                    [--without MISSION,...] [--no-cash] [--sabotage-by-die]
//! ```
//!
//! One bot per player. `--games` counts seeds: with rotation (the default)
//! each seed is played once per seating, the bots shifted one seat each
//! time.

use missoes_bots::batch::{self, Config};
use missoes_bots::DEFAULT_THREADS;
use missoes_engine::{Mission, Rules};

const USAGE: &str = "usage: missoes-bots batch --bots A,B[,C,D] [--games G] [--seed S] [--no-rotate] [--threads T] [--goal P] [--hand H] [--start-common C] [--start-gold G] [--market-each M] [--market-one O] [--market-gold G] [--market-high-gold H] [--bought-waits] [--no-sacrifice] [--bonus B] [--parity-minus M] [--without MISSION,...] [--no-cash] [--sabotage-by-die]";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("batch") => run_batch(&args[1..]),
        _ => Err(USAGE.into()),
    };
    if let Err(error) = result {
        eprintln!("missoes-bots: {error}");
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
        bots: vec!["greedy".into(), "greedy".into()],
        seeds: 1_000,
        first_seed: 1,
        rotate: true,
        threads: DEFAULT_THREADS.min(std::thread::available_parallelism().map_or(1, |n| n.get())),
        rules: Rules::default(),
    };
    let mut i = 0;
    while i < args.len() {
        let flag = args[i].as_str();
        let rules = &mut config.rules;
        match flag {
            "--bots" => {
                config.bots = value(args, &mut i, flag)?
                    .split(',')
                    .map(String::from)
                    .collect();
                if !(2..=4).contains(&config.bots.len()) {
                    return Err("--bots takes 2 to 4 names".into());
                }
            }
            "--games" => config.seeds = number(value(args, &mut i, flag)?, flag)?,
            "--seed" => config.first_seed = number(value(args, &mut i, flag)?, flag)?,
            "--threads" => config.threads = number(value(args, &mut i, flag)?, flag)?,
            "--no-rotate" => config.rotate = false,
            "--goal" => rules.goal = number(value(args, &mut i, flag)?, flag)?,
            "--hand" => rules.hand = number(value(args, &mut i, flag)?, flag)?,
            "--start-common" => rules.start_common = number(value(args, &mut i, flag)?, flag)?,
            "--start-gold" => rules.start_gold = number(value(args, &mut i, flag)?, flag)?,
            "--market-each" => rules.market_each = number(value(args, &mut i, flag)?, flag)?,
            "--market-one" => rules.market_one = number(value(args, &mut i, flag)?, flag)?,
            "--no-sacrifice" => rules.sacrifice = false,
            "--no-cash" => rules.cash = false,
            "--sabotage-by-die" => rules.sabotage_by_die = true,
            "--bought-waits" => rules.bought_plays = false,
            "--bonus" => rules.bonus = number(value(args, &mut i, flag)?, flag)?,
            "--parity-minus" => rules.parity_minus = number(value(args, &mut i, flag)?, flag)?,
            "--market-gold" => rules.market_gold = number(value(args, &mut i, flag)?, flag)?,
            "--market-high-gold" => {
                rules.market_high_gold = number(value(args, &mut i, flag)?, flag)?
            }
            "--without" => {
                for name in value(args, &mut i, flag)?.split(',') {
                    let card = Mission::CARDS
                        .iter()
                        .position(|c| c.name() == name)
                        .ok_or(format!("--without: unknown mission card {name:?}"))?;
                    rules.cards &= !(1 << card);
                }
            }
            _ => return Err(format!("unknown flag {flag:?}\n{USAGE}")),
        }
        i += 1;
    }
    let records = batch::run(&config)?;
    print!("{}", batch::summary(&config, &records));
    Ok(())
}
