//! Game files: one JSON file per game, with the bots, the seed, the opening,
//! the commands in the engine notation, how the game ended and, per
//! decision, what it cost. `seks-bots replay` plays them back with
//! `Engine::command` and checks the ending.

use serde::{Deserialize, Serialize};

use seks_engine::{Command, DrawReason, Engine, GameState, Outcome, Side, WinReason};

use crate::game::PlayedGame;
use crate::openings::Opening;

/// How a game stopped.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum End {
    /// A die reached the opponent's back row.
    BackRow,
    /// The opponent had no play.
    NoPlay,
    /// Draw: the same position for the third time.
    Repetition,
    /// Draw: 100 plies without a capture.
    NoCapture,
    /// The batch's ply limit stopped the game.
    PlyLimit,
}

impl End {
    /// The winner and the end of a game whose outcome is `outcome`, `None`
    /// when the ply limit stopped it.
    pub fn of(outcome: Option<Outcome>) -> (Option<Side>, End) {
        match outcome {
            Some(Outcome::Win { winner, reason }) => (
                Some(winner),
                match reason {
                    WinReason::BackRow => End::BackRow,
                    WinReason::NoPlay => End::NoPlay,
                },
            ),
            Some(Outcome::Draw(DrawReason::Repetition)) => (None, End::Repetition),
            Some(Outcome::Draw(DrawReason::NoCapture)) => (None, End::NoCapture),
            None => (None, End::PlyLimit),
        }
    }

    /// The name used in files and summaries.
    pub fn name(self) -> &'static str {
        match self {
            End::BackRow => "back_row",
            End::NoPlay => "no_play",
            End::Repetition => "repetition",
            End::NoCapture => "no_capture",
            End::PlyLimit => "ply_limit",
        }
    }
}

/// `white` or `black`.
pub fn side_name(side: Side) -> &'static str {
    match side {
        Side::White => "white",
        Side::Black => "black",
    }
}

/// What one decision cost.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PlyInfo {
    pub nodes: u64,
    pub ms: f64,
    pub depth: u32,
    /// From the side to move; absent for bots that do not score.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub score: Option<i32>,
}

/// One game, as written to disk.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct GameFile {
    pub white: String,
    pub black: String,
    pub seed: u64,
    pub opening: Vec<String>,
    pub commands: Vec<String>,
    /// `white`, `black`, or absent for a draw or an unfinished game.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub winner: Option<String>,
    pub end: End,
    pub plies: Vec<PlyInfo>,
}

impl GameFile {
    /// The file of `game`, played from `opening` by `white` and `black`.
    pub fn new(
        white: &str,
        black: &str,
        seed: u64,
        opening: &Opening,
        game: &PlayedGame,
    ) -> GameFile {
        let (winner, end) = End::of(game.outcome);
        GameFile {
            white: white.into(),
            black: black.into(),
            seed,
            opening: opening.commands.iter().map(Command::to_string).collect(),
            commands: game.commands().map(|c| c.to_string()).collect(),
            winner: winner.map(|side| side_name(side).to_string()),
            end,
            plies: game
                .plies
                .iter()
                .map(|ply| PlyInfo {
                    nodes: ply.decision.nodes,
                    ms: ply.ms,
                    depth: ply.decision.depth,
                    score: ply.decision.score,
                })
                .collect(),
        }
    }

    /// Plays the opening and the commands back with `Engine::command` and
    /// checks that the game ends as the file says. Returns the last state.
    pub fn replay(&self) -> Result<GameState, String> {
        let mut state = GameState::initial();
        let all = self.opening.iter().chain(&self.commands);
        for (ply, text) in all.enumerate() {
            let command: Command = text.parse().map_err(|e| format!("ply {ply}: {e}"))?;
            state = Engine::command(&state, command)
                .map_err(|e| format!("ply {ply}, {command}: {e}"))?
                .state;
        }
        let (winner, end) = End::of(state.outcome());
        let winner = winner.map(|side| side_name(side).to_string());
        if (winner.as_ref(), end) != (self.winner.as_ref(), self.end) {
            return Err(format!(
                "the replay ends with {winner:?} {end:?}, the file says {:?} {:?}",
                self.winner, self.end
            ));
        }
        Ok(state)
    }
}
