/**
 * The Nordic knitting motif of the Seks (ADR 0005), drawn on the pip grid
 * shared by the six games: every stitch is a pip. The charts are those of
 * `arte/esbocos/c-motivos-por-lingua/six.js`.
 */

export type MotifKind = "band" | "thin";

/** Pip radius, in grid units (the same for every motif of the collection). */
export const PIP_RADIUS = 0.31;

const CHARTS: Record<MotifKind, readonly string[]> = {
  band: [
    "XXXXXXXX",
    ".X.X.X.X",
    "........",
    "....X...",
    "X..XXX..",
    "..XX.XX.",
    ".XX...XX",
    "XX..X..X",
    ".XX...XX",
    "..XX.XX.",
    "X..XXX..",
    "....X...",
    "........",
    ".X.X.X.X",
    "XXXXXXXX",
  ],
  thin: ["XXXX", "....", "X...", ".X.X", "..X.", "....", "XXXX"],
};

/** A repeating tile of the motif: its size and the grid points that carry a pip. */
export interface Tile {
  /** Columns of the tile. */
  readonly w: number;
  /** Rows of the tile: the thickness of the band. */
  readonly h: number;
  readonly pips: readonly (readonly [col: number, row: number])[];
}

const tiles = new Map<MotifKind, Tile>();

export function tile(kind: MotifKind): Tile {
  let found = tiles.get(kind);
  if (!found) {
    const chart = CHARTS[kind];
    const pips: [number, number][] = [];
    chart.forEach((line, row) => {
      [...line].forEach((mark, col) => {
        if (mark === "X") pips.push([col, row]);
      });
    });
    found = { w: chart[0]!.length, h: chart.length, pips };
    tiles.set(kind, found);
  }
  return found;
}

/** A pip of a strip: its centre, in the units of the strip. */
export interface StripPip {
  readonly x: number;
  readonly y: number;
}

/** The pips of a strip. `x` runs along it and `y` across, from its outer edge. */
export interface Strip {
  readonly pips: readonly StripPip[];
  /** Thickness of the strip. */
  readonly thickness: number;
  /** Radius of a pip. */
  readonly radius: number;
}

/**
 * A strip of motif `length` long on a grid of spacing `u`. The tile is
 * stretched a little along the strip so that a whole number of repeats fits.
 */
export function strip(kind: MotifKind, length: number, u: number): Strip {
  const t = tile(kind);
  const repeats = Math.max(1, Math.round(length / (t.w * u)));
  const stretch = length / (repeats * t.w * u);
  const pips: StripPip[] = [];
  for (let i = 0; i < repeats; i++) {
    for (const [col, row] of t.pips) {
      pips.push({ x: (i * t.w + col + 0.5) * u * stretch, y: (row + 0.5) * u });
    }
  }
  return { pips, thickness: t.h * u, radius: PIP_RADIUS * u };
}
