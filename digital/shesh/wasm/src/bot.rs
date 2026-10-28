//! The bots of `shesh-bots` for JavaScript. A `Bot` reads the position from
//! a [`Game`] and answers a `Command` JSON. It never reads the generator of
//! the state, so it does not know the rolls to come.

use shesh_engine::wire;
use wasm_bindgen::prelude::*;

use crate::{error, Game};

/// A bot of `shesh_bots::by_name`.
#[wasm_bindgen]
pub struct Bot {
    inner: Box<dyn shesh_bots::Bot>,
}

impl Bot {
    /// The command for the player to move in `game`, as a `Command` JSON.
    pub fn choose_command(&mut self, game: &Game) -> Result<String, String> {
        let state = game.game_state();
        if state.end().is_some() {
            return Err("no legal command: the game is over".into());
        }
        Ok(wire::to_json(&self.inner.choose(state)))
    }
}

#[wasm_bindgen]
impl Bot {
    /// The bot `name` (`"random"`, `"greedy"` or `"expecti"`); `seed` feeds
    /// the randomness of the random bot. Throws on an unknown name.
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str, seed: u32) -> Result<Bot, JsError> {
        shesh_bots::by_name(name, u64::from(seed))
            .map(|inner| Bot { inner })
            .map_err(error)
    }

    /// The `Command` JSON the bot plays in `game`. Throws if the game is
    /// over.
    pub fn choose(&mut self, game: &Game) -> Result<String, JsError> {
        self.choose_command(game).map_err(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plays_legal_commands_to_the_end() {
        let mut game = Game::new(5);
        let mut bot = Bot::new("expecti", 1).unwrap();
        while game.game_state().end().is_none() {
            let command = bot.choose_command(&game).unwrap();
            game.command(&command).unwrap();
        }
        assert!(bot.choose_command(&game).is_err());
    }
}
