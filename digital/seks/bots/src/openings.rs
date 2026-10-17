//! Openings: positions a few random plies into a game, written as the
//! commands from the initial position, one opening per line. Without them,
//! two deterministic bots would play the same game every time.
//!
//! File format: one opening per line, its commands in the engine notation
//! separated by spaces (`e2-e4 e10-e8 b2+`). Blank lines and lines starting
//! with `#` are ignored.

use std::collections::HashSet;

use seks_engine::{legal_commands, Command, Engine, GameState};

use crate::rng::{derive, Rng};
use crate::tactics::can_win_now;

/// The commands that lead from the initial position to an opening.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Opening {
    pub commands: Vec<Command>,
}

impl Opening {
    /// The empty opening: the initial position.
    pub fn initial() -> Opening {
        Opening {
            commands: Vec::new(),
        }
    }

    /// Reads one line of an openings file.
    pub fn parse(line: &str) -> Result<Opening, String> {
        let commands = line
            .split_whitespace()
            .map(|word| word.parse().map_err(|e| format!("{e}")))
            .collect::<Result<Vec<Command>, String>>()?;
        let opening = Opening { commands };
        opening.state()?;
        Ok(opening)
    }

    /// The line of an openings file.
    pub fn to_line(&self) -> String {
        let words: Vec<String> = self.commands.iter().map(Command::to_string).collect();
        words.join(" ")
    }

    /// The position after the commands, checked by the engine. The game must
    /// not be over.
    pub fn state(&self) -> Result<GameState, String> {
        let mut state = GameState::initial();
        for &command in &self.commands {
            state = Engine::command(&state, command)
                .map_err(|e| format!("{command}: {e}"))?
                .state;
        }
        match state.outcome() {
            Some(outcome) => Err(format!("the opening ends the game: {outcome:?}")),
            None => Ok(state),
        }
    }
}

/// Reads an openings file.
pub fn read(text: &str) -> Result<Vec<Opening>, String> {
    text.lines()
        .enumerate()
        .filter(|(_, line)| !line.trim().is_empty() && !line.trim_start().starts_with('#'))
        .map(|(i, line)| Opening::parse(line).map_err(|e| format!("line {}: {e}", i + 1)))
        .collect()
}

/// `count` distinct openings of `plies` random plies each. Each candidate
/// comes from its own seed, `derive(seed, attempt)`. A candidate is
/// dropped when the game ended, a side can win on its next move, the
/// position repeats an earlier opening, or `keep` refuses it (a short search
/// that sees the game decided).
pub fn generate(
    count: usize,
    plies: usize,
    seed: u64,
    mut keep: impl FnMut(&GameState) -> bool,
) -> Vec<Opening> {
    let mut openings = Vec::with_capacity(count);
    let mut seen = HashSet::new();
    let mut attempt = 0;
    while openings.len() < count {
        let mut rng = Rng::new(derive(seed, attempt));
        attempt += 1;
        let mut state = GameState::initial();
        let mut commands = Vec::with_capacity(plies);
        for _ in 0..plies {
            let legal = legal_commands(&state);
            if legal.is_empty() {
                break;
            }
            let command = legal[rng.below(legal.len())];
            state = Engine::step(&state, command).expect("a legal command");
            commands.push(command);
        }
        let quiet = state.outcome().is_none()
            && !can_win_now(state.board(), state.to_move())
            && !can_win_now(state.board(), state.to_move().opponent());
        if quiet && seen.insert(state.position_hash()) && keep(&state) {
            openings.push(Opening { commands });
        }
    }
    openings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lines_round_trip_and_comments_are_skipped() {
        let openings = read("# base\n\ne2-e4 e10-e8 b2+\n").unwrap();
        assert_eq!(openings.len(), 1);
        assert_eq!(openings[0].to_line(), "e2-e4 e10-e8 b2+");
        assert_eq!(openings[0].state().unwrap().plies_without_capture(), 3);
    }

    #[test]
    fn an_illegal_line_is_an_error_with_its_number() {
        let error = read("e2-e4\ne2-e5\n").unwrap_err();
        assert!(error.starts_with("line 2:"), "{error}");
        assert!(read("e2-e4 e2-e4").is_err());
    }

    #[test]
    fn generation_is_reproducible_and_distinct() {
        let a = generate(20, 6, 1, |_| true);
        assert_eq!(a, generate(20, 6, 1, |_| true));
        assert!(a.iter().all(|o| o.commands.len() == 6));
        let states: HashSet<u64> = a
            .iter()
            .map(|o| o.state().unwrap().position_hash())
            .collect();
        assert_eq!(states.len(), 20);
    }
}
