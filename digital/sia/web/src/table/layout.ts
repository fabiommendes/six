import { tile } from "./motif";

/**
 * Where everything sits on the table, in table units: a cell of the board
 * is 1 by 1, the origin is the centre of the board, `y` is up. The first
 * player (seat 0) sits at `+z`, the second at `-z`. A point in the frame
 * of a seat has `x` to the right of that player and `z` towards them.
 */

/** Side of a die. */
export const DIE_SIZE = 0.78;
/** Cells on a side of the board. */
export const BOARD_CELLS = 11;
/** Stones in the row, and the column of the first one. */
export const STONES = 9;
/** Dice on a side of a stone. */
export const SIDE_DICE = 3;

/** A point on the table. */
export interface Spot {
  readonly x: number;
  readonly z: number;
}

/** A point of the frame of `seat` as a point of the table. The seats face each other. */
export function seatToTable(seat: number, local: Spot): Spot {
  return seat === 0 ? { x: local.x, z: local.z } : { x: -local.x, z: -local.z };
}

/** The angle of a seat about the vertical: the second player's dice are turned to face them. */
export function seatAngle(seat: number): number {
  return seat === 0 ? 0 : Math.PI;
}

/** The column of a stone, in table units. */
export const stoneColumn = (stone: number) => stone - (STONES - 1) / 2;

/** The cell of a stone on the central row, on the table. */
export function stoneSpot(stone: number): Spot {
  return { x: stoneColumn(stone), z: 0 };
}

/**
 * The cell of die `k` (0 to 2) of the side of `seat` at `stone`, on the table:
 * nearest the stone first. Both sides of a stone are in its column, one on
 * each side of the central row.
 */
export function sideSpot(seat: number, stone: number, k: number): Spot {
  return { x: stoneColumn(stone), z: seat === 0 ? 1 + k : -(1 + k) };
}

/** The row of the far end of a column, counted from the central row: the last of the 5 rows of a side. */
export const LAST_ROW = (BOARD_CELLS - 1) / 2;

/**
 * The cell of a part of a formation taken by `seat` at `stone`, on the table.
 * The column of the stone (the stone, then its `dice` dice in the same order)
 * slides in a straight line to the end of the board on the side of the
 * winner: the last die lands on the last row. Part 0 is the stone, then the
 * dice.
 */
export function claimedSpot(seat: number, stone: number, part: number, dice = SIDE_DICE): Spot {
  const shift = LAST_ROW - dice;
  return { x: stoneColumn(stone), z: (seat === 0 ? 1 : -1) * (shift + part) };
}

/** The shape of the table: beside the board when the screen is wide, above and below it when it is tall. */
export type Arrangement = "wide" | "tall";

/** The arrangement for a canvas of this aspect ratio (width over height). */
export function arrangementFor(aspect: number): Arrangement {
  return aspect >= 1.05 ? "wide" : "tall";
}

/** Dice in a hand at the start, by the rules. */
export const HAND_SIZE = 7;
/** Distance between the dice of a hand tray. */
const STEP = 1.1;

export interface TraySize {
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly depth: number;
}

/** The tray for a hand of up to `slots` dice. */
export function traySize(arrangement: Arrangement, slots = HAND_SIZE): TraySize {
  if (arrangement === "wide") {
    const rows = Math.ceil(slots / 3);
    return { cols: 3, rows, width: 3 * STEP + 0.5, depth: rows * STEP + 0.5 };
  }
  return { cols: slots, rows: 1, width: slots * STEP + 0.4, depth: STEP + 0.6 };
}

/** Half the side of the board with its frame, in cells. */
export const BOARD_HALF = 6.8;

/** The centre of the hand tray of `seat`, on the table. */
export function trayCentre(seat: number, arrangement: Arrangement, slots = HAND_SIZE): Spot {
  const size = traySize(arrangement, slots);
  const local = arrangement === "wide" ? { x: BOARD_HALF + 0.6 + size.width / 2, z: BOARD_HALF - size.depth / 2 + 0.2 } : { x: 0, z: BOARD_HALF + 0.5 + size.depth / 2 };
  return seatToTable(seat, local);
}

/** Where die `slot` of the hand of `seat` lies, on the table. */
export function handSpot(seat: number, slot: number, arrangement: Arrangement, slots = HAND_SIZE): Spot {
  const size = traySize(arrangement, slots);
  const col = slot % size.cols;
  const row = Math.floor(slot / size.cols);
  const centre = trayCentre(seat, arrangement, slots);
  const local = seatToTable(seat, centre); // The seat frame is its own inverse.
  const at = { x: local.x + (col - (size.cols - 1) / 2) * STEP, z: local.z + (row - (size.rows - 1) / 2) * STEP };
  return seatToTable(seat, at);
}

/** Radius the bag takes on the table, with some air around it. */
export const BAG_RADIUS = 2.5;

/** How much the bag is scaled from its first sketch. */
export const BAG_SCALE = 1.0;

/** Where the bag stands: the dice are drawn from it and the dice lost go back into it. */
export function bagSpot(arrangement: Arrangement): Spot {
  if (arrangement === "wide") return { x: -(BOARD_HALF + 3.2), z: BOARD_HALF - 1.6 };
  const tray = traySize(arrangement);
  return { x: -(tray.width / 2 + 2.6), z: Math.max(trayCentre(0, arrangement).z, BOARD_HALF + BAG_RADIUS + 0.2) };
}

/** The points the camera keeps in view: the corners of everything on the table. */
export function extentPoints(arrangement: Arrangement): Spot[] {
  const points: Spot[] = [];
  const h = BOARD_HALF;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push({ x: sx * h, z: sz * h });
  for (const seat of [0, 1]) {
    const c = trayCentre(seat, arrangement);
    const size = traySize(arrangement);
    // The name of the player is written past the outer edge.
    const outward = seat === 0 ? 1 : -1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push({ x: c.x + (sx * size.width) / 2, z: c.z + (sz * size.depth) / 2 + (sz === outward ? outward * 1.4 : 0) });
    // The label is wider than the tray.
    for (const sx of [-1, 1]) points.push({ x: c.x + sx * 2.9, z: c.z + outward * (size.depth / 2 + 0.75) });
  }
  const bag = bagSpot(arrangement);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push({ x: bag.x + sx * BAG_RADIUS, z: bag.z + sz * BAG_RADIUS });
  return points;
}

// --- The frame of the board -----------------------------------------------------

/**
 * The frame of the board in the proportions of the sketch of the Seks: a
 * plate of 11 by 11 cells with a gutter for the letters of the stones,
 * inside four bands of motif. All lengths are in pixels of the sketch.
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
