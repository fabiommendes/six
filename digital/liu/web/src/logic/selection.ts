import type { Command, Pos, View } from "../engine/game";

/**
 * What the player to move has picked so far. A command needs one or two
 * clicks: a market die and a cell ("place from market"), or the hand die,
 * a cell and then the market die that goes to the hand ("place from hand").
 */
export type Selection =
  | { readonly kind: "none" }
  | { readonly kind: "market"; readonly die: number }
  | { readonly kind: "hand" }
  | { readonly kind: "handAt"; readonly at: Pos };

export type Click =
  | { readonly kind: "market"; readonly die: number }
  | { readonly kind: "hand" }
  | { readonly kind: "cell"; readonly at: Pos };

export const NONE: Selection = { kind: "none" };

export interface Outcome {
  readonly selection: Selection;
  /** The command the click completes, if any. */
  readonly command?: Command;
}

export const samePos = (a: Pos, b: Pos) => a.row === b.row && a.col === b.col;

/** The value of the die the selection would put in the window. */
export function selectedValue(view: View, selection: Selection): number | null {
  const hand = view.players[view.toMove]?.hand ?? null;
  switch (selection.kind) {
    case "market":
      return view.market[selection.die] ?? null;
    case "hand":
    case "handAt":
      return hand;
    case "none":
      return null;
  }
}

/** The cells to mark as targets of the selection. */
export function targetsOf(view: View, selection: Selection): Pos[] {
  if (selection.kind !== "market" && selection.kind !== "hand") return [];
  const value = selectedValue(view, selection);
  return value === null ? [] : (view.targets[value - 1] ?? []);
}

/** What a click does with the selection, and the command it completes. */
export function click(view: View, selection: Selection, input: Click): Outcome {
  if (view.end !== null) return { selection: NONE };
  switch (input.kind) {
    case "market": {
      if (input.die < 0 || input.die >= view.market.length) return { selection };
      if (selection.kind === "handAt") {
        return { selection: NONE, command: { kind: "placeFromHand", die: input.die, at: selection.at } };
      }
      if (selection.kind === "market" && selection.die === input.die) return { selection: NONE };
      return { selection: { kind: "market", die: input.die } };
    }
    case "hand": {
      if (selection.kind === "hand" || selection.kind === "handAt") return { selection: NONE };
      return { selection: view.canPlaceFromHand ? { kind: "hand" } : selection };
    }
    case "cell": {
      const fits = targetsOf(view, selection).some((at) => samePos(at, input.at));
      if (!fits) return { selection: selection.kind === "handAt" ? selection : NONE };
      if (selection.kind === "market") {
        return { selection: NONE, command: { kind: "placeFromMarket", die: selection.die, at: input.at } };
      }
      return { selection: { kind: "handAt", at: input.at } };
    }
  }
}

/** The "keep" command for the selection, when the hand is empty. */
export function keepCommand(view: View, selection: Selection): Command | null {
  return view.canKeep && selection.kind === "market" ? { kind: "keep", die: selection.die } : null;
}
