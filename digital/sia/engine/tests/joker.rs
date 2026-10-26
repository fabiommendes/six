//! The variant with a joker per player (`experiment::Variant::joker`). The
//! variant is process-wide, so these checks live in a test binary of their
//! own, in one test.

use sia_engine::experiment::{set_variant, Variant};
use sia_engine::{
    best_completion, formation, Command, Die, FormationKind, GameError, GameState, JOKER_SUIT,
};

fn jokers(state: &GameState, player: usize) -> usize {
    state.hand(player).iter().filter(|d| d.is_joker()).count()
}

/// Whether the opponent could roll the joker of `owner` with `command`.
fn rolls_joker_of(state: &GameState, owner: usize, command: &Command) -> bool {
    match *command {
        Command::Reroll { target, dice, .. } if target == owner && state.to_move() != owner => {
            state
                .hand(owner)
                .iter()
                .enumerate()
                .any(|(i, d)| d.is_joker() && dice >> i & 1 == 1)
        }
        _ => false,
    }
}

#[test]
fn the_joker_is_in_the_hand_counts_as_any_suit_and_is_safe_from_the_opponent() {
    set_variant(Variant {
        joker: true,
        ..Variant::default()
    });

    // Preparation: the hand is 4 dice of the bag and the joker.
    let (state, _) = GameState::with_hand_size(5, 1);
    state.validate().unwrap();
    for p in 0..2 {
        assert_eq!(state.hand(p).len(), 5);
        assert_eq!(jokers(&state, p), 1);
        assert!(state.hand(p).iter().all(|d| d.suit <= JOKER_SUIT));
    }

    // Flush and proof: the joker takes the suit of the others.
    let flush = [Die::new(1, 2), Die::new(3, 2), Die::new(6, JOKER_SUIT)];
    assert_eq!(formation(2, &flush).kind, FormationKind::Flush);
    let mixed = [Die::new(1, 2), Die::new(3, 1), Die::new(6, JOKER_SUIT)];
    assert_ne!(formation(2, &mixed).kind, FormationKind::Flush);
    let with_joker = best_completion(2, &[Die::new(1, 2), Die::new(6, JOKER_SUIT)]);
    let without = best_completion(2, &[Die::new(1, 2), Die::new(6, 2)]);
    assert_eq!(with_joker, without);

    // Games: the opponent never rolls a joker, the owner can, the joker
    // is replaced by a die of the bag and no joker comes back.
    let mut owner_rolled = false;
    for seed in 0..60 {
        let (mut state, _) = GameState::with_hand_size(5, seed);
        let mut pick = seed;
        let mut placed = [false; 2];
        while !state.is_over() {
            state.validate().unwrap();
            let commands = state.legal_commands();
            let me = state.to_move();
            for command in &commands {
                if rolls_joker_of(&state, 1 - me, command) {
                    panic!("the opponent can roll the joker");
                }
                if let Command::Reroll { target, dice, .. } = *command {
                    if target == me {
                        owner_rolled |= state
                            .hand(me)
                            .iter()
                            .enumerate()
                            .any(|(i, d)| d.is_joker() && dice >> i & 1 == 1);
                    }
                }
            }
            // A forged roll of the joker of the other hand is refused.
            if let Some(index) = state.hand(1 - me).iter().position(|d| d.is_joker()) {
                if state.hand(me).len() >= 2 && state.step() == sia_engine::Step::Reroll {
                    let forged = Command::Reroll {
                        target: 1 - me,
                        lost: 0,
                        dice: 1 << index,
                    };
                    assert_eq!(state.apply(forged).unwrap_err(), GameError::BadRoll);
                }
            }
            pick = pick
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            let command = commands[(pick >> 33) as usize % commands.len()];
            if let Command::Place { die, .. } = command {
                if state.hand(me)[die].is_joker() {
                    placed[me] = true;
                }
            }
            state = state.apply(command).unwrap().0;
            for (p, &was_placed) in placed.iter().enumerate() {
                assert!(jokers(&state, p) <= 1);
                if was_placed {
                    assert_eq!(jokers(&state, p), 0, "a placed joker is not replaced");
                }
            }
        }
    }
    assert!(owner_rolled, "the owner can roll the own joker");
}
