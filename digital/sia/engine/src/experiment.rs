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
    /// Four of a kind ranks below the run but stays above the flush (order:
    /// sum, pair, three, two pairs, flush, four, run, straight flush). The
    /// stone still counts for every kind. Unlike `four_below_run`, which
    /// puts the four below the flush as well; that one wins if both are on.
    pub four_below_run_only: bool,
    /// The stone counts only for the run and the flush: the kinds made of
    /// equal numbers (pair, three, two pairs, four) read the 3 dice alone,
    /// so there is no four of a kind and no two pairs.
    pub stone_only_for_sequences: bool,
    /// The formation reads only the 3 dice of the player, as in Battle
    /// Line (order: sum, pair, run, flush, three, straight flush). The
    /// stone only breaks ties between runs: a run the stone extends to 4
    /// numbers beats one it does not extend.
    pub three_dice_formations: bool,
    /// In the three-dice variant, the flush ranks below the run (order: sum,
    /// pair, flush, run, three, straight flush).
    pub flush_below_run: bool,
    /// The bag has 3 common suits and a wild one (the suit 3), in the
    /// proportions 2:2:2:1. A wild die counts as any suit in a flush, and can
    /// be put on the side of the opponent at no cost.
    pub wild_suit: bool,
    /// A new move instead of placing a die: put a die of the own hand on the
    /// side of the opponent. The hand is not refilled for it (the hand
    /// limit drops by one, like a die lost by rerolling).
    pub place_on_opponent: bool,
    /// Extra dice in the hand of the player who does not start.
    pub second_bonus: u8,
    /// The first turn of the game has no reroll.
    pub first_turn_without_reroll: bool,
}

static FOUR_BELOW_RUN: AtomicU8 = AtomicU8::new(0);
static FOUR_BELOW_RUN_ONLY: AtomicU8 = AtomicU8::new(0);
static STONE_ONLY: AtomicU8 = AtomicU8::new(0);
static THREE_DICE: AtomicU8 = AtomicU8::new(0);
static FLUSH_BELOW_RUN: AtomicU8 = AtomicU8::new(0);
static WILD_SUIT: AtomicU8 = AtomicU8::new(0);
static PLACE_ON_OPPONENT: AtomicU8 = AtomicU8::new(0);
static SECOND_BONUS: AtomicU8 = AtomicU8::new(0);
static FIRST_NO_REROLL: AtomicU8 = AtomicU8::new(0);

/// Sets the variant for every game of the process.
pub fn set_variant(variant: Variant) {
    FOUR_BELOW_RUN.store(variant.four_below_run.into(), Ordering::Relaxed);
    FOUR_BELOW_RUN_ONLY.store(variant.four_below_run_only.into(), Ordering::Relaxed);
    STONE_ONLY.store(variant.stone_only_for_sequences.into(), Ordering::Relaxed);
    THREE_DICE.store(variant.three_dice_formations.into(), Ordering::Relaxed);
    FLUSH_BELOW_RUN.store(variant.flush_below_run.into(), Ordering::Relaxed);
    WILD_SUIT.store(variant.wild_suit.into(), Ordering::Relaxed);
    PLACE_ON_OPPONENT.store(variant.place_on_opponent.into(), Ordering::Relaxed);
    SECOND_BONUS.store(variant.second_bonus, Ordering::Relaxed);
    FIRST_NO_REROLL.store(variant.first_turn_without_reroll.into(), Ordering::Relaxed);
}

/// The variant in force.
pub fn variant() -> Variant {
    Variant {
        four_below_run: FOUR_BELOW_RUN.load(Ordering::Relaxed) != 0,
        four_below_run_only: FOUR_BELOW_RUN_ONLY.load(Ordering::Relaxed) != 0,
        stone_only_for_sequences: STONE_ONLY.load(Ordering::Relaxed) != 0,
        three_dice_formations: THREE_DICE.load(Ordering::Relaxed) != 0,
        flush_below_run: FLUSH_BELOW_RUN.load(Ordering::Relaxed) != 0,
        wild_suit: WILD_SUIT.load(Ordering::Relaxed) != 0,
        place_on_opponent: PLACE_ON_OPPONENT.load(Ordering::Relaxed) != 0,
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

pub(crate) fn four_below_run_only() -> bool {
    FOUR_BELOW_RUN_ONLY.load(Ordering::Relaxed) != 0
}

pub(crate) fn three_dice_formations() -> bool {
    THREE_DICE.load(Ordering::Relaxed) != 0
}

pub(crate) fn place_on_opponent() -> bool {
    PLACE_ON_OPPONENT.load(Ordering::Relaxed) != 0
}

pub(crate) fn flush_below_run() -> bool {
    FLUSH_BELOW_RUN.load(Ordering::Relaxed) != 0
}

pub(crate) fn wild_suit() -> bool {
    WILD_SUIT.load(Ordering::Relaxed) != 0
}
