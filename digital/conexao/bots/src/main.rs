//! `conexao-bots`: batches between bots of the dice connection game.
//!
//! ```text
//! conexao-bots batch --bots A,B [--games G] [--seed S] [--no-rotate]
//!                    [--threads T] [--size N] [--goal line|reach] [--no-block] [--block-home] [--block-reserve] [--capture]
//!                    [--max-turns N] [--dice D] [--placed-value V] [--extra V,V,..] [--advance]
//! ```
//!
//! `--extra` lists reserve dice that start with another value than
//! `--placed-value`, one die per value listed: `--extra 6,5,4,3`.
//!
//! `--games` counts seeds: with rotation (the default) each seed is played
//! twice, the bots swapping colors.

use conexao_bots::batch::{self, Config};
use conexao_bots::DEFAULT_THREADS;
use conexao_engine::{Goal, Rules};

const USAGE: &str = "usage: conexao-bots batch --bots A,B [--games G] [--seed S] [--no-rotate] [--threads T] [--size N] [--goal line|reach] [--no-block] [--block-home] [--block-reserve] [--capture] [--max-turns N] [--dice D] [--placed-value V] [--extra V,V,..] [--advance]";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("batch") => run_batch(&args[1..]),
        _ => Err(USAGE.into()),
    };
    if let Err(error) = result {
        eprintln!("conexao-bots: {error}");
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
        seeds: 500,
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
                let names: Vec<&str> = value(args, &mut i, flag)?.split(',').collect();
                let [a, b] = names[..] else {
                    return Err("--bots takes 2 names".into());
                };
                config.bots = [a.into(), b.into()];
            }
            "--games" => config.seeds = number(value(args, &mut i, flag)?, flag)?,
            "--seed" => config.first_seed = number(value(args, &mut i, flag)?, flag)?,
            "--threads" => config.threads = number(value(args, &mut i, flag)?, flag)?,
            "--no-rotate" => config.rotate = false,
            "--goal" => {
                rules.goal = match value(args, &mut i, flag)? {
                    "line" => Goal::Line,
                    "reach" => Goal::Reach,
                    other => return Err(format!("--goal: line or reach, not {other:?}")),
                }
            }
            "--no-block" => rules.blocking = false,
            "--block-home" => rules.block_home = true,
            "--block-reserve" => rules.block_from_board = false,
            "--capture" => rules.capture = true,
            "--advance" => rules.advance = true,
            "--size" => {
                rules.size = number(value(args, &mut i, flag)?, flag)?;
                if !(5..=conexao_engine::SIZE).contains(&rules.size) {
                    return Err("--size: 5 to 11".into());
                }
            }
            "--max-turns" => rules.max_turns = number(value(args, &mut i, flag)?, flag)?,
            "--dice" => rules.dice = number(value(args, &mut i, flag)?, flag)?,
            "--placed-value" => rules.placed_value = number(value(args, &mut i, flag)?, flag)?,
            "--extra" => {
                rules.extra = [0; 7];
                for v in value(args, &mut i, flag)?.split(',') {
                    let v: usize = number(v, flag)?;
                    *rules
                        .extra
                        .get_mut(v)
                        .filter(|_| v > 0)
                        .ok_or("--extra: values 1 to 6")? += 1;
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
