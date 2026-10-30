import { defaultRules, type Rules } from "../src/engine/game";

/** The first proposal, 11 by 11 with 16 dice and no capture: the board the tests were written on. */
export function fullBoard(): Rules {
  return { ...defaultRules(), size: 11, dice: 16, capture: false };
}
