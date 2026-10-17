//! The entry points of the engine.

use crate::apply::apply;
use crate::command::{validate, Command};
use crate::die::Side;
use crate::event::{GameError, GameEvent, Transition};
use crate::state::GameState;

/// The engine of Seks. It has no data: the rules are fixed, so every entry
/// point is an associated function of the state.
#[derive(Clone, Copy, Debug)]
pub struct Engine;

impl Engine {
    /// A new game: the initial position with the Whites to move.
    pub fn new_game() -> GameState {
        GameState::initial()
    }

    /// Applies `command` to `state` and returns the new state and the events.
    /// `state` is not changed. Refuses every command that is not in
    /// [`crate::legal_commands`].
    pub fn command(state: &GameState, command: Command) -> Result<Transition, GameError> {
        validate(state, command)?;
        let mut next = *state;
        let applied = apply(&mut next, command);
        let mut events = Vec::with_capacity(6);
        events.push(match command {
            Command::Move { from, to } => GameEvent::Moved {
                side: state.to_move,
                from,
                to,
                value: applied.value,
            },
            Command::Increment { at } => GameEvent::Incremented {
                side: state.to_move,
                at,
                value: applied.value,
            },
        });
        events.extend(
            applied
                .captured
                .into_iter()
                .flatten()
                .map(|(at, die)| GameEvent::Captured { at, die }),
        );
        if let Some(outcome) = next.outcome {
            events.push(GameEvent::GameEnded { outcome });
        }
        Ok(Transition {
            state: next,
            events,
        })
    }

    /// Like [`Engine::command`] but returns only the new state, for searches
    /// and simulations that have no use for events.
    pub fn step(state: &GameState, command: Command) -> Result<GameState, GameError> {
        validate(state, command)?;
        let mut next = *state;
        apply(&mut next, command);
        Ok(next)
    }

    /// What `side` may see of `state`. Seks has no hidden information, so it
    /// is the whole state; the signature is the one of the other games.
    pub fn view(state: &GameState, _side: Side) -> GameState {
        *state
    }
}
