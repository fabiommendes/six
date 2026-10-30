//! The bots of `conexao-bots` for JavaScript. A `Bot` reads the position
//! from a [`Game`] and answers a `Move` JSON.

use wasm_bindgen::prelude::*;

use crate::{error, wire, Game};

/// A bot of `conexao_bots::by_name`.
#[wasm_bindgen]
pub struct Bot {
    inner: Box<dyn conexao_bots::Bot>,
}

impl Bot {
    /// The move for the player to move in `game`.
    pub fn choose_move(&mut self, game: &Game) -> Result<wire::Move, String> {
        let position = game.position();
        if position.outcome.is_some() {
            return Err("no legal move: the game is over".into());
        }
        Ok(self.inner.choose(position).into())
    }
}

#[wasm_bindgen]
impl Bot {
    /// The bot `name` (`"random"`, `"greedy"`, `"noblock"`, `"lookahead"` or
    /// `"search"`); `seed` breaks its ties. Throws on an unknown name.
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str, seed: u32) -> Result<Bot, JsError> {
        conexao_bots::by_name(name, u64::from(seed))
            .map(|inner| Bot { inner })
            .map_err(error)
    }

    /// The `Move` JSON the bot plays in `game`. Throws if the game is over.
    pub fn choose(&mut self, game: &Game) -> Result<String, JsError> {
        self.choose_move(game)
            .map(|mv| wire::to_json(&mv))
            .map_err(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plays_legal_moves_to_the_end() {
        let rules = r#"{"size":9,"goal":"reach","dice":12,"placedValue":2,"blocking":true,"blockHome":false,"blockFromBoard":true,"capture":true,"maxTurns":120}"#;
        let mut game = Game::with_rules(rules).unwrap_or_else(|_| panic!("rules"));
        let mut bots = [
            Bot::new("greedy", 1).unwrap_or_else(|_| panic!("bot")),
            Bot::new("random", 2).unwrap_or_else(|_| panic!("bot")),
        ];
        let mut turn = 0;
        while game.position().outcome.is_none() {
            let mv = bots[turn % 2].choose_move(&game).unwrap();
            game.play_move(mv).unwrap();
            turn += 1;
        }
        assert!(bots[0].choose_move(&game).is_err());
        assert!(game.can_undo());
    }
}
