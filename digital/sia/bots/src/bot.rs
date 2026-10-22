//! The bots: each picks one of the legal commands of a position.
//!
//! A bot never sees the true dice generator of the state: it plays on
//! copies reseeded from its own seed ([`GameState::reseeded`]), so the dice
//! to come are as unknown to it as to a person.
//!
//! A reroll has hundreds of variants (which die to lose, which hand, which
//! dice to roll). The bots do not enumerate them: [`candidates`] picks the
//! few that make sense, rolling the dice that are worth the least to the
//! owner of the hand, and the dice worth the most when the hand is the
//! other player's.

use serde_json::Value;
use sia_engine::{Command, GameState, Step};

use crate::eval::{chance_with, die_gain, relative, stone_chances, Weights};
use crate::pimc::Pimc;
use crate::rng::Rng;

/// A player of Sia. `seed` drives every random choice, so a decision is
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
/// - `random`: a random legal command that is not a reroll, and a reroll
///   (among the candidates) one time in ten.
/// - `greedy[:ARGS]`: one command of lookahead with the evaluation
///   ([`crate::eval`]). `noise=E` chooses at random among the commands at
///   most `E` points below the best (0 by default), except that a reroll is
///   chosen only when it is the best; `rerolls=R` scores a
///   reroll by the mean of `R` sampled outcomes (3 by default); `cands=C`
///   considers at most `C` rerolls (8 by default, 0 never rerolls);
///   `places=P` considers the `P` placings that raise the chance of the
///   player most (10 by default).
/// - `pimc[:ARGS]`: perfect-information Monte Carlo ([`Pimc`]):
///   `samples=S`, `top=K`, `turns=T` (0: to the end of the game),
///   `temp=X`, `rerolls=R`, `cands=C`, `places=P`.
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
            args.only(&["noise", "rerolls", "cands", "places", "gives"])?;
            let defaults = Greedy::new(weights);
            Box::new(Greedy {
                noise: args.get("noise", defaults.noise)?,
                rerolls: args.get("rerolls", defaults.rerolls)?,
                cands: args.get("cands", defaults.cands)?,
                places: args.get("places", defaults.places)?,
                gives: args.get("gives", defaults.gives)?,
                ..defaults
            })
        }
        "pimc" => {
            args.only(&[
                "samples", "top", "turns", "temp", "rerolls", "cands", "places", "gives",
            ])?;
            let defaults = Pimc::new(weights);
            let pimc = Pimc {
                samples: args.get("samples", defaults.samples)?,
                top: args.get("top", defaults.top)?,
                turns: args.get("turns", defaults.turns)?,
                temp: args.get("temp", defaults.temp)?,
                rerolls: args.get("rerolls", defaults.rerolls)?,
                cands: args.get("cands", defaults.cands)?,
                places: args.get("places", defaults.places)?,
                gives: args.get("gives", defaults.gives)?,
                ..defaults
            };
            if pimc.samples == 0 || pimc.top == 0 {
                return Err(format!("bot {spec}: samples and top must be positive"));
            }
            if pimc.rerolls == 0 && pimc.cands > 0 {
                return Err(format!("bot {spec}: rerolls must be positive"));
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

/// The reroll variants worth a look, at most `limit`, the more promising
/// first. Each one loses one of the two least useful dice of the own hand
/// and rolls the `k` dice (1 to 3) that are worth the least to the owner of
/// the hand: the own, or the other hand's most useful ones.
pub fn reroll_candidates(state: &GameState, limit: usize) -> Vec<Command> {
    let me = state.to_move();
    let other = 1 - me;
    if limit == 0 || state.is_over() || state.step() != Step::Reroll || state.hand(me).len() < 2 {
        return Vec::new();
    }
    let gains = |player: usize| -> Vec<f64> {
        let base = stone_chances(state, player);
        state
            .hand(player)
            .iter()
            .map(|&die| die_gain(state, player, die, &base))
            .collect()
    };
    let (own_gain, other_gain) = (gains(me), gains(other));
    let order = |gain: &[f64], skip: Option<usize>, descending: bool| -> Vec<usize> {
        let mut order: Vec<usize> = (0..gain.len()).filter(|&i| Some(i) != skip).collect();
        order.sort_by(|&a, &b| {
            let by_gain = gain[a].total_cmp(&gain[b]);
            (if descending {
                by_gain.reverse()
            } else {
                by_gain
            })
            .then(a.cmp(&b))
        });
        order
    };
    // Lost dice: the least useful ones, one per distinct die.
    let mut lost_options: Vec<usize> = Vec::new();
    let hand = state.hand(me);
    for i in order(&own_gain, None, false) {
        if lost_options.iter().all(|&j| hand[j] != hand[i]) {
            lost_options.push(i);
        }
        if lost_options.len() == 2 {
            break;
        }
    }
    let mask = |indexes: &[usize]| indexes.iter().fold(0u16, |m, &i| m | 1 << i);
    let mut commands = Vec::new();
    for k in 1..=3 {
        for &lost in &lost_options {
            let own = order(&own_gain, Some(lost), false);
            if own.len() >= k {
                commands.push(Command::Reroll {
                    target: me,
                    lost,
                    dice: mask(&own[..k]),
                });
            }
            let theirs = order(&other_gain, None, true);
            if theirs.len() >= k {
                commands.push(Command::Reroll {
                    target: other,
                    lost,
                    dice: mask(&theirs[..k]),
                });
            }
        }
    }
    commands.truncate(limit);
    commands
}

/// The claims and the pass, and the `places` placings that raise most the
/// chance of the player to move on the stone. In the experiment variant with
/// the move, also the `gives` placings on the opponent that lower most his
/// chance.
pub fn actions(state: &GameState, places: usize, gives: usize) -> Vec<Command> {
    let me = state.to_move();
    let base = stone_chances(state, me);
    let mut ranked: Vec<(f64, Command)> = Vec::new();
    let mut given: Vec<(f64, Command)> = Vec::new();
    let other_base = stone_chances(state, 1 - me);
    let mut commands = Vec::new();
    for command in state.legal_actions() {
        match command {
            Command::Place { die, stone } => {
                let gain = chance_with(state, me, stone, state.hand(me)[die]) - base[stone];
                ranked.push((gain, command));
            }
            Command::PlaceOnOpponent { die, stone } => {
                // The gain of the player is the loss of the chance of the other.
                let gain =
                    other_base[stone] - chance_with(state, 1 - me, stone, state.hand(me)[die]);
                given.push((gain, command));
            }
            _ => commands.push(command),
        }
    }
    ranked.sort_by(|a, b| b.0.total_cmp(&a.0));
    given.sort_by(|a, b| b.0.total_cmp(&a.0));
    commands.extend(ranked.into_iter().take(places).map(|(_, c)| c));
    commands.extend(given.into_iter().take(gives).map(|(_, c)| c));
    commands
}

/// The commands a bot considers: the [`actions`] and at most `rerolls`
/// rerolls ([`reroll_candidates`]).
pub fn candidates(state: &GameState, places: usize, gives: usize, rerolls: usize) -> Vec<Command> {
    let mut commands = actions(state, places, gives);
    commands.extend(reroll_candidates(state, rerolls));
    commands
}

/// Plays a random command: among the placings, claims and the pass, and
/// one time in ten a reroll.
#[derive(Clone, Copy, Debug, Default)]
pub struct Random;

impl Bot for Random {
    fn name(&self) -> String {
        "random".into()
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Command {
        let mut rng = Rng::new(seed);
        let actions = state.legal_actions();
        assert!(!actions.is_empty(), "the game is over");
        if rng.below(10) == 0 {
            let rerolls = reroll_candidates(state, 12);
            if !rerolls.is_empty() {
                return rerolls[rng.below(rerolls.len())];
            }
        }
        actions[rng.below(actions.len())]
    }
}

/// One command of lookahead: the command whose next position the
/// evaluation likes best, ties at random.
#[derive(Clone, Debug)]
pub struct Greedy {
    pub weights: Weights,
    /// Chooses among the commands at most this many points below the best
    /// (a reroll only when it is the best).
    pub noise: f64,
    /// Sampled outcomes that score a reroll.
    pub rerolls: u32,
    /// Rerolls considered at most; 0 never rerolls.
    pub cands: usize,
    /// Placings on the opponent considered at most (experiment only).
    pub gives: usize,
    /// Placings considered at most.
    pub places: usize,
}

impl Greedy {
    pub fn new(weights: Weights) -> Greedy {
        Greedy {
            weights,
            noise: 0.0,
            rerolls: 3,
            cands: 8,
            places: 10,
            gives: 10,
        }
    }

    /// The score of each command for the player to move ([`relative`]). A
    /// reroll scores the mean, over `rerolls` sampled outcomes, of the best
    /// way to finish the turn after it.
    pub fn scores(&self, state: &GameState, commands: &[Command], rng: &mut Rng) -> Vec<f64> {
        let seat = state.to_move();
        let world = state.reseeded(rng.next_u64());
        commands
            .iter()
            .map(|&command| {
                if matches!(command, Command::Reroll { .. }) {
                    let total: f64 = (0..self.rerolls)
                        .map(|_| {
                            let rolled = state
                                .reseeded(rng.next_u64())
                                .apply(command)
                                .expect("a listed reroll is legal")
                                .0;
                            self.best_finish(&rolled, seat)
                        })
                        .sum();
                    total / f64::from(self.rerolls)
                } else {
                    self.after(&world, command, seat)
                }
            })
            .collect()
    }

    /// The value of `command`; a claim is worth the best placing after it.
    fn after(&self, state: &GameState, command: Command, seat: usize) -> f64 {
        let next = state.apply(command).expect("a listed command is legal").0;
        if matches!(command, Command::Claim { .. }) && !next.is_over() {
            self.best_placing(&next, seat)
        } else {
            relative(&self.weights, &next, seat)
        }
    }

    /// The best value of a placing (or the pass) from a position in the turn.
    fn best_placing(&self, state: &GameState, seat: usize) -> f64 {
        actions(state, self.places, self.gives)
            .into_iter()
            .filter(|c| !matches!(c, Command::Claim { .. }))
            .map(|c| self.after(state, c, seat))
            .fold(f64::NEG_INFINITY, f64::max)
    }

    /// The best value of finishing the turn from a position in it.
    fn best_finish(&self, state: &GameState, seat: usize) -> f64 {
        actions(state, self.places, self.gives)
            .into_iter()
            .map(|c| self.after(state, c, seat))
            .fold(f64::NEG_INFINITY, f64::max)
    }

    /// The commands this bot considers in `state`.
    pub fn commands(&self, state: &GameState) -> Vec<Command> {
        candidates(
            state,
            self.places,
            self.gives,
            if self.rerolls == 0 { 0 } else { self.cands },
        )
    }

    /// The index of the command to play among `commands`.
    pub fn pick(&self, state: &GameState, commands: &[Command], rng: &mut Rng) -> usize {
        if commands.len() == 1 {
            return 0;
        }
        let scores = self.scores(state, commands, rng);
        let best = scores.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        // The noise does not reach the rerolls: a reroll costs a die for good,
        // so only the best-scored command can be one.
        let near: Vec<usize> = (0..scores.len())
            .filter(|&i| {
                scores[i] >= best - self.noise
                    && (scores[i] >= best || !matches!(commands[i], Command::Reroll { .. }))
            })
            .collect();
        near[rng.below(near.len())]
    }
}

impl Bot for Greedy {
    fn name(&self) -> String {
        let gives = if self.gives == self.places {
            String::new()
        } else {
            format!(",gives={}", self.gives)
        };
        format!(
            "greedy:noise={},rerolls={},cands={},places={}{gives}",
            self.noise, self.rerolls, self.cands, self.places
        )
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Command {
        let commands = self.commands(state);
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
            "greedy:noise=0.5,rerolls=2,cands=4",
            "pimc:samples=4,top=3",
        ] {
            assert!(by_name(spec).is_ok(), "{spec}");
        }
        assert_eq!(
            by_name("greedy:noise=1.5").unwrap().name(),
            "greedy:noise=1.5,rerolls=3,cands=8,places=10"
        );
        for spec in ["greedy:depth=2", "pimc:samples=0", "nobody", "greedy:noise"] {
            assert!(by_name(spec).is_err(), "{spec}");
        }
    }

    #[test]
    fn a_bot_file_replaces_some_weights() {
        let bot = from_file(r#"{"bot": "greedy", "weights": {"hand": 2}}"#).unwrap();
        assert_eq!(bot.name(), "greedy:noise=0,rerolls=3,cands=8,places=10");
        assert!(from_file(r#"{"bot": "greedy", "weights": {"nope": 2}}"#).is_err());
    }

    #[test]
    fn the_reroll_candidates_are_legal() {
        for seed in 0..40 {
            let (state, _) = GameState::new(seed);
            let rerolls = reroll_candidates(&state, 12);
            assert!(!rerolls.is_empty());
            assert!(rerolls.len() <= 12);
            for command in rerolls {
                assert!(state.apply(command).is_ok(), "{command:?}");
            }
        }
    }

    #[test]
    fn every_bot_plays_legal_commands_to_the_end() {
        for spec in ["random", "greedy", "pimc:samples=2,top=3,turns=6"] {
            for seed in [7, 8] {
                let mut bot = by_name(spec).unwrap();
                let (mut state, _) = GameState::new(seed);
                let mut n = 0;
                while !state.is_over() {
                    n += 1;
                    let command = bot.choose(&state, n);
                    state = state
                        .apply(command)
                        .unwrap_or_else(|e| {
                            panic!("{spec} played {command:?}: {e}");
                        })
                        .0;
                    assert!(n < 3000);
                }
            }
        }
    }

    #[test]
    fn the_bots_ignore_the_true_dice() {
        // Two states that differ only in the generator get the same choice.
        let (state, _) = GameState::new(11);
        for spec in ["greedy", "pimc:samples=2,top=3,turns=6"] {
            let mut bot = by_name(spec).unwrap();
            let a = bot.choose(&state, 5);
            let b = bot.choose(&state.reseeded(123_456), 5);
            assert_eq!(a, b, "{spec}");
        }
    }
}
