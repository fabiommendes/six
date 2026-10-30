/** Where things sit on the table, in world units on the XZ plane (x right, z toward the first seat). */

export const TABLE_W = 26;
export const TABLE_D = 19;

export const HAND_DIE = 1.0;
export const HAND_STEP = 1.3;
export const RESERVE_DIE = 0.62;
export const RESERVE_STEP = 0.78;
/** Reserve dice per row of a tray. */
export const RESERVE_ROW = 12;
export const SHOWCASE_DIE = 0.85;
export const CARD_W = 2.9;
export const CARD_D = 3.9;

/** The tray of a seat: its centre and size. */
export interface Tray {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
}

const TRAY_D = 6;
const ROW_Z = TABLE_D / 2 - TRAY_D / 2 - 0.3;

/** The trays of `players` seats: the first at the bottom, the others around. */
export function trays(players: number): Tray[] {
  const full = TABLE_W - 1;
  const half = full / 2 - 0.25;
  const bottom = ROW_Z;
  const top = -ROW_Z;
  const left = -(half / 2 + 0.25);
  const right = half / 2 + 0.25;
  switch (players) {
    case 2:
      return [
        { x: 0, z: bottom, w: full, d: TRAY_D },
        { x: 0, z: top, w: full, d: TRAY_D },
      ];
    case 3:
      return [
        { x: 0, z: bottom, w: full, d: TRAY_D },
        { x: left, z: top, w: half, d: TRAY_D },
        { x: right, z: top, w: half, d: TRAY_D },
      ];
    default:
      return [
        { x: left, z: bottom, w: half, d: TRAY_D },
        { x: right, z: bottom, w: half, d: TRAY_D },
        { x: right, z: top, w: half, d: TRAY_D },
        { x: left, z: top, w: half, d: TRAY_D },
      ];
  }
}

/** The place of die `index` of a hand of `count` dice in `tray`: one row, centred, near the front. */
export function handSpot(tray: Tray, index: number, count: number): { x: number; z: number } {
  const width = (Math.max(count, 1) - 1) * HAND_STEP;
  return { x: tray.x - width / 2 + index * HAND_STEP, z: tray.z + tray.d / 2 - 1.3 };
}

/** The place of die `index` of the reserve out of the hand: rows behind the hand. */
export function reserveSpot(tray: Tray, index: number): { x: number; z: number } {
  const row = Math.floor(index / RESERVE_ROW);
  const col = index % RESERVE_ROW;
  const width = (RESERVE_ROW - 1) * RESERVE_STEP;
  return { x: tray.x - width / 2 + col * RESERVE_STEP, z: tray.z - tray.d / 2 + 2.0 + row * RESERVE_STEP };
}

/** The place of mission `column` (0 for the standard) in the middle of the table, from the left. */
export function cardSpot(column: number): { x: number; z: number } {
  return { x: -TABLE_W / 2 + 1.0 + CARD_W / 2 + column * (CARD_W + 0.35), z: 0 };
}

/** The place of die `index` of the showcase: two rows at the right of the middle. */
export function showcaseSpot(index: number): { x: number; z: number } {
  const perRow = 4;
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  return { x: TABLE_W / 2 - 1.3 - (perRow - 1 - col) * 1.1, z: -0.6 + row * 1.2 };
}
