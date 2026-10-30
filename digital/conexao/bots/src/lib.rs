//! Bots of the dice connection game: random, greedy, a two-ply lookahead
//! and an alpha-beta search, and the batches that play them against each other.
//!
//! Every bot implements [`Bot`] and is built from its name by [`by_name`].
//! The bots take their randomness from their own seed, to break ties.

#![warn(unreachable_pub)]

pub mod batch;
mod bot;
mod eval;

pub use bot::{by_name, Bot, Greedy, Lookahead, Random, Search, BOTS};
pub use eval::{best_value, distance, evaluate, path_distance, score, Terms};

/// Threads of the batches by default: half the cores of the machine.
pub const DEFAULT_THREADS: usize = 6;
