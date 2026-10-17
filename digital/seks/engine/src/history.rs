//! Hashes of the positions since the last capture, for the repetition draw.
//!
//! Only a capture is irreversible, so no position from before it can come
//! back: the list restarts at every capture. Without a capture the game is
//! drawn after 100 plays, so the list never has more than 101 hashes (the
//! position after the last capture plus one per play). It is a fixed array,
//! which keeps the whole state `Copy`.

use crate::outcome::MAX_PLIES_WITHOUT_CAPTURE;

/// The most hashes the list holds: the position after the last capture and
/// one per play up to the draw.
pub(crate) const CAPACITY: usize = MAX_PLIES_WITHOUT_CAPTURE as usize + 1;

#[derive(Clone, Copy, Debug)]
pub(crate) struct PositionHistory {
    hashes: [u64; CAPACITY],
    len: u8,
}

impl PositionHistory {
    /// A list with only `hash`.
    pub(crate) const fn new(hash: u64) -> PositionHistory {
        let mut hashes = [0; CAPACITY];
        hashes[0] = hash;
        PositionHistory { hashes, len: 1 }
    }

    /// A list with exactly `hashes`, oldest first, or `None` if there are no
    /// hashes or more than [`CAPACITY`].
    #[cfg(feature = "wire")]
    pub(crate) fn from_hashes(hashes: &[u64]) -> Option<PositionHistory> {
        let (&first, rest) = hashes.split_first()?;
        if hashes.len() > CAPACITY {
            return None;
        }
        let mut history = PositionHistory::new(first);
        for &hash in rest {
            history.push(hash);
        }
        Some(history)
    }

    /// Forgets everything but `hash`.
    pub(crate) fn restart(&mut self, hash: u64) {
        self.hashes[0] = hash;
        self.len = 1;
    }

    /// Appends the hash of the position after a play.
    pub(crate) fn push(&mut self, hash: u64) {
        self.hashes[self.len as usize] = hash;
        self.len += 1;
    }

    pub(crate) fn as_slice(&self) -> &[u64] {
        &self.hashes[..self.len as usize]
    }

    /// The hash of the current position (the last one).
    pub(crate) fn current(&self) -> u64 {
        self.hashes[self.len as usize - 1]
    }

    /// How many times the current position is in the list, itself included.
    ///
    /// The turn alternates, so a position with the same side to move can only
    /// be at an even distance: the scan skips the others. (Equal hashes
    /// already include the side to move; this only halves the work.)
    pub(crate) fn current_occurrences(&self) -> usize {
        let current = self.current();
        self.as_slice()
            .iter()
            .rev()
            .step_by(2)
            .filter(|&&hash| hash == current)
            .count()
    }
}

impl PartialEq for PositionHistory {
    fn eq(&self, other: &Self) -> bool {
        self.as_slice() == other.as_slice()
    }
}

impl Eq for PositionHistory {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_new_list_has_the_hash_once() {
        let history = PositionHistory::new(7);
        assert_eq!(history.current(), 7);
        assert_eq!(history.current_occurrences(), 1);
    }

    #[test]
    fn counts_only_positions_with_the_same_side_to_move() {
        let mut history = PositionHistory::new(1);
        for hash in [2, 1, 2, 1] {
            history.push(hash);
        }
        // 1 2 1 2 1: the current 1 appears at distances 0, 2 and 4.
        assert_eq!(history.current_occurrences(), 3);
    }

    #[test]
    fn restart_forgets_the_earlier_hashes() {
        let mut history = PositionHistory::new(1);
        history.push(2);
        history.restart(3);
        assert_eq!(history.as_slice(), &[3]);
    }

    #[test]
    fn equality_ignores_stale_slots() {
        let mut a = PositionHistory::new(1);
        a.push(2);
        a.restart(9);
        assert_eq!(a, PositionHistory::new(9));
    }

    #[test]
    fn holds_101_hashes() {
        let mut history = PositionHistory::new(0);
        for hash in 1..=100 {
            history.push(hash);
        }
        assert_eq!(history.as_slice().len(), CAPACITY);
    }
}
