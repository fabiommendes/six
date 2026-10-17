//! WebAssembly bindings of the Seks engine.
//!
//! Everything structured crosses the boundary as JSON text in the formats of
//! `seks_engine::wire` (the TypeScript types are in `types/`, generated with
//! `just seks-types`), and cells and commands as the text notation of the
//! engine (`b2`, `b2-b4`, `b2+`). Errors are thrown as JavaScript exceptions.
//!
//! The rules live in the engine: `Game` only keeps a game and its undo
//! stack, so an interface never decides what is legal.
//!
//! The bot of `seks-bots` is the separate class [`Bot`] (module `bot`): it
//! reads the position of a `Game` through [`Game::game_state`].

use seks_engine::wire::{self, State};
use seks_engine::GameState;
use wasm_bindgen::prelude::*;

mod bot;
mod session;

pub use bot::Bot;

use session::Session;

fn error(message: String) -> JsError {
    JsError::new(&message)
}

/// A game of Seks in progress on this device: the state and the undo stack.
#[wasm_bindgen]
pub struct Game {
    session: Session,
}

impl Game {
    /// The current state of the engine, for the bot.
    pub fn game_state(&self) -> &GameState {
        self.session.state()
    }
}

#[wasm_bindgen]
impl Game {
    /// A new game: the initial position, the Whites to move.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Game {
        Game {
            session: Session::new(),
        }
    }

    /// A game that continues from a `State` JSON, with nothing to undo.
    /// Throws if the state is not one the engine could have reached.
    #[wasm_bindgen(js_name = fromState)]
    pub fn from_state(state_json: &str) -> Result<Game, JsError> {
        Session::from_json(state_json)
            .map(|session| Game { session })
            .map_err(error)
    }

    /// A game from a text diagram of the board: 11 lines from row 11 to row
    /// 1, each with 11 cells separated by spaces (`..` empty, `w3` a white
    /// die of value 3, `b5` a black one), and `to_move` (`"white"` or
    /// `"black"`) to play. Nothing to undo. Throws on a bad diagram. For
    /// tests and fixtures: it is how a position that is not the start gets
    /// into the interface.
    #[wasm_bindgen(js_name = fromDiagram)]
    pub fn from_diagram(diagram: &str, to_move: &str) -> Result<Game, JsError> {
        Session::from_diagram(diagram, to_move)
            .map(|session| Game { session })
            .map_err(error)
    }

    /// The whole state as a `State` JSON, to save the game or to hand it to
    /// a Web Worker.
    pub fn state(&self) -> String {
        wire::to_json(&State::from(self.session.state()))
    }

    /// What to show, as a `View` JSON: the dice, whose turn it is, the plays
    /// without a capture, the repetitions, the commands that would draw by
    /// repetition and the outcome (`null` while the game goes on).
    pub fn view(&self) -> String {
        wire::to_json(&self.session.view())
    }

    /// Where the die in `cell` (`"b2"`) can move and whether it can be
    /// incremented, as a `DieOptions` JSON. Empty and `false` if the cell
    /// has no die of the side to move.
    pub fn options(&self, cell: &str) -> Result<String, JsError> {
        self.session
            .options(cell)
            .map(|options| wire::to_json(&options))
            .map_err(error)
    }

    /// Every legal command of the side to move, as a `Command[]` JSON; empty
    /// once the game is over.
    #[wasm_bindgen(js_name = legalCommands)]
    pub fn legal_commands(&self) -> String {
        wire::to_json(&self.session.legal_commands())
    }

    /// Plays a command (`"b2-b4"` moves, `"b2+"` increments) and returns a
    /// `Transition` JSON: the events, in order, to animate, and the new
    /// view. Throws if the command is illegal; nothing changes then.
    pub fn command(&mut self, command: &str) -> Result<String, JsError> {
        self.session
            .command(command)
            .map(|transition| wire::to_json(&transition))
            .map_err(error)
    }

    /// Whether there is a play to take back.
    #[wasm_bindgen(js_name = canUndo)]
    pub fn can_undo(&self) -> bool {
        self.session.can_undo()
    }

    /// Takes back the last play, one at a time, even the one that ended the
    /// game, and returns the `View` JSON after it. Throws if there is no
    /// play to undo.
    pub fn undo(&mut self) -> Result<String, JsError> {
        self.session
            .undo()
            .map(|view| wire::to_json(&view))
            .map_err(error)
    }
}

impl Default for Game {
    fn default() -> Game {
        Game::new()
    }
}
