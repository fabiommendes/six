//! The dice rolls of a game: SplitMix64, seeded once when the game starts.
//!
//! The generator is part of the state, so a saved game, an undo or a replay
//! rolls the same numbers again. Its state crosses JSON as 16 hexadecimal
//! digits, because a `u64` does not fit a JSON number in JavaScript.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

/// A seeded generator of die rolls.
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

    /// A roll of a six-sided die: 1 to 6.
    pub fn roll(&mut self) -> u8 {
        (((self.next_u64() >> 32) * 6) >> 32) as u8 + 1
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
        if text.len() != 16 {
            return Err(format!(
                "rng state must be 16 hexadecimal digits, got {text:?}"
            ));
        }
        u64::from_str_radix(&text, 16)
            .map(Rng)
            .map_err(|_| format!("rng state must be 16 hexadecimal digits, got {text:?}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rolls_every_face_about_evenly() {
        let mut rng = Rng::new(7);
        let mut counts = [0u32; 6];
        for _ in 0..60_000 {
            counts[rng.roll() as usize - 1] += 1;
        }
        for count in counts {
            assert!((9_000..11_000).contains(&count), "{counts:?}");
        }
    }

    #[test]
    fn the_state_round_trips_as_text() {
        let mut rng = Rng::new(u64::MAX - 3);
        rng.roll();
        let text = String::from(rng);
        assert_eq!(Rng::try_from(text).unwrap(), rng);
        assert!(Rng::try_from("xyz".to_string()).is_err());
    }
}
