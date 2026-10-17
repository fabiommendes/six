//! Playing one game between two bots.

use std::time::Instant;

use seks_engine::{Command, Engine, GameState, Outcome, Side};

use crate::bot::{Bot, Decision};
use crate::rng::derive;

/// One decision of a played game, with the time it took.
#[derive(Clone, Copy, Debug)]
pub struct Ply {
    pub decision: Decision,
    pub ms: f64,
}

/// A game played by [`play`] from `start`.
#[derive(Clone, Debug)]
pub struct PlayedGame {
    pub start: GameState,
    pub plies: Vec<Ply>,
    pub end: GameState,
    /// `None` if the game hit the ply limit.
    pub outcome: Option<Outcome>,
}

impl PlayedGame {
    /// The commands in the order they were played.
    pub fn commands(&self) -> impl Iterator<Item = Command> + '_ {
        self.plies.iter().map(|ply| ply.decision.command)
    }
}

/// Plays from `start` until the game ends or `max_plies` decisions were
/// made. `bots[0]` plays the Whites. The bot to move at ply `i` gets the
/// seed `derive(seed, i)`. An error means the engine refused a bot's
/// command: a bug.
pub fn play(
    bots: [&mut dyn Bot; 2],
    start: &GameState,
    seed: u64,
    max_plies: u32,
) -> Result<PlayedGame, String> {
    let [white, black] = bots;
    let mut state = *start;
    let mut plies = Vec::new();
    while state.outcome().is_none() && (plies.len() as u32) < max_plies {
        let bot: &mut dyn Bot = match state.to_move() {
            Side::White => &mut *white,
            Side::Black => &mut *black,
        };
        let clock = Instant::now();
        let decision = bot.choose(&state, derive(seed, plies.len() as u64));
        let ms = clock.elapsed().as_secs_f64() * 1000.0;
        state = Engine::command(&state, decision.command)
            .map_err(|error| {
                format!(
                    "{} played {} at ply {}: {error}",
                    bot.name(),
                    decision.command,
                    plies.len()
                )
            })?
            .state;
        plies.push(Ply { decision, ms });
    }
    Ok(PlayedGame {
        start: *start,
        plies,
        end: state,
        outcome: state.outcome(),
    })
}
