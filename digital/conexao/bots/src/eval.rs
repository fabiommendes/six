//! The heuristic the greedy bots share: how many dice each side still needs.

use conexao_engine::{pos, Color, Game, Goal, Outcome, CAPTURE_VALUE, CELLS, SIZE};

/// Score of a won game, far above any difference of distances; a sooner win
/// scores a little more.
pub(crate) const WIN: i32 = 1_000;

/// Dice `color` still has to place to reach its goal, by a shortest path:
/// an own die costs 0, an empty square 1, or 2 when a full neighbor would
/// need an increase first, and an opponent die blocks. `None` when no path
/// exists.
pub fn distance(game: &Game, color: Color) -> Option<u32> {
    path_distance(game, color, 2)
}

/// [`distance`] with the empty squares judged for a die of `value`: 2 for
/// the plain dice, or the highest die `color` can place, see [`best_value`].
pub fn path_distance(game: &Game, color: Color, value: u8) -> Option<u32> {
    let cost = |p: u8| -> Option<u32> {
        match game.at(p) {
            Some(d) if d.owner == color => Some(0),
            Some(_) => None,
            None => Some(if game.fits(p, value) { 1 } else { 2 }),
        }
    };
    let mut dist = [u32::MAX; CELLS];
    // Costs are 0, 1 or 2: a bucket queue per distance.
    let mut buckets: Vec<Vec<u8>> = vec![Vec::new(); 2 * CELLS + 3];
    let sources: Vec<u8> = match game.rules.goal {
        Goal::Line => (0..game.rules.size)
            .map(|c| pos(game.back_row(color), c))
            .collect(),
        Goal::Reach => game.dice(color).map(|(p, _)| p).collect(),
    };
    for p in sources {
        if let Some(c) = cost(p) {
            if c < dist[p as usize] {
                dist[p as usize] = c;
                buckets[c as usize].push(p);
            }
        }
    }
    for d in 0..buckets.len() {
        while let Some(p) = buckets[d].pop() {
            if dist[p as usize] != d as u32 {
                continue;
            }
            if p as usize / SIZE == game.goal_row(color) {
                return Some(d as u32);
            }
            for n in game.neighbors(p) {
                if let Some(c) = cost(n) {
                    let nd = d as u32 + c;
                    if nd < dist[n as usize] {
                        dist[n as usize] = nd;
                        buckets[nd as usize].push(n);
                    }
                }
            }
        }
    }
    None
}

/// The highest die `color` can place next: from the reserve, or once it is
/// empty, from the board.
pub fn best_value(game: &Game, color: Color) -> u8 {
    let reserve = &game.reserve[color.index()];
    match (1..=6u8).rev().find(|&v| reserve[v as usize] > 0) {
        Some(v) => v,
        None => game.dice(color).map(|(_, d)| d.value).max().unwrap_or(2),
    }
}

/// What the evaluation counts besides the distances.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Terms {
    /// The material captured and the dice exposed to a capture.
    pub captures: bool,
    /// Distances that count on the highest die each side can place, instead
    /// of a 2 on every square.
    pub values: bool,
}

impl Terms {
    pub const ALL: Terms = Terms {
        captures: true,
        values: true,
    };
}

/// The position from `color`'s side, with every term: see [`evaluate`].
pub fn score(game: &Game, color: Color) -> i32 {
    evaluate(game, color, Terms::ALL)
}

/// The position from `color`'s side: twice the opponent's distance minus its
/// own. With `terms.captures` and the capture rule on, each die captured is
/// worth two steps of distance, and a die that can be captured next turn is
/// a threat: a sure loss for the side not to move, a lesser one for the side
/// to move, which can still save it.
pub fn evaluate(game: &Game, color: Color, terms: Terms) -> i32 {
    match game.outcome {
        Some(Outcome::Win(c)) => {
            let value = WIN - game.turns as i32;
            return if c == color { value } else { -value };
        }
        Some(Outcome::Draw) => return 0,
        None => {}
    }
    // A side with no path is as far as the board is long.
    let far = |c| {
        let value = if terms.values { best_value(game, c) } else { 2 };
        path_distance(game, c, value).unwrap_or(2 * game.rules.size as u32) as i32
    };
    let mut value = 2 * (far(color.other()) - far(color));
    if terms.captures && game.rules.capture {
        let lost = |c: Color| game.captured[c.index()] as i32;
        value += 4 * (lost(color.other()) - lost(color));
        let threat = |c: Color| {
            let exposed = exposed(game, c).min(2);
            if game.turn == c {
                exposed
            } else {
                3 * exposed.min(1)
            }
        };
        value += threat(color.other()) - threat(color);
    }
    value
}

/// Dice of `color` the opponent may capture with one placement: a die of
/// [`CAPTURE_VALUE`] or more one neighbor short of full, or a full die that
/// the increase of the blocking action lifts to that value, next to an empty
/// square where an opponent die can land.
fn exposed(game: &Game, color: Color) -> i32 {
    let opponent = color.other();
    let rows = game.block_rows(opponent);
    game.dice(color)
        .filter(|&(p, d)| {
            let neighbors = game.neighbor_count(p);
            let short = d.value >= CAPTURE_VALUE && neighbors + 1 == d.value as usize;
            let full = d.value + 1 >= CAPTURE_VALUE && d.value < 6 && neighbors == d.value as usize;
            if !short && !full {
                return false;
            }
            game.neighbors(p)
                .filter(|&e| game.at(e).is_none())
                .any(|e| {
                    let blocks = game.rules.blocking
                        && rows.contains(&(e as usize / SIZE))
                        && game.neighbor_count(e) == 1;
                    blocks
                        || short
                            && game
                                .neighbors(e)
                                .any(|n| game.at(n).is_some_and(|x| x.owner == opponent))
                })
        })
        .count() as i32
}
