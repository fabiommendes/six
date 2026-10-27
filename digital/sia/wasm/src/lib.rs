//! WebAssembly bindings of the Sia engine.
//!
//! Everything structured crosses the boundary as JSON text in the formats of
//! `sia_engine::wire` (the TypeScript types are in `types/`, generated with
//! `just sia-types`). Errors are thrown as JavaScript exceptions and change
//! nothing.
//!
//! The rules live in the engine: `Game` only keeps a game and its undo
//! stack, so an interface never decides what is legal. `Bot` is a bot of
//! `sia-bots` that reads the position of a `Game`.

use sia_engine::wire::{self, Transition, View};
use sia_engine::{GameState, DEFAULT_HAND_SIZE, HAND_SIZES};
use wasm_bindgen::prelude::*;

mod bot;

pub use bot::Bot;

fn error(message: impl ToString) -> JsError {
    JsError::new(&message.to_string())
}

/// A game of Sia in progress on this device: the state and the undo stack.
#[wasm_bindgen]
pub struct Game {
    state: GameState,
    undo: Vec<GameState>,
    opening: String,
}

impl Game {
    /// The position, for the bots.
    pub fn game_state(&self) -> &GameState {
        &self.state
    }
}

#[wasm_bindgen]
impl Game {
    /// A new game with hands of 6 dice (the joker and 5 of the bag): the
    /// stones rolled, the hands dealt and the first player drawn. `seed`
    /// picks the dice.
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u64) -> Game {
        Game::start(DEFAULT_HAND_SIZE, seed)
    }

    /// A new game with hands of `handSize` dice (2 to 10), for experiments.
    #[wasm_bindgen(js_name = withHandSize)]
    pub fn with_hand_size(hand_size: u8, seed: u64) -> Result<Game, JsError> {
        if !HAND_SIZES.contains(&hand_size) {
            return Err(error(format!("hand of {hand_size} dice: 2 to 10")));
        }
        Ok(Game::start(hand_size, seed))
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

    /// The events of the preparation, as an `Event[]` JSON; empty for a
    /// game read with `fromState`.
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

    /// Every legal command of the player to move, as a `Command[]` JSON,
    /// without repeating equal dice. Rerolls are many (hundreds); an
    /// interface usually builds one from the `View`.
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

impl Game {
    fn start(hand_size: u8, seed: u64) -> Game {
        let (state, events) = GameState::with_hand_size(hand_size, seed);
        Game {
            state,
            undo: Vec::new(),
            opening: wire::to_json(&events),
        }
    }
}
