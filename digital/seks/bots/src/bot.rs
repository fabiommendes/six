//! The bots: each picks one of the legal commands of a position.

use seks_engine::{legal_commands, Board, Command, Engine, GameState, Outcome, Side};

use crate::ab::AlphaBeta;
use crate::rng::Rng;
use crate::tactics::{can_win_now, relative_row};

/// What a bot chose and what the choice cost.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Decision {
    pub command: Command,
    /// Positions the bot looked at.
    pub nodes: u64,
    /// Depth of the last full search, 0 for a bot that does not search.
    pub depth: u32,
    /// The score of the choice, from the side to move, for a bot that scores.
    pub score: Option<i32>,
}

impl Decision {
    fn plain(command: Command) -> Decision {
        Decision {
            command,
            nodes: 0,
            depth: 0,
            score: None,
        }
    }
}

/// A player of Seks. `seed` drives every random choice, so a decision is
/// reproducible.
pub trait Bot {
    /// The spec that [`by_name`] reads back into this bot.
    fn name(&self) -> String;

    /// Forgets what the bot kept from earlier positions (tables of a
    /// search). A batch calls it before every game, so a game does not
    /// depend on the games played before it.
    fn new_game(&mut self) {}

    /// One of the legal commands of `state`, which is not over.
    fn choose(&mut self, state: &GameState, seed: u64) -> Decision;
}

/// The bot `spec` stands for:
///
/// - `random`: a uniform choice among the legal commands.
/// - `greedy`: one ply of lookahead; wins when it can, otherwise maximizes
///   material and advance, and avoids moves that let the opponent win on
///   the next move.
/// - `ab[:ARGS]`: alpha-beta search ([`crate::search`]) with the linear
///   evaluation ([`crate::eval`]). `ARGS` are comma separated, in any order:
///   - `depth=D`: deepest iteration;
///   - `nodes=N`: nodes per move (the first iteration always finishes);
///   - `ms=T`: milliseconds per move (native only);
///   - `tt=MIB`: transposition table size, 16 MiB by default;
///   - `noise=E`: chooses at random among the root moves at most `E` below
///     the best score, 0 by default;
///   - `contempt=C`: a draw scores `-C` for the bot instead of 0, so it
///     plays for a win; [`AlphaBeta::DEFAULT_CONTEMPT`] by default;
///   - `weights=@FILE`: the weights file, `weights/default.json` by default;
///   - `nmp=0`, `lmr=0`, `prune=0`: turn off null-move pruning, late move
///     reductions, or futility and late move pruning, for experiments.
///
///   `ab` with no `depth`, `nodes` or `ms` is the default level,
///   `ab:nodes=N0` with N0 = [`AlphaBeta::DEFAULT_NODES`].
pub fn by_name(spec: &str) -> Result<Box<dyn Bot + Send>, String> {
    let (name, args) = spec.split_once(':').unwrap_or((spec, ""));
    match (name, args) {
        ("random", "") if spec == "random" => Ok(Box::new(Random)),
        ("greedy", "") if spec == "greedy" => Ok(Box::new(Greedy)),
        ("ab", _) if spec == "ab" || !args.is_empty() => {
            Ok(Box::new(AlphaBeta::from_args(spec, args)?))
        }
        _ => Err(format!("unknown bot {spec:?}")),
    }
}

/// Plays a uniformly random legal command.
#[derive(Clone, Copy, Debug, Default)]
pub struct Random;

impl Bot for Random {
    fn name(&self) -> String {
        "random".into()
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Decision {
        let commands = legal_commands(state);
        assert!(!commands.is_empty(), "the game is over");
        Decision::plain(commands[Rng::new(seed).below(commands.len())])
    }
}

/// One ply of lookahead with a material and advance score
/// ([`Greedy::score`]); ties are broken at random.
#[derive(Clone, Copy, Debug, Default)]
pub struct Greedy;

impl Greedy {
    /// Score of an immediate win.
    pub const WIN: i32 = 1_000_000;
    /// Score of a die on the board.
    const DIE: i32 = 100;
    /// Score of each row a die advanced from its back row.
    const ROW: i32 = 4;

    /// Material and advance of `side` minus those of its opponent.
    pub fn score(board: &Board, side: Side) -> i32 {
        board
            .dice()
            .map(|(cell, die)| {
                let points = Self::DIE + Self::ROW * (relative_row(cell, die.side()) as i32 - 1);
                if die.side() == side {
                    points
                } else {
                    -points
                }
            })
            .sum()
    }

    /// The score of `command` for the side to move in `state`.
    fn rate(state: &GameState, command: Command) -> i32 {
        let me = state.to_move();
        let next = Engine::step(state, command).expect("a legal command");
        match next.outcome() {
            Some(Outcome::Win { winner, .. }) if winner == me => Self::WIN,
            Some(Outcome::Win { .. }) => -Self::WIN,
            Some(Outcome::Draw(_)) => 0,
            None if can_win_now(next.board(), me.opponent()) => -Self::WIN / 2,
            None => Self::score(next.board(), me),
        }
    }
}

impl Bot for Greedy {
    fn name(&self) -> String {
        "greedy".into()
    }

    fn choose(&mut self, state: &GameState, seed: u64) -> Decision {
        let commands = legal_commands(state);
        assert!(!commands.is_empty(), "the game is over");
        let scores: Vec<i32> = commands.iter().map(|&c| Self::rate(state, c)).collect();
        let best = *scores.iter().max().expect("at least one command");
        let ties: Vec<usize> = (0..commands.len()).filter(|&i| scores[i] == best).collect();
        let pick = ties[Rng::new(seed).below(ties.len())];
        Decision {
            command: commands[pick],
            nodes: commands.len() as u64,
            depth: 1,
            score: Some(best),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn by_name_accepts_the_documented_specs_and_rejects_others() {
        for spec in [
            "random",
            "greedy",
            "ab",
            "ab:depth=3",
            "ab:nodes=5000",
            "ab:ms=100",
            "ab:tt=1",
            "ab:noise=20",
            "ab:contempt=50",
            "ab:depth=4,nodes=100,tt=2,noise=0,ms=50",
            "ab:weights=@weights/hand.json",
            "ab:nmp=0,lmr=1",
        ] {
            assert_eq!(by_name(spec).unwrap().name(), spec);
        }
        for spec in [
            "",
            "rand",
            "greedy:3",
            "Random",
            "ab:",
            "ab:depth=0",
            "ab:depth=x",
            "ab:nodes=-1",
            "ab:noise=-5",
            "ab:contempt=-1",
            "ab:tt=0",
            "ab:speed=3",
            "ab:depth",
            "ab:weights=weights/hand.json",
            "ab:weights=@missing.json",
            "ab:nmp=2",
            "abc",
        ] {
            assert!(by_name(spec).is_err(), "{spec}");
        }
    }

    #[test]
    fn greedy_takes_a_win_and_blocks_a_threat() {
        let state = GameState::from_diagram(
            "
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. b6
            .. .. .. .. .. .. .. .. .. w1 ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. w2 ..
            .. .. .. w1 .. .. .. .. .. .. ..
            ",
            Side::Black,
        )
        .unwrap();
        // b6 at k6 reaches k1 (5 rows): the Blacks win at once.
        let decision = Greedy.choose(&state, 0);
        assert_eq!(decision.command.to_string(), "k6-k1");
        // With the Whites to move, w1 at j5 blocks the diagonal of b6 and
        // only w2 can block the k-file.
        let white = GameState::from_board(*state.board(), Side::White);
        let decision = Greedy.choose(&white, 0);
        let next = Engine::step(&white, decision.command).unwrap();
        assert!(
            !can_win_now(next.board(), Side::Black),
            "{}",
            decision.command
        );
    }

    #[test]
    fn random_is_reproducible_by_seed() {
        let state = GameState::initial();
        assert_eq!(Random.choose(&state, 9), Random.choose(&state, 9));
    }
}
