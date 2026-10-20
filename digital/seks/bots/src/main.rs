//! Command line of the Seks bots.
//!
//!     seks-bots batch --bots A,B --openings FILE [--games N] [--seed S]
//!                     [--threads N] [--max-plies N] [--out games.jsonl]
//!                     [--games-out DIR] [--summary summary.json]
//!     seks-bots replay DIR_OR_FILE...
//!     seks-bots openings --out FILE [--count 200] [--plies 6] [--seed S]
//!                        [--judge SPEC] [--margin M]
//!     seks-bots perft --depth N
//!     seks-bots bench [--bot SPEC]
//!     seks-bots selfplay --bot SPEC [--openings FILE] --games N --out FILE
//!                        [--seed S] [--threads N] [--noise E] [--noise-plies P]
//!                        [--max-plies N]
//!     seks-bots tune --data FILE [--data FILE]... --init WEIGHTS --out WEIGHTS
//!                    [--lambda L] [--epochs N] [--lr X] [--l2 X] [--patience N]
//!                    [--threads N]
//!     seks-bots train CONFIG.json
//!
//! `--bots` splits at the first comma that starts a bot name, so specs
//! with commas work. `batch` plays every opening once with each color (`--games` defaults to
//! twice the openings), writes one JSONL line per game to `--out` and the
//! summary to stderr (and as JSON to `--summary`). `--games-out` writes one
//! game file per game, which `replay` plays back through the engine.
//! `openings` writes `--count` openings of `--plies` random plies, dropping
//! those whose score by the `--judge` bot is beyond `--margin`.
//! `selfplay`, `tune` and `train` are the steps of training: see
//! `seks_bots::train`. Bot specs: see `seks_bots::by_name`.

use std::io::{IsTerminal, Write};
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use seks_bots::batch::{Batch, Summary};
use seks_bots::by_name;
use seks_bots::eval::Weights;
use seks_bots::game_file::GameFile;
use seks_bots::openings;
use seks_bots::train::run::Config;
use seks_bots::train::selfplay::SelfPlay;
use seks_bots::train::tune::{tune_files, Tune};
use seks_engine::GameState;

const USAGE: &str = "usage: seks-bots batch --bots A,B --openings FILE [--games N] [--seed S] \
[--threads N] [--max-plies N] [--out FILE] [--games-out DIR] [--summary FILE]
       seks-bots replay DIR_OR_FILE...
       seks-bots openings --out FILE [--count N] [--plies K] [--seed S] [--judge SPEC] [--margin M]
       seks-bots perft --depth N
       seks-bots bench [--bot SPEC]
       seks-bots selfplay --bot SPEC [--openings FILE] --games N --out FILE [--seed S] [--threads N] \
[--noise E] [--noise-plies P] [--max-plies N]
       seks-bots tune --data FILE... --init WEIGHTS --out WEIGHTS [--lambda L] [--epochs N] \
[--lr X] [--l2 X] [--patience N] [--threads N]
       seks-bots train CONFIG.json";

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
        "bench" => bench(&pairs(rest)?),
        "selfplay" => selfplay(&pairs(rest)?),
        "tune" => tune(&pairs(rest)?),
        "train" => match rest {
            [config] => train(config),
            _ => Err(USAGE.into()),
        },
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

/// Threads of the expensive commands unless `--threads` says otherwise:
/// [`seks_bots::DEFAULT_THREADS`], at most the machine's.
fn default_threads() -> NonZeroUsize {
    seks_bots::default_threads()
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
    let (a, b) = split_bots(bots).ok_or("--bots takes two specs: A,B")?;
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

/// `A,B` split at the first comma that starts a bot name, since the specs
/// themselves may hold commas (`ab:nodes=500,noise=10,random`).
fn split_bots(text: &str) -> Option<(&str, &str)> {
    text.match_indices(',').map(|(i, _)| i).find_map(|i| {
        let (a, b) = (&text[..i], &text[i + 1..]);
        let named = ["random", "greedy", "ab"].contains(&b) || b.starts_with("ab:");
        (named && !a.is_empty()).then_some((a, b))
    })
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
    let mut judge = "ab:depth=4".to_string();
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

fn bench(flags: &[(&str, &str)]) -> Result<(), String> {
    let mut bot = "ab".to_string();
    for &(flag, value) in flags {
        match flag {
            "--bot" => bot = value.to_string(),
            _ => return Err(format!("unknown flag {flag}\n{USAGE}")),
        }
    }
    println!("{}", seks_bots::bench::run(&bot)?);
    Ok(())
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
    let mut buffers: Vec<_> = (0..depth).map(|_| Vec::with_capacity(256)).collect();
    let clock = Instant::now();
    let leaves = seks_bots::bench::perft(&GameState::initial(), depth, &mut buffers);
    let seconds = clock.elapsed().as_secs_f64();
    println!(
        "perft {depth}: {leaves} leaves in {seconds:.2} s, {:.0} leaves/s",
        leaves as f64 / seconds
    );
    Ok(())
}

fn selfplay(flags: &[(&str, &str)]) -> Result<(), String> {
    let mut run = SelfPlay {
        bot: String::new(),
        openings: Vec::new(),
        games: 0,
        seed: 0,
        threads: default_threads(),
        noise: 0,
        noise_plies: 0,
        max_plies: 1000,
        first_game: 0,
    };
    let mut out = None;
    for &(flag, value) in flags {
        match flag {
            "--bot" => run.bot = value.to_string(),
            "--openings" => run.openings = read_openings(value)?,
            "--games" => run.games = number(flag, value)?,
            "--seed" => run.seed = number(flag, value)?,
            "--threads" => run.threads = number(flag, value)?,
            "--noise" => run.noise = number(flag, value)?,
            "--noise-plies" => run.noise_plies = number(flag, value)?,
            "--max-plies" => run.max_plies = number(flag, value)?,
            "--out" => out = Some(value),
            _ => return Err(format!("unknown flag {flag}\n{USAGE}")),
        }
    }
    let out = out.ok_or(format!("--out is required\n{USAGE}"))?;
    // Without openings every game starts from the initial position; the root
    // noise of the first plies makes them differ.
    if run.openings.is_empty() {
        run.openings.push(openings::Opening::initial());
    }
    let file = std::fs::File::create(out).map_err(|e| format!("{out}: {e}"))?;
    let mut file = std::io::BufWriter::new(file);
    let clock = Instant::now();
    let produced = run.run(&mut file, &|_| {})?;
    file.flush().map_err(|e| format!("{out}: {e}"))?;
    eprintln!(
        "{out}: {} games, {} positions in {:.0} s; ends {:?}; white wins {}, black wins {}",
        produced.games,
        produced.samples,
        clock.elapsed().as_secs_f64(),
        produced.ends,
        produced.white_wins,
        produced.black_wins
    );
    Ok(())
}

fn tune(flags: &[(&str, &str)]) -> Result<(), String> {
    let mut settings = Tune {
        threads: default_threads(),
        ..Tune::default()
    };
    let (mut data, mut init, mut out) = (Vec::new(), None, None);
    for &(flag, value) in flags {
        match flag {
            "--data" => data.push(value),
            "--init" => init = Some(value),
            "--out" => out = Some(value),
            "--lambda" => settings.lambda = number(flag, value)?,
            "--epochs" => settings.epochs = number(flag, value)?,
            "--lr" => settings.learning_rate = number(flag, value)?,
            "--l2" => settings.l2 = number(flag, value)?,
            "--patience" => settings.patience = number(flag, value)?,
            "--threads" => settings.threads = number(flag, value)?,
            _ => return Err(format!("unknown flag {flag}\n{USAGE}")),
        }
    }
    let init = init.ok_or(format!("--init is required\n{USAGE}"))?;
    let out = out.ok_or(format!("--out is required\n{USAGE}"))?;
    if data.is_empty() {
        return Err(format!("--data is required\n{USAGE}"));
    }
    let paths: Vec<PathBuf> = data.iter().map(PathBuf::from).collect();
    let text = std::fs::read_to_string(init).map_err(|e| format!("{init}: {e}"))?;
    let init = Weights::from_json(&text).map_err(|e| format!("{init}: {e}"))?;
    let (weights, report) =
        tune_files(&paths, &init, &settings, &mut |epoch, train, validation| {
            eprintln!("step {epoch}: train {train:.6}, validation {validation:.6}");
        })?;
    std::fs::write(out, weights.to_json()).map_err(|e| format!("{out}: {e}"))?;
    eprintln!("{out}: {report:?}");
    Ok(())
}

fn train(path: &str) -> Result<(), String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    let config: Config = serde_json::from_str(&text).map_err(|e| format!("{path}: {e}"))?;
    seks_bots::train::run::run(&config)
}

#[cfg(test)]
mod tests {
    use super::split_bots;

    #[test]
    fn bots_split_at_the_comma_that_starts_the_second_spec() {
        assert_eq!(split_bots("ab,random"), Some(("ab", "random")));
        assert_eq!(
            split_bots("ab:nodes=5,weights=@a.json,ab:nodes=5"),
            Some(("ab:nodes=5,weights=@a.json", "ab:nodes=5"))
        );
        assert_eq!(
            split_bots("greedy,ab:depth=2,noise=3"),
            Some(("greedy", "ab:depth=2,noise=3"))
        );
        assert_eq!(split_bots("ab"), None);
    }
}
