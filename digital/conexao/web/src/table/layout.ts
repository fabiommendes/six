/**
 * Where everything sits on the table, in table units: a cell of the board
 * is 1 by 1, the origin is the centre of the board, `y` is up. The White
 * (seat 0) sit at `+z`, the Black at `-z`.
 *
 * The engine numbers a square `row * 11 + col`, with rows from the White
 * side, and puts a smaller board in the top-left corner of its grid. The
 * table centres a smaller board on the board of the Seks instead: the cells
 * around it are out of the game.
 */

import { tile } from "./motif";

/** Side of a die. */
export const DIE_SIZE = 0.78;
/** Cells on a side of the board of the Seks. */
export const BOARD_CELLS = 11;
/** The stride of a square in the engine. */
const GRID = 11;

/** A point on the table. */
export interface Spot {
  readonly x: number;
  readonly z: number;
}

/** A point of the frame of `seat` as a point of the table. The seats face each other. */
export function seatToTable(seat: number, local: Spot): Spot {
  return seat === 0 ? { x: local.x, z: local.z } : { x: -local.x, z: -local.z };
}

/** The angle of a seat about the vertical: the dice of the Black are turned to face them. */
export function seatAngle(seat: number): number {
  return seat === 0 ? 0 : Math.PI;
}

// --- The board ----------------------------------------------------------------

/** The cells between the edge of the board of the Seks and a board of `size`. */
export const margin = (size: number) => Math.floor((BOARD_CELLS - size) / 2);

/** The centre of the cell of a square of the engine, on the table. */
export function squareSpot(square: number, size: number): Spot {
  const row = Math.floor(square / GRID) + margin(size);
  const col = (square % GRID) + margin(size);
  return { x: col - (BOARD_CELLS - 1) / 2, z: (BOARD_CELLS - 1) / 2 - row };
}

/** The square of the engine on the cell at (x, z), or null off the board of `size`. */
export function squareAt(x: number, z: number, size: number): number | null {
  const col = Math.round(x + (BOARD_CELLS - 1) / 2) - margin(size);
  const row = Math.round((BOARD_CELLS - 1) / 2 - z) - margin(size);
  if (row < 0 || col < 0 || row >= size || col >= size) return null;
  return row * GRID + col;
}

/** The `z` of the centre of row `row` (from 0, the White side) of a board of `size`. */
export function rowZ(row: number, size: number): number {
  return (BOARD_CELLS - 1) / 2 - (row + margin(size));
}

// --- Trays --------------------------------------------------------------------

/** The shape of the table: beside the board when the screen is wide, above and below it when it is tall. */
export type Arrangement = "wide" | "tall";

/** The arrangement for a canvas of this aspect ratio (width over height). */
export function arrangementFor(aspect: number): Arrangement {
  return aspect >= 1.05 ? "wide" : "tall";
}

/** What a tray holds: the dice of the reserve, or the dice of the seat's color that were captured. */
export type TrayKind = "reserve" | "captured";

/** Places in each tray: the reserve holds up to 19 dice (20 per player at most), the captured are few. */
export const TRAY_SLOTS: Readonly<Record<TrayKind, number>> = { reserve: 20, captured: 8 };

/** Distance between the dice of a tray. */
const STEP = 1.1;

export interface TraySize {
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly depth: number;
}

export function traySize(kind: TrayKind, arrangement: Arrangement): TraySize {
  const cols = arrangement === "wide" ? 4 : kind === "reserve" ? 7 : 4;
  const rows = Math.ceil(TRAY_SLOTS[kind] / cols);
  return { cols, rows, width: cols * STEP + 0.4, depth: rows * STEP + 0.5 };
}

/** Half the side of the board with its frame, in cells. */
export const BOARD_HALF = 6.8;

/**
 * The centre of a tray of `seat`, on the table. Wide: both trays in a column
 * beside the board, the reserve nearer the seat. Tall: side by side under the
 * board, the reserve on the left of the seat.
 */
export function trayCentre(seat: number, kind: TrayKind, arrangement: Arrangement): Spot {
  const size = traySize(kind, arrangement);
  if (arrangement === "wide") {
    const reserve = traySize("reserve", arrangement);
    const reserveZ = BOARD_HALF - reserve.depth / 2 + 0.2;
    const z = kind === "reserve" ? reserveZ : reserveZ - reserve.depth / 2 - 1.5 - size.depth / 2;
    return seatToTable(seat, { x: BOARD_HALF + 0.6 + size.width / 2, z });
  }
  // Side by side, centred together, with their near edges in line.
  const reserve = traySize("reserve", arrangement);
  const captured = traySize("captured", arrangement);
  const gap = 0.4;
  const total = reserve.width + gap + captured.width;
  const x = kind === "reserve" ? -total / 2 + reserve.width / 2 : total / 2 - captured.width / 2;
  return seatToTable(seat, { x, z: BOARD_HALF + 0.5 + size.depth / 2 });
}

/** Where die `slot` of a tray lies, on the table. */
export function traySpot(seat: number, kind: TrayKind, slot: number, arrangement: Arrangement): Spot {
  const size = traySize(kind, arrangement);
  const col = slot % size.cols;
  const row = Math.floor(slot / size.cols);
  const centre = seatToTable(seat, trayCentre(seat, kind, arrangement)); // The seat frame is its own inverse.
  const at = { x: centre.x + (col - (size.cols - 1) / 2) * STEP, z: centre.z + (row - (size.rows - 1) / 2) * STEP };
  return seatToTable(seat, at);
}

/** The points the camera keeps in view: the corners of everything on the table. */
export function extentPoints(arrangement: Arrangement): Spot[] {
  const points: Spot[] = [];
  const h = BOARD_HALF;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push({ x: sx * h, z: sz * h });
  for (const seat of [0, 1]) {
    const outward = seat === 0 ? 1 : -1;
    for (const kind of ["reserve", "captured"] as const) {
      const size = traySize(kind, arrangement);
      const c = trayCentre(seat, kind, arrangement);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push({ x: c.x + (sx * size.width) / 2, z: c.z + (sz * size.depth) / 2 + (sz === outward ? outward * 0.9 : 0) });
    }
  }
  return points;
}

// --- The frame of the board ---------------------------------------------------

/**
 * The frame of the board in the proportions of the sketch of the Seks: a
 * plate of 11 by 11 cells inside four bands of motif. All lengths are in
 * pixels of the sketch.
 */
export interface FrameLayout {
  readonly sketch: number;
  readonly u: number;
  readonly band: number;
  readonly plateAt: number;
  readonly plate: number;
  readonly gutter: number;
  readonly gridAt: number;
  readonly cell: number;
  /** Side of the frame, in cells. */
  readonly worldSize: number;
}

export function frameLayout(): FrameLayout {
  const sketch = 852;
  const u = 3.6;
  const band = tile("band").h * u;
  const gap = 7;
  const gutter = 22;
  const plateAt = band + gap;
  const plate = sketch - 2 * plateAt;
  const cell = (plate - 2 * gutter) / BOARD_CELLS;
  return { sketch, u, band, plateAt, plate, gutter, gridAt: plateAt + gutter, cell, worldSize: sketch / cell };
}
