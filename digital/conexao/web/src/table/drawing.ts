import { COLORS, DIE_BODIES, DIE_PIPS } from "../ui/svg";
import { PIPS } from "../ui/pips";
import { BOARD_CELLS, margin, type FrameLayout } from "./layout";
import { strip } from "./motif";

/** The textures of the table, drawn on 2D canvases: dice faces, the wood, the board, the trays, the marks and the labels. */

export const FONT = '"Alegreya Sans", sans-serif';

function makeCanvas(width: number, height: number = width): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D is not available");
  return ctx;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** A small deterministic generator, so the wood and the cloth look the same on every load. */
function noise(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Share of a die side that the pip face covers (the rest is the bevel). */
export const FACE_SHARE = 0.82;

/** A face of a die of the Seks: white with ink pips, or black with light pips. */
export function drawDieFace(value: number, seat: number, px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const body = DIE_BODIES[seat % 2]!;
  const gradient = ctx.createLinearGradient(0, 0, px, px);
  gradient.addColorStop(0, shade(body, seat === 0 ? 0.3 : 0.14));
  gradient.addColorStop(1, shade(body, -0.08));
  ctx.fillStyle = gradient;
  roundedRect(ctx, 0, 0, px, px, px * 0.145);
  ctx.fill();
  const s = px / FACE_SHARE;
  const d = s * 0.26;
  const r = s * 0.085;
  ctx.fillStyle = DIE_PIPS[seat % 2]!;
  for (const [dx, dy] of PIPS[value] ?? []) {
    disc(ctx, px / 2 + dx * d, px / 2 + dy * d, r);
    ctx.fill();
  }
  return canvas;
}

/** `hex` made lighter (`amount` > 0) or darker (< 0). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => Math.round(Math.min(255, Math.max(0, amount > 0 ? c + (255 - c) * amount : c * (1 + amount))));
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** The top of the table: warm wood, with grain along `x`. */
export function drawWood(px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const random = noise(7);
  ctx.fillStyle = "#6E4A30";
  ctx.fillRect(0, 0, px, px);
  // Planks, each a little different.
  const planks = 6;
  const h = px / planks;
  for (let p = 0; p < planks; p++) {
    ctx.fillStyle = shade("#6E4A30", (random() - 0.5) * 0.16);
    ctx.fillRect(0, p * h, px, h);
    for (let i = 0; i < 90; i++) {
      const y = p * h + random() * h;
      ctx.strokeStyle = `rgba(${random() < 0.5 ? "40,24,12" : "150,110,70"},${0.05 + random() * 0.09})`;
      ctx.lineWidth = 0.6 + random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      const wave = (random() - 0.5) * h * 0.25;
      ctx.bezierCurveTo(px * 0.3, y + wave, px * 0.6, y - wave, px, y + wave * 0.4);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(30,18,10,0.55)";
    ctx.fillRect(0, p * h, px, 2);
  }
  return canvas;
}

/** A label on a pill, for floating texts: `+2`, a name, the dice left in the bag. */
export function drawLabel(text: string, options: { px?: number; color?: string; background?: string; weight?: number } = {}): HTMLCanvasElement {
  const px = options.px ?? 64;
  const probe = context(makeCanvas(4));
  probe.font = `${options.weight ?? 800} ${px}px ${FONT}`;
  const w = Math.ceil(probe.measureText(text).width + px * 0.9);
  const h = Math.ceil(px * 1.45);
  const canvas = makeCanvas(w, h);
  const ctx = context(canvas);
  if (options.background) {
    ctx.fillStyle = options.background;
    roundedRect(ctx, 2, 2, w - 4, h - 4, (h - 4) / 2);
    ctx.fill();
  }
  ctx.font = `${options.weight ?? 800} ${px}px ${FONT}`;
  ctx.fillStyle = options.color ?? COLORS.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + px * 0.05);
  return canvas;
}

/** A tray: felt with a rim in the color of its seat, `w` by `h` pixels. */
export function drawTrayTop(w: number, h: number, accent: string): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  const ctx = context(canvas);
  const r = Math.min(w, h) * 0.12;
  ctx.fillStyle = shade(accent, -0.55);
  roundedRect(ctx, 0, 0, w, h, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(accent, -0.25));
  g.addColorStop(1, shade(accent, -0.42));
  ctx.fillStyle = g;
  const i = Math.min(w, h) * 0.07;
  roundedRect(ctx, i, i, w - 2 * i, h - 2 * i, r * 0.7);
  ctx.fill();
  const random = noise(11);
  for (let k = 0; k < (w * h) / 90; k++) {
    ctx.fillStyle = `rgba(255,255,255,${random() * 0.05})`;
    ctx.fillRect(i + random() * (w - 2 * i), i + random() * (h - 2 * i), 1.5, 1.5);
  }
  ctx.strokeStyle = shade(accent, 0.35);
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.012);
  roundedRect(ctx, i, i, w - 2 * i, h - 2 * i, r * 0.7);
  ctx.stroke();
  return canvas;
}

/** The face of six, the mark of the collection; this prototype has no pip of its own, so all six are hollow. */
function drawFace6(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const d = size * 0.25;
  const r = size * 0.095;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = Math.max(1, size * 0.045);
  roundedRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.16);
  ctx.stroke();
  const positions: [number, number][] = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
  ctx.lineWidth = Math.max(0.8, size * 0.03);
  for (const [dx, dy] of positions) {
    disc(ctx, cx + dx, cy + dy, r);
    ctx.stroke();
  }
}

/** What the board shows besides the grid: the size of the game and its rows of the block, per seat (from 0, the White side). */
export interface BoardMarks {
  readonly size: number;
  readonly blockRows: readonly (readonly [number, number])[];
}

/**
 * The board of the Seks, with the knitting motif of the Seks in the accent
 * of this game (it is played on that board): the four bands with the face of
 * six at the corners, the plate and the grid of 11 by 11 cells. On top: the
 * cells out of a smaller board greyed, the back row of each side tinted with
 * its name in the gutter, and the rows of the block tinted in the accent
 * with a bar in the side gutters. Row 0 of the engine is at the bottom, by
 * the White.
 */
export function drawBoard(px: number, layout: FrameLayout, marks: BoardMarks): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const S = layout.sketch;
  const t = layout.band;
  ctx.scale(px / S, px / S);
  const along = S - 2 * t;
  const sides: [number, number, number][] = [
    [t, 0, 0],
    [S - t, S, Math.PI],
    [0, S - t, -Math.PI / 2],
    [S, t, Math.PI / 2],
  ];
  const { pips, radius } = strip("band", along, layout.u);
  for (const [x, y, angle] of sides) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = COLORS.accent;
    for (const pip of pips) {
      disc(ctx, pip.x, pip.y, radius);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const [x, y] of [[0, 0], [S - t, 0], [0, S - t], [S - t, S - t]] as const) drawFace6(ctx, x + t / 2, y + t / 2, t * 0.78);

  const { plateAt, plate, gridAt, cell, gutter } = layout;
  ctx.fillStyle = COLORS.wool;
  ctx.fillRect(plateAt, plateAt, plate, plate);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(plateAt, plateAt, plate, plate);

  const size = marks.size;
  const m = margin(size);
  /** The top of row `row` of the game, in pixels of the sketch: row 0 is the bottom row of the game. */
  const rowTop = (row: number) => gridAt + (BOARD_CELLS - 1 - (row + m)) * cell;
  const left = gridAt + m * cell;
  const width = size * cell;

  // The cells out of a smaller board.
  if (m > 0) {
    ctx.fillStyle = "rgba(107,98,87,0.22)";
    ctx.fillRect(gridAt, gridAt, BOARD_CELLS * cell, BOARD_CELLS * cell);
    ctx.fillStyle = COLORS.wool;
    ctx.fillRect(left, gridAt + m * cell, width, width);
  }
  // The rows of the block: darker where both sides may block.
  const [a, b] = [marks.blockRows[0], marks.blockRows[1]];
  for (let row = 0; row < size; row++) {
    const count = [a, b].filter((r) => r !== undefined && row >= r[0] && row <= r[1]).length;
    if (count === 0) continue;
    ctx.fillStyle = count === 2 ? "rgba(122,62,107,0.13)" : "rgba(122,62,107,0.06)";
    ctx.fillRect(left, rowTop(row), width, cell);
    ctx.fillStyle = COLORS.accent;
    ctx.globalAlpha = count === 2 ? 0.8 : 0.4;
    ctx.fillRect(gridAt - gutter * 0.62, rowTop(row) + 2, gutter * 0.3, cell - 4);
    ctx.fillRect(gridAt + BOARD_CELLS * cell + gutter * 0.32, rowTop(row) + 2, gutter * 0.3, cell - 4);
    ctx.globalAlpha = 1;
  }
  // The back rows: the White at the bottom, the Black at the top.
  ctx.fillStyle = "rgba(179,166,140,0.30)";
  ctx.fillRect(left, rowTop(0), width, cell);
  ctx.fillStyle = "rgba(30,27,24,0.13)";
  ctx.fillRect(left, rowTop(size - 1), width, cell);

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= BOARD_CELLS; i++) {
    ctx.moveTo(gridAt + i * cell, gridAt);
    ctx.lineTo(gridAt + i * cell, gridAt + BOARD_CELLS * cell);
    ctx.moveTo(gridAt, gridAt + i * cell);
    ctx.lineTo(gridAt + BOARD_CELLS * cell, gridAt + i * cell);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(gridAt, gridAt, BOARD_CELLS * cell, BOARD_CELLS * cell);
  if (m > 0) {
    ctx.lineWidth = 2.2;
    ctx.strokeRect(left, gridAt + m * cell, width, width);
  }

  // The names of the back rows in the gutters, each upright for its side.
  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 ${gutter * 0.72}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const mid = gridAt + (BOARD_CELLS * cell) / 2;
  ctx.fillText("fundo das Brancas", mid, gridAt + BOARD_CELLS * cell + gutter * 0.55);
  ctx.save();
  ctx.translate(mid, gridAt - gutter * 0.55);
  ctx.rotate(Math.PI);
  ctx.fillText("fundo das Pretas", 0, 0);
  ctx.restore();
  return canvas;
}

export type MarkKind = "ring" | "block" | "claim" | "selected" | "last" | "origin";

/**
 * A mark of play in one cell (`px` by `px`). Each has its own shape, so the
 * color never carries information alone: a square to place on is a ring, a
 * square to block on a diamond, a die to choose has brackets, the selection a
 * thick square, the die taken from the board in the last move a dashed square
 * and the squares of the last move corners.
 */
export function drawMark(kind: MarkKind, px: number, accent: string = COLORS.accent): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const c = px / 2;
  switch (kind) {
    case "ring":
      disc(ctx, c, c, px * 0.36);
      ctx.strokeStyle = COLORS.wool;
      ctx.lineWidth = px * 0.13;
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = px * 0.07;
      ctx.stroke();
      break;
    case "block": {
      // A diamond, so a block never reads as a placement.
      const r = px * 0.36;
      ctx.beginPath();
      ctx.moveTo(c, c - r);
      ctx.lineTo(c + r, c);
      ctx.lineTo(c, c + r);
      ctx.lineTo(c - r, c);
      ctx.closePath();
      ctx.lineJoin = "round";
      ctx.strokeStyle = COLORS.wool;
      ctx.lineWidth = px * 0.13;
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = px * 0.07;
      ctx.stroke();
      break;
    }
    case "claim": {
      // Four brackets around the die, thick, in the color of the player.
      const i = px * 0.02;
      const k = px * 0.3;
      ctx.lineCap = "square";
      for (const [width, color] of [[px * 0.15, COLORS.wool], [px * 0.085, accent]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (const [x, y, dx, dy] of [[i, i, 1, 1], [px - i, i, -1, 1], [i, px - i, 1, -1], [px - i, px - i, -1, -1]] as const) {
          ctx.moveTo(x + dx * k, y);
          ctx.lineTo(x, y);
          ctx.lineTo(x, y + dy * k);
        }
        ctx.stroke();
      }
      break;
    }
    case "selected": {
      const i = px * 0.05;
      ctx.strokeStyle = COLORS.wool;
      ctx.lineWidth = px * 0.14;
      ctx.strokeRect(i, i, px - 2 * i, px - 2 * i);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = px * 0.08;
      ctx.strokeRect(i, i, px - 2 * i, px - 2 * i);
      break;
    }
    case "last": {
      const i = px * 0.05;
      const w = px - 2 * i;
      const k = px * 0.24;
      ctx.strokeStyle = accent;
      ctx.lineWidth = px * 0.06;
      ctx.lineCap = "square";
      ctx.beginPath();
      for (const [x, y, dx, dy] of [[i, i, 1, 1], [i + w, i, -1, 1], [i, i + w, 1, -1], [i + w, i + w, -1, -1]] as const) {
        ctx.moveTo(x + dx * k, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy * k);
      }
      ctx.stroke();
      break;
    }
    case "origin": {
      const i = px * 0.07;
      for (const [width, color, dash] of [[px * 0.1, COLORS.wool, 0], [px * 0.05, accent, 1]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash ? [px * 0.1, px * 0.07] : []);
        ctx.strokeRect(i, i, px - 2 * i, px - 2 * i);
      }
      ctx.setLineDash([]);
      break;
    }
  }
  return canvas;
}
