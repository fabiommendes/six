//! Perfect-information Monte Carlo. The only thing hidden in the Liu is
//! what the dice will roll, so a sample is the position with a reseeded
//! generator: one possible future of the bag and of the rerolls.
//!
//! The root keeps the `top` commands of [`Greedy`]. In each sample every
//! one of them is played and followed by a greedy rollout until the game
//! ends, or for `turns` commands. A finished rollout is worth the share of
//! the win; a cut one, the logistic of the evaluation divided by `temp`.
//! The bot plays the command with the highest mean. Every command of a
//! sample sees the same generator, so the comparison is between commands,
//! not between lucky draws.

use liu_engine::{Command, GameState};

use crate::bot::{Bot, Greedy};
use crate::eval::{relative, Weights};
use crate::rng::Rng;

#[derive(Clone, Debug)]
pub struct Pimc {
    pub weights: Weights,
    /// Sampled futures.
    pub samples: u32,
    /// Commands of the root scored by rollouts, the best of [`Greedy`].
    pub top: usize,
    /// Commands per rollout before the evaluation scores it; 0 plays to
    /// the end of the game.
    pub turns: u32,
    /// Points of evaluation that move a cut rollout from 50% to 73%.
    pub temp: f64,
    /// Sampled markets that score a reroll in the greedy choices.
    pub rerolls: u32,
}

impl Pimc {
    pub fn new(weights: Weights) -> Pimc {
        Pimc {
            weights,
            samples: 32,
            top: 6,
            turns: 8,
            temp: 2.0,
            rerolls: 2,
        }
    }

    fn greedy(&self) -> Greedy {
        Greedy {
            rerolls: self.rerolls,
            ..Greedy::new(self.weights.clone())
        }
    }

    /// The mean reward of each of `commands` for the player to move.
    pub fn scores(&self, state: &GameState, commands: &[Command], rng: &mut Rng) -> Vec<f64> {
        let seat = state.to_move();
        let greedy = self.greedy();
        let mut totals = vec![0.0; commands.len()];
        for _ in 0..self.samples {
            let world = state.reseeded(rng.next_u64());
            let rollout_seed = rng.next_u64();
            for (total, &command) in totals.iter_mut().zip(commands) {
                let next = world.apply(command).expect("a listed command is legal").0;
                *total += self.rollout(&greedy, next, seat, rollout_seed);
            }
        }
        totals.iter().map(|t| t / f64::from(self.samples)).collect()
    }

    /// Plays greedy commands from `state` and returns the reward of `seat`.
    fn rollout(&self, greedy: &Greedy, mut state: GameState, seat: usize, seed: u64) -> f64 {
        let mut rng = Rng::new(seed);
        let mut played = 0;
        while !state.is_over() && (self.turns == 0 || played < self.turns) {
            let commands = state.legal_commands();
            let pick = greedy.pick(&state, &commands, &mut rng);
            state = state
                .apply(commands[pick])
                .expect("a listed command is legal")
                .0;
            played += 1;
        }
        match state.winners() {
            Some(winners) if winners.contains(&seat) => 1.0 / winners.len() as f64,
            Some(_) => 0.0,
            None => 1.0 / (1.0 + (-relative(&self.weights, &state, seat) / self.temp).exp()),
        }
    }
}

impl Bot for Pimc {
    fn name(&self) -> String {
        format!(
            "pimc:samples={},top={},turns={},temp={},rerolls={}",
            self.samples, self.top, self.turns, self.temp, self.rerolls
        )
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Command {
        let commands = state.legal_commands();
        assert!(!commands.is_empty(), "the game is over");
        if commands.len() == 1 {
            return commands[0];
        }
        let mut rng = Rng::new(seed);
        let greedy = self.greedy().scores(state, &commands, &mut rng);
        let mut order: Vec<usize> = (0..commands.len()).collect();
        order.sort_by(|&a, &b| greedy[b].total_cmp(&greedy[a]).then(a.cmp(&b)));
        order.truncate(self.top);
        if order.len() == 1 {
            return commands[order[0]];
        }
        let candidates: Vec<Command> = order.iter().map(|&i| commands[i]).collect();
        let scores = self.scores(state, &candidates, &mut rng);
        // The best mean; on a tie, the better greedy score (earlier in order).
        let best = (0..candidates.len())
            .max_by(|&a, &b| scores[a].total_cmp(&scores[b]).then(b.cmp(&a)))
            .expect("at least two candidates");
        candidates[best]
    }
}
