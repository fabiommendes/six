//! The missions and how they score a round.

/// A mission. The standard mission is always on the table and cannot be
/// sabotaged; the others are cards.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Mission {
    /// The most repetitions of a value.
    Standard,
    /// The standard, with one more die of the value the player wants.
    Present,
    /// The longest run of consecutive values.
    Sequence,
    /// The standard over the even values, plus the bonus.
    Even,
    /// The standard over the odd values, plus the bonus.
    Odd,
    /// The standard over 4, 5 and 6, plus the bonus.
    High,
    /// The standard over 1, 2 and 3, plus the bonus.
    Low,
    /// The two largest groups together; the second counts from 2 dice.
    TwoGroups,
}

impl Mission {
    /// The mission cards.
    pub const CARDS: [Mission; 7] = [
        Mission::Present,
        Mission::Sequence,
        Mission::Even,
        Mission::Odd,
        Mission::High,
        Mission::Low,
        Mission::TwoGroups,
    ];

    /// Every mission, the standard first.
    pub const ALL: [Mission; 8] = [
        Mission::Standard,
        Mission::Present,
        Mission::Sequence,
        Mission::Even,
        Mission::Odd,
        Mission::High,
        Mission::Low,
        Mission::TwoGroups,
    ];

    pub fn name(self) -> &'static str {
        match self {
            Mission::Standard => "standard",
            Mission::Present => "present",
            Mission::Sequence => "sequence",
            Mission::Even => "even",
            Mission::Odd => "odd",
            Mission::High => "high",
            Mission::Low => "low",
            Mission::TwoGroups => "twogroups",
        }
    }

    /// What a hand makes in the mission: the points it scores if it wins.
    pub fn result(self, values: &[u8], bonus: u8) -> u8 {
        let only = |keep: fn(u8) -> bool| {
            let kept: Vec<u8> = values.iter().copied().filter(|&v| keep(v)).collect();
            match best_group(&kept, false).0 {
                0 => 0,
                count => count + bonus,
            }
        };
        match self {
            Mission::Standard => best_group(values, false).0,
            Mission::Present => best_group(values, false).0 + 1,
            Mission::Sequence => longest_run(values),
            Mission::Even => only(|v| v % 2 == 0),
            Mission::Odd => only(|v| v % 2 == 1),
            Mission::High => only(|v| v >= 4),
            Mission::Low => only(|v| v <= 3),
            Mission::TwoGroups => {
                let mut counts = [0u8; 7];
                values.iter().for_each(|&v| counts[v as usize] += 1);
                counts.sort_unstable_by(|a, b| b.cmp(a));
                counts[0] + if counts[1] >= 2 { counts[1] } else { 0 }
            }
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

/// The longest run of consecutive values in `values`.
pub fn longest_run(values: &[u8]) -> u8 {
    let mut seen = [false; 8];
    for &v in values {
        seen[v as usize] = true;
    }
    let (mut best, mut run) = (0, 0);
    for &shown in &seen[1..=6] {
        run = if shown { run + 1 } else { 0 };
        best = best.max(run);
    }
    best
}

/// The points of the players on one mission, given their hands: everyone
/// with the best result scores it; nobody scores a result of 0.
pub fn resolve(mission: Mission, hands: &[Vec<u8>], bonus: u8) -> Vec<i32> {
    let results: Vec<u8> = hands.iter().map(|h| mission.result(h, bonus)).collect();
    let top = results.iter().copied().max().unwrap_or(0);
    results
        .iter()
        .map(|&r| if top > 0 && r == top { r as i32 } else { 0 })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_ties_all_score() {
        let hands = vec![vec![5, 5, 5, 1], vec![2, 2, 2, 6], vec![3, 3, 4]];
        assert_eq!(resolve(Mission::Standard, &hands, 1), vec![3, 3, 0]);
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
        assert_eq!(Mission::Standard.result(&hand, 1), 3);
        assert_eq!(Mission::Present.result(&hand, 1), 4);
        assert_eq!(Mission::Even.result(&hand, 1), 3);
        assert_eq!(Mission::Odd.result(&hand, 1), 4);
        assert_eq!(Mission::High.result(&hand, 1), 3);
        assert_eq!(Mission::Low.result(&hand, 2), 5);
        assert_eq!(Mission::TwoGroups.result(&hand, 1), 5);
        assert_eq!(Mission::TwoGroups.result(&[1, 1, 1, 2, 3], 1), 3);
        assert_eq!(Mission::Sequence.result(&[6, 5, 3, 1, 2], 1), 3);
        assert_eq!(Mission::Even.result(&[1, 3], 1), 0);
    }

    #[test]
    fn nobody_scores_without_dice() {
        assert_eq!(resolve(Mission::Standard, &[vec![], vec![]], 1), vec![0, 0]);
    }
}
