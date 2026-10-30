//! Bots of the mission and dice-pool game: a random bot and a greedy bot
//! with variants, and the batches that play them against each other.
//!
//! Every bot implements [`missoes_engine::Player`] and is built from its
//! name by [`by_name`]. The bots take their randomness from their own seed.

#![warn(unreachable_pub)]

pub mod batch;
mod bot;

pub use bot::{by_name, Greedy, Random, BOTS};

/// Threads of the batches by default: half the cores of the machine.
pub const DEFAULT_THREADS: usize = 6;
