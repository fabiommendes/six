import { DEFAULT_BOT_LEVEL } from "../bot/levels";
import { SeksGame } from "../engine/game";
import type { Cell } from "../engine/cells";
import type { Captured, LastPlay, Mode } from "./match";

/** A position to open instead of a new game: the game, what the history would have said, and what is selected. */
export interface Fixture {
  readonly game: SeksGame;
  readonly mode: Mode;
  readonly last: LastPlay | null;
  readonly captured: readonly Captured[];
  readonly select: Cell | null;
  /** Plies without capture from which the count shows (0 shows it always). */
  readonly counterFrom: number | null;
}

/**
 * The game of the art sketch (`arte/esbocos/c-motivos-por-lingua/jogo.html`):
 * the Whites to move with the 6 of f6 selected, after the Blacks played g8 to
 * g6, 23 plies without a capture. The engine does not keep a history of
 * captures, so the captured dice come with the fixture.
 */
export const SKETCH_DIAGRAM = `
  b1 .. b1 .. .. .. b1 .. b1 .. b1
  b2 b2 .. b2 b3 .. b2 b2 .. b2 ..
  .. .. b4 .. .. .. .. .. .. .. ..
  .. .. .. .. .. b5 .. .. .. .. ..
  .. .. .. w3 .. .. .. .. .. .. ..
  .. .. .. .. .. w6 b2 .. .. .. ..
  .. .. .. .. .. .. .. .. w4 .. ..
  .. w2 .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  w2 .. w2 w2 .. .. w2 .. .. w2 ..
  w1 .. w1 .. w1 .. w1 .. w1 .. w1`;

/** The same position with `plies` plies without a capture (placeholder hashes before the current one). */
export function withPliesWithoutCapture(game: SeksGame, plies: number): SeksGame {
  const state = game.state();
  state.plies_without_capture = plies;
  const earlier = Array.from({ length: plies }, (_, i) => (i + 1).toString(16).padStart(16, "0"));
  state.history = [...earlier, state.history.at(-1)!];
  return SeksGame.fromState(state);
}

export function sketchFixture(): Fixture {
  return {
    game: withPliesWithoutCapture(SeksGame.fromDiagram(SKETCH_DIAGRAM, "white"), 23),
    mode: { kind: "hotseat" },
    last: { side: "black", from: "g8", to: "g6", value: 2, captures: 0 },
    captured: [
      { side: "black", value: 1 },
      { side: "white", value: 2 },
    ],
    select: "f6",
    counterFrom: 0,
  };
}

/** The sketch position at 85 plies without a capture: the count shows by the rule of R7. */
export function counterFixture(): Fixture {
  const sketch = sketchFixture();
  return { ...sketch, game: withPliesWithoutCapture(sketch.game, 85), select: null, counterFrom: null };
}

const ENDING_DIAGRAM = `
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. w3 .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. b1
  .. .. .. .. b1 .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  w1 .. .. .. .. .. .. .. .. .. ..`;

/** The Whites win with c8 to c11 (a die ends its move on the Blacks' back row): to see the end of a game. */
export function endingFixture(): Fixture {
  return {
    game: SeksGame.fromDiagram(ENDING_DIAGRAM, "white"),
    mode: { kind: "hotseat" },
    last: null,
    captured: [],
    select: null,
    counterFrom: null,
  };
}

/** The Whites win with c8 to c11 against the bot, playing the Whites. */
export function winFixture(): Fixture {
  return { ...endingFixture(), mode: { kind: "bot", human: "white", level: DEFAULT_BOT_LEVEL } };
}

/** The human plays the Blacks and the bot, with the Whites to move, ends the game at once with c8 to c11. */
export function lossFixture(): Fixture {
  return { ...endingFixture(), mode: { kind: "bot", human: "black", level: DEFAULT_BOT_LEVEL } };
}

/** The sketch position at 99 plies without a capture: any play that does not capture draws (b4 to b5 is one). */
export function drawFixture(): Fixture {
  const sketch = sketchFixture();
  return { ...sketch, game: withPliesWithoutCapture(sketch.game, 99), select: null, counterFrom: null };
}

const STUCK_DIAGRAM = `
  b6 w1 .. .. .. .. .. .. .. .. ..
  w1 w1 .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  .. .. .. .. .. .. .. .. .. .. ..
  w1 .. .. .. .. .. .. .. .. .. ..`;

/** The only Black die is a 6 boxed in a corner: any play of the Whites, such as a1 to a2, leaves the Blacks with no play. */
export function stuckFixture(): Fixture {
  return { game: SeksGame.fromDiagram(STUCK_DIAGRAM, "white"), mode: { kind: "hotseat" }, last: null, captured: [], select: null, counterFrom: null };
}

/** The fixtures that the page opens with `?fixture=NAME`. */
export const FIXTURES: Readonly<Record<string, () => Fixture>> = {
  esboco: sketchFixture,
  contador: counterFixture,
  fim: endingFixture,
  vitoria: winFixture,
  derrota: lossFixture,
  empate: drawFixture,
  "sem-jogada": stuckFixture,
};
