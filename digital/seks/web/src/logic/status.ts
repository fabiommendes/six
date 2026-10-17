import type { View } from "../engine/game";

/** From this many plies without a capture the screen shows the count (R7). */
export const COUNTER_FROM = 80;

/** What the screen says about the draws that are near. */
export interface DrawStatus {
  /** Plies in a row, by both sides, since the last capture. */
  readonly plies: number;
  /** The count at which the game is drawn. */
  readonly max: number;
  /** Whether the count is on screen. */
  readonly showCounter: boolean;
  /** The next repetition of a position would draw the game: the side to move has a play that does it. */
  readonly repetitionWarning: boolean;
  /** The occurrence that draws by repetition (3). */
  readonly repetitionsForDraw: number;
}

export function drawStatus(view: View, counterFrom: number = COUNTER_FROM): DrawStatus {
  const over = view.outcome !== null;
  return {
    plies: view.plies_without_capture,
    max: view.max_plies_without_capture,
    showCounter: view.plies_without_capture >= counterFrom,
    repetitionWarning: !over && view.repetition_draws.length > 0,
    repetitionsForDraw: view.repetitions_for_draw,
  };
}
