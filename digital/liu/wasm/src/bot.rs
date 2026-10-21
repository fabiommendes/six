//! The bots of `liu-bots` for JavaScript. A `Bot` reads the position from a
//! [`Game`] and answers a `Command` JSON. It plays on reseeded copies of
//! the state, so it never knows the true dice to come.

use liu_engine::wire;
use wasm_bindgen::prelude::*;

use crate::{error, Game};

/// A bot of a `liu_bots::by_name` spec, with the default weights.
#[wasm_bindgen]
pub struct Bot {
    inner: Box<dyn liu_bots::Bot + Send>,
}

impl Bot {
    /// The command for the player to move in `game`, as a `Command` JSON.
    pub fn choose_command(&mut self, game: &Game, seed: u64) -> Result<String, String> {
        let state = game.game_state();
        if state.is_over() {
            return Err("no legal command: the game is over".into());
        }
        Ok(wire::to_json(&self.inner.choose(state, seed)))
    }
}

#[wasm_bindgen]
impl Bot {
    /// The bot of `spec` (`"greedy:noise=2"`, `"pimc:samples=8"`). Throws on
    /// a spec `liu_bots::by_name` does not read; bot files are refused.
    #[wasm_bindgen(constructor)]
    pub fn new(spec: &str) -> Result<Bot, JsError> {
        if spec.starts_with('@') {
            return Err(error("bot files are not read here"));
        }
        liu_bots::by_name(spec)
            .map(|inner| Bot { inner })
            .map_err(error)
    }

    /// The spec of the bot, with every argument.
    pub fn name(&self) -> String {
        self.inner.name()
    }

    /// The `Command` JSON the bot plays in `game`. The same `seed` gives
    /// the same command on the same position. Throws if the game is over.
    pub fn choose(&mut self, game: &Game, seed: u32) -> Result<String, JsError> {
        self.choose_command(game, u64::from(seed)).map_err(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plays_legal_commands_to_the_end() {
        let mut game = Game::new(3, 5).unwrap();
        let mut bot = Bot::new("pimc:samples=2,top=2,turns=4").unwrap();
        let mut seed = 0;
        while !game.game_state().is_over() {
            seed += 1;
            let command = bot.choose_command(&game, seed).unwrap();
            game.command(&command).unwrap();
        }
        assert!(bot.choose_command(&game, 1).is_err());
    }

    #[test]
    fn the_same_seed_gives_the_same_command() {
        let game = Game::new(2, 9).unwrap();
        let first = Bot::new("greedy:noise=3").unwrap().choose_command(&game, 7);
        let second = Bot::new("greedy:noise=3").unwrap().choose_command(&game, 7);
        assert_eq!(first, second);
    }
}
