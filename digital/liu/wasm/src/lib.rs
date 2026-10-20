//! WebAssembly bindings of the Liu engine.
//!
//! Everything structured crosses the boundary as JSON text in the formats of
//! `liu_engine::wire` (the TypeScript types are in `types/`, generated with
//! `just liu-types`). Errors are thrown as JavaScript exceptions and change
//! nothing.
//!
//! The rules live in the engine: `Game` only keeps a game and its undo
//! stack, so an interface never decides what is legal.

use liu_engine::wire::{self, Transition, View};
use liu_engine::{GameState, MAX_PLAYERS, MIN_PLAYERS};
use wasm_bindgen::prelude::*;

fn error(message: impl ToString) -> JsError {
    JsError::new(&message.to_string())
}

/// A game of Liu in progress on this device: the state and the undo stack.
#[wasm_bindgen]
pub struct Game {
    state: GameState,
    undo: Vec<GameState>,
    opening: String,
}

#[wasm_bindgen]
impl Game {
    /// A new game for 2 to 4 players: the seals rolled, a die in each hand
    /// and the first market filled. `seed` picks the dice rolls.
    #[wasm_bindgen(constructor)]
    pub fn new(players: usize, seed: u64) -> Result<Game, JsError> {
        if !(MIN_PLAYERS..=MAX_PLAYERS).contains(&players) {
            return Err(error(format!("{players} players: the Liu is for 2 to 4")));
        }
        let (state, events) = GameState::new(players, seed);
        Ok(Game {
            state,
            undo: Vec::new(),
            opening: wire::to_json(&events),
        })
    }

    /// A game that continues from a `State` JSON, with nothing to undo.
    /// Throws if the state is not one the engine could have reached.
    #[wasm_bindgen(js_name = fromState)]
    pub fn from_state(json: &str) -> Result<Game, JsError> {
        let state = wire::state_from_json(json).map_err(error)?;
        Ok(Game {
            state,
            undo: Vec::new(),
            opening: "[]".into(),
        })
    }

    /// The events of the preparation and the first market, as an `Event[]`
    /// JSON; empty for a game read with `fromState`.
    #[wasm_bindgen(js_name = openingEvents)]
    pub fn opening_events(&self) -> String {
        self.opening.clone()
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
    /// Market dice with the same number appear once.
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

    /// Takes back the last command and returns the `View` JSON. The dice
    /// generator goes back too, so playing the same command rolls the same
    /// numbers. Throws if there is nothing to undo.
    pub fn undo(&mut self) -> Result<String, JsError> {
        self.state = self.undo.pop().ok_or_else(|| error("nothing to undo"))?;
        Ok(self.view())
    }
}
