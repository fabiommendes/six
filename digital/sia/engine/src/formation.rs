//! The formations (`regras/sia/04-formacoes.md`): the three dice of a side
//! and the stone, ranked, and the best formation a side can still become.
//! The order, from the strongest: straight flush, three of a kind, run,
//! flush, pair, sum (the rarer with 3 dice at random, the stronger).

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

use crate::die::Die;
#[cfg(test)]
use crate::die::JOKER_SUIT;

/// The kinds of formation, from the weakest to the strongest.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum FormationKind {
    Sum,
    Pair,
    Flush,
    Run,
    ThreeOfAKind,
    StraightFlush,
}

impl FormationKind {
    /// Every kind, from the weakest to the strongest.
    pub const ALL: [FormationKind; 6] = [
        FormationKind::Sum,
        FormationKind::Pair,
        FormationKind::Flush,
        FormationKind::Run,
        FormationKind::ThreeOfAKind,
        FormationKind::StraightFlush,
    ];

    /// The position in [`FormationKind::ALL`], which is the order of
    /// strength.
    pub fn index(self) -> usize {
        self as usize
    }
}

/// A formation: its kind, then the sum of the four numbers, which breaks
/// ties. The derived order is the order of strength.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Formation {
    pub kind: FormationKind,
    pub sum: u8,
}

/// The formation of the stone number and the three dice of a side.
///
/// The stone counts for the run and for the sum, and its suit counts as any
/// suit; the pair and the three of a kind read the 3 dice alone, so there is
/// no four of a kind and no two pairs. The `sum` is the sum of the four
/// numbers, the stone included.
///
/// # Panics
///
/// If `dice` does not have exactly 3 dice.
pub fn formation(stone: u8, dice: &[Die]) -> Formation {
    assert_eq!(dice.len(), 3, "a formation has 3 dice and the stone");
    let numbers = [stone, dice[0].value, dice[1].value, dice[2].value];
    let mut counts = [0u8; 7];
    for die in dice {
        counts[die.value as usize] += 1;
    }
    let most = *counts.iter().max().expect("counts is not empty");
    let low = *numbers.iter().min().expect("4 numbers");
    let high = *numbers.iter().max().expect("4 numbers");
    let distinct = numbers
        .iter()
        .fold(0u8, |mask, &n| mask | 1 << n)
        .count_ones()
        == 4;
    let run = distinct && high - low == 3;
    let flush = is_flush(dice);
    let kind = match (run, flush, most) {
        (true, true, _) => FormationKind::StraightFlush,
        (_, _, 3) => FormationKind::ThreeOfAKind,
        (true, false, _) => FormationKind::Run,
        (false, true, _) => FormationKind::Flush,
        (false, false, 2) => FormationKind::Pair,
        _ => FormationKind::Sum,
    };
    Formation {
        kind,
        sum: numbers.iter().sum(),
    }
}

/// Whether the dice share a suit, a joker counting as any.
pub fn is_flush(dice: &[Die]) -> bool {
    let mut plain = dice.iter().filter(|d| !d.is_joker());
    plain
        .next()
        .is_none_or(|first| plain.all(|d| d.suit == first.suit))
}

/// The strongest formation a side with `dice` (0 to 3 dice) can still
/// become, with any number and any suit of the bag on the dice that are
/// missing.
///
/// The suits matter only for the flush, and a flush is never worse than the
/// same numbers without one, so it is enough to try each choice of numbers
/// once: with all the missing dice in the suit of the dice already there
/// when those share one (or any suit, when there are none), and otherwise
/// in any suit.
pub fn best_completion(stone: u8, dice: &[Die]) -> Formation {
    assert!(dice.len() <= 3, "a side has at most 3 dice");
    let missing = 3 - dice.len();
    let suit = dice.iter().find(|d| !d.is_joker()).map_or(0, |d| d.suit);
    let same_suit = is_flush(dice);
    let fill = if same_suit { suit } else { 0 };
    let mut full = [Die::new(1, fill); 3];
    full[..dice.len()].copy_from_slice(dice);
    let mut best = None;
    let combos = 6usize.pow(missing as u32);
    for code in 0..combos {
        let mut rest = code;
        for slot in &mut full[dice.len()..] {
            *slot = Die::new((rest % 6) as u8 + 1, fill);
            rest /= 6;
        }
        let f = formation(stone, &full);
        if best.is_none_or(|b| f > b) {
            best = Some(f);
        }
    }
    best.expect("at least one completion")
}

#[cfg(test)]
mod tests {
    use super::*;
    use FormationKind::*;

    fn dice(spec: &[(u8, u8)]) -> Vec<Die> {
        spec.iter().map(|&(v, s)| Die::new(v, s)).collect()
    }

    fn kind(stone: u8, spec: &[(u8, u8)]) -> (FormationKind, u8) {
        let f = formation(stone, &dice(spec));
        (f.kind, f.sum)
    }

    #[test]
    fn the_order_is_the_one_of_the_rules() {
        assert!(StraightFlush > ThreeOfAKind);
        assert!(ThreeOfAKind > Run);
        assert!(Run > Flush);
        assert!(Flush > Pair);
        assert!(Pair > Sum);
    }

    #[test]
    fn each_kind_is_recognized() {
        assert_eq!(kind(3, &[(1, 0), (2, 0), (4, 0)]), (StraightFlush, 10));
        assert_eq!(kind(3, &[(2, 0), (4, 1), (5, 2)]), (Run, 14));
        assert_eq!(kind(1, &[(2, 0), (4, 0), (6, 0)]), (Flush, 13));
        assert_eq!(kind(2, &[(5, 0), (5, 1), (5, 2)]), (ThreeOfAKind, 17));
        assert_eq!(kind(2, &[(5, 0), (5, 1), (4, 2)]), (Pair, 16));
        assert_eq!(kind(1, &[(3, 0), (4, 1), (6, 2)]), (Sum, 14));
    }

    #[test]
    fn the_stone_counts_for_the_run_and_the_sum_but_not_for_equal_numbers() {
        // A stone equal to a die of the side does not make a pair.
        assert_eq!(kind(2, &[(2, 0), (4, 1), (5, 2)]), (Sum, 13));
        // Three equal dice and an equal stone are a three of a kind, not four.
        assert_eq!(kind(3, &[(3, 0), (3, 1), (3, 2)]), (ThreeOfAKind, 12));
        // The stone makes a pair of dice and a stone no two pairs.
        assert_eq!(kind(2, &[(2, 0), (5, 1), (5, 2)]), (Pair, 14));
        // The stone completes a run of 4 numbers.
        assert_eq!(kind(1, &[(2, 0), (3, 1), (4, 2)]).0, Run);
        assert_eq!(kind(5, &[(2, 0), (3, 1), (4, 2)]).0, Run);
        // Without the stone, 3 numbers in a row are not a run.
        assert_eq!(kind(6, &[(2, 0), (3, 1), (4, 2)]).0, Sum);
    }

    #[test]
    fn a_run_is_not_a_flush_and_the_joker_takes_any_suit() {
        // Flush with a pair: the flush wins over the pair.
        assert_eq!(kind(4, &[(4, 1), (2, 1), (4, 1)]).0, Flush);
        // Three equal dice of one suit are still a three of a kind, which is
        // above the flush.
        assert_eq!(kind(4, &[(4, 1), (4, 1), (4, 1)]).0, ThreeOfAKind);
        // Run in one suit is a straight flush, not a flush.
        assert_eq!(kind(4, &[(5, 2), (6, 2), (3, 2)]).0, StraightFlush);
        // 1 2 3 4, 2 3 4 5 and 3 4 5 6 are runs, 1 2 3 5 is not.
        assert_eq!(kind(1, &[(2, 0), (3, 1), (4, 2)]).0, Run);
        assert_eq!(kind(6, &[(3, 0), (4, 1), (5, 2)]).0, Run);
        assert_eq!(kind(1, &[(2, 0), (3, 1), (5, 2)]).0, Sum);
        // The joker is any suit.
        assert_eq!(kind(2, &[(1, 2), (3, 2), (6, JOKER_SUIT)]).0, Flush);
        assert_eq!(kind(2, &[(1, 2), (3, 1), (6, JOKER_SUIT)]).0, Sum);
    }

    #[test]
    fn the_sum_breaks_ties_between_equal_kinds() {
        let low = formation(3, &dice(&[(1, 0), (2, 1), (4, 2)]));
        let high = formation(3, &dice(&[(2, 0), (4, 1), (5, 2)]));
        assert_eq!((low.kind, high.kind), (Run, Run));
        assert!(high > low);
    }

    /// Every completion, with every number and every suit of the bag.
    fn brute_force(stone: u8, dice: &[Die]) -> Formation {
        let missing = 3 - dice.len();
        let mut best = None;
        for code in 0..24usize.pow(missing as u32) {
            let mut full = dice.to_vec();
            let mut rest = code;
            for _ in 0..missing {
                full.push(Die::new((rest % 6) as u8 + 1, ((rest / 6) % 4) as u8));
                rest /= 24;
            }
            let f = formation(stone, &full);
            if best.is_none_or(|b| f > b) {
                best = Some(f);
            }
        }
        best.expect("a completion")
    }

    #[test]
    fn the_best_completion_matches_the_brute_force() {
        let mut state = 12345u64;
        let mut next = |bound: u64| {
            state = state
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            (state >> 33) % bound
        };
        for _ in 0..400 {
            let stone = next(6) as u8 + 1;
            let len = next(4) as usize;
            let side: Vec<Die> = (0..len)
                .map(|_| Die::new(next(6) as u8 + 1, next(4) as u8))
                .collect();
            assert_eq!(
                best_completion(stone, &side),
                brute_force(stone, &side),
                "stone {stone}, {side:?}"
            );
        }
    }

    #[test]
    fn an_empty_side_can_become_a_straight_flush() {
        let best = best_completion(3, &[]);
        assert_eq!(best.kind, StraightFlush);
        // The highest sum among straight flushes with a 3: 3 4 5 6.
        assert_eq!(best.sum, 18);
    }

    #[test]
    fn two_suits_cannot_be_a_flush_any_more() {
        let side = dice(&[(1, 0), (1, 1)]);
        assert_eq!(best_completion(1, &side).kind, ThreeOfAKind);
        let side = dice(&[(1, 0), (2, 1)]);
        assert_eq!(best_completion(3, &side).kind, Run);
        // With a joker the suit of the other die is kept, and the three of a
        // kind is above the flush.
        let side = dice(&[(1, 0), (1, JOKER_SUIT)]);
        assert_eq!(best_completion(1, &side).kind, ThreeOfAKind);
        let side = dice(&[(1, 0), (4, JOKER_SUIT)]);
        assert_eq!(best_completion(6, &side).kind, Flush);
    }
}
