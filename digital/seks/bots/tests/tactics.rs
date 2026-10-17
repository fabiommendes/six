//! The tactical suite of `tests/positions/` (R3 of
//! `dev/issues/bots-do-seks.md`): the default `ab` must solve every
//! position.
//!
//! A position file has a `# kind:` line, a `# to-move:` line (`white` or
//! `black`) and the board diagram of the engine. The kinds, checked by what
//! the chosen move does rather than by a fixed answer:
//!
//! - `win1`: the side to move wins on this move.
//! - `defend`: the opponent threatens to win on its next move; after the
//!   chosen move it no longer can.
//! - `win2`: the side to move cannot win at once but has a move after
//!   which every reply loses on the next move; the chosen move must be one.
//! - `capture`: like `defend`, but no move blocks the threat: only a
//!   capture of the threatening die stops it.
//!
//! `cargo test -p seks-bots --test tactics -- --ignored` regenerates the
//! files from games of `greedy` against `random`.

use std::path::{Path, PathBuf};

use seks_bots::by_name;
use seks_bots::game::play;
use seks_bots::tactics::can_win_now;
use seks_engine::{captures, legal_commands, Command, Engine, GameState, Outcome, Side};

fn suite_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/positions")
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    Win1,
    Defend,
    Win2,
    Capture,
}

impl Kind {
    const ALL: [Kind; 4] = [Kind::Win1, Kind::Defend, Kind::Win2, Kind::Capture];

    fn name(self) -> &'static str {
        match self {
            Kind::Win1 => "win1",
            Kind::Defend => "defend",
            Kind::Win2 => "win2",
            Kind::Capture => "capture",
        }
    }
}

fn wins_now(state: &GameState, command: Command) -> bool {
    let me = state.to_move();
    matches!(
        Engine::step(state, command).unwrap().outcome(),
        Some(Outcome::Win { winner, .. }) if winner == me
    )
}

/// After `command`, the opponent has no immediate win.
fn stops_the_threat(state: &GameState, command: Command) -> bool {
    let next = Engine::step(state, command).unwrap();
    wins_now(state, command)
        || (next.outcome().is_none() && !can_win_now(next.board(), next.to_move()))
}

/// After `command`, every reply lets the side to move win at once.
fn forces_a_win(state: &GameState, command: Command) -> bool {
    let next = Engine::step(state, command).unwrap();
    if next.outcome().is_some() {
        return wins_now(state, command);
    }
    legal_commands(&next).into_iter().all(|reply| {
        let after = Engine::step(&next, reply).unwrap();
        after.outcome().is_none() && can_win_now(after.board(), after.to_move())
    })
}

/// Whether `command` solves a position of `kind`.
fn solves(kind: Kind, state: &GameState, command: Command) -> bool {
    match kind {
        Kind::Win1 => wins_now(state, command),
        Kind::Defend | Kind::Capture => stops_the_threat(state, command),
        Kind::Win2 => forces_a_win(state, command),
    }
}

/// Whether `state` is a position of `kind`, and a hard one: few moves solve
/// it.
fn is_puzzle(kind: Kind, state: &GameState) -> bool {
    let me = state.to_move();
    let threatened = can_win_now(state.board(), me.opponent());
    let can_win = can_win_now(state.board(), me);
    let commands = legal_commands(state);
    let solutions: Vec<Command> = commands
        .iter()
        .copied()
        .filter(|&c| solves(kind, state, c))
        .collect();
    let few = !solutions.is_empty() && solutions.len() <= 4;
    match kind {
        Kind::Win1 => can_win && !threatened,
        Kind::Defend => !can_win && threatened && few,
        Kind::Capture => {
            !can_win && threatened && few && solutions.iter().all(|&c| captures(state, c) > 0)
        }
        Kind::Win2 => !can_win && !threatened && few,
    }
}

fn read_suite() -> Vec<(String, Kind, GameState)> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(suite_dir())
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "txt"))
        .collect();
    files.sort();
    files
        .into_iter()
        .map(|path| {
            let text = std::fs::read_to_string(&path).unwrap();
            let field = |name: &str| {
                text.lines()
                    .find_map(|line| line.strip_prefix(&format!("# {name}: ")))
                    .unwrap_or_else(|| panic!("{}: no {name}", path.display()))
                    .trim()
                    .to_string()
            };
            let kind_name = field("kind");
            let kind = *Kind::ALL
                .iter()
                .find(|k| k.name() == kind_name)
                .unwrap_or_else(|| panic!("{}: unknown kind", path.display()));
            let side = match field("to-move").as_str() {
                "white" => Side::White,
                "black" => Side::Black,
                other => panic!("{}: bad side {other}", path.display()),
            };
            let diagram: String = text
                .lines()
                .filter(|line| !line.starts_with('#'))
                .collect::<Vec<_>>()
                .join("\n");
            let state = GameState::from_diagram(&diagram, side).unwrap();
            let name = path.file_name().unwrap().to_string_lossy().into_owned();
            (name, kind, state)
        })
        .collect()
}

#[test]
fn the_suite_has_30_positions_of_every_kind_and_each_is_what_it_says() {
    let suite = read_suite();
    assert!(suite.len() >= 30, "{} positions", suite.len());
    for kind in Kind::ALL {
        assert!(suite.iter().any(|(_, k, _)| *k == kind), "no {kind:?}");
    }
    for (name, kind, state) in &suite {
        assert!(is_puzzle(*kind, state), "{name} is not a {kind:?} position");
    }
}

#[test]
fn the_default_ab_solves_every_position() {
    let mut bot = by_name("ab").unwrap();
    let mut failed = Vec::new();
    for (name, kind, state) in read_suite() {
        bot.new_game();
        let decision = bot.choose(&state, 0);
        if !solves(kind, &state, decision.command) {
            failed.push(format!("{name}: {}", decision.command));
        }
    }
    assert!(failed.is_empty(), "unsolved: {failed:?}");
}

#[test]
#[ignore = "writes tests/positions/; run on purpose"]
fn generate_the_suite() {
    const PER_KIND: usize = 8;
    let mut found: Vec<(Kind, GameState)> = Vec::new();
    let mut seed = 0;
    while Kind::ALL
        .iter()
        .any(|&k| found.iter().filter(|(f, _)| *f == k).count() < PER_KIND)
    {
        let mut greedy = by_name("greedy").unwrap();
        let mut random = by_name("random").unwrap();
        let game = play(
            [greedy.as_mut(), random.as_mut()],
            &GameState::initial(),
            seed,
            400,
        )
        .unwrap();
        seed += 1;
        let mut state = game.start;
        for command in game.commands() {
            if state.outcome().is_some() {
                break;
            }
            for kind in Kind::ALL {
                let have = found.iter().filter(|(f, _)| *f == kind).count();
                if have < PER_KIND && is_puzzle(kind, &state) {
                    found.push((kind, GameState::from_board(*state.board(), state.to_move())));
                    break;
                }
            }
            state = Engine::step(&state, command).unwrap();
        }
    }
    let dir = suite_dir();
    for kind in Kind::ALL {
        for (i, (_, state)) in found.iter().filter(|(k, _)| *k == kind).enumerate() {
            let side = match state.to_move() {
                Side::White => "white",
                Side::Black => "black",
            };
            let text = format!(
                "# kind: {}\n# to-move: {side}\n{}\n",
                kind.name(),
                state.board()
            );
            std::fs::write(dir.join(format!("{}-{:02}.txt", kind.name(), i + 1)), text).unwrap();
        }
    }
}
