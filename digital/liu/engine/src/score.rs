//! Scoring and the winners (`regras/liu/05-fim-do-jogo.md#pontuação`).
//!
//! Every complete row and column scores 1, plus 1 for a run and 1 for the
//! code. The code is chosen to score the most, so it is always the set of
//! numbers of some complete line: the set that most complete lines have,
//! the first in line order on a tie.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

use crate::window::{Line, Window};

/// The three runs: four numbers in a row, in any order.
pub const RUNS: [[u8; 4]; 3] = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];

/// What one complete line scores.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct LineScore {
    pub line: Line,
    pub run: bool,
    pub code: bool,
    pub points: u8,
}

/// What a window scores with its best code.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Score {
    /// The code, in increasing order; `None` without a complete line, when
    /// any code scores the same.
    pub code: Option<[u8; 4]>,
    pub lines: Vec<LineScore>,
    pub points: u8,
    /// Dice in the window: the tie break.
    pub dice: u8,
}

fn sorted(values: &[u8]) -> [u8; 4] {
    let mut set: [u8; 4] = values.try_into().expect("a complete line has 4 dice");
    set.sort_unstable();
    set
}

pub fn is_run(values: &[u8]) -> bool {
    RUNS.contains(&sorted(values))
}

/// The score of a window with the code that scores the most.
pub fn score(window: &Window) -> Score {
    let lines = window.complete_lines();
    let sets: Vec<[u8; 4]> = lines.iter().map(|line| sorted(&line.values)).collect();
    let code = sets
        .iter()
        .enumerate()
        .max_by_key(|&(i, set)| {
            (
                sets.iter().filter(|s| *s == set).count(),
                std::cmp::Reverse(i),
            )
        })
        .map(|(_, set)| *set);
    let lines: Vec<LineScore> = lines
        .into_iter()
        .zip(&sets)
        .map(|(line, set)| {
            let run = RUNS.contains(set);
            let code = code == Some(*set);
            LineScore {
                line,
                run,
                code,
                points: 1 + run as u8 + code as u8,
            }
        })
        .collect();
    Score {
        code,
        points: lines.iter().map(|line| line.points).sum(),
        lines,
        dice: window.len() as u8,
    }
}

/// The winners among the scores: the most points, then the most dice. More
/// than one shares the win.
pub fn winners(scores: &[Score]) -> Vec<usize> {
    let best = scores.iter().map(|s| (s.points, s.dice)).max();
    (0..scores.len())
        .filter(|&i| Some((scores[i].points, scores[i].dice)) == best)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::window::{Placed, Pos};

    fn window(rows: &[&[u8]]) -> Window {
        let mut dice = Vec::new();
        for (r, row) in rows.iter().enumerate() {
            for (c, &value) in row.iter().enumerate() {
                if value != 0 {
                    dice.push(Placed {
                        at: Pos::new(r as i8, c as i8),
                        value,
                    });
                }
            }
        }
        Window::from_dice(&dice).unwrap()
    }

    #[test]
    fn a_full_window_of_runs_and_codes_scores_24() {
        // Every line is a permutation of 2 3 4 5: a run and the code.
        let w = window(&[&[2, 3, 4, 5], &[3, 4, 5, 2], &[4, 5, 2, 3], &[5, 2, 3, 4]]);
        let s = score(&w);
        assert_eq!(s.code, Some([2, 3, 4, 5]));
        assert_eq!(s.points, 24);
        assert_eq!(s.dice, 16);
    }

    #[test]
    fn the_code_is_the_most_common_set() {
        // Row 0: 6 1 5 2 (code 1 2 5 6); row 1: 1 5 2 6 (the same set);
        // columns are incomplete.
        let w = window(&[&[6, 1, 5, 2], &[1, 5, 2, 6]]);
        let s = score(&w);
        assert_eq!(s.code, Some([1, 2, 5, 6]));
        assert_eq!(s.points, 4);
        assert!(s.lines.iter().all(|l| l.code && !l.run));
    }

    #[test]
    fn a_run_that_is_not_the_code_scores_2() {
        let w = window(&[&[6, 1, 5, 2], &[1, 5, 2, 6], &[5, 6, 4, 3]]);
        let s = score(&w);
        assert_eq!(s.code, Some([1, 2, 5, 6]));
        assert_eq!(s.lines[2].points, 2);
        assert_eq!(s.points, 6);
    }

    #[test]
    fn no_complete_line_scores_nothing() {
        let w = window(&[&[3, 1, 2]]);
        assert_eq!(
            score(&w),
            Score {
                code: None,
                lines: vec![],
                points: 0,
                dice: 3
            }
        );
    }

    #[test]
    fn the_tie_break_is_the_dice_then_a_shared_win() {
        let a = Score {
            code: None,
            lines: vec![],
            points: 3,
            dice: 9,
        };
        let b = Score {
            code: None,
            lines: vec![],
            points: 3,
            dice: 10,
        };
        assert_eq!(winners(&[a.clone(), b.clone()]), vec![1]);
        assert_eq!(winners(&[b.clone(), a, b]), vec![0, 2]);
    }
}
