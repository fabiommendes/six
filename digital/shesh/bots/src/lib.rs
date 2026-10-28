//! Bots of the Shesh: a random bot, a one-move greedy bot and a one-move
//! expectimax bot, and the batches that play them against each other.
//!
//! Every bot implements [`Bot`] and is built from its name by [`by_name`].
//! The bots take their randomness from their own seed and never read the
//! generator of the state, so no bot knows the rolls to come.

#![warn(unreachable_pub)]

pub mod batch;
mod bot;

pub use bot::{by_name, evaluate, Bot, Expecti, Greedy, Random, BOTS};

/// Threads of the batches by default: half the cores of the machine.
pub const DEFAULT_THREADS: usize = 6;
