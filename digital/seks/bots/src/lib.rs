//! Bots of Seks: a random bot, a one-ply greedy bot, and the tools that play
//! them against each other.
//!
//! Every bot implements [`Bot`] and is built from a text spec by
//! [`by_name`], which lists the specs. The bots take their randomness from
//! a seed ([`rng`]), so every game is reproducible.

#![warn(unreachable_pub)]

/// Threads and wall-clock timing: native only.
#[cfg(not(target_arch = "wasm32"))]
pub mod batch;
mod bot;
#[cfg(not(target_arch = "wasm32"))]
pub mod game;
#[cfg(not(target_arch = "wasm32"))]
pub mod game_file;
pub mod openings;
pub mod rng;
pub mod stats;
pub mod tactics;

pub use bot::{by_name, Bot, Decision, Greedy, Random};
