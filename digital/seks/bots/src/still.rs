//! The still bot: increments and keeps its dice in place for its first
//! plays, then plays as the alpha-beta bot. An experiment on the opening
//! (`dev/notes/bots-do-seks.md`, "Abertura e a estratégia de ficar parado"),
//! kept to test rule changes against a side that refuses to move.

use seks_engine::{legal_commands, Command, GameState};

use crate::ab::AlphaBeta;
use crate::bot::{Bot, Decision};
use crate::search::is_decisive;
use crate::tactics::winning_move;

/// The bot `still[:plays=N,ARGS]`: for its first `N` plays (all of them
/// without `plays`), the best increment by the search of `ab:ARGS`, whose
/// replies are not restricted. It moves only to win at once, when it has no
/// increment, or when the search finds that every increment loses by force;
/// then it plays the move of `ab:ARGS`.
pub struct Still {
    spec: String,
    plays: Option<u32>,
    played: u32,
    ab: AlphaBeta,
}

impl Still {
    /// Reads the arguments after `still:`: `plays=N` and the arguments of
    /// `ab` ([`AlphaBeta::from_args`]).
    pub fn from_args(spec: &str, args: &str) -> Result<Still, String> {
        let mut plays = None;
        let mut rest = Vec::new();
        for pair in args.split(',').filter(|pair| !pair.is_empty()) {
            match pair.split_once('=') {
                Some(("plays", value)) => {
                    plays = Some(
                        value
                            .parse()
                            .map_err(|_| format!("bot {spec}: bad plays={value}"))?,
                    )
                }
                _ => rest.push(pair),
            }
        }
        Ok(Still {
            spec: spec.into(),
            plays,
            played: 0,
            ab: AlphaBeta::from_args(spec, &rest.join(","))?,
        })
    }

    /// Whether the bot still keeps its dice in place.
    fn is_still(&self) -> bool {
        self.plays.is_none_or(|plays| self.played < plays)
    }
}

impl Bot for Still {
    fn name(&self) -> String {
        self.spec.clone()
    }

    fn new_game(&mut self) {
        self.played = 0;
        self.ab.new_game();
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Decision {
        let still = self.is_still();
        self.played += 1;
        if still && winning_move(state.board(), state.to_move()).is_none() {
            let increments: Vec<Command> = legal_commands(state)
                .into_iter()
                .filter(|command| matches!(command, Command::Increment { .. }))
                .collect();
            if !increments.is_empty() {
                let decision = self.ab.choose_among(state, increments, seed);
                let loses = decision.score.is_some_and(|s| s < 0 && is_decisive(s));
                if !loses {
                    return decision;
                }
            }
        }
        self.ab.choose(state, seed)
    }
}

#[cfg(test)]
mod tests {
    use seks_engine::{Engine, Side};

    use super::*;
    use crate::tactics::can_win_now;

    fn is_increment(command: Command) -> bool {
        matches!(command, Command::Increment { .. })
    }

    #[test]
    fn increments_for_its_first_plays_then_plays_as_ab() {
        let mut bot = Still::from_args("still:plays=3,depth=2", "plays=3,depth=2").unwrap();
        let mut ab = AlphaBeta::from_args("ab:depth=2", "depth=2").unwrap();
        bot.new_game();
        let mut state = GameState::initial();
        for ply in 0..8 {
            let command = if state.to_move() == Side::White {
                let command = bot.choose(&state, ply).command;
                // The Whites must move on the first turn.
                if (1..6).contains(&ply) {
                    assert!(is_increment(command), "ply {ply}: {command}");
                }
                command
            } else {
                ab.choose(&state, ply).command
            };
            state = Engine::step(&state, command).unwrap();
        }
        assert!(!bot.is_still());
        bot.new_game();
        assert!(bot.is_still());
    }

    #[test]
    fn moves_when_every_increment_loses() {
        // b2 at a3 reaches c1 through b2; a1 is taken. Every increment of
        // the Whites loses, and w2 at d2 blocks at b2 or c1.
        let state = GameState::from_diagram(
            "
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            b2 .. .. .. .. .. .. .. .. .. ..
            .. .. .. w2 .. .. .. .. .. .. ..
            w1 .. .. .. .. .. .. .. .. .. ..
            ",
            Side::White,
        )
        .unwrap();
        assert!(can_win_now(state.board(), Side::Black));
        let mut bot = Still::from_args("still:depth=3", "depth=3").unwrap();
        let command = bot.choose(&state, 0).command;
        assert!(!is_increment(command), "{command}");
        let next = Engine::step(&state, command).unwrap();
        assert!(!can_win_now(next.board(), Side::Black), "{command}");
    }

    #[test]
    fn a_full_front_row_holds_until_the_draw() {
        // After e1-f2 the Whites fill their front row: no Black die can
        // reach row 1 or capture a White die, so a still White side draws.
        let opening = Engine::step(&GameState::initial(), "e1-f2".parse().unwrap()).unwrap();
        let mut still = Still::from_args("still:nodes=2000", "nodes=2000").unwrap();
        let mut ab = AlphaBeta::from_args("ab:nodes=2000", "nodes=2000").unwrap();
        let mut state = opening;
        let mut ply = 0;
        while state.outcome().is_none() {
            let command = match state.to_move() {
                Side::White => still.choose(&state, ply).command,
                Side::Black => ab.choose(&state, ply).command,
            };
            if state.to_move() == Side::White {
                assert!(is_increment(command), "ply {ply}: {command}");
            }
            state = Engine::step(&state, command).unwrap();
            ply += 1;
        }
        assert_eq!(
            state.outcome(),
            Some(seks_engine::Outcome::Draw(
                seks_engine::DrawReason::NoCapture
            ))
        );
        assert_eq!(state.board().count(Side::White), 16);
    }
}
