//! JSON adapter and TypeScript types (feature `wire`): the only way JSON
//! crosses the boundary of the engine.
//!
//! The domain types keep their storage private and have no serde; the types
//! here fix what crosses the boundary and generate the TypeScript bindings
//! (`ts-rs`, see `just seks-types`). Cells and commands cross as the text
//! notation of the engine (`b2-b4`, `b2+`, `f6xb10`, see `notation`), sides as
//! `"white"` and `"black"`.
//!
//! - [`State`]: the whole state, to save a game and to rebuild it with
//!   [`State::into_state`], which checks it. The hashes of the positions
//!   since the last capture cross as 16 hexadecimal digits, because a `u64`
//!   does not fit a JSON number in JavaScript.
//! - [`View`]: what an interface shows, with the counters of the draws.
//! - [`Transition`], [`Event`]: what a command did, to animate it.
//! - [`DieOptions`]: where a die can go, whether it can be incremented and
//!   what it can shoot.

use std::fmt;

use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use ts_rs::TS;

use crate as engine;
use crate::history::CAPACITY;
use crate::zobrist;

/// A cell in the text notation: `a1` to `k11`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, TS)]
#[ts(export, as = "String")]
pub struct Cell(pub engine::Cell);

impl Serialize for Cell {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for Cell {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Cell, D::Error> {
        let text = String::deserialize(deserializer)?;
        text.parse().map(Cell).map_err(D::Error::custom)
    }
}

/// A command in the text notation: `b2-b4` moves, `b2+` increments,
/// `f6xb10` shoots.
#[derive(Clone, Copy, Debug, PartialEq, Eq, TS)]
#[ts(export, as = "String")]
pub struct Command(pub engine::Command);

impl Serialize for Command {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for Command {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Command, D::Error> {
        let text = String::deserialize(deserializer)?;
        text.parse().map(Command).map_err(D::Error::custom)
    }
}

/// One of the two players.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum Side {
    White,
    Black,
}

impl From<engine::Side> for Side {
    fn from(side: engine::Side) -> Side {
        match side {
            engine::Side::White => Side::White,
            engine::Side::Black => Side::Black,
        }
    }
}

impl From<Side> for engine::Side {
    fn from(side: Side) -> engine::Side {
        match side {
            Side::White => engine::Side::White,
            Side::Black => engine::Side::Black,
        }
    }
}

/// A die on the board.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DieAt {
    pub cell: Cell,
    pub side: Side,
    /// The value on top, from 1 to 6.
    pub value: u8,
}

fn dice(board: &engine::Board) -> Vec<DieAt> {
    board
        .dice()
        .map(|(cell, die)| DieAt {
            cell: Cell(cell),
            side: die.side().into(),
            value: die.value(),
        })
        .collect()
}

/// Why a side won.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum WinReason {
    /// A die ended a move on the opponent's back row.
    BackRow,
    /// The opponent has no play left.
    NoPlay,
}

/// Why the game was drawn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum DrawReason {
    /// The same position for the third time.
    Repetition,
    /// 100 plays in a row without a capture.
    NoCapture,
}

/// The result of a finished game.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export)]
pub enum Outcome {
    Win { winner: Side, reason: WinReason },
    Draw { reason: DrawReason },
}

impl From<engine::Outcome> for Outcome {
    fn from(outcome: engine::Outcome) -> Outcome {
        match outcome {
            engine::Outcome::Win { winner, reason } => Outcome::Win {
                winner: winner.into(),
                reason: match reason {
                    engine::WinReason::BackRow => WinReason::BackRow,
                    engine::WinReason::NoPlay => WinReason::NoPlay,
                },
            },
            engine::Outcome::Draw(reason) => Outcome::Draw {
                reason: match reason {
                    engine::DrawReason::Repetition => DrawReason::Repetition,
                    engine::DrawReason::NoCapture => DrawReason::NoCapture,
                },
            },
        }
    }
}

impl From<Outcome> for engine::Outcome {
    fn from(outcome: Outcome) -> engine::Outcome {
        match outcome {
            Outcome::Win { winner, reason } => engine::Outcome::Win {
                winner: winner.into(),
                reason: match reason {
                    WinReason::BackRow => engine::WinReason::BackRow,
                    WinReason::NoPlay => engine::WinReason::NoPlay,
                },
            },
            Outcome::Draw { reason } => engine::Outcome::Draw(match reason {
                DrawReason::Repetition => engine::DrawReason::Repetition,
                DrawReason::NoCapture => engine::DrawReason::NoCapture,
            }),
        }
    }
}

/// One thing that happened in a [`Transition`], in the order it happened.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
#[ts(export)]
pub enum Event {
    /// A die moved and now shows `value`, the number of cells it walked.
    Moved {
        side: Side,
        from: Cell,
        to: Cell,
        value: u8,
    },
    /// A die was incremented in place and now shows `value`.
    Incremented { side: Side, at: Cell, value: u8 },
    /// The 6 in `from`, the center cell, shot the die in `to` and took its
    /// cell, still showing 6. A `captured` event for the die in `to` follows.
    Shot { side: Side, from: Cell, to: Cell },
    /// A die left the board; `side` and `value` are the ones it had.
    Captured { at: Cell, side: Side, value: u8 },
    /// The game ended.
    GameEnded { outcome: Outcome },
}

impl From<engine::GameEvent> for Event {
    fn from(event: engine::GameEvent) -> Event {
        match event {
            engine::GameEvent::Moved {
                side,
                from,
                to,
                value,
            } => Event::Moved {
                side: side.into(),
                from: Cell(from),
                to: Cell(to),
                value,
            },
            engine::GameEvent::Incremented { side, at, value } => Event::Incremented {
                side: side.into(),
                at: Cell(at),
                value,
            },
            engine::GameEvent::Shot { side, from, to } => Event::Shot {
                side: side.into(),
                from: Cell(from),
                to: Cell(to),
            },
            engine::GameEvent::Captured { at, die } => Event::Captured {
                at: Cell(at),
                side: die.side().into(),
                value: die.value(),
            },
            engine::GameEvent::GameEnded { outcome } => Event::GameEnded {
                outcome: outcome.into(),
            },
        }
    }
}

/// The whole state of a game, enough to rebuild it exactly.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct State {
    /// The dice, in cell index order (row 1 first).
    pub dice: Vec<DieAt>,
    pub to_move: Side,
    /// Plays in a row, by both sides, since the last capture.
    pub plies_without_capture: u8,
    /// Zobrist hashes of the positions since the last capture, oldest first,
    /// as 16 hexadecimal digits. The last one is the current position and
    /// there is one more hash than plies without a capture.
    pub history: Vec<String>,
    pub outcome: Option<Outcome>,
}

impl From<&engine::GameState> for State {
    fn from(state: &engine::GameState) -> State {
        State {
            dice: dice(state.board()),
            to_move: state.to_move().into(),
            plies_without_capture: state.plies_without_capture(),
            history: state
                .history
                .as_slice()
                .iter()
                .map(|hash| format!("{hash:016x}"))
                .collect(),
            outcome: state.outcome().map(Outcome::from),
        }
    }
}

impl State {
    /// The engine state this describes, after checking that it is one the
    /// engine could have reached: dice in different cells with values 1 to 6,
    /// a history as long as the plies without capture say, and the last hash
    /// equal to the hash of the position.
    pub fn into_state(self) -> Result<engine::GameState, WireError> {
        let mut board = engine::Board::empty();
        for die in &self.dice {
            if !(1..=engine::MAX_VALUE).contains(&die.value) {
                return Err(WireError::new(format!(
                    "the die at {} shows {}, not 1 to 6",
                    die.cell.0, die.value
                )));
            }
            if board.get(die.cell.0).is_some() {
                return Err(WireError::new(format!("two dice at {}", die.cell.0)));
            }
            board.set(
                die.cell.0,
                Some(engine::Die::new(die.side.into(), die.value)),
            );
        }
        let to_move = engine::Side::from(self.to_move);
        if self.plies_without_capture > engine::MAX_PLIES_WITHOUT_CAPTURE
            || self.history.len() != self.plies_without_capture as usize + 1
            || self.history.len() > CAPACITY
        {
            return Err(WireError::new(format!(
                "{} plies without capture do not match {} hashes",
                self.plies_without_capture,
                self.history.len()
            )));
        }
        let hashes = self
            .history
            .iter()
            .map(|text| parse_hash(text))
            .collect::<Result<Vec<u64>, WireError>>()?;
        let history = crate::history::PositionHistory::from_hashes(&hashes)
            .ok_or_else(|| WireError::new("the history of positions is empty"))?;
        if history.current() != zobrist::hash_position(&board, to_move) {
            return Err(WireError::new(
                "the last hash is not the hash of the position",
            ));
        }
        Ok(engine::GameState {
            board,
            to_move,
            plies_without_capture: self.plies_without_capture,
            history,
            outcome: self.outcome.map(engine::Outcome::from),
        })
    }
}

fn parse_hash(text: &str) -> Result<u64, WireError> {
    let well_formed = text.len() == 16 && text.bytes().all(|byte| byte.is_ascii_hexdigit());
    well_formed
        .then(|| u64::from_str_radix(text, 16).ok())
        .flatten()
        .ok_or_else(|| WireError::new(format!("{text:?} is not a hash of 16 hexadecimal digits")))
}

/// What an interface shows of a state, with the data of the draws it warns
/// about. Seks has no hidden information, so there is one view for both
/// sides.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct View {
    pub dice: Vec<DieAt>,
    pub to_move: Side,
    /// Plays in a row, by both sides, since the last capture.
    pub plies_without_capture: u8,
    /// The count at which the game is drawn (100).
    pub max_plies_without_capture: u8,
    /// How many times the current position has occurred since the last
    /// capture, this time included.
    pub repetitions: u8,
    /// The occurrence that draws the game (3).
    pub repetitions_for_draw: u8,
    /// The legal commands of the side to move that draw the game by
    /// repetition: not empty means the next repetition of a position draws.
    pub repetition_draws: Vec<Command>,
    pub outcome: Option<Outcome>,
}

impl View {
    pub fn new(state: &engine::GameState) -> View {
        View {
            dice: dice(state.board()),
            to_move: state.to_move().into(),
            plies_without_capture: state.plies_without_capture(),
            max_plies_without_capture: engine::MAX_PLIES_WITHOUT_CAPTURE,
            repetitions: state.repetitions() as u8,
            repetitions_for_draw: engine::REPETITIONS_FOR_DRAW as u8,
            repetition_draws: engine::legal_commands(state)
                .into_iter()
                .filter(|&command| {
                    engine::Engine::step(state, command).is_ok_and(|next| {
                        next.outcome()
                            == Some(engine::Outcome::Draw(engine::DrawReason::Repetition))
                    })
                })
                .map(Command)
                .collect(),
            outcome: state.outcome().map(Outcome::from),
        }
    }
}

/// What a command did: the events, in order, and the view after it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Transition {
    pub events: Vec<Event>,
    pub view: View,
}

impl Transition {
    pub fn new(transition: &engine::Transition) -> Transition {
        Transition {
            events: transition.events.iter().copied().map(Event::from).collect(),
            view: View::new(&transition.state),
        }
    }
}

/// What the side to move can do with the die in `at`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DieOptions {
    pub at: Cell,
    /// The cells it can move to, nearest first, direction by direction (the
    /// order of `legal_commands`). Empty if there is no die of the side to
    /// move in `at`.
    pub moves: Vec<Cell>,
    pub can_increment: bool,
    /// The dice it can shoot, in the order of `legal_commands`: empty unless
    /// it is a 6 of the side to move in the center cell.
    pub shots: Vec<Cell>,
}

impl DieOptions {
    pub fn new(state: &engine::GameState, at: engine::Cell) -> DieOptions {
        let mut options = DieOptions {
            at: Cell(at),
            moves: Vec::new(),
            can_increment: false,
            shots: Vec::new(),
        };
        for command in engine::legal_commands(state) {
            match command {
                engine::Command::Move { from, to } if from == at => options.moves.push(Cell(to)),
                engine::Command::Increment { at: die } if die == at => options.can_increment = true,
                engine::Command::Shoot { to } if at == engine::CENTER => {
                    options.shots.push(Cell(to))
                }
                _ => {}
            }
        }
        options
    }
}

/// A state or a JSON text the adapter refused.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WireError(String);

impl WireError {
    fn new(message: impl Into<String>) -> WireError {
        WireError(message.into())
    }
}

impl fmt::Display for WireError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for WireError {}

/// `value` as JSON text.
pub fn to_json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).expect("wire types always serialize")
}

/// The state in `json`, a [`State`], checked by [`State::into_state`].
pub fn state_from_json(json: &str) -> Result<engine::GameState, WireError> {
    serde_json::from_str::<State>(json)
        .map_err(|error| WireError::new(format!("state: {error}")))?
        .into_state()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::{cell, mv, play, position, sparse, TestRng};
    use crate::{Engine, GameState, Side as DomainSide};

    /// States along a random game, from the start to the end.
    fn random_game(seed: u64) -> Vec<GameState> {
        let mut rng = TestRng(seed);
        let mut state = Engine::new_game();
        let mut states = vec![state];
        while state.outcome().is_none() && states.len() < 400 {
            let legal = crate::legal_commands(&state);
            state = play(&state, legal[rng.below(legal.len())]).state;
            states.push(state);
        }
        states
    }

    fn round_trip(state: &GameState) -> GameState {
        state_from_json(&to_json(&State::from(state))).expect("the state reads back")
    }

    #[test]
    fn the_state_survives_json_in_the_middle_of_random_games() {
        let mut checked = 0;
        for seed in 0..8 {
            for state in random_game(seed) {
                let back = round_trip(&state);
                assert_eq!(back, state);
                assert_eq!(back.position_hash(), state.position_hash());
                assert_eq!(back.repetitions(), state.repetitions());
                assert_eq!(back.plies_without_capture(), state.plies_without_capture());
                checked += 1;
            }
        }
        assert!(checked > 100);
    }

    #[test]
    fn the_state_keeps_the_repetition_count_and_the_plies_without_capture() {
        let shuffle = ["b2-b4", "b10-b8", "b4-b2", "b8-b10"];
        let mut state = Engine::new_game();
        for text in shuffle.iter().cycle().take(6) {
            state = play(&state, text.parse().unwrap()).state;
        }
        assert_eq!(state.repetitions(), 2);
        assert_eq!(state.plies_without_capture(), 6);
        let back = round_trip(&state);
        assert_eq!(back.repetitions(), 2);
        assert_eq!(back.plies_without_capture(), 6);
        // The restored game still draws by repetition on the next cycle.
        let mut state = back;
        for text in shuffle.iter().cycle().skip(6).take(2) {
            state = play(&state, text.parse().unwrap()).state;
        }
        assert_eq!(
            state.outcome(),
            Some(crate::Outcome::Draw(crate::DrawReason::Repetition))
        );
    }

    #[test]
    fn a_finished_game_keeps_its_outcome() {
        let state = sparse(DomainSide::White, &["w6@5,6", "b1@1,11", "w1@8,1"]);
        let won = play(&state, mv((5, 6), (5, 11))).state;
        assert!(won.outcome().is_some());
        assert_eq!(round_trip(&won), won);
    }

    #[test]
    fn json_uses_the_notation_and_lowercase_names() {
        let json = to_json(&State::from(&Engine::new_game()));
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["to_move"], "white");
        assert_eq!(value["dice"][0]["cell"], "a1");
        assert_eq!(value["dice"][0]["side"], "white");
        assert_eq!(value["history"][0], "3515f759189198b1");
        assert_eq!(value["outcome"], serde_json::Value::Null);
    }

    #[test]
    fn events_carry_the_notation_and_a_tag() {
        let state = sparse(
            DomainSide::White,
            &["w3@5,5", "b2@5,6", "w1@5,7", "b1@11,11"],
        );
        let transition = play(&state, mv((5, 5), (5, 4)));
        let json = to_json(&Transition::new(&transition));
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["events"][0]["type"], "moved");
        assert_eq!(value["events"][0]["from"], "e5");
        assert_eq!(value["events"][0]["to"], "e4");
        assert_eq!(value["events"][0]["value"], 1);
    }

    #[test]
    fn captures_report_the_captured_die() {
        let state = sparse(
            DomainSide::White,
            &["w2@5,3", "b2@5,5", "w1@5,6", "b1@11,11"],
        );
        let transition = play(&state, mv((5, 3), (5, 4)));
        let events: Vec<Event> = Transition::new(&transition).events;
        assert!(events.contains(&Event::Captured {
            at: Cell(cell(5, 5)),
            side: Side::Black,
            value: 2,
        }));
    }

    #[test]
    fn an_end_of_game_event_has_the_outcome() {
        let state = sparse(DomainSide::White, &["w6@5,6", "b1@1,11", "w1@8,1"]);
        let transition = play(&state, mv((5, 6), (5, 11)));
        let events = Transition::new(&transition).events;
        assert_eq!(
            events.last(),
            Some(&Event::GameEnded {
                outcome: Outcome::Win {
                    winner: Side::White,
                    reason: WinReason::BackRow
                }
            })
        );
        let json = to_json(events.last().unwrap());
        assert!(json.contains(r#""outcome":{"kind":"win","winner":"white","reason":"back_row"}"#));
    }

    #[test]
    fn the_view_warns_when_a_repetition_would_draw() {
        let shuffle = ["b2-b4", "b10-b8", "b4-b2", "b8-b10"];
        let mut state = Engine::new_game();
        assert!(View::new(&state).repetition_draws.is_empty());
        for text in shuffle.iter().cycle().take(7) {
            state = play(&state, text.parse().unwrap()).state;
        }
        // The position after the 7th play is the one after the 3rd, and the
        // next play brings back the initial position for the third time.
        let view = View::new(&state);
        assert_eq!(view.repetitions, 2);
        assert_eq!(
            view.repetition_draws,
            vec![Command("b8-b10".parse().unwrap())]
        );
        assert_eq!(view.plies_without_capture, 7);
        assert_eq!(view.max_plies_without_capture, 100);
        assert_eq!(view.repetitions_for_draw, 3);
    }

    #[test]
    fn die_options_list_the_moves_and_the_increment() {
        let state = sparse(DomainSide::White, &["w2@5,5", "b1@5,6", "b6@11,11"]);
        let options = DieOptions::new(&state, cell(5, 5));
        assert!(options.can_increment);
        assert!(!options.moves.contains(&Cell(cell(5, 6))));
        assert!(options.moves.contains(&Cell(cell(5, 4))));
        assert!(options.moves.contains(&Cell(cell(5, 3))));
        assert!(!options.moves.contains(&Cell(cell(5, 2))));
        let json = to_json(&options);
        assert!(json.contains(r#""at":"e5""#) && json.contains(r#""can_increment":true"#));
    }

    #[test]
    fn die_options_are_empty_for_a_six_an_enemy_die_and_an_empty_cell() {
        let state = sparse(DomainSide::White, &["w6@5,5", "b2@8,8"]);
        let six = DieOptions::new(&state, cell(5, 5));
        assert!(!six.can_increment);
        assert!(!six.moves.is_empty());
        for at in [cell(8, 8), cell(1, 1)] {
            let options = DieOptions::new(&state, at);
            assert!(options.moves.is_empty() && !options.can_increment);
        }
    }

    fn json_with(edit: impl FnOnce(&mut serde_json::Value)) -> String {
        let mut value = serde_json::to_value(State::from(&Engine::new_game())).unwrap();
        edit(&mut value);
        value.to_string()
    }

    #[test]
    fn a_state_that_the_engine_could_not_reach_is_refused() {
        let refused: [(&str, String); 7] = [
            (
                "two dice",
                json_with(|v| v["dice"][1]["cell"] = "a1".into()),
            ),
            ("value", json_with(|v| v["dice"][0]["value"] = 7.into())),
            ("cell", json_with(|v| v["dice"][0]["cell"] = "l1".into())),
            (
                "hash",
                json_with(|v| v["history"][0] = "0000000000000001".into()),
            ),
            ("hash", json_with(|v| v["history"][0] = "xyz".into())),
            (
                "plies",
                json_with(|v| v["plies_without_capture"] = 3.into()),
            ),
            ("side", json_with(|v| v["to_move"] = "Black".into())),
        ];
        for (name, json) in refused {
            assert!(state_from_json(&json).is_err(), "{name}: {json}");
        }
        assert!(state_from_json("not json").is_err());
    }

    #[test]
    fn to_move_changes_the_hash_so_a_flipped_turn_is_refused() {
        let json = json_with(|v| v["to_move"] = "black".into());
        assert!(state_from_json(&json).is_err());
    }

    #[test]
    fn a_position_built_in_the_middle_reads_back() {
        let state = position(
            "
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. b3 .. .. .. .. ..
            w3 .. .. .. .. .. .. .. .. .. ..
            ",
            DomainSide::Black,
        );
        assert_eq!(round_trip(&state), state);
    }
}
