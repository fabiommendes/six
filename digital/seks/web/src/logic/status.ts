import type { View } from "../engine/game";

/** What the screen says about the draws that are near. */
export interface DrawStatus {
  /** The next repetition of a position would draw the game: the side to move has a play that does it. */
  readonly repetitionWarning: boolean;
  /** The occurrence that draws by repetition (3). */
  readonly repetitionsForDraw: number;
}

export function drawStatus(view: View): DrawStatus {
  const over = view.outcome !== null;
  return {
    repetitionWarning: !over && view.repetition_draws.length > 0,
    repetitionsForDraw: view.repetitions_for_draw,
  };
}
