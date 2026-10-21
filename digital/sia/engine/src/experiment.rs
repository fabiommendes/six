//! Rule variants for experiments only. The rules in `regras/sia/` are the
//! default and nothing here changes them: the options live in process-wide
//! atomics, set once before the games (by `sia-bots batch`), so the bots
//! see the same variant as the engine.

use std::sync::atomic::{AtomicU8, Ordering};

/// How the formations are ranked and read.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Variant {
    /// Four of a kind ranks below the flush and the run (order: sum, pair,
    /// three, two pairs, four, flush, run, straight flush).
    pub four_below_run: bool,
    /// The stone counts only for the run and the flush: the kinds made of
    /// equal numbers (pair, three, two pairs, four) read the 3 dice alone,
    /// so there is no four of a kind and no two pairs.
    pub stone_only_for_sequences: bool,
    /// Extra dice in the hand of the player who does not start.
    pub second_bonus: u8,
    /// The first turn of the game has no reroll.
    pub first_turn_without_reroll: bool,
}

static FOUR_BELOW_RUN: AtomicU8 = AtomicU8::new(0);
static STONE_ONLY: AtomicU8 = AtomicU8::new(0);
static SECOND_BONUS: AtomicU8 = AtomicU8::new(0);
static FIRST_NO_REROLL: AtomicU8 = AtomicU8::new(0);

/// Sets the variant for every game of the process.
pub fn set_variant(variant: Variant) {
    FOUR_BELOW_RUN.store(variant.four_below_run.into(), Ordering::Relaxed);
    STONE_ONLY.store(variant.stone_only_for_sequences.into(), Ordering::Relaxed);
    SECOND_BONUS.store(variant.second_bonus, Ordering::Relaxed);
    FIRST_NO_REROLL.store(variant.first_turn_without_reroll.into(), Ordering::Relaxed);
}

/// The variant in force.
pub fn variant() -> Variant {
    Variant {
        four_below_run: FOUR_BELOW_RUN.load(Ordering::Relaxed) != 0,
        stone_only_for_sequences: STONE_ONLY.load(Ordering::Relaxed) != 0,
        second_bonus: SECOND_BONUS.load(Ordering::Relaxed),
        first_turn_without_reroll: FIRST_NO_REROLL.load(Ordering::Relaxed) != 0,
    }
}

pub(crate) fn four_below_run() -> bool {
    FOUR_BELOW_RUN.load(Ordering::Relaxed) != 0
}

pub(crate) fn stone_only_for_sequences() -> bool {
    STONE_ONLY.load(Ordering::Relaxed) != 0
}
