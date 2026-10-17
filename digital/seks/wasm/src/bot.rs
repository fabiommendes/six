//! The alpha-beta bot of `seks-bots` for JavaScript (R4 of
//! `dev/issues/seks-wasm.md`).
//!
//! A [`Bot`] keeps its transposition table between plays, so one `Bot` serves
//! a whole game in a Web Worker: it reads the position from a [`Game`] and
//! answers a command in the text notation of the engine. It never runs on a
//! clock: the strength is a budget of search nodes, so it is the same on any
//! machine, only slower or faster.

use seks_bots::ab::AlphaBeta;
use seks_bots::eval::Weights;
use seks_bots::search::Limits;
use seks_bots::Bot as _;
use seks_engine::legal_commands;
use wasm_bindgen::prelude::*;

use crate::{error, Game};

/// The alpha-beta bot with the default weights and contempt.
#[wasm_bindgen]
pub struct Bot {
    inner: AlphaBeta,
}

impl Bot {
    /// A bot that searches `nodes` positions per play, at most `depth` plies
    /// deep, choosing at random among the plays at most `noise` below the
    /// best one (0: always the best). With neither `nodes` nor `depth`, the
    /// default level (`AlphaBeta::DEFAULT_NODES`); with only `depth`, no
    /// limit of nodes, as in the `ab:depth=D` spec of `seks_bots::by_name`.
    pub fn with_limits(nodes: Option<u32>, depth: Option<u32>, noise: i32) -> Result<Bot, String> {
        if depth == Some(0) {
            return Err("depth must be at least 1".into());
        }
        if noise < 0 {
            return Err("noise must not be negative".into());
        }
        let unlimited = Limits::default();
        let nodes = match (nodes, depth) {
            (Some(nodes), _) => u64::from(nodes),
            (None, None) => AlphaBeta::DEFAULT_NODES,
            (None, Some(_)) => unlimited.nodes,
        };
        let limits = Limits {
            depth: depth.unwrap_or(unlimited.depth),
            nodes,
        };
        let spec = format!("ab:nodes={nodes},depth={},noise={noise}", limits.depth);
        Ok(Bot {
            inner: AlphaBeta::new(&spec, &Weights::default(), limits, noise),
        })
    }

    /// The command for the side to move in `game`.
    pub fn choose_command(&mut self, game: &Game, seed: u64) -> Result<String, String> {
        let state = game.game_state();
        if legal_commands(state).is_empty() {
            return Err("no legal command: the game is over".into());
        }
        Ok(self.inner.choose(state, seed).command.to_string())
    }

    /// Forgets the transposition table (see `seks_bots::Bot::new_game`).
    pub fn forget(&mut self) {
        self.inner.new_game();
    }
}

#[wasm_bindgen]
impl Bot {
    /// A bot of `nodes` search nodes per play, `depth` plies at most and
    /// `noise` (see [`Bot::with_limits`]); `undefined` leaves a limit out.
    /// Throws if `depth` is 0 or `noise` is negative.
    #[wasm_bindgen(constructor)]
    pub fn new(nodes: Option<u32>, depth: Option<u32>, noise: i32) -> Result<Bot, JsError> {
        Bot::with_limits(nodes, depth, noise).map_err(error)
    }

    /// Nodes per play of the default level, which is what a bot gets with no
    /// `nodes` and no `depth`.
    #[wasm_bindgen(js_name = defaultNodes)]
    pub fn default_nodes() -> u32 {
        u32::try_from(AlphaBeta::DEFAULT_NODES).unwrap_or(u32::MAX)
    }

    /// Clears what the bot kept from earlier plays: call it when a new game
    /// starts.
    #[wasm_bindgen(js_name = newGame)]
    pub fn new_game(&mut self) {
        self.forget();
    }

    /// The command (`"b2-b4"`, `"b2+"`) that the bot plays in `game`. The
    /// same `seed` gives the same command on the same position. Throws if
    /// the game is over.
    pub fn choose(&mut self, game: &Game, seed: u32) -> Result<String, JsError> {
        self.choose_command(game, u64::from(seed)).map_err(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FEW_NODES: u32 = 300;

    fn bot(nodes: u32, noise: i32) -> Bot {
        Bot::with_limits(Some(nodes), None, noise).unwrap()
    }

    fn legal(game: &Game) -> Vec<String> {
        legal_commands(game.game_state())
            .iter()
            .map(ToString::to_string)
            .collect()
    }

    #[test]
    fn plays_a_legal_command() {
        let game = Game::new();
        let command = bot(FEW_NODES, 0).choose_command(&game, 1).unwrap();
        assert!(legal(&game).contains(&command), "{command}");
    }

    #[test]
    fn the_same_seed_gives_the_same_command() {
        let game = Game::new();
        let first = bot(FEW_NODES, 200).choose_command(&game, 7).unwrap();
        let second = bot(FEW_NODES, 200).choose_command(&game, 7).unwrap();
        assert_eq!(first, second);
    }

    #[test]
    fn a_new_game_makes_the_bot_forget_its_table() {
        let game = Game::new();
        let mut used = bot(FEW_NODES, 0);
        let fresh = bot(FEW_NODES, 0).choose_command(&game, 3).unwrap();
        for seed in 0..3 {
            used.choose_command(&game, seed).unwrap();
        }
        used.forget();
        assert_eq!(used.choose_command(&game, 3).unwrap(), fresh);
    }

    #[test]
    fn noise_changes_the_choice_for_some_seed() {
        let game = Game::new();
        let sharp = bot(FEW_NODES, 0).choose_command(&game, 0).unwrap();
        let blurred: Vec<String> = (0..40)
            .map(|seed| bot(FEW_NODES, 100_000).choose_command(&game, seed).unwrap())
            .collect();
        assert!(blurred.iter().any(|command| *command != sharp));
        assert!(blurred.iter().all(|command| legal(&game).contains(command)));
    }

    #[test]
    fn refuses_a_finished_game() {
        let mut game = Game::from_diagram(
            "
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. w3 .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. b1
            ",
            "white",
        )
        .map_err(|_| ())
        .unwrap();
        // The only white die reaches row 11: the Whites win.
        let best = bot(FEW_NODES, 0).choose_command(&game, 0).unwrap();
        assert_eq!(best, "c8-c11");
        game.command(&best).map_err(|_| ()).unwrap();
        let error = bot(FEW_NODES, 0).choose_command(&game, 0).unwrap_err();
        assert!(error.contains("game is over"), "{error}");
    }

    #[test]
    fn rejects_bad_parameters() {
        assert!(Bot::with_limits(None, Some(0), 0).is_err());
        assert!(Bot::with_limits(None, None, -1).is_err());
        assert!(Bot::with_limits(None, None, 0).is_ok());
        assert!(Bot::with_limits(None, Some(2), 0).is_ok());
    }

    #[test]
    fn plays_a_short_game_against_itself() {
        let mut game = Game::new();
        let mut bot = bot(FEW_NODES, 0);
        bot.forget();
        for seed in 0..12 {
            let command = bot.choose_command(&game, seed).unwrap();
            game.command(&command).map_err(|_| ()).unwrap();
        }
        assert!(!game.legal_commands().is_empty());
    }
}
