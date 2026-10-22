import { COLORS, lightPips, STONE_SUIT, SUIT_COLORS } from "../ui/svg";
import { PIPS } from "../ui/pips";
import type { FrameLayout } from "./layout";
import { strip, type MotifKind } from "./motif";

/** The textures of the table, drawn on 2D canvases: dice faces, the wood, the mats, the tray, the marks and the labels. */

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

/** The small mark of a suit in the corner of a face, so a suit never rests on color alone. */
function drawGlyph(ctx: CanvasRenderingContext2D, suit: number, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  switch (suit) {
    case 0:
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case 1:
      ctx.rect(cx - r, cy - r, 2 * r, 2 * r);
      break;
    case 2:
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
      break;
    case 3:
      ctx.moveTo(cx, cy - r * 1.2);
      ctx.lineTo(cx + r * 1.2, cy);
      ctx.lineTo(cx, cy + r * 1.2);
      ctx.lineTo(cx - r * 1.2, cy);
      ctx.closePath();
      break;
    default:
      return;
  }
  ctx.fill();
}

/** The grey of a die that is out of the game: no suit color, the pips stay dark. */
export const OUT_COLOR = "#A4A29C";

/** A face of a die in the color of its suit, with the mark of the suit in a corner (none for the stones); `gray` draws it out of the game. */
export function drawDieFace(value: number, suit: number, px: number, gray = false): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const body = gray ? OUT_COLOR : (SUIT_COLORS[suit] ?? SUIT_COLORS[STONE_SUIT]);
  const light = gray ? false : lightPips(suit);
  const gradient = ctx.createLinearGradient(0, 0, px, px);
  gradient.addColorStop(0, shade(body, 0.14));
  gradient.addColorStop(1, shade(body, -0.1));
  ctx.fillStyle = gradient;
  roundedRect(ctx, 0, 0, px, px, px * 0.145);
  ctx.fill();
  const s = px / FACE_SHARE;
  const d = s * 0.26;
  const r = s * 0.085;
  for (const [dx, dy] of PIPS[value] ?? []) {
    const cx = px / 2 + dx * d;
    const cy = px / 2 + dy * d;
    const lit = ctx.createRadialGradient(cx + 0.2 * r, cy + 0.24 * r, 0, cx + 0.2 * r, cy + 0.24 * r, 1.4 * r);
    lit.addColorStop(0, light ? "#E9E3D8" : "#4A4540");
    lit.addColorStop(1, light ? "#FFFFFF" : "#14120F");
    ctx.fillStyle = lit;
    disc(ctx, cx, cy, r);
    ctx.fill();
  }
  if (!gray) {
    ctx.fillStyle = light ? "rgba(255,255,255,0.92)" : "rgba(30,27,24,0.85)";
    drawGlyph(ctx, suit, px * 0.15, px * 0.15, px * 0.062);
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

/** A strip of motif along x, with its outer edge at y = 0. */
function drawStrip(ctx: CanvasRenderingContext2D, kind: MotifKind, length: number, u: number, color: string): void {
  const { pips, radius } = strip(kind, length, u);
  ctx.fillStyle = color;
  for (const pip of pips) {
    disc(ctx, pip.x, pip.y, radius);
    ctx.fill();
  }
}

/** The face of six, the mark of the collection, with the pip of the Sia filled. */
function drawFace6(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  const d = size * 0.25;
  const r = size * 0.095;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = Math.max(1, size * 0.045);
  roundedRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.16);
  ctx.stroke();
  const positions: [number, number][] = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
  positions.forEach(([dx, dy], i) => {
    disc(ctx, cx + dx, cy + dy, r);
    if (i === 4) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(0.8, size * 0.03);
      ctx.stroke();
    }
  });
}

/**
 * The board of the Seks, seen as the Sia uses it: the four bands of motif
 * with the face of six at the corners, the plate, the grid of 11 by 11
 * cells with the middle cell marked, and above and below the stones the
 * letters A to I. The letters at the bottom read upright for the first
 * player and those at the top for the second. The texture covers
 * `layout.worldSize` cells.
 */
export function drawBoard(px: number, layout: FrameLayout, stoneLetters: string): HTMLCanvasElement {
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
  for (const [x, y, angle] of sides) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    drawStrip(ctx, "band", along, layout.u, COLORS.sia);
    ctx.restore();
  }
  for (const [x, y] of [[0, 0], [S - t, 0], [0, S - t], [S - t, S - t]] as const) drawFace6(ctx, x + t / 2, y + t / 2, t * 0.78, COLORS.sia);

  const { plateAt, plate, gridAt, cell } = layout;
  ctx.fillStyle = COLORS.wool;
  ctx.fillRect(plateAt, plateAt, plate, plate);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(plateAt, plateAt, plate, plate);

  // A pale band under the row of the stones, and the middle cell as on the board of the Seks.
  ctx.fillStyle = "rgba(70,96,122,0.12)";
  ctx.fillRect(gridAt, gridAt + 5 * cell, 11 * cell, cell);
  ctx.fillStyle = COLORS.sia;
  ctx.fillRect(gridAt + 5 * cell, gridAt + 5 * cell, cell, cell);

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
  ctx.lineWidth = 1.4;
  ctx.strokeRect(gridAt, gridAt, 11 * cell, 11 * cell);

  // The letters of the stones: bottom edge upright for seat 0, top edge turned for seat 1.
  const fs = layout.gutter * 0.78;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  [...stoneLetters].forEach((letter, i) => {
    const x = gridAt + (i + 1.5) * cell;
    ctx.fillText(letter, x, gridAt + 11 * cell + layout.gutter * 0.55);
    ctx.save();
    ctx.translate(x, gridAt - layout.gutter * 0.55);
    ctx.rotate(Math.PI);
    ctx.fillText(letter, 0, 0);
    ctx.restore();
  });
  return canvas;
}

/** A hand tray: felt with a rim in the color of its player, `w` by `h` pixels. */
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

export type MarkKind = "ring" | "claim" | "selected" | "last" | "lost" | "roll" | "hover";

/**
 * A mark of play in one cell (`px` by `px`). Each has its own shape, so the
 * color never carries information alone: a destination is a ring, a stone
 * that can be claimed has a bracket, the selection a thick square, the die
 * put last corners, a die to lose a cross and dice to roll a dashed circle.
 */
export function drawMark(kind: MarkKind, px: number, accent: string = COLORS.sia): HTMLCanvasElement {
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
    case "claim": {
      // Four brackets around the stone, thick, in the color of the player.
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
    case "lost": {
      // The die to lose: a red cross over it.
      ctx.lineCap = "round";
      for (const [width, color] of [[px * 0.15, COLORS.wool], [px * 0.085, "#B3261E"]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(px * 0.2, px * 0.2);
        ctx.lineTo(px * 0.8, px * 0.8);
        ctx.moveTo(px * 0.8, px * 0.2);
        ctx.lineTo(px * 0.2, px * 0.8);
        ctx.stroke();
      }
      break;
    }
    case "roll":
      // A die to roll again: a dashed circle around it.
      for (const [width, color, dash] of [[px * 0.12, COLORS.wool, 0], [px * 0.065, COLORS.ink, 1]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash ? [px * 0.1, px * 0.07] : []);
        disc(ctx, c, c, px * 0.43);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      break;
    case "hover":
      ctx.fillStyle = "rgba(70,96,122,0.26)";
      ctx.fillRect(px * 0.04, px * 0.04, px * 0.92, px * 0.92);
      break;
  }
  return canvas;
}
