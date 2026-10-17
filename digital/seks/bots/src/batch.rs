//! Bot-versus-bot batches: many games in parallel, one record per game and
//! a summary.
//!
//! Game `i` starts from opening `(i / 2) % openings`; bot A plays the
//! Whites in even games and the Blacks in odd ones, so every opening is
//! played once with each color. Its seed is `derive(seed, i)`. Each thread
//! builds its own bots and calls [`Bot::new_game`] before every game, so a
//! game depends only on its index: the records are the same with any number
//! of threads, but for the times.

use std::collections::BTreeMap;
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use seks_engine::Side;

use crate::bot::{by_name, Bot};
use crate::game::{play, PlayedGame};
use crate::game_file::{End, GameFile};
use crate::openings::Opening;
use crate::rng::derive;
use crate::stats::Tally;

/// A batch between bots A (`bots[0]`) and B (`bots[1]`).
#[derive(Clone, Debug)]
pub struct Batch {
    pub bots: [String; 2],
    pub openings: Vec<Opening>,
    pub games: usize,
    pub seed: u64,
    pub threads: NonZeroUsize,
    /// Decisions per game before it stops unfinished.
    pub max_plies: u32,
    /// Where to write one game file per game (`game-NNNNN.json`).
    pub games_out: Option<PathBuf>,
}

/// What one bot spent in one game.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Cost {
    pub decisions: u32,
    pub nodes: u64,
    pub depth: u64,
    pub ms: f64,
    pub max_ms: f64,
}

impl Cost {
    fn add(&mut self, other: &Cost) {
        self.decisions += other.decisions;
        self.nodes += other.nodes;
        self.depth += other.depth;
        self.ms += other.ms;
        self.max_ms = self.max_ms.max(other.max_ms);
    }
}

/// One game of a batch: a line of the JSONL output.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Record {
    pub game: usize,
    pub opening: usize,
    pub seed: u64,
    /// Which bot played the Whites: `a` or `b`.
    pub white: String,
    /// `a`, `b`, or absent for a draw or an unfinished game.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub winner: Option<String>,
    pub end: End,
    /// Decisions in the game, after the opening.
    pub plies: u32,
    /// Captures in the game.
    pub captures: u32,
    /// The cost of bot A and of bot B.
    pub cost: [Cost; 2],
    /// An engine error: a bug.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub error: Option<String>,
}

impl Batch {
    /// Plays the batch and returns the records in game order. Calls
    /// `progress` with the number of finished games after each game.
    pub fn run(&self, progress: &(dyn Fn(usize) + Sync)) -> Result<Vec<Record>, String> {
        if self.openings.is_empty() {
            return Err("no openings".into());
        }
        for spec in &self.bots {
            by_name(spec)?;
        }
        if let Some(dir) = &self.games_out {
            std::fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
        }
        let next = AtomicUsize::new(0);
        let done = AtomicUsize::new(0);
        let records = Mutex::new(vec![None; self.games]);
        let failure = Mutex::new(None);
        std::thread::scope(|scope| {
            for _ in 0..self.threads.get().min(self.games.max(1)) {
                scope.spawn(|| {
                    let mut bots = self.bots.each_ref().map(|spec| by_name(spec).unwrap());
                    loop {
                        let game = next.fetch_add(1, Ordering::Relaxed);
                        if game >= self.games {
                            break;
                        }
                        match self.play_one(game, &mut bots) {
                            Ok(record) => records.lock().unwrap()[game] = Some(record),
                            Err(error) => {
                                *failure.lock().unwrap() = Some(error);
                                next.store(self.games, Ordering::Relaxed);
                            }
                        }
                        progress(done.fetch_add(1, Ordering::Relaxed) + 1);
                    }
                });
            }
        });
        if let Some(error) = failure.into_inner().unwrap() {
            return Err(error);
        }
        Ok(records
            .into_inner()
            .unwrap()
            .into_iter()
            .flatten()
            .collect())
    }

    fn play_one(&self, game: usize, bots: &mut [Box<dyn Bot + Send>; 2]) -> Result<Record, String> {
        let opening_index = (game / 2) % self.openings.len();
        let opening = &self.openings[opening_index];
        let start = opening.state()?;
        let seed = derive(self.seed, game as u64);
        let a_white = game.is_multiple_of(2);
        for bot in bots.iter_mut() {
            bot.new_game();
        }
        let [a, b] = bots;
        let seats: [&mut dyn Bot; 2] = if a_white {
            [a.as_mut(), b.as_mut()]
        } else {
            [b.as_mut(), a.as_mut()]
        };
        let (played, error) = match play(seats, &start, seed, self.max_plies) {
            Ok(played) => (Some(played), None),
            Err(error) => (None, Some(error)),
        };
        let white = if a_white { "a" } else { "b" };
        let Some(played) = played else {
            return Ok(Record {
                game,
                opening: opening_index,
                seed,
                white: white.into(),
                winner: None,
                end: End::PlyLimit,
                plies: 0,
                captures: 0,
                cost: Default::default(),
                error,
            });
        };
        if let Some(dir) = &self.games_out {
            let (w, b) = if a_white { (0, 1) } else { (1, 0) };
            let file = GameFile::new(&self.bots[w], &self.bots[b], seed, opening, &played);
            let path = dir.join(format!("game-{game:05}.json"));
            let json = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
            std::fs::write(&path, json).map_err(|e| format!("{}: {e}", path.display()))?;
        }
        let (winner, end) = End::of(played.outcome);
        let winner = winner.map(|side| {
            if (side == Side::White) == a_white {
                "a".to_string()
            } else {
                "b".to_string()
            }
        });
        Ok(Record {
            game,
            opening: opening_index,
            seed,
            white: white.into(),
            winner,
            end,
            plies: played.plies.len() as u32,
            captures: captures(&played),
            cost: costs(&played, a_white),
            error,
        })
    }
}

/// Captures in a game: the dice that left the board.
fn captures(game: &PlayedGame) -> u32 {
    let count = |state: &seks_engine::GameState| {
        (state.board().count(Side::White) + state.board().count(Side::Black)) as u32
    };
    count(&game.start) - count(&game.end)
}

/// The cost of bot A and bot B in `game`.
fn costs(game: &PlayedGame, a_white: bool) -> [Cost; 2] {
    let mut cost = [Cost::default(), Cost::default()];
    for (ply, info) in game.plies.iter().enumerate() {
        // Ply 0 is the side to move at the start.
        let white_moves = (ply % 2 == 0) == (game.start.to_move() == Side::White);
        let bot = usize::from(white_moves != a_white);
        cost[bot].add(&Cost {
            decisions: 1,
            nodes: info.decision.nodes,
            depth: info.decision.depth as u64,
            ms: info.ms,
            max_ms: info.ms,
        });
    }
    cost
}

/// The summary of a batch, from bot A's side.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Summary {
    pub bots: [String; 2],
    pub games: usize,
    pub errors: usize,
    /// Bot A's wins, draws and losses.
    pub wins: u64,
    pub draws: u64,
    pub losses: u64,
    /// Bot A's points per game.
    pub score: f64,
    pub elo: f64,
    pub elo_low: f64,
    pub elo_high: f64,
    /// Win rates of A and B, with their 95% intervals.
    pub win_rate: [f64; 2],
    pub win_rate_low: [f64; 2],
    pub win_rate_high: [f64; 2],
    /// Games per end.
    pub ends: BTreeMap<String, usize>,
    pub mean_plies: f64,
    pub mean_captures: f64,
    /// Per bot: mean and max milliseconds, mean nodes and depth per
    /// decision, and nodes per second.
    pub ms_per_move: [f64; 2],
    pub max_ms: [f64; 2],
    pub nodes_per_move: [f64; 2],
    pub depth_per_move: [f64; 2],
    pub nodes_per_second: [f64; 2],
}

impl Summary {
    pub fn new(bots: &[String; 2], records: &[Record]) -> Summary {
        let mut tally = Tally::default();
        let mut ends = BTreeMap::new();
        let mut cost = [Cost::default(), Cost::default()];
        let mut errors = 0;
        let (mut plies, mut captures) = (0u64, 0u64);
        for record in records {
            if record.error.is_some() {
                errors += 1;
                continue;
            }
            match record.winner.as_deref() {
                Some("a") => tally.wins += 1,
                Some(_) => tally.losses += 1,
                None => tally.draws += 1,
            }
            *ends.entry(record.end.name().to_string()).or_insert(0) += 1;
            plies += record.plies as u64;
            captures += record.captures as u64;
            for (total, game) in cost.iter_mut().zip(&record.cost) {
                total.add(game);
            }
        }
        let n = tally.games().max(1) as f64;
        let (elo_low, elo_high) = tally.elo_interval();
        let rates = [tally, tally.flipped()];
        let per = |f: &dyn Fn(&Cost) -> f64| cost.each_ref().map(f);
        Summary {
            bots: bots.clone(),
            games: records.len(),
            errors,
            wins: tally.wins,
            draws: tally.draws,
            losses: tally.losses,
            score: tally.score(),
            elo: tally.elo(),
            elo_low,
            elo_high,
            win_rate: rates.map(|t| t.win_rate()),
            win_rate_low: rates.map(|t| t.win_rate_interval().0),
            win_rate_high: rates.map(|t| t.win_rate_interval().1),
            ends,
            mean_plies: plies as f64 / n,
            mean_captures: captures as f64 / n,
            ms_per_move: per(&|c| c.ms / c.decisions.max(1) as f64),
            max_ms: per(&|c| c.max_ms),
            nodes_per_move: per(&|c| c.nodes as f64 / c.decisions.max(1) as f64),
            depth_per_move: per(&|c| c.depth as f64 / c.decisions.max(1) as f64),
            nodes_per_second: per(&|c| c.nodes as f64 / (c.ms / 1000.0).max(1e-9)),
        }
    }
}

impl std::fmt::Display for Summary {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let [a, b] = &self.bots;
        writeln!(
            f,
            "A = {a}, B = {b}: {} games, {} errors",
            self.games, self.errors
        )?;
        writeln!(
            f,
            "A: +{} ={} -{}, score {:.3}, Elo {:+.0} [{:+.0}, {:+.0}]",
            self.wins, self.draws, self.losses, self.score, self.elo, self.elo_low, self.elo_high
        )?;
        for (i, name) in ["A", "B"].iter().enumerate() {
            writeln!(
                f,
                "{name} wins {:.1}% [{:.1}, {:.1}]; {:.1} ms/move (max {:.0}), {:.0} nodes/move, depth {:.1}, {:.0} nodes/s",
                100.0 * self.win_rate[i],
                100.0 * self.win_rate_low[i],
                100.0 * self.win_rate_high[i],
                self.ms_per_move[i],
                self.max_ms[i],
                self.nodes_per_move[i],
                self.depth_per_move[i],
                self.nodes_per_second[i],
            )?;
        }
        let ends: Vec<String> = self
            .ends
            .iter()
            .map(|(end, n)| format!("{end} {n}"))
            .collect();
        write!(
            f,
            "ends: {}; {:.1} plies and {:.1} captures per game",
            ends.join(", "),
            self.mean_plies,
            self.mean_captures
        )
    }
}

/// A record without the fields that depend on timing, to compare batches.
pub fn untimed(record: &Record) -> Record {
    let mut record = record.clone();
    for cost in &mut record.cost {
        cost.ms = 0.0;
        cost.max_ms = 0.0;
    }
    record
}
