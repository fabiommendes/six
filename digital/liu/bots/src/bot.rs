//! The bots: each picks one of the legal commands of a position.
//!
//! A bot never sees the true dice generator of the state: it plays on
//! copies reseeded from its own seed ([`GameState::reseeded`]), so the
//! bag and the rerolls are as unknown to it as to a person.

use liu_engine::{Command, GameState};
use serde_json::Value;

use crate::eval::{relative, Weights};
use crate::pimc::Pimc;
use crate::rng::Rng;

/// A player of Liu. `seed` drives every random choice, so a decision is
/// reproducible.
pub trait Bot {
    /// The spec that [`by_name`] reads back into this bot (without the
    /// weights).
    fn name(&self) -> String;

    /// One of the legal commands of `state`, which is not over.
    fn choose(&mut self, state: &GameState, seed: u64) -> Command;
}

/// The bot `spec` stands for. `ARGS` are comma separated `key=value`, in
/// any order:
///
/// - `random`: a uniform choice among the legal commands.
/// - `greedy[:ARGS]`: one command of lookahead with the evaluation
///   ([`crate::eval`]). `noise=E` chooses at random among the commands at
///   most `E` points below the best (0 by default); `rerolls=R` scores a
///   reroll by the mean of `R` sampled markets (4 by default).
/// - `pimc[:ARGS]`: perfect-information Monte Carlo ([`Pimc`]):
///   `samples=S`, `top=K`, `turns=T` (0: to the end of the game),
///   `temp=X`, `rerolls=R`.
/// - `@FILE`: a bot file, `{"bot": SPEC, "weights": {...}}`. The weights it
///   lists replace those of `weights/default.json`.
pub fn by_name(spec: &str) -> Result<Box<dyn Bot + Send>, String> {
    if let Some(path) = spec.strip_prefix('@') {
        let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
        return from_file(&text).map_err(|e| format!("{path}: {e}"));
    }
    with_weights(spec, Weights::default())
}

/// The bot of a bot file's text, `{"bot": SPEC, "weights": {...}}`.
pub fn from_file(text: &str) -> Result<Box<dyn Bot + Send>, String> {
    let root: Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
    let spec = root
        .get("bot")
        .and_then(Value::as_str)
        .ok_or("a bot file needs a \"bot\" spec")?;
    let mut weights = Weights::default();
    if let Some(object) = root.get("weights") {
        weights.update(object.as_object().ok_or("\"weights\" must be an object")?)?;
    }
    with_weights(spec, weights)
}

/// The bot of `spec` with `weights`.
pub fn with_weights(spec: &str, weights: Weights) -> Result<Box<dyn Bot + Send>, String> {
    let (name, args) = spec.split_once(':').unwrap_or((spec, ""));
    let args = Args::parse(spec, args)?;
    let bot: Box<dyn Bot + Send> = match name {
        "random" => {
            args.only(&[])?;
            Box::new(Random)
        }
        "greedy" => {
            args.only(&["noise", "rerolls"])?;
            let defaults = Greedy::new(weights);
            Box::new(Greedy {
                noise: args.get("noise", defaults.noise)?,
                rerolls: args.get("rerolls", defaults.rerolls)?,
                ..defaults
            })
        }
        "pimc" => {
            args.only(&["samples", "top", "turns", "temp", "rerolls"])?;
            let defaults = Pimc::new(weights);
            let pimc = Pimc {
                samples: args.get("samples", defaults.samples)?,
                top: args.get("top", defaults.top)?,
                turns: args.get("turns", defaults.turns)?,
                temp: args.get("temp", defaults.temp)?,
                rerolls: args.get("rerolls", defaults.rerolls)?,
                ..defaults
            };
            if pimc.samples == 0 || pimc.top == 0 || pimc.rerolls == 0 {
                return Err(format!(
                    "bot {spec}: samples, top and rerolls must be positive"
                ));
            }
            if pimc.temp <= 0.0 {
                return Err(format!("bot {spec}: temp must be positive"));
            }
            Box::new(pimc)
        }
        _ => return Err(format!("unknown bot {spec:?}")),
    };
    Ok(bot)
}

/// The `key=value` arguments of a spec.
struct Args<'a> {
    spec: &'a str,
    pairs: Vec<(&'a str, &'a str)>,
}

impl<'a> Args<'a> {
    fn parse(spec: &'a str, args: &'a str) -> Result<Args<'a>, String> {
        let mut pairs = Vec::new();
        for item in args.split(',').filter(|item| !item.is_empty()) {
            let pair = item
                .split_once('=')
                .ok_or(format!("bot {spec}: {item:?} is not key=value"))?;
            pairs.push(pair);
        }
        Ok(Args { spec, pairs })
    }

    fn only(&self, keys: &[&str]) -> Result<(), String> {
        match self.pairs.iter().find(|(key, _)| !keys.contains(key)) {
            Some((key, _)) => Err(format!("bot {}: unknown argument {key:?}", self.spec)),
            None => Ok(()),
        }
    }

    fn get<T: std::str::FromStr>(&self, key: &str, default: T) -> Result<T, String> {
        match self.pairs.iter().find(|(k, _)| *k == key) {
            Some((_, value)) => value
                .parse()
                .map_err(|_| format!("bot {}: bad {key} {value:?}", self.spec)),
            None => Ok(default),
        }
    }
}

/// Plays a uniformly random legal command.
#[derive(Clone, Copy, Debug, Default)]
pub struct Random;

impl Bot for Random {
    fn name(&self) -> String {
        "random".into()
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Command {
        let commands = state.legal_commands();
        assert!(!commands.is_empty(), "the game is over");
        commands[Rng::new(seed).below(commands.len())]
    }
}

/// One command of lookahead: the command whose next position the
/// evaluation likes best, ties at random.
#[derive(Clone, Debug)]
pub struct Greedy {
    pub weights: Weights,
    /// Chooses among the commands at most this many points below the best.
    pub noise: f64,
    /// Sampled markets that score a reroll.
    pub rerolls: u32,
}

impl Greedy {
    pub fn new(weights: Weights) -> Greedy {
        Greedy {
            weights,
            noise: 0.0,
            rerolls: 4,
        }
    }

    /// The score of each command for the player to move ([`relative`]). A
    /// reroll scores the mean, over `rerolls` sampled markets, of the best
    /// die to take from it.
    pub fn scores(&self, state: &GameState, commands: &[Command], rng: &mut Rng) -> Vec<f64> {
        let seat = state.to_move();
        let world = state.reseeded(rng.next_u64());
        commands
            .iter()
            .map(|&command| {
                if command == Command::Reroll {
                    let total: f64 = (0..self.rerolls)
                        .map(|_| {
                            let rolled = state
                                .reseeded(rng.next_u64())
                                .apply(Command::Reroll)
                                .expect("a listed reroll is legal")
                                .0;
                            rolled
                                .legal_commands()
                                .into_iter()
                                .map(|take| self.after(&rolled, take, seat))
                                .fold(f64::NEG_INFINITY, f64::max)
                        })
                        .sum();
                    total / f64::from(self.rerolls)
                } else {
                    self.after(&world, command, seat)
                }
            })
            .collect()
    }

    fn after(&self, state: &GameState, command: Command, seat: usize) -> f64 {
        let next = state.apply(command).expect("a listed command is legal").0;
        relative(&self.weights, &next, seat)
    }

    /// The index of the command to play among `commands`.
    pub fn pick(&self, state: &GameState, commands: &[Command], rng: &mut Rng) -> usize {
        if commands.len() == 1 {
            return 0;
        }
        let scores = self.scores(state, commands, rng);
        let best = scores.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let near: Vec<usize> = (0..scores.len())
            .filter(|&i| scores[i] >= best - self.noise)
            .collect();
        near[rng.below(near.len())]
    }
}

impl Bot for Greedy {
    fn name(&self) -> String {
        format!("greedy:noise={},rerolls={}", self.noise, self.rerolls)
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Command {
        let commands = state.legal_commands();
        assert!(!commands.is_empty(), "the game is over");
        commands[self.pick(state, &commands, &mut Rng::new(seed))]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn specs_read_back() {
        for spec in [
            "random",
            "greedy:noise=0.5,rerolls=2",
            "pimc:samples=4,top=3",
        ] {
            assert!(by_name(spec).is_ok(), "{spec}");
        }
        assert_eq!(
            by_name("greedy:noise=1.5").unwrap().name(),
            "greedy:noise=1.5,rerolls=4"
        );
        for spec in ["greedy:depth=2", "pimc:samples=0", "nobody", "greedy:noise"] {
            assert!(by_name(spec).is_err(), "{spec}");
        }
    }

    #[test]
    fn a_bot_file_replaces_some_weights() {
        let bot = from_file(r#"{"bot": "greedy", "weights": {"dice": 2}}"#).unwrap();
        assert_eq!(bot.name(), "greedy:noise=0,rerolls=4");
        assert!(from_file(r#"{"bot": "greedy", "weights": {"nope": 2}}"#).is_err());
    }

    #[test]
    fn every_bot_plays_legal_commands_to_the_end() {
        for spec in ["random", "greedy", "pimc:samples=2,top=3,turns=4"] {
            for players in 2..=4 {
                let mut bot = by_name(spec).unwrap();
                let (mut state, _) = GameState::new(players, 7);
                let mut seed = 0;
                while !state.is_over() {
                    seed += 1;
                    let command = bot.choose(&state, seed);
                    assert!(state.legal_commands().contains(&command), "{spec}");
                    state = state.apply(command).unwrap().0;
                }
            }
        }
    }

    #[test]
    fn the_bots_ignore_the_true_dice() {
        // Two states that differ only in the generator get the same choice.
        let (state, _) = GameState::new(2, 11);
        for spec in ["greedy", "pimc:samples=2,top=3,turns=4"] {
            let mut bot = by_name(spec).unwrap();
            let a = bot.choose(&state, 5);
            let b = bot.choose(&state.reseeded(123_456), 5);
            assert_eq!(a, b, "{spec}");
        }
    }
}
