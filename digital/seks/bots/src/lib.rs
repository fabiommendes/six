//! Bots of Seks: a random bot, a one-ply greedy bot, the alpha-beta bot,
//! and the tools that play them against each other and train them.
//!
//! Every bot implements [`Bot`] and is built from a text spec by
//! [`by_name`], which lists the specs. The bots take their randomness from
//! a seed ([`rng`]), so every game is reproducible.
//!
//! - [`eval`]: the features and the linear evaluation (`EVALUATOR.md`).
//! - [`search`]: the alpha-beta search, with no clock and no threads.
//! - [`tactics`]: wins in one move.
//! - [`stats`] (Elo), [`openings`].
//! - Native only: [`batch`], [`game`] and [`game_file`] (batches and game
//!   files), [`bench`], [`train`] (self-play, Texel tuning, the training
//!   loop).

#![warn(unreachable_pub)]

pub mod ab;
/// Threads and wall-clock timing: native only.
#[cfg(not(target_arch = "wasm32"))]
pub mod batch;
pub mod bench;
mod bot;
pub mod eval;
#[cfg(not(target_arch = "wasm32"))]
pub mod game;
#[cfg(not(target_arch = "wasm32"))]
pub mod game_file;
pub mod openings;
pub mod rng;
pub mod search;
pub mod stats;
pub mod tactics;
/// Self-play, tuning and the training loop: native only.
#[cfg(not(target_arch = "wasm32"))]
pub mod train;

pub use bot::{by_name, Bot, Decision, Greedy, Random};

/// Threads of the expensive commands (batches, self-play, tuning) by
/// default: half the cores of the training machine, so other work keeps
/// running (`dev/notes/bots-do-seks.md`).
pub const DEFAULT_THREADS: usize = 6;

/// [`DEFAULT_THREADS`], but no more than the machine has.
pub fn default_threads() -> std::num::NonZeroUsize {
    let all = std::thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);
    std::num::NonZeroUsize::new(DEFAULT_THREADS.min(all).max(1)).unwrap()
}
