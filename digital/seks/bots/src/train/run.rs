//! The training loop, `seks-bots train CONFIG.json`: generation after
//! generation, self-play with the current weights, Texel tuning, and a
//! batch of the tuned weights against the current ones. The tuned weights
//! are promoted only if the lower end of the 95% Elo interval is above 0.
//!
//! Everything goes to `<out>/<name>/`: `config.json`, `log.csv` (one line
//! per generation), `state.json` (the last generation done and the current
//! weights) and `gen-NNN/` (`data.bin`, `weights.json`, `gate.jsonl`). A run
//! that stops resumes from the last step it finished.

use std::io::Write;
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::{Deserialize, Serialize};

use super::dataset;
use super::selfplay::SelfPlay;
use super::tune::{tune, Tune};
use crate::batch::{Batch, Summary};
use crate::eval::Weights;
use crate::openings::{read, Opening};
use crate::rng::derive;

/// A training run, read from JSON. Paths are relative to the working
/// directory.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub name: String,
    pub seed: u64,
    pub generations: u32,
    /// The weights of generation 0.
    pub init: String,
    /// Threads; all but 2 of the machine when 0.
    #[serde(default)]
    pub threads: usize,
    /// Where the runs go.
    #[serde(default = "default_out")]
    pub out: String,
    pub selfplay: SelfPlayConfig,
    pub tune: TuneConfig,
    pub gate: GateConfig,
}

fn default_out() -> String {
    "train/runs".into()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SelfPlayConfig {
    /// An `ab` spec without weights, e.g. `ab:nodes=5000`.
    pub bot: String,
    pub games: usize,
    pub openings: String,
    pub noise: i32,
    pub noise_plies: u32,
    pub max_plies: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TuneConfig {
    pub lambda: f64,
    pub epochs: usize,
    pub learning_rate: f64,
    pub l2: f64,
    pub patience: usize,
    /// Generations of data each tuning uses: this one and the ones before.
    pub window: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GateConfig {
    /// An `ab` spec without weights, e.g. `ab:nodes=5000`.
    pub bot: String,
    pub games: usize,
    pub openings: String,
    pub max_plies: u32,
}

/// The progress of a run.
#[derive(Clone, Debug, Serialize, Deserialize)]
struct State {
    generation: u32,
    current: String,
}

/// `spec` with the weights in `path`.
pub fn with_weights(spec: &str, path: &Path) -> String {
    let separator = if spec.contains(':') { ',' } else { ':' };
    format!("{spec}{separator}weights=@{}", path.display())
}

fn openings(path: &str) -> Result<Vec<Opening>, String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    read(&text).map_err(|e| format!("{path}: {e}"))
}

fn io(path: &Path) -> impl Fn(std::io::Error) -> String + '_ {
    move |e| format!("{}: {e}", path.display())
}

/// Runs or resumes `config`, printing one line per step to stderr.
pub fn run(config: &Config) -> Result<(), String> {
    let threads = NonZeroUsize::new(config.threads).unwrap_or_else(|| {
        let all = std::thread::available_parallelism().map_or(1, NonZeroUsize::get);
        NonZeroUsize::new(all.saturating_sub(2).max(1)).unwrap()
    });
    let dir = Path::new(&config.out).join(&config.name);
    std::fs::create_dir_all(&dir).map_err(io(&dir))?;
    let config_path = dir.join("config.json");
    let text = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    if let Ok(old) = std::fs::read_to_string(&config_path) {
        let old: Config = serde_json::from_str(&old).map_err(|e| e.to_string())?;
        if (old.seed, &old.selfplay.bot, &old.init)
            != (config.seed, &config.selfplay.bot, &config.init)
        {
            return Err(format!(
                "{} holds a run with another seed, bot or init",
                dir.display()
            ));
        }
    }
    std::fs::write(&config_path, text).map_err(io(&config_path))?;
    let state_path = dir.join("state.json");
    let mut state = match std::fs::read_to_string(&state_path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string())?,
        Err(_) => {
            let init = dir.join("gen-000-weights.json");
            let weights = load(Path::new(&config.init))?;
            std::fs::write(&init, weights.to_json()).map_err(io(&init))?;
            State {
                generation: 0,
                current: init.display().to_string(),
            }
        }
    };
    let log_path = dir.join("log.csv");
    if !log_path.exists() {
        std::fs::write(
            &log_path,
            "generation,samples,train_quiet,validation_quiet,k,train_loss_before,train_loss,\
validation_loss_before,validation_loss,best_epoch,elo,elo_low,elo_high,draws,promoted,seconds\n",
        )
        .map_err(io(&log_path))?;
    }
    let selfplay_openings = openings(&config.selfplay.openings)?;
    let gate_openings = openings(&config.gate.openings)?;
    for generation in state.generation + 1..=config.generations {
        let clock = Instant::now();
        let gen_dir = dir.join(format!("gen-{generation:03}"));
        std::fs::create_dir_all(&gen_dir).map_err(io(&gen_dir))?;
        let current = PathBuf::from(&state.current);

        // Self-play with the current weights.
        let data = gen_dir.join("data.bin");
        if !data.exists() {
            let selfplay = SelfPlay {
                bot: with_weights(&config.selfplay.bot, &current),
                openings: selfplay_openings.clone(),
                games: config.selfplay.games,
                seed: derive(config.seed, generation as u64),
                threads,
                noise: config.selfplay.noise,
                noise_plies: config.selfplay.noise_plies,
                max_plies: config.selfplay.max_plies,
                first_game: generation * 1_000_000,
            };
            let partial = gen_dir.join("data.bin.partial");
            let mut file =
                std::io::BufWriter::new(std::fs::File::create(&partial).map_err(io(&partial))?);
            let produced = selfplay.run(&mut file, &|_| {})?;
            file.flush().map_err(io(&partial))?;
            drop(file);
            std::fs::rename(&partial, &data).map_err(io(&data))?;
            eprintln!(
                "gen {generation}: self-play {} games, {} positions, ends {:?}, white {} black {}",
                produced.games,
                produced.samples,
                produced.ends,
                produced.white_wins,
                produced.black_wins
            );
        }

        // Texel tuning on the window of generations.
        let tuned = gen_dir.join("weights.json");
        let report_path = gen_dir.join("tune.json");
        if !tuned.exists() {
            let mut samples = Vec::new();
            let first = generation
                .saturating_sub(config.tune.window.max(1) - 1)
                .max(1);
            for g in first..=generation {
                let path = dir.join(format!("gen-{g:03}")).join("data.bin");
                samples.extend(dataset::read_file(&path)?);
            }
            let settings = Tune {
                lambda: config.tune.lambda,
                epochs: config.tune.epochs,
                learning_rate: config.tune.learning_rate,
                l2: config.tune.l2,
                patience: config.tune.patience,
                threads,
            };
            let (mut weights, report) =
                tune(&samples, &load(&current)?, &settings, &mut |_, _, _| {})?;
            if let serde_json::Value::Object(meta) = &mut weights.meta {
                meta.insert("run".into(), config.name.clone().into());
                meta.insert("generation".into(), generation.into());
                meta.insert("samples".into(), samples.len().into());
            }
            std::fs::write(&tuned, weights.to_json()).map_err(io(&tuned))?;
            let report = serde_json::json!({
                "samples": samples.len(),
                "train_quiet": report.train_samples,
                "validation_quiet": report.validation_samples,
                "k": report.k,
                "train_loss_before": report.train_loss_before,
                "train_loss": report.train_loss,
                "validation_loss_before": report.validation_loss_before,
                "validation_loss": report.validation_loss,
                "best_epoch": report.best_epoch,
            });
            std::fs::write(&report_path, report.to_string()).map_err(io(&report_path))?;
            eprintln!("gen {generation}: tune {report}");
        }
        let report: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&report_path).map_err(io(&report_path))?)
                .map_err(|e| e.to_string())?;

        // The tuned weights against the current ones.
        let batch = Batch {
            bots: [
                with_weights(&config.gate.bot, &tuned),
                with_weights(&config.gate.bot, &current),
            ],
            openings: gate_openings.clone(),
            games: config.gate.games,
            seed: derive(config.seed, 1000 + generation as u64),
            threads,
            max_plies: config.gate.max_plies,
            games_out: None,
        };
        let records = batch.run(&|_| {})?;
        let gate = gen_dir.join("gate.jsonl");
        let mut lines = String::new();
        for record in &records {
            lines.push_str(&serde_json::to_string(record).map_err(|e| e.to_string())?);
            lines.push('\n');
        }
        std::fs::write(&gate, lines).map_err(io(&gate))?;
        let summary = Summary::new(&batch.bots, &records);
        let promoted = summary.elo_low > 0.0;
        eprintln!(
            "gen {generation}: gate Elo {:+.0} [{:+.0}, {:+.0}], {}",
            summary.elo,
            summary.elo_low,
            summary.elo_high,
            if promoted {
                "promoted"
            } else {
                "kept the previous weights"
            }
        );
        let field = |key: &str| report[key].to_string();
        let line = format!(
            "{generation},{},{},{},{},{},{},{},{},{},{:.1},{:.1},{:.1},{},{},{:.0}\n",
            field("samples"),
            field("train_quiet"),
            field("validation_quiet"),
            field("k"),
            field("train_loss_before"),
            field("train_loss"),
            field("validation_loss_before"),
            field("validation_loss"),
            field("best_epoch"),
            summary.elo,
            summary.elo_low,
            summary.elo_high,
            summary.draws,
            promoted,
            clock.elapsed().as_secs_f64()
        );
        let mut log = std::fs::OpenOptions::new()
            .append(true)
            .open(&log_path)
            .map_err(io(&log_path))?;
        log.write_all(line.as_bytes()).map_err(io(&log_path))?;
        if promoted {
            state.current = tuned.display().to_string();
        }
        state.generation = generation;
        let text = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
        std::fs::write(&state_path, text).map_err(io(&state_path))?;
    }
    eprintln!("current weights: {}", state.current);
    Ok(())
}

fn load(path: &Path) -> Result<Weights, String> {
    let text = std::fs::read_to_string(path).map_err(io(path))?;
    Weights::from_json(&text).map_err(|e| format!("{}: {e}", path.display()))
}
