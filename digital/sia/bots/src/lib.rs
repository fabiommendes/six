//! Bots of Sia: a random bot, a one-command greedy bot and the
//! perfect-information Monte Carlo bot, and the batches that play them
//! against each other.
//!
//! Every bot implements [`Bot`] and is built from a text spec by
//! [`by_name`], which lists the specs. The bots take their randomness from
//! a seed ([`rng`]) and never read the dice generator of the state, so
//! every game is reproducible and no bot knows the dice to come.
//!
//! - [`eval`]: the chances of the stones, the features and the weights.
//! - [`pimc`]: the Monte Carlo bot.
//! - [`stats`]: Elo and win rates.
//! - Native only: [`batch`].

#![warn(unreachable_pub)]

/// Threads and wall-clock timing: native only.
#[cfg(not(target_arch = "wasm32"))]
pub mod batch;
mod bot;
pub mod eval;
pub mod pimc;
pub mod rng;
pub mod stats;

pub use bot::{
    actions, by_name, candidates, from_file, reroll_candidates, with_weights, Bot, Greedy, Random,
};
pub use pimc::Pimc;

/// Threads of the batches by default: half the cores of the training
/// machine, so other work keeps running.
pub const DEFAULT_THREADS: usize = 6;
