//! The state of a game and how it moves: the preparation
//! (`regras/sia/02-preparacao.md`), the turns (`regras/sia/03-turno.md`),
//! the claims (`regras/sia/04-formacoes.md`) and the end
//! (`regras/sia/05-fim-do-jogo.md`).
//!
//! Two players, 0 and 1. The nine stones are numbered 0 to 8 from left to
//! right.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

use crate::command::{Command, EndReason, Event, GameError, Rolled};
use crate::die::{Die, JOKER_SUIT};
use crate::formation::{best_completion, formation, Formation};
use crate::rng::Rng;

pub const PLAYERS: usize = 2;
pub const STONES: usize = 9;
/// Dice of one side of a stone.
pub const SIDE_DICE: usize = 3;
/// Dice in a hand at the start of the game: the joker and 4 dice of the bag.
pub const DEFAULT_HAND_SIZE: u8 = 5;
/// The hand sizes the engine accepts (the rules say 5; the others are for
/// experiments).
pub const HAND_SIZES: std::ops::RangeInclusive<u8> = 2..=10;
/// Stones that win the game.
pub const STONES_TO_WIN: usize = 5;
/// Neighbor stones that win the game.
pub const NEIGHBORS_TO_WIN: usize = 3;

/// The dice of one player on one stone.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Side {
    pub dice: Vec<Die>,
    /// When the side got its third die: a counter of all placements, so
    /// that of two complete sides the lower one was completed first.
    pub completed: Option<u16>,
}

impl Side {
    pub fn is_complete(&self) -> bool {
        self.dice.len() == SIDE_DICE
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Player {
    pub hand: Vec<Die>,
    /// Dice lost for ever by rerolling.
    pub lost: u8,
}

/// Where in the turn the player to move is.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export))]
pub enum Step {
    /// The start of the turn: a reroll is still allowed.
    Reroll,
    /// The player rerolled or claimed: claims and the placing remain.
    Claim,
}

/// A game: `Clone`, and every command returns a new state.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export, rename = "State"))]
pub struct GameState {
    pub(crate) stones: [u8; STONES],
    pub(crate) owners: [Option<usize>; STONES],
    /// `sides[player][stone]`.
    pub(crate) sides: [[Side; STONES]; PLAYERS],
    pub(crate) players: [Player; PLAYERS],
    pub(crate) hand_size: u8,
    pub(crate) to_move: usize,
    pub(crate) step: Step,
    /// The turn, from 1.
    pub(crate) turn: u16,
    /// Dice put on stones so far.
    pub(crate) placements: u16,
    pub(crate) rng: Rng,
    pub(crate) end: Option<EndReason>,
}

impl GameState {
    /// A new game with hands of 5 dice (the joker and 4 of the bag): the
    /// preparation done and the events of it.
    pub fn new(seed: u64) -> (GameState, Vec<Event>) {
        GameState::with_hand_size(DEFAULT_HAND_SIZE, seed)
    }

    /// A new game with hands of `hand_size` dice (2 to 10), for
    /// experiments. The rules say 5.
    ///
    /// # Panics
    ///
    /// If `hand_size` is outside [`HAND_SIZES`].
    pub fn with_hand_size(hand_size: u8, seed: u64) -> (GameState, Vec<Event>) {
        assert!(HAND_SIZES.contains(&hand_size), "the hand has 2 to 10 dice");
        let mut rng = Rng::new(seed);
        let stones: [u8; STONES] = std::array::from_fn(|_| rng.roll());
        let mut state = GameState {
            stones,
            owners: [None; STONES],
            sides: std::array::from_fn(|_| std::array::from_fn(|_| Side::default())),
            players: [Player::default(), Player::default()],
            hand_size,
            to_move: 0,
            step: Step::Reroll,
            turn: 1,
            placements: 0,
            rng,
            end: None,
        };
        let mut events = vec![Event::StonesRolled {
            stones: stones.to_vec(),
        }];
        for player in 0..PLAYERS {
            let joker = Die::new(state.rng.roll(), JOKER_SUIT);
            state.players[player].hand.push(joker);
            events.push(Event::Drawn {
                player,
                dice: vec![joker],
            });
            state.refill(player, &mut events);
        }
        state.to_move = usize::from(state.rng.coin());
        events.push(Event::TurnStarted {
            player: state.to_move,
            turn: 1,
        });
        (state, events)
    }

    /// Checks what the engine relies on, for a state read from outside.
    pub fn validate(&self) -> Result<(), String> {
        if !HAND_SIZES.contains(&self.hand_size) {
            return Err(format!("hand size {} outside 2 to 10", self.hand_size));
        }
        if self.stones.iter().any(|n| !(1..=6).contains(n)) {
            return Err("a stone shows a number outside 1 to 6".into());
        }
        if self.to_move >= PLAYERS {
            return Err("the player to move is out of range".into());
        }
        for (p, player) in self.players.iter().enumerate() {
            if player.lost >= self.hand_size {
                return Err(format!("player {p} lost every die"));
            }
            if player.hand.len() != self.hand_target(p) {
                return Err(format!(
                    "player {p} has {} dice in the hand, not {}",
                    player.hand.len(),
                    self.hand_target(p)
                ));
            }
            if player.hand.iter().any(|d| !d.is_valid()) {
                return Err(format!("player {p} has an invalid die"));
            }
        }
        let mut placed = 0usize;
        for (p, sides) in self.sides.iter().enumerate() {
            for (s, side) in sides.iter().enumerate() {
                if side.dice.len() > SIDE_DICE {
                    return Err(format!("player {p}, stone {s}: more than 3 dice"));
                }
                if side.dice.iter().any(|d| !d.is_valid()) {
                    return Err(format!("player {p}, stone {s}: an invalid die"));
                }
                if side.is_complete() != side.completed.is_some() {
                    return Err(format!("player {p}, stone {s}: completion out of sync"));
                }
                if side
                    .completed
                    .is_some_and(|c| c == 0 || c > self.placements)
                {
                    return Err(format!("player {p}, stone {s}: bad completion order"));
                }
                placed += side.dice.len();
            }
        }
        if placed != self.placements as usize {
            return Err(format!(
                "{placed} dice on the stones, {} placements",
                self.placements
            ));
        }
        if self.owners.iter().flatten().any(|&o| o >= PLAYERS) {
            return Err("a stone belongs to a player out of range".into());
        }
        Ok(())
    }

    // --- Reading ---------------------------------------------------------

    pub fn stones(&self) -> &[u8; STONES] {
        &self.stones
    }

    /// Who took each stone, or won it at the end.
    pub fn owners(&self) -> &[Option<usize>; STONES] {
        &self.owners
    }

    pub fn side(&self, player: usize, stone: usize) -> &Side {
        &self.sides[player][stone]
    }

    pub fn player(&self, player: usize) -> &Player {
        &self.players[player]
    }

    pub fn hand(&self, player: usize) -> &[Die] {
        &self.players[player].hand
    }

    pub fn hand_size(&self) -> u8 {
        self.hand_size
    }

    pub fn to_move(&self) -> usize {
        self.to_move
    }

    pub fn step(&self) -> Step {
        self.step
    }

    pub fn turn(&self) -> u16 {
        self.turn
    }

    pub fn end(&self) -> Option<EndReason> {
        self.end
    }

    pub fn is_over(&self) -> bool {
        self.end.is_some()
    }

    /// The same game with the dice generator restarted from `seed`. The
    /// dice to come are the only thing a player cannot see, so a bot plays
    /// on reseeded copies and never on the true rolls.
    pub fn reseeded(&self, seed: u64) -> GameState {
        GameState {
            rng: Rng::new(seed),
            ..self.clone()
        }
    }

    /// Stones of `player`.
    pub fn stones_of(&self, player: usize) -> usize {
        self.owners.iter().filter(|&&o| o == Some(player)).count()
    }

    /// The winners once the game is over: one player, or both in a draw.
    pub fn winners(&self) -> Option<Vec<usize>> {
        let reason = self.end?;
        Some(match reason {
            EndReason::Stones { player } | EndReason::Neighbors { player } => vec![player],
            EndReason::NoRoom => {
                let (a, b) = (self.stones_of(0), self.stones_of(1));
                match a.cmp(&b) {
                    std::cmp::Ordering::Greater => vec![0],
                    std::cmp::Ordering::Less => vec![1],
                    std::cmp::Ordering::Equal => vec![0, 1],
                }
            }
        })
    }

    /// The formation of a complete side.
    pub fn formation_of(&self, player: usize, stone: usize) -> Option<Formation> {
        let side = &self.sides[player][stone];
        side.is_complete()
            .then(|| formation(self.stones[stone], &side.dice))
    }

    /// Whether the complete side of `player` beats the complete side of the
    /// other player on `stone`: the formation, then the sum, then who
    /// completed first. `None` unless both are complete.
    pub fn beats(&self, player: usize, stone: usize) -> Option<bool> {
        let mine = self.formation_of(player, stone)?;
        let theirs = self.formation_of(1 - player, stone)?;
        Some(match mine.cmp(&theirs) {
            std::cmp::Ordering::Equal => {
                self.sides[player][stone].completed < self.sides[1 - player][stone].completed
            }
            order => order.is_gt(),
        })
    }

    /// Whether `player` may claim `stone` now (the rules in
    /// `regras/sia/04-formacoes.md#reivindicar`), ignoring whose turn it
    /// is. `Some(proven)`: `proven` is true when the other side is
    /// incomplete and the claim rests on the proof.
    pub fn claim_kind(&self, player: usize, stone: usize) -> Option<bool> {
        if stone >= STONES || self.owners[stone].is_some() {
            return None;
        }
        let mine = self.formation_of(player, stone)?;
        let other = &self.sides[1 - player][stone];
        if other.is_complete() {
            return self.beats(player, stone)?.then_some(false);
        }
        // The other side can still become any formation; a tie in kind and
        // sum is mine, because my side was completed first.
        let threat = best_completion(self.stones[stone], &other.dice);
        (mine >= threat).then_some(true)
    }

    pub fn can_claim(&self, player: usize, stone: usize) -> bool {
        self.claim_kind(player, stone).is_some()
    }

    /// Stones with room for a die of `player`: not taken and with fewer
    /// than 3 dice on the side.
    pub fn open_stones(&self, player: usize) -> Vec<usize> {
        (0..STONES)
            .filter(|&s| self.owners[s].is_none() && !self.sides[player][s].is_complete())
            .collect()
    }

    pub fn can_place(&self, player: usize) -> bool {
        (0..STONES).any(|s| self.owners[s].is_none() && !self.sides[player][s].is_complete())
    }

    // --- Moving ----------------------------------------------------------

    fn draw_die(&mut self) -> Die {
        Die::new(self.rng.roll(), self.rng.suit())
    }

    /// The dice `player` has in hand after drawing.
    fn hand_target(&self, player: usize) -> usize {
        (self.hand_size - self.players[player].lost) as usize
    }

    /// Draws for `player` until the hand has `hand_size` minus the dice
    /// lost.
    fn refill(&mut self, player: usize, events: &mut Vec<Event>) {
        let target = self.hand_target(player);
        let mut dice = Vec::new();
        while self.players[player].hand.len() < target {
            let die = self.draw_die();
            self.players[player].hand.push(die);
            dice.push(die);
        }
        if !dice.is_empty() {
            events.push(Event::Drawn { player, dice });
        }
    }

    fn finish(&mut self, reason: EndReason, events: &mut Vec<Event>) {
        self.end = Some(reason);
        events.push(Event::GameEnded { reason });
    }

    /// Whether `player` has a run of `NEIGHBORS_TO_WIN` stones side by side.
    fn has_neighbors(&self, player: usize) -> bool {
        (0..=STONES - NEIGHBORS_TO_WIN)
            .any(|start| (start..start + NEIGHBORS_TO_WIN).all(|s| self.owners[s] == Some(player)))
    }

    /// The end by lack of room: resolves the stones left.
    fn resolve(&mut self, events: &mut Vec<Event>) {
        for stone in 0..STONES {
            if self.owners[stone].is_some() {
                continue;
            }
            let winner = match (
                self.sides[0][stone].is_complete(),
                self.sides[1][stone].is_complete(),
            ) {
                (true, true) => Some(if self.beats(0, stone) == Some(true) {
                    0
                } else {
                    1
                }),
                (true, false) => Some(0),
                (false, true) => Some(1),
                (false, false) => None,
            };
            self.owners[stone] = winner;
            events.push(Event::Awarded {
                stone,
                player: winner,
            });
        }
        self.finish(EndReason::NoRoom, events);
    }

    /// Plays a command of the player to move: the new state and what
    /// happened, in order. Nothing changes on an error.
    pub fn apply(&self, command: Command) -> Result<(GameState, Vec<Event>), GameError> {
        if self.is_over() {
            return Err(GameError::GameOver);
        }
        let mut next = self.clone();
        let mut events = Vec::new();
        let me = self.to_move;
        match command {
            Command::Reroll { target, lost, dice } => {
                if self.step != Step::Reroll {
                    return Err(GameError::RerollClosed);
                }
                if target >= PLAYERS {
                    return Err(GameError::NoSuchPlayer { player: target });
                }
                let own = self.players[me].hand.len();
                if own < 2 {
                    return Err(GameError::HandTooSmall);
                }
                if lost >= own {
                    return Err(GameError::NoSuchDie { die: lost });
                }
                let hand = self.players[target].hand.len();
                if dice == 0 || u32::from(dice) >> hand != 0 {
                    return Err(GameError::BadRoll);
                }
                if target == me && dice >> lost & 1 == 1 {
                    return Err(GameError::LostRolled);
                }
                if target != me
                    && self.players[target]
                        .hand
                        .iter()
                        .enumerate()
                        .any(|(i, d)| d.is_joker() && dice >> i & 1 == 1)
                {
                    return Err(GameError::BadRoll);
                }
                let mut rolled = Vec::new();
                for index in 0..hand {
                    if dice >> index & 1 == 1 {
                        let from = next.players[target].hand[index];
                        let to = Die::new(next.rng.roll(), from.suit);
                        next.players[target].hand[index] = to;
                        rolled.push(Rolled { index, from, to });
                    }
                }
                let lost_die = next.players[me].hand.remove(lost);
                next.players[me].lost += 1;
                next.step = Step::Claim;
                events.push(Event::Rerolled {
                    player: me,
                    target,
                    lost: lost_die,
                    lost_index: lost,
                    rolled,
                });
                Ok((next, events))
            }
            Command::Claim { stone } => {
                if stone >= STONES {
                    return Err(GameError::NoSuchStone { stone });
                }
                if self.owners[stone].is_some() {
                    return Err(GameError::StoneTaken { stone });
                }
                let proven = self
                    .claim_kind(me, stone)
                    .ok_or(GameError::NotProven { stone })?;
                let formation = self.formation_of(me, stone).expect("a claim is complete");
                next.owners[stone] = Some(me);
                next.step = Step::Claim;
                events.push(Event::Claimed {
                    player: me,
                    stone,
                    formation,
                    proven,
                });
                if next.has_neighbors(me) {
                    next.finish(EndReason::Neighbors { player: me }, &mut events);
                } else if next.stones_of(me) >= STONES_TO_WIN {
                    next.finish(EndReason::Stones { player: me }, &mut events);
                }
                Ok((next, events))
            }
            Command::Place { die, stone } => {
                if die >= self.players[me].hand.len() {
                    return Err(GameError::NoSuchDie { die });
                }
                if stone >= STONES {
                    return Err(GameError::NoSuchStone { stone });
                }
                if self.owners[stone].is_some() {
                    return Err(GameError::StoneTaken { stone });
                }
                if self.sides[me][stone].is_complete() {
                    return Err(GameError::SideFull { stone });
                }
                let placed = next.players[me].hand.remove(die);
                next.placements += 1;
                let side = &mut next.sides[me][stone];
                side.dice.push(placed);
                let completes = side.is_complete();
                if completes {
                    side.completed = Some(next.placements);
                }
                events.push(Event::Placed {
                    player: me,
                    die: placed,
                    hand_index: die,
                    stone,
                    completes,
                });
                next.end_turn(&mut events);
                Ok((next, events))
            }
            Command::Pass => {
                if self.can_place(me) {
                    return Err(GameError::MustPlace);
                }
                events.push(Event::Passed { player: me });
                next.end_turn(&mut events);
                Ok((next, events))
            }
        }
    }

    /// Step 4 and the hand-over: draws the new dice, checks the lack of
    /// room and starts the next turn.
    fn end_turn(&mut self, events: &mut Vec<Event>) {
        self.refill(self.to_move, events);
        if !self.can_place(0) && !self.can_place(1) {
            self.resolve(events);
            return;
        }
        self.to_move = 1 - self.to_move;
        self.step = Step::Reroll;
        self.turn += 1;
        events.push(Event::TurnStarted {
            player: self.to_move,
            turn: self.turn,
        });
    }

    // --- Legal commands --------------------------------------------------

    /// Every legal command of the player to move; empty once the game is
    /// over. Equal dice (same number and suit) give the same results, so
    /// only the first of each is used, and the rerolls list one choice of
    /// the dice per multiset.
    pub fn legal_commands(&self) -> Vec<Command> {
        let mut commands = self.legal_actions();
        if self.step == Step::Reroll
            && !self.is_over()
            && self.players[self.to_move].hand.len() >= 2
        {
            self.push_rerolls(&mut commands);
        }
        commands
    }

    /// The legal commands that are not rerolls: the claims, the placings
    /// and the pass. A reroll has hundreds of variants, and the bots choose
    /// a few of their own.
    pub fn legal_actions(&self) -> Vec<Command> {
        let mut commands = Vec::new();
        if self.is_over() {
            return commands;
        }
        let me = self.to_move;
        for stone in 0..STONES {
            if self.can_claim(me, stone) {
                commands.push(Command::Claim { stone });
            }
        }
        let open = self.open_stones(me);
        if open.is_empty() {
            commands.push(Command::Pass);
        }
        let hand = &self.players[me].hand;
        for die in first_of_each(hand, None) {
            for &stone in &open {
                commands.push(Command::Place { die, stone });
            }
        }
        commands
    }

    fn push_rerolls(&self, commands: &mut Vec<Command>) {
        let me = self.to_move;
        let own = &self.players[me].hand;
        for lost in first_of_each(own, None) {
            for target in 0..PLAYERS {
                let hand = &self.players[target].hand;
                let skip = (target == me).then_some(lost);
                // Groups of equal dice among the dice that can be rolled.
                let mut groups: Vec<Vec<usize>> = Vec::new();
                for (i, die) in hand.iter().enumerate() {
                    if Some(i) == skip || (target != me && die.is_joker()) {
                        continue;
                    }
                    match groups.iter_mut().find(|g| hand[g[0]] == *die) {
                        Some(group) => group.push(i),
                        None => groups.push(vec![i]),
                    }
                }
                let total: usize = groups.iter().map(|g| g.len() + 1).product();
                for code in 1..total {
                    let mut rest = code;
                    let mut mask = 0u16;
                    for group in &groups {
                        let count = rest % (group.len() + 1);
                        rest /= group.len() + 1;
                        for &i in &group[..count] {
                            mask |= 1 << i;
                        }
                    }
                    commands.push(Command::Reroll {
                        target,
                        lost,
                        dice: mask,
                    });
                }
            }
        }
    }
}

/// The index of the first die of each distinct die in `hand`.
fn first_of_each(hand: &[Die], skip: Option<usize>) -> Vec<usize> {
    let mut seen: Vec<Die> = Vec::new();
    let mut indexes = Vec::new();
    for (i, &die) in hand.iter().enumerate() {
        if Some(i) == skip || seen.contains(&die) {
            continue;
        }
        seen.push(die);
        indexes.push(i);
    }
    indexes
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::formation::FormationKind;

    fn d(value: u8, suit: u8) -> Die {
        Die::new(value, suit)
    }

    /// A fresh game with the stones given, `player` to move and no dice on
    /// the stones.
    fn game(stones: [u8; STONES], to_move: usize) -> GameState {
        let (mut state, _) = GameState::new(1);
        state.stones = stones;
        state.to_move = to_move;
        state
    }

    /// Puts dice on a side as if they had been placed, in order.
    fn put(state: &mut GameState, player: usize, stone: usize, dice: &[Die]) {
        for &die in dice {
            state.placements += 1;
            let side = &mut state.sides[player][stone];
            side.dice.push(die);
            if side.is_complete() {
                side.completed = Some(state.placements);
            }
        }
    }

    fn play(state: &GameState, command: Command) -> GameState {
        state.apply(command).unwrap().0
    }

    #[test]
    fn the_preparation_rolls_the_stones_and_deals_the_joker_and_four_dice() {
        let (state, events) = GameState::new(7);
        assert_eq!(state.validate(), Ok(()));
        assert!(state.stones.iter().all(|n| (1..=6).contains(n)));
        for p in 0..PLAYERS {
            assert_eq!(state.hand(p).len(), 5);
            assert!(state.hand(p).iter().all(Die::is_valid));
            // The joker comes first, with a rolled number; the rest is bag.
            assert_eq!(state.hand(p)[0].suit, JOKER_SUIT);
            assert!(state.hand(p)[1..].iter().all(|d| d.suit < JOKER_SUIT));
        }
        assert!(matches!(events[0], Event::StonesRolled { .. }));
        assert!(matches!(&events[1], Event::Drawn { player: 0, dice } if dice.len() == 1));
        assert!(matches!(&events[2], Event::Drawn { player: 0, dice } if dice.len() == 4));
        assert!(matches!(&events[3], Event::Drawn { player: 1, dice } if dice.len() == 1));
        assert!(matches!(&events[4], Event::Drawn { player: 1, dice } if dice.len() == 4));
        assert!(matches!(events[5], Event::TurnStarted { turn: 1, .. }));
        assert_eq!(state.turn(), 1);
        assert_eq!(state.step(), Step::Reroll);
    }

    #[test]
    fn the_hand_size_is_an_option_and_the_first_player_varies() {
        for size in [6, 7, 8] {
            assert_eq!(
                GameState::with_hand_size(size, 3).0.hand(1).len(),
                size as usize
            );
        }
        let firsts: Vec<usize> = (0..40).map(|s| GameState::new(s).0.to_move()).collect();
        assert!(firsts.contains(&0) && firsts.contains(&1));
    }

    #[test]
    fn a_reroll_loses_a_die_and_rolls_only_the_chosen_ones() {
        let (state, _) = GameState::new(11);
        let me = state.to_move();
        let before = state.hand(me).to_vec();
        let (next, events) = state
            .apply(Command::Reroll {
                target: me,
                lost: 0,
                dice: 0b110,
            })
            .unwrap();
        assert_eq!(next.player(me).lost, 1);
        assert_eq!(next.hand(me).len(), 4);
        assert_eq!(next.step(), Step::Claim);
        // The hand without the lost die; indexes 1 and 2 may have new numbers.
        let after = next.hand(me);
        for (i, die) in before[1..].iter().enumerate() {
            assert_eq!(after[i].suit, die.suit, "a roll keeps the suit");
            if i != 0 && i != 1 {
                assert_eq!(after[i], *die, "dice not chosen stay");
            }
        }
        let Event::Rerolled {
            lost,
            lost_index,
            rolled,
            ..
        } = &events[0]
        else {
            panic!("{events:?}");
        };
        assert_eq!((*lost, *lost_index), (before[0], 0));
        assert_eq!(rolled.iter().map(|r| r.index).collect::<Vec<_>>(), [1, 2]);
        assert_eq!(rolled[0].from, before[1]);
        assert_eq!(next.validate(), Ok(()));
    }

    #[test]
    fn a_reroll_can_target_the_other_hand() {
        let (state, _) = GameState::new(12);
        let me = state.to_move();
        let other_before = state.hand(1 - me).to_vec();
        let next = play(
            &state,
            Command::Reroll {
                target: 1 - me,
                lost: 3,
                dice: 0b1_0100,
            },
        );
        assert_eq!(next.hand(me).len(), 4);
        assert_eq!(next.hand(1 - me).len(), 5);
        assert_eq!(next.player(1 - me).lost, 0);
        for i in [0, 1, 3] {
            assert_eq!(next.hand(1 - me)[i], other_before[i]);
        }
    }

    #[test]
    fn rerolls_are_refused_when_they_break_the_rules() {
        let (state, _) = GameState::new(13);
        let me = state.to_move();
        let reroll = |target, lost, dice| Command::Reroll { target, lost, dice };
        assert_eq!(
            state.apply(reroll(me, 0, 0b1)).unwrap_err(),
            GameError::LostRolled
        );
        assert_eq!(
            state.apply(reroll(me, 0, 0)).unwrap_err(),
            GameError::BadRoll
        );
        assert_eq!(
            state.apply(reroll(me, 0, 1 << 5)).unwrap_err(),
            GameError::BadRoll
        );
        assert_eq!(
            state.apply(reroll(me, 5, 1)).unwrap_err(),
            GameError::NoSuchDie { die: 5 }
        );
        assert_eq!(
            state.apply(reroll(2, 0, 1)).unwrap_err(),
            GameError::NoSuchPlayer { player: 2 }
        );
        // One reroll per turn, and only before the claims.
        let rolled = play(&state, reroll(me, 0, 0b10));
        assert_eq!(
            rolled.apply(reroll(me, 0, 0b10)).unwrap_err(),
            GameError::RerollClosed
        );
        assert!(rolled
            .legal_commands()
            .iter()
            .all(|c| !matches!(c, Command::Reroll { .. })));
    }

    #[test]
    fn a_hand_of_one_die_cannot_reroll_but_its_hand_can_be_rolled() {
        let (mut state, _) = GameState::new(14);
        let me = state.to_move();
        state.players[me].hand.truncate(1);
        state.players[me].lost = 4;
        // The one die of the other hand is not the joker, which cannot be rolled.
        state.players[1 - me].hand = vec![d(4, 1)];
        state.players[1 - me].lost = 4;
        assert_eq!(state.validate(), Ok(()));
        for target in 0..2 {
            assert_eq!(
                state
                    .apply(Command::Reroll {
                        target,
                        lost: 0,
                        dice: 1
                    })
                    .unwrap_err(),
                GameError::HandTooSmall
            );
        }
        assert!(state
            .legal_commands()
            .iter()
            .all(|c| !matches!(c, Command::Reroll { .. })));
        // With 2 dice, the other hand of one die can be rolled.
        state.players[me].hand.push(d(3, 3));
        state.players[me].lost = 3;
        let next = play(
            &state,
            Command::Reroll {
                target: 1 - me,
                lost: 1,
                dice: 1,
            },
        );
        assert_eq!(next.hand(me).len(), 1);
        assert_eq!(next.hand(1 - me).len(), 1);
    }

    #[test]
    fn the_legal_rerolls_list_each_choice_once() {
        let (mut state, _) = GameState::new(15);
        let me = state.to_move();
        // All different: 7 lost dice x (63 own + 127 other) choices.
        state.players[me].hand = (0..7).map(|i| d(i % 6 + 1, i / 6 + (i % 3))).collect();
        let distinct: std::collections::HashSet<_> = state.hand(me).iter().collect();
        assert_eq!(distinct.len(), 7);
        state.players[1 - me].hand = (0..7).map(|i| d(i % 6 + 1, (i + 1) % 4)).collect();
        let distinct: std::collections::HashSet<_> = state.hand(1 - me).iter().collect();
        assert_eq!(distinct.len(), 7);
        let rerolls = state
            .legal_commands()
            .into_iter()
            .filter(|c| matches!(c, Command::Reroll { .. }))
            .count();
        assert_eq!(rerolls, 7 * (63 + 127));
        // Equal dice collapse: 7 equal dice give 1 lost x (6 + 7) choices.
        state.players[me].hand = vec![d(2, 1); 7];
        state.players[1 - me].hand = vec![d(5, 0); 7];
        let rerolls = state
            .legal_commands()
            .into_iter()
            .filter(|c| matches!(c, Command::Reroll { .. }))
            .count();
        assert_eq!(rerolls, 6 + 7);
    }

    #[test]
    fn placing_draws_back_to_five_minus_the_lost_dice() {
        let (state, _) = GameState::new(16);
        let me = state.to_move();
        let (next, events) = state.apply(Command::Place { die: 2, stone: 4 }).unwrap();
        assert_eq!(next.hand(me).len(), 5);
        assert_eq!(next.side(me, 4).dice, [state.hand(me)[2]]);
        assert!(matches!(
            events[..],
            [
                Event::Placed {
                    stone: 4,
                    completes: false,
                    ..
                },
                Event::Drawn { .. },
                Event::TurnStarted { turn: 2, .. }
            ]
        ));
        assert_eq!(next.to_move(), 1 - me);
        assert_eq!(next.turn(), 2);
        // After a reroll the hand comes back to 4, not 5.
        let rolled = play(
            &state,
            Command::Reroll {
                target: me,
                lost: 0,
                dice: 0b10,
            },
        );
        let after = play(&rolled, Command::Place { die: 0, stone: 0 });
        assert_eq!(after.hand(me).len(), 4);
        assert_eq!(after.validate(), Ok(()));
    }

    #[test]
    fn placing_is_refused_on_a_taken_stone_a_full_side_or_a_missing_die() {
        let mut state = game([3; 9], 0);
        put(&mut state, 0, 1, &[d(1, 0), d(2, 0), d(3, 0)]);
        state.owners[2] = Some(1);
        assert_eq!(
            state
                .apply(Command::Place { die: 0, stone: 1 })
                .unwrap_err(),
            GameError::SideFull { stone: 1 }
        );
        assert_eq!(
            state
                .apply(Command::Place { die: 0, stone: 2 })
                .unwrap_err(),
            GameError::StoneTaken { stone: 2 }
        );
        assert_eq!(
            state
                .apply(Command::Place { die: 5, stone: 0 })
                .unwrap_err(),
            GameError::NoSuchDie { die: 5 }
        );
        assert_eq!(
            state
                .apply(Command::Place { die: 0, stone: 9 })
                .unwrap_err(),
            GameError::NoSuchStone { stone: 9 }
        );
        // The other side of a stone with a complete side still takes dice.
        let mut other = state.clone();
        other.to_move = 1;
        assert!(other.apply(Command::Place { die: 0, stone: 1 }).is_ok());
    }

    #[test]
    fn passing_needs_a_full_board_on_the_own_side() {
        let mut state = game([3; 9], 0);
        assert_eq!(
            state.apply(Command::Pass).unwrap_err(),
            GameError::MustPlace
        );
        for stone in 0..STONES - 1 {
            state.owners[stone] = Some(1);
        }
        put(&mut state, 0, 8, &[d(1, 0), d(2, 0), d(3, 0)]);
        assert!(state.legal_commands().contains(&Command::Pass));
        assert!(!state
            .legal_commands()
            .iter()
            .any(|c| matches!(c, Command::Place { .. })));
        let (next, events) = state.apply(Command::Pass).unwrap();
        assert!(matches!(events[0], Event::Passed { player: 0 }));
        // Player 1 still has room on stone 8, so the game goes on.
        assert!(!next.is_over());
        assert_eq!(next.to_move(), 1);
    }

    #[test]
    fn two_complete_sides_are_a_duel_and_the_loser_cannot_claim() {
        let mut state = game([6, 1, 1, 1, 1, 1, 1, 1, 1], 0);
        put(&mut state, 0, 0, &[d(5, 0), d(2, 1), d(1, 2)]); // 6 5 2 1: sum
        put(&mut state, 1, 0, &[d(2, 0), d(2, 1), d(3, 2)]); // pair of 2
        assert_eq!(state.formation_of(0, 0).unwrap().kind, FormationKind::Sum);
        assert_eq!(state.formation_of(1, 0).unwrap().kind, FormationKind::Pair);
        assert_eq!(state.claim_kind(1, 0), Some(false));
        assert_eq!(state.claim_kind(0, 0), None);
        assert_eq!(
            state.apply(Command::Claim { stone: 0 }).unwrap_err(),
            GameError::NotProven { stone: 0 }
        );
        // The winner can wait: the stone is still open to dice on no side.
        let mut turn1 = state.clone();
        turn1.to_move = 1;
        let (next, events) = turn1.apply(Command::Claim { stone: 0 }).unwrap();
        assert_eq!(next.owners()[0], Some(1));
        assert!(matches!(
            events[0],
            Event::Claimed {
                player: 1,
                stone: 0,
                proven: false,
                ..
            }
        ));
        assert_eq!(next.step(), Step::Claim);
        assert!(!next.is_over());
    }

    #[test]
    fn equal_formations_go_to_the_side_completed_first() {
        let mut state = game([3; 9], 0);
        let side = [d(1, 0), d(2, 1), d(4, 2)];
        put(&mut state, 1, 0, &side);
        put(&mut state, 0, 0, &side);
        assert_eq!(state.formation_of(0, 0), state.formation_of(1, 0));
        assert_eq!(state.beats(1, 0), Some(true));
        assert_eq!(state.beats(0, 0), Some(false));
        // The suits do not change the tie when the kind is the same.
        let mut other = game([3; 9], 0);
        put(&mut other, 0, 0, &side);
        put(&mut other, 1, 0, &[d(1, 3), d(2, 3), d(4, 1)]);
        assert_eq!(other.beats(0, 0), Some(true));
    }

    #[test]
    fn a_claim_against_an_incomplete_side_needs_a_proof() {
        // Stone 6: 3 4 5 6 in one suit is the best formation there is, and a
        // tie goes to the claimer, so an empty side cannot beat it.
        let mut state = game([6; 9], 0);
        put(&mut state, 0, 0, &[d(3, 1), d(4, 1), d(5, 1)]);
        assert_eq!(state.claim_kind(0, 0), Some(true));
        // A run is not enough against an empty side: it can become a
        // straight flush.
        put(&mut state, 0, 1, &[d(3, 1), d(4, 2), d(5, 3)]);
        assert_eq!(state.formation_of(0, 1).unwrap().kind, FormationKind::Run);
        assert_eq!(state.claim_kind(0, 1), None);
        // The same run, if the other side already has two different suits
        // and no way to make a straight flush or four of a kind.
        put(&mut state, 1, 1, &[d(1, 0), d(2, 1)]);
        assert_eq!(state.claim_kind(0, 1), Some(true));
    }

    #[test]
    fn the_proof_looks_at_what_the_other_side_can_become_not_at_the_hand() {
        let mut state = game([5; 9], 0);
        // A flush of sum 21.
        put(&mut state, 0, 0, &[d(6, 0), d(6, 0), d(4, 0)]);
        // The other side has a 1: no run is left (1 and the stone 5 are too
        // far apart), so the best it can be is a flush of a lower sum.
        put(&mut state, 1, 0, &[d(1, 0)]);
        assert_eq!(state.claim_kind(0, 0), Some(true));
        // Even if the other hand holds the missing dice of a run.
        state.players[1].hand = vec![d(2, 0), d(3, 0), d(4, 0), d(6, 0), d(1, 0)];
        assert_eq!(state.claim_kind(0, 0), Some(true));
        // With a 4 on the other side a straight flush is still open.
        let mut open = game([5; 9], 0);
        put(&mut open, 0, 0, &[d(6, 0), d(6, 0), d(4, 0)]);
        put(&mut open, 1, 0, &[d(4, 0)]);
        assert_eq!(open.claim_kind(0, 0), None);
    }

    #[test]
    fn the_proof_wins_a_tie_in_kind_and_sum_but_not_a_higher_sum() {
        // Stone 6, a run 3 4 5 6 (sum 18). The other side has 4 and 5 in two
        // suits: its only run is 3 4 5 6, the same sum, which loses the tie.
        let mut tie = game([6; 9], 0);
        put(&mut tie, 0, 0, &[d(3, 0), d(4, 1), d(5, 2)]);
        put(&mut tie, 1, 0, &[d(4, 0), d(5, 1)]);
        assert_eq!(tie.claim_kind(0, 0), Some(true));
        // Stone 3, a run 1 2 3 4 (sum 10). The other side has 2 and 4: it can
        // make the same run, but also 2 3 4 5 (sum 14).
        let mut higher = game([3; 9], 0);
        put(&mut higher, 0, 0, &[d(1, 0), d(2, 1), d(4, 2)]);
        put(&mut higher, 1, 0, &[d(2, 0), d(4, 1)]);
        assert_eq!(higher.formation_of(0, 0).unwrap().kind, FormationKind::Run);
        assert_eq!(higher.claim_kind(0, 0), None);
        // Once that side is complete with the same run, it is a duel and the
        // side completed first wins.
        put(&mut higher, 1, 0, &[d(1, 2)]);
        assert_eq!(higher.claim_kind(0, 0), Some(false));
        assert_eq!(higher.claim_kind(1, 0), None);
    }

    #[test]
    fn a_claim_needs_the_own_side_complete() {
        let mut state = game([6; 9], 0);
        put(&mut state, 0, 0, &[d(3, 1), d(4, 1)]);
        assert_eq!(state.claim_kind(0, 0), None);
        assert!(!state
            .legal_commands()
            .iter()
            .any(|c| matches!(c, Command::Claim { .. })));
    }

    #[test]
    fn a_taken_stone_cannot_be_claimed_again() {
        let mut state = game([6; 9], 0);
        put(&mut state, 0, 0, &[d(3, 1), d(4, 1), d(5, 1)]);
        let next = play(&state, Command::Claim { stone: 0 });
        assert_eq!(
            next.apply(Command::Claim { stone: 0 }).unwrap_err(),
            GameError::StoneTaken { stone: 0 }
        );
    }

    fn claimable_game() -> GameState {
        // Stone 8 is provable for player 0.
        let mut state = game([6; 9], 0);
        put(&mut state, 0, 8, &[d(3, 1), d(4, 1), d(5, 1)]);
        state
    }

    #[test]
    fn five_stones_win_at_once() {
        let mut state = claimable_game();
        for stone in [0, 2, 4, 6] {
            state.owners[stone] = Some(0);
        }
        let (next, events) = state.apply(Command::Claim { stone: 8 }).unwrap();
        assert_eq!(next.end(), Some(EndReason::Stones { player: 0 }));
        assert_eq!(next.winners(), Some(vec![0]));
        assert!(matches!(
            events[1],
            Event::GameEnded {
                reason: EndReason::Stones { player: 0 }
            }
        ));
        assert_eq!(next.apply(Command::Pass).unwrap_err(), GameError::GameOver);
        assert!(next.legal_commands().is_empty());
    }

    #[test]
    fn four_stones_do_not_win_and_the_turn_goes_on() {
        let mut state = claimable_game();
        for stone in [0, 2, 4] {
            state.owners[stone] = Some(0);
        }
        let next = play(&state, Command::Claim { stone: 8 });
        assert!(!next.is_over());
        assert_eq!(next.to_move(), 0);
        assert!(next
            .legal_commands()
            .iter()
            .any(|c| matches!(c, Command::Place { .. })));
    }

    #[test]
    fn three_neighbor_stones_win_even_with_a_taken_stone_between() {
        // Neighbors are those of the initial row, whoever took them.
        let mut state = claimable_game();
        state.owners[6] = Some(0);
        state.owners[7] = Some(0);
        let next = play(&state, Command::Claim { stone: 8 });
        assert_eq!(next.end(), Some(EndReason::Neighbors { player: 0 }));
        // Stones 5, 7 and 8 are not neighbors.
        let mut apart = claimable_game();
        apart.owners[5] = Some(0);
        apart.owners[7] = Some(0);
        assert!(!play(&apart, Command::Claim { stone: 8 }).is_over());
        // Neighbors of the other player do not count.
        let mut mixed = claimable_game();
        mixed.owners[6] = Some(0);
        mixed.owners[7] = Some(1);
        assert!(!play(&mixed, Command::Claim { stone: 8 }).is_over());
    }

    #[test]
    fn the_middle_of_three_neighbors_also_wins() {
        let mut state = game([6; 9], 0);
        put(&mut state, 0, 3, &[d(3, 1), d(4, 1), d(5, 1)]);
        state.owners[2] = Some(0);
        state.owners[4] = Some(0);
        assert_eq!(
            play(&state, Command::Claim { stone: 3 }).end(),
            Some(EndReason::Neighbors { player: 0 })
        );
    }

    #[test]
    fn the_game_ends_when_nobody_can_put_a_die() {
        // All stones taken but the last, where both sides are complete but
        // the second player's side gets its third die now.
        let mut state = game([3; 9], 1);
        for stone in 0..STONES - 1 {
            state.owners[stone] = Some(stone % 2);
        }
        put(&mut state, 0, 8, &[d(1, 0), d(2, 1), d(4, 2)]); // a run
        put(&mut state, 1, 8, &[d(1, 0), d(1, 1)]);
        state.players[1].hand = vec![d(2, 3); 7];
        // Player 1 has room on stone 8 only; player 0 has none.
        let (next, events) = state.apply(Command::Place { die: 0, stone: 8 }).unwrap();
        assert_eq!(next.end(), Some(EndReason::NoRoom));
        // Player 0 completed first with a run; player 1 has a trinca at most.
        assert_eq!(next.owners()[8], Some(0));
        assert!(events.iter().any(|e| matches!(
            e,
            Event::Awarded {
                stone: 8,
                player: Some(0)
            }
        )));
        assert!(matches!(
            events.last(),
            Some(Event::GameEnded {
                reason: EndReason::NoRoom
            })
        ));
        // Player 0 has the stones 0, 2, 4, 6 and now 8; player 1 has 3.
        assert_eq!(next.winners(), Some(vec![0]));
    }

    #[test]
    fn a_player_with_no_room_does_not_end_the_game_while_the_other_has() {
        let mut state = game([3; 9], 0);
        for stone in 0..STONES - 1 {
            state.owners[stone] = Some(1);
        }
        put(&mut state, 0, 8, &[d(1, 0), d(2, 1), d(4, 2)]);
        // Player 0 passes; player 1 can still place on stone 8.
        let next = play(&state, Command::Pass);
        assert!(!next.is_over());
        // Player 1 fills the last side: now nobody can place.
        put_all(&mut state, 1, 8, 2);
        state.to_move = 1;
        let end = play(&state, Command::Place { die: 0, stone: 8 });
        assert_eq!(end.end(), Some(EndReason::NoRoom));
        assert_eq!(end.winners(), Some(vec![1]));
    }

    fn put_all(state: &mut GameState, player: usize, stone: usize, count: usize) {
        let dice = [d(6, 0), d(6, 1)];
        put(state, player, stone, &dice[..count]);
    }

    #[test]
    fn a_draw_cannot_come_from_lack_of_room_with_nine_stones() {
        // At the end every stone left has two complete sides, so all nine
        // stones are decided and the total of stones is odd.
        for seed in 0..60 {
            let mut state = GameState::new(seed).0;
            let mut turns = 0;
            while !state.is_over() {
                let commands = state.legal_commands();
                // Prefer placing, never claiming: the game must end by lack of room.
                let pick = commands
                    .iter()
                    .copied()
                    .find(|c| matches!(c, Command::Place { .. }))
                    .or_else(|| commands.iter().copied().find(|c| *c == Command::Pass))
                    .expect("a place or a pass");
                state = play(&state, pick);
                turns += 1;
                assert!(turns < 200);
            }
            assert_eq!(state.end(), Some(EndReason::NoRoom));
            assert_eq!(state.stones_of(0) + state.stones_of(1), STONES);
            assert_eq!(state.winners().unwrap().len(), 1, "seed {seed}");
        }
    }

    /// A small deterministic generator for random playouts.
    struct Lcg(u64);

    impl Lcg {
        fn below(&mut self, bound: usize) -> usize {
            self.0 = self
                .0
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((self.0 >> 33) as usize) % bound
        }
    }

    #[test]
    fn random_games_keep_the_invariants_and_end() {
        let mut lcg = Lcg(99);
        for seed in 0..300u64 {
            let size = [6, 7, 8][seed as usize % 3];
            let (mut state, _) = GameState::with_hand_size(size, seed);
            let mut commands_played = 0;
            while !state.is_over() {
                assert_eq!(state.validate(), Ok(()), "seed {seed}");
                let commands = state.legal_commands();
                assert!(!commands.is_empty());
                // Rerolls are rare, as in a sensible game.
                let calm: Vec<Command> = commands
                    .iter()
                    .copied()
                    .filter(|c| !matches!(c, Command::Reroll { .. }))
                    .collect();
                let pool = if lcg.below(10) == 0 { &commands } else { &calm };
                let command = pool[lcg.below(pool.len())];
                let before = state.clone();
                let (next, events) = state.apply(command).unwrap();
                assert!(!events.is_empty());
                assert_eq!(before, state, "apply does not touch the original");
                state = next;
                commands_played += 1;
                assert!(commands_played < 2000, "seed {seed} does not end");
            }
            assert!(state.winners().is_some());
        }
    }

    #[test]
    fn equal_dice_give_equal_results() {
        // Placing the second of two equal dice leaves the same side as
        // placing the first.
        let (mut state, _) = GameState::new(21);
        let me = state.to_move();
        state.players[me].hand[3] = state.players[me].hand[0];
        let a = play(&state, Command::Place { die: 0, stone: 5 });
        let b = play(&state, Command::Place { die: 3, stone: 5 });
        assert_eq!(a.side(me, 5), b.side(me, 5));
        let sorted = |s: &GameState| {
            let mut hand: Vec<_> = s.hand(me).iter().map(|d| (d.value, d.suit)).collect();
            hand.sort();
            hand
        };
        assert_eq!(sorted(&a), sorted(&b));
    }

    #[test]
    fn the_same_seed_replays_and_a_reseeded_copy_rolls_differently() {
        let (a, _) = GameState::new(31);
        let (b, _) = GameState::new(31);
        assert_eq!(a, b);
        let command = Command::Place { die: 0, stone: 0 };
        assert_eq!(play(&a, command), play(&b, command));
        let mut differs = false;
        for seed in 0..20 {
            differs |= play(&a.reseeded(seed), command) != play(&a, command);
        }
        assert!(differs);
    }

    #[test]
    fn a_bad_state_is_refused() {
        let (state, _) = GameState::new(3);
        let mut bad = state.clone();
        bad.players[0].hand.pop();
        assert!(bad.validate().is_err());
        let mut bad = state.clone();
        bad.stones[0] = 7;
        assert!(bad.validate().is_err());
        let mut bad = state;
        bad.sides[0][0].dice.push(d(1, 0));
        assert!(bad.validate().is_err());
    }
}
