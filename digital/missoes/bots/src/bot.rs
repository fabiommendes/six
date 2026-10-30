//! The bots.

use missoes_engine::{Action, Game, Kind, Mission, Payment, Player, Rng, Rolled, Round, Spot};

/// The names [`by_name`] knows.
pub const BOTS: [&str; 5] = ["random", "greedy", "nobuy", "nosabotage", "nosac"];

/// A name of [`BOTS`], and for the greedy bots optional settings after
/// dashes: `-fF` scales the rounds to come in the purchases and payments
/// (1 by default), `-gG` is the preference for gold dice (0), `-uU` is
/// added to the worth of buying a one die (0), `-sS` is the number of
/// samples of a hand's strength (128).
/// Example: `greedy-f0.5-g0`.
pub fn by_name(name: &str, seed: u64) -> Result<Box<dyn Player>, String> {
    let mut parts = name.split('-');
    let base = parts.next().unwrap_or_default();
    let unknown = || format!("unknown bot {name:?}; bots: {}", BOTS.join(", "));
    let (buys, sabotages, sacrifices) = match base {
        "random" if name == "random" => return Ok(Box::new(Random(Rng::new(seed)))),
        "greedy" => (true, true, true),
        "nobuy" => (false, true, true),
        "nosabotage" => (true, false, true),
        "nosac" => (true, true, false),
        _ => return Err(unknown()),
    };
    let mut greedy = Greedy::new(seed, buys, sabotages, sacrifices);
    for part in parts {
        let (key, number) = part.split_at(part.len().min(1));
        let number: f64 = number.parse().map_err(|_| unknown())?;
        match key {
            "f" => greedy.future = number,
            "g" => greedy.gold_bonus = number,
            "u" => greedy.one_bonus = number,
            "s" => greedy.samples = number as usize,
            _ => return Err(unknown()),
        }
    }
    Ok(Box::new(greedy))
}

/// The bot's view of the round: its points minus the best of the others.
fn margin(game: &Game, round: &Round, me: usize) -> f64 {
    let points = round.score(game.rules.scoring());
    let best_other = (0..points.len())
        .filter(|&p| p != me)
        .map(|p| points[p])
        .max()
        .unwrap_or(0);
    (points[me] - best_other) as f64
}

/// The spot with the best margin for `me`, the standard on a tie.
fn best_spot(game: &Game, round: &Round, me: usize) -> Spot {
    let mut trial = round.clone();
    let mut best = (f64::MIN, Spot::Standard);
    for spot in round.spots() {
        trial.markers[me] = Some(spot);
        let m = margin(game, &trial, me);
        if m > best.0 {
            best = (m, spot);
        }
    }
    best.1
}

/// What a mission keeps of a hand: the dice with a value in the bits of
/// `values`, or with `single`, one die of each value.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Plan {
    values: u8,
    single: bool,
}

impl Plan {
    const fn of(values: u8) -> Plan {
        Plan {
            values,
            single: false,
        }
    }

    /// The plans worth trying for `mission`.
    fn all(mission: Mission) -> Vec<Plan> {
        match mission {
            Mission::Standard | Mission::Bonus => (1..=6).map(|v| Plan::of(1 << v)).collect(),
            Mission::Number(n) => vec![Plan::of(1 << n)],
            Mission::Even => vec![Plan::of(0b101_0100)],
            Mission::Odd => vec![Plan::of(0b010_1010)],
            Mission::High => vec![Plan::of(0b110_0000)],
            Mission::Low => vec![Plan::of(0b000_0110)],
            Mission::TwoGroups => (1..=6)
                .flat_map(|a| (a + 1..=6).map(move |b| Plan::of(1 << a | 1 << b)))
                .collect(),
            Mission::Distinct => vec![Plan {
                values: 0b111_1110,
                single: true,
            }],
        }
    }

    /// Which dice of the hand of `me` the plan keeps.
    fn kept(self, round: &Round, me: usize) -> Vec<bool> {
        let mut seen = 0u8;
        (0..round.rolls[me].len())
            .map(|i| {
                let Some(v) = round.rolls[me][i].value().filter(|_| round.counts(me, i)) else {
                    return false;
                };
                let keep = self.values >> v & 1 == 1 && !(self.single && seen >> v & 1 == 1);
                seen |= 1 << v;
                keep
            })
            .collect()
    }

    /// The chance that a reroll of `kind` lands on a value the plan keeps,
    /// with `have` the bits of the values kept so far.
    fn hit(self, kind: Kind, have: u8) -> f64 {
        if kind == Kind::Modifier {
            return 0.0;
        }
        let wanted = if self.single {
            self.values & !have
        } else {
            self.values
        };
        let faces = kind.faces();
        faces
            .iter()
            .filter(|&&f| f > 0 && wanted >> f & 1 == 1)
            .count() as f64
            / 6.0
    }

    /// The sacrifice that follows the plan: the die off the plan least
    /// likely to help on a reroll goes out, keeping unused zeros and
    /// modifiers for last, and the other dice off the plan that may help
    /// are rerolled. `None` without dice to reroll. Also gives how much the
    /// plan already keeps, for choosing among plans.
    fn sacrifice(self, round: &Round, me: usize) -> (f64, Option<Action>) {
        let kept = self.kept(round, me);
        let have = (0..kept.len())
            .filter(|&i| kept[i])
            .fold(0u8, |bits, i| bits | 1 << round.rolls[me][i].face);
        let die = |i: usize| round.rolls[me][i];
        let fresh_action =
            |i: usize| !round.used[me][i] && (die(i).is_zero() || die(i).kind == Kind::Modifier);
        let mut off: Vec<usize> = (0..kept.len())
            .filter(|&i| round.in_hand(me, i) && !kept[i])
            .collect();
        let hope: f64 = off.iter().map(|&i| self.hit(die(i).kind, have)).sum();
        let worth = kept.iter().filter(|&&k| k).count() as f64 + hope / 2.0;
        off.sort_by(|&i, &j| {
            (fresh_action(i), self.hit(die(i).kind, have))
                .partial_cmp(&(fresh_action(j), self.hit(die(j).kind, have)))
                .unwrap()
        });
        let Some((&out, rest)) = off.split_first() else {
            return (worth, None);
        };
        let rerolls: Vec<usize> = rest
            .iter()
            .copied()
            .filter(|&i| !round.used[me][i] && self.hit(die(i).kind, have) > 0.0)
            .collect();
        if rerolls.is_empty() {
            return (worth, None);
        }
        (worth, Some(Action::Sacrifice { out, rerolls }))
    }
}

/// Plays the sacrifices of `me` on its mission to the end, following the
/// best plan at each step, with dice rolled by `rng`.
fn play_mission(game: &Game, round: &mut Round, me: usize, rng: &mut Rng) {
    let Some(mission) = round.markers[me].and_then(|spot| round.mission(spot)) else {
        return;
    };
    if !game.rules.sacrifice {
        return;
    }
    loop {
        let best = Plan::all(mission)
            .into_iter()
            .map(|plan| plan.sacrifice(round, me))
            .max_by(|a, b| a.0.total_cmp(&b.0));
        let Some((_, Some(Action::Sacrifice { out, rerolls }))) = best else {
            return;
        };
        round.removed[me][out] = true;
        for i in rerolls {
            round.rolls[me][i] = round.rolls[me][i].kind.roll(rng);
        }
    }
}

/// The chance that a roll of `kind` shows `value` and counts it.
fn chance(kind: Kind, value: u8) -> f64 {
    if kind == Kind::Modifier {
        return 0.0;
    }
    kind.faces().iter().filter(|&&f| f == value as i8).count() as f64 / 6.0
}

/// The value to gather in `rolls`: the largest group, and on a tie the one
/// the other dice are likeliest to join on a reroll. Gives `(count, value)`.
fn target(rolls: &[Rolled]) -> (u8, u8) {
    let mut best = (0.0, 0, 0);
    for v in 1..=6u8 {
        let count = rolls.iter().filter(|d| d.value() == Some(v)).count() as u8;
        let hope: f64 = rolls
            .iter()
            .filter(|d| d.value().is_some_and(|x| x != v))
            .map(|d| chance(d.kind, v))
            .sum();
        let score = count as f64 + hope / 6.0;
        if count > 0 && score > best.0 {
            best = (score, count, v);
        }
    }
    (best.1, best.2)
}

/// A quick play of a hand for the standard mission: the zeros reroll a die
/// off the target value, the modifiers move a die onto it from either side,
/// and then the die off the value least likely to hit it, first the ones
/// that do not count, is sacrificed in turn to reroll the others off it.
/// Gives the best group, `(count, value)`.
fn play_out(mut rolls: Vec<Rolled>, rng: &mut Rng) -> (u8, u8) {
    let zeros = rolls.iter().filter(|d| d.is_zero()).count();
    for _ in 0..zeros {
        let (_, best) = target(&rolls);
        if let Some(d) = rolls
            .iter_mut()
            .filter(|d| d.value().is_some_and(|v| v != best) && chance(d.kind, best) > 0.0)
            .max_by(|a, b| chance(a.kind, best).total_cmp(&chance(b.kind, best)))
        {
            *d = d.kind.roll(rng);
        }
    }
    let steps: Vec<i8> = rolls
        .iter()
        .filter(|d| d.kind == Kind::Modifier && !d.is_zero())
        .map(|d| d.face)
        .collect();
    for step in steps {
        let (_, best) = target(&rolls);
        let near = |f: i8| f == best as i8 - step || f == best as i8 + step;
        if let Some(d) = rolls
            .iter_mut()
            .find(|d| d.value().is_some_and(|v| v != best) && near(d.face))
        {
            d.face = best as i8;
        }
    }
    loop {
        let (count, best) = target(&rolls);
        let mut off: Vec<usize> = (0..rolls.len())
            .filter(|&i| rolls[i].value() != Some(best))
            .collect();
        off.sort_by(|&i, &j| chance(rolls[i].kind, best).total_cmp(&chance(rolls[j].kind, best)));
        if off.len() < 2 || chance(rolls[*off.last().unwrap()].kind, best) == 0.0 {
            return (count, best);
        }
        let out = off.remove(0);
        for &i in &off {
            if chance(rolls[i].kind, best) > 0.0 {
                rolls[i] = rolls[i].kind.roll(rng);
            }
        }
        rolls.remove(out);
    }
}

/// Plays at random among the legal decisions.
pub struct Random(Rng);

impl Player for Random {
    fn select(&mut self, game: &Game, me: usize) -> Vec<usize> {
        let mut all: Vec<usize> = (0..game.reserves[me].len()).collect();
        self.0.shuffle(&mut all);
        all.truncate(game.rules.hand);
        all
    }

    fn cash(&mut self, game: &Game, round: &Round, me: usize) -> Vec<usize> {
        let outside: Vec<usize> = (0..game.reserves[me].len())
            .filter(|r| !round.sources[me].contains(r))
            .collect();
        if outside.is_empty() || self.0.below(5) != 0 {
            return Vec::new();
        }
        vec![outside[self.0.below(outside.len())]]
    }

    fn buy(&mut self, game: &Game, _: &Round, _: usize) -> Option<usize> {
        (self.0.below(2) == 0).then(|| self.0.below(game.showcase.len()))
    }

    fn place(&mut self, _: &Game, round: &Round, _: usize) -> Spot {
        let spots = round.spots();
        spots[self.0.below(spots.len())]
    }

    fn act(&mut self, game: &Game, round: &Round, me: usize) -> Action {
        let hand: Vec<usize> = (0..round.rolls[me].len())
            .filter(|&i| round.in_hand(me, i))
            .collect();
        let spots = round.spots();
        match self.0.below(10) {
            0..=2 if game.rules.sacrifice && hand.len() >= 2 => {
                let out = hand[self.0.below(hand.len())];
                let rerolls = hand
                    .into_iter()
                    .filter(|&i| i != out && self.0.below(2) == 0)
                    .collect();
                Action::Sacrifice { out, rerolls }
            }
            3 if game.points[me] >= game.rules.sabotage_points() && spots.len() > 1 => {
                Action::Sabotage {
                    spot: spots[self.0.below(spots.len())],
                    payment: Payment::Point,
                }
            }
            _ => Action::Pass,
        }
    }
}

/// Picks the dice by a Monte Carlo estimate of the standard mission, and
/// every other decision by its margin in the round: its points minus the
/// best of the others, as the dice and markers stand.
pub struct Greedy {
    rng: Rng,
    buys: bool,
    sabotages: bool,
    sacrifices: bool,
    /// Scales the rounds to come when valuing a die bought or lost.
    future: f64,
    /// A preference for gold over an equal die: gold orders the purchases.
    gold_bonus: f64,
    /// Added to the worth of buying a one die.
    one_bonus: f64,
    /// The samples of a hand's strength.
    samples: usize,
    /// `cdf[c]`: the chance that 6 common dice repeat a value at most `c`
    /// times.
    cdf: [f64; 7],
}

const SAMPLES: usize = 128;
const SACRIFICE_SAMPLES: usize = 48;
const SPOT_SAMPLES: usize = 24;
/// A reserve die worth less than this, in points over the rounds left, is
/// cashed when it helps.
const CHEAP: f64 = 0.5;

impl Greedy {
    pub fn new(seed: u64, buys: bool, sabotages: bool, sacrifices: bool) -> Greedy {
        let mut rng = Rng::new(seed ^ 0x5eed);
        let mut counts = [0u32; 7];
        let trials = 20_000;
        for _ in 0..trials {
            let rolls = (0..6).map(|_| Kind::Common.roll(&mut rng)).collect();
            counts[play_out(rolls, &mut rng).0 as usize] += 1;
        }
        let mut cdf = [0.0; 7];
        let mut sum = 0;
        for c in 0..7 {
            sum += counts[c];
            cdf[c] = sum as f64 / trials as f64;
        }
        Greedy {
            rng,
            buys,
            sabotages,
            sacrifices,
            future: 1.0,
            gold_bonus: 0.0,
            one_bonus: 0.0,
            samples: SAMPLES,
            cdf,
        }
    }

    /// The expected points of `kinds` in the standard mission against 6
    /// common dice, played out by [`play_out`].
    fn strength(&self, kinds: &[Kind], seed: u64) -> f64 {
        let mut rng = Rng::new(seed);
        let mut total = 0.0;
        for _ in 0..self.samples {
            let rolls: Vec<Rolled> = kinds.iter().map(|k| k.roll(&mut rng)).collect();
            let (count, _) = play_out(rolls, &mut rng);
            total += count as f64 * self.cdf[count as usize];
        }
        total / self.samples as f64
    }

    /// The best dice of `reserve` to roll, added one at a time, and their
    /// strength.
    fn pick(&self, reserve: &[Kind], hand: usize, seed: u64) -> (Vec<usize>, f64) {
        let mut left: Vec<usize> = (0..reserve.len()).collect();
        let mut chosen: Vec<usize> = Vec::new();
        let mut kinds: Vec<Kind> = Vec::new();
        let mut best_score = 0.0;
        while chosen.len() < hand.min(reserve.len()) {
            let mut best: Option<(f64, usize)> = None;
            let mut tried: Vec<Kind> = Vec::new();
            for (pos, &i) in left.iter().enumerate() {
                if tried.contains(&reserve[i]) {
                    continue;
                }
                tried.push(reserve[i]);
                kinds.push(reserve[i]);
                let gold = kinds.iter().filter(|k| k.is_gold()).count() as f64;
                let s = self.strength(&kinds, seed) + self.gold_bonus * gold;
                kinds.pop();
                if best.is_none_or(|b| s > b.0) {
                    best = Some((s, pos));
                }
            }
            let (s, pos) = best.unwrap();
            let i = left.remove(pos);
            chosen.push(i);
            kinds.push(reserve[i]);
            best_score = s;
        }
        (chosen, best_score)
    }
}

impl Greedy {
    /// The spot with the best mean margin once `me` plays its sacrifices
    /// there, over a few samples, the standard on a tie. The others stay as
    /// they are.
    fn best_spot(&mut self, game: &Game, round: &Round, me: usize) -> Spot {
        let seed = self.rng.next_u64();
        let mut best = (f64::MIN, Spot::Standard);
        for spot in round.spots() {
            let mut rng = Rng::new(seed);
            let mean = (0..SPOT_SAMPLES)
                .map(|_| {
                    let mut trial = round.clone();
                    trial.markers[me] = Some(spot);
                    play_mission(game, &mut trial, me, &mut rng);
                    margin(game, &trial, me)
                })
                .sum::<f64>()
                / SPOT_SAMPLES as f64;
            if mean > best.0 {
                best = (mean, spot);
            }
        }
        best.1
    }

    /// The best sacrifice by the mean margin over a few samples, among the
    /// plans of the mission of `me`: each plan keeps the dice the mission
    /// wants, sacrifices the die least likely to help and rerolls the
    /// others off the plan.
    fn best_sacrifice(&mut self, game: &Game, round: &Round, me: usize) -> Option<(f64, Action)> {
        let mission = round.markers[me].and_then(|spot| round.mission(spot))?;
        let seed = self.rng.next_u64();
        let mut options: Vec<Action> = Plan::all(mission)
            .into_iter()
            .filter_map(|plan| plan.sacrifice(round, me).1)
            .collect();
        options.dedup();
        let mut best: Option<(f64, Action)> = None;
        for action in options {
            let Action::Sacrifice { out, ref rerolls } = action else {
                unreachable!()
            };
            let mut rng = Rng::new(seed);
            let mut trial = round.clone();
            trial.removed[me][out] = true;
            let mean = (0..SACRIFICE_SAMPLES)
                .map(|_| {
                    for &i in rerolls {
                        trial.rolls[me][i] = round.rolls[me][i].kind.roll(&mut rng);
                    }
                    margin(game, &trial, me)
                })
                .sum::<f64>()
                / SACRIFICE_SAMPLES as f64;
            if best.as_ref().is_none_or(|b| mean > b.0) {
                best = Some((mean, action));
            }
        }
        best
    }

    /// The ways to pay a sabotage, each with its cost for the games to
    /// come: a point, or a die of the hand, valued by how much the reserve
    /// weakens without it over the rounds left. Its cost in this round shows
    /// in the margin.
    fn payments(&self, game: &Game, round: &Round, me: usize) -> Vec<(f64, Payment)> {
        let mut options = Vec::new();
        let price = game.rules.sabotage_points();
        if game.points[me] >= price {
            options.push((price as f64, Payment::Point));
        }
        if !game.rules.sabotage_by_die {
            return options;
        }
        let reserve = &game.reserves[me];
        let hand = game.rules.hand;
        let now = self.pick(reserve, hand, 7).1;
        let rounds_left = self.rounds_left(game);
        let mut tried: Vec<(Kind, f64)> = Vec::new();
        for i in (0..round.rolls[me].len()).filter(|&i| round.in_hand(me, i)) {
            let r = round.sources[me][i];
            let kind = reserve[r];
            let cost = match tried.iter().find(|t| t.0 == kind) {
                Some(t) => t.1,
                None => {
                    let mut less = reserve.clone();
                    less.remove(r);
                    let cost = (now - self.pick(&less, hand, 7).1).max(0.0) * rounds_left;
                    tried.push((kind, cost));
                    cost
                }
            };
            options.push((cost, Payment::Die(i)));
        }
        options
    }

    fn rounds_left(&self, game: &Game) -> f64 {
        let leader = *game.points.iter().max().unwrap();
        self.future * ((game.rules.goal - leader) as f64 / 3.0).max(1.0)
    }
}

impl Player for Greedy {
    fn select(&mut self, game: &Game, me: usize) -> Vec<usize> {
        let seed = self.rng.next_u64();
        self.pick(&game.reserves[me], game.rules.hand, seed).0
    }

    /// The reserve dice out of the hand that cost almost nothing to lose,
    /// as many as it takes to buy at all and to pass the gold of the
    /// others.
    fn cash(&mut self, game: &Game, round: &Round, me: usize) -> Vec<usize> {
        if !self.buys {
            return Vec::new();
        }
        let reserve = &game.reserves[me];
        let hand = game.rules.hand;
        let now = self.pick(reserve, hand, 7).1;
        let rounds_left = self.rounds_left(game);
        let mut cheap: Vec<(f64, usize)> = (0..reserve.len())
            .filter(|r| !round.sources[me].contains(r))
            .map(|r| {
                let mut less = reserve.clone();
                less.remove(r);
                (
                    (now - self.pick(&less, hand, 7).1).max(0.0) * rounds_left,
                    r,
                )
            })
            .filter(|c| c.0 < CHEAP)
            .collect();
        cheap.sort_by(|a, b| a.0.total_cmp(&b.0));
        let rival = (0..game.players())
            .filter(|&p| p != me)
            .map(|p| round.gold(p))
            .max()
            .unwrap_or(0);
        let need = (rival + 1 - round.gold(me)).max(0) as usize;
        cheap.truncate(need);
        cheap.into_iter().map(|c| c.1).collect()
    }

    fn buy(&mut self, game: &Game, round: &Round, me: usize) -> Option<usize> {
        if !self.buys {
            return None;
        }
        let now_margin = margin(game, round, me);
        // The margin of the round after buying `kind`: the golds leave the
        // hand, and the bought die joins it if the rules say so.
        let cost = |kind: Kind| {
            let mut after = round.clone();
            after.bought[me] = Some(kind);
            if !game.rules.bought_plays {
                return now_margin - margin(game, &after, me);
            }
            after.rolls[me].push(kind.roll(&mut Rng::new(0)));
            after.removed[me].push(false);
            after.used[me].push(false);
            let mean = kind
                .faces()
                .iter()
                .map(|&f| {
                    after.rolls[me].last_mut().unwrap().face = f;
                    margin(game, &after, me)
                })
                .sum::<f64>()
                / 6.0;
            now_margin - mean
        };
        let seed = self.rng.next_u64();
        let hand = game.rules.hand;
        let reserve = &game.reserves[me];
        let now = self.pick(reserve, hand, seed).1;
        let rounds_left = self.rounds_left(game);
        let (net, i) = game
            .showcase
            .iter()
            .enumerate()
            .map(|(i, &k)| {
                let mut more = reserve.clone();
                more.push(k);
                let gain = self.pick(&more, hand, seed).1 - now;
                let bonus = if k == Kind::One { self.one_bonus } else { 0.0 };
                (gain * rounds_left - cost(k) + bonus, i)
            })
            .max_by(|a, b| a.0.total_cmp(&b.0))?;
        (net > 0.0).then_some(i)
    }

    fn place(&mut self, game: &Game, round: &Round, me: usize) -> Spot {
        self.best_spot(game, round, me)
    }

    fn act(&mut self, game: &Game, round: &Round, me: usize) -> Action {
        let now = margin(game, round, me);
        let size = round.rolls[me].len();
        let mut best: (f64, Action) = (now + 0.05, Action::Pass);
        let consider = |gain: f64, action: Action, best: &mut (f64, Action)| {
            if gain > best.0 {
                *best = (gain, action);
            }
        };
        for i in (0..size).filter(|&i| round.in_hand(me, i) && !round.used[me][i]) {
            let die = round.rolls[me][i];
            for t in (0..size).filter(|&t| t != i && round.counts(me, t)) {
                let mut trial = round.clone();
                if die.is_zero() {
                    let faces = trial.rolls[me][t].kind.faces();
                    let m = faces
                        .iter()
                        .map(|&f| {
                            trial.rolls[me][t].face = f;
                            margin(game, &trial, me)
                        })
                        .sum::<f64>()
                        / 6.0;
                    consider(m, Action::Zero { zero: i, target: t }, &mut best);
                } else if die.kind == Kind::Modifier {
                    for up in [true, false] {
                        let step = if up { die.face } else { -die.face };
                        let face = round.rolls[me][t].face;
                        trial.rolls[me][t].face = (face + step).clamp(1, 6);
                        let action = Action::Modify {
                            modifier: i,
                            target: t,
                            up,
                        };
                        consider(margin(game, &trial, me), action, &mut best);
                    }
                }
            }
        }
        if self.sacrifices && game.rules.sacrifice {
            if let Some((m, action)) = self.best_sacrifice(game, round, me) {
                consider(m, action, &mut best);
            }
        }
        if self.sabotages {
            let payments = self.payments(game, round, me);
            let spots = round.spots();
            for &spot in spots.iter().filter(|_| spots.len() > 1) {
                for &(cost, payment) in &payments {
                    let mut trial = round.clone();
                    match spot {
                        Spot::Standard => trial.standard = false,
                        Spot::Card(card) => trial.table[card] = None,
                    }
                    if let Payment::Die(i) = payment {
                        trial.removed[me][i] = true;
                    }
                    for q in round.order.iter().copied() {
                        if trial.markers[q] == Some(spot) {
                            trial.markers[q] = Some(best_spot(game, &trial, q));
                        }
                    }
                    consider(
                        margin(game, &trial, me) - cost,
                        Action::Sabotage { spot, payment },
                        &mut best,
                    );
                }
            }
        }
        best.1
    }
}
