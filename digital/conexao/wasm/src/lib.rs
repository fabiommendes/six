//! WebAssembly bindings of the dice connection game (prototype).
//!
//! Everything structured crosses the boundary as JSON text in the formats of
//! [`wire`] (the TypeScript types are in `types/`, generated with `just
//! conexao-types`). Errors are thrown as JavaScript exceptions and change
//! nothing.
//!
//! The rules live in the engine: `Game` only keeps a game and its undo
//! stack, so an interface never decides what is legal. `Bot` is a bot of
//! `conexao-bots` that reads the position of a `Game`.

use conexao_engine::Rules;
use wasm_bindgen::prelude::*;

mod bot;
pub mod wire;

pub use bot::Bot;
use wire::{State, Transition, View};

fn error(message: impl ToString) -> JsError {
    JsError::new(&message.to_string())
}

/// A game in progress on this device: the position and the undo stack.
#[wasm_bindgen]
pub struct Game {
    game: conexao_engine::Game,
    undo: Vec<conexao_engine::Game>,
}

impl Game {
    /// The position, for the bots.
    pub fn position(&self) -> &conexao_engine::Game {
        &self.game
    }

    fn from_parts(game: conexao_engine::Game) -> Game {
        Game {
            game,
            undo: Vec::new(),
        }
    }

    /// Plays a move and returns the transition; the position is unchanged
    /// on an illegal move.
    pub fn play_move(&mut self, mv: wire::Move) -> Result<Transition, String> {
        let mut next = self.game.clone();
        next.play(mv.into())?;
        let transition = Transition::of(mv, &self.game, &next);
        self.undo.push(std::mem::replace(&mut self.game, next));
        Ok(transition)
    }
}

#[wasm_bindgen]
impl Game {
    /// A new game with the rules of the proposal (9 by 9, the line, 12
    /// dice, capture).
    #[wasm_bindgen(constructor)]
    pub fn new() -> Game {
        Game::from_parts(conexao_engine::Game::new(Rules::proposal()))
    }

    /// A new game with the rules as `Rules` JSON. Throws on rules out of
    /// range.
    #[wasm_bindgen(js_name = withRules)]
    pub fn with_rules(rules: &str) -> Result<Game, JsError> {
        let rules: wire::Rules = wire::from_json(rules).map_err(error)?;
        Ok(Game::from_parts(conexao_engine::Game::new(
            rules.to_engine().map_err(error)?,
        )))
    }

    /// The rules of the proposal, as `Rules` JSON.
    #[wasm_bindgen(js_name = defaultRules)]
    pub fn default_rules() -> String {
        wire::to_json(&wire::Rules::from(Rules::proposal()))
    }

    /// A game that continues from a `State` JSON, with nothing to undo.
    /// Throws if the state is not one the engine could have reached.
    #[wasm_bindgen(js_name = fromState)]
    pub fn from_state(json: &str) -> Result<Game, JsError> {
        let state: State = wire::from_json(json).map_err(error)?;
        Ok(Game::from_parts(state.to_game().map_err(error)?))
    }

    /// The whole game as a `State` JSON, to save it.
    pub fn state(&self) -> String {
        wire::to_json(&State::of(&self.game))
    }

    /// What to show, as a `View` JSON.
    pub fn view(&self) -> String {
        wire::to_json(&View::of(&self.game))
    }

    /// Plays a `Move` JSON and returns a `Transition` JSON: the dice the
    /// move captured and the new view. Throws if the move is illegal.
    pub fn play(&mut self, json: &str) -> Result<String, JsError> {
        let mv: wire::Move = wire::from_json(json).map_err(error)?;
        self.play_move(mv).map(|t| wire::to_json(&t)).map_err(error)
    }

    #[wasm_bindgen(js_name = canUndo)]
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    /// Takes back the last move and returns the `View` JSON. Throws if there
    /// is nothing to undo.
    pub fn undo(&mut self) -> Result<String, JsError> {
        self.game = self.undo.pop().ok_or_else(|| error("nothing to undo"))?;
        Ok(self.view())
    }
}

impl Default for Game {
    fn default() -> Game {
        Game::new()
    }
}
