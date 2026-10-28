//! The rolls of a game: SplitMix64, seeded once when the game starts.
//!
//! The generator is part of the state, so a replay rolls the same numbers
//! again. Its state crosses JSON as 16 hexadecimal digits, because a `u64`
//! does not fit a JSON number in JavaScript.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

/// A seeded generator of rolls.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export, as = "String"))]
pub struct Rng(u64);

#[cfg(feature = "wire")]
impl Serialize for Rng {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&String::from(*self))
    }
}

#[cfg(feature = "wire")]
impl<'de> Deserialize<'de> for Rng {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Rng, D::Error> {
        Rng::try_from(String::deserialize(deserializer)?).map_err(serde::de::Error::custom)
    }
}

impl From<Rng> for String {
    fn from(rng: Rng) -> String {
        format!("{:016x}", rng.0)
    }
}

impl TryFrom<String> for Rng {
    type Error = String;

    fn try_from(text: String) -> Result<Rng, String> {
        let bad = || format!("rng state must be 16 hexadecimal digits, got {text:?}");
        if text.len() != 16 {
            return Err(bad());
        }
        u64::from_str_radix(&text, 16).map(Rng).map_err(|_| bad())
    }
}

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
    fn the_state_round_trips_as_text() {
        let mut rng = Rng::new(u64::MAX - 3);
        rng.coin();
        let text = String::from(rng);
        assert_eq!(Rng::try_from(text).unwrap(), rng);
        assert!(Rng::try_from("xyz".to_string()).is_err());
    }

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
