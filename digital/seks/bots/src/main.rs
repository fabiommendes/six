//! Command line of the Seks bots.
//!
//!     seks-bots batch --bots A,B --openings FILE [--games N] [--seed S]
//!                     [--threads N] [--max-plies N] [--out games.jsonl]
//!                     [--games-out DIR] [--summary summary.json]
//!     seks-bots replay DIR_OR_FILE...
//!     seks-bots openings --out FILE [--count 200] [--plies 6] [--seed S]
//!                        [--judge SPEC] [--margin M]
//!     seks-bots perft --depth N
//!
//! `batch` plays every opening once with each color (`--games` defaults to
//! twice the openings), writes one JSONL line per game to `--out` and the
//! summary to stderr (and as JSON to `--summary`). `--games-out` writes one
//! game file per game, which `replay` plays back through the engine.
//! `openings` writes `--count` openings of `--plies` random plies, dropping
//! those whose score by the `--judge` bot is beyond `--margin`.
//! Bot specs: see `seks_bots::by_name`.

use std::io::{IsTerminal, Write};
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use seks_bots::batch::{Batch, Summary};
use seks_bots::by_name;
use seks_bots::game_file::GameFile;
use seks_bots::openings;
use seks_engine::{legal_commands_into, Command, Engine, GameState};

const USAGE: &str = "usage: seks-bots batch --bots A,B --openings FILE [--games N] [--seed S] \
[--threads N] [--max-plies N] [--out FILE] [--games-out DIR] [--summary FILE]
       seks-bots replay DIR_OR_FILE...
       seks-bots openings --out FILE [--count N] [--plies K] [--seed S] [--judge SPEC] [--margin M]
       seks-bots perft --depth N";

fn main() -> ExitCode {
    match run(std::env::args().skip(1).collect()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}

fn run(args: Vec<String>) -> Result<(), String> {
    let Some((command, rest)) = args.split_first() else {
        return Err(USAGE.into());
    };
    match command.as_str() {
        "batch" => batch(&pairs(rest)?),
        "replay" => replay(rest),
        "openings" => make_openings(&pairs(rest)?),
        "perft" => perft(&pairs(rest)?),
        _ => Err(USAGE.into()),
    }
}

/// Flag pairs: `--flag value`, in order.
fn pairs(flags: &[String]) -> Result<Vec<(&str, &str)>, String> {
    flags
        .chunks(2)
        .map(|pair| match pair {
            [flag, value] if flag.starts_with("--") => Ok((flag.as_str(), value.as_str())),
            [flag, _] => Err(format!("unexpected {flag}\n{USAGE}")),
            [flag] => Err(format!("{flag} needs a value\n{USAGE}")),
            _ => unreachable!(),
        })
        .collect()
}

fn number<T: std::str::FromStr>(flag: &str, value: &str) -> Result<T, String> {
    value
        .parse()
        .map_err(|_| format!("{flag}: {value} is not a valid number"))
}

/// All threads of the machine but 2, at least 1.
fn default_threads() -> NonZeroUsize {
    let all = std::thread::available_parallelism().map_or(1, NonZeroUsize::get);
    NonZeroUsize::new(all.saturating_sub(2).max(1)).unwrap()
}

fn read_openings(path: &str) -> Result<Vec<openings::Opening>, String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    openings::read(&text).map_err(|e| format!("{path}: {e}"))
}

fn batch(flags: &[(&str, &str)]) -> Result<(), String> {
    let mut bots = None;
    let mut openings = None;
    let mut games = None;
    let mut out = None;
    let mut summary_out = None;
    let mut batch = Batch {
        bots: Default::default(),
        openings: Vec::new(),
        games: 0,
        seed: 0,
        threads: default_threads(),
        max_plies: 1000,
        games_out: None,
    };
    for &(flag, value) in flags {
        match flag {
            "--bots" => bots = Some(value),
            "--openings" => openings = Some(value),
            "--games" => games = Some(number(flag, value)?),
            "--seed" => batch.seed = number(flag, value)?,
            "--threads" => batch.threads = number(flag, value)?,
            "--max-plies" => batch.max_plies = number(flag, value)?,
            "--out" => out = Some(value),
            "--games-out" => batch.games_out = Some(PathBuf::from(value)),
            "--summary" => summary_out = Some(value),
            _ => return Err(format!("unknown flag {flag}\n{USAGE}")),
        }
    }
    let bots = bots.ok_or(format!("--bots is required\n{USAGE}"))?;
    let (a, b) = bots.split_once(',').ok_or("--bots takes two specs: A,B")?;
    batch.bots = [a.to_string(), b.to_string()];
    batch.openings = read_openings(openings.ok_or(format!("--openings is required\n{USAGE}"))?)?;
    batch.games = games.unwrap_or(2 * batch.openings.len());
    let terminal = std::io::stderr().is_terminal();
    let total = batch.games;
    let records = batch.run(&|done| {
        if terminal {
            eprint!("\r{done}/{total}");
        }
    })?;
    if terminal {
        eprintln!();
    }
    if let Some(path) = out {
        let mut text = String::new();
        for record in &records {
            text.push_str(&serde_json::to_string(record).map_err(|e| e.to_string())?);
            text.push('\n');
        }
        std::fs::write(path, text).map_err(|e| format!("{path}: {e}"))?;
    }
    let summary = Summary::new(&batch.bots, &records);
    eprintln!("{summary}");
    if let Some(path) = summary_out {
        let json = serde_json::to_string_pretty(&summary).map_err(|e| e.to_string())?;
        std::fs::write(path, json).map_err(|e| format!("{path}: {e}"))?;
    }
    if summary.errors > 0 {
        let first = records.iter().find_map(|r| r.error.as_ref()).unwrap();
        return Err(format!(
            "{} games stopped on an engine error: {first}",
            summary.errors
        ));
    }
    Ok(())
}

/// The `.json` files under `path`, or `path` itself.
fn game_files(path: &Path) -> Result<Vec<PathBuf>, String> {
    if !path.is_dir() {
        return Ok(vec![path.to_path_buf()]);
    }
    let mut files: Vec<PathBuf> = std::fs::read_dir(path)
        .map_err(|e| format!("{}: {e}", path.display()))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .collect();
    files.sort();
    Ok(files)
}

fn replay(paths: &[String]) -> Result<(), String> {
    if paths.is_empty() {
        return Err(USAGE.into());
    }
    let mut count = 0;
    for path in paths {
        for file in game_files(Path::new(path))? {
            let text =
                std::fs::read_to_string(&file).map_err(|e| format!("{}: {e}", file.display()))?;
            let game: GameFile =
                serde_json::from_str(&text).map_err(|e| format!("{}: {e}", file.display()))?;
            game.replay()
                .map_err(|e| format!("{}: {e}", file.display()))?;
            count += 1;
        }
    }
    println!("{count} games replayed: every one ends as its file says");
    Ok(())
}

fn make_openings(flags: &[(&str, &str)]) -> Result<(), String> {
    let (mut count, mut plies, mut seed) = (200usize, 6usize, 0u64);
    let mut judge = "greedy".to_string();
    let mut margin = 150i32;
    let mut out = None;
    for &(flag, value) in flags {
        match flag {
            "--count" => count = number(flag, value)?,
            "--plies" => plies = number(flag, value)?,
            "--seed" => seed = number(flag, value)?,
            "--judge" => judge = value.to_string(),
            "--margin" => margin = number(flag, value)?,
            "--out" => out = Some(value),
            _ => return Err(format!("unknown flag {flag}\n{USAGE}")),
        }
    }
    let out = out.ok_or(format!("--out is required\n{USAGE}"))?;
    let mut bot = by_name(&judge)?;
    let mut dropped = 0;
    let openings = openings::generate(count, plies, seed, |state| {
        bot.new_game();
        let score = bot.choose(state, 0).score.unwrap_or(0);
        let keep = score.abs() <= margin;
        dropped += usize::from(!keep);
        keep
    });
    let mut text = format!(
        "# seks-bots openings --count {count} --plies {plies} --seed {seed} --judge {judge} --margin {margin}\n"
    );
    for opening in &openings {
        text.push_str(&opening.to_line());
        text.push('\n');
    }
    let mut file = std::fs::File::create(out).map_err(|e| format!("{out}: {e}"))?;
    file.write_all(text.as_bytes())
        .map_err(|e| format!("{out}: {e}"))?;
    eprintln!("{out}: {count} openings, {dropped} dropped by {judge}");
    Ok(())
}

fn perft_count(state: &GameState, depth: u32, buffers: &mut [Vec<Command>]) -> u64 {
    let (commands, rest) = buffers.split_first_mut().unwrap();
    legal_commands_into(state, commands);
    if depth == 1 {
        return commands.len() as u64;
    }
    let mut total = 0;
    for &command in commands.iter() {
        let next = Engine::step(state, command).expect("a legal command");
        total += perft_count(&next, depth - 1, rest);
    }
    total
}

fn perft(flags: &[(&str, &str)]) -> Result<(), String> {
    let mut depth = None;
    for &(flag, value) in flags {
        match flag {
            "--depth" => depth = Some(number::<u32>(flag, value)?),
            _ => return Err(format!("unknown flag {flag}\n{USAGE}")),
        }
    }
    let depth = depth
        .filter(|&d| d > 0)
        .ok_or("--depth must be at least 1")?;
    let mut buffers = vec![Vec::with_capacity(256); depth as usize];
    let clock = Instant::now();
    let leaves = perft_count(&GameState::initial(), depth, &mut buffers);
    let seconds = clock.elapsed().as_secs_f64();
    println!(
        "perft {depth}: {leaves} leaves in {seconds:.2} s, {:.0} leaves/s",
        leaves as f64 / seconds
    );
    Ok(())
}
