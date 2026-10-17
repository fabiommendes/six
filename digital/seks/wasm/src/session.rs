//! A game in progress on this device, in plain Rust: the state and the undo
//! stack. `Game` (in `lib.rs`) is the JavaScript face of this type, which
//! keeps the rules of the session testable without a JavaScript host.

use seks_engine::wire::{self, DieOptions, Transition, View};
use seks_engine::{legal_commands, Cell, Command, Engine, GameState, Side};

/// The state of a game and the states before each play, oldest first.
#[derive(Clone, Debug)]
pub(crate) struct Session {
    state: GameState,
    /// The states before each play that may still be undone.
    undo: Vec<GameState>,
}

impl Session {
    /// A new game: the initial position, the Whites to move.
    pub(crate) fn new() -> Session {
        Session::from_game_state(Engine::new_game())
    }

    /// A session that continues from `state`, with nothing to undo.
    pub(crate) fn from_game_state(state: GameState) -> Session {
        Session {
            state,
            undo: Vec::new(),
        }
    }

    /// A session from the JSON of a `State`, which the engine checks.
    pub(crate) fn from_json(json: &str) -> Result<Session, String> {
        wire::state_from_json(json)
            .map(Session::from_game_state)
            .map_err(|error| error.to_string())
    }

    /// A session from a text diagram of the board (see
    /// `seks_engine::diagram`) with `to_move` (`"white"` or `"black"`) to
    /// play, with nothing to undo.
    pub(crate) fn from_diagram(diagram: &str, to_move: &str) -> Result<Session, String> {
        let to_move = match to_move {
            "white" => Side::White,
            "black" => Side::Black,
            other => {
                return Err(format!(
                    "unknown side {other:?}, use \"white\" or \"black\""
                ))
            }
        };
        GameState::from_diagram(diagram, to_move)
            .map(Session::from_game_state)
            .map_err(|error| error.to_string())
    }

    pub(crate) fn state(&self) -> &GameState {
        &self.state
    }

    pub(crate) fn view(&self) -> View {
        View::new(&self.state)
    }

    /// Where the die in `cell` (notation) can go and whether it can be
    /// incremented.
    pub(crate) fn options(&self, cell: &str) -> Result<DieOptions, String> {
        let cell: Cell = cell.parse().map_err(|error| format!("{error}"))?;
        Ok(DieOptions::new(&self.state, cell))
    }

    /// Every legal command of the side to move, in the notation.
    pub(crate) fn legal_commands(&self) -> Vec<String> {
        legal_commands(&self.state)
            .iter()
            .map(Command::to_string)
            .collect()
    }

    /// Plays `command` (notation). A refused command changes nothing.
    pub(crate) fn command(&mut self, command: &str) -> Result<Transition, String> {
        let command: Command = command.parse().map_err(|error| format!("{error}"))?;
        let transition =
            Engine::command(&self.state, command).map_err(|error| error.to_string())?;
        self.undo.push(self.state);
        self.state = transition.state;
        Ok(Transition::new(&transition))
    }

    pub(crate) fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    /// Takes back the last play and returns the view of the game then.
    pub(crate) fn undo(&mut self) -> Result<View, String> {
        self.state = self.undo.pop().ok_or("there is no play to undo")?;
        Ok(self.view())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use seks_engine::wire::{Event, Outcome, Side, WinReason};

    fn play_all(session: &mut Session, commands: &[&str]) {
        for command in commands {
            session.command(command).expect(command);
        }
    }

    #[test]
    fn a_new_game_starts_with_the_whites_and_nothing_to_undo() {
        let session = Session::new();
        let view = session.view();
        assert_eq!(view.to_move, Side::White);
        // Per side: 6 dice on the back row and 10 on the front row.
        assert_eq!(view.dice.len(), 32);
        assert!(!session.can_undo());
    }

    #[test]
    fn a_command_returns_the_events_and_the_new_view() {
        let mut session = Session::new();
        let transition = session.command("b2-b4").unwrap();
        assert_eq!(transition.events.len(), 1);
        assert!(matches!(
            transition.events[0],
            Event::Moved { value: 2, .. }
        ));
        assert_eq!(transition.view.to_move, Side::Black);
        assert_eq!(transition.view, session.view());
    }

    #[test]
    fn a_refused_command_changes_nothing() {
        let mut session = Session::new();
        let before = *session.state();
        for text in ["b2-b9", "a1+x", "z9-a1", "", "a1-a2"] {
            assert!(session.command(text).is_err(), "{text}");
        }
        assert_eq!(*session.state(), before);
        assert!(!session.can_undo());
    }

    #[test]
    fn undo_restores_the_state_one_play_at_a_time() {
        let mut session = Session::new();
        let start = *session.state();
        play_all(&mut session, &["b2-b4", "b10-b8"]);
        let after_first = {
            let mut other = Session::new();
            other.command("b2-b4").unwrap();
            *other.state()
        };
        assert_eq!(session.undo().unwrap().to_move, Side::Black);
        assert_eq!(*session.state(), after_first);
        session.undo().unwrap();
        assert_eq!(*session.state(), start);
        assert!(session.undo().is_err());
    }

    #[test]
    fn undo_takes_back_a_play_that_ended_the_game() {
        let state = GameState::from_diagram(
            "
            .. .. .. .. .. .. .. .. .. .. b1
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. w6 .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            w1 .. .. .. .. .. .. .. .. .. ..
            ",
            seks_engine::Side::White,
        )
        .unwrap();
        let mut session = Session::from_game_state(state);
        let transition = session.command("e5-e11").unwrap();
        assert_eq!(
            transition.view.outcome,
            Some(Outcome::Win {
                winner: Side::White,
                reason: WinReason::BackRow
            })
        );
        assert!(session.command("a1-a2").is_err());
        assert!(session.legal_commands().is_empty());
        let view = session.undo().unwrap();
        assert_eq!(view.outcome, None);
        assert!(!session.legal_commands().is_empty());
    }

    #[test]
    fn a_session_starts_from_a_diagram() {
        let diagram = "
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. w6 .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. .. .. ..
            .. .. .. .. .. .. .. .. b2 .. ..
            w1 .. .. .. .. .. .. .. .. .. ..
            ";
        let session = Session::from_diagram(diagram, "black").unwrap();
        let view = session.view();
        assert_eq!(view.to_move, Side::Black);
        assert_eq!(view.dice.len(), 3);
        assert_eq!(view.plies_without_capture, 0);
        assert!(!session.can_undo());
        assert!(Session::from_diagram(diagram, "green").is_err());
        assert!(Session::from_diagram("..", "white").is_err());
    }

    #[test]
    fn options_come_from_the_engine() {
        let session = Session::new();
        let options = session.options("b2").unwrap();
        assert!(options.can_increment);
        // b3, b4, a3, c3, d4 and b1.
        assert_eq!(options.moves.len(), 6);
        assert!(session.options("z1").is_err());
        let enemy = session.options("b10").unwrap();
        assert!(enemy.moves.is_empty() && !enemy.can_increment);
    }

    #[test]
    fn the_session_continues_from_a_saved_state() {
        let mut session = Session::new();
        play_all(&mut session, &["b2-b4", "b10-b8", "b4-b2"]);
        let json = wire::to_json(&wire::State::from(session.state()));
        let mut restored = Session::from_json(&json).unwrap();
        assert_eq!(restored.state(), session.state());
        assert!(!restored.can_undo());
        restored.command("b8-b10").unwrap();
        assert_eq!(restored.view().repetitions, 2);
        assert!(Session::from_json("{}").is_err());
    }
}
