//! The bots and the evaluation of a position by the greedy one.

use shesh_engine::{Command, GameState, EXIT, MAX_VALUE, ROSETTES, SHARED, SQUARES};

pub trait Bot: Send {
    fn choose(&mut self, state: &GameState) -> Command;
}

/// The names [`by_name`] accepts.
pub const BOTS: [&str; 3] = ["random", "greedy", "expecti"];

/// The bot `name`, with its randomness from `seed`.
pub fn by_name(name: &str, seed: u64) -> Result<Box<dyn Bot>, String> {
    match name {
        "random" => Ok(Box::new(Random(seed))),
        "greedy" => Ok(Box::new(Greedy)),
        "expecti" => Ok(Box::new(Expecti)),
        _ => Err(format!("unknown bot {name:?}, expected one of {BOTS:?}")),
    }
}

/// Any legal command, uniformly, from a splitmix64 of its own.
pub struct Random(u64);

impl Bot for Random {
    fn choose(&mut self, state: &GameState) -> Command {
        let commands = state.legal_commands();
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^= z >> 31;
        commands[(z % commands.len() as u64) as usize]
    }
}

/// The legal command whose resulting position [`evaluate`] likes best for
/// the player to move; ties go to the first one.
pub struct Greedy;

impl Bot for Greedy {
    fn choose(&mut self, state: &GameState) -> Command {
        let player = state.to_move();
        let commands = state.legal_commands();
        let mut best = (f64::NEG_INFINITY, commands[0]);
        for command in commands {
            let (next, _) = state.apply(command).expect("legal command");
            let mut score = evaluate(&next, player);
            if next.end().is_none() && next.to_move() == player {
                score += EXTRA_TURN;
            }
            if score > best.0 {
                best = (score, command);
            }
        }
        best.1
    }
}

/// One move ahead: the command whose position is best on average over the
/// next roll, where the other player answers with their best reply by
/// [`evaluate`] (and the player, after a rosette, with their own best).
pub struct Expecti;

impl Bot for Expecti {
    fn choose(&mut self, state: &GameState) -> Command {
        let player = state.to_move();
        let commands = state.legal_commands();
        let mut best = (f64::NEG_INFINITY, commands[0]);
        for command in commands {
            let (next, _) = state.apply(command).expect("legal command");
            let score = expected(&next, player);
            if score > best.0 {
                best = (score, command);
            }
        }
        best.1
    }
}

/// The worth of `state` for `player`, averaged over the roll of the player
/// to move, who plays their best one-move reply.
fn expected(state: &GameState, player: usize) -> f64 {
    if state.end().is_some() {
        return evaluate(state, player);
    }
    let mover = state.to_move();
    let sign = if mover == player { 1.0 } else { -1.0 };
    ROLLS
        .iter()
        .enumerate()
        .map(|(roll, chance)| {
            let rolled = state.with_roll(roll as u8);
            let best = rolled
                .legal_commands()
                .into_iter()
                .map(|command| {
                    let (next, _) = rolled.apply(command).expect("legal command");
                    sign * evaluate(&next, player)
                })
                .fold(f64::NEG_INFINITY, f64::max);
            chance * sign * best
        })
        .sum()
}

/// What a point is worth in the reserve, and the extra worth of a point on
/// the board, all the way to the exit.
const RESERVE: f64 = 0.3;
const PROGRESS: f64 = 0.7;
/// The worth of rolling again.
const EXTRA_TURN: f64 = 0.5;
/// The chances of the rolls 0 to 4 of four binary dice.
const ROLLS: [f64; 5] = [1.0 / 16.0, 4.0 / 16.0, 6.0 / 16.0, 4.0 / 16.0, 1.0 / 16.0];

/// The worth of the position for `player` minus its worth for the other,
/// in points: points made count 1, a point on the board between `RESERVE`
/// and 1 by how far it went, minus what the next roll of the other player
/// may eat. A won game is worth 100.
pub fn evaluate(state: &GameState, player: usize) -> f64 {
    if let Some(end) = state.end() {
        return if end.winner() == player {
            100.0
        } else {
            -100.0
        };
    }
    worth(state, player) - worth(state, 1 - player)
}

fn worth(state: &GameState, player: usize) -> f64 {
    let other = 1 - player;
    let mut total = f64::from(state.points(player));
    for value in 1..=MAX_VALUE {
        total += RESERVE * f64::from(value) * f64::from(state.in_reserve(player, value));
    }
    for square in 1..=SQUARES {
        let value = state.die_at(player, square);
        if value == 0 {
            continue;
        }
        let done = f64::from(square) / f64::from(EXIT);
        let on_board = f64::from(value) * (RESERVE + PROGRESS * done);
        total += on_board;
        if SHARED.contains(&square) && !ROSETTES.contains(&square) {
            // The chance that a die of the other player behind lands here.
            let threat: f64 = (1..=4u8)
                .filter(|&d| d < square && state.die_at(other, square - d) != 0)
                .map(|d| ROLLS[d as usize])
                .sum();
            total -= threat.min(1.0) * f64::from(value) * PROGRESS * done;
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_bots_finish_games() {
        for seed in 0..50 {
            let mut bots = [
                by_name("greedy", seed).unwrap(),
                by_name("random", seed).unwrap(),
            ];
            let mut state = GameState::new(seed);
            while state.end().is_none() {
                assert!(state.turn() < 5_000);
                let command = bots[state.to_move()].choose(&state);
                state = state.apply(command).unwrap().0;
            }
        }
    }

    #[test]
    fn evaluation_is_antisymmetric() {
        let state = GameState::new(3);
        let sum = evaluate(&state, 0) + evaluate(&state, 1);
        assert!(sum.abs() < 1e-9);
    }
}
