import type { Action, Decision, Spot } from "../engine/game";
import { spotColumn } from "./texts";

/** The options of a turn of the mission phase. */
export type ActOptions = Extract<Decision, { kind: "act" }>;

/**
 * A turn as the table shows it: the engine's options, and the dice still on
 * the mat (neither used nor sacrificed). Only those can be rerolled in a
 * sacrifice; a used 0 or modifier lies in the reserve and can only leave.
 */
export interface Turn {
  readonly options: ActOptions;
  readonly mat: readonly number[];
}

/** What a person is building on a turn, by clicks on the table. */
export type ActMode =
  | { readonly kind: "idle" }
  /** A zero picked: its target next. */
  | { readonly kind: "zero"; readonly die: number }
  /** A modifier picked: its target, then up or down. */
  | { readonly kind: "modify"; readonly die: number; readonly target: number | null }
  /** A sacrifice: the die that leaves and the dice to reroll with it. */
  | { readonly kind: "sacrifice"; readonly out: number; readonly rerolls: readonly number[] }
  /** A mission picked to sabotage, the standard or a card, to confirm. */
  | { readonly kind: "sabotage"; readonly spot: Spot };

export const IDLE: ActMode = { kind: "idle" };

/** The result of a click: the next mode, and the action if the click completes one. */
export interface Click {
  readonly mode: ActMode;
  readonly action?: Action;
}

const targetsOf = (uses: ActOptions["zeros"], die: number) => uses.find((u) => u.die === die)?.targets ?? [];

/** Sacrifices `die` if it can leave, else back to idle. */
const leave = (turn: Turn, die: number): Click => ({
  mode: turn.options.sacrifice.includes(die) ? { kind: "sacrifice", out: die, rerolls: [] } : IDLE,
});

/**
 * A click on die `index` of the hand. From idle, a ready 0 or modifier
 * starts its use and any other die starts a sacrifice; a second click on
 * the 0 or the modifier sacrifices it instead.
 */
export function clickDie(mode: ActMode, turn: Turn, index: number): Click {
  const { options } = turn;
  switch (mode.kind) {
    case "idle":
    case "sabotage":
      if (options.zeros.some((u) => u.die === index)) return { mode: { kind: "zero", die: index } };
      if (options.modifiers.some((u) => u.die === index)) return { mode: { kind: "modify", die: index, target: null } };
      return options.sacrifice.includes(index) ? leave(turn, index) : { mode };
    case "zero":
      if (index === mode.die) return leave(turn, index);
      if (targetsOf(options.zeros, mode.die).includes(index)) return { mode: IDLE, action: { kind: "zero", zero: mode.die, target: index } };
      return { mode };
    case "modify":
      if (index === mode.die) return leave(turn, index);
      if (targetsOf(options.modifiers, mode.die).includes(index)) return { mode: { ...mode, target: mode.target === index ? null : index } };
      return { mode };
    case "sacrifice": {
      if (index === mode.out) return { mode: IDLE };
      if (!turn.mat.includes(index)) return { mode };
      const rerolls = mode.rerolls.includes(index) ? mode.rerolls.filter((i) => i !== index) : [...mode.rerolls, index].sort((a, b) => a - b);
      return { mode: { ...mode, rerolls } };
    }
  }
}

/**
 * A click on the mission at `column` of the table (0 for the standard,
 * then the cards, as `spotColumn`): picks it to sabotage, or drops it.
 */
export function clickCard(mode: ActMode, turn: Turn, column: number): Click {
  if (mode.kind === "sabotage" && spotColumn(mode.spot) === column) return { mode: IDLE };
  const spot = turn.options.sabotage.find((s) => spotColumn(s) === column);
  if ((mode.kind === "idle" || mode.kind === "sabotage") && spot) return { mode: { kind: "sabotage", spot } };
  return { mode };
}

/** The dice of the hand and the columns of the missions (as `spotColumn`) that a click would do something with. */
export function clickable(mode: ActMode, turn: Turn): { dice: Set<number>; cards: Set<number> } {
  const { options } = turn;
  switch (mode.kind) {
    case "idle":
    case "sabotage":
      return {
        dice: new Set([...options.sacrifice, ...options.zeros.map((u) => u.die), ...options.modifiers.map((u) => u.die)]),
        cards: new Set(options.sabotage.map(spotColumn)),
      };
    case "zero":
      return { dice: new Set([mode.die, ...targetsOf(options.zeros, mode.die)]), cards: new Set() };
    case "modify":
      return { dice: new Set([mode.die, ...targetsOf(options.modifiers, mode.die)]), cards: new Set() };
    case "sacrifice":
      return { dice: new Set([mode.out, ...turn.mat.filter((i) => i !== mode.out)]), cards: new Set() };
  }
}

/** The modifier with a target picked, moved up or down. */
export function modify(mode: ActMode, up: boolean): Action | null {
  if (mode.kind !== "modify" || mode.target === null) return null;
  return { kind: "modify", modifier: mode.die, target: mode.target, up };
}

/** The action a confirmation plays: the sacrifice or the sabotage built so far. */
export function confirmed(mode: ActMode): Action | null {
  if (mode.kind === "sacrifice") return { kind: "sacrifice", out: mode.out, rerolls: [...mode.rerolls] };
  if (mode.kind === "sabotage") return { kind: "sabotage", spot: mode.spot };
  return null;
}

/** A face moved by a modifier, kept within 1 and 6 as in the engine. */
export const moved = (face: number, step: number) => Math.min(6, Math.max(1, face + step));
