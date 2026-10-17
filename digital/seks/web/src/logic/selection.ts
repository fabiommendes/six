import type { Cell } from "../engine/cells";
import type { Command, DieOptions } from "../engine/game";

/** A die of the side to move that the player picked, with what the engine says it can do. */
export interface Selection {
  readonly at: Cell;
  /** Where it can move, as the engine lists them (the interface never works these out). */
  readonly moves: readonly Cell[];
  readonly canIncrement: boolean;
}

/** What the selection needs to know about the position. */
export interface SelectionBoard {
  /** Whether `cell` has a die of the side to move. */
  isOwnDie(cell: Cell): boolean;
  /** The options of the die in `cell`, from the engine. */
  options(cell: Cell): DieOptions;
}

/** The result of a click: the new selection and, if the click completed a play, the command. */
export interface ClickResult {
  readonly selection: Selection | null;
  readonly command: Command | null;
}

function select(cell: Cell, board: SelectionBoard): Selection {
  const options = board.options(cell);
  return { at: cell, moves: options.moves, canIncrement: options.can_increment };
}

/**
 * The click on a cell, the single gesture of the game (a tap is a click):
 *
 * - on a die of the player, with nothing selected, selects it;
 * - on a marked cell, moves the selected die there;
 * - on the selected die, increments it; a 6 cannot be incremented (and a
 *   die that cannot do anything has nothing to do), so the selection goes away;
 * - on another die of the player, changes the selection;
 * - anywhere else, clears the selection.
 */
export function click(selection: Selection | null, cell: Cell, board: SelectionBoard): ClickResult {
  if (selection !== null) {
    if (cell === selection.at) {
      if (selection.canIncrement) return { selection: null, command: `${cell}+` };
      return { selection: null, command: null };
    }
    if (selection.moves.includes(cell)) return { selection: null, command: `${selection.at}-${cell}` };
  }
  if (board.isOwnDie(cell)) return { selection: select(cell, board), command: null };
  return { selection: null, command: null };
}
