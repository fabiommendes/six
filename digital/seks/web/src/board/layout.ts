import { tile, type MotifKind } from "./motif";

/** The colours of the Seks screen (`arte/esbocos/c-motivos-por-lingua/LEIAME.md`). */
export const COLORS = {
  ink: "#1E1B18",
  paper: "#F4EEE2",
  wool: "#FBF8F1",
  line: "#CDC3B0",
  muted: "#6B6257",
  seks: "#A3302A",
  selection: "#F3E2DA",
} as const;

/**
 * The frame of the board in the proportions of the sketch: a plate of 11 by
 * 11 cells with a gutter for the coordinates, inside four bands of motif.
 * All lengths are in the pixels of the sketch (`sketch` by `sketch`).
 */
export interface FrameLayout {
  readonly compact: boolean;
  readonly kind: MotifKind;
  /** Side of the whole frame. */
  readonly sketch: number;
  /** Spacing of the pip grid. */
  readonly u: number;
  /** Thickness of a band. */
  readonly band: number;
  /** Where the plate starts. */
  readonly plateAt: number;
  readonly plate: number;
  /** Gutter between the plate and the grid, for the coordinates. */
  readonly gutter: number;
  /** Where the grid of cells starts. */
  readonly gridAt: number;
  /** Side of a cell. */
  readonly cell: number;
  readonly fontSize: number;
  readonly plateStroke: number;
  readonly gridStroke: number;
  /** Side of the frame, in cells: the size of the board texture in the scene. */
  readonly worldSize: number;
}

/** The layout for a wide board (the full band) or a small one (the thin band, as the sketch does on a phone). */
export function frameLayout(compact: boolean): FrameLayout {
  const kind: MotifKind = compact ? "thin" : "band";
  const sketch = compact ? 374 : 852;
  const u = compact ? 2.5 : 3.6;
  const band = tile(kind).h * u;
  const gap = compact ? 3 : 7;
  const gutter = compact ? 13 : 26;
  const plateAt = band + gap;
  const plate = sketch - 2 * plateAt;
  const cell = (plate - 2 * gutter) / 11;
  return {
    compact,
    kind,
    sketch,
    u,
    band,
    plateAt,
    plate,
    gutter,
    gridAt: plateAt + gutter,
    cell,
    fontSize: compact ? 9.5 : 15,
    plateStroke: compact ? 1.2 : 2,
    gridStroke: compact ? 1 : 1.4,
    worldSize: sketch / cell,
  };
}

/** Below this width of the board, in CSS pixels, the thin band is used. */
export const COMPACT_BELOW = 520;
