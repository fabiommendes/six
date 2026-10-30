import type { Action, Decision } from "../engine/game";

/** The options of a turn of the mission phase. */
export type ActOptions = Extract<Decision, { kind: "act" }>;

/** What a person is building on a turn, die by die. */
export type ActMode =
  | { readonly kind: "idle" }
  /** A zero picked: its target next. */
  | { readonly kind: "zero"; readonly die: number }
  /** A modifier picked: its target, then up or down. */
  | { readonly kind: "modify"; readonly die: number; readonly target: number | null }
  /** A sacrifice: the die that leaves, then the dice to reroll. */
  | { readonly kind: "sacrifice"; readonly out: number | null; readonly rerolls: readonly number[] };

export const IDLE: ActMode = { kind: "idle" };

/** The result of a click: the next mode, and the action if the click completes one. */
export interface Click {
  readonly mode: ActMode;
  readonly action?: Action;
}

const targetsOf = (uses: ActOptions["zeros"], die: number) => uses.find((u) => u.die === die)?.targets ?? [];

/** A click on die `index` of the hand. */
export function clickDie(mode: ActMode, options: ActOptions, index: number): Click {
  switch (mode.kind) {
    case "idle":
      if (options.zeros.some((u) => u.die === index)) return { mode: { kind: "zero", die: index } };
      if (options.modifiers.some((u) => u.die === index)) return { mode: { kind: "modify", die: index, target: null } };
      return { mode };
    case "zero":
      if (index === mode.die) return { mode: IDLE };
      if (targetsOf(options.zeros, mode.die).includes(index)) return { mode: IDLE, action: { kind: "zero", zero: mode.die, target: index } };
      return { mode };
    case "modify":
      if (index === mode.die) return { mode: IDLE };
      if (targetsOf(options.modifiers, mode.die).includes(index)) return { mode: { ...mode, target: mode.target === index ? null : index } };
      return { mode };
    case "sacrifice":
      if (mode.out === null) return options.sacrifice.includes(index) ? { mode: { ...mode, out: index } } : { mode };
      if (index === mode.out) return { mode: { kind: "sacrifice", out: null, rerolls: [] } };
      if (!options.sacrifice.includes(index)) return { mode };
      return {
        mode: { ...mode, rerolls: mode.rerolls.includes(index) ? mode.rerolls.filter((i) => i !== index) : [...mode.rerolls, index].sort((a, b) => a - b) },
      };
  }
}

/** The dice of the hand that a click would do something with. */
export function clickable(mode: ActMode, options: ActOptions): Set<number> {
  switch (mode.kind) {
    case "idle":
      return new Set([...options.zeros, ...options.modifiers].map((u) => u.die));
    case "zero":
      return new Set([mode.die, ...targetsOf(options.zeros, mode.die)]);
    case "modify":
      return new Set([mode.die, ...targetsOf(options.modifiers, mode.die)]);
    case "sacrifice":
      return new Set(options.sacrifice);
  }
}

/** The modifier with a target picked, moved up or down. */
export function modify(mode: ActMode, up: boolean): Action | null {
  if (mode.kind !== "modify" || mode.target === null) return null;
  return { kind: "modify", modifier: mode.die, target: mode.target, up };
}

/** The sacrifice built so far, if it has the die that leaves. */
export function sacrifice(mode: ActMode): Action | null {
  if (mode.kind !== "sacrifice" || mode.out === null) return null;
  return { kind: "sacrifice", out: mode.out, rerolls: [...mode.rerolls] };
}

/** A face moved by a modifier, kept within 1 and 6 as in the engine. */
export const moved = (face: number, step: number) => Math.min(6, Math.max(1, face + step));
