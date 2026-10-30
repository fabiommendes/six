//! The board, the moves and the end of the game.
//!
//! Rows count from the White side: White starts on row 0 and heads for the
//! last row, Black the other way.
//!
//! Squares are numbered on a grid of the largest board, 11 by 11; a smaller
//! board uses its top-left corner.

/// Columns and rows of the largest board, the stride of [`Pos`].
pub const SIZE: usize = 11;
pub const CELLS: usize = SIZE * SIZE;

/// The lowest value of a die that can be captured: a die of this value or
/// more leaves the game when it gets as many neighbors as its value.
pub const CAPTURE_VALUE: u8 = 4;

/// A square, `row * SIZE + col`.
pub type Pos = u8;

pub const fn pos(row: usize, col: usize) -> Pos {
    (row * SIZE + col) as Pos
}

/// The up to 8 squares touching `p` by a side or a corner, on a board of
/// `size` by `size`.
pub fn neighbors(p: Pos, size: usize) -> impl Iterator<Item = Pos> {
    let (row, col) = (p as usize / SIZE, p as usize % SIZE);
    (-1i32..=1)
        .flat_map(move |dr| (-1i32..=1).map(move |dc| (dr, dc)))
        .filter(|&d| d != (0, 0))
        .filter_map(move |(dr, dc)| {
            let (r, c) = (row as i32 + dr, col as i32 + dc);
            let inside = (0..size as i32).contains(&r) && (0..size as i32).contains(&c);
            inside.then(|| pos(r as usize, c as usize))
        })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Color {
    White,
    Black,
}

impl Color {
    pub fn index(self) -> usize {
        self as usize
    }

    pub fn other(self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Die {
    pub owner: Color,
    pub value: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Goal {
    /// A chain of own dice from the own back row to the opponent's.
    Line,
    /// Any own die on the opponent's back row.
    Reach,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rules {
    /// Columns and rows of the board, at most [`SIZE`].
    pub size: usize,
    pub goal: Goal,
    /// Dice of each player, the starting die included.
    pub dice: u8,
    /// The value of the reserve dice, but those of [`Rules::extra`].
    pub placed_value: u8,
    /// Reserve dice that start with another value, counted by value: index
    /// 3 holds the 3s. They count within [`Rules::dice`].
    pub extra: [u8; 7],
    /// Whether the increase-and-block action exists.
    pub blocking: bool,
    /// Whether a blocking die may also go to the own half, behind the
    /// central rows.
    pub block_home: bool,
    /// Whether a blocking die may come from the board once the reserve is
    /// empty; without it, blocking ends with the reserve.
    pub block_from_board: bool,
    /// Whether a die of [`CAPTURE_VALUE`] or more leaves the game when a
    /// placed die fills it, with as many neighbors as its value, and a
    /// player who loses too many dice to make a line loses: see
    /// [`Game::capture_limit`].
    pub capture: bool,
    /// Whether a die taken from the board must land on a row nearer the
    /// goal of its owner than the one it left.
    pub advance: bool,
    /// Turns, summed over both players, after which the game is a draw.
    pub max_turns: u32,
}

impl Rules {
    /// The rules the designer settled on: 9 by 9, the line, 12 dice and
    /// capture. [`Rules::default`] keeps the first proposal, on the full
    /// board, as the base of the tests and the batches.
    pub fn proposal() -> Rules {
        Rules {
            size: 9,
            dice: 12,
            capture: true,
            ..Rules::default()
        }
    }
}

/// The first proposal: 11 by 11, the line, 16 dice, no capture.
impl Default for Rules {
    fn default() -> Rules {
        Rules {
            size: SIZE,
            goal: Goal::Line,
            dice: 16,
            placed_value: 2,
            extra: [0; 7],
            blocking: true,
            block_home: false,
            block_from_board: true,
            capture: false,
            advance: false,
            max_turns: 300,
        }
    }
}

/// Where a placed die comes from: a reserve die of the given value, or,
/// once the reserve is empty, an own die on the board.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Source {
    Reserve(u8),
    Board(Pos),
}

/// One action of a turn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Move {
    Increase(Pos),
    Place {
        to: Pos,
        from: Source,
    },
    /// The increase comes first, so it can make room for the blocking die,
    /// which lands as a 1 whatever its value was.
    Block {
        raise: Pos,
        to: Pos,
        from: Source,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Win(Color),
    Draw,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Game {
    pub rules: Rules,
    cells: [Option<Die>; CELLS],
    /// Dice left in each player's reserve, counted by value: index 2 holds
    /// the 2s.
    pub reserve: [[u8; 7]; 2],
    pub turn: Color,
    /// Turns played, summed over both players.
    pub turns: u32,
    pub outcome: Option<Outcome>,
    /// Dice of each color captured so far.
    pub captured: [u8; 2],
}

impl Game {
    pub fn new(rules: Rules) -> Game {
        let mut cells = [None; CELLS];
        for color in [Color::White, Color::Black] {
            let row = if color == Color::White {
                0
            } else {
                rules.size - 1
            };
            cells[pos(row, rules.size / 2) as usize] = Some(Die {
                owner: color,
                value: 1,
            });
        }
        let mut reserve = rules.extra;
        reserve[rules.placed_value as usize] +=
            (rules.dice - 1).saturating_sub(rules.extra.iter().sum());
        Game {
            rules,
            cells,
            reserve: [reserve; 2],
            turn: Color::White,
            turns: 0,
            outcome: None,
            captured: [0; 2],
        }
    }

    /// Dice left in the reserve of `color`.
    pub fn reserve_size(&self, color: Color) -> u8 {
        self.reserve[color.index()].iter().sum()
    }

    /// With [`Rules::capture`], the captured dice that make a player lose:
    /// with that many gone, too few are left to cross the board.
    pub fn capture_limit(&self) -> Option<u8> {
        self.rules.capture.then(|| {
            (self.rules.dice + 1)
                .saturating_sub(self.rules.size as u8)
                .max(1)
        })
    }

    pub fn back_row(&self, color: Color) -> usize {
        match color {
            Color::White => 0,
            Color::Black => self.rules.size - 1,
        }
    }

    /// The back row of the opponent, where the line ends.
    pub fn goal_row(&self, color: Color) -> usize {
        self.back_row(color.other())
    }

    /// The rows where `color` may put a blocking die: the three central
    /// ones, and the own half behind them with [`Rules::block_home`].
    pub fn block_rows(&self, color: Color) -> std::ops::RangeInclusive<usize> {
        let mid = self.rules.size / 2;
        match (self.rules.block_home, color) {
            (false, _) => mid - 1..=mid + 1,
            (true, Color::White) => 0..=mid + 1,
            (true, Color::Black) => mid - 1..=self.rules.size - 1,
        }
    }

    /// The squares of the board.
    pub fn squares(&self) -> impl Iterator<Item = Pos> {
        let size = self.rules.size;
        (0..size).flat_map(move |row| (0..size).map(move |col| pos(row, col)))
    }

    pub fn neighbors(&self, p: Pos) -> impl Iterator<Item = Pos> {
        neighbors(p, self.rules.size)
    }

    pub fn at(&self, p: Pos) -> Option<Die> {
        self.cells[p as usize]
    }

    /// Puts a die on a square, or clears it, with no rule checked: for tests
    /// and analysis positions.
    pub fn set(&mut self, p: Pos, die: Option<Die>) {
        self.cells[p as usize] = die;
    }

    pub fn dice(&self, color: Color) -> impl Iterator<Item = (Pos, Die)> + '_ {
        (0..CELLS as Pos)
            .filter_map(move |p| self.at(p).filter(|d| d.owner == color).map(|d| (p, d)))
    }

    pub fn neighbor_count(&self, p: Pos) -> usize {
        self.neighbors(p).filter(|&n| self.at(n).is_some()).count()
    }

    /// Whether a die of `value` on the empty square `p` keeps every die,
    /// itself and its neighbors, within the limit.
    pub fn fits(&self, p: Pos, value: u8) -> bool {
        let mut count = 0;
        for n in self.neighbors(p) {
            if let Some(die) = self.at(n) {
                count += 1;
                if self.neighbor_count(n) + 1 > die.value as usize {
                    return false;
                }
            }
        }
        count <= value as usize
    }

    fn touches(&self, p: Pos, color: Color) -> bool {
        self.neighbors(p)
            .any(|n| self.at(n).is_some_and(|d| d.owner == color))
    }

    /// The board after `mv`, or `None` if it breaks a rule. Does not end
    /// the game or pass the turn.
    fn after(&self, mv: Move) -> Option<Game> {
        let me = self.turn;
        let mut next = self.clone();
        let raise = |g: &mut Game, p: Pos| -> Option<()> {
            let die = g.cells[p as usize].as_mut()?;
            (die.value < 6).then(|| die.value += 1)
        };
        // Takes the die to place, from the reserve or the board, and gives
        // its value.
        let take = |g: &mut Game, from: Source, to: Pos| -> Option<u8> {
            match from {
                Source::Reserve(v) => {
                    let count = g.reserve[me.index()].get_mut(v as usize)?;
                    (*count > 0).then(|| *count -= 1)?;
                    Some(v)
                }
                Source::Board(f) => {
                    let die = g.at(f).filter(|d| d.owner == me)?;
                    (g.reserve_size(me) == 0 && f != to).then_some(())?;
                    let ahead = match me {
                        Color::White => to as usize / SIZE > f as usize / SIZE,
                        Color::Black => (to as usize / SIZE) < f as usize / SIZE,
                    };
                    (!g.rules.advance || ahead).then_some(())?;
                    g.set(f, None);
                    Some(die.value)
                }
            }
        };
        match mv {
            Move::Increase(p) => raise(&mut next, p)?,
            Move::Place { to, from } => {
                next.at(to).is_none().then_some(())?;
                let value = take(&mut next, from, to)?;
                (next.touches(to, me) && next.fits(to, value)).then_some(())?;
                next.set(to, Some(Die { owner: me, value }));
                next.capture_around(to);
            }
            Move::Block { raise: r, to, from } => {
                (self.rules.blocking && self.block_rows(me).contains(&(to as usize / SIZE)))
                    .then_some(())?;
                next.at(to).is_none().then_some(())?;
                (matches!(from, Source::Reserve(_)) || self.rules.block_from_board).then_some(())?;
                raise(&mut next, r)?;
                take(&mut next, from, to)?;
                (next.touches(to, me.other()) && next.fits(to, 1)).then_some(())?;
                next.set(
                    to,
                    Some(Die {
                        owner: me,
                        value: 1,
                    }),
                );
                next.capture_around(to);
            }
        }
        Some(next)
    }

    /// With [`Rules::capture`], removes the dice next to the die just placed
    /// on `p` that hold [`CAPTURE_VALUE`] or more and now have as many
    /// neighbors as their value, of either color.
    fn capture_around(&mut self, p: Pos) {
        if !self.rules.capture {
            return;
        }
        let full: Vec<Pos> = self
            .neighbors(p)
            .filter(|&n| {
                self.at(n).is_some_and(|d| {
                    d.value >= CAPTURE_VALUE && self.neighbor_count(n) == d.value as usize
                })
            })
            .collect();
        for n in full {
            let owner = self.at(n).unwrap().owner;
            self.captured[owner.index()] += 1;
            self.set(n, None);
        }
    }

    /// Every legal move of the player to move; empty once the game is over.
    pub fn legal_moves(&self) -> Vec<Move> {
        if self.outcome.is_some() {
            return Vec::new();
        }
        let me = self.turn;
        let occupied: Vec<Pos> = (0..CELLS as Pos)
            .filter(|&p| self.at(p).is_some())
            .collect();
        let sources: Vec<Source> = if self.reserve_size(me) > 0 {
            (1..=6u8)
                .filter(|&v| self.reserve[me.index()][v as usize] > 0)
                .map(Source::Reserve)
                .collect()
        } else {
            self.dice(me).map(|(p, _)| Source::Board(p)).collect()
        };
        let empty = self.squares().filter(|&p| self.at(p).is_none());
        let mut candidates: Vec<Move> = occupied.iter().map(|&p| Move::Increase(p)).collect();
        for to in empty {
            let place = self.touches(to, me);
            let block = self.rules.blocking
                && self.block_rows(me).contains(&(to as usize / SIZE))
                && self.touches(to, me.other());
            for &from in &sources {
                if place {
                    candidates.push(Move::Place { to, from });
                }
                if block && (matches!(from, Source::Reserve(_)) || self.rules.block_from_board) {
                    candidates.extend(occupied.iter().map(|&raise| Move::Block {
                        raise,
                        to,
                        from,
                    }));
                }
            }
        }
        candidates
            .into_iter()
            .filter(|&mv| self.after(mv).is_some())
            .collect()
    }

    /// Whether the player to move has a legal move; a die below 6 is
    /// always one, so the full list is needed only on a board of 6s.
    fn has_move(&self) -> bool {
        self.squares()
            .any(|p| self.at(p).is_some_and(|d| d.value < 6))
            || !self.legal_moves().is_empty()
    }

    pub fn is_legal(&self, mv: Move) -> bool {
        self.outcome.is_none() && self.after(mv).is_some()
    }

    /// Plays `mv` for the player to move and passes the turn. The player who
    /// is left with no legal move, or reaches the [`Game::capture_limit`],
    /// loses; a move that makes a line or takes the opponent to the limit
    /// wins even if it also takes the mover there.
    pub fn play(&mut self, mv: Move) -> Result<(), String> {
        if self.outcome.is_some() {
            return Err("the game is over".into());
        }
        let me = self.turn;
        *self = self.after(mv).ok_or(format!("illegal move {mv:?}"))?;
        self.turns += 1;
        self.turn = me.other();
        let lost = |c: Color| {
            self.capture_limit()
                .is_some_and(|limit| self.captured[c.index()] >= limit)
        };
        if self.has_won(me) || lost(me.other()) {
            self.outcome = Some(Outcome::Win(me));
        } else if lost(me) {
            self.outcome = Some(Outcome::Win(me.other()));
        } else if self.turns >= self.rules.max_turns {
            self.outcome = Some(Outcome::Draw);
        } else if !self.has_move() {
            self.outcome = Some(Outcome::Win(me));
        }
        Ok(())
    }

    pub fn has_won(&self, color: Color) -> bool {
        let on_row = |p: Pos, row: usize| p as usize / SIZE == row;
        match self.rules.goal {
            Goal::Reach => self
                .dice(color)
                .any(|(p, _)| on_row(p, self.goal_row(color))),
            Goal::Line => {
                let mut seen = [false; CELLS];
                let mut stack: Vec<Pos> = self
                    .dice(color)
                    .map(|(p, _)| p)
                    .filter(|&p| on_row(p, self.back_row(color)))
                    .collect();
                stack.iter().for_each(|&p| seen[p as usize] = true);
                while let Some(p) = stack.pop() {
                    if on_row(p, self.goal_row(color)) {
                        return true;
                    }
                    for n in self.neighbors(p) {
                        if !seen[n as usize] && self.at(n).is_some_and(|d| d.owner == color) {
                            seen[n as usize] = true;
                            stack.push(n);
                        }
                    }
                }
                false
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const R2: Source = Source::Reserve(2);
    const W: Color = Color::White;
    const B: Color = Color::Black;

    fn die(owner: Color, value: u8) -> Option<Die> {
        Some(Die { owner, value })
    }

    /// An empty board, White to move, with full reserves.
    fn empty(rules: Rules) -> Game {
        let mut g = Game::new(rules);
        for p in 0..CELLS as Pos {
            g.set(p, None);
        }
        g
    }

    #[test]
    fn starts_with_one_die_each_in_the_central_column() {
        let g = Game::new(Rules::default());
        assert_eq!(g.at(pos(0, 5)), die(W, 1));
        assert_eq!(g.at(pos(10, 5)), die(B, 1));
        assert_eq!(g.reserve, [[0, 0, 15, 0, 0, 0, 0]; 2]);
        assert_eq!(g.dice(W).count() + g.dice(B).count(), 2);
    }

    #[test]
    fn first_moves_are_raising_or_placing_next_to_the_start() {
        let g = Game::new(Rules::default());
        let moves = g.legal_moves();
        // 2 increases and the 5 squares around the starting die.
        assert_eq!(moves.len(), 7, "{moves:?}");
        assert!(moves.contains(&Move::Place {
            to: pos(1, 5),
            from: R2
        }));
    }

    #[test]
    fn a_full_die_takes_no_more_neighbors() {
        let mut g = Game::new(Rules::default());
        g.play(Move::Place {
            to: pos(1, 5),
            from: R2,
        })
        .unwrap();
        g.play(Move::Increase(pos(10, 5))).unwrap();
        // The starting die, a 1, already has its one neighbor.
        assert!(!g.is_legal(Move::Place {
            to: pos(1, 4),
            from: R2
        }));
        assert!(!g.is_legal(Move::Place {
            to: pos(0, 4),
            from: R2
        }));
        assert!(g.is_legal(Move::Place {
            to: pos(2, 5),
            from: R2
        }));
        g.play(Move::Increase(pos(0, 5))).unwrap();
        g.play(Move::Increase(pos(10, 5))).unwrap();
        assert!(g.is_legal(Move::Place {
            to: pos(1, 4),
            from: R2
        }));
    }

    #[test]
    fn the_placed_die_respects_its_own_limit() {
        let mut g = empty(Rules::default());
        g.set(pos(3, 3), die(W, 6));
        g.set(pos(3, 5), die(W, 6));
        g.set(pos(5, 4), die(B, 6));
        // A 2 between three dice would have three neighbors.
        assert!(!g.is_legal(Move::Place {
            to: pos(4, 4),
            from: R2
        }));
        g.set(pos(5, 4), None);
        assert!(g.is_legal(Move::Place {
            to: pos(4, 4),
            from: R2
        }));
    }

    #[test]
    fn the_limit_of_an_opponent_die_counts_too() {
        let mut g = empty(Rules::default());
        g.set(pos(2, 2), die(W, 6));
        g.set(pos(2, 4), die(B, 1));
        g.set(pos(2, 5), die(B, 6));
        assert!(!g.is_legal(Move::Place {
            to: pos(2, 3),
            from: R2
        }));
        g.set(pos(2, 4), die(B, 2));
        assert!(g.is_legal(Move::Place {
            to: pos(2, 3),
            from: R2
        }));
    }

    #[test]
    fn blocking_goes_only_to_the_central_rows_next_to_an_opponent() {
        let mut g = empty(Rules::default());
        g.set(pos(5, 5), die(B, 2));
        g.set(pos(8, 5), die(B, 2));
        g.set(pos(0, 0), die(W, 2));
        let block = |to| Move::Block {
            raise: pos(0, 0),
            to,
            from: R2,
        };
        assert!(g.is_legal(block(pos(4, 5))));
        assert!(g.is_legal(block(pos(6, 6))));
        assert!(!g.is_legal(block(pos(7, 5))), "outside the central rows");
        assert!(!g.is_legal(block(pos(4, 0))), "not next to an opponent");
        g.play(block(pos(4, 5))).unwrap();
        assert_eq!(g.at(pos(4, 5)), die(W, 1));
        assert_eq!(g.at(pos(0, 0)), die(W, 3));
        assert_eq!(g.reserve_size(W), 14);
    }

    #[test]
    fn blocking_at_home_reaches_the_own_half_only() {
        let rules = Rules {
            block_home: true,
            ..Rules::default()
        };
        let mut g = empty(rules);
        assert_eq!(g.block_rows(W), 0..=6);
        assert_eq!(g.block_rows(B), 4..=10);
        g.set(pos(2, 5), die(B, 2));
        g.set(pos(8, 5), die(B, 2));
        g.set(pos(0, 0), die(W, 2));
        let block = |to| Move::Block {
            raise: pos(0, 0),
            to,
            from: R2,
        };
        assert!(g.is_legal(block(pos(1, 5))), "in the own half");
        assert!(!g.is_legal(block(pos(7, 5))), "in the opponent's half");
    }

    #[test]
    fn without_blocking_from_the_board_an_empty_reserve_cannot_block() {
        let rules = Rules {
            block_from_board: false,
            ..Rules::default()
        };
        let mut g = empty(rules);
        g.reserve[0] = [0; 7];
        g.set(pos(0, 0), die(W, 5));
        g.set(pos(5, 5), die(B, 2));
        let block = Move::Block {
            raise: pos(5, 5),
            to: pos(4, 5),
            from: Source::Board(pos(0, 0)),
        };
        assert!(!g.is_legal(block));
        assert!(g
            .legal_moves()
            .iter()
            .all(|m| !matches!(m, Move::Block { .. })));
        g.reserve[0][2] = 1;
        assert!(g.is_legal(Move::Block {
            raise: pos(5, 5),
            to: pos(4, 5),
            from: R2
        }));
    }

    #[test]
    fn the_blocking_die_touches_only_the_opponent() {
        let mut g = empty(Rules::default());
        g.set(pos(5, 5), die(B, 6));
        g.set(pos(5, 7), die(W, 5));
        // On (5, 6) it would have two neighbors, over its limit of 1.
        let block = Move::Block {
            raise: pos(5, 7),
            to: pos(5, 6),
            from: R2,
        };
        assert!(!g.is_legal(block));
        assert!(g.is_legal(Move::Block {
            raise: pos(5, 7),
            to: pos(5, 4),
            from: R2
        }));
    }

    #[test]
    fn the_increase_of_a_block_comes_first_and_makes_room() {
        let mut g = empty(Rules::default());
        g.set(pos(5, 5), die(B, 2));
        g.set(pos(5, 6), die(B, 2));
        g.set(pos(4, 7), die(B, 2));
        g.set(pos(0, 0), die(W, 2));
        // (6, 7) touches only (5, 6), full with two neighbors: raising it
        // makes room.
        assert!(!g.is_legal(Move::Block {
            raise: pos(0, 0),
            to: pos(6, 7),
            from: R2
        }));
        assert!(g.is_legal(Move::Block {
            raise: pos(5, 6),
            to: pos(6, 7),
            from: R2
        }));
    }

    #[test]
    fn dice_come_from_the_board_once_the_reserve_is_empty() {
        let mut g = Game::new(Rules::default());
        g.reserve[0] = [0; 7];
        let moves = g.legal_moves();
        assert!(moves.iter().all(|m| !matches!(
            m,
            Move::Place {
                from: Source::Reserve(_),
                ..
            }
        )));
        // The only white die cannot move next to itself.
        assert!(moves.iter().all(|m| matches!(m, Move::Increase(_))));
        g.set(pos(1, 5), die(W, 4));
        g.set(pos(0, 5), die(W, 2));
        let mv = Move::Place {
            to: pos(2, 6),
            from: Source::Board(pos(0, 5)),
        };
        g.play(mv).unwrap();
        assert_eq!(g.at(pos(2, 6)), die(W, 2));
        assert_eq!(g.at(pos(0, 5)), None);
    }

    #[test]
    fn with_advance_a_die_from_the_board_moves_forward() {
        let mut g = empty(Rules {
            advance: true,
            ..Rules::default()
        });
        g.reserve[0] = [0; 7];
        g.set(pos(3, 5), die(W, 6));
        g.set(pos(3, 4), die(W, 2));
        g.set(pos(1, 5), die(W, 2));
        let from = |p| Source::Board(p);
        assert!(g.is_legal(Move::Place {
            to: pos(4, 5),
            from: from(pos(3, 4))
        }));
        assert!(
            !g.is_legal(Move::Place {
                to: pos(3, 6),
                from: from(pos(3, 4))
            }),
            "the same row"
        );
        assert!(
            !g.is_legal(Move::Place {
                to: pos(2, 5),
                from: from(pos(3, 4))
            }),
            "backwards"
        );
        assert!(g.is_legal(Move::Place {
            to: pos(2, 5),
            from: from(pos(1, 5))
        }));
    }

    #[test]
    fn a_die_from_the_board_blocks_as_a_one() {
        let mut g = empty(Rules::default());
        g.reserve[0] = [0; 7];
        g.set(pos(0, 0), die(W, 5));
        g.set(pos(5, 5), die(B, 2));
        g.play(Move::Block {
            raise: pos(5, 5),
            to: pos(4, 5),
            from: Source::Board(pos(0, 0)),
        })
        .unwrap();
        assert_eq!(g.at(pos(4, 5)), die(W, 1));
        assert_eq!(g.at(pos(0, 0)), None);
    }

    fn column(g: &mut Game, color: Color, rows: std::ops::Range<usize>) {
        for row in rows {
            g.set(pos(row, 5), die(color, 2));
        }
    }

    #[test]
    fn the_line_crosses_from_back_row_to_back_row() {
        let mut g = empty(Rules::default());
        column(&mut g, W, 0..10);
        g.set(pos(9, 6), None);
        assert!(!g.has_won(W));
        g.set(pos(10, 6), die(W, 2));
        assert!(g.has_won(W), "the diagonal step counts");
        g.set(pos(4, 5), die(B, 2));
        assert!(!g.has_won(W));
    }

    #[test]
    fn reaching_needs_only_one_die_on_the_far_row() {
        let rules = Rules {
            goal: Goal::Reach,
            ..Rules::default()
        };
        let mut g = empty(rules);
        g.set(pos(10, 0), die(W, 2));
        assert!(g.has_won(W));
        assert!(!g.has_won(B));
    }

    #[test]
    fn a_smaller_board_moves_the_start_the_center_and_the_goal() {
        let mut g = Game::new(Rules {
            size: 9,
            ..Rules::default()
        });
        assert_eq!(g.at(pos(0, 4)), die(W, 1));
        assert_eq!(g.at(pos(8, 4)), die(B, 1));
        assert_eq!(g.block_rows(W), 3..=5);
        assert!(g.neighbors(pos(8, 8)).all(|n| n as usize % SIZE < 9));
        assert!(g.legal_moves().iter().all(|m| match m {
            Move::Place { to, .. } => (*to as usize % SIZE) < 9,
            _ => true,
        }));
        g.set(pos(8, 4), None);
        column(&mut g, W, 0..8);
        assert!(!g.has_won(W));
        g.set(pos(8, 5), die(W, 2));
        assert!(g.has_won(W), "the goal is row 8");
    }

    /// A black die of `value` on (5, 5) with white neighbors; a white die
    /// on (4, 4) is the next one, with two neighbors of its own.
    fn surrounded(rules: Rules, value: u8, neighbors: &[Pos]) -> Game {
        let mut g = empty(rules);
        g.set(pos(5, 5), die(B, value));
        for &p in neighbors {
            g.set(p, die(W, 6));
        }
        g
    }

    const THREE: [Pos; 3] = [pos(4, 5), pos(5, 6), pos(6, 6)];
    const FOURTH: Move = Move::Place {
        to: pos(4, 4),
        from: R2,
    };

    #[test]
    fn the_fourth_neighbor_of_a_four_captures_it() {
        let mut g = surrounded(
            Rules {
                capture: true,
                ..Rules::default()
            },
            4,
            &THREE,
        );
        g.play(FOURTH).unwrap();
        assert_eq!(g.at(pos(5, 5)), None);
        assert_eq!(g.captured, [0, 1]);
    }

    #[test]
    fn a_die_of_four_or_more_falls_to_as_many_neighbors_as_its_value() {
        let rules = Rules {
            capture: true,
            ..Rules::default()
        };
        let mut g = surrounded(rules, 5, &THREE);
        g.play(FOURTH).unwrap();
        assert_eq!(g.at(pos(5, 5)), die(B, 5), "a 5 with four neighbors");
        let mut g = surrounded(rules, 5, &[THREE[0], THREE[1], THREE[2], pos(6, 4)]);
        g.play(FOURTH).unwrap();
        assert_eq!(g.at(pos(5, 5)), None, "a 5 with five neighbors");
        assert_eq!(g.captured, [0, 1]);
        let mut g = surrounded(rules, 4, &THREE[..2]);
        g.play(FOURTH).unwrap();
        assert_eq!(g.at(pos(5, 5)), die(B, 4), "only three neighbors");
        let mut g = surrounded(rules, 3, &THREE[..2]);
        g.play(FOURTH).unwrap();
        assert_eq!(g.at(pos(5, 5)), die(B, 3), "a 3 is never captured");
        assert_eq!(g.captured, [0, 0]);
    }

    #[test]
    fn raising_to_four_and_blocking_captures_in_one_turn() {
        let rules = Rules {
            capture: true,
            ..Rules::default()
        };
        let mut g = empty(rules);
        g.set(pos(5, 5), die(B, 3));
        g.set(pos(6, 4), die(B, 6));
        g.set(pos(6, 5), die(B, 6));
        g.set(pos(6, 6), die(B, 6));
        // Full at 3 neighbors: the increase makes room for a fourth.
        assert!(!g.is_legal(Move::Block {
            raise: pos(6, 4),
            to: pos(4, 5),
            from: R2
        }));
        g.play(Move::Block {
            raise: pos(5, 5),
            to: pos(4, 5),
            from: R2,
        })
        .unwrap();
        assert_eq!(g.at(pos(5, 5)), None);
        assert_eq!(g.at(pos(4, 5)), die(W, 1));
    }

    #[test]
    fn without_the_rule_a_four_takes_its_fourth_neighbor() {
        let mut g = surrounded(Rules::default(), 4, &THREE);
        g.play(FOURTH).unwrap();
        assert_eq!(g.at(pos(5, 5)), die(B, 4));
    }

    #[test]
    fn the_reserve_can_start_with_other_values() {
        let mut extra = [0; 7];
        extra[3..].copy_from_slice(&[1, 1, 1, 1]);
        let mut g = Game::new(Rules {
            extra,
            ..Rules::default()
        });
        assert_eq!(g.reserve[0], [0, 0, 11, 1, 1, 1, 1]);
        let to = pos(1, 5);
        let places = |g: &Game| {
            g.legal_moves()
                .into_iter()
                .filter(|m| matches!(m, Move::Place { to: t, .. } if *t == to))
                .count()
        };
        assert_eq!(places(&g), 5, "one placement per value in the reserve");
        g.play(Move::Place {
            to,
            from: Source::Reserve(6),
        })
        .unwrap();
        assert_eq!(g.at(to), die(W, 6));
        assert_eq!(g.reserve[0][6], 0);
        g.play(Move::Increase(pos(10, 5))).unwrap();
        assert!(!g.is_legal(Move::Place {
            to: pos(2, 5),
            from: Source::Reserve(6)
        }));
    }

    #[test]
    fn a_blocking_die_from_a_high_reserve_value_lands_as_a_one() {
        let mut g = empty(Rules::default());
        g.reserve[0] = [0, 0, 0, 0, 0, 1, 0];
        g.set(pos(0, 0), die(W, 2));
        g.set(pos(5, 5), die(B, 2));
        g.play(Move::Block {
            raise: pos(0, 0),
            to: pos(4, 5),
            from: Source::Reserve(5),
        })
        .unwrap();
        assert_eq!(g.at(pos(4, 5)), die(W, 1));
        assert_eq!(g.reserve_size(W), 0);
    }

    #[test]
    fn losing_too_many_dice_to_captures_loses() {
        let rules = Rules {
            size: 9,
            capture: true,
            ..Rules::default()
        };
        let mut g = surrounded(rules, 4, &THREE);
        assert_eq!(g.capture_limit(), Some(8), "16 dice, 9 needed for a line");
        g.captured[1] = 6;
        g.play(FOURTH).unwrap();
        assert_eq!(g.outcome, None, "seven captured");
        let mut g = surrounded(rules, 4, &THREE);
        g.captured[1] = 7;
        g.play(FOURTH).unwrap();
        assert_eq!(g.outcome, Some(Outcome::Win(W)));
        assert_eq!(Game::new(Rules::default()).capture_limit(), None);
    }

    #[test]
    fn capturing_an_own_die_up_to_the_limit_loses() {
        let rules = Rules {
            size: 9,
            capture: true,
            ..Rules::default()
        };
        let mut g = empty(rules);
        g.set(pos(5, 5), die(W, 4));
        for p in THREE {
            g.set(p, die(B, 6));
        }
        g.captured[0] = 7;
        g.play(FOURTH).unwrap();
        assert_eq!(g.at(pos(5, 5)), None);
        assert_eq!(g.outcome, Some(Outcome::Win(B)));
    }

    #[test]
    fn random_games_keep_blocks_open_and_captures_complete() {
        // Wherever a blocking die fits with no increase, every die below 6
        // may be the one increased; after a placement, no neighbor of the
        // placed die is a die of 4 or more with as many neighbors.
        let mut rng = crate::Rng::new(7);
        for _ in 0..4 {
            let mut g = Game::new(Rules {
                size: 9,
                capture: true,
                max_turns: 100,
                ..Rules::default()
            });
            while g.outcome.is_none() {
                let moves = g.legal_moves();
                let raisable: Vec<Pos> = g
                    .squares()
                    .filter(|&p| g.at(p).is_some_and(|d| d.value < 6))
                    .collect();
                for &mv in &moves {
                    if let Move::Block { to, from, .. } = mv {
                        if g.fits(to, 1) {
                            for &r in &raisable {
                                let other = Move::Block { raise: r, to, from };
                                assert!(moves.contains(&other), "{other:?} in {g:?}");
                            }
                        }
                    }
                }
                let mv = moves[rng.below(moves.len())];
                g.play(mv).unwrap();
                let placed = match mv {
                    Move::Place { to, .. } | Move::Block { to, .. } => Some(to),
                    Move::Increase(_) => None,
                };
                let full_fours = placed
                    .into_iter()
                    .flat_map(|to| g.neighbors(to))
                    .filter(|&p| {
                        g.at(p).is_some_and(|d| {
                            d.value >= CAPTURE_VALUE && g.neighbor_count(p) == d.value as usize
                        })
                    });
                assert_eq!(full_fours.count(), 0, "after {mv:?}: {g:?}");
            }
        }
    }

    #[test]
    fn the_game_is_a_draw_at_the_turn_limit() {
        let mut g = Game::new(Rules {
            max_turns: 2,
            ..Rules::default()
        });
        g.play(Move::Increase(pos(0, 5))).unwrap();
        g.play(Move::Increase(pos(0, 5))).unwrap();
        assert_eq!(g.outcome, Some(Outcome::Draw));
        assert!(g.play(Move::Increase(pos(10, 5))).is_err());
    }

    #[test]
    fn a_player_with_no_move_loses() {
        let mut g = empty(Rules::default());
        g.reserve = [[0; 7]; 2];
        g.set(pos(0, 0), die(W, 5));
        g.set(pos(10, 10), die(B, 6));
        g.play(Move::Increase(pos(0, 0))).unwrap();
        // Black: one die, a 6, alone on the board, nothing to raise or move.
        assert_eq!(g.outcome, Some(Outcome::Win(W)));
    }
}
