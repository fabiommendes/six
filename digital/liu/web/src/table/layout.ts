import type { Pos } from "../engine/game";

/**
 * Where everything sits on the table, in table units: a cell of a window is
 * 1 by 1, the origin is the centre of the market, `y` is up. Each seat has
 * its own frame: the owner sits at `+z`, `x` grows to the owner's right and a
 * window row grows towards the owner, as a sheet of paper on the table.
 */

/** Side of a die. */
export const DIE_SIZE = 0.78;
/** How far a window may ever reach from its seal, in cells. */
export const REACH = 3;
/** Side of the mat of a window: the 7 by 7 cells it may use and the band around them. */
export const MAT_SIZE = 2 * REACH + 1 + 1.3;
/** From the centre of the table to the centre of a mat (the seal). */
export const SEAT_DISTANCE = 9.6;
/** Where the hand of a seat is, in the seat frame: to the owner's right, near the edge. */
export const HAND_AT = { x: MAT_SIZE / 2 + 1.1, z: 2.2 } as const;
/** Spacing of the dice in the market. */
const MARKET_STEP = 1.08;
/** Dice in a row of the market. */
const MARKET_ROW = 5;

/** A point on the table. */
export interface Spot {
  readonly x: number;
  readonly z: number;
}

/**
 * The angle of a seat about the vertical, in radians. The seats go
 * clockwise seen from above, starting with seat 0 at the bottom (`+z`).
 */
export function seatAngle(seat: number, seats: number): number {
  return -(seat * 2 * Math.PI) / seats;
}

/** A point of the frame of `seat` (`local`), on the table. */
export function seatToTable(seat: number, seats: number, local: Spot): Spot {
  const a = seatAngle(seat, seats);
  const x = local.x;
  const z = local.z + SEAT_DISTANCE;
  return { x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) };
}

/** A point of the table in the frame of `seat`: the inverse of `seatToTable`. */
export function tableToSeat(seat: number, seats: number, point: Spot): Spot {
  const a = -seatAngle(seat, seats);
  const x = point.x * Math.cos(a) + point.z * Math.sin(a);
  const z = -point.x * Math.sin(a) + point.z * Math.cos(a);
  return { x, z: z - SEAT_DISTANCE };
}

/** The centre of a cell of a window, in the frame of its seat. */
export function cellSpot(at: Pos): Spot {
  return { x: at.col, z: at.row };
}

/** The cell of a window under a point of the seat frame, or null off the 7 by 7. */
export function cellAt(local: Spot): Pos | null {
  const col = Math.round(local.x);
  const row = Math.round(local.z);
  if (Math.abs(col) > REACH || Math.abs(row) > REACH) return null;
  return { row, col };
}

/**
 * Where die `index` of a market of `count` dice lies, on the table: rows of
 * five, centred, the first row the farthest from seat 0.
 */
export function marketSpot(index: number, count: number): Spot {
  const rows = Math.max(1, Math.ceil(count / MARKET_ROW));
  const row = Math.floor(index / MARKET_ROW);
  const inRow = row < rows - 1 ? MARKET_ROW : count - row * MARKET_ROW;
  const col = index % MARKET_ROW;
  return { x: (col - (inRow - 1) / 2) * MARKET_STEP, z: (row - (rows - 1) / 2) * MARKET_STEP };
}

/** Where the bag stands: between the first two seats, to the left of the first player. */
export function bagSpot(seats: number): Spot {
  const a = seatAngle(0.5, seats);
  const r = seats === 4 ? 9.4 : 8.6;
  return { x: r * Math.sin(a), z: r * Math.cos(a) };
}

/** Radius of the market tray: room for the dice of a large market. */
export const MARKET_RADIUS = 3.6;

/** How far the table reaches from its centre: the camera keeps all of it in view. */
export function tableExtent(): number {
  return SEAT_DISTANCE + MAT_SIZE / 2 + 0.6;
}
