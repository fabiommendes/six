//! Batches of games between two bots, played on threads, and their
//! statistics.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use conexao_engine::{Color, Game, Move, Outcome, Rules, Source};

use crate::by_name;

pub struct Config {
    /// The two bots; bot 0 plays White unless the seat is swapped.
    pub bots: [String; 2],
    /// Seeds; with rotation each seed is played twice, once per seating.
    pub seeds: u64,
    pub first_seed: u64,
    pub rotate: bool,
    pub threads: usize,
    pub rules: Rules,
}

/// One game, seen from the bots: every per-bot field is indexed by bot.
#[derive(Clone, Debug, Default)]
pub struct Record {
    /// The bot that won, `None` on a draw.
    pub winner: Option<usize>,
    pub white_won: bool,
    pub black_won: bool,
    /// The bot that played White.
    pub white: usize,
    pub turns: u32,
    /// Moves of each bot, by kind: increase, place, block.
    pub actions: [[u32; 3]; 2],
    /// Dice of each bot taken from the board.
    pub moved: [u32; 2],
    /// The turn the first bot ran out of reserve, if any did.
    pub reserve_out: Option<u32>,
    /// Whether the winner crossed in the fewest moves, one die per row.
    pub straight: bool,
    /// Sides left with no path to their goal at the end, walled off.
    pub walled: u8,
    /// Dice each bot lost to captures.
    pub lost: [u8; 2],
    /// Whether the loser lost to the capture limit, not to a line.
    pub by_capture: bool,
}

pub fn play(config: &Config, seed: u64, swap: bool) -> Result<Record, String> {
    let white = swap as usize;
    let bot_of = |c: Color| if c == Color::White { white } else { 1 - white };
    let mut bots = [
        by_name(&config.bots[0], seed.wrapping_mul(31))?,
        by_name(&config.bots[1], seed.wrapping_mul(37))?,
    ];
    let mut game = Game::new(config.rules);
    let mut record = Record {
        white,
        ..Record::default()
    };
    while game.outcome.is_none() {
        let bot = bot_of(game.turn);
        let mv = bots[bot].choose(&game);
        let (kind, from) = match mv {
            Move::Increase(_) => (0, None),
            Move::Place { from, .. } => (1, Some(from)),
            Move::Block { from, .. } => (2, Some(from)),
        };
        record.actions[bot][kind] += 1;
        record.moved[bot] += matches!(from, Some(Source::Board(_))) as u32;
        game.play(mv)?;
        if record.reserve_out.is_none()
            && [Color::White, Color::Black]
                .iter()
                .any(|&c| game.reserve_size(c) == 0)
        {
            record.reserve_out = Some(game.turns);
        }
    }
    record.turns = game.turns;
    for c in [Color::White, Color::Black] {
        record.lost[bot_of(c)] = game.captured[c.index()];
    }
    record.walled = [Color::White, Color::Black]
        .iter()
        .filter(|&&c| crate::distance(&game, c).is_none())
        .count() as u8;
    if let Some(Outcome::Win(c)) = game.outcome {
        record.winner = Some(bot_of(c));
        record.white_won = c == Color::White;
        record.black_won = c == Color::Black;
        record.by_capture = !game.has_won(c)
            && game
                .capture_limit()
                .is_some_and(|limit| game.captured[c.other().index()] >= limit);
        let moves: u32 = record.actions[bot_of(c)].iter().sum();
        record.straight = moves as usize == config.rules.size - 1;
    }
    Ok(record)
}

/// Plays the batch on `config.threads` threads, in no fixed order.
pub fn run(config: &Config) -> Result<Vec<Record>, String> {
    for name in &config.bots {
        by_name(name, 0)?;
    }
    let seatings = if config.rotate { 2 } else { 1 };
    let jobs = config.seeds * seatings;
    let next = AtomicU64::new(0);
    let records = Mutex::new(Vec::new());
    let error = Mutex::new(None);
    std::thread::scope(|scope| {
        for _ in 0..config.threads.max(1) {
            scope.spawn(|| loop {
                let job = next.fetch_add(1, Ordering::Relaxed);
                if job >= jobs {
                    break;
                }
                let seed = config.first_seed + job / seatings;
                match play(config, seed, job % seatings == 1) {
                    Ok(record) => records.lock().unwrap().push(record),
                    Err(e) => *error.lock().unwrap() = Some(e),
                }
            });
        }
    });
    match error.into_inner().unwrap() {
        Some(e) => Err(e),
        None => Ok(records.into_inner().unwrap()),
    }
}

/// The text summary of a batch.
pub fn summary(config: &Config, records: &[Record]) -> String {
    use std::fmt::Write;
    let mut out = String::new();
    let games = records.len().max(1) as f64;
    let pct = |x: f64| 100.0 * x / games;
    let count = |f: &dyn Fn(&Record) -> bool| records.iter().filter(|r| f(r)).count() as f64;
    let draws = count(&|r| r.winner.is_none());
    let _ = writeln!(out, "{} games, {:?}", records.len(), config.rules);
    for (bot, name) in config.bots.iter().enumerate() {
        let per = |k: usize| {
            records
                .iter()
                .map(|r| r.actions[bot][k] as f64)
                .sum::<f64>()
                / games
        };
        let moved = records.iter().map(|r| r.moved[bot] as f64).sum::<f64>() / games;
        let lost = records.iter().map(|r| r.lost[bot] as f64).sum::<f64>() / games;
        let _ = writeln!(
            out,
            "  bot {bot} {name:<9} wins {:5.1}%  per game: increases {:4.1}  places {:4.1}  blocks {:4.1}  from the board {:4.1}  lost {:4.1}",
            pct(count(&|r| r.winner == Some(bot))),
            per(0),
            per(1),
            per(2),
            moved,
            lost,
        );
    }
    let white = count(&|r| r.white_won);
    let decided = (white + count(&|r| r.black_won)).max(1.0);
    let _ = writeln!(
        out,
        "  draws {:.1}%, White wins {:.1}% of decided games",
        pct(draws),
        100.0 * white / decided
    );
    let _ = writeln!(
        out,
        "  won by the capture limit: {:.1}%",
        pct(count(&|r| r.by_capture))
    );
    let _ = writeln!(
        out,
        "  won in the fewest moves, one die per row: {:.1}%",
        pct(count(&|r| r.straight))
    );
    let draws_walled = |n: u8| count(&|r| r.winner.is_none() && r.walled == n);
    let _ = writeln!(
        out,
        "  draws by sides walled off at the end: none {:.1}%, one {:.1}%, both {:.1}%",
        pct(draws_walled(0)),
        pct(draws_walled(1)),
        pct(draws_walled(2))
    );
    let mut turns: Vec<u32> = records.iter().map(|r| r.turns).collect();
    turns.sort_unstable();
    let at = |q: f64| turns[((turns.len() - 1) as f64 * q) as usize];
    let _ = writeln!(
        out,
        "  turns: mean {:.1}, p10 {}, median {}, p90 {}",
        turns.iter().map(|&t| t as f64).sum::<f64>() / games,
        at(0.1),
        at(0.5),
        at(0.9)
    );
    let out_games: Vec<u32> = records.iter().filter_map(|r| r.reserve_out).collect();
    let _ = writeln!(
        out,
        "  a reserve ran out in {:.1}% of games, at turn {:.1} on average",
        pct(out_games.len() as f64),
        out_games.iter().map(|&t| t as f64).sum::<f64>() / out_games.len().max(1) as f64
    );
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(bots: [&str; 2], seeds: u64) -> Config {
        Config {
            bots: bots.map(String::from),
            seeds,
            first_seed: 1,
            rotate: true,
            threads: 2,
            rules: Rules::default(),
        }
    }

    #[test]
    fn every_bot_plays_legal_games_to_the_end() {
        for name in crate::BOTS {
            let mut config = config([name, "random"], 2);
            config.rules.max_turns = 60;
            let records = run(&config).unwrap();
            assert_eq!(records.len(), 4);
        }
    }

    #[test]
    fn greedy_beats_random() {
        let records = run(&config(["greedy", "random"], 10)).unwrap();
        let wins = records.iter().filter(|r| r.winner == Some(0)).count();
        assert!(wins >= 15, "{wins}");
    }
}
