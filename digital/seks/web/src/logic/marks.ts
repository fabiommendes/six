import type { Cell } from "../engine/cells";

/**
 * The marks of play on the board, each with its own shape (the colour never
 * carries information alone): selection is a heavy square, a destination is a
 * ring, the origin of the last play is a dashed square and its destination
 * is corner brackets.
 */
export interface Marks {
  readonly selected: Cell | null;
  readonly destinations: readonly Cell[];
  readonly lastFrom: Cell | null;
  readonly lastTo: Cell | null;
}

export const NO_MARKS: Marks = { selected: null, destinations: [], lastFrom: null, lastTo: null };
