//! The transposition table: a fixed power-of-2 array of entries indexed by
//! the low bits of the position hash.

#[cfg(test)]
use seks_engine::Cell;
use seks_engine::{Command, CELL_COUNT};

/// A command in 16 bits: `from * 121 + to` for a move, `121 * 121 + at`
/// for an increment, by `Cell::index`.
pub(crate) fn code(command: Command) -> u16 {
    match command {
        Command::Move { from, to } => (from.index() * CELL_COUNT + to.index()) as u16,
        Command::Increment { at } => (CELL_COUNT * CELL_COUNT + at.index()) as u16,
    }
}

/// The number of distinct codes.
pub(crate) const CODES: usize = CELL_COUNT * CELL_COUNT + CELL_COUNT;

/// No command.
pub(crate) const NO_CODE: u16 = u16::MAX;

/// The command of `code`, the inverse of [`code`].
#[cfg(test)]
pub(crate) fn decode(code: u16) -> Command {
    let code = code as usize;
    if code >= CELL_COUNT * CELL_COUNT {
        Command::Increment {
            at: Cell::from_index(code - CELL_COUNT * CELL_COUNT),
        }
    } else {
        Command::Move {
            from: Cell::from_index(code / CELL_COUNT),
            to: Cell::from_index(code % CELL_COUNT),
        }
    }
}

/// What the stored score says about the true score.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub(crate) enum Bound {
    Empty = 0,
    Exact,
    /// The true score is at least the stored one (a beta cutoff).
    Lower,
    /// The true score is at most the stored one (no move raised alpha).
    Upper,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Entry {
    pub(crate) key: u64,
    pub(crate) command: u16,
    pub(crate) score: i16,
    pub(crate) depth: i8,
    pub(crate) bound: Bound,
}

const EMPTY: Entry = Entry {
    key: 0,
    command: NO_CODE,
    score: 0,
    depth: 0,
    bound: Bound::Empty,
};

/// Entries by hash. A new entry replaces the old one unless both are the
/// same position and the old one was searched deeper.
pub(crate) struct Table {
    entries: Vec<Entry>,
    mask: usize,
}

impl Table {
    /// A table of at most `mib` MiB (at least one entry).
    pub(crate) fn new(mib: usize) -> Table {
        let bytes = mib.max(1) * 1024 * 1024;
        let count = (bytes / std::mem::size_of::<Entry>()).max(1);
        let count = if count.is_power_of_two() {
            count
        } else {
            count.next_power_of_two() / 2
        };
        Table {
            entries: vec![EMPTY; count],
            mask: count - 1,
        }
    }

    pub(crate) fn clear(&mut self) {
        self.entries.fill(EMPTY);
    }

    pub(crate) fn probe(&self, key: u64) -> Option<Entry> {
        let entry = self.entries[key as usize & self.mask];
        (entry.bound != Bound::Empty && entry.key == key).then_some(entry)
    }

    pub(crate) fn store(&mut self, key: u64, command: u16, score: i32, depth: i32, bound: Bound) {
        let slot = &mut self.entries[key as usize & self.mask];
        if slot.key == key && slot.bound != Bound::Empty && slot.depth as i32 > depth {
            return;
        }
        *slot = Entry {
            key,
            command,
            score: score.clamp(i16::MIN as i32, i16::MAX as i32) as i16,
            depth: depth.clamp(i8::MIN as i32, i8::MAX as i32) as i8,
            bound,
        };
    }

    /// Bytes used.
    #[cfg(test)]
    pub(crate) fn bytes(&self) -> usize {
        self.entries.len() * std::mem::size_of::<Entry>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use seks_engine::legal_commands;
    use seks_engine::GameState;

    #[test]
    fn codes_round_trip_and_fit_below_no_code() {
        for command in legal_commands(&GameState::initial()) {
            assert_eq!(decode(code(command)), command);
        }
        assert!(CODES < NO_CODE as usize);
    }

    #[test]
    fn the_table_fits_its_size_and_keeps_the_deeper_entry() {
        let mut table = Table::new(16);
        assert!(table.bytes() <= 16 * 1024 * 1024);
        assert_eq!(std::mem::size_of::<Entry>(), 16);
        table.store(42, 7, 100, 5, Bound::Exact);
        table.store(42, 8, 50, 3, Bound::Lower);
        assert_eq!(table.probe(42).unwrap().command, 7);
        assert!(table.probe(43).is_none());
        table.clear();
        assert!(table.probe(42).is_none());
    }
}
