//! The evaluation of a position: a few features of each window, weighted
//! (`README.md#avaliador` lists what each one measures).
//!
//! The value of a player is the weighted sum of the features of their
//! window and hand. A bot compares its value with the best value among the
//! others, so the same weights serve 2 to 4 players.

use liu_engine::{GameState, Player, Pos, DICE_PER_PLAYER, RUNS, SIDE};
use serde_json::{Map, Value};

/// The features, in the order of [`Weights::values`].
pub const FEATURES: [&str; 13] = [
    "points",
    "dice",
    "line3",
    "line2",
    "dead",
    "run3",
    "run2",
    "code3",
    "hand",
    "fit_values",
    "seal_cells",
    "line3_late",
    "line2_late",
];

/// Number of features.
pub const COUNT: usize = FEATURES.len();

const DEFAULT_JSON: &str = include_str!("../weights/default.json");

/// One weight per feature, in points of the final score, and where they
/// came from.
#[derive(Clone, Debug, PartialEq)]
pub struct Weights {
    pub values: [f64; COUNT],
    pub meta: Value,
}

impl Default for Weights {
    /// The weights of the default bot (`weights/default.json`).
    fn default() -> Weights {
        Weights::from_json(DEFAULT_JSON).expect("weights/default.json is valid")
    }
}

impl Weights {
    /// Reads a weights object: every feature must be present.
    pub fn from_json(text: &str) -> Result<Weights, String> {
        let root: Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
        let object = root
            .as_object()
            .ok_or("the weights must be a JSON object")?;
        let mut weights = Weights {
            values: [0.0; COUNT],
            meta: object.get("meta").cloned().unwrap_or(Value::Null),
        };
        weights.update(object)?;
        for name in FEATURES {
            if !object.contains_key(name) {
                return Err(format!("missing weight {name:?}"));
            }
        }
        Ok(weights)
    }

    /// Replaces the weights the object has; the others stay.
    pub fn update(&mut self, object: &Map<String, Value>) -> Result<(), String> {
        for (key, value) in object {
            if key == "meta" {
                continue;
            }
            let index = FEATURES
                .iter()
                .position(|name| name == key)
                .ok_or(format!("unknown weight {key:?}"))?;
            self.values[index] = value
                .as_f64()
                .ok_or(format!("weight {key:?} is not a number"))?;
        }
        Ok(())
    }

    /// The weights as a JSON object, one key per feature.
    pub fn to_json(&self) -> String {
        let mut object = Map::new();
        for (name, value) in FEATURES.iter().zip(self.values) {
            object.insert(name.to_string(), value.into());
        }
        object.insert("meta".into(), self.meta.clone());
        serde_json::to_string_pretty(&Value::Object(object)).expect("weights serialize")
    }

    /// The weighted sum of the features of `player`, with `late` the share
    /// of the bag already drawn.
    pub fn value(&self, player: &Player, late: f64) -> f64 {
        features(player, late)
            .iter()
            .zip(self.values)
            .map(|(f, w)| f * w)
            .sum()
    }
}

/// Offset of the seal in [`Grid`]: positions go from -3 to 3.
const OFFSET: i8 = SIDE - 1;
const CELLS: usize = 2 * OFFSET as usize + 1;

/// A window as a 7 by 7 grid of values, 0 for an empty cell.
type Grid = [[u8; CELLS]; CELLS];

fn cell(at: Pos) -> (usize, usize) {
    ((at.row + OFFSET) as usize, (at.col + OFFSET) as usize)
}

/// Bit `v` set for each value `v` in `values`.
fn mask(values: impl IntoIterator<Item = u8>) -> u8 {
    values.into_iter().fold(0, |m, v| m | 1 << v)
}

/// The values 1 to 6 as bits 1 to 6.
const ALL: u8 = 0b111_1110;

/// The run masks.
fn run_masks() -> [u8; 3] {
    RUNS.map(mask)
}

/// The features of a player, in the order of [`FEATURES`]:
///
/// - `points`: what the window scores now, with its best code;
/// - `dice`: dice in the window;
/// - `line3`, `line2`: rows and columns with 3 or 2 dice that can still be
///   completed (every cell they need takes some number);
/// - `dead`: rows and columns with dice that can no longer be completed;
/// - `run3`, `run2`: of those, the ones that can still become a run;
/// - `code3`: lines of 3 dice one number away from the set of the best
///   code of the complete lines;
/// - `hand`: a die in the hand that fits the window;
/// - `fit_values`: how many numbers fit somewhere in the window now;
/// - `seal_cells`: empty cells of the region that still take the seal
///   number, the number the seal bonus gives;
/// - `line3_late`, `line2_late`: `line3` and `line2` times `late`, the
///   share of the bag already drawn, so a line far from complete can be
///   worth less near the end.
pub fn features(player: &Player, late: f64) -> [f64; COUNT] {
    let window = &player.window;
    let mut grid: Grid = [[0; CELLS]; CELLS];
    for die in window.dice() {
        let (r, c) = cell(die.at);
        grid[r][c] = die.value;
    }
    let bounds = window.bounds();
    let (top, left) = cell(Pos::new(bounds.top, bounds.left));
    let (bottom, right) = cell(Pos::new(bounds.bottom, bounds.right));
    let rows_fixed = bottom - top + 1 == SIDE as usize;
    let cols_fixed = right - left + 1 == SIDE as usize;
    let row_mask: Vec<u8> = (0..CELLS).map(|r| mask(grid[r].iter().copied())).collect();
    let col_mask: Vec<u8> = (0..CELLS)
        .map(|c| mask(grid.iter().map(|row| row[c])))
        .collect();
    // The numbers each empty cell of the region still takes.
    let mut allowed = [[0u8; CELLS]; CELLS];
    for r in top..=bottom {
        for c in left..=right {
            if grid[r][c] == 0 {
                allowed[r][c] = ALL & !(row_mask[r] | col_mask[c]);
            }
        }
    }
    let score = liu_engine::score(window);
    let code = score.code.map(mask);
    let runs = run_masks();
    let mut f = [0.0; COUNT];
    f[0] = f64::from(score.points);
    f[1] = window.len() as f64;
    // Rows, then columns: the cells of each line inside the region.
    let mut line = |cells: &mut dyn Iterator<Item = (usize, usize)>, fixed: bool| {
        let mut dice = 0;
        let mut values = 0u8;
        let (mut empty, mut live) = (0, 0);
        let mut completing = 0u8;
        for (r, c) in cells {
            match grid[r][c] {
                0 => {
                    empty += 1;
                    if allowed[r][c] != 0 {
                        live += 1;
                        completing |= allowed[r][c];
                    }
                }
                v => {
                    dice += 1;
                    values |= 1 << v;
                }
            }
        }
        if dice == 0 || dice == SIDE as usize {
            return;
        }
        let need = SIDE as usize - dice;
        let completable = if fixed { live == empty } else { live >= need };
        if !completable {
            f[4] += 1.0;
            return;
        }
        let could_run = runs.iter().any(|&run| values & !run == 0);
        match dice {
            3 => {
                f[2] += 1.0;
                let reaches = |target: u8| {
                    let missing = target & !values;
                    values & !target == 0 && missing & completing != 0
                };
                if runs.iter().any(|&run| reaches(run)) {
                    f[5] += 1.0;
                }
                if code.is_some_and(reaches) {
                    f[7] += 1.0;
                }
            }
            2 => {
                f[3] += 1.0;
                if could_run {
                    f[6] += 1.0;
                }
            }
            _ => {}
        }
    };
    for r in top..=bottom {
        line(&mut (left..=right).map(|c| (r, c)), cols_fixed);
    }
    for c in left..=right {
        line(&mut (top..=bottom).map(|r| (r, c)), rows_fixed);
    }
    // Cells that touch a die: where a number may go now.
    let mut fit = 0u8;
    let mut seal_cells = 0;
    let seal = 1u8 << window.seal();
    for r in top..=bottom {
        for c in left..=right {
            if grid[r][c] != 0 {
                continue;
            }
            if allowed[r][c] & seal != 0 {
                seal_cells += 1;
            }
            let touches = (r > 0 && grid[r - 1][c] != 0)
                || (r + 1 < CELLS && grid[r + 1][c] != 0)
                || (c > 0 && grid[r][c - 1] != 0)
                || (c + 1 < CELLS && grid[r][c + 1] != 0);
            if touches {
                fit |= allowed[r][c];
            }
        }
    }
    if let Some(held) = player.hand {
        if fit & 1 << held != 0 {
            f[8] = 1.0;
        }
    }
    f[9] = f64::from(fit.count_ones());
    f[10] = f64::from(seal_cells);
    f[11] = f[2] * late;
    f[12] = f[3] * late;
    f
}

/// The share of the bag of `state` already drawn: 0 at the start, 1 when
/// it is empty.
pub fn late(state: &GameState) -> f64 {
    let start = ((DICE_PER_PLAYER - 1) * state.players().len()) as f64;
    1.0 - f64::from(state.bag()) / start
}

/// What a position is worth to `seat`: its value minus the best value
/// among the others. A finished game is worth [`WIN`] per share of the win
/// (`-WIN` for a loss) plus the difference of points.
pub fn relative(weights: &Weights, state: &GameState, seat: usize) -> f64 {
    let players = state.players();
    if let Some(winners) = state.winners() {
        let scores = state.scores();
        let mine = f64::from(scores[seat].points);
        let best_other = (0..players.len())
            .filter(|&i| i != seat)
            .map(|i| f64::from(scores[i].points))
            .fold(f64::NEG_INFINITY, f64::max);
        let outcome = if winners.contains(&seat) {
            WIN / winners.len() as f64
        } else {
            -WIN
        };
        return outcome + mine - best_other;
    }
    let late = late(state);
    let values: Vec<f64> = players.iter().map(|p| weights.value(p, late)).collect();
    let best_other = (0..values.len())
        .filter(|&i| i != seat)
        .map(|i| values[i])
        .fold(f64::NEG_INFINITY, f64::max);
    values[seat] - best_other
}

/// The value of a won game, in points: above any difference of points.
pub const WIN: f64 = 100.0;

#[cfg(test)]
mod tests {
    use super::*;
    use liu_engine::{Placed, Window};

    fn player(rows: &[&[u8]], hand: Option<u8>) -> Player {
        let mut dice = Vec::new();
        for (r, row) in rows.iter().enumerate() {
            for (c, &value) in row.iter().enumerate() {
                if value != 0 {
                    dice.push(Placed {
                        at: Pos::new(r as i8, c as i8),
                        value,
                    });
                }
            }
        }
        Player {
            window: Window::from_dice(&dice).unwrap(),
            hand,
        }
    }

    /// The features with the bag full.
    fn at_start(player: &Player) -> [f64; COUNT] {
        features(player, 0.0)
    }

    fn named(f: &[f64; COUNT], name: &str) -> f64 {
        f[FEATURES.iter().position(|n| *n == name).unwrap()]
    }

    #[test]
    fn the_default_weights_read_back() {
        let weights = Weights::default();
        let again = Weights::from_json(&weights.to_json()).unwrap();
        assert_eq!(weights, again);
        assert!(Weights::from_json(r#"{"points": 1}"#).is_err());
    }

    #[test]
    fn a_seal_alone_has_no_lines() {
        let f = at_start(&player(&[&[3]], Some(3)));
        assert_eq!(named(&f, "dice"), 1.0);
        assert_eq!(
            named(&f, "line3") + named(&f, "line2") + named(&f, "dead"),
            0.0
        );
        // Every number but the seal's touches the seal.
        assert_eq!(named(&f, "fit_values"), 5.0);
        assert_eq!(named(&f, "hand"), 0.0);
    }

    #[test]
    fn three_in_a_row_one_number_from_a_run() {
        let f = at_start(&player(&[&[2, 3, 4]], Some(5)));
        assert_eq!(named(&f, "line3"), 1.0);
        assert_eq!(named(&f, "run3"), 1.0);
        assert_eq!(named(&f, "hand"), 1.0);
    }

    #[test]
    fn a_line_that_cannot_finish_is_dead() {
        // Row 0 is 1 2 3 _ with the region fixed to columns 0 to 3. The
        // last cell sees 4, 5 and 6 in its column, so it takes nothing.
        let f = at_start(&player(
            &[&[1, 2, 3, 0], &[2, 3, 1, 4], &[3, 1, 2, 5], &[0, 0, 0, 6]],
            None,
        ));
        assert!(named(&f, "dead") >= 1.0, "{f:?}");
    }
}
