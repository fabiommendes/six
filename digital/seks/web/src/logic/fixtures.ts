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
}

/**
 * The game of the art sketch (`arte/esbocos/c-motivos-por-lingua/jogo.html`):
 * the Whites to move with the 6 of f6 selected, after the Blacks played g8 to
 * g6. The engine does not keep a history of captures, so the captured dice
 * come with the fixture.
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

export function sketchFixture(): Fixture {
  return {
    game: SeksGame.fromDiagram(SKETCH_DIAGRAM, "white"),
    mode: { kind: "hotseat" },
    last: { side: "black", from: "g8", to: "g6", value: 2, captures: 0 },
    captured: [
      { side: "black", value: 1 },
      { side: "white", value: 2 },
    ],
    select: "f6",
  };
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

/** Seven plies of a cycle of four: the next play, b8 to b10, repeats a position for the third time and draws. */
export function drawFixture(): Fixture {
  const game = SeksGame.create();
  const cycle = ["b2-b4", "b10-b8", "b4-b2", "b8-b10"];
  for (const command of [...cycle, ...cycle.slice(0, 3)]) game.command(command);
  return { game, mode: { kind: "hotseat" }, last: null, captured: [], select: null };
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
  return { game: SeksGame.fromDiagram(STUCK_DIAGRAM, "white"), mode: { kind: "hotseat" }, last: null, captured: [], select: null };
}

/** The fixtures that the page opens with `?fixture=NAME`. */
export const FIXTURES: Readonly<Record<string, () => Fixture>> = {
  esboco: sketchFixture,
  fim: endingFixture,
  vitoria: winFixture,
  derrota: lossFixture,
  empate: drawFixture,
  "sem-jogada": stuckFixture,
};
