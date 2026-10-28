//! WebAssembly bindings of the Shesh engine.
//!
//! Everything structured crosses the boundary as JSON text in the formats of
//! `shesh_engine::wire` (the TypeScript types are in `types/`, generated with
//! `just shesh-types`). Errors are thrown as JavaScript exceptions and change
//! nothing.
//!
//! The rules live in the engine: `Game` only keeps a game and its undo
//! stack, so an interface never decides what is legal. `Bot` is a bot of
//! `shesh-bots` that reads the position of a `Game`.

use shesh_engine::wire::{self, Transition, View};
use shesh_engine::{GameState, Rules};
use wasm_bindgen::prelude::*;

mod bot;

pub use bot::Bot;

fn error(message: impl ToString) -> JsError {
    JsError::new(&message.to_string())
}

/// A game of Shesh in progress on this device: the state and the undo
/// stack.
#[wasm_bindgen]
pub struct Game {
    state: GameState,
    undo: Vec<GameState>,
}

impl Game {
    /// The position, for the bots.
    pub fn game_state(&self) -> &GameState {
        &self.state
    }
}

#[wasm_bindgen]
impl Game {
    /// A new game with the rules of the proposal: the dice 1 to 6 in each
    /// reserve, the first player drawn and the first roll made. `seed`
    /// picks the rolls.
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u64) -> Game {
        Game::from_parts(GameState::new(seed))
    }

    /// A new game with the rules as `Rules` JSON (extra turn on the
    /// rosettes, free entry, taking every die home wins), for experiments.
    #[wasm_bindgen(js_name = withRules)]
    pub fn with_rules(rules: &str, seed: u64) -> Result<Game, JsError> {
        let rules: Rules = wire::rules_from_json(rules).map_err(error)?;
        Ok(Game::from_parts(GameState::with_rules(rules, seed)))
    }

    /// A game that continues from a `State` JSON, with nothing to undo.
    /// Throws if the state is not one the engine could have reached.
    #[wasm_bindgen(js_name = fromState)]
    pub fn from_state(json: &str) -> Result<Game, JsError> {
        let state = wire::state_from_json(json).map_err(error)?;
        Ok(Game::from_parts(state))
    }

    /// The whole state as a `State` JSON, to save the game.
    pub fn state(&self) -> String {
        wire::to_json(&self.state)
    }

    /// What to show, as a `View` JSON.
    pub fn view(&self) -> String {
        wire::to_json(&View::of(&self.state))
    }

    /// Every legal command of the player to move, as a `Command[]` JSON.
    #[wasm_bindgen(js_name = legalCommands)]
    pub fn legal_commands(&self) -> String {
        wire::to_json(&self.state.legal_commands())
    }

    /// Plays a `Command` JSON and returns a `Transition` JSON: the events,
    /// in order, and the new view. Throws if the command is illegal.
    pub fn command(&mut self, json: &str) -> Result<String, JsError> {
        let command = wire::command_from_json(json).map_err(error)?;
        let (next, events) = self.state.apply(command).map_err(error)?;
        self.undo.push(std::mem::replace(&mut self.state, next));
        Ok(wire::to_json(&Transition {
            events,
            view: View::of(&self.state),
        }))
    }

    #[wasm_bindgen(js_name = canUndo)]
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    /// Takes back the last command and returns the `View` JSON. The
    /// generator goes back too, so playing the same command rolls the same
    /// numbers. Throws if there is nothing to undo.
    pub fn undo(&mut self) -> Result<String, JsError> {
        self.state = self.undo.pop().ok_or_else(|| error("nothing to undo"))?;
        Ok(self.view())
    }
}

impl Game {
    fn from_parts(state: GameState) -> Game {
        Game {
            state,
            undo: Vec::new(),
        }
    }
}
