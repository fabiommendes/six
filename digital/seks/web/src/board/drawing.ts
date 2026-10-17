import { COLORS, type FrameLayout } from "./layout";
import { PIPS } from "./pips";
import { strip, type MotifKind } from "./motif";

/** The textures of the board, drawn on 2D canvases: the frame with the motif, the faces of the dice, the marks and the shadows. */

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

/** A strip of motif along x, with its outer edge at y = 0. */
function drawStrip(ctx: CanvasRenderingContext2D, kind: MotifKind, length: number, u: number, color: string): void {
  const { pips, radius } = strip(kind, length, u);
  ctx.fillStyle = color;
  for (const pip of pips) {
    disc(ctx, pip.x, pip.y, radius);
    ctx.fill();
  }
}

/**
 * The face of six, the mark of the collection: each pip is a game. Pip
 * `highlight` is filled in `color` and the others are hollow.
 */
export function drawFace6(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, highlight: number, color: string): void {
  const d = size * 0.25;
  const r = size * 0.095;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = Math.max(1, size * 0.045);
  roundedRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.16);
  ctx.stroke();
  const positions: [number, number][] = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
  positions.forEach(([dx, dy], i) => {
    disc(ctx, cx + dx, cy + dy, r);
    if (i === highlight) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(0.8, size * 0.03);
      ctx.strokeStyle = COLORS.ink;
      ctx.stroke();
    }
  });
}

/**
 * Draws the board of the sketch into a square canvas: the four bands of
 * motif with the face of six at the corners, the plate, the grid of 11 by
 * 11 cells and the coordinates. The padding of the sketch is kept, so the
 * canvas covers `layout.worldSize` cells.
 */
export function drawBoardTexture(canvas: HTMLCanvasElement, layout: FrameLayout, fontFamily: string): void {
  const ctx = context(canvas);
  const S = layout.sketch;
  const t = layout.band;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(canvas.width / S, canvas.height / S);

  // The four bands, each with its outer edge facing out.
  const along = S - 2 * t;
  const sides: [number, number, number][] = [
    [t, 0, 0],
    [S - t, S, Math.PI],
    [0, S - t, -Math.PI / 2],
    [S, t, Math.PI / 2],
  ];
  for (const [x, y, angle] of sides) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    drawStrip(ctx, layout.kind, along, layout.u, COLORS.seks);
    ctx.restore();
  }
  for (const [x, y] of [[0, 0], [S - t, 0], [0, S - t], [S - t, S - t]] as const) {
    drawFace6(ctx, x + t / 2, y + t / 2, t * 0.78, 0, COLORS.seks);
  }

  // The plate.
  const { plateAt, plate, gridAt, cell } = layout;
  ctx.fillStyle = COLORS.wool;
  ctx.fillRect(plateAt, plateAt, plate, plate);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = layout.plateStroke;
  ctx.strokeRect(plateAt, plateAt, plate, plate);

  // The grid.
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 11; i++) {
    ctx.moveTo(gridAt + i * cell, gridAt);
    ctx.lineTo(gridAt + i * cell, gridAt + 11 * cell);
    ctx.moveTo(gridAt, gridAt + i * cell);
    ctx.lineTo(gridAt + 11 * cell, gridAt + i * cell);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = layout.gridStroke;
  ctx.strokeRect(gridAt, gridAt, 11 * cell, 11 * cell);

  // The coordinates: files above and below, rows on both sides.
  const fs = layout.fontSize;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 ${fs}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const gut = layout.gutter;
  for (let i = 0; i < 11; i++) {
    const x = gridAt + (i + 0.5) * cell;
    const file = "abcdefghijk".charAt(i);
    ctx.fillText(file, x, gridAt + 11 * cell + gut * 0.68);
    ctx.fillText(file, x, gridAt - gut * 0.32);
    const y = gridAt + (11 - (i + 1) + 0.5) * cell + fs * 0.35;
    ctx.fillText(String(i + 1), plateAt + gut * 0.5, y);
    ctx.fillText(String(i + 1), gridAt + 11 * cell + gut * 0.5, y);
  }
}

/** Share of the die that the pip face covers (the rest is the bevel). */
export const FACE_SHARE = 0.82;

/**
 * The top face of a die of the sketch: a soft gradient with the pips of
 * `value`. `white` is the side of the Whites; its pips are dark and the
 * Blacks' are light.
 */
export function drawDieFace(white: boolean, value: number, px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const gradient = ctx.createLinearGradient(0, 0, px, px);
  if (white) {
    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(1, "#F3EFE7");
  } else {
    gradient.addColorStop(0, "#3A3531");
    gradient.addColorStop(1, "#211E1B");
  }
  ctx.fillStyle = gradient;
  roundedRect(ctx, 0, 0, px, px, px * 0.145);
  ctx.fill();

  const s = px / FACE_SHARE;
  const d = s * 0.26;
  const r = s * 0.085;
  for (const [dx, dy] of PIPS[value] ?? []) {
    const cx = px / 2 + dx * d;
    const cy = px / 2 + dy * d;
    const lit = ctx.createRadialGradient(cx - r + 1.2 * r, cy - r + 1.24 * r, 0, cx - r + 1.2 * r, cy - r + 1.24 * r, 1.4 * r);
    lit.addColorStop(0, white ? "#4A4540" : "#C9C2B4");
    lit.addColorStop(1, white ? "#14120F" : "#FAF7F0");
    ctx.fillStyle = lit;
    disc(ctx, cx, cy, r);
    ctx.fill();
  }
  return canvas;
}

/** A soft shadow of a die: a blurred rounded square in the middle of a transparent square. */
export function drawShadow(px: number, share: number, blur: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const side = px * share;
  const offset = px * 4; // draw the shape far away and keep only its shadow
  ctx.shadowColor = "#000";
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offset;
  ctx.fillStyle = "#000";
  roundedRect(ctx, (px - side) / 2 - offset, (px - side) / 2, side, side, side * 0.17);
  ctx.fill();
  return canvas;
}

export type MarkKind = "ring" | "selected" | "from" | "to";

/**
 * A mark of play, drawn in one cell (`px` by `px`). Each has its own shape:
 * the colour never carries information alone.
 */
export function drawMark(kind: MarkKind, px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const c = px / 2;
  if (kind === "ring") {
    ctx.strokeStyle = COLORS.seks;
    ctx.lineWidth = px * 0.05;
    disc(ctx, c, c, px * 0.14);
    ctx.stroke();
  } else if (kind === "selected") {
    const i = px * 0.04;
    ctx.fillStyle = COLORS.selection;
    ctx.strokeStyle = COLORS.seks;
    ctx.lineWidth = px * 0.066;
    ctx.beginPath();
    ctx.rect(i, i, px - 2 * i, px - 2 * i);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "from") {
    const i = px * 0.2;
    const w = px - 2 * i;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = px * 0.034;
    ctx.setLineDash([w / 7, w / 7]);
    ctx.strokeRect(i, i, w, w);
  } else {
    const i = px * 0.05;
    const w = px - 2 * i;
    const k = px * 0.22;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = px * 0.04;
    ctx.beginPath();
    ctx.moveTo(i, i + k);
    ctx.lineTo(i, i);
    ctx.lineTo(i + k, i);
    ctx.moveTo(i + w - k, i);
    ctx.lineTo(i + w, i);
    ctx.lineTo(i + w, i + k);
    ctx.moveTo(i + w, i + w - k);
    ctx.lineTo(i + w, i + w);
    ctx.lineTo(i + w - k, i + w);
    ctx.moveTo(i + k, i + w);
    ctx.lineTo(i, i + w);
    ctx.lineTo(i, i + w - k);
    ctx.stroke();
  }
  return canvas;
}
