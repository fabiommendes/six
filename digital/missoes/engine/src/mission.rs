//! The missions and how they score a round.

/// A mission. The standard is always on the table, out of the deck; the
/// others are cards.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Mission {
    /// The largest group of equal values: its size.
    Standard,
    /// The standard, plus the bonus.
    Bonus,
    /// The most different values: their count.
    Distinct,
    /// The most even values: their count.
    Even,
    /// The most odd values: their count.
    Odd,
    /// The most 5s and 6s: their count.
    High,
    /// The most 1s and 2s: their count.
    Low,
    /// The two largest groups together; the second counts from 2 dice.
    TwoGroups,
    /// The most dice of value `n`: twice their count.
    Number(u8),
}

/// The numbers in the scoring of the missions, open to experiments.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Scoring {
    /// Added to the bonus mission.
    pub bonus: u8,
    /// Taken from the count of the even and odd missions.
    pub parity_minus: u8,
}

impl Default for Scoring {
    fn default() -> Scoring {
        Scoring {
            bonus: 1,
            parity_minus: 0,
        }
    }
}

impl Mission {
    /// The kinds of mission card.
    pub const CARDS: [Mission; 13] = [
        Mission::Bonus,
        Mission::Distinct,
        Mission::Even,
        Mission::Odd,
        Mission::High,
        Mission::Low,
        Mission::TwoGroups,
        Mission::Number(1),
        Mission::Number(2),
        Mission::Number(3),
        Mission::Number(4),
        Mission::Number(5),
        Mission::Number(6),
    ];

    /// Every mission, the standard first.
    pub const ALL: [Mission; 14] = [
        Mission::Standard,
        Mission::Bonus,
        Mission::Distinct,
        Mission::Even,
        Mission::Odd,
        Mission::High,
        Mission::Low,
        Mission::TwoGroups,
        Mission::Number(1),
        Mission::Number(2),
        Mission::Number(3),
        Mission::Number(4),
        Mission::Number(5),
        Mission::Number(6),
    ];

    /// The cards of this kind in the deck.
    pub fn copies(self) -> usize {
        match self {
            Mission::Standard => 0,
            Mission::Number(_) => 1,
            _ => 2,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Mission::Standard => "standard",
            Mission::Bonus => "bonus",
            Mission::Distinct => "distinct",
            Mission::Even => "even",
            Mission::Odd => "odd",
            Mission::High => "high",
            Mission::Low => "low",
            Mission::TwoGroups => "twogroups",
            Mission::Number(1) => "ones",
            Mission::Number(2) => "twos",
            Mission::Number(3) => "threes",
            Mission::Number(4) => "fours",
            Mission::Number(5) => "fives",
            Mission::Number(_) => "sixes",
        }
    }

    /// What a hand makes in the mission: the points it scores if it wins.
    /// The results grow with what the mission compares, so the best result
    /// wins.
    pub fn result(self, values: &[u8], scoring: Scoring) -> u8 {
        let count = |keep: &dyn Fn(u8) -> bool| values.iter().filter(|&&v| keep(v)).count() as u8;
        match self {
            Mission::Standard => best_group(values, false).0,
            Mission::Bonus => match best_group(values, false).0 {
                0 => 0,
                group => group + scoring.bonus,
            },
            Mission::Distinct => distinct(values),
            Mission::Even => count(&|v| v % 2 == 0).saturating_sub(scoring.parity_minus),
            Mission::Odd => count(&|v| v % 2 == 1).saturating_sub(scoring.parity_minus),
            Mission::High => count(&|v| v >= 5),
            Mission::Low => count(&|v| v <= 2),
            Mission::TwoGroups => {
                let mut counts = [0u8; 7];
                values.iter().for_each(|&v| counts[v as usize] += 1);
                counts.sort_unstable_by(|a, b| b.cmp(a));
                counts[0] + if counts[1] >= 2 { counts[1] } else { 0 }
            }
            Mission::Number(n) => 2 * count(&|v| v == n),
        }
    }
}

/// The value that repeats most in `values` and how many times: `(count,
/// value)`. A tie goes to the highest value, or the lowest with `low`.
/// No values give `(0, 0)`.
pub fn best_group(values: &[u8], low: bool) -> (u8, u8) {
    let mut counts = [0u8; 7];
    for &v in values {
        counts[v as usize] += 1;
    }
    let mut best = (0, 0);
    for v in 1..=6u8 {
        let c = counts[v as usize];
        if c > best.0 || (c == best.0 && c > 0 && !low) {
            best = (c, v);
        }
    }
    best
}

/// The number of different values in `values`.
pub fn distinct(values: &[u8]) -> u8 {
    (1..=6u8).filter(|v| values.contains(v)).count() as u8
}

/// The points of the players on one mission, given their hands: everyone
/// with the best result scores it; nobody scores a result of 0.
pub fn resolve(mission: Mission, hands: &[Vec<u8>], scoring: Scoring) -> Vec<i32> {
    let results: Vec<u8> = hands.iter().map(|h| mission.result(h, scoring)).collect();
    let top = results.iter().copied().max().unwrap_or(0);
    results
        .iter()
        .map(|&r| if top > 0 && r == top { r as i32 } else { 0 })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const S: Scoring = Scoring {
        bonus: 1,
        parity_minus: 0,
    };

    #[test]
    fn standard_ties_all_score() {
        let hands = vec![vec![5, 5, 5, 1], vec![2, 2, 2, 6], vec![3, 3, 4]];
        assert_eq!(resolve(Mission::Standard, &hands, S), vec![3, 3, 0]);
    }

    #[test]
    fn a_tie_inside_a_hand_takes_the_highest_value() {
        assert_eq!(best_group(&[2, 2, 4, 4], false), (2, 4));
        assert_eq!(best_group(&[2, 2, 4, 4], true), (2, 2));
        assert_eq!(best_group(&[], false), (0, 0));
    }

    #[test]
    fn the_results_of_the_cards() {
        let hand = [1, 1, 1, 4, 4, 6];
        assert_eq!(Mission::Standard.result(&hand, S), 3);
        assert_eq!(Mission::Bonus.result(&hand, S), 4);
        assert_eq!(Mission::Even.result(&hand, S), 3);
        assert_eq!(Mission::Odd.result(&hand, S), 3);
        assert_eq!(Mission::High.result(&hand, S), 1);
        assert_eq!(Mission::Low.result(&hand, S), 3);
        assert_eq!(Mission::TwoGroups.result(&hand, S), 5);
        assert_eq!(Mission::TwoGroups.result(&[1, 1, 1, 2, 3], S), 3);
        assert_eq!(Mission::Distinct.result(&[6, 5, 3, 1, 2, 5], S), 5);
        assert_eq!(Mission::Even.result(&[1, 3], S), 0);
        assert_eq!(Mission::Number(4).result(&hand, S), 4);
        assert_eq!(Mission::Number(2).result(&hand, S), 0);
        assert_eq!(Mission::Bonus.result(&[], S), 0);
    }

    #[test]
    fn the_deck_has_one_card_per_number_and_two_of_the_others() {
        let cards: usize = Mission::CARDS.iter().map(|m| m.copies()).sum();
        assert_eq!(cards, 6 + 2 * 7);
    }

    #[test]
    fn nobody_scores_without_dice() {
        assert_eq!(resolve(Mission::Standard, &[vec![], vec![]], S), vec![0, 0]);
    }
}
