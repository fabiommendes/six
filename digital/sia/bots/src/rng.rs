//! A small seeded random number generator (splitmix64), so the bots need no
//! dependency and every random choice is reproducible from a seed.

/// splitmix64: 64 bits of state, one addition and a mix per number.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rng(u64);

impl Rng {
    /// A generator that starts at `seed`.
    pub const fn new(seed: u64) -> Rng {
        Rng(seed)
    }

    /// The next 64 random bits.
    pub fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        mix(self.0)
    }

    /// A number in `0..bound`, for `bound > 0`. The bias of the plain
    /// modulo is below 2^-50 for the bounds the bots use.
    pub fn below(&mut self, bound: usize) -> usize {
        debug_assert!(bound > 0);
        (self.next_u64() % bound as u64) as usize
    }

    /// A number in `[0, 1)`.
    pub fn unit(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }
}

/// The output mix of splitmix64.
const fn mix(z: u64) -> u64 {
    let z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    let z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// A seed derived from `seed` and `stream`, so that the seeds of different
/// games, plies or threads do not overlap.
pub fn derive(seed: u64, stream: u64) -> u64 {
    mix(seed ^ mix(stream.wrapping_add(0x5EC5_0000_0000_0001)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_reference_splitmix64() {
        // First output of the reference implementation for seed 0.
        assert_eq!(Rng::new(0).next_u64(), 0xE220_A839_7B1D_CDAF);
    }

    #[test]
    fn below_stays_in_range_and_unit_in_0_1() {
        let mut rng = Rng::new(42);
        for bound in 1..50 {
            assert!(rng.below(bound) < bound);
            let x = rng.unit();
            assert!((0.0..1.0).contains(&x));
        }
    }

    #[test]
    fn derived_seeds_differ_by_stream() {
        assert_ne!(derive(1, 0), derive(1, 1));
        assert_ne!(derive(0, 1), derive(1, 0));
        assert_eq!(derive(3, 4), derive(3, 4));
    }
}
