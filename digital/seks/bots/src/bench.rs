//! A fixed benchmark: the speed of the move generator and of the search on
//! the same positions, for comparing builds and targets (native and WASM).

use std::time::Instant;

use seks_engine::{legal_commands_into, Command, Engine, GameState};

use crate::bot::by_name;
use crate::openings::generate;

/// Positions of the benchmark: 16 openings of 12 random plies.
pub fn positions() -> Vec<GameState> {
    generate(16, 12, 2024, |_| true)
        .iter()
        .map(|opening| opening.state().expect("a generated opening"))
        .collect()
}

/// What the benchmark measured.
#[derive(Clone, Debug)]
pub struct Report {
    pub perft_leaves: u64,
    pub perft_seconds: f64,
    pub search_nodes: u64,
    pub search_seconds: f64,
    pub mean_depth: f64,
}

impl Report {
    pub fn perft_rate(&self) -> f64 {
        self.perft_leaves as f64 / self.perft_seconds
    }

    pub fn search_rate(&self) -> f64 {
        self.search_nodes as f64 / self.search_seconds
    }
}

impl std::fmt::Display for Report {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(
            f,
            "perft 3: {} leaves in {:.2} s, {:.0} leaves/s",
            self.perft_leaves,
            self.perft_seconds,
            self.perft_rate()
        )?;
        write!(
            f,
            "search: {} nodes in {:.2} s, {:.0} nodes/s, mean depth {:.2}",
            self.search_nodes,
            self.search_seconds,
            self.search_rate(),
            self.mean_depth
        )
    }
}

/// Leaves of the tree of legal commands `depth` plies deep.
pub fn perft(state: &GameState, depth: u32, buffers: &mut [Vec<Command>]) -> u64 {
    let (commands, rest) = buffers.split_first_mut().expect("a buffer per ply");
    legal_commands_into(state, commands);
    if depth <= 1 {
        return commands.len() as u64;
    }
    commands
        .iter()
        .map(|&command| {
            let next = Engine::step(state, command).expect("a legal command");
            perft(&next, depth - 1, rest)
        })
        .sum()
}

/// Runs perft 3 and one search with `bot` on each position.
pub fn run(bot: &str) -> Result<Report, String> {
    let positions = positions();
    let mut buffers = (0..3).map(|_| Vec::with_capacity(256)).collect::<Vec<_>>();
    let clock = Instant::now();
    let perft_leaves = positions
        .iter()
        .map(|state| perft(state, 3, &mut buffers))
        .sum();
    let perft_seconds = clock.elapsed().as_secs_f64();
    let mut bot = by_name(bot)?;
    let (mut nodes, mut depth) = (0, 0);
    let clock = Instant::now();
    for state in &positions {
        bot.new_game();
        let decision = bot.choose(state, 0);
        nodes += decision.nodes;
        depth += decision.depth;
    }
    Ok(Report {
        perft_leaves,
        perft_seconds,
        search_nodes: nodes,
        search_seconds: clock.elapsed().as_secs_f64(),
        mean_depth: depth as f64 / positions.len() as f64,
    })
}
