//! Self-play: an `ab` bot plays itself from the openings, with root noise in
//! the first plies so that games from the same opening differ, and every
//! position becomes a training sample.

use std::collections::{BTreeMap, HashMap};
use std::io::Write;
use std::num::NonZeroUsize;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;

use seks_engine::{Engine, Side};

use super::dataset::{self, Result, Sample};
use crate::ab::AlphaBeta;
use crate::bot::Bot;
use crate::game_file::End;
use crate::openings::Opening;
use crate::rng::derive;

/// A self-play run. Game `i` starts from opening `i % openings`, with the
/// seed `derive(seed, i)` and the number `first_game + i` in the samples.
#[derive(Clone, Debug)]
pub struct SelfPlay {
    pub bot: String,
    pub openings: Vec<Opening>,
    pub games: usize,
    pub seed: u64,
    pub threads: NonZeroUsize,
    /// Root noise of the first `noise_plies` decisions of each game.
    pub noise: i32,
    pub noise_plies: u32,
    pub max_plies: u32,
    pub first_game: u32,
}

/// What a run produced.
#[derive(Clone, Debug, Default)]
pub struct Produced {
    pub games: usize,
    pub samples: usize,
    pub ends: BTreeMap<End, usize>,
    pub white_wins: usize,
    pub black_wins: usize,
}

impl SelfPlay {
    /// Plays the games and writes the samples to `out` (header first), in
    /// game order, so the same run writes the same bytes.
    pub fn run(
        &self,
        out: &mut impl Write,
        progress: &(dyn Fn(usize) + Sync),
    ) -> std::result::Result<Produced, String> {
        if self.openings.is_empty() {
            return Err("no openings".into());
        }
        AlphaBeta::from_spec(&self.bot)?;
        dataset::write_header(out).map_err(|e| e.to_string())?;
        let next = AtomicUsize::new(0);
        let (sender, receiver) = mpsc::channel();
        let mut produced = Produced::default();
        let mut failure = None;
        std::thread::scope(|scope| {
            for _ in 0..self.threads.get().min(self.games.max(1)) {
                let sender = sender.clone();
                let next = &next;
                scope.spawn(move || {
                    let mut bot = AlphaBeta::from_spec(&self.bot).unwrap();
                    loop {
                        let game = next.fetch_add(1, Ordering::Relaxed);
                        if game >= self.games {
                            break;
                        }
                        let played = self.play(game, &mut bot);
                        let failed = played.is_err();
                        if sender.send((game, played)).is_err() || failed {
                            next.store(self.games, Ordering::Relaxed);
                            break;
                        }
                    }
                });
            }
            drop(sender);
            let mut pending = HashMap::new();
            let mut written = 0;
            for (game, played) in receiver {
                pending.insert(game, played);
                while let Some(played) = pending.remove(&written) {
                    match played {
                        Ok((samples, end, winner)) => {
                            for sample in &samples {
                                if let Err(e) = out.write_all(&sample.encode()) {
                                    failure.get_or_insert(e.to_string());
                                }
                            }
                            produced.games += 1;
                            produced.samples += samples.len();
                            *produced.ends.entry(end).or_insert(0) += 1;
                            match winner {
                                Some(Side::White) => produced.white_wins += 1,
                                Some(Side::Black) => produced.black_wins += 1,
                                None => {}
                            }
                        }
                        Err(e) => {
                            failure.get_or_insert(e);
                        }
                    }
                    written += 1;
                    progress(written);
                }
            }
        });
        match failure {
            Some(error) => Err(error),
            None => Ok(produced),
        }
    }

    #[allow(clippy::type_complexity)]
    fn play(
        &self,
        game: usize,
        bot: &mut AlphaBeta,
    ) -> std::result::Result<(Vec<Sample>, End, Option<Side>), String> {
        let opening = &self.openings[game % self.openings.len()];
        let mut state = opening.state()?;
        let seed = derive(self.seed, game as u64);
        let base_noise = bot.noise();
        bot.new_game();
        let mut samples = Vec::new();
        for ply in 0..self.max_plies {
            if state.outcome().is_some() {
                break;
            }
            bot.set_noise(if ply < self.noise_plies {
                self.noise
            } else {
                base_noise
            });
            let decision = bot.choose(&state, derive(seed, ply as u64));
            samples.push(Sample {
                board: *state.board(),
                to_move: state.to_move(),
                plies_without_capture: state.plies_without_capture(),
                result: Result::Draw,
                score: decision
                    .score
                    .unwrap_or(0)
                    .clamp(i16::MIN as i32, i16::MAX as i32) as i16,
                ply: ply as u16,
                game: self.first_game + game as u32,
            });
            state = Engine::command(&state, decision.command)
                .map_err(|e| format!("game {game}, ply {ply}: {e}"))?
                .state;
        }
        bot.set_noise(base_noise);
        let (winner, end) = End::of(state.outcome());
        let result = match winner {
            Some(Side::White) => Result::Win,
            Some(Side::Black) => Result::Loss,
            None => Result::Draw,
        };
        for sample in &mut samples {
            sample.result = result;
        }
        Ok((samples, end, winner))
    }
}
