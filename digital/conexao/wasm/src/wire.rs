//! JSON adapter and TypeScript types of the connection game.
//!
//! The engine is built for bot batches and carries no serde, so the wire
//! types live here and mirror the engine types:
//!
//! - [`Rules`], [`Die`] and [`Move`]: the rule switches, a die and a move.
//! - [`State`]: the whole game, to save it and to hand it to the bot
//!   Worker; [`State::to_game`] checks it.
//! - [`View`]: what an interface shows, with the legal moves.
//! - [`Transition`]: what a move captured, and the new view.
//!
//! A square is `row * 11 + col` on every board size, as in the engine: rows
//! count from the White side, and a smaller board uses the top-left corner
//! of the grid.

use conexao_engine as engine;
use conexao_engine::{Color, Game, Outcome, CELLS, SIZE};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub fn to_json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).expect("the wire types always serialize")
}

pub fn from_json<'a, T: Deserialize<'a>>(json: &'a str) -> Result<T, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

/// The highest value of a die.
const MAX_VALUE: u8 = 6;

fn color(index: usize) -> Color {
    if index == 0 {
        Color::White
    } else {
        Color::Black
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Goal {
    /// A chain of own dice from the own back row to the opponent's.
    Line,
    /// Any own die on the opponent's back row.
    Reach,
}

/// The rule switches of the RFC, as in `conexao_engine::Rules`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Rules {
    /// Columns and rows of the board, 5 to 11.
    pub size: u8,
    pub goal: Goal,
    /// Dice of each player, the starting die included.
    pub dice: u8,
    /// The value of the reserve dice, but those of `extra`.
    pub placed_value: u8,
    /// Reserve dice that start with another value, counted by value:
    /// `extra[3]` holds the 3s. They count within `dice`. Absent in the
    /// JSON, none.
    #[serde(default)]
    pub extra: [u8; 7],
    /// Whether the increase-and-block action exists.
    pub blocking: bool,
    /// Whether a blocking die may also go to the own half.
    pub block_home: bool,
    /// Whether a blocking die may come from the board once the reserve is
    /// empty.
    pub block_from_board: bool,
    /// Whether the fourth neighbor of a die 4 takes it out of the game, and
    /// a player who loses `dice - size + 1` dice loses the game.
    pub capture: bool,
    /// Whether a die taken from the board must land on a row nearer the
    /// goal. Absent in the JSON, off.
    #[serde(default)]
    pub advance: bool,
    /// Turns, summed over both players, after which the game is a draw.
    pub max_turns: u32,
}

impl From<engine::Rules> for Rules {
    fn from(r: engine::Rules) -> Rules {
        Rules {
            size: r.size as u8,
            goal: match r.goal {
                engine::Goal::Line => Goal::Line,
                engine::Goal::Reach => Goal::Reach,
            },
            dice: r.dice,
            placed_value: r.placed_value,
            extra: r.extra,
            blocking: r.blocking,
            block_home: r.block_home,
            block_from_board: r.block_from_board,
            capture: r.capture,
            advance: r.advance,
            max_turns: r.max_turns,
        }
    }
}

impl Rules {
    /// The engine rules, or why these are out of range.
    pub fn to_engine(self) -> Result<engine::Rules, String> {
        if !(5..=SIZE as u8).contains(&self.size) {
            return Err(format!("board size {} is not 5 to {SIZE}", self.size));
        }
        if !(2..=40).contains(&self.dice) {
            return Err(format!("{} dice per player is not 2 to 40", self.dice));
        }
        if !(1..=MAX_VALUE).contains(&self.placed_value) {
            return Err(format!(
                "placed value {} is not a die value",
                self.placed_value
            ));
        }
        if self.extra[0] != 0
            || self.extra.iter().map(|&n| u32::from(n)).sum::<u32>() >= u32::from(self.dice)
        {
            return Err("the extra dice are values 1 to 6, fewer than the reserve".into());
        }
        if self.max_turns == 0 {
            return Err("the turn limit must be positive".into());
        }
        Ok(engine::Rules {
            size: self.size as usize,
            goal: match self.goal {
                Goal::Line => engine::Goal::Line,
                Goal::Reach => engine::Goal::Reach,
            },
            dice: self.dice,
            placed_value: self.placed_value,
            extra: self.extra,
            blocking: self.blocking,
            block_home: self.block_home,
            block_from_board: self.block_from_board,
            capture: self.capture,
            advance: self.advance,
            max_turns: self.max_turns,
        })
    }
}

/// A die on the board: its owner (0 White, 1 Black) and its value.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Die {
    pub owner: u8,
    pub value: u8,
}

impl From<engine::Die> for Die {
    fn from(d: engine::Die) -> Die {
        Die {
            owner: d.owner.index() as u8,
            value: d.value,
        }
    }
}

/// Where a placed die comes from: a reserve die of the given value, or,
/// once the reserve is empty, the own die on the given square.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Source {
    Reserve(u8),
    Board(u8),
}

impl From<engine::Source> for Source {
    fn from(s: engine::Source) -> Source {
        match s {
            engine::Source::Reserve(v) => Source::Reserve(v),
            engine::Source::Board(p) => Source::Board(p),
        }
    }
}

impl From<Source> for engine::Source {
    fn from(s: Source) -> engine::Source {
        match s {
            Source::Reserve(v) => engine::Source::Reserve(v),
            Source::Board(p) => engine::Source::Board(p),
        }
    }
}

/// One action of a turn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum Move {
    /// Adds 1 to the die on `at`, of either color, up to 6.
    Increase { at: u8 },
    /// Puts an own die next to an own die.
    Place { to: u8, from: Source },
    /// Adds 1 to the die on `raise`, then puts an own die with value 1 on
    /// `to`, next to an opponent die, in the rows of the block, whatever
    /// the value it had.
    Block { raise: u8, to: u8, from: Source },
}

impl From<engine::Move> for Move {
    fn from(m: engine::Move) -> Move {
        match m {
            engine::Move::Increase(at) => Move::Increase { at },
            engine::Move::Place { to, from } => Move::Place {
                to,
                from: from.into(),
            },
            engine::Move::Block { raise, to, from } => Move::Block {
                raise,
                to,
                from: from.into(),
            },
        }
    }
}

impl From<Move> for engine::Move {
    fn from(m: Move) -> engine::Move {
        match m {
            Move::Increase { at } => engine::Move::Increase(at),
            Move::Place { to, from } => engine::Move::Place {
                to,
                from: from.into(),
            },
            Move::Block { raise, to, from } => engine::Move::Block {
                raise,
                to,
                from: from.into(),
            },
        }
    }
}

/// How a game ended.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum End {
    /// `winner` made the line, or reached the far row, by the goal of the
    /// rules.
    Goal { winner: u8 },
    /// The opponent of `winner` had no legal move.
    NoMove { winner: u8 },
    /// The turn limit came first.
    TurnLimit,
}

impl End {
    pub fn of(game: &Game) -> Option<End> {
        Some(match game.outcome? {
            Outcome::Draw => End::TurnLimit,
            Outcome::Win(c) if game.has_won(c) => End::Goal {
                winner: c.index() as u8,
            },
            Outcome::Win(c) => End::NoMove {
                winner: c.index() as u8,
            },
        })
    }

    pub fn winner(self) -> Option<u8> {
        match self {
            End::Goal { winner } | End::NoMove { winner } => Some(winner),
            End::TurnLimit => None,
        }
    }
}

/// The whole game, to save it and to rebuild it elsewhere.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct State {
    pub rules: Rules,
    /// `cells[row * 11 + col]`, 121 squares; those off a smaller board are
    /// `null`.
    pub cells: Vec<Option<Die>>,
    /// Dice left in each player's reserve, counted by value: `reserve[p][2]`
    /// holds the 2s of player `p`.
    pub reserve: [[u8; 7]; 2],
    /// Dice of each color captured so far.
    pub captured: [u8; 2],
    pub to_move: u8,
    /// Turns played, summed over both players.
    pub turns: u32,
    /// The winner (0 or 1), `null` while the game goes on or on a draw.
    pub winner: Option<u8>,
    /// Whether the game is over.
    pub over: bool,
}

impl State {
    pub fn of(game: &Game) -> State {
        State {
            rules: game.rules.into(),
            cells: (0..CELLS as u8)
                .map(|p| game.at(p).map(Die::from))
                .collect(),
            reserve: game.reserve,
            captured: game.captured,
            to_move: game.turn.index() as u8,
            turns: game.turns,
            winner: match game.outcome {
                Some(Outcome::Win(c)) => Some(c.index() as u8),
                _ => None,
            },
            over: game.outcome.is_some(),
        }
    }

    /// The game of this state, or why the engine could not have reached it.
    pub fn to_game(&self) -> Result<Game, String> {
        let rules = self.rules.to_engine()?;
        if self.cells.len() != CELLS {
            return Err(format!("{} cells, not {CELLS}", self.cells.len()));
        }
        if self.to_move > 1 || self.winner.is_some_and(|w| w > 1) {
            return Err("a player is 0 or 1".into());
        }
        if self.winner.is_some() && !self.over {
            return Err("a winner in a game not over".into());
        }
        if self.turns > rules.max_turns || (!self.over && self.turns == rules.max_turns) {
            return Err("the game is past its turn limit".into());
        }
        let mut game = Game::new(rules);
        let mut on_board = [0u32; 2];
        for (p, cell) in self.cells.iter().enumerate() {
            let (row, col) = (p / SIZE, p % SIZE);
            let die = match cell {
                None => None,
                Some(_) if row >= rules.size || col >= rules.size => {
                    return Err(format!("a die off the board, on square {p}"))
                }
                Some(d) if d.owner > 1 || !(1..=MAX_VALUE).contains(&d.value) => {
                    return Err(format!("not a die on square {p}"))
                }
                Some(d) => {
                    on_board[d.owner as usize] += 1;
                    Some(engine::Die {
                        owner: color(d.owner as usize),
                        value: d.value,
                    })
                }
            };
            game.set(p as u8, die);
        }
        for (i, board) in on_board.iter().enumerate() {
            if self.reserve[i][0] != 0 {
                return Err(format!("player {i} has a reserve die of value 0"));
            }
            let reserve: u32 = self.reserve[i].iter().map(|&n| u32::from(n)).sum();
            let total = board + reserve + u32::from(self.captured[i]);
            if total != u32::from(rules.dice) {
                return Err(format!("player {i} has {total} dice, not {}", rules.dice));
            }
        }
        game.reserve = self.reserve;
        game.captured = self.captured;
        game.turn = color(self.to_move as usize);
        game.turns = self.turns;
        game.outcome = match (self.over, self.winner) {
            (false, _) => None,
            (true, None) => Some(Outcome::Draw),
            (true, Some(w)) => Some(Outcome::Win(color(w as usize))),
        };
        Ok(game)
    }
}

/// What an interface shows.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct View {
    pub rules: Rules,
    /// `cells[row * 11 + col]`, as in [`State`].
    pub cells: Vec<Option<Die>>,
    /// Counted by value, as in [`State`].
    pub reserve: [[u8; 7]; 2],
    pub captured: [u8; 2],
    pub to_move: u8,
    pub turns: u32,
    /// The first and last row (from 0) where each player may put a
    /// blocking die.
    pub block_rows: [[u8; 2]; 2],
    /// The legal moves of the player to move, empty once the game is over.
    pub moves: Vec<Move>,
    pub end: Option<End>,
    pub winner: Option<u8>,
}

impl View {
    pub fn of(game: &Game) -> View {
        let state = State::of(game);
        let rows = |c: Color| {
            let r = game.block_rows(c);
            [*r.start() as u8, *r.end() as u8]
        };
        let end = End::of(game);
        View {
            rules: state.rules,
            cells: state.cells,
            reserve: state.reserve,
            captured: state.captured,
            to_move: state.to_move,
            turns: state.turns,
            block_rows: [rows(Color::White), rows(Color::Black)],
            moves: game.legal_moves().into_iter().map(Move::from).collect(),
            end,
            winner: end.and_then(End::winner),
        }
    }
}

/// A die that a move took out of the game.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Captured {
    pub at: u8,
    pub die: Die,
}

/// What a move did, to animate it, and the new view.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Transition {
    #[serde(rename = "move")]
    #[ts(rename = "move")]
    pub mv: Move,
    pub captured: Vec<Captured>,
    pub view: View,
}

impl Transition {
    /// The transition of `mv` from `before` to `after`: the dice gone from
    /// the board, besides the one moved from `from`.
    pub fn of(mv: Move, before: &Game, after: &Game) -> Transition {
        let from = match mv {
            Move::Place {
                from: Source::Board(p),
                ..
            }
            | Move::Block {
                from: Source::Board(p),
                ..
            } => Some(p),
            _ => None,
        };
        let captured = (0..CELLS as u8)
            .filter(|&p| Some(p) != from && after.at(p).is_none())
            .filter_map(|p| {
                before.at(p).map(|d| Captured {
                    at: p,
                    die: d.into(),
                })
            })
            .collect();
        Transition {
            mv,
            captured,
            view: View::of(after),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use conexao_engine::pos;

    fn capture_rules() -> engine::Rules {
        engine::Rules {
            capture: true,
            ..engine::Rules::default()
        }
    }

    #[test]
    fn the_state_round_trips_and_is_checked() {
        let mut game = Game::new(capture_rules());
        game.play(engine::Move::Place {
            to: pos(1, 5),
            from: engine::Source::Reserve(2),
        })
        .unwrap();
        let json = to_json(&State::of(&game));
        let back: State = from_json(&json).unwrap();
        assert_eq!(back.to_game().unwrap(), game);

        let mut broken = back.clone();
        broken.reserve[0][2] += 1;
        assert!(broken.to_game().unwrap_err().contains("dice"));
        let mut off = back.clone();
        off.rules.size = 9;
        off.cells[pos(10, 5) as usize] = None;
        off.cells[pos(9, 9) as usize] = Some(Die { owner: 1, value: 1 });
        assert!(off.to_game().unwrap_err().contains("off the board"));
    }

    #[test]
    fn moves_cross_as_tagged_json() {
        let block: Move =
            from_json(r#"{"kind":"block","raise":5,"to":60,"from":{"reserve":2}}"#).unwrap();
        assert_eq!(
            engine::Move::from(block),
            engine::Move::Block {
                raise: 5,
                to: 60,
                from: engine::Source::Reserve(2)
            }
        );
        assert_eq!(
            to_json(&Move::Increase { at: 3 }),
            r#"{"kind":"increase","at":3}"#
        );
    }

    #[test]
    fn the_view_lists_the_legal_moves_and_the_block_rows() {
        let game = Game::new(engine::Rules {
            size: 9,
            ..engine::Rules::default()
        });
        let view = View::of(&game);
        assert_eq!(view.moves.len(), game.legal_moves().len());
        assert_eq!(view.block_rows, [[3, 5], [3, 5]]);
        assert_eq!(view.end, None);
    }

    #[test]
    fn a_capture_shows_in_the_transition() {
        // A placed 3, so that it takes the three neighbors it lands next to.
        let mut game = Game::new(engine::Rules {
            placed_value: 3,
            ..capture_rules()
        });
        for p in 0..CELLS as u8 {
            game.set(p, None);
        }
        let black = |value| {
            Some(engine::Die {
                owner: Color::Black,
                value,
            })
        };
        let white = |value| {
            Some(engine::Die {
                owner: Color::White,
                value,
            })
        };
        // A black 4 with three neighbors; White places the fourth.
        game.set(pos(5, 5), black(4));
        game.set(pos(4, 4), white(3));
        game.set(pos(4, 5), black(5));
        game.set(pos(4, 6), black(3));
        game.reserve = [[0, 0, 0, 14, 0, 0, 0], [0, 0, 0, 12, 0, 0, 0]];
        let mv = Move::Place {
            to: pos(5, 4),
            from: Source::Reserve(3),
        };
        let before = game.clone();
        game.play(mv.into()).unwrap();
        let t = Transition::of(mv, &before, &game);
        assert_eq!(
            t.captured,
            vec![Captured {
                at: pos(5, 5),
                die: Die { owner: 1, value: 4 }
            }]
        );
        assert_eq!(t.view.captured, [0, 1]);
    }
}
