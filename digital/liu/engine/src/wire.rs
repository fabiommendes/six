//! JSON adapter and TypeScript types (feature `wire`).
//!
//! Unlike the Seks, the domain types of the Liu carry serde themselves
//! (behind this feature): the state is small and its JSON is its fields.
//! What an interface needs on top of them is here:
//!
//! - [`state_from_json`]: reads a `State` and checks it.
//! - [`View`]: what an interface shows, with the cells each number may go
//!   to and the current scores.
//! - [`Transition`]: what a command did, to animate it, and the new view.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{Bounds, Command, EndReason, Event, GameState, Placed, Pos, Score};

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

/// A player as an interface shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PlayerView {
    pub seal: u8,
    /// The dice of the window, the seal first.
    pub window: Vec<Placed>,
    pub hand: Option<u8>,
    /// Rows and columns the window may still use.
    pub bounds: Bounds,
    /// The score if the game ended now.
    pub score: Score,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct View {
    pub players: Vec<PlayerView>,
    pub market: Vec<u8>,
    pub bag: u8,
    pub round: u16,
    /// Who began the round.
    pub first: usize,
    pub to_move: usize,
    /// The player to move rerolled and must place or keep a die.
    pub rerolled: bool,
    /// Where a die of each number (index 0 for the 1) may go in the window
    /// of the player to move; empty once the game is over.
    pub targets: Vec<Vec<Pos>>,
    pub can_keep: bool,
    pub can_reroll: bool,
    pub can_pass: bool,
    /// Whether the die of the hand fits the window: "place from hand".
    pub can_place_from_hand: bool,
    pub end: Option<EndReason>,
    /// The winners, once the game is over; more than one share the win.
    pub winners: Option<Vec<usize>>,
}

impl View {
    pub fn of(state: &GameState) -> View {
        let scores = state.scores();
        let over = state.is_over();
        let me = &state.players()[state.to_move()];
        let targets: Vec<Vec<Pos>> = if over {
            vec![Vec::new(); 6]
        } else {
            (1..=6).map(|value| state.targets(value)).collect()
        };
        let can_place_from_hand = !over
            && !state.rerolled()
            && me.hand.is_some_and(|v| !targets[v as usize - 1].is_empty());
        View {
            players: state
                .players()
                .iter()
                .zip(scores)
                .map(|(p, score)| PlayerView {
                    seal: p.seal(),
                    window: p.window.dice().to_vec(),
                    hand: p.hand,
                    bounds: p.window.bounds(),
                    score,
                })
                .collect(),
            market: state.market().to_vec(),
            bag: state.bag(),
            round: state.round(),
            first: state.first(),
            to_move: state.to_move(),
            rerolled: state.rerolled(),
            can_keep: !over && me.hand.is_none(),
            can_reroll: !over && !state.rerolled() && me.hand.is_some(),
            can_pass: !over && !state.rerolled(),
            can_place_from_hand,
            targets,
            end: state.end(),
            winners: state.winners(),
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
        let (state, _) = GameState::new(3, 5);
        let json = to_json(&state);
        assert_eq!(state_from_json(&json).unwrap(), state);
        let mut broken: serde_json::Value = serde_json::from_str(&json).unwrap();
        broken["bag"] = serde_json::json!(0);
        assert!(state_from_json(&broken.to_string()).is_err());
    }

    #[test]
    fn commands_cross_as_tagged_json() {
        let command =
            command_from_json(r#"{"kind":"placeFromMarket","die":1,"at":{"row":0,"col":-1}}"#)
                .unwrap();
        assert_eq!(
            command,
            Command::PlaceFromMarket {
                die: 1,
                at: Pos::new(0, -1)
            }
        );
        assert_eq!(
            command_from_json(r#"{"kind":"pass"}"#).unwrap(),
            Command::Pass
        );
    }

    #[test]
    fn the_view_lists_targets_for_every_number() {
        let (state, _) = GameState::new(2, 9);
        let view = View::of(&state);
        assert_eq!(view.targets.len(), 6);
        let seal = view.players[view.to_move].seal as usize;
        assert!(
            view.targets[seal - 1].is_empty(),
            "the seal number is in the only row and column"
        );
        assert!(view.can_reroll && view.can_pass && !view.can_keep);
    }
}
