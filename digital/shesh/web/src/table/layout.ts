/**
 * Where everything sits on the table, in table units: a cell of the board
 * is 1 by 1, the origin is the centre of the board, `y` is up. The first
 * player (seat 0) sits at `+z`, the second at `-z`. A point in the frame
 * of a seat has `x` to the right of that player and `z` towards them.
 *
 * The track follows the RFC (`dev/rfc/jogo-de-corrida.md`): columns count
 * from 1 on the left, rows from the edge of the first player. Each player
 * numbers the track along their own path, as on the board of Ur: squares 1
 * to 4 are the own entry lane (columns 6 to 3), 5 to 12 the middle lane
 * (row 6, columns 3 to 10), 13 and 14 the own exit lane (columns 10 and 9),
 * and 15 is off the board. Columns 7 and 8 of the own rows are the gap of
 * the board of Ur: the entry mark and the exit mark sit there.
 */

/** Side of a die. */
export const DIE_SIZE = 0.78;
/** Cells on a side of the board. */
export const BOARD_CELLS = 11;
/** The square a die leaves the board from; the cell beside the exit lane marks it. */
export const EXIT = 15;
export const SHARED_FIRST = 5;
export const SHARED_LAST = 12;
/** The red square, the rosette of the middle lane. */
export const ROSETTE = 8;
/** The rosettes of Ur: the end of the entry lane, the red square and the last square. */
export const ROSETTES: readonly number[] = [4, ROSETTE, 14];
/** Dice dealt to a player; the trays have room for more than they ever hold. */
export const TRAY_SLOTS = 12;

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

// --- The track ---------------------------------------------------------------

/** The `z` of the own row of a seat: the row nearest to them, beside the middle one. */
export const ownRow = (seat: number) => (seat === 0 ? 1 : -1);

/** The `x` of the centre of a column of the board, counting from 1 on the left. */
const columnX = (column: number) => column - (BOARD_CELLS + 1) / 2;

export type Lane = "entry" | "middle" | "exit";

export function laneOf(square: number): Lane {
  return square < SHARED_FIRST ? "entry" : square <= SHARED_LAST ? "middle" : "exit";
}

/** The column of a square (1 to 15) along the path; 15 is the cell of the exit mark. */
export function squareColumn(square: number): number {
  if (square < SHARED_FIRST) return 7 - square;
  if (square <= SHARED_LAST) return square - 2;
  return 23 - square;
}

/** The cell of `square` (1 to 14, or 15 for the mark of the exit) on the table. */
export function squareSpot(seat: number, square: number): Spot {
  const row = laneOf(square) === "middle" ? 0 : ownRow(seat);
  return { x: columnX(squareColumn(square)), z: row };
}

/** The cell where a die waits to enter: square 0, beside the first square. */
export function entrySpot(seat: number): Spot {
  return { x: columnX(7), z: ownRow(seat) };
}

/** The square of `seat` on a cell of the table (x, z at the centre of the cell), or null off its track. */
export function squareAt(seat: number, x: number, z: number): number | null {
  for (let square = 1; square <= EXIT; square++) {
    const spot = squareSpot(seat, square);
    if (Math.abs(spot.x - x) < 0.5 && Math.abs(spot.z - z) < 0.5) return square;
  }
  return null;
}

/** The cell of the table under a point: its centre. */
export function cellOf(x: number, z: number): Spot {
  return { x: Math.round(x), z: Math.round(z) };
}

// --- Trays -------------------------------------------------------------------

/** The shape of the table: beside the board when the screen is wide, above and below it when it is tall. */
export type Arrangement = "wide" | "tall";

/** The arrangement for a canvas of this aspect ratio (width over height). */
export function arrangementFor(aspect: number): Arrangement {
  return aspect >= 1.05 ? "wide" : "tall";
}

/** What a tray holds: the dice waiting to enter, or the dice that left the track (the points). */
export type TrayKind = "reserve" | "points";

/** Distance between the dice of a tray. */
const STEP = 1.1;

export interface TraySize {
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly depth: number;
}

export function traySize(arrangement: Arrangement): TraySize {
  const cols = arrangement === "wide" ? 4 : 6;
  const rows = TRAY_SLOTS / cols;
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
  const size = traySize(arrangement);
  if (arrangement === "wide") {
    const reserveZ = BOARD_HALF - size.depth / 2 + 0.2;
    return seatToTable(seat, { x: BOARD_HALF + 0.6 + size.width / 2, z: kind === "reserve" ? reserveZ : reserveZ - size.depth - 1 });
  }
  const z = BOARD_HALF + 0.5 + size.depth / 2;
  return seatToTable(seat, { x: (kind === "reserve" ? -1 : 1) * (size.width / 2 + 0.2), z });
}

/** Where die `slot` of a tray lies, on the table. */
export function traySpot(seat: number, kind: TrayKind, slot: number, arrangement: Arrangement): Spot {
  const size = traySize(arrangement);
  const col = slot % size.cols;
  const row = Math.floor(slot / size.cols);
  const centre = seatToTable(seat, trayCentre(seat, kind, arrangement)); // The seat frame is its own inverse.
  const at = { x: centre.x + (col - (size.cols - 1) / 2) * STEP, z: centre.z + (row - (size.rows - 1) / 2) * STEP };
  return seatToTable(seat, at);
}

// --- The binary dice ----------------------------------------------------------

/** The four binary dice. */
export const BINARY_DICE = 4;

/** Where binary die `i` rests: on the free rows of the board, on the side of the player who rolled. */
export function binarySpot(seat: number, i: number): Spot {
  return { x: (i - (BINARY_DICE - 1) / 2) * 1.2, z: seat === 0 ? 3.6 : -3.6 };
}

/**
 * Which of the four binary dice show 1 for a roll: `roll` positions, chosen by the turn so the
 * dice look different from turn to turn but a game shows the same every time.
 */
export function binaryFaces(roll: number, turn: number): boolean[] {
  const order = [0, 1, 2, 3];
  let s = (turn * 2654435761 + roll * 40503) >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const ones = new Set(order.slice(0, roll));
  return [0, 1, 2, 3].map((i) => ones.has(i));
}

/** The points the camera keeps in view: the corners of everything on the table. */
export function extentPoints(arrangement: Arrangement): Spot[] {
  const points: Spot[] = [];
  const h = BOARD_HALF;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push({ x: sx * h, z: sz * h });
  const size = traySize(arrangement);
  for (const seat of [0, 1]) {
    const outward = seat === 0 ? 1 : -1;
    for (const kind of ["reserve", "points"] as const) {
      const c = trayCentre(seat, kind, arrangement);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push({ x: c.x + (sx * size.width) / 2, z: c.z + (sz * size.depth) / 2 + (sz === outward ? outward * 0.9 : 0) });
    }
  }
  return points;
}

// --- The frame of the board ---------------------------------------------------

/** The band of the motif: columns and rows of its tile, in grid units. */
export const BAND_W = 8;
export const BAND_H = 9;

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
  readonly gridAt: number;
  readonly cell: number;
  /** Side of the frame, in cells. */
  readonly worldSize: number;
}

export function frameLayout(): FrameLayout {
  const sketch = 852;
  const band = 54;
  const u = band / BAND_H;
  const gap = 7;
  const gutter = 22;
  const plateAt = band + gap;
  const plate = sketch - 2 * plateAt;
  const cell = (plate - 2 * gutter) / BOARD_CELLS;
  return { sketch, u, band, plateAt, plate, gridAt: plateAt + gutter, cell, worldSize: sketch / cell };
}
