//! The alpha-beta bot: [`crate::search`] with the linear evaluation.

use std::sync::Arc;

use seks_engine::GameState;

use crate::bot::{Bot, Decision};
use crate::eval::{Evaluator, Weights};
use crate::search::{Limits, Options, Searcher};

/// The bot `ab[:depth=D,nodes=N,ms=T,tt=MIB,noise=E,weights=@FILE,nmp=B,lmr=B,prune=B]`.
pub struct AlphaBeta {
    spec: String,
    searcher: Searcher,
    limits: Limits,
    /// Milliseconds per move, native only.
    ms: Option<u64>,
    noise: i32,
}

impl AlphaBeta {
    /// Nodes per move of the default level, `ab` with no arguments.
    pub const DEFAULT_NODES: u64 = 20_000;
    /// Size of the transposition table, in MiB, unless `tt` says otherwise.
    pub const DEFAULT_TABLE_MIB: usize = 16;

    /// Reads the arguments after `ab:`, comma separated `key=value` pairs.
    pub fn from_args(spec: &str, args: &str) -> Result<AlphaBeta, String> {
        let mut limits = Limits::default();
        let mut nodes = None;
        let mut ms = None;
        let mut mib = Self::DEFAULT_TABLE_MIB;
        let mut noise = 0;
        let mut weights = None;
        let mut options = Options::default();
        let flag = |key: &str, value: &str| match value {
            "0" => Ok(false),
            "1" => Ok(true),
            _ => Err(format!("bot {spec}: bad {key}={value}")),
        };
        let bad = |key: &str, value: &str| format!("bot {spec}: bad {key}={value}");
        for pair in args.split(',').filter(|pair| !pair.is_empty()) {
            let (key, value) = pair
                .split_once('=')
                .ok_or(format!("bot {spec}: expected key=value, found {pair:?}"))?;
            match key {
                "depth" => {
                    limits.depth = value.parse().map_err(|_| bad(key, value))?;
                    if limits.depth == 0 {
                        return Err(bad(key, value));
                    }
                }
                "nodes" => nodes = Some(value.parse().map_err(|_| bad(key, value))?),
                "ms" => ms = Some(value.parse().map_err(|_| bad(key, value))?),
                "tt" => mib = value.parse().map_err(|_| bad(key, value))?,
                "noise" => noise = value.parse().map_err(|_| bad(key, value))?,
                "nmp" => options.null_move = flag(key, value)?,
                "lmr" => options.late_reductions = flag(key, value)?,
                "prune" => options.pruning = flag(key, value)?,
                "weights" => {
                    let path = value.strip_prefix('@').ok_or(bad(key, value))?;
                    weights = Some(load_weights(path).map_err(|e| format!("bot {spec}: {e}"))?);
                }
                _ => return Err(format!("bot {spec}: unknown argument {key:?}")),
            }
        }
        if noise < 0 || mib == 0 {
            return Err(format!("bot {spec}: noise and tt must be positive"));
        }
        // Without any limit, the default level.
        let unlimited = nodes.is_none() && ms.is_none() && limits.depth == Limits::default().depth;
        limits.nodes = match nodes {
            Some(nodes) => nodes,
            None if unlimited => Self::DEFAULT_NODES,
            None => u64::MAX,
        };
        let evaluator = Evaluator::new(&weights.unwrap_or_default());
        let mut searcher = Searcher::new(evaluator, mib);
        searcher.options = options;
        Ok(AlphaBeta {
            spec: spec.into(),
            searcher,
            limits,
            ms,
            noise,
        })
    }

    /// A bot with `weights`, `limits` and `noise`, named `spec`.
    pub fn new(spec: &str, weights: &Weights, limits: Limits, noise: i32) -> AlphaBeta {
        AlphaBeta {
            spec: spec.into(),
            searcher: Searcher::new(Evaluator::new(weights), Self::DEFAULT_TABLE_MIB),
            limits,
            ms: None,
            noise,
        }
    }

    /// The bot of a spec `ab` or `ab:ARGS`.
    pub fn from_spec(spec: &str) -> Result<AlphaBeta, String> {
        match spec.split_once(':') {
            Some(("ab", args)) if !args.is_empty() => AlphaBeta::from_args(spec, args),
            None if spec == "ab" => AlphaBeta::from_args(spec, ""),
            _ => Err(format!("{spec:?} is not an ab bot")),
        }
    }

    pub fn searcher(&mut self) -> &mut Searcher {
        &mut self.searcher
    }

    /// The root noise (see [`crate::search::Searcher::search`]).
    pub fn noise(&self) -> i32 {
        self.noise
    }

    pub fn set_noise(&mut self, noise: i32) {
        self.noise = noise;
    }
}

/// Weights files read once per process, by path.
fn load_weights(path: &str) -> Result<Weights, String> {
    use std::collections::HashMap;
    use std::sync::Mutex;
    static CACHE: Mutex<Option<HashMap<String, Arc<Weights>>>> = Mutex::new(None);
    let mut cache = CACHE.lock().unwrap();
    let cache = cache.get_or_insert_with(HashMap::new);
    if let Some(weights) = cache.get(path) {
        return Ok((**weights).clone());
    }
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    let weights = Weights::from_json(&text).map_err(|e| format!("{path}: {e}"))?;
    cache.insert(path.into(), Arc::new(weights.clone()));
    Ok(weights)
}

impl Bot for AlphaBeta {
    fn name(&self) -> String {
        self.spec.clone()
    }

    fn new_game(&mut self) {
        self.searcher.clear();
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Decision {
        let result = match self.ms {
            #[cfg(not(target_arch = "wasm32"))]
            Some(ms) => {
                let start = std::time::Instant::now();
                let budget = std::time::Duration::from_millis(ms);
                self.searcher
                    .search(state, self.limits, self.noise, seed, &mut || {
                        start.elapsed() >= budget
                    })
            }
            _ => self
                .searcher
                .search(state, self.limits, self.noise, seed, &mut || false),
        };
        Decision {
            command: result.command,
            nodes: result.nodes,
            depth: result.depth,
            score: Some(result.score),
        }
    }
}
