//! The table, the round and the decisions the engine asks of the players.

use crate::{resolve, Kind, Mission, Rng, Rolled, Scoring, Steps};

/// The numbers of the rules, open to experiments.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rules {
    pub players: usize,
    pub goal: i32,
    /// Dice each player rolls in a round.
    pub hand: usize,
    pub start_common: u8,
    pub start_gold: u8,
    /// Dice of each special kind in the market, but the one die.
    pub market_each: u8,
    pub market_one: u8,
    pub market_gold: u8,
    pub market_high_gold: u8,
    /// Whether the bought die is rolled into the hand of the round.
    pub bought_plays: bool,
    /// Games longer than this stop with the points they have.
    pub max_rounds: u16,
    /// The kinds of mission card in the deck: bit `i` for
    /// `Mission::CARDS[i]`, with `Mission::copies` cards each.
    pub cards: u16,
    /// Whether players may sacrifice dice.
    pub sacrifice: bool,
    /// Added to the result of the bonus mission.
    pub bonus: u8,
    /// Taken from the count of the even and odd missions.
    pub parity_minus: u8,
    /// Whether reserve dice out of the hand can be cashed for money.
    pub cash: bool,
    /// Whether a sabotage can be paid with a die of the hand, besides a
    /// point.
    pub sabotage_by_die: bool,
}

impl Rules {
    pub fn scoring(&self) -> Scoring {
        Scoring {
            bonus: self.bonus,
            parity_minus: self.parity_minus,
        }
    }

    /// The points a sabotage costs: 2 with 2 players, 1 with more.
    pub fn sabotage_points(&self) -> i32 {
        if self.players == 2 {
            2
        } else {
            1
        }
    }
}

impl Default for Rules {
    fn default() -> Rules {
        Rules {
            players: 2,
            goal: 30,
            hand: 6,
            start_common: 5,
            start_gold: 1,
            market_each: 4,
            market_one: 6,
            market_gold: 8,
            market_high_gold: 4,
            bought_plays: true,
            max_rounds: 200,
            cards: (1u16 << Mission::CARDS.len()) - 1,
            sacrifice: true,
            bonus: 1,
            parity_minus: 0,
            cash: true,
            sabotage_by_die: false,
        }
    }
}

/// Where a marker stands: the standard mission or a card of the table.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Spot {
    Standard,
    Card(usize),
}

/// How a sabotage is paid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Payment {
    Point,
    /// A die of the hand, by its index: it leaves the hand and the game.
    Die(usize),
}

/// A turn of the mission phase.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    /// Out of the phase for the round.
    Pass,
    /// Remove a die from the hand and reroll the others listed, at once.
    Sacrifice { out: usize, rerolls: Vec<usize> },
    /// A die on 0 rerolls another counted die.
    Zero { zero: usize, target: usize },
    /// A modifier on 1 or 2 moves another counted die up or down by its
    /// face, kept within 1 and 6.
    Modify {
        modifier: usize,
        target: usize,
        up: bool,
    },
    /// Remove a mission of the table for the round, the standard too; its
    /// players move their markers. The last mission cannot be sabotaged.
    Sabotage { spot: Spot, payment: Payment },
}

/// The decisions of a player. Each call gets the table and the round as
/// they are; an illegal answer stops the game with an error.
pub trait Player {
    /// The indices in the reserve of the dice to roll: `rules.hand` of
    /// them, or the whole reserve if it is smaller.
    fn select(&mut self, game: &Game, me: usize) -> Vec<usize>;
    /// The indices in the reserve of dice out of the hand to take out of
    /// the game, for 1 money each. Every player answers before any is
    /// taken out.
    fn cash(&mut self, game: &Game, round: &Round, me: usize) -> Vec<usize>;
    /// The index of a die in the showcase to buy, or `None`.
    fn buy(&mut self, game: &Game, round: &Round, me: usize) -> Option<usize>;
    /// Where to put the marker: asked in the order of the round, and again
    /// when the card of the marker is sabotaged.
    fn place(&mut self, game: &Game, round: &Round, me: usize) -> Spot;
    /// A turn of the mission phase, until the player passes.
    fn act(&mut self, game: &Game, round: &Round, me: usize) -> Action;
}

/// The state of the round being played.
#[derive(Clone, Debug)]
pub struct Round {
    pub rolls: Vec<Vec<Rolled>>,
    /// For each die of the hand, its index in the reserve.
    pub sources: Vec<Vec<usize>>,
    /// The money from reserve dice taken out of the game.
    pub cash: Vec<i32>,
    /// The order of the round: by the money, highest first.
    pub order: Vec<usize>,
    pub bought: Vec<Option<Kind>>,
    /// The dice each player removed from the hand in a sacrifice.
    pub removed: Vec<Vec<bool>>,
    /// The zeros and modifiers already used.
    pub used: Vec<Vec<bool>>,
    /// The cards of the table; `None` once sabotaged.
    pub table: Vec<Option<Mission>>,
    /// Whether the standard mission is on the table: not sabotaged.
    pub standard: bool,
    /// The markers; `None` before the player places it.
    pub markers: Vec<Option<Spot>>,
}

impl Round {
    /// Whether die `i` of player `p` is still in the hand.
    pub fn in_hand(&self, p: usize, i: usize) -> bool {
        !self.removed[p][i]
    }

    /// Whether die `i` of player `p` counts in the mission.
    pub fn counts(&self, p: usize, i: usize) -> bool {
        let die = self.rolls[p][i];
        self.in_hand(p, i)
            && die.value().is_some()
            && !(die.kind.is_gold() && self.bought[p].is_some())
    }

    /// The values player `p` counts in the mission.
    pub fn hand(&self, p: usize) -> Vec<u8> {
        (0..self.rolls[p].len())
            .filter(|&i| self.counts(p, i))
            .filter_map(|i| self.rolls[p][i].value())
            .collect()
    }

    /// The sum of the gold dice in the hand of player `p`.
    pub fn gold(&self, p: usize) -> i32 {
        (0..self.rolls[p].len())
            .filter(|&i| self.in_hand(p, i) && self.rolls[p][i].kind.is_gold())
            .map(|i| self.rolls[p][i].face as i32)
            .sum()
    }

    /// The money of player `p`: its gold in the hand and its cash.
    pub fn money(&self, p: usize) -> i32 {
        self.gold(p) + self.cash[p]
    }

    /// The mission at `spot`, if it is still there.
    pub fn mission(&self, spot: Spot) -> Option<Mission> {
        match spot {
            Spot::Standard => self.standard.then_some(Mission::Standard),
            Spot::Card(i) => self.table.get(i).copied().flatten(),
        }
    }

    /// The spots a marker can go to.
    pub fn spots(&self) -> Vec<Spot> {
        self.standard
            .then_some(Spot::Standard)
            .into_iter()
            .chain(
                (0..self.table.len())
                    .filter(|&i| self.table[i].is_some())
                    .map(Spot::Card),
            )
            .collect()
    }

    /// The points of every player as the dice and markers stand; a player
    /// without a marker counts on the standard mission.
    pub fn score(&self, scoring: Scoring) -> Vec<i32> {
        let n = self.rolls.len();
        let at = |p: usize| self.markers[p].unwrap_or(Spot::Standard);
        let mut points = vec![0; n];
        let mut done: Vec<Spot> = Vec::new();
        for p in 0..n {
            let spot = at(p);
            if done.contains(&spot) {
                continue;
            }
            done.push(spot);
            let players: Vec<usize> = (0..n).filter(|&q| at(q) == spot).collect();
            let hands: Vec<Vec<u8>> = players.iter().map(|&q| self.hand(q)).collect();
            let mission = self.mission(spot).unwrap_or(Mission::Standard);
            for (&q, d) in players.iter().zip(resolve(mission, &hands, scoring)) {
                points[q] = d;
            }
        }
        points
    }
}

/// What happened in a round, for the statistics.
#[derive(Clone, Debug)]
pub struct RoundLog {
    pub order: Vec<usize>,
    pub bought: Vec<Option<Kind>>,
    /// The mission each player ended on.
    pub missions: Vec<Mission>,
    pub sacrifices: Vec<u32>,
    pub cashed: Vec<u32>,
    /// `(player, mission, paid with a point)`.
    pub sabotages: Vec<(usize, Mission, bool)>,
    pub deltas: Vec<i32>,
}

/// The table between rounds.
#[derive(Clone, Debug)]
pub struct Game {
    pub rules: Rules,
    pub reserves: Vec<Vec<Kind>>,
    pub points: Vec<i32>,
    /// The mission cards on the table, one per player.
    pub table: Vec<Mission>,
    pub deck: Vec<Mission>,
    pub used: Vec<Mission>,
    pub showcase: Vec<Kind>,
    pub market: Vec<Kind>,
    pub round: u16,
    pub(crate) rng: Rng,
}

impl Game {
    pub fn new(rules: Rules, seed: u64) -> Game {
        let mut rng = Rng::new(seed);
        let n = rules.players;
        let start: Vec<Kind> = std::iter::repeat_n(Kind::Common, rules.start_common as usize)
            .chain(std::iter::repeat_n(Kind::Gold, rules.start_gold as usize))
            .collect();
        let mut deck: Vec<Mission> = (0..Mission::CARDS.len())
            .filter(|&i| rules.cards >> i & 1 == 1)
            .flat_map(|i| std::iter::repeat_n(Mission::CARDS[i], Mission::CARDS[i].copies()))
            .collect();
        rng.shuffle(&mut deck);
        let mut market: Vec<Kind> = Kind::SPECIAL
            .iter()
            .flat_map(|&k| {
                let count = if k == Kind::One {
                    rules.market_one
                } else {
                    rules.market_each
                };
                std::iter::repeat_n(k, count as usize)
            })
            .chain(std::iter::repeat_n(Kind::Gold, rules.market_gold as usize))
            .chain(std::iter::repeat_n(
                Kind::HighGold,
                rules.market_high_gold as usize,
            ))
            .collect();
        rng.shuffle(&mut market);
        let mut game = Game {
            rules,
            reserves: vec![start; n],
            points: vec![0; n],
            table: Vec::new(),
            deck,
            used: Vec::new(),
            showcase: Vec::new(),
            market,
            round: 0,
            rng,
        };
        game.refill();
        game
    }

    pub fn players(&self) -> usize {
        self.rules.players
    }

    pub fn is_over(&self) -> bool {
        self.round >= self.rules.max_rounds || self.points.iter().any(|&p| p >= self.rules.goal)
    }

    /// The players with the most points.
    pub fn leaders(&self) -> Vec<usize> {
        let top = *self.points.iter().max().unwrap();
        (0..self.players())
            .filter(|&p| self.points[p] == top)
            .collect()
    }

    /// The winners at the end: the leaders with the most dice in the
    /// reserve.
    pub fn winners(&self) -> Vec<usize> {
        let leaders = self.leaders();
        let most = leaders
            .iter()
            .map(|&p| self.reserves[p].len())
            .max()
            .unwrap();
        leaders
            .into_iter()
            .filter(|&p| self.reserves[p].len() == most)
            .collect()
    }

    pub(crate) fn refill(&mut self) {
        while self.table.len() < self.players() {
            if self.deck.is_empty() {
                if self.used.is_empty() {
                    break;
                }
                self.deck.append(&mut self.used);
                self.rng.shuffle(&mut self.deck);
            }
            self.table.push(self.deck.pop().unwrap());
        }
        while self.showcase.len() < 2 * self.players() {
            match self.market.pop() {
                Some(kind) => self.showcase.push(kind),
                None => break,
            }
        }
    }

    pub fn play(&mut self, players: &mut [Box<dyn Player>]) -> Result<Vec<RoundLog>, String> {
        let mut logs = Vec::new();
        while !self.is_over() {
            logs.push(self.play_round(players)?);
        }
        Ok(logs)
    }

    /// Plays a round, asking `players` each decision, through [`Steps`].
    pub fn play_round(&mut self, players: &mut [Box<dyn Player>]) -> Result<RoundLog, String> {
        let start = self.round;
        let mut steps = Steps::new(self.clone());
        while steps.game().round == start {
            let pending = steps.pending().ok_or("the game is over")?;
            let answer = steps.ask(players[pending.player].as_mut()).unwrap();
            steps.apply(answer)?;
        }
        let (game, played) = steps.into_parts();
        *self = game;
        Ok(played.unwrap().log)
    }

    /// Takes die `r` of the reserve of `p` out of the game, keeping the
    /// sources of the hand right.
    pub(crate) fn take_out(&mut self, round: &mut Round, p: usize, r: usize) {
        self.reserves[p].remove(r);
        for s in round.sources[p].iter_mut() {
            if *s == r {
                *s = usize::MAX;
            } else if *s > r && *s != usize::MAX {
                *s -= 1;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_tie_goes_to_the_largest_reserve() {
        let mut game = Game::new(Rules::default(), 1);
        game.points = vec![30, 30];
        assert_eq!(game.winners(), vec![0, 1]);
        game.reserves[1].push(Kind::High);
        assert_eq!(game.winners(), vec![1]);
        game.points[0] = 31;
        assert_eq!(game.winners(), vec![0]);
    }
}
