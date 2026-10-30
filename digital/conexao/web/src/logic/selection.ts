import type { Move, View } from "../engine/game";

/**
 * How taps on the board become moves. A move can take up to three taps, in
 * this order:
 *
 * - A die: chosen to be increased. A second tap on it increases it; a tap on
 *   a square marked for blocking puts a blocking die there (the action 3).
 * - An empty square where a die can be placed: places it at once.
 * - An empty square where only a blocking die fits: chosen for the block;
 *   a tap on a marked die increases that die and blocks.
 * - With the reserve empty, the die placed comes from the board: once the
 *   square (and the die to increase) are chosen, a tap on a marked own die
 *   says which.
 * - With reserve dice of more than one value, the value is chosen last, with
 *   `chooseValue` (the buttons of the dock).
 */
export type Selection =
  | { readonly kind: "none" }
  /** A die chosen to be increased, alone or with a blocking die. */
  | { readonly kind: "raise"; readonly at: number }
  /** An empty square chosen for a blocking die, waiting for the die to increase. */
  | { readonly kind: "block"; readonly to: number }
  /** A placement (`raise` null) or a block, waiting for the own die taken from the board. */
  | { readonly kind: "origin"; readonly to: number; readonly raise: number | null }
  /** A placement (`raise` null) or a block, waiting for the value of the reserve die to spend. */
  | { readonly kind: "value"; readonly to: number; readonly raise: number | null };

export const NONE: Selection = { kind: "none" };

/** What a tap does: the new selection, the move when the tap plays one, and why nothing happened. */
export interface Outcome {
  readonly selection: Selection;
  readonly move: Move | null;
  readonly note: string | null;
}

const keep = (selection: Selection, note: string | null = null): Outcome => ({ selection, move: null, note });
const play = (move: Move): Outcome => ({ selection: NONE, move, note: null });

/** Whether `view` is waiting for a move. */
export function live(view: View): boolean {
  return view.end === null && view.moves.length > 0;
}

/** Whether a die placed now comes from the board: the reserve of the player to move is empty. */
export function fromBoard(view: View): boolean {
  return view.reserve[view.toMove]!.every((n) => n === 0);
}

/** The values of the reserve dice of `seat`, highest first, each once. */
export function reserveValues(view: View, seat: number): number[] {
  return view.reserve[seat]!.flatMap((n, value) => (n > 0 ? [value] : [])).reverse();
}

export function canIncrease(view: View, at: number): boolean {
  return view.moves.some((m) => m.kind === "increase" && m.at === at);
}

/** The placements on `to`, one per die it may come from. */
export function placesOn(view: View, to: number): Move[] {
  return view.moves.filter((m) => m.kind === "place" && m.to === to);
}

/** The blocks on `to`, increasing `raise` when given. */
export function blocksOn(view: View, to: number, raise?: number): Move[] {
  return view.moves.filter((m) => m.kind === "block" && m.to === to && (raise === undefined || m.raise === raise));
}

/** Whether a tap on the die on `at` can start a move: it can be increased, alone or with a block. */
export function raisable(view: View, at: number): boolean {
  return view.moves.some((m) => (m.kind === "increase" && m.at === at) || (m.kind === "block" && m.raise === at));
}

const unique = (squares: number[]) => [...new Set(squares)].sort((a, b) => a - b);

/** The empty squares where a tap places a die. */
export function placeTargets(view: View): number[] {
  return unique(view.moves.flatMap((m) => (m.kind === "place" ? [m.to] : [])));
}

/** The empty squares where a blocking die can go, increasing `raise` when given. */
export function blockTargets(view: View, raise?: number): number[] {
  return unique(view.moves.flatMap((m) => (m.kind === "block" && (raise === undefined || m.raise === raise) ? [m.to] : [])));
}

/** The dice that can be increased together with a blocking die on `to`. */
export function blockRaises(view: View, to: number): number[] {
  return unique(blocksOn(view, to).map((m) => (m as Extract<Move, { kind: "block" }>).raise));
}

/** The moves that a choice of origin or of value completes. */
function pending(view: View, selection: Extract<Selection, { kind: "origin" | "value" }>): Move[] {
  return selection.raise === null ? placesOn(view, selection.to) : blocksOn(view, selection.to, selection.raise);
}

/** The own dice that can be taken from the board for the pending move. */
export function origins(view: View, selection: Selection): number[] {
  if (selection.kind !== "origin") return [];
  return unique(pending(view, selection).flatMap((m) => (m.kind !== "increase" && "board" in m.from ? [m.from.board] : [])));
}

/** The values of the reserve dice that can be spent on the pending move, highest first. */
export function valueChoices(view: View, selection: Selection): number[] {
  if (selection.kind !== "value") return [];
  return unique(pending(view, selection).flatMap((m) => (m.kind !== "increase" && "reserve" in m.from ? [m.from.reserve] : []))).reverse();
}

/** The value of the reserve die a move spends, or null when the die comes from the board. */
export function reserveValueOf(move: Move): number | null {
  return move.kind !== "increase" && "reserve" in move.from ? move.from.reserve : null;
}

/** Plays a placement or a block on `to`, or asks for the value of the reserve die or for the die to take from the board. */
function placeOrAsk(moves: Move[], to: number, raise: number | null): Outcome {
  const reserve = moves.filter((m) => reserveValueOf(m) !== null);
  if (reserve.length === 1) return play(reserve[0]!);
  if (reserve.length > 1) return keep({ kind: "value", to, raise });
  return keep({ kind: "origin", to, raise });
}

/** Spends the reserve die of `value` on the pending move. */
export function chooseValue(view: View, selection: Selection, value: number): Outcome {
  if (selection.kind !== "value" || !live(view)) return keep(selection);
  const move = pending(view, selection).find((m) => reserveValueOf(m) === value);
  return move ? play(move) : keep(selection);
}

/** A tap with nothing chosen (or a tap that drops the choice). */
function fresh(view: View, square: number): Outcome {
  const die = view.cells[square];
  if (die) {
    if (raisable(view, square)) return keep({ kind: "raise", at: square });
    return keep(NONE, die.value >= 6 ? "Esse dado já está em 6." : "Esse dado não pode ser aumentado agora.");
  }
  const places = placesOn(view, square);
  if (places.length > 0) return placeOrAsk(places, square, null);
  if (blocksOn(view, square).length > 0) return keep({ kind: "block", to: square });
  return keep(NONE);
}

/** A tap on the board for the player to move: `square` is null off the board. */
export function click(view: View, selection: Selection, square: number | null): Outcome {
  if (!live(view) || square === null) return keep(NONE);
  const die = view.cells[square] ?? null;
  switch (selection.kind) {
    case "none":
      return fresh(view, square);
    case "raise": {
      if (die && square === selection.at) {
        if (canIncrease(view, square)) return play({ kind: "increase", at: square });
        return keep(selection, "Esse dado só pode ser aumentado junto com um bloqueante: toque numa casa marcada.");
      }
      if (!die) {
        const blocks = blocksOn(view, square, selection.at);
        if (blocks.length > 0) return placeOrAsk(blocks, square, selection.at);
      }
      return fresh(view, square);
    }
    case "block": {
      if (die) {
        const blocks = blocksOn(view, selection.to, square);
        if (blocks.length > 0) return placeOrAsk(blocks, selection.to, square);
        return fresh(view, square);
      }
      return square === selection.to ? keep(NONE) : fresh(view, square);
    }
    case "origin": {
      const move = pending(view, selection).find((m) => m.kind !== "increase" && "board" in m.from && m.from.board === square);
      if (move) return play(move);
      if (square === selection.to) return keep(NONE);
      if (die) return keep(selection, "Escolha um dado seu marcado: é ele que sai do tabuleiro.");
      return fresh(view, square);
    }
    case "value":
      if (square === selection.to) return keep(NONE);
      if (die) return keep(selection, "Escolha o valor do dado da reserva nos botões abaixo.");
      return fresh(view, square);
  }
}

/** The squares a move touches, for the marks of the last move and the preview of a bot. */
export function squaresOf(move: Move): { to: number; raise: number | null; from: number | null } {
  switch (move.kind) {
    case "increase":
      return { to: move.at, raise: null, from: null };
    case "place":
      return { to: move.to, raise: null, from: "board" in move.from ? move.from.board : null };
    case "block":
      return { to: move.to, raise: move.raise, from: "board" in move.from ? move.from.board : null };
  }
}
