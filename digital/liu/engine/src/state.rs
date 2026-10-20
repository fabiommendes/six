//! The state of a game and how it moves: the preparation
//! (`regras/liu/02-preparacao.md`), the rounds and their market
//! (`regras/liu/03-rodada.md`) and the end (`regras/liu/05-fim-do-jogo.md`).
//!
//! Players sit in clockwise order: player 0 is the host, and the next
//! player clockwise is the next index.

#[cfg(feature = "wire")]
use serde::{Deserialize, Serialize};

use crate::command::{Command, EndReason, Event, GameError};
use crate::rng::Rng;
use crate::score::{self, Score};
use crate::window::{Pos, Window};

pub const MIN_PLAYERS: usize = 2;
pub const MAX_PLAYERS: usize = 4;

/// Common dice per player in the bag.
pub const DICE_PER_PLAYER: usize = 15;

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", ts(export))]
pub struct Player {
    #[cfg_attr(feature = "wire", ts(as = "Vec<crate::window::Placed>"))]
    pub window: Window,
    pub hand: Option<u8>,
}

impl Player {
    pub fn seal(&self) -> u8 {
        self.window.seal()
    }
}

/// A game: `Clone`, and every command returns a new state.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "wire", derive(Serialize, Deserialize, ts_rs::TS))]
#[cfg_attr(feature = "wire", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wire", ts(export, rename = "State"))]
pub struct GameState {
    pub(crate) players: Vec<Player>,
    /// Dice left in the bag.
    pub(crate) bag: u8,
    pub(crate) market: Vec<u8>,
    /// The round, from 1.
    pub(crate) round: u16,
    /// Who began the round.
    pub(crate) first: usize,
    /// Turns already played in the round.
    pub(crate) turns: usize,
    /// Whether a die was put in a window in this round.
    pub(crate) placed: bool,
    /// Whether the player to move rerolled and must now place or keep.
    pub(crate) rerolled: bool,
    pub(crate) rng: Rng,
    pub(crate) end: Option<EndReason>,
}

impl GameState {
    /// A new game for `players` players, prepared and with the first
    /// market filled, and the events of that first round.
    pub fn new(players: usize, seed: u64) -> (GameState, Vec<Event>) {
        assert!(
            (MIN_PLAYERS..=MAX_PLAYERS).contains(&players),
            "the Liu is for 2 to 4 players"
        );
        let mut rng = Rng::new(seed);
        let seals = loop {
            let seals: Vec<u8> = (0..players).map(|_| rng.roll()).collect();
            if (0..players).all(|i| !seals[..i].contains(&seals[i])) {
                break seals;
            }
        };
        let mut state = GameState {
            players: seals
                .iter()
                .map(|&seal| Player {
                    window: Window::new(seal),
                    hand: Some(seal),
                })
                .collect(),
            bag: (DICE_PER_PLAYER * players - players) as u8,
            market: Vec::new(),
            round: 0,
            first: 0,
            turns: 0,
            placed: false,
            rerolled: false,
            rng,
            end: None,
        };
        let mut events = Vec::new();
        state.start_round(&mut events);
        (state, events)
    }

    /// Checks what the engine relies on. The windows were checked when
    /// they were read.
    pub fn validate(&self) -> Result<(), String> {
        let n = self.players.len();
        if !(MIN_PLAYERS..=MAX_PLAYERS).contains(&n) {
            return Err(format!("{n} players: the Liu is for 2 to 4"));
        }
        for player in &self.players {
            Window::from_dice(player.window.dice())?;
        }
        let seals: Vec<u8> = self.players.iter().map(Player::seal).collect();
        if (0..n).any(|i| seals[..i].contains(&seals[i])) {
            return Err("two players have the same seal number".into());
        }
        let values = self
            .market
            .iter()
            .chain(self.players.iter().filter_map(|p| p.hand.as_ref()));
        if values.clone().any(|v| !(1..=6).contains(v)) {
            return Err("a die shows a number outside 1 to 6".into());
        }
        let dice: usize = self.bag as usize
            + self.market.len()
            + self
                .players
                .iter()
                .map(|p| p.window.len() - 1 + p.hand.is_some() as usize)
                .sum::<usize>();
        if dice != DICE_PER_PLAYER * n {
            return Err(format!(
                "{dice} common dice in play, not {}",
                DICE_PER_PLAYER * n
            ));
        }
        if self.first >= n || self.turns >= n {
            return Err("the turn is out of range".into());
        }
        if self.rerolled && self.players[self.to_move()].hand.is_some() {
            return Err("after a reroll the hand is empty".into());
        }
        if self.end.is_none() && self.market.is_empty() {
            return Err("the market is empty".into());
        }
        Ok(())
    }

    pub fn players(&self) -> &[Player] {
        &self.players
    }

    pub fn bag(&self) -> u8 {
        self.bag
    }

    pub fn market(&self) -> &[u8] {
        &self.market
    }

    pub fn round(&self) -> u16 {
        self.round
    }

    pub fn first(&self) -> usize {
        self.first
    }

    pub fn rerolled(&self) -> bool {
        self.rerolled
    }

    pub fn end(&self) -> Option<EndReason> {
        self.end
    }

    pub fn is_over(&self) -> bool {
        self.end.is_some()
    }

    /// The player whose turn it is.
    pub fn to_move(&self) -> usize {
        (self.first + self.turns) % self.players.len()
    }

    pub fn scores(&self) -> Vec<Score> {
        self.players
            .iter()
            .map(|p| score::score(&p.window))
            .collect()
    }

    /// The winners, once the game is over.
    pub fn winners(&self) -> Option<Vec<usize>> {
        self.end.map(|_| score::winners(&self.scores()))
    }

    /// The owner of the seal number that appears in the market more than
    /// each of the others, if one does.
    pub fn majority(&self) -> Option<usize> {
        let counts: Vec<usize> = self
            .players
            .iter()
            .map(|p| self.market.iter().filter(|&&v| v == p.seal()).count())
            .collect();
        let best = *counts.iter().max()?;
        let mut owners = (0..counts.len()).filter(|&i| counts[i] == best);
        let owner = owners.next()?;
        owners.next().is_none().then_some(owner)
    }

    fn market_ready(&self) -> bool {
        self.market.len() > self.players.len() && self.majority().is_some()
    }

    /// Fills the market and starts the next round, or ends the game when
    /// the bag runs out first.
    fn start_round(&mut self, events: &mut Vec<Event>) {
        let mut drawn = Vec::new();
        while !self.market_ready() {
            if self.bag == 0 {
                if !drawn.is_empty() {
                    events.push(Event::MarketFilled { drawn });
                }
                self.finish(EndReason::BagEmpty, events);
                return;
            }
            self.bag -= 1;
            let value = self.rng.roll();
            self.market.push(value);
            drawn.push(value);
        }
        events.push(Event::MarketFilled { drawn });
        self.round += 1;
        self.first = self.majority().expect("the market is ready");
        self.turns = 0;
        self.placed = false;
        events.push(Event::RoundStarted {
            round: self.round,
            first: self.first,
        });
    }

    fn finish(&mut self, reason: EndReason, events: &mut Vec<Event>) {
        self.end = Some(reason);
        events.push(Event::GameOver { reason });
    }

    fn take(&mut self, die: usize) -> Result<u8, GameError> {
        if die >= self.market.len() {
            return Err(GameError::NoSuchDie { die });
        }
        Ok(self.market.remove(die))
    }

    /// Plays a command of the player to move: the new state and what
    /// happened, in order. Nothing changes on an error.
    pub fn apply(&self, command: Command) -> Result<(GameState, Vec<Event>), GameError> {
        if self.is_over() {
            return Err(GameError::GameOver);
        }
        let mut next = self.clone();
        let mut events = Vec::new();
        let player = self.to_move();
        let seal = self.players[player].seal();
        let hand = self.players[player].hand;
        let mut bonus = false;
        match command {
            Command::PlaceFromMarket { die, at } => {
                let value = *self.market.get(die).ok_or(GameError::NoSuchDie { die })?;
                next.players[player].window.place(at, value)?;
                next.take(die)?;
                events.push(Event::Placed {
                    player,
                    value,
                    at,
                    from_hand: false,
                });
                bonus = value == seal && hand.is_none();
            }
            Command::PlaceFromHand { die, at } => {
                if self.rerolled {
                    return Err(GameError::MustTake);
                }
                let value = hand.ok_or(GameError::HandEmpty)?;
                let taken = *self.market.get(die).ok_or(GameError::NoSuchDie { die })?;
                next.players[player].window.place(at, value)?;
                next.take(die)?;
                next.players[player].hand = Some(taken);
                events.push(Event::Placed {
                    player,
                    value,
                    at,
                    from_hand: true,
                });
                events.push(Event::Kept {
                    player,
                    value: taken,
                });
            }
            Command::Keep { die } => {
                if hand.is_some() {
                    return Err(GameError::HandFull);
                }
                let value = next.take(die)?;
                next.players[player].hand = Some(value);
                events.push(Event::Kept { player, value });
            }
            Command::Reroll => {
                if self.rerolled {
                    return Err(GameError::MustTake);
                }
                let returned = hand.ok_or(GameError::HandEmpty)?;
                next.players[player].hand = None;
                next.market.push(returned);
                for value in next.market.iter_mut() {
                    *value = next.rng.roll();
                }
                next.rerolled = true;
                events.push(Event::Rerolled {
                    player,
                    returned,
                    market: next.market.clone(),
                });
                return Ok((next, events));
            }
            Command::Pass => {
                if self.rerolled {
                    return Err(GameError::MustTake);
                }
                events.push(Event::Passed { player });
            }
        }
        if matches!(
            command,
            Command::PlaceFromMarket { .. } | Command::PlaceFromHand { .. }
        ) {
            next.placed = true;
        }
        if bonus && next.players[player].hand.is_none() && next.bag > 0 {
            next.bag -= 1;
            next.players[player].hand = Some(seal);
            events.push(Event::SealBonus {
                player,
                value: seal,
            });
        }
        next.rerolled = false;
        if next.players[player].window.is_complete() {
            next.finish(EndReason::WindowComplete { player }, &mut events);
            return Ok((next, events));
        }
        next.turns += 1;
        if next.turns == next.players.len() {
            next.turns = 0;
            if next.placed {
                next.start_round(&mut events);
            } else {
                next.finish(EndReason::NoPlacement, &mut events);
            }
        }
        Ok((next, events))
    }

    /// Every legal command of the player to move; empty once the game is
    /// over. Market dice with the same number give the same results, so
    /// only the first of each number is listed.
    pub fn legal_commands(&self) -> Vec<Command> {
        let mut commands = Vec::new();
        if self.is_over() {
            return commands;
        }
        let player = &self.players[self.to_move()];
        let mut seen = [false; 7];
        for (die, &value) in self.market.iter().enumerate() {
            if std::mem::replace(&mut seen[value as usize], true) {
                continue;
            }
            for at in player.window.targets(value) {
                commands.push(Command::PlaceFromMarket { die, at });
            }
            match player.hand {
                None => commands.push(Command::Keep { die }),
                Some(held) if !self.rerolled => {
                    for at in player.window.targets(held) {
                        commands.push(Command::PlaceFromHand { die, at });
                    }
                }
                Some(_) => {}
            }
        }
        if !self.rerolled {
            if player.hand.is_some() {
                commands.push(Command::Reroll);
            }
            commands.push(Command::Pass);
        }
        commands
    }

    /// Where a die of `value` may go in the window of the player to move.
    pub fn targets(&self, value: u8) -> Vec<Pos> {
        self.players[self.to_move()].window.targets(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::window::Placed;

    /// A game in round 1 with seals 2 and 5, the given market and hands.
    fn game(market: &[u8], hands: [Option<u8>; 2]) -> GameState {
        let in_hands = hands.iter().filter(|h| h.is_some()).count();
        GameState {
            players: [2, 5]
                .iter()
                .zip(hands)
                .map(|(&seal, hand)| Player {
                    window: Window::new(seal),
                    hand,
                })
                .collect(),
            bag: (30 - market.len() - in_hands) as u8,
            market: market.to_vec(),
            round: 1,
            first: 0,
            turns: 0,
            placed: false,
            rerolled: false,
            rng: Rng::new(1),
            end: None,
        }
    }

    #[test]
    fn the_majority_counts_only_seal_numbers() {
        assert_eq!(game(&[2, 2, 4, 4, 4], [None, None]).majority(), Some(0));
        assert_eq!(game(&[2, 5, 4], [None, None]).majority(), None);
        assert_eq!(game(&[1, 3, 4], [None, None]).majority(), None);
        assert_eq!(game(&[5, 1, 1], [None, None]).majority(), Some(1));
    }

    #[test]
    fn a_ready_market_is_not_filled() {
        let mut state = game(&[2, 2, 4, 4, 4], [None, None]);
        let mut events = Vec::new();
        state.start_round(&mut events);
        assert_eq!(state.market, vec![2, 2, 4, 4, 4]);
        assert_eq!(events[0], Event::MarketFilled { drawn: vec![] });
        assert_eq!(events[1], Event::RoundStarted { round: 2, first: 0 });
    }

    #[test]
    fn the_market_fills_until_n_plus_1_dice_and_a_majority() {
        for seed in 0..200 {
            let (state, _) = GameState::new(4, seed);
            assert!(state.market.len() >= 5);
            let first = state.majority().unwrap();
            assert_eq!(state.first, first);
            // One die fewer would not do: the last draw made it ready.
            let mut before = state.clone();
            before.market.pop();
            assert!(!before.market_ready(), "seed {seed}");
        }
    }

    #[test]
    fn an_empty_bag_during_the_market_ends_the_game() {
        let mut state = game(&[1, 3], [None, None]);
        state.bag = 0;
        state.players[0].hand = Some(1);
        state.players[1].hand = Some(1);
        let mut events = Vec::new();
        state.start_round(&mut events);
        assert_eq!(state.end, Some(EndReason::BagEmpty));
        assert_eq!(
            events,
            vec![Event::GameOver {
                reason: EndReason::BagEmpty
            }]
        );
    }

    #[test]
    fn placing_the_seal_number_with_an_empty_hand_gives_the_bonus() {
        // Player 0 (seal 2) places a 2 away from the seal's row and column.
        let mut state = game(&[3, 2, 2], [None, None]);
        state.players[0].window = Window::from_dice(&[
            Placed {
                at: Pos::SEAL,
                value: 2,
            },
            Placed {
                at: Pos::new(0, 1),
                value: 4,
            },
        ])
        .unwrap();
        state.bag -= 1;
        state.validate().unwrap();
        let (next, events) = state
            .apply(Command::PlaceFromMarket {
                die: 1,
                at: Pos::new(1, 1),
            })
            .unwrap();
        assert_eq!(next.players[0].hand, Some(2));
        assert_eq!(next.bag, state.bag - 1);
        assert!(events.contains(&Event::SealBonus {
            player: 0,
            value: 2
        }));
        next.validate().unwrap();
    }

    #[test]
    fn no_bonus_with_a_die_in_the_hand_or_an_empty_bag() {
        let mut state = game(&[3, 2, 2], [Some(6), None]);
        state.players[0].window = Window::from_dice(&[
            Placed {
                at: Pos::SEAL,
                value: 2,
            },
            Placed {
                at: Pos::new(0, 1),
                value: 4,
            },
        ])
        .unwrap();
        state.bag -= 1;
        let place = Command::PlaceFromMarket {
            die: 1,
            at: Pos::new(1, 1),
        };
        let (next, _) = state.apply(place).unwrap();
        assert_eq!(next.players[0].hand, Some(6));

        state.players[0].hand = None;
        state.bag = 0;
        state.market.extend([6; 26]);
        state.validate().unwrap();
        let (next, events) = state.apply(place).unwrap();
        assert_eq!(next.players[0].hand, None);
        assert!(!events.iter().any(|e| matches!(e, Event::SealBonus { .. })));
    }

    #[test]
    fn place_from_hand_swaps_and_never_gives_the_bonus() {
        let state = game(&[2, 2, 3], [Some(1), None]);
        let (next, events) = state
            .apply(Command::PlaceFromHand {
                die: 0,
                at: Pos::new(1, 0),
            })
            .unwrap();
        assert_eq!(next.players[0].window.value_at(Pos::new(1, 0)), Some(1));
        assert_eq!(next.players[0].hand, Some(2));
        assert_eq!(next.market, vec![2, 3]);
        assert_eq!(events.len(), 2);
        assert_eq!(next.to_move(), 1);
    }

    #[test]
    fn a_reroll_rolls_the_market_and_the_player_must_take() {
        let state = game(&[2, 2, 3], [Some(1), None]);
        let (next, events) = state.apply(Command::Reroll).unwrap();
        assert!(next.rerolled);
        assert_eq!(next.market.len(), 4);
        assert_eq!(next.players[0].hand, None);
        assert!(matches!(
            events[0],
            Event::Rerolled {
                player: 0,
                returned: 1,
                ..
            }
        ));
        assert_eq!(next.to_move(), 0);
        assert_eq!(next.apply(Command::Pass), Err(GameError::MustTake));
        assert_eq!(next.apply(Command::Reroll), Err(GameError::MustTake));
        assert!(next
            .legal_commands()
            .iter()
            .all(|c| matches!(c, Command::PlaceFromMarket { .. } | Command::Keep { .. })));
        let (after, _) = next.apply(Command::Keep { die: 0 }).unwrap();
        assert!(!after.rerolled);
        assert_eq!(after.to_move(), 1);
    }

    #[test]
    fn keep_needs_an_empty_hand() {
        let state = game(&[2, 2, 3], [Some(1), None]);
        assert_eq!(
            state.apply(Command::Keep { die: 0 }),
            Err(GameError::HandFull)
        );
        assert_eq!(
            state.apply(Command::Keep { die: 9 }),
            Err(GameError::HandFull)
        );
        let state = game(&[2, 2, 3], [None, None]);
        assert_eq!(
            state.apply(Command::Keep { die: 9 }),
            Err(GameError::NoSuchDie { die: 9 })
        );
        assert_eq!(state.apply(Command::Reroll), Err(GameError::HandEmpty));
    }

    #[test]
    fn a_round_without_a_placement_ends_the_game() {
        let state = game(&[2, 2, 3], [None, None]);
        let (state, _) = state.apply(Command::Pass).unwrap();
        let (state, events) = state.apply(Command::Pass).unwrap();
        assert_eq!(state.end, Some(EndReason::NoPlacement));
        assert_eq!(
            events.last(),
            Some(&Event::GameOver {
                reason: EndReason::NoPlacement
            })
        );
        assert_eq!(state.apply(Command::Pass), Err(GameError::GameOver));
        assert!(state.legal_commands().is_empty());
    }

    #[test]
    fn after_the_last_turn_a_new_round_starts() {
        let state = game(&[2, 2, 3], [None, None]);
        let (state, _) = state
            .apply(Command::PlaceFromMarket {
                die: 2,
                at: Pos::new(0, 1),
            })
            .unwrap();
        let (state, events) = state.apply(Command::Pass).unwrap();
        assert!(state.end.is_none());
        assert_eq!(state.round, 2);
        assert!(matches!(events[1], Event::MarketFilled { .. }));
        assert!(state.market_ready());
    }

    #[test]
    fn completing_the_window_ends_the_game_at_once() {
        let rows: [[u8; 4]; 4] = [[2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 1], [5, 6, 1, 0]];
        let mut dice = Vec::new();
        for (r, row) in rows.iter().enumerate() {
            for (c, &value) in row.iter().enumerate() {
                if value != 0 {
                    dice.push(Placed {
                        at: Pos::new(r as i8, c as i8),
                        value,
                    });
                }
            }
        }
        let mut state = game(&[2, 2, 2], [None, None]);
        state.players[0].window = Window::from_dice(&dice).unwrap();
        state.bag -= 14;
        state.validate().unwrap();
        let (next, events) = state
            .apply(Command::PlaceFromMarket {
                die: 0,
                at: Pos::new(3, 3),
            })
            .unwrap();
        assert_eq!(next.end, Some(EndReason::WindowComplete { player: 0 }));
        assert_eq!(next.to_move(), 0);
        assert_eq!(
            events.last(),
            Some(&Event::GameOver {
                reason: EndReason::WindowComplete { player: 0 }
            })
        );
        assert_eq!(next.winners(), Some(vec![0]));
    }

    #[test]
    fn random_games_keep_the_invariants_and_end() {
        let mut rng = Rng::new(99);
        for players in MIN_PLAYERS..=MAX_PLAYERS {
            for seed in 0..150 {
                let (mut state, _) = GameState::new(players, seed);
                let mut plies = 0;
                while !state.is_over() {
                    state.validate().unwrap();
                    let commands = state.legal_commands();
                    // Pass rarely, or games would end at the first round.
                    let pick = loop {
                        let i = (rng.roll() as usize * 7 + rng.roll() as usize) % commands.len();
                        if commands[i] != Command::Pass || commands.len() == 1 || rng.roll() == 6 {
                            break commands[i];
                        }
                    };
                    state = state.apply(pick).unwrap().0;
                    plies += 1;
                    assert!(plies < 10_000);
                }
                state.validate().unwrap();
                let winners = state.winners().unwrap();
                assert!(!winners.is_empty());
                for score in state.scores() {
                    assert!(score.points <= 24);
                }
            }
        }
    }
}
