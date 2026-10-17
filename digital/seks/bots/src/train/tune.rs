//! Texel tuning: fits the weights of the linear evaluation to self-play
//! positions by minimizing the squared error between `sigmoid(K * score)`
//! and a target that mixes the game result with the search's score.
//!
//! - Only quiet positions enter: no capture or win available to the side to
//!   move, no threat of the opponent to win, and a search score that is not
//!   a win or a loss. The evaluation is only asked about such positions.
//! - K is fitted first, on the initial weights against the results.
//! - Target: `lambda * sigmoid(K * search_score) + (1 - lambda) * result`,
//!   the result from the side to move (1, 1/2, 0).
//! - Adam over the whole training set per step, with a decoupled decay of
//!   every weight but the material towards its initial value (AdamW-style:
//!   the decay is not scaled by Adam, so weights the data never touches
//!   stay where they were).
//! - The games whose number is a multiple of 10 are held out for
//!   validation; the weights of the step with the lowest validation loss
//!   are kept, and tuning stops after `patience` steps without improving it.
//!
//! The features are already unchanged by mirroring the columns or swapping
//! the colors, so augmenting the data by those symmetries would only repeat
//! samples: it is not done.

use std::num::NonZeroUsize;

use seks_engine::{captures, legal_commands, GameState};

use super::dataset::Sample;
use crate::eval::features::{vector, COUNT, MATERIAL, VALUES};
use crate::eval::Weights;
use crate::search::is_decisive;
use crate::tactics::can_win_now;

/// Settings of a tuning run.
#[derive(Clone, Debug)]
pub struct Tune {
    pub lambda: f64,
    pub epochs: usize,
    pub learning_rate: f64,
    pub l2: f64,
    pub patience: usize,
    pub threads: NonZeroUsize,
}

impl Default for Tune {
    fn default() -> Tune {
        Tune {
            lambda: 0.5,
            epochs: 1000,
            learning_rate: 1.0,
            l2: 1e-4,
            patience: 100,
            threads: NonZeroUsize::new(4).unwrap(),
        }
    }
}

/// What a tuning run did.
#[derive(Clone, Debug, PartialEq)]
pub struct Report {
    pub k: f64,
    pub train_samples: usize,
    pub validation_samples: usize,
    pub train_loss_before: f64,
    pub validation_loss_before: f64,
    pub train_loss: f64,
    pub validation_loss: f64,
    /// The step whose weights were kept.
    pub best_epoch: usize,
}

/// Quiet samples as sparse feature vectors.
struct Data {
    /// `(index, count)` of the nonzero features, sample after sample.
    entries: Vec<(u16, i16)>,
    /// Where each sample starts in `entries`; one more at the end.
    starts: Vec<usize>,
    result: Vec<f64>,
    score: Vec<f64>,
}

impl Data {
    fn len(&self) -> usize {
        self.result.len()
    }

    fn features(&self, i: usize) -> &[(u16, i16)] {
        &self.entries[self.starts[i]..self.starts[i + 1]]
    }

    fn dot(&self, i: usize, weights: &[f64]) -> f64 {
        self.features(i)
            .iter()
            .map(|&(j, n)| weights[j as usize] * n as f64)
            .sum()
    }
}

/// Whether the evaluation would be asked about `sample`.
pub fn is_quiet(sample: &Sample) -> bool {
    if is_decisive(sample.score as i32) {
        return false;
    }
    let state = GameState::from_board(sample.board, sample.to_move);
    !can_win_now(&sample.board, sample.to_move)
        && !can_win_now(&sample.board, sample.to_move.opponent())
        && legal_commands(&state)
            .into_iter()
            .all(|command| captures(&state, command) == 0)
}

fn build(samples: &[&Sample], threads: NonZeroUsize) -> Data {
    let chunk = samples.len().div_ceil(threads.get()).max(1);
    let parts: Vec<Data> = std::thread::scope(|scope| {
        let handles: Vec<_> = samples
            .chunks(chunk)
            .map(|part| {
                scope.spawn(move || {
                    let mut data = Data {
                        entries: Vec::with_capacity(part.len() * 48),
                        starts: vec![0],
                        result: Vec::with_capacity(part.len()),
                        score: Vec::with_capacity(part.len()),
                    };
                    for sample in part {
                        let features = vector(&sample.board, sample.to_move);
                        for (j, &n) in features.iter().enumerate() {
                            if n != 0 {
                                data.entries.push((j as u16, n as i16));
                            }
                        }
                        data.starts.push(data.entries.len());
                        data.result.push(sample.outcome_for_mover());
                        data.score.push(sample.score as f64);
                    }
                    data
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    let mut data = Data {
        entries: Vec::new(),
        starts: vec![0],
        result: Vec::new(),
        score: Vec::new(),
    };
    for part in parts {
        let base = data.entries.len();
        data.entries.extend_from_slice(&part.entries);
        data.starts
            .extend(part.starts[1..].iter().map(|s| s + base));
        data.result.extend_from_slice(&part.result);
        data.score.extend_from_slice(&part.score);
    }
    data
}

fn sigmoid(x: f64) -> f64 {
    1.0 / (1.0 + (-x).exp())
}

/// Mean squared error of `weights` against the results only (to fit K).
fn result_loss(data: &Data, weights: &[f64], k: f64) -> f64 {
    let total: f64 = (0..data.len())
        .map(|i| (sigmoid(k * data.dot(i, weights)) - data.result[i]).powi(2))
        .sum();
    total / data.len().max(1) as f64
}

/// The K that best predicts the results from `weights`, by golden-section
/// search on log K.
fn fit_k(data: &Data, weights: &[f64]) -> f64 {
    let (mut low, mut high) = ((1e-4f64).ln(), (1e-1f64).ln());
    let ratio = (5f64.sqrt() - 1.0) / 2.0;
    for _ in 0..40 {
        let a = high - ratio * (high - low);
        let b = low + ratio * (high - low);
        if result_loss(data, weights, a.exp()) < result_loss(data, weights, b.exp()) {
            high = b;
        } else {
            low = a;
        }
    }
    ((low + high) / 2.0).exp()
}

/// Loss and gradient of the data term over `data`, in parallel.
fn loss_and_gradient(
    data: &Data,
    targets: &[f64],
    weights: &[f64],
    k: f64,
    threads: NonZeroUsize,
) -> (f64, Vec<f64>) {
    let n = data.len();
    let chunk = n.div_ceil(threads.get()).max(1);
    let parts: Vec<(f64, Vec<f64>)> = std::thread::scope(|scope| {
        let handles: Vec<_> = (0..n)
            .step_by(chunk)
            .map(|start| {
                scope.spawn(move || {
                    let mut loss = 0.0;
                    let mut gradient = vec![0.0; COUNT];
                    let end = (start + chunk).min(n);
                    for (i, &target) in targets.iter().enumerate().take(end).skip(start) {
                        let p = sigmoid(k * data.dot(i, weights));
                        let error = p - target;
                        loss += error * error;
                        let slope = 2.0 * error * k * p * (1.0 - p);
                        for &(j, count) in data.features(i) {
                            gradient[j as usize] += slope * count as f64;
                        }
                    }
                    (loss, gradient)
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    let mut loss = 0.0;
    let mut gradient = vec![0.0; COUNT];
    for (part_loss, part_gradient) in parts {
        loss += part_loss;
        for (g, p) in gradient.iter_mut().zip(part_gradient) {
            *g += p;
        }
    }
    let scale = 1.0 / n.max(1) as f64;
    gradient.iter_mut().for_each(|g| *g *= scale);
    (loss * scale, gradient)
}

fn loss(data: &Data, targets: &[f64], weights: &[f64], k: f64) -> f64 {
    let total: f64 = (0..data.len())
        .map(|i| (sigmoid(k * data.dot(i, weights)) - targets[i]).powi(2))
        .sum();
    total / data.len().max(1) as f64
}

fn regularized(index: usize) -> bool {
    !(MATERIAL..MATERIAL + VALUES).contains(&index)
}

/// Tunes `init` on the quiet positions of `samples`. Calls `log` with the
/// step, the training loss and the validation loss every 50 steps.
pub fn tune(
    samples: &[Sample],
    init: &Weights,
    settings: &Tune,
    log: &mut dyn FnMut(usize, f64, f64),
) -> Result<(Weights, Report), String> {
    let quiet: Vec<&Sample> = samples.iter().filter(|s| is_quiet(s)).collect();
    let (validation, train): (Vec<&Sample>, Vec<&Sample>) =
        quiet.into_iter().partition(|s| s.game % 10 == 0);
    if train.is_empty() || validation.is_empty() {
        return Err("not enough quiet positions to tune".into());
    }
    let train = build(&train, settings.threads);
    let validation = build(&validation, settings.threads);
    let mut weights = init.values.clone();
    let k = fit_k(&train, &weights);
    let target = |data: &Data| -> Vec<f64> {
        (0..data.len())
            .map(|i| {
                settings.lambda * sigmoid(k * data.score[i])
                    + (1.0 - settings.lambda) * data.result[i]
            })
            .collect()
    };
    let (train_targets, validation_targets) = (target(&train), target(&validation));
    let train_loss_before = loss(&train, &train_targets, &weights, k);
    let validation_loss_before = loss(&validation, &validation_targets, &weights, k);

    let (beta1, beta2, epsilon) = (0.9, 0.999, 1e-8);
    let mut m = vec![0.0; COUNT];
    let mut v = vec![0.0; COUNT];
    let mut best = (
        validation_loss_before,
        weights.clone(),
        0,
        train_loss_before,
    );
    for epoch in 1..=settings.epochs {
        let (train_loss, gradient) =
            loss_and_gradient(&train, &train_targets, &weights, k, settings.threads);
        for j in 0..COUNT {
            m[j] = beta1 * m[j] + (1.0 - beta1) * gradient[j];
            v[j] = beta2 * v[j] + (1.0 - beta2) * gradient[j] * gradient[j];
            let m_hat = m[j] / (1.0 - beta1.powi(epoch as i32));
            let v_hat = v[j] / (1.0 - beta2.powi(epoch as i32));
            weights[j] -= settings.learning_rate * m_hat / (v_hat.sqrt() + epsilon);
            if regularized(j) {
                weights[j] -= settings.l2 * (weights[j] - init.values[j]);
            }
        }
        let validation_loss = loss(&validation, &validation_targets, &weights, k);
        if validation_loss < best.0 {
            best = (validation_loss, weights.clone(), epoch, train_loss);
        }
        if epoch % 50 == 0 {
            log(epoch, train_loss, validation_loss);
        }
        if epoch - best.2 >= settings.patience {
            break;
        }
    }
    let (validation_loss, values, best_epoch, train_loss) = best;
    let report = Report {
        k,
        train_samples: train.len(),
        validation_samples: validation.len(),
        train_loss_before,
        validation_loss_before,
        train_loss,
        validation_loss,
        best_epoch,
    };
    let meta = serde_json::json!({
        "source": "tune",
        "k": k,
        "lambda": settings.lambda,
        "l2": settings.l2,
        "train_samples": report.train_samples,
        "validation_samples": report.validation_samples,
        "train_loss": train_loss,
        "validation_loss": validation_loss,
        "validation_loss_before": validation_loss_before,
        "best_epoch": best_epoch,
    });
    Ok((Weights { values, meta }, report))
}
