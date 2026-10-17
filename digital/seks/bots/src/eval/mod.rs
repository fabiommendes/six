//! The evaluation: a weighted sum of the features of [`features`], from the
//! side to move, in hundredths of a die.

pub mod features;
pub mod weights;

use seks_engine::{Board, Side};

use features::{extract, Sink, COUNT};
pub use weights::Weights;

/// Fixed-point scale of the weights inside the evaluator.
const SCALE: i32 = 16;

/// The evaluation function with its weights in fixed point.
#[derive(Clone, Debug)]
pub struct Evaluator {
    weights: Box<[i32; COUNT]>,
}

struct Sum<'a> {
    weights: &'a [i32; COUNT],
    total: i32,
}

impl Sink for Sum<'_> {
    fn add(&mut self, index: usize, count: i32) {
        self.total += self.weights[index] * count;
    }
}

impl Evaluator {
    pub fn new(weights: &Weights) -> Evaluator {
        let mut fixed = Box::new([0; COUNT]);
        for (fixed, &weight) in fixed.iter_mut().zip(&weights.values) {
            *fixed = (weight * SCALE as f64).round() as i32;
        }
        Evaluator { weights: fixed }
    }

    /// The score of `board` for `to_move`: positive when it is ahead.
    pub fn evaluate(&self, board: &Board, to_move: Side) -> i32 {
        let mut sum = Sum {
            weights: &self.weights,
            total: 0,
        };
        extract(board, to_move, &mut sum);
        sum.total / SCALE
    }
}

impl Default for Evaluator {
    fn default() -> Evaluator {
        Evaluator::new(&Weights::default())
    }
}

#[cfg(test)]
mod tests {
    use super::features::{mirror_columns, swap_colors};
    use super::*;
    use crate::rng::Rng;
    use seks_engine::{legal_commands, Engine, GameState};

    #[test]
    fn the_score_ignores_color_swaps_and_column_mirrors() {
        let evaluator = Evaluator::new(&Weights::hand());
        for seed in 0..10 {
            let mut rng = Rng::new(seed);
            let mut state = GameState::initial();
            for _ in 0..60 {
                if state.outcome().is_some() {
                    break;
                }
                let (board, side) = (state.board(), state.to_move());
                let score = evaluator.evaluate(board, side);
                assert_eq!(
                    score,
                    evaluator.evaluate(&swap_colors(board), side.opponent())
                );
                assert_eq!(score, evaluator.evaluate(&mirror_columns(board), side));
                let commands = legal_commands(&state);
                state = Engine::step(&state, commands[rng.below(commands.len())]).unwrap();
            }
        }
    }

    #[test]
    fn a_die_more_is_better() {
        let evaluator = Evaluator::new(&Weights::hand());
        let mut board = Board::initial();
        board.set(seks_engine::Cell::new(1, 10), None);
        assert!(evaluator.evaluate(&board, Side::White) > 0);
        assert!(evaluator.evaluate(&board, Side::Black) < 0);
    }
}
