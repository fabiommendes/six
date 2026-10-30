//! Rules engine of the mission and dice-pool game, a prototype whose rules
//! are still a proposal in `dev/rfc/jogo-de-missoes.md`.
//!
//! - `dice`: the kinds of dice and their faces.
//! - `mission`: the missions and how they score.
//! - `game`: the table, the round and the [`Player`] trait through which
//!   the engine asks each player for its decisions.
//! - `steps`: the same game one decision at a time ([`Steps`]), for an
//!   interface: the pending decision and the answer to it.
//! - `rng`: the seeded generator of the rolls and shuffles.
//!
//! [`Game::play`] drives the game and calls the players back, for bot
//! batches; [`Steps`] waits for each answer instead.

#![warn(unreachable_pub)]

mod dice;
mod game;
mod mission;
mod rng;
mod steps;

pub use dice::{Kind, Rolled};
pub use game::{Action, Game, Payment, Player, Round, RoundLog, Rules, Spot};
pub use mission::{best_group, distinct, resolve, Mission, Scoring};
pub use rng::Rng;
pub use steps::{Answer, Decision, Pending, Played, Steps};
