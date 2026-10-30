//! WebAssembly bindings of the mission game (prototype).
//!
//! Everything structured crosses the boundary as JSON text in the formats of
//! [`wire`] (the TypeScript types are in `types/`, generated with `just
//! missoes-types`). Errors are thrown as JavaScript exceptions and change
//! nothing.
//!
//! `Game` holds a [`missoes_engine::Steps`], the game one decision at a
//! time, and the bots of the seats played by bots: a bot is a
//! `missoes_engine::Player` of `missoes-bots`, asked through the same
//! adapter as in the batches. The rules live in the engine, so an
//! interface never decides what is legal.

use missoes_engine::{Player, Rules, Steps};
use wasm_bindgen::prelude::*;

pub mod wire;

use wire::{Answer, Setup, Step, View};

fn error(message: impl ToString) -> JsError {
    JsError::new(&message.to_string())
}

/// A game on this device: the engine and a bot per seat played by a bot.
#[wasm_bindgen]
pub struct Game {
    steps: Steps,
    names: Vec<Option<String>>,
    bots: Vec<Option<Box<dyn Player>>>,
}

impl Game {
    /// A game of `setup`; `seed` picks the rolls, the shuffles and the
    /// bots' randomness.
    pub fn create(setup: Setup, seed: u64) -> Result<Game, String> {
        let players = setup.bots.len();
        if !(2..=4).contains(&players) {
            return Err(format!("a game has 2 to 4 players, not {players}"));
        }
        let mut rules = Rules {
            players,
            ..Rules::default()
        };
        if let Some(goal) = setup.goal {
            if goal < 1 {
                return Err(format!("the goal must be positive, not {goal}"));
            }
            rules.goal = goal;
        }
        let bots = setup
            .bots
            .iter()
            .enumerate()
            .map(|(seat, name)| {
                name.as_deref()
                    .map(|name| missoes_bots::by_name(name, seed ^ (0x9E37 + seat as u64)))
                    .transpose()
            })
            .collect::<Result<_, _>>()?;
        Ok(Game {
            steps: Steps::new(missoes_engine::Game::new(rules, seed)),
            names: setup.bots,
            bots,
        })
    }

    pub fn steps(&self) -> &Steps {
        &self.steps
    }

    pub fn current_view(&self) -> View {
        View::of(&self.steps, &self.names)
    }

    /// Plays `answer` of the person who decides now.
    pub fn answer(&mut self, answer: Answer) -> Result<Step, String> {
        let player = self.steps.pending().ok_or("the game is over")?.player;
        if self.bots[player].is_some() {
            return Err(format!("player {player} is a bot"));
        }
        self.steps.apply(answer.clone().into())?;
        Ok(self.step(player, answer))
    }

    /// Why `answer` would be illegal for the person who decides now, or
    /// `None` if [`Game::answer`] would play it.
    pub fn problem(&self, answer: Answer) -> Option<String> {
        let Some(pending) = self.steps.pending() else {
            return Some("the game is over".into());
        };
        if self.bots[pending.player].is_some() {
            return Some(format!("player {} is a bot", pending.player));
        }
        self.steps.check(&answer.into()).err()
    }

    /// The bot who decides now answers.
    pub fn bot_answer(&mut self) -> Result<Step, String> {
        let player = self.steps.pending().ok_or("the game is over")?.player;
        let bot = self.bots[player]
            .as_mut()
            .ok_or_else(|| format!("player {player} is not a bot"))?;
        let answer = self.steps.ask(bot.as_mut()).unwrap();
        let wired = Answer::try_from(answer.clone())?;
        self.steps.apply(answer)?;
        Ok(self.step(player, wired))
    }

    fn step(&self, player: usize, answer: Answer) -> Step {
        Step {
            player,
            answer,
            view: self.current_view(),
        }
    }
}

#[wasm_bindgen]
impl Game {
    /// A new game from a `Setup` JSON (the bot of each seat, `null` for a
    /// person, and the goal). Throws on a bad setup or an unknown bot.
    #[wasm_bindgen(constructor)]
    pub fn new(setup: &str, seed: u64) -> Result<Game, JsError> {
        let setup: Setup = wire::from_json(setup).map_err(error)?;
        Game::create(setup, seed).map_err(error)
    }

    /// What to show, as a `View` JSON.
    pub fn view(&self) -> String {
        wire::to_json(&self.current_view())
    }

    /// Whether the decision pending is a bot's.
    #[wasm_bindgen(js_name = botToMove)]
    pub fn bot_to_move(&self) -> bool {
        self.steps
            .pending()
            .is_some_and(|p| self.bots[p.player].is_some())
    }

    /// Plays an `Answer` JSON of the person who decides now and returns a
    /// `Step` JSON. Throws if it is illegal, if a bot decides now or if the
    /// game is over.
    pub fn apply(&mut self, json: &str) -> Result<String, JsError> {
        let answer: Answer = wire::from_json(json).map_err(error)?;
        self.answer(answer)
            .map(|s| wire::to_json(&s))
            .map_err(error)
    }

    /// Checks an `Answer` JSON of the person who decides now without playing
    /// it: `undefined` if `apply` would accept it, else why not.
    pub fn check(&self, json: &str) -> Result<Option<String>, JsError> {
        let answer: Answer = wire::from_json(json).map_err(error)?;
        Ok(self.problem(answer))
    }

    /// The bot who decides now answers; returns a `Step` JSON. Throws if a
    /// person decides now or if the game is over.
    #[wasm_bindgen(js_name = playBot)]
    pub fn play_bot(&mut self) -> Result<String, JsError> {
        self.bot_answer().map(|s| wire::to_json(&s)).map_err(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use missoes_engine::Game as Engine;

    fn bots(names: &[&str]) -> Setup {
        Setup {
            bots: names.iter().map(|n| Some(n.to_string())).collect(),
            goal: None,
        }
    }

    #[test]
    fn bots_play_to_the_end_as_in_the_batches() {
        for (seed, names) in [(1, vec!["greedy", "random"]), (2, vec!["greedy"; 4])] {
            let mut game = Game::create(bots(&names), seed).unwrap();
            while game.bot_to_move() {
                game.bot_answer().unwrap();
            }
            let view = game.current_view();
            assert!(view.winners.is_some() && view.pending.is_none());

            // The same bots through `Game::play`, with the same seeds.
            let rules = game.steps().game().rules;
            let mut players: Vec<Box<dyn Player>> = (0..names.len())
                .map(|s| missoes_bots::by_name(names[s], seed ^ (0x9E37 + s as u64)).unwrap())
                .collect();
            let mut engine = Engine::new(rules, seed);
            engine.play(&mut players).unwrap();
            assert_eq!(format!("{engine:?}"), format!("{:?}", game.steps().game()));
        }
    }

    #[test]
    fn people_answer_and_bad_answers_change_nothing() {
        let setup = Setup {
            bots: vec![None, Some("greedy".into())],
            goal: Some(5),
        };
        let mut game = Game::create(setup, 7).unwrap();
        assert!(!game.bot_to_move());
        assert!(game.bot_answer().is_err());
        let before = game.current_view();
        assert!(game.answer(Answer::Select { dice: vec![0] }).is_err());
        assert!(game.answer(Answer::Buy { die: None }).is_err());
        assert!(game.problem(Answer::Select { dice: vec![0] }).is_some());
        assert_eq!(
            game.problem(Answer::Select {
                dice: (0..6).collect()
            }),
            None
        );
        assert_eq!(game.current_view(), before);
        let step = game
            .answer(Answer::Select {
                dice: (0..6).collect(),
            })
            .unwrap();
        assert_eq!(step.player, 0);
        assert!(game.bot_to_move());
        assert!(game.answer(Answer::Select { dice: vec![] }).is_err());
    }

    #[test]
    fn bad_setups_are_refused() {
        assert!(Game::create(bots(&["greedy"]), 1).is_err());
        assert!(Game::create(bots(&["greedy"; 5]), 1).is_err());
        assert!(Game::create(bots(&["greedy", "nobody"]), 1).is_err());
    }
}
