//! JSON adapter and TypeScript types (feature `wire`).
//!
//! The domain types of the Sia carry serde themselves (behind this feature):
//! the state is small and its JSON is its fields. What an interface needs on
//! top of them is here:
//!
//! - [`state_from_json`]: reads a `State` and checks it.
//! - [`View`]: what an interface shows, with the stones that accept a die,
//!   the claims that are proven and what each side can still become.
//! - [`Transition`]: what a command did, to animate it, and the new view.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    best_completion, Command, Die, EndReason, Event, Formation, GameState, Step, PLAYERS, STONES,
};

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

/// One side of a stone as an interface shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SideView {
    pub dice: Vec<Die>,
    /// Set when the side has 3 dice.
    pub formation: Option<Formation>,
    /// The best formation the side can still become (the formation itself
    /// when it is complete): what the other player must beat to prove a
    /// claim against it.
    pub potential: Formation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct StoneView {
    pub number: u8,
    pub owner: Option<usize>,
    /// The side of each player.
    pub sides: Vec<SideView>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PlayerView {
    pub hand: Vec<Die>,
    pub lost: u8,
    /// Stones taken so far.
    pub stones: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct View {
    pub stones: Vec<StoneView>,
    pub players: Vec<PlayerView>,
    pub hand_size: u8,
    pub to_move: usize,
    pub step: Step,
    pub turn: u16,
    /// Stones where the player to move may put a die, by position.
    pub open: Vec<bool>,
    /// Stones the player to move may claim now, by position.
    pub claimable: Vec<bool>,
    /// A reroll is allowed now (first step, a hand of 2 dice or more).
    pub can_reroll: bool,
    /// The player to move has no room and may pass.
    pub can_pass: bool,
    pub end: Option<EndReason>,
    /// The winners, once the game is over; both in a draw.
    pub winners: Option<Vec<usize>>,
}

impl View {
    pub fn of(state: &GameState) -> View {
        let over = state.is_over();
        let me = state.to_move();
        let stones = (0..STONES)
            .map(|s| StoneView {
                number: state.stones()[s],
                owner: state.owners()[s],
                sides: (0..PLAYERS)
                    .map(|p| {
                        let side = state.side(p, s);
                        SideView {
                            dice: side.dice.clone(),
                            formation: state.formation_of(p, s),
                            potential: best_completion(state.stones()[s], &side.dice),
                        }
                    })
                    .collect(),
            })
            .collect();
        let open_stones = state.open_stones(me);
        View {
            stones,
            players: (0..PLAYERS)
                .map(|p| PlayerView {
                    hand: state.hand(p).to_vec(),
                    lost: state.player(p).lost,
                    stones: state.stones_of(p),
                })
                .collect(),
            hand_size: state.hand_size(),
            to_move: me,
            step: state.step(),
            turn: state.turn(),
            open: (0..STONES)
                .map(|s| !over && open_stones.contains(&s))
                .collect(),
            claimable: (0..STONES)
                .map(|s| !over && state.can_claim(me, s))
                .collect(),
            can_reroll: !over && state.step() == Step::Reroll && state.hand(me).len() >= 2,
            can_pass: !over && open_stones.is_empty(),
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
        let (state, _) = GameState::new(5);
        let json = to_json(&state);
        assert_eq!(state_from_json(&json).unwrap(), state);
        let mut broken: serde_json::Value = serde_json::from_str(&json).unwrap();
        broken["players"][0]["lost"] = serde_json::json!(3);
        assert!(state_from_json(&broken.to_string()).is_err());
    }

    #[test]
    fn commands_cross_as_tagged_json() {
        assert_eq!(
            command_from_json(r#"{"kind":"reroll","target":1,"lost":2,"dice":5}"#).unwrap(),
            Command::Reroll {
                target: 1,
                lost: 2,
                dice: 5
            }
        );
        assert_eq!(
            command_from_json(r#"{"kind":"place","die":0,"stone":8}"#).unwrap(),
            Command::Place { die: 0, stone: 8 }
        );
        assert_eq!(
            command_from_json(r#"{"kind":"pass"}"#).unwrap(),
            Command::Pass
        );
    }

    #[test]
    fn the_view_tells_what_may_be_done() {
        let (state, _) = GameState::new(9);
        let view = View::of(&state);
        assert_eq!(view.stones.len(), 9);
        assert_eq!(view.players[0].hand.len(), 5);
        assert!(view.open.iter().all(|&o| o));
        assert!(view.claimable.iter().all(|&c| !c));
        assert!(view.can_reroll && !view.can_pass);
    }
}
