import type { Cell } from "@wire/Cell";

export type { Cell };

/** Cells per side of the board. */
export const BOARD_SIZE = 11;

/** The file letters, from column 0 to column 10. */
export const FILES = "abcdefghijk";

/** A cell as numbers: `col` from 0 (file a) to 10 (file k), `row` from 1 to 11 as in the rules. */
export interface Coord {
  readonly col: number;
  readonly row: number;
}

/** Reads a cell in the notation of the engine (`f6`). */
export function parseCell(cell: Cell): Coord {
  const col = FILES.indexOf(cell.charAt(0));
  const row = Number(cell.slice(1));
  if (col < 0 || !Number.isInteger(row) || row < 1 || row > BOARD_SIZE) {
    throw new Error(`not a cell: ${JSON.stringify(cell)}`);
  }
  return { col, row };
}

/** The notation of the engine for a cell (`f6`). */
export function cellName(col: number, row: number): Cell {
  return `${FILES.charAt(col)}${row}`;
}
