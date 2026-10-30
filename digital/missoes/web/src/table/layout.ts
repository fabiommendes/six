/** Where things sit on the table, in world units on the XZ plane (x right, z toward the first seat). */

export const TABLE_W = 26;
export const TABLE_D = 15.6;

export const HAND_DIE = 1.0;
export const HAND_STEP = 1.25;
export const RESERVE_DIE = 0.6;
export const RESERVE_STEP = 0.72;
/** Reserve dice when they need two rows. */
export const RESERVE_SMALL_DIE = 0.48;
export const RESERVE_SMALL_STEP = 0.56;
export const SHOWCASE_DIE = 0.85;
export const CARD_W = 4.0;
export const CARD_D = 5.0;
const CARD_GAP = 0.35;

/** The tray of a seat: its centre and size. */
export interface Tray {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
}

/** A rectangle of a tray, from its back-left corner, in world units. */
export interface Zone {
  readonly left: number;
  readonly top: number;
  readonly w: number;
  readonly d: number;
}

const TRAY_D = 4.4;
const ROW_Z = TABLE_D / 2 - TRAY_D / 2 - 0.3;
/** The band in the seat color and the margin at the right of a tray. */
const TRAY_LEFT = 0.75;
const TRAY_RIGHT = 0.3;
/** The room the label of a zone takes at its left. */
export const ZONE_LABEL = 1.6;

/** The zones of a tray: the name and the points at the back, the reserve, and the hand in front, on its own mat. */
export function zones(tray: Tray): { header: Zone; reserve: Zone; hand: Zone } {
  const w = tray.w - TRAY_LEFT - TRAY_RIGHT;
  return {
    header: { left: TRAY_LEFT, top: 0.12, w, d: 0.7 },
    reserve: { left: TRAY_LEFT, top: 0.85, w, d: 1.15 },
    hand: { left: TRAY_LEFT, top: 2.12, w, d: 2.08 },
  };
}

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

/** The world centre of a point of `zone` of `tray`, `dx` from its label and `dz` from its top. */
function inZone(tray: Tray, zone: Zone, dx: number, dz: number): { x: number; z: number } {
  return { x: tray.x - tray.w / 2 + zone.left + ZONE_LABEL + dx, z: tray.z - tray.d / 2 + zone.top + dz };
}

/** The place of die `index` of a hand of `count` dice in `tray`: one row, centred on the mat after its label. */
export function handSpot(tray: Tray, index: number, count: number): { x: number; z: number } {
  const zone = zones(tray).hand;
  const room = zone.w - ZONE_LABEL;
  const width = (Math.max(count, 1) - 1) * HAND_STEP;
  return inZone(tray, zone, room / 2 - width / 2 + index * HAND_STEP, zone.d / 2);
}

/** The place and size of die `index` of `count` reserve dice out of the hand: one row, or two smaller ones when they do not fit. */
export function reserveSpot(tray: Tray, index: number, count: number): { x: number; z: number; size: number } {
  const zone = zones(tray).reserve;
  const room = zone.w - ZONE_LABEL - 0.2;
  const fit = (step: number) => Math.floor(room / step) + 1;
  if (count <= fit(RESERVE_STEP)) {
    return { ...inZone(tray, zone, RESERVE_DIE / 2 + index * RESERVE_STEP, zone.d / 2), size: RESERVE_DIE };
  }
  const perRow = Math.ceil(count / 2);
  const step = Math.min(RESERVE_SMALL_STEP, room / Math.max(perRow - 1, 1));
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  return { ...inZone(tray, zone, RESERVE_SMALL_DIE / 2 + col * step, zone.d / 2 + (row - 0.5) * RESERVE_SMALL_STEP), size: RESERVE_SMALL_DIE };
}

/** The showcase: two columns at the right of the middle, up to four rows. */
const SHOWCASE_STEP = 1.15;
const SHOWCASE_RIGHT = TABLE_W / 2 - 1.0;

/** The rectangle of the showcase, centre and size, for its mat. */
export const SHOWCASE_AREA = { x: SHOWCASE_RIGHT - SHOWCASE_STEP / 2, z: 0, w: SHOWCASE_STEP * 2 + 0.5, d: SHOWCASE_STEP * 4 + 0.9 } as const;

/** The place of die `index` of the showcase. */
export function showcaseSpot(index: number): { x: number; z: number } {
  const row = Math.floor(index / 2);
  const col = index % 2;
  return { x: SHOWCASE_RIGHT - (1 - col) * SHOWCASE_STEP, z: (row - 1.5) * SHOWCASE_STEP + 0.45 };
}

/** The place of mission `column` (0 for the standard) of `columns`, centred between the left edge and the showcase. */
export function cardSpot(column: number, columns = 5): { x: number; z: number } {
  const left = -TABLE_W / 2 + 0.6;
  const right = SHOWCASE_AREA.x - SHOWCASE_AREA.w / 2 - 0.4;
  const width = columns * CARD_W + (columns - 1) * CARD_GAP;
  const start = (left + right) / 2 - width / 2;
  return { x: start + CARD_W / 2 + column * (CARD_W + CARD_GAP), z: 0 };
}
