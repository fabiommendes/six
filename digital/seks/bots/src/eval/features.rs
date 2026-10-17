//! The features of a position, from the side to move ("us"). One function,
//! [`extract`], feeds both the evaluation (a weighted sum) and the training
//! (the feature vector), so the two never diverge. `EVALUATOR.md` describes
//! each feature.
//!
//! Every feature is unchanged by swapping the colors (mirroring the rows and
//! passing the turn) and by mirroring the columns: rows count from each
//! side's own back row, and columns are folded around the center column.

use seks_engine::{Board, Cell, Die, Side, BOARD_SIZE, DIRECTIONS};

use crate::tactics::{forward, relative_row};

/// Rows of the piece-square table: relative rows 1 to 11.
pub const ROWS: usize = BOARD_SIZE as usize;
/// Columns of the piece-square table: 1 to 6, the column folded around the
/// center (column 1 and 11 are both 1, column 6 is 6).
pub const COLUMNS: usize = 6;
/// Die values.
pub const VALUES: usize = 6;
/// Buckets of the gap feature: gap 0 or less, 1, 2, 3.
pub const GAPS: usize = 4;

/// Offsets of the features in the vector.
pub const MATERIAL: usize = 0;
pub const PST: usize = MATERIAL + VALUES;
pub const GAP_US: usize = PST + ROWS * COLUMNS * VALUES;
pub const GAP_THEM: usize = GAP_US + GAPS;
pub const AT_RISK_US: usize = GAP_THEM + GAPS;
pub const AT_RISK_THEM: usize = AT_RISK_US + 1;
pub const BLOCKERS_US: usize = AT_RISK_THEM + 1;
pub const BLOCKERS_THEM: usize = BLOCKERS_US + 1;
pub const THREATS_US: usize = BLOCKERS_THEM + 1;
pub const THREATS_THEM: usize = THREATS_US + 1;
pub const TEMPO: usize = THREATS_THEM + 1;
/// Number of features.
pub const COUNT: usize = TEMPO + 1;

/// The index of the piece-square feature of a die of `value` on relative
/// row `row` (1 to 11) and folded column `column` (1 to 6).
pub const fn pst_index(row: usize, column: usize, value: usize) -> usize {
    PST + ((row - 1) * COLUMNS + (column - 1)) * VALUES + (value - 1)
}

/// Receives the features of a position, each as an index and a count.
/// The same index may come more than once: the counts add up.
pub trait Sink {
    fn add(&mut self, index: usize, count: i32);
}

/// Collects the features into a dense vector.
impl Sink for [i32; COUNT] {
    fn add(&mut self, index: usize, count: i32) {
        self[index] += count;
    }
}

/// The column folded around the center: 1 to 6.
const fn folded_column(column: u8) -> usize {
    let mirrored = BOARD_SIZE + 1 - column;
    (if column < mirrored { column } else { mirrored }) as usize
}

/// Width of the padded board: the 11 columns and a border cell on each side.
const WIDTH: i32 = BOARD_SIZE as i32 + 2;
/// Cells of the padded board, borders included.
const PADDED: usize = (WIDTH * WIDTH) as usize;
const EMPTY: u8 = 0;
const BORDER: u8 = 0x80;
/// Set on the cells of the Blacks' dice; the low bits are the value.
const BLACK: u8 = 0x10;

/// The board with a border, so that walking off it needs no bounds check.
/// A cell holds `EMPTY`, `BORDER`, or the value of a die, with `BLACK` set
/// for a black die.
struct Padded {
    cells: [u8; PADDED],
}

/// A die: its padded index, relative row (from its side) and folded column.
#[derive(Clone, Copy)]
struct Placed {
    at: i32,
    row: u8,
    column: u8,
    value: u8,
}

/// The dice of one side.
struct Dice {
    list: [Placed; 16],
    len: usize,
}

impl Dice {
    fn as_slice(&self) -> &[Placed] {
        &self.list[..self.len]
    }
}

const fn padded_index(cell: Cell) -> i32 {
    cell.row() as i32 * WIDTH + cell.column() as i32
}

/// The step of each of the 8 directions on the padded board.
const STEPS: [i32; 8] = {
    let mut steps = [0; 8];
    let mut i = 0;
    while i < 8 {
        steps[i] = DIRECTIONS[i].0 as i32 + DIRECTIONS[i].1 as i32 * WIDTH;
        i += 1;
    }
    steps
};
const ORTHOGONAL_STEPS: [i32; 4] = [WIDTH, -1, -WIDTH, 1];

const fn side_bits(side: Side) -> u8 {
    match side {
        Side::White => 0,
        Side::Black => BLACK,
    }
}

/// Whether `square` holds a die of the side with `bits`.
const fn is_die_of(square: u8, bits: u8) -> bool {
    square != EMPTY && square != BORDER && square & BLACK == bits
}

/// The padded board with no dice.
const EMPTY_BOARD: [u8; PADDED] = {
    let mut cells = [BORDER; PADDED];
    let mut row = 1;
    while row <= BOARD_SIZE as i32 {
        let mut column = 1;
        while column <= BOARD_SIZE as i32 {
            cells[(row * WIDTH + column) as usize] = EMPTY;
            column += 1;
        }
        row += 1;
    }
    cells
};

fn read(board: &Board) -> (Padded, [Dice; 2]) {
    let mut padded = Padded { cells: EMPTY_BOARD };
    let none = Placed {
        at: 0,
        row: 0,
        column: 0,
        value: 0,
    };
    let mut dice = [
        Dice {
            list: [none; 16],
            len: 0,
        },
        Dice {
            list: [none; 16],
            len: 0,
        },
    ];
    for (cell, die) in board.dice() {
        let at = padded_index(cell);
        padded.cells[at as usize] = die.value() | side_bits(die.side());
        let side = &mut dice[usize::from(die.side() == Side::Black)];
        if side.len < 16 {
            side.list[side.len] = Placed {
                at,
                row: relative_row(cell, die.side()),
                column: folded_column(cell.column()) as u8,
                value: die.value(),
            };
            side.len += 1;
        }
    }
    (padded, dice)
}

impl Padded {
    /// Whether a die of the side with `bits` can move to the empty cell `to`:
    /// the first die on some line from `to` is one of its dice, and its value
    /// reaches.
    fn reaches(&self, to: i32, bits: u8) -> bool {
        STEPS.iter().any(|&step| {
            let mut at = to;
            for distance in 1..=MAX_REACH {
                at += step;
                let square = self.cells[at as usize];
                if square == EMPTY {
                    continue;
                }
                return is_die_of(square, bits) && (square & 0x0F) >= distance;
            }
            false
        })
    }

    /// How many of `own` the side with `bits` can capture on its next move:
    /// the die has an empty orthogonal neighbor that side reaches, and one of
    /// its dice on the opposite neighbor.
    fn at_risk(&self, own: &Dice, bits: u8) -> i32 {
        let mut count = 0;
        for die in own.as_slice() {
            let captured = ORTHOGONAL_STEPS.iter().any(|&step| {
                let landing = die.at + step;
                self.cells[landing as usize] == EMPTY
                    && is_die_of(self.cells[(die.at - step) as usize], bits)
                    && self.reaches(landing, bits)
            });
            count += i32::from(captured);
        }
        count
    }

    /// For the dice of `attacker` (of `side`) that reach the goal row by
    /// value: the clear paths to it (threats) and the paths whose first die
    /// belongs to the other side (blocks).
    fn lines(&self, attacker: &Dice, side: Side) -> (i32, i32) {
        let forward = forward(side) as i32 * WIDTH;
        let own = side_bits(side);
        let (mut threats, mut blocks) = (0, 0);
        for die in attacker.as_slice() {
            let distance = BOARD_SIZE - die.row;
            if distance == 0 || distance > die.value {
                continue;
            }
            for step in [forward, forward - 1, forward + 1] {
                let mut at = die.at;
                let mut first = EMPTY;
                let mut inside = true;
                for _ in 0..distance {
                    at += step;
                    let square = self.cells[at as usize];
                    if square == BORDER {
                        inside = false;
                        break;
                    }
                    if first == EMPTY {
                        first = square;
                    }
                }
                if !inside {
                    continue;
                }
                if first == EMPTY {
                    threats += 1;
                } else if !is_die_of(first, own) {
                    blocks += 1;
                }
            }
        }
        (threats, blocks)
    }
}

/// The farthest a die moves.
const MAX_REACH: u8 = 6;

/// Sends the features of `board` with `to_move` to play to `sink`.
pub fn extract(board: &Board, to_move: Side, sink: &mut impl Sink) {
    let (padded, dice) = read(board);
    let us = usize::from(to_move == Side::Black);
    let (ours, theirs) = (&dice[us], &dice[1 - us]);
    for (side_dice, sign, gap_base) in [(ours, 1, GAP_US), (theirs, -1, GAP_THEM)] {
        for die in side_dice.as_slice() {
            let value = die.value as usize;
            sink.add(MATERIAL + value - 1, sign);
            sink.add(
                pst_index(die.row as usize, die.column as usize, value),
                sign,
            );
            let gap = (BOARD_SIZE - die.row) as i32 - value as i32;
            if gap < GAPS as i32 {
                sink.add(gap_base + gap.max(0) as usize, 1);
            }
        }
    }
    let (us_bits, them_bits) = (side_bits(to_move), side_bits(to_move.opponent()));
    sink.add(AT_RISK_US, padded.at_risk(ours, them_bits));
    sink.add(AT_RISK_THEM, padded.at_risk(theirs, us_bits));
    let (threats_us, blocked_by_them) = padded.lines(ours, to_move);
    let (threats_them, blocked_by_us) = padded.lines(theirs, to_move.opponent());
    sink.add(THREATS_US, threats_us);
    sink.add(THREATS_THEM, threats_them);
    sink.add(BLOCKERS_US, blocked_by_us);
    sink.add(BLOCKERS_THEM, blocked_by_them);
    sink.add(TEMPO, 1);
}

/// The dense feature vector of a position.
pub fn vector(board: &Board, to_move: Side) -> [i32; COUNT] {
    let mut features = [0; COUNT];
    extract(board, to_move, &mut features);
    features
}

/// `board` with the colors swapped and the rows mirrored: the same game
/// seen from the other side.
pub fn swap_colors(board: &Board) -> Board {
    transform(board, |cell, die| {
        (
            Cell::new(cell.column(), BOARD_SIZE + 1 - cell.row()),
            Die::new(die.side().opponent(), die.value()),
        )
    })
}

/// `board` with the columns mirrored.
pub fn mirror_columns(board: &Board) -> Board {
    transform(board, |cell, die| {
        (Cell::new(BOARD_SIZE + 1 - cell.column(), cell.row()), die)
    })
}

fn transform(board: &Board, map: impl Fn(Cell, Die) -> (Cell, Die)) -> Board {
    let mut out = Board::empty();
    for (cell, die) in board.dice() {
        let (cell, die) = map(cell, die);
        out.set(cell, Some(die));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;
    use seks_engine::{legal_commands, Engine, GameState};

    /// Positions from random games, a few per game.
    fn sample_positions() -> Vec<GameState> {
        let mut positions = Vec::new();
        for seed in 0..20 {
            let mut rng = Rng::new(seed);
            let mut state = GameState::initial();
            for ply in 0..120 {
                if state.outcome().is_some() {
                    break;
                }
                if ply % 15 == 0 {
                    positions.push(state);
                }
                let commands = legal_commands(&state);
                state = Engine::step(&state, commands[rng.below(commands.len())]).unwrap();
            }
        }
        positions
    }

    #[test]
    fn swapping_the_colors_and_mirroring_the_columns_keep_the_features() {
        for state in sample_positions() {
            let board = state.board();
            let side = state.to_move();
            let features = vector(board, side);
            assert_eq!(
                features,
                vector(&swap_colors(board), side.opponent()),
                "\n{board}"
            );
            assert_eq!(features, vector(&mirror_columns(board), side), "\n{board}");
        }
    }

    #[test]
    fn the_initial_position_is_balanced_but_for_the_tempo() {
        let features = vector(&Board::initial(), Side::White);
        let nonzero: Vec<usize> = (0..COUNT).filter(|&i| features[i] != 0).collect();
        assert_eq!(nonzero, vec![TEMPO]);
    }

    #[test]
    fn counts_threats_blocks_and_dice_at_risk() {
        let state = GameState::from_diagram(
            "
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            w3 .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. b1 w2 .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. b2
            .. .. .. .. .. .. .. .. .. w1 ..
            ",
            Side::Black,
        )
        .unwrap();
        let f = vector(state.board(), Side::Black);
        // w3 at a8 has clear paths to a11 and, on the diagonal, to d11.
        assert_eq!(f[THREATS_THEM], 2);
        // b2 at k2: straight to k1 is clear; the diagonal to j1 holds w1.
        assert_eq!(f[THREATS_US], 1);
        assert_eq!(f[BLOCKERS_THEM], 1);
        // b1 at f6 has w2 on its east; the Whites would need to land on e6,
        // which none of their dice reaches. w2 has no black die to pin it
        // from h6, and no black die reaches h6.
        assert_eq!(f[AT_RISK_US], 0);
        assert_eq!(f[AT_RISK_THEM], 0);
        assert_eq!(f[TEMPO], 1);
        // A w2 at e4 reaches e6, and g6 holds w2: b1 is at risk.
        let mut board = *state.board();
        board.set(Cell::new(5, 4), Some(Die::new(Side::White, 2)));
        let f = vector(&board, Side::Black);
        assert_eq!(f[AT_RISK_US], 1);
        assert_eq!(f[AT_RISK_THEM], 0);
    }
}
