import type { Cell } from "../engine/cells";
import { parseCell } from "../engine/cells";
import { SeksGame, type Side } from "../engine/game";
import type { Ruleset } from "./link";

/**
 * Seks in the link of `link.ts`. Commands are the notation of the engine
 * (`b2-b4`, `b2+`) and the order of `legalCommands()` is the engine's (fixed
 * and documented in `seks-engine`'s `legal_commands`). The standard start
 * position is the empty `start`.
 *
 * Any other position is `p`, the side to move (`w` or `b`) and 121 digits, one
 * per cell in cell index order (row 1 first, file a first): `0` empty, `1` to
 * `6` a white die of that value, `a` to `f` a black die. Only positions that
 * start a count (no plies without capture, no history, no result) fit: that
 * is what `Game.fromDiagram` builds.
 */

const CELLS = 121;
const BOARD_SIZE = 11;
const BLACK_DIGITS = "abcdef";

function token(dice: ReadonlyArray<{ cell: Cell; side: Side; value: number }>, toMove: Side): string {
  const cells = new Array<string>(CELLS).fill("0");
  for (const { cell, side, value } of dice) {
    const { col, row } = parseCell(cell);
    cells[(row - 1) * BOARD_SIZE + col] = side === "white" ? String(value) : BLACK_DIGITS.charAt(value - 1);
  }
  return `p${toMove === "white" ? "w" : "b"}${cells.join("")}`;
}

function diagramOf(start: string): { diagram: string; toMove: Side } {
  const valid = start.length === CELLS + 2 && start.startsWith("p") && /^[wb]$/.test(start.charAt(1)) && /^[0-6a-f]+$/.test(start.slice(2));
  if (!valid) throw new Error("not a Seks start position");
  const rows: string[] = [];
  for (let row = BOARD_SIZE; row >= 1; row--) {
    const cells: string[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      const digit = start.charAt(2 + (row - 1) * BOARD_SIZE + col);
      const black = BLACK_DIGITS.indexOf(digit);
      cells.push(digit === "0" ? ".." : black >= 0 ? `b${black + 1}` : `w${digit}`);
    }
    rows.push(cells.join(" "));
  }
  return { diagram: rows.join("\n"), toMove: start.charAt(1) === "w" ? "white" : "black" };
}

/** A game at a start position of a link (`""` for the standard one). Throws if the text is not a position. */
export function gameFromStart(start: string): SeksGame {
  if (start === "") return SeksGame.create();
  const { diagram, toMove } = diagramOf(start);
  return SeksGame.fromDiagram(diagram, toMove);
}

let standard: string | null = null;

/**
 * The `start` of a link for the position `game` is in now, which must be a
 * start of a count: `""` for the standard one. Throws for a position in the
 * middle of a game, which has a history a link does not carry.
 */
export function startOf(game: SeksGame): string {
  const state = game.state();
  if (state.outcome !== null || state.plies_without_capture !== 0 || state.history.length !== 1) {
    throw new Error("a link carries only a position that starts a count of plies without capture");
  }
  const text = token(state.dice, state.to_move);
  if (standard === null) {
    const initial = SeksGame.create();
    const base = initial.state();
    standard = token(base.dice, base.to_move);
    initial.free();
  }
  return text === standard ? "" : text;
}

/** Seks for `link.ts`: replays a link on the engine of the page. */
export const seksRuleset: Ruleset = {
  open(start) {
    const game = gameFromStart(start);
    return {
      legalCommands: () => game.legalCommands(),
      play: (command) => void game.command(command),
      dispose: () => game.free(),
    };
  },
};
