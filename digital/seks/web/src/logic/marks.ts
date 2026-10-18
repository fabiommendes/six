import type { Cell } from "../engine/cells";

/**
 * The marks of play on the board, each with its own shape (the colour never
 * carries information alone): selection is a heavy square, a destination is a
 * ring, a die that can be shot has four ticks pointing at it, the origin of
 * the last play is a dashed square and its destination is corner brackets, and what decided the end of the game (the die that
 * reached the back row, or the dice of the side with no play) is a heavy
 * double frame.
 */
export interface Marks {
  readonly selected: Cell | null;
  readonly destinations: readonly Cell[];
  /** The dice the selected die can shoot. */
  readonly targets?: readonly Cell[];
  readonly lastFrom: Cell | null;
  readonly lastTo: Cell | null;
  /** The cells that decided the end of the game; none while it goes on. */
  readonly decisive?: readonly Cell[];
}

export const NO_MARKS: Marks = { selected: null, destinations: [], lastFrom: null, lastTo: null };
