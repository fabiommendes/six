//! The game one decision at a time, for an interface.
//!
//! [`Steps`] holds a game and the round in progress, and tells which player
//! decides what next ([`Steps::pending`]). The answer comes back through
//! [`Steps::apply`]. [`Game::play_round`] plays its rounds through it, so
//! the rules of a round live only here.

use crate::{Action, Game, Kind, Payment, Player, Round, RoundLog, Spot};

/// What a player has to decide, as in the methods of [`Player`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Decision {
    /// The dice of the reserve to roll.
    Select,
    /// The reserve dice out of the hand to take out for money.
    Cash,
    /// A die of the showcase, or none.
    Buy,
    /// A spot for the marker. `moved` when its card was sabotaged.
    Place { moved: bool },
    /// A turn of the mission phase.
    Act,
}

/// The next decision: who decides and what.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Pending {
    pub player: usize,
    pub decision: Decision,
}

/// The answer to a [`Decision`], with the arguments of [`Player`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Answer {
    Select(Vec<usize>),
    Cash(Vec<usize>),
    Buy(Option<usize>),
    Place(Spot),
    Act(Action),
}

/// Where the game stands. Positions count in the order of the round.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Stage {
    Select(usize),
    Cash(usize),
    Buy(usize),
    Place(usize),
    Act(usize),
    /// The players on sabotaged `spot` move their markers, in the order of
    /// the round from position `from`; then the turn at `resume` follows.
    Move {
        spot: Spot,
        from: usize,
        resume: usize,
    },
    Over,
}

/// The last round played: the round as it was scored and its log.
#[derive(Clone, Debug)]
pub struct Played {
    pub round: Round,
    pub log: RoundLog,
}

/// A game played one decision at a time.
#[derive(Clone, Debug)]
pub struct Steps {
    game: Game,
    round: Round,
    log: RoundLog,
    stage: Stage,
    /// The cash answers so far: they are taken out once all answered.
    cashed: Vec<Vec<usize>>,
    /// The players still in the mission phase.
    active: Vec<bool>,
    last: Option<Played>,
}

impl Steps {
    /// Starts the first round of `game`, unless it is already over.
    pub fn new(game: Game) -> Steps {
        let n = game.players();
        let mut steps = Steps {
            round: empty_round(&game),
            log: empty_log(n),
            game,
            stage: Stage::Over,
            cashed: Vec::new(),
            active: vec![true; n],
            last: None,
        };
        if !steps.game.is_over() {
            steps.start_round();
        }
        steps
    }

    pub fn game(&self) -> &Game {
        &self.game
    }

    /// The round in progress, `None` once the game is over.
    pub fn round(&self) -> Option<&Round> {
        (self.stage != Stage::Over).then_some(&self.round)
    }

    /// The last round played, as it was scored.
    pub fn last(&self) -> Option<&Played> {
        self.last.as_ref()
    }

    /// The players who have not passed in the mission phase of this round.
    pub fn active(&self) -> &[bool] {
        &self.active
    }

    pub fn is_over(&self) -> bool {
        self.stage == Stage::Over
    }

    /// The game and the last round played.
    pub(crate) fn into_parts(self) -> (Game, Option<Played>) {
        (self.game, self.last)
    }

    /// The decision the game waits for, `None` once it is over.
    pub fn pending(&self) -> Option<Pending> {
        let order = &self.round.order;
        let (player, decision) = match self.stage {
            Stage::Select(p) => (p, Decision::Select),
            Stage::Cash(p) => (p, Decision::Cash),
            Stage::Buy(i) => (order[i], Decision::Buy),
            Stage::Place(i) => (order[i], Decision::Place { moved: false }),
            Stage::Act(i) => (order[i], Decision::Act),
            Stage::Move { from, .. } => (order[from], Decision::Place { moved: true }),
            Stage::Over => return None,
        };
        Some(Pending { player, decision })
    }

    /// Asks `player` for the pending decision, as [`Game::play_round`] does.
    pub fn ask(&self, player: &mut dyn Player) -> Option<Answer> {
        let pending = self.pending()?;
        let (game, round, me) = (&self.game, &self.round, pending.player);
        Some(match pending.decision {
            Decision::Select => Answer::Select(player.select(game, me)),
            Decision::Cash => Answer::Cash(player.cash(game, round, me)),
            Decision::Buy => Answer::Buy(player.buy(game, round, me)),
            Decision::Place { .. } => Answer::Place(player.place(game, round, me)),
            Decision::Act => Answer::Act(player.act(game, round, me)),
        })
    }

    /// Plays the game to the end, asking `players` each decision.
    pub fn play(&mut self, players: &mut [Box<dyn Player>]) -> Result<(), String> {
        while let Some(pending) = self.pending() {
            let answer = self.ask(players[pending.player].as_mut()).unwrap();
            self.apply(answer)?;
        }
        Ok(())
    }

    /// Whether `answer` is legal for the pending decision; the error says
    /// why not.
    pub fn check(&self, answer: &Answer) -> Result<(), String> {
        let pending = self.pending().ok_or("the game is over")?;
        let p = pending.player;
        let round = &self.round;
        let reserve = self.game.reserves[p].len();
        match (pending.decision, answer) {
            (Decision::Select, Answer::Select(picked)) => {
                let picked = sorted(picked);
                let size = self.game.rules.hand.min(reserve);
                if picked.len() != size || picked.iter().any(|&i| i >= reserve) {
                    return Err(format!("player {p} selected {picked:?}"));
                }
            }
            (Decision::Cash, Answer::Cash(cashed)) => {
                let cashed = sorted(cashed);
                if cashed
                    .iter()
                    .any(|&r| r >= reserve || round.sources[p].contains(&r))
                {
                    return Err(format!("player {p} cashed {cashed:?}"));
                }
            }
            (Decision::Buy, Answer::Buy(bought)) => {
                if let Some(i) = *bought {
                    if i >= self.game.showcase.len() {
                        return Err(format!("player {p} bought {i}"));
                    }
                }
            }
            (Decision::Place { .. }, Answer::Place(spot)) => {
                if round.mission(*spot).is_none() {
                    return Err(format!("player {p} placed on {spot:?}"));
                }
            }
            (Decision::Act, Answer::Act(action)) => self.check_action(p, action)?,
            (decision, answer) => {
                return Err(format!("player {p} answered {answer:?} to {decision:?}"))
            }
        }
        Ok(())
    }

    /// Plays `answer` to the pending decision, then runs the game up to the
    /// next decision. An illegal answer changes nothing.
    pub fn apply(&mut self, answer: Answer) -> Result<(), String> {
        self.check(&answer)?;
        let p = self.pending().unwrap().player;
        match (self.stage, answer) {
            (Stage::Select(_), Answer::Select(picked)) => {
                let picked = sorted(&picked);
                self.round.rolls[p] = picked
                    .iter()
                    .map(|&i| self.game.reserves[p][i].roll(&mut self.game.rng))
                    .collect();
                self.round.removed[p] = vec![false; picked.len()];
                self.round.used[p] = vec![false; picked.len()];
                self.round.sources[p] = picked;
                self.stage = Stage::Select(p + 1);
            }
            (Stage::Cash(_), Answer::Cash(cashed)) => {
                self.cashed.push(sorted(&cashed));
                self.stage = Stage::Cash(p + 1);
            }
            (Stage::Buy(i), Answer::Buy(bought)) => {
                if let Some(index) = bought {
                    self.buy(p, index);
                }
                self.stage = Stage::Buy(i + 1);
            }
            (Stage::Place(i), Answer::Place(spot)) => {
                self.round.markers[p] = Some(spot);
                self.stage = Stage::Place(i + 1);
            }
            (
                Stage::Move {
                    spot: gone,
                    from,
                    resume,
                },
                Answer::Place(spot),
            ) => {
                self.round.markers[p] = Some(spot);
                self.stage = Stage::Move {
                    spot: gone,
                    from: from + 1,
                    resume,
                };
            }
            (Stage::Act(i), Answer::Act(action)) => self.act(i, p, action),
            _ => unreachable!("checked above"),
        }
        self.advance();
        Ok(())
    }

    fn check_action(&self, p: usize, action: &Action) -> Result<(), String> {
        let round = &self.round;
        let size = round.rolls[p].len();
        let legal = match *action {
            Action::Pass => true,
            Action::Sacrifice { out, ref rerolls } => {
                let gone = |i: usize| i >= size || !round.in_hand(p, i);
                self.game.rules.sacrifice
                    && !gone(out)
                    && !rerolls.iter().any(|&i| i == out || gone(i))
            }
            Action::Zero { zero, target } => {
                zero < size
                    && target < size
                    && zero != target
                    && round.in_hand(p, zero)
                    && !round.used[p][zero]
                    && round.rolls[p][zero].is_zero()
                    && round.counts(p, target)
            }
            Action::Modify {
                modifier, target, ..
            } => {
                modifier < size
                    && target < size
                    && round.in_hand(p, modifier)
                    && !round.used[p][modifier]
                    && round.rolls[p][modifier].kind == Kind::Modifier
                    && !round.rolls[p][modifier].is_zero()
                    && round.counts(p, target)
            }
            Action::Sabotage { spot, payment } => {
                round.mission(spot).is_some()
                    && round.spots().len() > 1
                    && match payment {
                        Payment::Point => self.game.points[p] >= self.game.rules.sabotage_points(),
                        Payment::Die(i) => {
                            self.game.rules.sabotage_by_die && i < size && round.in_hand(p, i)
                        }
                    }
            }
        };
        if legal {
            Ok(())
        } else {
            Err(format!("player {p} cannot {action:?}"))
        }
    }

    fn buy(&mut self, p: usize, index: usize) {
        let (game, round) = (&mut self.game, &mut self.round);
        let kind = game.showcase.remove(index);
        game.reserves[p].push(kind);
        round.bought[p] = Some(kind);
        if game.rules.bought_plays {
            round.rolls[p].push(kind.roll(&mut game.rng));
            round.removed[p].push(false);
            round.used[p].push(false);
            round.sources[p].push(game.reserves[p].len() - 1);
        }
    }

    /// A legal turn of player `p` at position `i` of the order.
    fn act(&mut self, i: usize, p: usize, action: Action) {
        let (game, round) = (&mut self.game, &mut self.round);
        self.stage = Stage::Act(i + 1);
        match action {
            Action::Pass => self.active[p] = false,
            Action::Sacrifice { out, rerolls } => {
                round.removed[p][out] = true;
                for i in sorted(&rerolls) {
                    round.rolls[p][i] = round.rolls[p][i].kind.roll(&mut game.rng);
                }
                self.log.sacrifices[p] += 1;
            }
            Action::Zero { zero, target } => {
                round.used[p][zero] = true;
                round.rolls[p][target] = round.rolls[p][target].kind.roll(&mut game.rng);
            }
            Action::Modify {
                modifier,
                target,
                up,
            } => {
                round.used[p][modifier] = true;
                let face = round.rolls[p][modifier].face;
                let step = if up { face } else { -face };
                let die = &mut round.rolls[p][target];
                die.face = (die.face + step).clamp(1, 6);
            }
            Action::Sabotage { spot, payment } => {
                let mission = round.mission(spot).unwrap();
                match payment {
                    Payment::Point => game.points[p] -= game.rules.sabotage_points(),
                    Payment::Die(d) => {
                        round.removed[p][d] = true;
                        let r = round.sources[p][d];
                        game.take_out(round, p, r);
                    }
                }
                match spot {
                    Spot::Standard => round.standard = false,
                    Spot::Card(card) => round.table[card] = None,
                }
                self.log
                    .sabotages
                    .push((p, mission, payment == Payment::Point));
                self.stage = Stage::Move {
                    spot,
                    from: 0,
                    resume: i + 1,
                };
            }
        }
    }

    /// Runs the game up to the next decision: skips the players with
    /// nothing to decide, and plays what needs no decision (the cash, the
    /// order, the score and the next round).
    fn advance(&mut self) {
        let n = self.game.players();
        loop {
            match self.stage {
                Stage::Select(p) if p == n => {
                    self.stage = if self.game.rules.cash {
                        Stage::Cash(0)
                    } else {
                        self.order()
                    };
                }
                Stage::Cash(p) if p == n => {
                    self.take_cash();
                    self.stage = self.order();
                }
                Stage::Buy(i) if i == n => self.stage = Stage::Place(0),
                Stage::Buy(i) => {
                    let p = self.round.order[i];
                    if self.round.money(p) == 0 || self.game.showcase.is_empty() {
                        self.stage = Stage::Buy(i + 1);
                    } else {
                        return;
                    }
                }
                Stage::Place(i) if i == n => self.stage = Stage::Act(0),
                Stage::Move { spot, from, resume } => {
                    let on_card = |q: &usize| self.round.markers[*q] == Some(spot);
                    match (from..n).find(|&j| on_card(&self.round.order[j])) {
                        Some(j) => {
                            self.stage = Stage::Move {
                                spot,
                                from: j,
                                resume,
                            };
                            return;
                        }
                        None => self.stage = Stage::Act(resume),
                    }
                }
                Stage::Act(_) if !self.active.iter().any(|&a| a) => {
                    self.finish_round();
                    if self.game.is_over() {
                        self.stage = Stage::Over;
                        return;
                    }
                    self.start_round();
                }
                Stage::Act(i) if i == n => self.stage = Stage::Act(0),
                Stage::Act(i) if !self.active[self.round.order[i]] => {
                    self.stage = Stage::Act(i + 1)
                }
                _ => return,
            }
        }
    }

    fn start_round(&mut self) {
        let n = self.game.players();
        self.round = empty_round(&self.game);
        self.log = empty_log(n);
        self.cashed.clear();
        self.active = vec![true; n];
        self.stage = Stage::Select(0);
    }

    fn take_cash(&mut self) {
        let answers = std::mem::take(&mut self.cashed);
        for (p, cashed) in answers.into_iter().enumerate() {
            for &r in cashed.iter().rev() {
                self.game.take_out(&mut self.round, p, r);
            }
            self.round.cash[p] = cashed.len() as i32;
            self.log.cashed[p] = cashed.len() as u32;
        }
    }

    /// Orders the round by the money and moves on to the purchases.
    fn order(&mut self) -> Stage {
        let n = self.game.players();
        let mut keys: Vec<(i32, u64, usize)> = (0..n)
            .map(|p| (-self.round.money(p), self.game.rng.next_u64(), p))
            .collect();
        keys.sort_unstable();
        self.round.order = keys.iter().map(|k| k.2).collect();
        Stage::Buy(0)
    }

    fn finish_round(&mut self) {
        let n = self.game.players();
        let (game, round, log) = (&mut self.game, &self.round, &mut self.log);
        let deltas = round.score(game.rules.scoring());
        for (points, delta) in game.points.iter_mut().zip(&deltas) {
            *points += delta;
        }
        // A card someone scored on is done and replaced; the others, the
        // sabotaged ones too, stay for the next round.
        for i in (0..round.table.len()).rev() {
            let done = round.table[i].is_some()
                && (0..n).any(|p| round.markers[p] == Some(Spot::Card(i)) && deltas[p] > 0);
            if done {
                let gone = game.table.remove(i);
                game.used.push(gone);
            }
        }
        game.refill();
        game.round += 1;
        log.order = round.order.clone();
        log.missions = (0..n)
            .map(|p| round.mission(round.markers[p].unwrap()).unwrap())
            .collect();
        log.bought = round.bought.clone();
        log.deltas = deltas;
        self.last = Some(Played {
            round: self.round.clone(),
            log: self.log.clone(),
        });
    }
}

fn sorted(indices: &[usize]) -> Vec<usize> {
    let mut indices = indices.to_vec();
    indices.sort_unstable();
    indices.dedup();
    indices
}

fn empty_round(game: &Game) -> Round {
    let n = game.players();
    Round {
        rolls: vec![Vec::new(); n],
        sources: vec![Vec::new(); n],
        cash: vec![0; n],
        order: Vec::new(),
        bought: vec![None; n],
        removed: vec![Vec::new(); n],
        used: vec![Vec::new(); n],
        table: game.table.iter().map(|&m| Some(m)).collect(),
        standard: true,
        markers: vec![None; n],
    }
}

fn empty_log(n: usize) -> RoundLog {
    RoundLog {
        order: Vec::new(),
        bought: Vec::new(),
        missions: Vec::new(),
        sacrifices: vec![0; n],
        cashed: vec![0; n],
        sabotages: Vec::new(),
        deltas: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Rng, Rules, Scoring};

    /// A player with random legal answers that tries every kind of action.
    struct Wild(Rng);

    impl Wild {
        fn pick(&mut self, items: &[usize]) -> Option<usize> {
            (!items.is_empty()).then(|| items[self.0.below(items.len())])
        }
    }

    impl Player for Wild {
        fn select(&mut self, game: &Game, me: usize) -> Vec<usize> {
            let mut all: Vec<usize> = (0..game.reserves[me].len()).collect();
            self.0.shuffle(&mut all);
            all.truncate(game.rules.hand);
            all
        }

        fn cash(&mut self, game: &Game, round: &Round, me: usize) -> Vec<usize> {
            (0..game.reserves[me].len())
                .filter(|r| !round.sources[me].contains(r) && self.0.below(3) == 0)
                .collect()
        }

        fn buy(&mut self, game: &Game, _: &Round, _: usize) -> Option<usize> {
            let all: Vec<usize> = (0..game.showcase.len()).collect();
            if self.0.below(4) == 0 {
                None
            } else {
                self.pick(&all)
            }
        }

        fn place(&mut self, _: &Game, round: &Round, _: usize) -> Spot {
            let spots = round.spots();
            spots[self.0.below(spots.len())]
        }

        fn act(&mut self, game: &Game, round: &Round, me: usize) -> Action {
            let size = round.rolls[me].len();
            let hand: Vec<usize> = (0..size).filter(|&i| round.in_hand(me, i)).collect();
            let counted: Vec<usize> = (0..size).filter(|&i| round.counts(me, i)).collect();
            let fresh = |i: &usize| round.in_hand(me, *i) && !round.used[me][*i];
            let zeros: Vec<usize> = (0..size)
                .filter(|i| fresh(i) && round.rolls[me][*i].is_zero())
                .collect();
            let mods: Vec<usize> = (0..size)
                .filter(|i| {
                    fresh(i)
                        && round.rolls[me][*i].kind == Kind::Modifier
                        && !round.rolls[me][*i].is_zero()
                })
                .collect();
            let spots = round.spots();
            match self.0.below(6) {
                0 if hand.len() > 1 => {
                    let out = hand[0];
                    let rerolls = hand[1..].iter().copied().filter(|_| self.0.below(2) == 0);
                    Action::Sacrifice {
                        out,
                        rerolls: rerolls.collect(),
                    }
                }
                1 if !zeros.is_empty() => {
                    let zero = zeros[0];
                    let targets: Vec<usize> =
                        counted.iter().copied().filter(|&t| t != zero).collect();
                    match self.pick(&targets) {
                        Some(target) => Action::Zero { zero, target },
                        None => Action::Pass,
                    }
                }
                2 if !mods.is_empty() => match self.pick(&counted) {
                    Some(target) => Action::Modify {
                        modifier: mods[0],
                        target,
                        up: self.0.below(2) == 0,
                    },
                    None => Action::Pass,
                },
                3 if game.points[me] >= game.rules.sabotage_points()
                    && spots.len() > 1
                    && self.0.below(3) == 0 =>
                {
                    Action::Sabotage {
                        spot: spots[self.0.below(spots.len())],
                        payment: Payment::Point,
                    }
                }
                4 => Action::Pass,
                _ => Action::Pass,
            }
        }
    }

    fn wild(players: usize, seed: u64) -> Vec<Box<dyn Player>> {
        (0..players)
            .map(|p| Box::new(Wild(Rng::new(seed * 10 + p as u64))) as Box<dyn Player>)
            .collect()
    }

    #[test]
    fn steps_end_as_play_with_the_same_seed() {
        let (mut sabotages, mut sacrifices, mut cashed) = (0, 0, 0);
        for players in 2..=4 {
            for seed in 0..40 {
                let rules = Rules {
                    players,
                    goal: 20,
                    ..Rules::default()
                };
                let mut game = Game::new(rules, seed);
                let logs = game.play(&mut wild(players, seed)).unwrap();
                for log in &logs {
                    sabotages += log.sabotages.len();
                    sacrifices += log.sacrifices.iter().sum::<u32>();
                    cashed += log.cashed.iter().sum::<u32>();
                }
                let mut steps = Steps::new(Game::new(rules, seed));
                steps.play(&mut wild(players, seed)).unwrap();
                assert!(steps.is_over());
                assert_eq!(format!("{:?}", steps.game()), format!("{game:?}"));
                let last = steps.last().unwrap();
                assert_eq!(
                    format!("{:?}", last.log),
                    format!("{:?}", logs.last().unwrap())
                );
            }
        }
        assert!(sabotages > 0 && sacrifices > 0 && cashed > 0);
    }

    #[test]
    fn an_illegal_answer_changes_nothing() {
        let mut steps = Steps::new(Game::new(Rules::default(), 3));
        let pending = steps.pending().unwrap();
        assert_eq!(
            pending,
            Pending {
                player: 0,
                decision: Decision::Select
            }
        );
        let before = format!("{steps:?}");
        assert!(steps.apply(Answer::Select(vec![0, 1])).is_err());
        assert!(steps.apply(Answer::Buy(None)).is_err());
        assert_eq!(format!("{steps:?}"), before);
        steps.apply(Answer::Select((0..6).collect())).unwrap();
        assert_eq!(steps.pending().unwrap().player, 1);
        assert_eq!(steps.round().unwrap().rolls[0].len(), 6);
    }

    #[test]
    fn a_sabotage_moves_the_markers_on_the_card() {
        let mut steps = Steps::new(Game::new(Rules::default(), 8));
        steps.game.points = vec![5, 5];
        for _ in 0..2 {
            steps.apply(Answer::Select((0..6).collect())).unwrap();
        }
        for _ in 0..2 {
            steps.apply(Answer::Cash(vec![])).unwrap();
        }
        while steps.pending().unwrap().decision == Decision::Buy {
            steps.apply(Answer::Buy(None)).unwrap();
        }
        let order = steps.round().unwrap().order.clone();
        steps.apply(Answer::Place(Spot::Card(0))).unwrap();
        steps.apply(Answer::Place(Spot::Card(0))).unwrap();
        let first = order[0];
        let sabotage = Action::Sabotage {
            spot: Spot::Card(0),
            payment: Payment::Point,
        };
        steps.apply(Answer::Act(sabotage)).unwrap();
        assert_eq!(steps.game().points[first], 3);
        for &p in &order {
            let pending = steps.pending().unwrap();
            assert_eq!(pending.player, p);
            assert_eq!(pending.decision, Decision::Place { moved: true });
            assert!(steps.apply(Answer::Place(Spot::Card(0))).is_err());
            steps.apply(Answer::Place(Spot::Standard)).unwrap();
        }
        assert_eq!(
            steps.pending(),
            Some(Pending {
                player: order[1],
                decision: Decision::Act
            })
        );
    }

    #[test]
    fn the_standard_can_be_sabotaged_but_not_the_last_mission() {
        let mut steps = Steps::new(Game::new(Rules::default(), 8));
        steps.game.points = vec![5, 5];
        let table = steps.game().table.clone();
        for _ in 0..2 {
            steps.apply(Answer::Select((0..6).collect())).unwrap();
        }
        for _ in 0..2 {
            steps.apply(Answer::Cash(vec![])).unwrap();
        }
        while steps.pending().unwrap().decision == Decision::Buy {
            steps.apply(Answer::Buy(None)).unwrap();
        }
        let order = steps.round().unwrap().order.clone();
        for _ in 0..2 {
            steps.apply(Answer::Place(Spot::Standard)).unwrap();
        }
        let sabotage = |spot| {
            Answer::Act(Action::Sabotage {
                spot,
                payment: Payment::Point,
            })
        };
        steps.apply(sabotage(Spot::Card(0))).unwrap();
        steps.apply(sabotage(Spot::Standard)).unwrap();
        for _ in 0..2 {
            assert!(steps.apply(Answer::Place(Spot::Standard)).is_err());
            steps.apply(Answer::Place(Spot::Card(1))).unwrap();
        }
        assert_eq!(steps.round().unwrap().spots(), vec![Spot::Card(1)]);
        assert_eq!(steps.pending().unwrap().player, order[0]);
        assert!(steps.apply(sabotage(Spot::Card(1))).is_err());
        let scored = steps.round().unwrap().score(Scoring::default());
        steps.apply(Answer::Act(Action::Pass)).unwrap();
        steps.apply(Answer::Act(Action::Pass)).unwrap();
        let round = steps.round().unwrap();
        assert!(round.standard);
        assert_eq!(steps.game().table[0], table[0]);
        if scored.iter().all(|&d| d == 0) {
            assert_eq!(steps.game().table, table);
        }
    }
}
