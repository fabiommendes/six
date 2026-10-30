//! JSON adapter and TypeScript types of the mission game.
//!
//! The engine is built for bot batches and carries no serde, so the wire
//! types live here and mirror the engine types:
//!
//! - [`Kind`], [`Mission`], [`Spot`] and [`Action`]: the pieces of the game.
//! - [`Answer`]: the answer to the pending decision.
//! - [`View`]: what an interface shows: the table, the round in progress,
//!   the pending decision with its legal options, the last round scored and
//!   the winners.
//! - [`Step`]: the answer just played and the new view.
//!
//! Dice of a hand are indexed in the order of the hand, and dice of a
//! reserve in the order of the reserve, as in the engine.

use missoes_engine as engine;
use missoes_engine::{Payment, Steps};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub fn to_json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).expect("the wire types always serialize")
}

pub fn from_json<'a, T: Deserialize<'a>>(json: &'a str) -> Result<T, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

/// A kind of die, as `missoes_engine::Kind`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Kind {
    Common,
    Gold,
    HighGold,
    One,
    Low,
    High,
    Even,
    Odd,
    Binary,
    Modifier,
}

impl From<engine::Kind> for Kind {
    fn from(kind: engine::Kind) -> Kind {
        match kind {
            engine::Kind::Common => Kind::Common,
            engine::Kind::Gold => Kind::Gold,
            engine::Kind::HighGold => Kind::HighGold,
            engine::Kind::One => Kind::One,
            engine::Kind::Low => Kind::Low,
            engine::Kind::High => Kind::High,
            engine::Kind::Even => Kind::Even,
            engine::Kind::Odd => Kind::Odd,
            engine::Kind::Binary => Kind::Binary,
            engine::Kind::Modifier => Kind::Modifier,
        }
    }
}

/// A mission, as `missoes_engine::Mission`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Mission {
    Standard,
    Present,
    Sequence,
    Even,
    Odd,
    High,
    Low,
    TwoGroups,
}

impl From<engine::Mission> for Mission {
    fn from(mission: engine::Mission) -> Mission {
        match mission {
            engine::Mission::Standard => Mission::Standard,
            engine::Mission::Present => Mission::Present,
            engine::Mission::Sequence => Mission::Sequence,
            engine::Mission::Even => Mission::Even,
            engine::Mission::Odd => Mission::Odd,
            engine::Mission::High => Mission::High,
            engine::Mission::Low => Mission::Low,
            engine::Mission::TwoGroups => Mission::TwoGroups,
        }
    }
}

/// Where a marker stands: the standard mission or card `card` of the table.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum Spot {
    Standard,
    Card { card: usize },
}

impl From<engine::Spot> for Spot {
    fn from(spot: engine::Spot) -> Spot {
        match spot {
            engine::Spot::Standard => Spot::Standard,
            engine::Spot::Card(card) => Spot::Card { card },
        }
    }
}

impl From<Spot> for engine::Spot {
    fn from(spot: Spot) -> engine::Spot {
        match spot {
            Spot::Standard => engine::Spot::Standard,
            Spot::Card { card } => engine::Spot::Card(card),
        }
    }
}

/// A turn of the mission phase, by dice of the hand. A sabotage is paid
/// with points.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum Action {
    Pass,
    /// Remove die `out` and reroll the dice `rerolls`, at once.
    Sacrifice {
        out: usize,
        rerolls: Vec<usize>,
    },
    /// Die `zero`, on 0, rerolls die `target`.
    Zero {
        zero: usize,
        target: usize,
    },
    /// Modifier `modifier` moves die `target` up or down by its face.
    Modify {
        modifier: usize,
        target: usize,
        up: bool,
    },
    /// Remove card `card` of the table, for points (`View.sabotageCost`).
    Sabotage {
        card: usize,
    },
}

impl From<Action> for engine::Action {
    fn from(action: Action) -> engine::Action {
        match action {
            Action::Pass => engine::Action::Pass,
            Action::Sacrifice { out, rerolls } => engine::Action::Sacrifice { out, rerolls },
            Action::Zero { zero, target } => engine::Action::Zero { zero, target },
            Action::Modify {
                modifier,
                target,
                up,
            } => engine::Action::Modify {
                modifier,
                target,
                up,
            },
            Action::Sabotage { card } => engine::Action::Sabotage {
                card,
                payment: Payment::Point,
            },
        }
    }
}

impl TryFrom<engine::Action> for Action {
    type Error = String;

    fn try_from(action: engine::Action) -> Result<Action, String> {
        Ok(match action {
            engine::Action::Pass => Action::Pass,
            engine::Action::Sacrifice { out, rerolls } => Action::Sacrifice { out, rerolls },
            engine::Action::Zero { zero, target } => Action::Zero { zero, target },
            engine::Action::Modify {
                modifier,
                target,
                up,
            } => Action::Modify {
                modifier,
                target,
                up,
            },
            engine::Action::Sabotage {
                card,
                payment: Payment::Point,
            } => Action::Sabotage { card },
            engine::Action::Sabotage { .. } => return Err("a sabotage paid with a die".into()),
        })
    }
}

/// The answer to the pending decision.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum Answer {
    /// The reserve dice to roll.
    Select {
        dice: Vec<usize>,
    },
    /// The reserve dice out of the hand to take out, for 1 money each.
    Cash {
        dice: Vec<usize>,
    },
    /// The showcase die to buy, or `null`.
    Buy {
        die: Option<usize>,
    },
    Place {
        spot: Spot,
    },
    Act {
        action: Action,
    },
}

impl From<Answer> for engine::Answer {
    fn from(answer: Answer) -> engine::Answer {
        match answer {
            Answer::Select { dice } => engine::Answer::Select(dice),
            Answer::Cash { dice } => engine::Answer::Cash(dice),
            Answer::Buy { die } => engine::Answer::Buy(die),
            Answer::Place { spot } => engine::Answer::Place(spot.into()),
            Answer::Act { action } => engine::Answer::Act(action.into()),
        }
    }
}

impl TryFrom<engine::Answer> for Answer {
    type Error = String;

    fn try_from(answer: engine::Answer) -> Result<Answer, String> {
        Ok(match answer {
            engine::Answer::Select(dice) => Answer::Select { dice },
            engine::Answer::Cash(dice) => Answer::Cash { dice },
            engine::Answer::Buy(die) => Answer::Buy { die },
            engine::Answer::Place(spot) => Answer::Place { spot: spot.into() },
            engine::Answer::Act(action) => Answer::Act {
                action: action.try_into()?,
            },
        })
    }
}

/// A die of a hand.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Die {
    pub kind: Kind,
    /// The face on top: 0 to 6, or 0 to 2 on a modifier (moved by ±1 or ±2).
    pub face: i8,
    /// Its index in the reserve, `null` once it left the game.
    pub source: Option<usize>,
    /// Removed in a sacrifice.
    pub removed: bool,
    /// A zero or a modifier already used.
    pub used: bool,
    /// Whether it counts in the mission.
    pub counts: bool,
}

fn hands(round: &engine::Round) -> Vec<Vec<Die>> {
    (0..round.rolls.len())
        .map(|p| {
            (0..round.rolls[p].len())
                .map(|i| {
                    let die = round.rolls[p][i];
                    let source = round.sources[p][i];
                    Die {
                        kind: die.kind.into(),
                        face: die.face,
                        source: (source != usize::MAX).then_some(source),
                        removed: round.removed[p][i],
                        used: round.used[p][i],
                        counts: round.counts(p, i),
                    }
                })
                .collect()
        })
        .collect()
}

/// For each player, the result of the hand on each spot: the standard
/// mission first, then the cards of the table in order (0 for a card
/// sabotaged).
fn results(round: &engine::Round, bonus: u8) -> Vec<Vec<u8>> {
    (0..round.rolls.len())
        .map(|p| {
            let hand = round.hand(p);
            std::iter::once(engine::Spot::Standard)
                .chain((0..round.table.len()).map(engine::Spot::Card))
                .map(|spot| round.mission(spot).map_or(0, |m| m.result(&hand, bonus)))
                .collect()
        })
        .collect()
}

/// The round in progress.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RoundView {
    /// The hand of each player; empty before the player selects.
    pub hands: Vec<Vec<Die>>,
    /// The money from reserve dice taken out.
    pub cash: Vec<i32>,
    /// The sum of the gold dice in the hand.
    pub gold: Vec<i32>,
    /// Gold and cash: it orders the round.
    pub money: Vec<i32>,
    /// The order of the round, empty before the money is known.
    pub order: Vec<usize>,
    pub bought: Vec<Option<Kind>>,
    /// The cards of the table, `null` once sabotaged.
    pub table: Vec<Option<Mission>>,
    pub markers: Vec<Option<Spot>>,
    /// Who has not passed in the mission phase.
    pub active: Vec<bool>,
    /// For each player, the result on the standard and on each card.
    pub results: Vec<Vec<u8>>,
    /// The points of the round as the dice and markers stand.
    pub score: Vec<i32>,
}

/// A die of the hand that rerolls or moves others, and the dice it can
/// target.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Use {
    pub die: usize,
    pub targets: Vec<usize>,
}

/// The pending decision and its legal options.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum Decision {
    /// Pick `count` dice of the reserve.
    Select { count: usize },
    /// Pick any of `options`, reserve dice out of the hand.
    Cash { options: Vec<usize> },
    /// Buy one of the showcase, or none.
    Buy { options: Vec<usize> },
    /// Put the marker on one of `spots`; `moved` when its card was
    /// sabotaged.
    Place { spots: Vec<Spot>, moved: bool },
    /// A turn: the dice that can be sacrificed (any other dice of the hand
    /// can be rerolled with it), the zeros and modifiers ready, and the
    /// cards that can be sabotaged. Passing is always legal.
    Act {
        sacrifice: Vec<usize>,
        zeros: Vec<Use>,
        modifiers: Vec<Use>,
        sabotage: Vec<usize>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Pending {
    pub player: usize,
    pub decision: Decision,
}

impl Pending {
    /// The pending decision of `steps`, with the options the engine accepts.
    fn of(steps: &Steps) -> Option<Pending> {
        let pending = steps.pending()?;
        let (game, round, p) = (steps.game(), steps.round()?, pending.player);
        let legal = |answer: engine::Answer| steps.check(&answer).is_ok();
        let act = |action: engine::Action| legal(engine::Answer::Act(action));
        let size = round.rolls[p].len();
        let decision = match pending.decision {
            engine::Decision::Select => Decision::Select {
                count: game.rules.hand.min(game.reserves[p].len()),
            },
            engine::Decision::Cash => Decision::Cash {
                options: (0..game.reserves[p].len())
                    .filter(|&r| legal(engine::Answer::Cash(vec![r])))
                    .collect(),
            },
            engine::Decision::Buy => Decision::Buy {
                options: (0..game.showcase.len()).collect(),
            },
            engine::Decision::Place { moved } => Decision::Place {
                spots: round.spots().into_iter().map(Spot::from).collect(),
                moved,
            },
            engine::Decision::Act => {
                let uses = |make: &dyn Fn(usize, usize) -> engine::Action| {
                    (0..size)
                        .map(|die| Use {
                            die,
                            targets: (0..size).filter(|&t| act(make(die, t))).collect(),
                        })
                        .filter(|u| !u.targets.is_empty())
                        .collect()
                };
                Decision::Act {
                    sacrifice: (0..size)
                        .filter(|&out| {
                            act(engine::Action::Sacrifice {
                                out,
                                rerolls: Vec::new(),
                            })
                        })
                        .collect(),
                    zeros: uses(&|zero, target| engine::Action::Zero { zero, target }),
                    modifiers: uses(&|modifier, target| engine::Action::Modify {
                        modifier,
                        target,
                        up: true,
                    }),
                    sabotage: (0..round.table.len())
                        .filter(|&card| {
                            act(engine::Action::Sabotage {
                                card,
                                payment: Payment::Point,
                            })
                        })
                        .collect(),
                }
            }
        };
        Some(Pending {
            player: p,
            decision,
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Sabotage {
    pub player: usize,
    pub mission: Mission,
}

/// The last round scored: the hands as they ended and what each player
/// made.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Played {
    /// The number of the round, from 1.
    pub round: u16,
    pub hands: Vec<Vec<Die>>,
    pub order: Vec<usize>,
    pub bought: Vec<Option<Kind>>,
    /// The mission each player ended on.
    pub missions: Vec<Mission>,
    /// The result of each player on its mission, won or not.
    pub results: Vec<u8>,
    /// The points each player won.
    pub deltas: Vec<i32>,
    pub cashed: Vec<u32>,
    pub sacrifices: Vec<u32>,
    pub sabotages: Vec<Sabotage>,
}

impl Played {
    fn of(steps: &Steps) -> Option<Played> {
        let last = steps.last()?;
        let (round, log) = (&last.round, &last.log);
        let bonus = steps.game().rules.bonus;
        Some(Played {
            round: steps.game().round,
            hands: hands(round),
            order: log.order.clone(),
            bought: log.bought.iter().map(|k| k.map(Kind::from)).collect(),
            missions: log.missions.iter().map(|&m| m.into()).collect(),
            results: (0..log.missions.len())
                .map(|p| log.missions[p].result(&round.hand(p), bonus))
                .collect(),
            deltas: log.deltas.clone(),
            cashed: log.cashed.clone(),
            sacrifices: log.sacrifices.clone(),
            sabotages: log
                .sabotages
                .iter()
                .map(|&(player, mission, _)| Sabotage {
                    player,
                    mission: mission.into(),
                })
                .collect(),
        })
    }
}

/// What an interface shows.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct View {
    pub players: usize,
    /// The points that end the game.
    pub goal: i32,
    /// The points a sabotage costs.
    pub sabotage_cost: i32,
    /// Rounds played.
    pub round: u16,
    pub points: Vec<i32>,
    pub reserves: Vec<Vec<Kind>>,
    /// The mission cards of the table at the start of the round.
    pub table: Vec<Mission>,
    /// The dice for sale.
    pub showcase: Vec<Kind>,
    /// Dice left in the market, out of the showcase.
    pub market: usize,
    /// Cards left in the deck.
    pub deck: usize,
    /// The bot of each seat, `null` for a person.
    pub bots: Vec<Option<String>>,
    /// The round in progress, `null` once the game is over.
    pub current: Option<RoundView>,
    pub pending: Option<Pending>,
    pub last: Option<Played>,
    /// The winners, once the game is over: the most points, then the
    /// largest reserve.
    pub winners: Option<Vec<usize>>,
}

impl View {
    pub fn of(steps: &Steps, bots: &[Option<String>]) -> View {
        let game = steps.game();
        let bonus = game.rules.bonus;
        let current = steps.round().map(|round| RoundView {
            hands: hands(round),
            cash: round.cash.clone(),
            gold: (0..game.players()).map(|p| round.gold(p)).collect(),
            money: (0..game.players()).map(|p| round.money(p)).collect(),
            order: round.order.clone(),
            bought: round.bought.iter().map(|k| k.map(Kind::from)).collect(),
            table: round.table.iter().map(|m| m.map(Mission::from)).collect(),
            markers: round.markers.iter().map(|s| s.map(Spot::from)).collect(),
            active: steps.active().to_vec(),
            results: results(round, bonus),
            score: round.score(bonus),
        });
        View {
            players: game.players(),
            goal: game.rules.goal,
            sabotage_cost: game.rules.sabotage_points(),
            round: game.round,
            points: game.points.clone(),
            reserves: game
                .reserves
                .iter()
                .map(|r| r.iter().map(|&k| k.into()).collect())
                .collect(),
            table: game.table.iter().map(|&m| m.into()).collect(),
            showcase: game.showcase.iter().map(|&k| k.into()).collect(),
            market: game.market.len(),
            deck: game.deck.len(),
            bots: bots.to_vec(),
            current,
            pending: Pending::of(steps),
            last: Played::of(steps),
            winners: steps.is_over().then(|| game.winners()),
        }
    }
}

/// The setup of a new game.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Setup {
    /// The bot of each seat (a name of `missoes_bots::by_name`), `null` for
    /// a person: 2 to 4 seats.
    pub bots: Vec<Option<String>>,
    /// The points that end the game; the rules' 30 when `null`.
    #[ts(optional)]
    #[serde(default)]
    pub goal: Option<i32>,
}

/// The answer just played, by whom, and the new view.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Step {
    pub player: usize,
    pub answer: Answer,
    pub view: View,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_cross_as_tagged_json() {
        let answer: Answer = from_json(
            r#"{"kind":"act","action":{"kind":"modify","modifier":1,"target":2,"up":false}}"#,
        )
        .unwrap();
        assert_eq!(
            engine::Answer::from(answer),
            engine::Answer::Act(engine::Action::Modify {
                modifier: 1,
                target: 2,
                up: false
            })
        );
        let place: Answer =
            from_json(r#"{"kind":"place","spot":{"kind":"card","card":2}}"#).unwrap();
        assert_eq!(
            engine::Answer::from(place),
            engine::Answer::Place(engine::Spot::Card(2))
        );
        let buy: Answer = from_json(r#"{"kind":"buy","die":null}"#).unwrap();
        assert_eq!(engine::Answer::from(buy), engine::Answer::Buy(None));
    }

    #[test]
    fn the_first_view_asks_the_first_player_to_select() {
        let steps = Steps::new(engine::Game::new(engine::Rules::default(), 4));
        let view = View::of(&steps, &[None, None]);
        assert_eq!(view.reserves[0].len(), 6);
        assert_eq!(view.showcase.len(), 4);
        assert_eq!(view.table.len(), 2);
        assert_eq!(
            view.pending,
            Some(Pending {
                player: 0,
                decision: Decision::Select { count: 6 }
            })
        );
        assert!(view.current.unwrap().hands.iter().all(|h| h.is_empty()));
    }
}
