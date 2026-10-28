//! The rolls of a game: SplitMix64, seeded once when the game starts.
//!
//! The generator is part of the state, so a replay rolls the same numbers
//! again.

/// A seeded generator of rolls.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Rng {
        Rng(seed)
    }

    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// A fair coin.
    pub fn coin(&mut self) -> bool {
        self.next_u64() >> 63 == 1
    }

    /// The sum of `dice` binary dice (3 faces 0 and 3 faces 1 each).
    pub fn binary(&mut self, dice: u8) -> u8 {
        (0..dice).map(|_| u8::from(self.coin())).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_binary_dice_follow_the_binomial() {
        let mut rng = Rng::new(11);
        let mut counts = [0u32; 5];
        for _ in 0..160_000 {
            counts[rng.binary(4) as usize] += 1;
        }
        // 1, 4, 6, 4, 1 in 16.
        for (count, weight) in counts.into_iter().zip([1, 4, 6, 4, 1]) {
            let expected = 10_000 * weight;
            assert!(count.abs_diff(expected) < expected / 20, "{counts:?}");
        }
    }
}
