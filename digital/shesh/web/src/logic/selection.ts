import type { Command, Move, View } from "../engine/game";
import { EXIT } from "../table/layout";

/** The move the player has chosen, as its position in `view.moves`; null when none. */
export type Selection = number | null;
export const NONE: Selection = null;

/** What the player touched: a die waiting in the reserve, or a square of their track. */
export type Click = { readonly kind: "reserve"; readonly value: number } | { readonly kind: "square"; readonly square: number };

/** What a click does: the new selection, and the command when the click plays the move. */
export interface Outcome {
  readonly selection: Selection;
  readonly command: Command | null;
  /** Why nothing happened, when the player touched a die that cannot move. */
  readonly note: string | null;
}

/** A die that can move now: from the reserve (by value) or from a square. */
export type Source = { readonly kind: "reserve"; readonly value: number } | { readonly kind: "square"; readonly square: number };

/** Where a move starts; null for a pass. */
export function sourceOf(move: Move): Source | null {
  switch (move.command.kind) {
    case "enter":
      return { kind: "reserve", value: move.command.value };
    case "move":
      return { kind: "square", square: move.command.from };
    case "pass":
      return null;
  }
}

/** The square where a move ends (`EXIT` for leaving the board); null for a pass. */
export function destinationOf(view: View, move: Move): number | null {
  switch (move.command.kind) {
    case "enter":
      return view.roll;
    case "move":
      return move.command.from + view.roll;
    case "pass":
      return null;
  }
}

/** The dice that can move now, one source per legal move. */
export function sources(view: View): Source[] {
  return view.moves.flatMap((move) => {
    const source = sourceOf(move);
    return source ? [source] : [];
  });
}

/** The index of the move that starts at `source`, or -1. */
function moveFrom(view: View, source: Source): number {
  return view.moves.findIndex((move) => {
    const from = sourceOf(move);
    if (!from || from.kind !== source.kind) return false;
    return from.kind === "reserve" ? from.value === (source as typeof from).value : from.square === (source as typeof from).square;
  });
}

/** Whether the move is the only way to pass. */
export function mustPass(view: View): boolean {
  return view.end === null && view.moves.length === 1 && view.moves[0]!.command.kind === "pass";
}

/** A touch on the table or on a card of the move list, for the player to move. */
export function click(view: View, selection: Selection, input: Click | { readonly kind: "move"; readonly index: number }): Outcome {
  if (view.end !== null || mustPass(view)) return { selection: NONE, command: null, note: null };
  const play = (index: number): Outcome => ({ selection: NONE, command: view.moves[index]!.command, note: null });
  if (input.kind === "move") {
    return selection === input.index ? play(input.index) : { selection: input.index, command: null, note: null };
  }
  if (input.kind === "square" && selection !== null) {
    // The destination of the chosen move plays it.
    const chosen = view.moves[selection];
    if (chosen && destinationOf(view, chosen) === input.square) return play(selection);
  }
  const index = moveFrom(view, input);
  if (index >= 0) return selection === index ? play(index) : { selection: index, command: null, note: null };
  if (input.kind === "square" && view.players[view.toMove]!.track[input.square]! > 0 && input.square < EXIT) {
    return { selection, command: null, note: `Esse dado não pode andar ${view.roll} ${view.roll === 1 ? "casa" : "casas"}.` };
  }
  return { selection: NONE, command: null, note: null };
}
