//! The alpha-beta search: negamax with principal variation search,
//! iterative deepening, a transposition table, quiescence, an extension when
//! the opponent threatens to win, and late move reductions.
//!
//! The core reads no clock and starts no thread, so it runs on
//! `wasm32-unknown-unknown`: it stops at a depth, at a number of nodes, or
//! when the caller's `stop` callback says so.
//!
//! Scores are from the side to move, in the units of the evaluation
//! (`crate::eval`). A win is `WIN - ply`, where `ply` counts from the root
//! to the move that wins, so shorter wins score higher. A draw is 0, and so
//! is a position that already occurred since the last capture (in the game
//! or in the search path): the side to move can repeat it. With a
//! [`Searcher::contempt`] of `C`, a draw is `-C` for the side to move at the
//! root and `+C` for its opponent, so the root side plays for a win.

mod table;

use seks_engine::{
    captures, legal_commands, legal_commands_into, Command, Engine, GameState, Outcome,
};

use crate::eval::Evaluator;
use crate::rng::Rng;
use crate::tactics::{can_win_now, creates_threat, threat_paths, winning_move};
use table::{code, Bound, Table, CODES, NO_CODE};

/// The score of a win on the next move; a win `n` plies later is `WIN - n`.
pub const WIN: i32 = 30_000;
/// The deepest the search goes from the root, extensions and quiescence
/// included.
pub const MAX_PLY: usize = 96;
const INFINITY: i32 = 32_000;
/// Quiescence plies that answer a threat of the opponent with every move.
const QUIESCENCE_EVASIONS: u32 = 4;
/// Quiet moves searched at depth 1, 2 and 3 before the rest are pruned.
const LATE_MOVES: [usize; 4] = [0, 10, 20, 36];
/// How much a quiet move may gain per ply of depth left, for futility.
const FUTILITY_MARGIN: i32 = 120;
/// Nodes between calls to the stop callback.
const STOP_INTERVAL: u64 = 1024;

/// Whether `score` is a win or a loss found by the search.
pub fn is_decisive(score: i32) -> bool {
    score.abs() >= WIN - MAX_PLY as i32
}

/// When the search stops.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Limits {
    /// The deepest iteration.
    pub depth: u32,
    /// Nodes after which the search stops. The first iteration always
    /// finishes.
    pub nodes: u64,
}

impl Default for Limits {
    fn default() -> Limits {
        Limits {
            depth: MAX_PLY as u32 / 2,
            nodes: u64::MAX,
        }
    }
}

/// The result of a search.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SearchResult {
    pub command: Command,
    /// The score of the last finished iteration.
    pub score: i32,
    /// The depth of the last finished iteration.
    pub depth: u32,
    pub nodes: u64,
}

/// A searcher: the evaluation and the tables it keeps between searches.
pub struct Searcher {
    evaluator: Evaluator,
    table: Table,
    killers: [[u16; 2]; MAX_PLY + 1],
    history: Vec<i32>,
    buffers: Vec<Vec<Command>>,
    order: Vec<Vec<(i32, u8)>>,
    reductions: Box<[[u8; 64]; 32]>,
    nodes: u64,
    node_limit: u64,
    can_abort: bool,
    aborted: bool,
    pub options: Options,
    /// What a draw costs the side to move at the root, in evaluation
    /// units; 0 scores draws as 0 for both sides.
    pub contempt: i32,
}

/// The parts of the search that may change its result. All on by default;
/// the test that compares the search with a plain minimax turns them off.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Options {
    /// One more ply when the opponent threatens to win.
    pub extension: bool,
    /// Late move reductions.
    pub late_reductions: bool,
    /// Null-move pruning.
    pub null_move: bool,
    /// Futility and late move pruning of quiet moves near the leaves.
    pub pruning: bool,
}

impl Default for Options {
    fn default() -> Options {
        Options {
            extension: true,
            late_reductions: true,
            null_move: true,
            pruning: true,
        }
    }
}

impl Searcher {
    /// A searcher with `evaluator` and a table of at most `table_mib` MiB.
    pub fn new(evaluator: Evaluator, table_mib: usize) -> Searcher {
        let mut reductions = Box::new([[0u8; 64]; 32]);
        for (depth, row) in reductions.iter_mut().enumerate().skip(1) {
            for (index, r) in row.iter_mut().enumerate().skip(1) {
                let value = 0.5 + (depth as f64).ln() * (index as f64).ln() / 2.0;
                *r = value.max(0.0) as u8;
            }
        }
        Searcher {
            evaluator,
            table: Table::new(table_mib),
            killers: [[NO_CODE; 2]; MAX_PLY + 1],
            history: vec![0; CODES],
            buffers: (0..=MAX_PLY).map(|_| Vec::with_capacity(256)).collect(),
            order: (0..=MAX_PLY).map(|_| Vec::with_capacity(256)).collect(),
            reductions,
            nodes: 0,
            node_limit: u64::MAX,
            can_abort: false,
            aborted: false,
            options: Options::default(),
            contempt: 0,
        }
    }

    /// Forgets the table and the move-ordering statistics.
    pub fn clear(&mut self) {
        self.table.clear();
        self.history.fill(0);
        self.killers = [[NO_CODE; 2]; MAX_PLY + 1];
    }

    /// The evaluation this searcher uses.
    pub fn evaluator(&self) -> &Evaluator {
        &self.evaluator
    }

    /// Searches `state`, which is not over, until `limits` or `stop`.
    ///
    /// With `noise > 0`, the choice is uniform, by `seed`, among the root
    /// moves that score at most `noise` below the best one; with 0 it is the
    /// best move.
    pub fn search(
        &mut self,
        state: &GameState,
        limits: Limits,
        noise: i32,
        seed: u64,
        stop: &mut dyn FnMut() -> bool,
    ) -> SearchResult {
        self.search_root(
            state,
            legal_commands(state),
            false,
            limits,
            noise,
            seed,
            stop,
        )
    }

    /// [`Searcher::search`] with the root restricted to `root`, a non-empty
    /// subset of the legal commands of `state`. The replies below the root
    /// are not restricted. The result is not stored in the table: it is not
    /// the score of the position.
    pub fn search_among(
        &mut self,
        state: &GameState,
        root: Vec<Command>,
        limits: Limits,
        noise: i32,
        seed: u64,
        stop: &mut dyn FnMut() -> bool,
    ) -> SearchResult {
        self.search_root(state, root, true, limits, noise, seed, stop)
    }

    #[allow(clippy::too_many_arguments)]
    fn search_root(
        &mut self,
        state: &GameState,
        mut root: Vec<Command>,
        restricted: bool,
        limits: Limits,
        noise: i32,
        seed: u64,
        stop: &mut dyn FnMut() -> bool,
    ) -> SearchResult {
        assert!(!root.is_empty(), "the game is over or the root is empty");
        self.nodes = 1;
        if let Some(win) = winning_move(state.board(), state.to_move())
            .filter(|win| !restricted || root.contains(win))
        {
            return SearchResult {
                command: win,
                score: WIN - 1,
                depth: 1,
                nodes: 1,
            };
        }
        if root.len() == 1 {
            return SearchResult {
                command: root[0],
                score: 0,
                depth: 0,
                nodes: 1,
            };
        }
        self.node_limit = limits.nodes;
        self.aborted = false;
        self.killers = [[NO_CODE; 2]; MAX_PLY + 1];
        for h in &mut self.history {
            *h /= 8;
        }
        // The previous best move first, then captures.
        let tt_move = self
            .table
            .probe(state.position_hash())
            .map_or(NO_CODE, |e| e.command);
        let mut keyed: Vec<(i32, Command)> = root
            .iter()
            .map(|&c| {
                let key = if code(c) == tt_move {
                    i32::MAX
                } else {
                    captures(state, c) as i32
                };
                (key, c)
            })
            .collect();
        keyed.sort_by_key(|&(key, _)| std::cmp::Reverse(key));
        root = keyed.into_iter().map(|(_, c)| c).collect();

        let mut scores = vec![-INFINITY; root.len()];
        let mut done_depth = 0;
        let mut done_scores = scores.clone();
        let mut done_root = root.clone();
        for depth in 1..=limits.depth.max(1) {
            self.can_abort = depth > 1;
            let mut best = -INFINITY;
            for (i, &command) in root.iter().enumerate() {
                let child = Engine::step(state, command).expect("a legal command");
                let floor = if best == -INFINITY {
                    -INFINITY
                } else {
                    best - noise.max(0)
                };
                let d = depth as i32 - 1;
                let mut score;
                if i == 0 {
                    score = -self.node(&child, d, -INFINITY, -floor, 1, stop);
                } else {
                    score = -self.node(&child, d, -floor - 1, -floor, 1, stop);
                    if score > floor && !self.aborted {
                        score = -self.node(&child, d, -INFINITY, -floor, 1, stop);
                    }
                }
                if self.aborted {
                    break;
                }
                scores[i] = score;
                best = best.max(score);
            }
            if self.aborted {
                break;
            }
            // Stable sort: among equal scores the earlier move stays first.
            let mut pairs: Vec<(i32, Command)> =
                scores.iter().copied().zip(root.iter().copied()).collect();
            pairs.sort_by_key(|&(score, _)| std::cmp::Reverse(score));
            root = pairs.iter().map(|&(_, c)| c).collect();
            scores = pairs.iter().map(|&(s, _)| s).collect();
            done_depth = depth;
            done_scores = scores.clone();
            done_root = root.clone();
            if !restricted {
                self.table.store(
                    state.position_hash(),
                    code(root[0]),
                    scores[0],
                    depth as i32,
                    Bound::Exact,
                );
            }
            if is_decisive(scores[0]) && (WIN - scores[0].abs()) < depth as i32 {
                break;
            }
            if self.nodes >= self.node_limit || stop() {
                break;
            }
        }
        let best = done_scores[0];
        let pick = if noise > 0 && !is_decisive(best) {
            let candidates = done_scores.iter().filter(|&&s| s >= best - noise).count();
            Rng::new(seed).below(candidates)
        } else {
            0
        };
        SearchResult {
            command: done_root[pick],
            score: done_scores[pick],
            depth: done_depth,
            nodes: self.nodes,
        }
    }

    /// Counts a node; true when the search must stop.
    fn tick(&mut self, stop: &mut dyn FnMut() -> bool) -> bool {
        self.nodes += 1;
        if self.can_abort
            && (self.nodes >= self.node_limit
                || (self.nodes.is_multiple_of(STOP_INTERVAL) && stop()))
        {
            self.aborted = true;
        }
        self.aborted
    }

    /// The score of a finished game or a repeated position, if `state` is
    /// one, with draws as 0.
    fn terminal(state: &GameState, ply: usize) -> Option<i32> {
        match state.outcome() {
            // The side that just moved won.
            Some(Outcome::Win { .. }) => Some(-(WIN - ply as i32)),
            Some(Outcome::Draw(_)) => Some(0),
            None if state.repetitions() >= 2 => Some(0),
            None => None,
        }
    }

    /// [`Searcher::terminal`] with draws scored by the contempt.
    fn terminal_with_contempt(&self, state: &GameState, ply: usize) -> Option<i32> {
        // A win is never 0, so 0 is a draw.
        Self::terminal(state, ply).map(|score| if score == 0 { self.draw(ply) } else { score })
    }

    /// The score of a draw for the side to move `ply` plies below the root:
    /// the root side at even plies.
    fn draw(&self, ply: usize) -> i32 {
        if ply.is_multiple_of(2) {
            -self.contempt
        } else {
            self.contempt
        }
    }

    /// The legal moves of `state`; when the opponent threatens to win, only
    /// those that may stop it (see [`threat_paths`]): the others lose on the
    /// next move. (A move that leaves the opponent with no play would win
    /// instead; the search ignores that case.)
    fn generate(&self, state: &GameState, threatened: bool, moves: &mut Vec<Command>) {
        legal_commands_into(state, moves);
        if threatened {
            let paths = threat_paths(state.board(), state.to_move().opponent());
            moves.retain(|&command| match command {
                Command::Move { to, .. } => {
                    paths & (1u128 << to.index()) != 0 || captures(state, command) > 0
                }
                Command::Increment { .. } => false,
            });
        }
    }

    /// The score when the opponent threatens to win and no move stops it:
    /// it wins on its next move.
    fn no_evasion(&self, _state: &GameState, ply: usize) -> i32 {
        -(WIN - (ply as i32 + 2))
    }

    fn evaluate(&self, state: &GameState) -> i32 {
        self.evaluator.evaluate(state.board(), state.to_move())
    }

    fn node(
        &mut self,
        state: &GameState,
        depth: i32,
        mut alpha: i32,
        beta: i32,
        ply: usize,
        stop: &mut dyn FnMut() -> bool,
    ) -> i32 {
        if let Some(score) = self.terminal_with_contempt(state, ply) {
            return score;
        }
        if self.tick(stop) {
            return 0;
        }
        let us = state.to_move();
        if can_win_now(state.board(), us) {
            return WIN - (ply as i32 + 1);
        }
        if ply >= MAX_PLY - 1 {
            return self.evaluate(state);
        }
        let threatened = can_win_now(state.board(), us.opponent());
        let depth = depth + i32::from(threatened && self.options.extension);
        if depth <= 0 {
            return self.quiescence(state, alpha, beta, ply, 0, stop);
        }
        let key = state.position_hash();
        let pv = beta - alpha > 1;
        let mut tt_move = NO_CODE;
        if let Some(entry) = self.table.probe(key) {
            tt_move = entry.command;
            let score = from_table(entry.score as i32, ply);
            if !pv && entry.depth as i32 >= depth {
                let cut = match entry.bound {
                    Bound::Exact => true,
                    Bound::Lower => score >= beta,
                    Bound::Upper => score <= alpha,
                    Bound::Empty => false,
                };
                if cut {
                    return score;
                }
            }
        }

        if self.options.null_move && !pv && !threatened && depth >= 3 && ply > 0 {
            // Passing is not a play, but if the opponent cannot reach beta
            // even with two moves in a row, the position is good enough.
            let eval = self.evaluate(state);
            if eval >= beta {
                let reduction = 2 + depth / 4;
                let passed = GameState::from_board(*state.board(), us.opponent());
                let score = -self.node(
                    &passed,
                    depth - 1 - reduction,
                    -beta,
                    -beta + 1,
                    ply + 1,
                    stop,
                );
                if self.aborted {
                    return 0;
                }
                if score >= beta {
                    return if is_decisive(score) { beta } else { score };
                }
            }
        }

        let mut moves = std::mem::take(&mut self.buffers[ply]);
        let mut order = std::mem::take(&mut self.order[ply]);
        self.generate(state, threatened, &mut moves);
        if moves.is_empty() {
            self.buffers[ply] = moves;
            self.order[ply] = order;
            return self.no_evasion(state, ply);
        }
        order.clear();
        let killers = self.killers[ply];
        for &command in &moves {
            let c = code(command);
            let taken = captures(state, command);
            let key = if c == tt_move {
                1 << 30
            } else if taken > 0 {
                (1 << 28) + taken as i32
            } else if c == killers[0] {
                1 << 27
            } else if c == killers[1] {
                (1 << 27) - 1
            } else {
                self.history[c as usize]
            };
            order.push((key, taken));
        }

        let prunable = self.options.pruning
            && !pv
            && !threatened
            && depth < LATE_MOVES.len() as i32
            && !is_decisive(alpha)
            && !is_decisive(beta);
        let static_eval = if prunable { self.evaluate(state) } else { 0 };
        let alpha_start = alpha;
        let mut best = -INFINITY;
        let mut best_code = NO_CODE;
        for i in 0..moves.len() {
            // Past the late-move count the order no longer matters: the
            // quiet moves left are pruned unless they threaten to win.
            if !(prunable && i >= LATE_MOVES[depth as usize]) {
                pick_next(&mut moves, &mut order, i);
            }
            let command = moves[i];
            let c = code(command);
            let quiet = order[i].1 == 0 && c != tt_move && !killers.contains(&c);
            // A quiet move that threatens to win is never pruned or reduced.
            let mut threat = None;
            let mut threatens =
                |board| *threat.get_or_insert_with(|| creates_threat(board, command, us));
            if i > 0 && quiet && prunable {
                // Late quiet moves near the leaves, and quiet moves that
                // cannot lift a poor position to alpha.
                let late = i >= LATE_MOVES[depth as usize];
                let futile = depth <= 2 && static_eval + FUTILITY_MARGIN * depth <= alpha;
                if (late || futile) && !threatens(state.board()) {
                    continue;
                }
            }
            let child = Engine::step(state, command).expect("a legal command");
            let mut score;
            if i == 0 {
                score = -self.node(&child, depth - 1, -beta, -alpha, ply + 1, stop);
            } else {
                let reduce = self.options.late_reductions
                    && depth >= 3
                    && i >= 3
                    && quiet
                    && !threatened
                    && !threatens(state.board());
                let r = if reduce {
                    let r = self.reductions[(depth as usize).min(31)][i.min(63)] as i32;
                    r.min(depth - 2)
                } else {
                    0
                };
                score = -self.node(&child, depth - 1 - r, -alpha - 1, -alpha, ply + 1, stop);
                if score > alpha && r > 0 {
                    score = -self.node(&child, depth - 1, -alpha - 1, -alpha, ply + 1, stop);
                }
                if score > alpha && score < beta {
                    score = -self.node(&child, depth - 1, -beta, -alpha, ply + 1, stop);
                }
            }
            if self.aborted {
                break;
            }
            if score > best {
                best = score;
                best_code = c;
                if score > alpha {
                    alpha = score;
                    if alpha >= beta {
                        if quiet {
                            let killers = &mut self.killers[ply];
                            if killers[0] != c {
                                killers[1] = killers[0];
                                killers[0] = c;
                            }
                            let h = &mut self.history[c as usize];
                            *h = (*h + depth * depth).min(1 << 26);
                        }
                        break;
                    }
                }
            }
        }
        self.buffers[ply] = moves;
        self.order[ply] = order;
        if self.aborted {
            return 0;
        }
        let bound = if best >= beta {
            Bound::Lower
        } else if best > alpha_start {
            Bound::Exact
        } else {
            Bound::Upper
        };
        self.table
            .store(key, best_code, to_table(best, ply), depth, bound);
        best
    }

    fn quiescence(
        &mut self,
        state: &GameState,
        mut alpha: i32,
        beta: i32,
        ply: usize,
        depth: u32,
        stop: &mut dyn FnMut() -> bool,
    ) -> i32 {
        if let Some(score) = self.terminal_with_contempt(state, ply) {
            return score;
        }
        if self.tick(stop) {
            return 0;
        }
        let us = state.to_move();
        if can_win_now(state.board(), us) {
            return WIN - (ply as i32 + 1);
        }
        if ply >= MAX_PLY - 1 {
            return self.evaluate(state);
        }
        let threatened = can_win_now(state.board(), us.opponent());
        let mut best;
        if threatened {
            if depth >= QUIESCENCE_EVASIONS {
                return self.evaluate(state);
            }
            best = self.no_evasion(state, ply);
        } else {
            best = self.evaluate(state);
            if best >= beta {
                return best;
            }
            alpha = alpha.max(best);
        }
        let mut moves = std::mem::take(&mut self.buffers[ply]);
        let mut order = std::mem::take(&mut self.order[ply]);
        self.generate(state, threatened, &mut moves);
        order.clear();
        if !threatened {
            moves.retain(|&command| captures(state, command) > 0);
        }
        for &command in moves.iter() {
            let taken = captures(state, command);
            order.push((taken as i32, taken));
        }
        for i in 0..moves.len() {
            pick_next(&mut moves, &mut order, i);
            let child = Engine::step(state, moves[i]).expect("a legal command");
            let score = -self.quiescence(&child, -beta, -alpha, ply + 1, depth + 1, stop);
            if self.aborted {
                break;
            }
            if score > best {
                best = score;
                if score > alpha {
                    alpha = score;
                    if alpha >= beta {
                        break;
                    }
                }
            }
        }
        self.buffers[ply] = moves;
        self.order[ply] = order;
        if self.aborted {
            0
        } else {
            best
        }
    }
}

/// Moves the best remaining move (by `order`) to position `i`.
fn pick_next(moves: &mut [Command], order: &mut [(i32, u8)], i: usize) {
    let mut best = i;
    for j in i + 1..moves.len() {
        if order[j].0 > order[best].0 {
            best = j;
        }
    }
    moves.swap(i, best);
    order.swap(i, best);
}

/// Win scores in the table count from the stored node, not from the root.
fn to_table(score: i32, ply: usize) -> i32 {
    if score >= WIN - MAX_PLY as i32 {
        score + ply as i32
    } else if score <= -(WIN - MAX_PLY as i32) {
        score - ply as i32
    } else {
        score
    }
}

fn from_table(score: i32, ply: usize) -> i32 {
    if score >= WIN - MAX_PLY as i32 {
        score - ply as i32
    } else if score <= -(WIN - MAX_PLY as i32) {
        score + ply as i32
    } else {
        score
    }
}

#[cfg(test)]
mod tests;
