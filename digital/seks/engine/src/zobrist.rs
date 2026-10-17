//! Zobrist hashing of positions: a `u64` that combines the cell, the side and
//! the value of every die, and the side to move.
//!
//! The keys come from a splitmix64 sequence with a fixed seed, evaluated at
//! compile time, so hashes are the same in every run and every build. Moving
//! or capturing a die changes the hash with a few XORs
//! ([`die_key`]), which is how the state keeps its history of positions.

use crate::board::Board;
use crate::cell::{Cell, CELL_COUNT};
use crate::die::{Die, Side, MAX_VALUE};

const SEED: u64 = 0x5E4B_5C0D_E5E4_0001;

/// Keys per cell: one per side and value.
const KEYS_PER_CELL: usize = 2 * MAX_VALUE as usize;

/// One step of splitmix64: the next state and the output.
const fn splitmix64(state: u64) -> (u64, u64) {
    let state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    (state, z ^ (z >> 31))
}

const fn build_keys() -> [u64; CELL_COUNT * KEYS_PER_CELL] {
    let mut keys = [0; CELL_COUNT * KEYS_PER_CELL];
    let mut state = SEED;
    let mut i = 0;
    while i < keys.len() {
        let (next, output) = splitmix64(state);
        state = next;
        keys[i] = output;
        i += 1;
    }
    keys
}

static DIE_KEYS: [u64; CELL_COUNT * KEYS_PER_CELL] = build_keys();

/// XORed into the hash when it is the Blacks' turn.
const BLACK_TO_MOVE_KEY: u64 = splitmix64(SEED ^ 0xFFFF_FFFF_FFFF_FFFF).1;

/// The key of `die` in `cell`.
pub(crate) fn die_key(cell: Cell, die: Die) -> u64 {
    let offset = die.side().index() * MAX_VALUE as usize + (die.value() as usize - 1);
    DIE_KEYS[cell.index() * KEYS_PER_CELL + offset]
}

/// The key that flips the side to move: XOR it after every play.
pub(crate) const fn turn_key() -> u64 {
    BLACK_TO_MOVE_KEY
}

/// The hash of a whole position, computed from scratch.
pub(crate) fn hash_position(board: &Board, to_move: Side) -> u64 {
    let dice = board
        .dice()
        .fold(0, |hash, (cell, die)| hash ^ die_key(cell, die));
    match to_move {
        Side::White => dice,
        Side::Black => dice ^ BLACK_TO_MOVE_KEY,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_deterministic() {
        // Golden value: a change here breaks hashes stored anywhere.
        assert_eq!(
            hash_position(&Board::initial(), Side::White),
            3_825_235_420_557_449_393
        );
    }

    #[test]
    fn splitmix64_matches_the_reference_output() {
        // First output of the reference implementation for seed 0.
        assert_eq!(splitmix64(0).1, 0xE220_A839_7B1D_CDAF);
    }

    #[test]
    fn keys_are_distinct() {
        let mut keys = DIE_KEYS.to_vec();
        keys.push(BLACK_TO_MOVE_KEY);
        keys.sort_unstable();
        keys.dedup();
        assert_eq!(keys.len(), CELL_COUNT * KEYS_PER_CELL + 1);
    }

    #[test]
    fn side_to_move_changes_the_hash() {
        let board = Board::initial();
        assert_ne!(
            hash_position(&board, Side::White),
            hash_position(&board, Side::Black)
        );
    }

    #[test]
    fn value_and_side_change_the_hash() {
        let cell = Cell::new(5, 5);
        let mut board = Board::empty();
        let mut seen = vec![hash_position(&board, Side::White)];
        for side in Side::ALL {
            for value in 1..=MAX_VALUE {
                board.set(cell, Some(Die::new(side, value)));
                seen.push(hash_position(&board, Side::White));
            }
        }
        seen.sort_unstable();
        seen.dedup();
        assert_eq!(seen.len(), 13);
    }
}
