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
//! - Native only: [`batch`], [`game`] and [`game_file`] (batches and game
//!   files), [`stats`] (Elo), [`openings`].

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

pub use bot::{by_name, Bot, Decision, Greedy, Random};
