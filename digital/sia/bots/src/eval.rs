//! The evaluation of a position: a few features, weighted
//! (`README.md#avaliador` lists what each one measures).
//!
//! The base is the chance that a side beats the other on a stone. A side
//! with fewer than 3 dice becomes a random formation: the missing dice take
//! any number, and a suit of the 4, uniformly. [`dist_of`] gives the
//! distribution of the final formation of a side (precomputed for every
//! stone number and every side), and [`beat_chance`] compares two of them.
//! The features are sums of those chances over the stones, seen from one
//! seat; the weights are in points of a stone.

use std::sync::OnceLock;

use serde_json::{Map, Value};
use sia_engine::{formation, Die, Formation, GameState, Side, NEIGHBORS_TO_WIN, STONES};

/// Sums of 4 numbers go from 4 to 24.
const SUMS: usize = 21;
/// Formation kinds times sums: the index of a formation in a [`Dist`].
const RANKS: usize = 8 * SUMS;

fn rank(f: Formation) -> usize {
    f.kind.strength() * SUMS + (f.sum as usize - 4)
}

/// The distribution of the final formation of a side.
#[derive(Clone, Debug)]
pub struct Dist {
    /// Chance of each formation, in order of strength.
    pmf: [f32; RANKS],
    /// Chance of a weaker formation plus half the chance of this one.
    mid: [f32; RANKS],
    /// The range of formations with a chance above 0.
    lo: usize,
    hi: usize,
}

impl Dist {
    fn from_pmf(pmf: [f32; RANKS]) -> Dist {
        let lo = pmf.iter().position(|&p| p > 0.0).unwrap_or(0);
        let hi = pmf.iter().rposition(|&p| p > 0.0).unwrap_or(0);
        let mut mid = [0.0; RANKS];
        let mut below = 0.0;
        for x in 0..RANKS {
            mid[x] = below + pmf[x] / 2.0;
            below += pmf[x];
        }
        Dist { pmf, mid, lo, hi }
    }
}

/// The chance that a side with the distribution `mine` beats one with
/// `theirs`, a tie counting half.
pub fn beat_chance(mine: &Dist, theirs: &Dist) -> f64 {
    let mut total = 0.0f32;
    for x in mine.lo..=mine.hi {
        total += mine.pmf[x] * theirs.mid[x];
    }
    f64::from(total)
}

/// Position in the table of the stone number and the numbers of a side.
fn key(stone: u8, numbers: &[u8], mono: bool) -> usize {
    let mut sorted = [0u8; 3];
    sorted[..numbers.len()].copy_from_slice(numbers);
    sorted[..numbers.len()].sort_unstable();
    let code = sorted.iter().fold(0usize, |c, &n| c * 7 + n as usize);
    ((stone as usize - 1) * 343 + code) * 2 + usize::from(mono)
}

fn build(stone: u8, numbers: &[u8], mono: bool) -> Dist {
    let missing = 3 - numbers.len();
    let mut pmf = [0.0f32; RANKS];
    let existing = |flush_suit: u8| -> Vec<Die> {
        numbers
            .iter()
            .enumerate()
            .map(|(i, &n)| Die::new(n, if mono { flush_suit } else { (i % 2) as u8 }))
            .collect()
    };
    if missing == 0 {
        pmf[rank(formation(stone, &existing(0)))] = 1.0;
        return Dist::from_pmf(pmf);
    }
    let p_flush = if !mono {
        0.0
    } else if numbers.is_empty() {
        1.0 / 16.0
    } else {
        0.25f64.powi(missing as i32)
    };
    let combos = 6usize.pow(missing as u32);
    for code in 0..combos {
        let mut rest = code;
        let tuple: Vec<u8> = (0..missing)
            .map(|_| {
                let n = (rest % 6) as u8 + 1;
                rest /= 6;
                n
            })
            .collect();
        let weight = 1.0 / combos as f64;
        if p_flush > 0.0 {
            let mut dice = existing(0);
            dice.extend(tuple.iter().map(|&n| Die::new(n, 0)));
            pmf[rank(formation(stone, &dice))] += (weight * p_flush) as f32;
        }
        let mut dice = existing(0);
        dice.extend(tuple.iter().enumerate().map(|(i, &n)| {
            // Not all one suit: the first die missing takes another suit
            // than the dice before it.
            Die::new(n, u8::from(mono && i == 0))
        }));
        pmf[rank(formation(stone, &dice))] += (weight * (1.0 - p_flush)) as f32;
    }
    Dist::from_pmf(pmf)
}

fn table() -> &'static Vec<Option<Box<Dist>>> {
    static TABLE: OnceLock<Vec<Option<Box<Dist>>>> = OnceLock::new();
    TABLE.get_or_init(|| {
        let mut table: Vec<Option<Box<Dist>>> = vec![None; 7 * 343 * 2];
        for stone in 1..=6u8 {
            for a in 0..=6u8 {
                for b in a..=6u8 {
                    for c in b..=6u8 {
                        // Numbers in order, with 0 for no die: only the
                        // prefix of nonzero ones is a side.
                        let numbers: Vec<u8> = [a, b, c].into_iter().filter(|&n| n > 0).collect();
                        for mono in [true, false] {
                            if numbers.len() <= 1 && !mono {
                                continue;
                            }
                            let slot = key(stone, &numbers, mono);
                            if table[slot].is_none() {
                                table[slot] = Some(Box::new(build(stone, &numbers, mono)));
                            }
                        }
                    }
                }
            }
        }
        table
    })
}

/// The distribution of the formation a side will end with, for the stone
/// number and the dice on it.
pub fn dist_of(stone: u8, side: &Side) -> &'static Dist {
    dist_for(stone, &side.dice)
}

fn dist_for(stone: u8, dice: &[Die]) -> &'static Dist {
    let mut numbers = [0u8; 3];
    for (slot, die) in numbers.iter_mut().zip(dice) {
        *slot = die.value;
    }
    let mono = dice.iter().all(|d| d.suit == dice[0].suit);
    table()[key(stone, &numbers[..dice.len()], mono)]
        .as_deref()
        .expect("every side has a distribution")
}

/// The features, in the order of [`Weights::values`].
pub const FEATURES: [&str; 9] = [
    "owned",
    "adjacent",
    "prob",
    "sure",
    "neighbors",
    "placed",
    "lost",
    "hand",
    "opp_hand",
];

/// Number of features.
pub const COUNT: usize = FEATURES.len();

const DEFAULT_JSON: &str = include_str!("../weights/default.json");

/// One weight per feature, in stones, and where they came from.
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
}

/// The chance that `seat` takes each stone not yet taken, 0 for the taken
/// ones: two complete sides are decided, the others compare their
/// distributions.
fn chances(state: &GameState, seat: usize) -> [f64; STONES] {
    let mut p = [0.0; STONES];
    for (s, slot) in p.iter_mut().enumerate() {
        if state.owners()[s].is_some() {
            continue;
        }
        *slot = match state.beats(seat, s) {
            Some(wins) => f64::from(u8::from(wins)),
            None => {
                let stone = state.stones()[s];
                beat_chance(
                    dist_of(stone, state.side(seat, s)),
                    dist_of(stone, state.side(1 - seat, s)),
                )
            }
        };
    }
    p
}

/// How much the best placement of each distinct die of `player`'s hand
/// raises the chance on a stone, summed (placements that lower it count as
/// 0). `base` holds the chances of `player` for each stone not yet taken.
fn hand_quality(state: &GameState, player: usize, base: &[f64; STONES]) -> f64 {
    let mut gains: Vec<(Die, f64)> = Vec::with_capacity(state.hand(player).len());
    let mut total = 0.0;
    for &die in state.hand(player) {
        let gain = match gains.iter().find(|(d, _)| *d == die) {
            Some(&(_, gain)) => gain,
            None => {
                let gain = die_gain(state, player, die, base);
                gains.push((die, gain));
                gain
            }
        };
        total += gain;
    }
    total
}

/// The chance of `player` on `stone` if `die` goes on the side of
/// `player`.
pub fn chance_with(state: &GameState, player: usize, stone: usize, die: Die) -> f64 {
    let number = state.stones()[stone];
    let side = state.side(player, stone);
    let mut dice = [die; 3];
    dice[..side.dice.len()].copy_from_slice(&side.dice);
    let dice = &dice[..side.dice.len() + 1];
    match state.formation_of(1 - player, stone) {
        // Against a complete side the one that completed first wins a tie,
        // and the die just put is the last.
        Some(theirs) if dice.len() == 3 => f64::from(u8::from(formation(number, dice) > theirs)),
        _ => beat_chance(
            dist_for(number, dice),
            dist_of(number, state.side(1 - player, stone)),
        ),
    }
}

/// The best rise in the chance of `player` on a stone from putting `die`
/// there, at least 0; 0 with no room.
pub fn die_gain(state: &GameState, player: usize, die: Die, base: &[f64; STONES]) -> f64 {
    let mut best: f64 = 0.0;
    for (s, &before) in base.iter().enumerate() {
        if state.owners()[s].is_none() && !state.side(player, s).is_complete() {
            best = best.max(chance_with(state, player, s, die) - before);
        }
    }
    best
}

/// The chances of `seat` on every stone not yet taken, for a bot that
/// ranks the dice of a hand.
pub fn stone_chances(state: &GameState, seat: usize) -> [f64; STONES] {
    chances(state, seat)
}

/// The features of `seat`, in the order of [`FEATURES`].
pub fn features(state: &GameState, seat: usize) -> [f64; COUNT] {
    let other = 1 - seat;
    let owners = state.owners();
    let p = chances(state, seat);
    let mut f = [0.0; COUNT];
    f[0] = state.stones_of(seat) as f64 - state.stones_of(other) as f64;
    let adjacent = |who: usize| {
        (0..STONES - 1)
            .filter(|&s| owners[s] == Some(who) && owners[s + 1] == Some(who))
            .count() as f64
    };
    f[1] = adjacent(seat) - adjacent(other);
    // q: the chance of seat for each stone, 1 if taken by seat, 0 by other.
    let mut q = [0.0; STONES];
    for s in 0..STONES {
        q[s] = match owners[s] {
            Some(who) => f64::from(u8::from(who == seat)),
            None => {
                f[2] += p[s] - 0.5;
                if p[s] >= 0.95 {
                    f[3] += 1.0;
                } else if p[s] <= 0.05 {
                    f[3] -= 1.0;
                }
                f[5] += (state.side(seat, s).dice.len() as f64)
                    - (state.side(other, s).dice.len() as f64);
                p[s]
            }
        };
    }
    for start in 0..=STONES - NEIGHBORS_TO_WIN {
        let window = &q[start..start + NEIGHBORS_TO_WIN];
        f[4] += window.iter().product::<f64>() - window.iter().map(|x| 1.0 - x).product::<f64>();
    }
    f[6] = f64::from(state.player(seat).lost) - f64::from(state.player(other).lost);
    f[7] = hand_quality(state, seat, &p);
    let mut theirs = [0.0; STONES];
    for s in 0..STONES {
        theirs[s] = if owners[s].is_some() { 0.0 } else { 1.0 - p[s] };
    }
    f[8] = hand_quality(state, other, &theirs);
    f
}

/// Points of a finished game, apart from the stones.
const WIN: f64 = 100.0;

/// The value of the position for `seat`: the weighted features, or at the
/// end of the game 100 per share of the win (-100 for a loss) plus the
/// difference in stones.
pub fn relative(weights: &Weights, state: &GameState, seat: usize) -> f64 {
    if let Some(winners) = state.winners() {
        let share = if winners.contains(&seat) {
            1.0 / winners.len() as f64
        } else {
            0.0
        };
        let stones = state.stones_of(seat) as f64 - state.stones_of(1 - seat) as f64;
        return WIN * (2.0 * share - 1.0) + stones;
    }
    features(state, seat)
        .iter()
        .zip(weights.values)
        .map(|(f, w)| f * w)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;
    use sia_engine::{Command, FormationKind};

    #[test]
    fn every_distribution_sums_to_one() {
        for dist in table().iter().flatten() {
            let total: f32 = dist.pmf.iter().sum();
            assert!((total - 1.0).abs() < 1e-4, "{total}");
        }
    }

    #[test]
    fn an_empty_side_matches_chance_of_the_formations() {
        // The RFC table, for a random stone: a straight flush is rarer than
        // 1% and a pair is the most common formation.
        let (state, _) = GameState::new(1);
        let dist = dist_of(state.stones()[0], state.side(0, 0));
        let at = |kind: FormationKind| -> f32 {
            let k = kind.index() * SUMS;
            dist.pmf[k..k + SUMS].iter().sum()
        };
        assert!(at(FormationKind::StraightFlush) < 0.01);
        assert!(at(FormationKind::Pair) > at(FormationKind::Sum));
        assert!(at(FormationKind::Pair) > 0.4);
    }

    #[test]
    fn identical_sides_have_even_chances_and_a_stronger_one_wins_more() {
        let (state, _) = GameState::new(2);
        let d = dist_of(3, state.side(0, 0));
        assert!((beat_chance(d, d) - 0.5).abs() < 1e-4);
        let strong = dist_for(3, &[Die::new(3, 0), Die::new(3, 1), Die::new(3, 2)]);
        let weak = dist_for(3, &[Die::new(1, 0), Die::new(2, 1), Die::new(6, 2)]);
        assert!(beat_chance(strong, weak) > 0.95);
        assert!(beat_chance(weak, strong) < 0.05);
    }

    #[test]
    fn the_distribution_matches_a_brute_force_over_suits_and_numbers() {
        // One die missing: 24 completions, checked against the formation.
        let dice = [Die::new(2, 1), Die::new(5, 1)];
        let dist = dist_for(4, &dice);
        let mut expected = [0.0f32; RANKS];
        for n in 1..=6 {
            for suit in 0..4 {
                let f = formation(4, &[dice[0], dice[1], Die::new(n, suit)]);
                expected[rank(f)] += 1.0 / 24.0;
            }
        }
        for (x, (got, want)) in dist.pmf.iter().zip(expected).enumerate() {
            assert!((got - want).abs() < 1e-5, "rank {x}");
        }
    }

    #[test]
    fn a_finished_game_is_worth_more_than_any_position() {
        let weights = Weights::default();
        let (mut state, _) = GameState::new(4);
        assert!(relative(&weights, &state, 0).abs() < 5.0);
        while !state.is_over() {
            let actions = state.legal_actions();
            // Claim whenever possible, otherwise place the first die.
            let command = actions
                .iter()
                .find(|c| matches!(c, Command::Claim { .. }))
                .or(actions.first())
                .copied()
                .unwrap();
            state = state.apply(command).unwrap().0;
        }
        let winner = state.winners().unwrap()[0];
        assert!(relative(&weights, &state, winner) > 90.0);
        assert!(relative(&weights, &state, 1 - winner) < -90.0);
    }

    #[test]
    fn the_default_weights_read_and_write_back() {
        let weights = Weights::default();
        let again = Weights::from_json(&weights.to_json()).unwrap();
        assert_eq!(weights.values, again.values);
        assert!(Weights::from_json("{}").is_err());
    }
}
