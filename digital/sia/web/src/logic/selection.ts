import type { Command, Die, View } from "../engine/game";
import { isJoker } from "./formation";

/**
 * What the person to move has picked so far: nothing, a die of the hand to
 * put on a stone, or a reroll being built (the hand to roll, the die to
 * lose and the dice to roll).
 */
export type Selection =
  | { readonly kind: "none" }
  | { readonly kind: "die"; readonly die: number }
  | { readonly kind: "reroll"; readonly target: number | null; readonly lost: number | null; readonly dice: readonly number[] };

export const NONE: Selection = { kind: "none" };

/** A click on the table, as the selection reads it. */
export type Click =
  | { readonly kind: "hand"; readonly seat: number; readonly die: number }
  | { readonly kind: "stone"; readonly stone: number }
  | { readonly kind: "side"; readonly seat: number; readonly stone: number };

export interface Outcome {
  readonly selection: Selection;
  /** The command the click completes, if it does. */
  readonly command: Command | null;
  /** Why a click did nothing, when the player needs to know. */
  readonly note: string | null;
}

const stay = (selection: Selection, note: string | null = null): Outcome => ({ selection, command: null, note });

/** The empty reroll the "Rolar de novo" button starts. */
export const REROLL_START: Selection = { kind: "reroll", target: null, lost: null, dice: [] };

/**
 * The reroll the "Rolar de novo" button starts. A die of the own hand already
 * selected opens it with the own hand chosen and that die marked to roll, so
 * the player only has to pick the die to lose.
 */
export function rerollStart(view: View, selection: Selection): Selection {
  if (selection.kind !== "die" || !view.players[view.toMove]?.hand[selection.die]) return REROLL_START;
  return { kind: "reroll", target: view.toMove, lost: null, dice: [selection.die] };
}

/** The stones where the die selected may go. */
export function placeTargets(view: View, selection: Selection): number[] {
  if (selection.kind !== "die") return [];
  return view.open.flatMap((open, i) => (open ? [i] : []));
}

/** The die of the hand selected to be put, if any. */
export function selectedDie(view: View, selection: Selection): Die | null {
  if (selection.kind !== "die") return null;
  return view.players[view.toMove]?.hand[selection.die] ?? null;
}

const toggle = (dice: readonly number[], die: number) => (dice.includes(die) ? dice.filter((d) => d !== die) : [...dice, die].sort((a, b) => a - b));

/** A click while a reroll is being built. */
function rerollClick(view: View, selection: Extract<Selection, { kind: "reroll" }>, click: Click): Outcome {
  const me = view.toMove;
  if (click.kind !== "hand") return stay(selection);
  if (click.seat === me) {
    if (selection.lost === null) return stay({ ...selection, lost: click.die, dice: selection.dice.filter((d) => d !== click.die) });
    if (click.die === selection.lost) return stay({ ...selection, lost: null });
    if (selection.target === null || selection.target === me) {
      return stay({ ...selection, target: me, dice: toggle(selection.target === me ? selection.dice : [], click.die) });
    }
    // Rolling the other hand: another die of the own hand is the one to lose.
    return stay({ ...selection, lost: click.die });
  }
  const picked = view.players[click.seat]?.hand[click.die];
  if (picked && isJoker(picked)) return stay(selection, "O coringa do adversário não pode ser rolado.");
  const other = selection.target === click.seat ? selection.dice : [];
  return stay({ ...selection, target: click.seat, dice: toggle(other, click.die) });
}

/** What a click on the table does, given what is selected. Pure: the engine still checks the command. */
export function click(view: View, selection: Selection, input: Click): Outcome {
  const me = view.toMove;
  if (selection.kind === "reroll") return rerollClick(view, selection, input);
  switch (input.kind) {
    case "hand":
      if (input.seat !== me) return stay(selection);
      if (selection.kind === "die" && selection.die === input.die) return stay(NONE);
      if (!view.open.some(Boolean)) return stay(NONE, "Nenhum marco tem lugar para um dado seu.");
      return stay({ kind: "die", die: input.die });
    case "stone": {
      if (view.claimable[input.stone]) return { selection: NONE, command: { kind: "claim", stone: input.stone }, note: null };
      if (selection.kind === "die" && view.open[input.stone]) return { selection: NONE, command: { kind: "place", die: selection.die, stone: input.stone }, note: null };
      return stay(selection, view.stones[input.stone]?.owner != null ? "Este marco já foi tomado." : null);
    }
    case "side":
      if (input.seat !== me) return stay(selection);
      if (!view.open[input.stone]) return stay(selection, view.stones[input.stone]?.owner != null ? "Este marco já foi tomado." : "Seu lado deste marco já tem 3 dados.");
      if (selection.kind !== "die") return stay(selection, "Escolha antes um dado da sua mão.");
      return { selection: NONE, command: { kind: "place", die: selection.die, stone: input.stone }, note: null };
  }
}

/** The bit mask of dice of a hand, as `Command.reroll` reads it. */
export function diceMask(dice: readonly number[]): number {
  return dice.reduce((mask, die) => mask | (1 << die), 0);
}

/** The reroll command a built selection stands for, or null while it lacks the die to lose, the hand or the dice. */
export function rerollCommand(selection: Selection): Command | null {
  if (selection.kind !== "reroll" || selection.target === null || selection.lost === null || selection.dice.length === 0) return null;
  return { kind: "reroll", target: selection.target, lost: selection.lost, dice: diceMask(selection.dice) };
}

/** What a reroll built so far would cost and do, for the prompt and the table. */
export interface RerollPreview {
  readonly lost: Die | null;
  /** Dice of the own hand after the loss: the hand is refilled only up to this. */
  readonly handLimit: number;
  readonly rolled: readonly Die[];
  readonly target: number | null;
}

export function rerollPreview(view: View, selection: Selection): RerollPreview | null {
  if (selection.kind !== "reroll") return null;
  const me = view.toMove;
  const own = view.players[me]!;
  const targetHand = selection.target === null ? null : view.players[selection.target]!.hand;
  return {
    lost: selection.lost === null ? null : (own.hand[selection.lost] ?? null),
    handLimit: view.handSize - own.lost - 1,
    rolled: targetHand ? selection.dice.flatMap((i) => (targetHand[i] ? [targetHand[i]!] : [])) : [],
    target: selection.target,
  };
}
