//! JSON adapter and TypeScript types (feature `wire`).
//!
//! The domain types of the Shesh carry serde themselves (behind this
//! feature): the state is small and its JSON is its fields. What an
//! interface needs on top of them is here:
//!
//! - [`state_from_json`]: reads a `State` and checks it.
//! - [`View`]: what an interface shows, with each legal move and what it
//!   would do.
//! - [`Transition`]: what a command did, to animate it, and the new view.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{Command, EndReason, Event, GameState, Rules, EXIT, MAX_VALUE, PLAYERS};

pub fn to_json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).expect("the wire types always serialize")
}

/// A `State` JSON, checked as if the engine had reached it.
pub fn state_from_json(json: &str) -> Result<GameState, String> {
    let state: GameState = serde_json::from_str(json).map_err(|e| e.to_string())?;
    state.validate()?;
    Ok(state)
}

pub fn command_from_json(json: &str) -> Result<Command, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

pub fn rules_from_json(json: &str) -> Result<Rules, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

/// A legal command and what it would do, for an interface to preview.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Move {
    pub command: Command,
    /// The events of the command, without the roll of the next turn.
    pub events: Vec<Event>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PlayerView {
    /// `track[square]`, squares 0 to 18 along the own path: the value of the
    /// die, 0 when empty. Squares 0 and 18 are always 0.
    pub track: Vec<u8>,
    /// The values of the dice in the reserve, smallest first.
    pub reserve: Vec<u8>,
    pub points: u8,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct View {
    pub players: Vec<PlayerView>,
    pub rules: Rules,
    pub to_move: usize,
    /// The sum of the four binary dice of the turn, 1 to 4 (all zeros roll
    /// again).
    pub roll: u8,
    pub turn: u16,
    /// The legal moves of the player to move, empty when the game is over.
    pub moves: Vec<Move>,
    pub end: Option<EndReason>,
    pub winner: Option<usize>,
}

impl View {
    pub fn of(state: &GameState) -> View {
        let players = (0..PLAYERS)
            .map(|p| PlayerView {
                track: (0..=EXIT).map(|s| state.die_at(p, s)).collect(),
                reserve: (1..=MAX_VALUE)
                    .flat_map(|v| std::iter::repeat_n(v, state.in_reserve(p, v) as usize))
                    .collect(),
                points: state.points(p),
            })
            .collect();
        let moves = state
            .legal_commands()
            .into_iter()
            .map(|command| {
                let (_, mut events) = state.apply(command).expect("legal command");
                if matches!(events.last(), Some(Event::Rolled { .. })) {
                    events.pop();
                }
                Move { command, events }
            })
            .collect();
        View {
            players,
            rules: state.rules(),
            to_move: state.to_move(),
            roll: state.roll(),
            turn: state.turn(),
            moves,
            end: state.end(),
            winner: state.end().map(EndReason::winner),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Transition {
    pub events: Vec<Event>,
    pub view: View,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_state_round_trips_and_is_checked() {
        let state = GameState::new(5);
        let json = to_json(&state);
        assert_eq!(state_from_json(&json).unwrap(), state);
        let mut broken: serde_json::Value = serde_json::from_str(&json).unwrap();
        broken["roll"] = serde_json::json!(7);
        assert!(state_from_json(&broken.to_string()).is_err());
    }

    #[test]
    fn commands_cross_as_tagged_json() {
        assert_eq!(
            command_from_json(r#"{"kind":"enter","value":2}"#).unwrap(),
            Command::Enter { value: 2 }
        );
        assert_eq!(
            command_from_json(r#"{"kind":"move","from":6}"#).unwrap(),
            Command::Move { from: 6 }
        );
        assert_eq!(
            command_from_json(r#"{"kind":"pass"}"#).unwrap(),
            Command::Pass
        );
    }

    #[test]
    fn the_view_tells_what_may_be_done() {
        let state = GameState::new(9);
        let view = View::of(&state);
        assert_eq!(view.players.len(), 2);
        assert_eq!(view.players[0].reserve, vec![1, 2, 3, 4, 5, 6]);
        assert_eq!(view.moves.len(), state.legal_commands().len());
        assert!(view
            .moves
            .iter()
            .all(|m| !matches!(m.events.last(), Some(Event::Rolled { .. }))));
        assert_eq!(view.winner, None);
    }
}
