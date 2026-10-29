//! The state of a game and how it moves (`dev/rfc/jogo-de-corrida.md`).
//!
//! Two players, 0 and 1. The track is the one of the Royal Game of Ur, and
//! each player numbers it along their own path: squares 1 to 4 are the own
//! entry lane, 5 to 12 the shared middle lane, 13 and 14 the own exit lane,
//! and 15 is off the board. A square of the middle lane has the same number
//! for both players.

use std::ops::RangeInclusive;

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

use crate::command::{Command, EndReason, Event, GameError};
use crate::rng::Rng;

pub const PLAYERS: usize = 2;
/// Squares on the board along the path of one player.
pub const SQUARES: u8 = 14;
/// The square after the last one: off the board.
pub const EXIT: u8 = 15;
/// The middle lane, shared by both players.
pub const SHARED: RangeInclusive<u8> = 5..=12;
/// The rosettes of Ur: the end of the entry lane, the red center square
/// (the fourth of the middle lane) and the last square. They roll again,
/// and a die on the center one cannot be eaten nor touched (the other two
/// are on the own lanes, out of reach).
pub const ROSETTES: [u8; 3] = [4, 8, 14];
pub const MAX_VALUE: u8 = 6;
pub const POINTS_TO_WIN: u8 = 10;
pub const BINARY_DICE: u8 = 4;

/// The open questions of the RFC, as switches for experiments. The default
/// is the proposal.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Rules {
    /// A die that stops on a rosette rolls again.
    pub extra_turn: bool,
    /// Only the smallest die of the reserve can enter.
    pub ordered_entry: bool,
    /// Taking every die home wins. When off (the rules), it ends the game
    /// and the player with more points wins (the one who ended it, on a
    /// tie).
    pub all_home_wins: bool,
}

impl Default for Rules {
    fn default() -> Rules {
        Rules {
            extra_turn: true,
            ordered_entry: true,
            all_home_wins: false,
        }
    }
}

/// A game: `Clone`, and every command returns a new state.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export, rename = "State"))]
pub struct GameState {
    /// `board[player][square]`: the value of the die there, 0 when empty.
    /// Index 0 and `EXIT` are never used.
    pub(crate) board: [[u8; EXIT as usize + 1]; PLAYERS],
    /// `reserve[player][value]`: how many dice of that value wait to enter.
    pub(crate) reserve: [[u8; MAX_VALUE as usize + 1]; PLAYERS],
    pub(crate) points: [u8; PLAYERS],
    pub(crate) rules: Rules,
    pub(crate) to_move: usize,
    /// The roll of the current turn.
    pub(crate) roll: u8,
    /// The turn, from 1. An extra turn counts as a turn.
    pub(crate) turn: u16,
    pub(crate) rng: Rng,
    pub(crate) end: Option<EndReason>,
}

impl GameState {
    /// A new game with the rules of the proposal.
    pub fn new(seed: u64) -> GameState {
        GameState::with_rules(Rules::default(), seed)
    }

    /// A new game: each reserve holds the dice 1 to 6, a coin chooses who
    /// starts and the first roll is made.
    pub fn with_rules(rules: Rules, seed: u64) -> GameState {
        let mut rng = Rng::new(seed);
        let to_move = usize::from(rng.coin());
        let mut reserve = [[1; MAX_VALUE as usize + 1]; PLAYERS];
        for counts in &mut reserve {
            counts[0] = 0;
        }
        let roll = rng.turn_roll(BINARY_DICE);
        GameState {
            board: [[0; EXIT as usize + 1]; PLAYERS],
            reserve,
            points: [0; PLAYERS],
            rules,
            to_move,
            roll,
            turn: 1,
            rng,
            end: None,
        }
    }

    pub fn to_move(&self) -> usize {
        self.to_move
    }

    pub fn roll(&self) -> u8 {
        self.roll
    }

    pub fn turn(&self) -> u16 {
        self.turn
    }

    /// A copy whose current roll is `roll` (1 to 4), for bots that search
    /// over the rolls instead of reading the generator.
    pub fn with_roll(&self, roll: u8) -> GameState {
        assert!(
            (1..=BINARY_DICE).contains(&roll),
            "a turn rolls 1 to 4: all zeros roll again"
        );
        GameState {
            roll,
            ..self.clone()
        }
    }

    pub fn rules(&self) -> Rules {
        self.rules
    }

    pub fn end(&self) -> Option<EndReason> {
        self.end
    }

    pub fn points(&self, player: usize) -> u8 {
        self.points[player]
    }

    /// The value of the die of `player` on `square` (1 to 17), 0 when
    /// empty.
    pub fn die_at(&self, player: usize, square: u8) -> u8 {
        self.board[player][square as usize]
    }

    /// How many dice of `value` `player` has in the reserve.
    pub fn in_reserve(&self, player: usize, value: u8) -> u8 {
        self.reserve[player][value as usize]
    }

    /// The physical dice of `player` in play: on the board and in the
    /// reserve.
    pub fn dice(&self, player: usize) -> u8 {
        let on_board = self.board[player].iter().filter(|&&v| v != 0).count() as u8;
        on_board + self.reserve[player].iter().sum::<u8>()
    }

    /// Checks that a state read from outside (a saved game) is one the
    /// engine could have reached.
    pub fn validate(&self) -> Result<(), String> {
        if self.to_move >= PLAYERS {
            return Err("the player to move is out of range".into());
        }
        if !(1..=BINARY_DICE).contains(&self.roll) {
            return Err(format!("roll {} outside 1 to {BINARY_DICE}", self.roll));
        }
        if self.turn == 0 {
            return Err("the turn starts at 1".into());
        }
        for player in 0..PLAYERS {
            let board = &self.board[player];
            if board[0] != 0 || board[EXIT as usize] != 0 {
                return Err(format!("player {player}: a die off the track"));
            }
            if board.iter().any(|&v| v > MAX_VALUE) {
                return Err(format!("player {player}: a die above {MAX_VALUE}"));
            }
            if self.reserve[player][0] != 0 {
                return Err(format!("player {player}: a die of value 0 in the reserve"));
            }
            if self.points[player] > POINTS_TO_WIN + MAX_VALUE {
                return Err(format!("player {player}: too many points"));
            }
        }
        for square in SHARED {
            if self.board[0][square as usize] != 0
                && self.board[1][square as usize] != 0
                && self.end.is_none()
            {
                return Err(format!("square {square}: dice of both players"));
            }
        }
        Ok(())
    }

    /// The commands the player to move may play; `Pass` only when no
    /// other one. Empty when the game has ended.
    pub fn legal_commands(&self) -> Vec<Command> {
        if self.end.is_some() {
            return Vec::new();
        }
        let mut commands = Vec::new();
        if self.roll > 0 {
            let player = self.to_move;
            if self.can_land(self.roll) {
                let mut values = (1..=MAX_VALUE).filter(|&v| self.reserve[player][v as usize] > 0);
                if self.rules.ordered_entry {
                    commands.extend(values.next().map(|value| Command::Enter { value }));
                } else {
                    commands.extend(values.map(|value| Command::Enter { value }));
                }
            }
            for from in 1..=SQUARES {
                if self.board[player][from as usize] != 0 && self.can_land(from + self.roll) {
                    commands.push(Command::Move { from });
                }
            }
        }
        if commands.is_empty() {
            commands.push(Command::Pass);
        }
        commands
    }

    /// Whether a die of the player to move may stop on `square`: on the
    /// track or exactly off it, and not on a rosette held by the other
    /// player.
    fn can_land(&self, square: u8) -> bool {
        let other = 1 - self.to_move;
        square <= EXIT
            && !(square != EXIT
                && SHARED.contains(&square)
                && ROSETTES.contains(&square)
                && self.board[other][square as usize] != 0)
    }

    /// Plays `command` and returns the new state and what happened, ending
    /// with the roll of the next turn (or the end).
    pub fn apply(&self, command: Command) -> Result<(GameState, Vec<Event>), GameError> {
        if self.end.is_some() {
            return Err(GameError::Ended);
        }
        if !self.legal_commands().contains(&command) {
            return Err(GameError::Illegal(command));
        }
        let mut next = self.clone();
        let mut events = Vec::new();
        let player = self.to_move;
        let again = match command {
            Command::Pass => {
                events.push(Event::Passed { player });
                false
            }
            Command::Enter { value } => {
                next.reserve[player][value as usize] -= 1;
                events.push(Event::Entered {
                    player,
                    value,
                    square: self.roll,
                });
                next.advance(0, value, &mut events)
            }
            Command::Move { from } => {
                let value = next.board[player][from as usize];
                next.board[player][from as usize] = 0;
                events.push(Event::Moved {
                    player,
                    from,
                    to: from + self.roll,
                });
                next.advance(from, value, &mut events)
            }
        };
        next.check_end(player, &mut events);
        if next.end.is_none() {
            if again {
                events.push(Event::ExtraTurn { player });
            } else {
                next.to_move = 1 - player;
            }
            next.turn += 1;
            next.roll = next.rng.turn_roll(BINARY_DICE);
            events.push(Event::Rolled {
                player: next.to_move,
                roll: next.roll,
            });
        }
        Ok((next, events))
    }

    /// Carries a die of `value`, already lifted from `from` (0: the
    /// reserve), forward by the roll and resolves where it stops. Returns
    /// whether it earned an extra turn.
    fn advance(&mut self, from: u8, value: u8, events: &mut Vec<Event>) -> bool {
        let player = self.to_move;
        let other = 1 - player;
        let to = from + self.roll;
        if to == EXIT {
            self.points[player] += value;
            events.push(Event::Exited {
                player,
                value,
                points: self.points[player],
            });
            return false;
        }
        let square = to as usize;
        let own = self.board[player][square];
        let theirs = if SHARED.contains(&to) {
            self.board[other][square]
        } else {
            0
        };
        if own != 0 {
            let sum = own + value;
            self.board[player][square] = sum.min(MAX_VALUE);
            events.push(Event::Fused {
                player,
                square: to,
                value: sum.min(MAX_VALUE),
                lost: sum.saturating_sub(MAX_VALUE),
            });
        } else if theirs >= value {
            // Wear: the die goes back and the other one loses its value
            // for good (an equal one leaves the game).
            self.reserve[player][value as usize] += 1;
            self.board[other][square] = theirs - value;
            events.push(Event::Worn {
                player,
                square: to,
                value,
                left: theirs - value,
            });
            return false;
        } else if theirs != 0 {
            let kept = value - theirs + 1;
            self.board[other][square] = 0;
            self.reserve[other][theirs as usize] += 1;
            self.board[player][square] = kept;
            self.reserve[player][theirs as usize] += 1;
            events.push(Event::Captured {
                player,
                square: to,
                value: kept,
                taken: theirs,
            });
        } else {
            self.board[player][square] = value;
        }
        let ahead = to + 1;
        if SHARED.contains(&ahead) && !ROSETTES.contains(&ahead) {
            let touched = &mut self.board[other][ahead as usize];
            if *touched != 0 {
                *touched = touched.saturating_sub(1).max(1);
                events.push(Event::Touched {
                    player,
                    square: ahead,
                    value: *touched,
                });
            }
        }
        self.rules.extra_turn && ROSETTES.contains(&to)
    }

    fn check_end(&mut self, player: usize, events: &mut Vec<Event>) {
        let reason = if self.points[player] >= POINTS_TO_WIN {
            EndReason::Points { player }
        } else if self.dice(player) == 0 {
            let other = 1 - player;
            if self.rules.all_home_wins || self.points[player] >= self.points[other] {
                EndReason::AllHome { player }
            } else {
                EndReason::AllHome { player: other }
            }
        } else {
            return;
        };
        self.end = Some(reason);
        events.push(Event::Ended { reason });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A position with empty reserves: `dice[player]` lists `(square,
    /// value)`; player 0 moves with `roll`.
    fn position(roll: u8, dice: [&[(u8, u8)]; PLAYERS]) -> GameState {
        let mut state = GameState::new(1);
        state.reserve = [[0; MAX_VALUE as usize + 1]; PLAYERS];
        state.to_move = 0;
        state.roll = roll;
        for (player, list) in dice.iter().enumerate() {
            for &(square, value) in *list {
                state.board[player][square as usize] = value;
            }
        }
        state
    }

    fn play(state: &GameState, command: Command) -> (GameState, Vec<Event>) {
        state.apply(command).unwrap()
    }

    #[test]
    fn the_game_starts_with_the_dice_1_to_6_in_each_reserve() {
        let state = GameState::new(5);
        for player in 0..PLAYERS {
            for value in 1..=MAX_VALUE {
                assert_eq!(state.in_reserve(player, value), 1);
            }
            assert_eq!(state.dice(player), 6);
        }
        assert!((1..=4).contains(&state.roll()));
    }

    #[test]
    fn only_the_smallest_die_enters() {
        let mut state = position(2, [&[], &[]]);
        state.reserve[0][3] = 1;
        state.reserve[0][5] = 1;
        assert_eq!(state.legal_commands(), vec![Command::Enter { value: 3 }]);
        state.rules.ordered_entry = false;
        assert_eq!(
            state.legal_commands(),
            vec![Command::Enter { value: 3 }, Command::Enter { value: 5 }]
        );
    }

    #[test]
    fn the_turns_never_roll_0() {
        let mut state = GameState::new(9);
        for _ in 0..500 {
            assert!((1..=BINARY_DICE).contains(&state.roll()));
            if state.end().is_some() {
                state = GameState::new(u64::from(state.turn()));
            }
            state = state.apply(state.legal_commands()[0]).unwrap().0;
        }
    }

    #[test]
    fn dice_of_the_same_player_fuse_and_lose_what_goes_over_6() {
        let state = position(2, [&[(1, 4), (3, 5)], &[(9, 1)]]);
        let (next, events) = play(&state, Command::Move { from: 1 });
        assert_eq!(next.die_at(0, 3), 6);
        assert_eq!(next.die_at(0, 1), 0);
        assert!(events.contains(&Event::Fused {
            player: 0,
            square: 3,
            value: 6,
            lost: 3
        }));
    }

    #[test]
    fn a_bigger_die_eats_splits_gains_a_die_and_1() {
        let state = position(1, [&[(6, 5)], &[(7, 2)]]);
        let (next, _) = play(&state, Command::Move { from: 6 });
        assert_eq!(next.die_at(0, 7), 4);
        assert_eq!(next.die_at(1, 7), 0);
        assert_eq!(next.in_reserve(0, 2), 1);
        assert_eq!(next.in_reserve(1, 2), 1);
    }

    #[test]
    fn a_smaller_die_goes_back_and_wears_the_other_for_good() {
        let state = position(1, [&[(6, 2)], &[(7, 5)]]);
        let (next, events) = play(&state, Command::Move { from: 6 });
        assert_eq!(next.die_at(0, 7), 0);
        assert_eq!(next.in_reserve(0, 2), 1);
        assert_eq!(next.die_at(1, 7), 3);
        assert_eq!(next.dice(1), 1);
        assert!(events.contains(&Event::Worn {
            player: 0,
            square: 7,
            value: 2,
            left: 3
        }));
    }

    #[test]
    fn an_equal_die_wears_the_other_out_of_the_game() {
        let state = position(1, [&[(6, 3)], &[(7, 3), (9, 1)]]);
        let (next, _) = play(&state, Command::Move { from: 6 });
        assert_eq!(next.in_reserve(0, 3), 1);
        assert_eq!(next.die_at(1, 7), 0);
        assert_eq!(next.dice(1), 1);
    }

    #[test]
    fn the_own_lanes_do_not_touch_the_other_player() {
        let state = position(2, [&[(1, 4)], &[(3, 2)]]);
        let (next, _) = play(&state, Command::Move { from: 1 });
        assert_eq!(next.die_at(0, 3), 4);
        assert_eq!(next.die_at(1, 3), 2);
    }

    #[test]
    fn passing_over_a_die_costs_nothing() {
        let state = position(3, [&[(6, 4)], &[(7, 2)]]);
        let (next, _) = play(&state, Command::Move { from: 6 });
        assert_eq!(next.die_at(0, 9), 4);
        assert_eq!(next.die_at(1, 7), 2);
    }

    #[test]
    fn stopping_behind_a_die_takes_1_from_it() {
        let state = position(1, [&[(5, 4)], &[(7, 3)]]);
        let (next, _) = play(&state, Command::Move { from: 5 });
        assert_eq!(next.die_at(1, 7), 2);
    }

    #[test]
    fn a_die_on_the_center_rosette_is_safe() {
        let state = position(3, [&[(5, 4)], &[(8, 1)]]);
        assert_eq!(state.legal_commands(), vec![Command::Pass]);
        let state = position(2, [&[(5, 4)], &[(8, 2)]]);
        let (next, _) = play(&state, Command::Move { from: 5 });
        assert_eq!(next.die_at(1, 8), 2);
    }

    #[test]
    fn every_rosette_rolls_again() {
        for (from, roll) in [(2, 2), (6, 2), (11, 3)] {
            let state = position(roll, [&[(from, 1)], &[(10, 1)]]);
            let (next, events) = play(&state, Command::Move { from });
            assert_eq!(next.to_move(), 0, "rosette {}", from + roll);
            assert!(events.contains(&Event::ExtraTurn { player: 0 }));
        }
        let mut state = position(2, [&[(2, 1)], &[(10, 1)]]);
        state.rules.extra_turn = false;
        let (next, _) = play(&state, Command::Move { from: 2 });
        assert_eq!(next.to_move(), 1);
    }

    #[test]
    fn leaving_needs_the_exact_roll() {
        let state = position(3, [&[(13, 5), (14, 2)], &[(9, 1)]]);
        assert_eq!(state.legal_commands(), vec![Command::Pass]);
        let state = position(2, [&[(13, 5)], &[(9, 1)]]);
        let (next, _) = play(&state, Command::Move { from: 13 });
        assert_eq!(next.points(0), 5);
    }

    #[test]
    fn twelve_points_win() {
        let mut state = position(1, [&[(14, 5)], &[(9, 1)]]);
        state.points[0] = 7;
        state.reserve[0][6] = 1;
        let (next, _) = play(&state, Command::Move { from: 14 });
        assert_eq!(next.end(), Some(EndReason::Points { player: 0 }));
    }

    #[test]
    fn taking_every_die_home_ends_the_game() {
        let state = position(1, [&[(14, 3)], &[(9, 1)]]);
        let (next, _) = play(&state, Command::Move { from: 14 });
        assert_eq!(next.end(), Some(EndReason::AllHome { player: 0 }));
    }

    #[test]
    fn after_every_die_home_more_points_win() {
        let mut state = position(1, [&[(14, 3)], &[(9, 1)]]);
        state.points[1] = 5;
        let (next, _) = play(&state, Command::Move { from: 14 });
        assert_eq!(next.end(), Some(EndReason::AllHome { player: 1 }));
        state.rules.all_home_wins = true;
        let (next, _) = play(&state, Command::Move { from: 14 });
        assert_eq!(next.end(), Some(EndReason::AllHome { player: 0 }));
    }

    #[test]
    fn random_games_end_and_keep_the_values_in_range() {
        for seed in 0..200 {
            let mut state = GameState::new(seed);
            let mut pick = Rng::new(seed ^ 0xABCD);
            while state.end().is_none() {
                assert!(state.turn() < 5_000, "seed {seed} does not end");
                let commands = state.legal_commands();
                let index = (0..commands.len()).find(|_| pick.coin()).unwrap_or(0);
                state = state.apply(commands[index]).unwrap().0;
                for player in 0..PLAYERS {
                    assert!(state.board[player].iter().all(|&v| v <= MAX_VALUE));
                }
            }
        }
    }
}
