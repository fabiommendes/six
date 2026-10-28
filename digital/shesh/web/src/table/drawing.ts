import { BINARY_COLOR, COLORS, seatColor } from "../ui/svg";
import { PIPS } from "../ui/pips";
import { BAND_H, BAND_W, BOARD_CELLS, entrySpot, squareSpot, type FrameLayout } from "./layout";

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

/** The small mark of a seat in the corner of a face, so a seat never rests on color alone: a circle or a square. */
function drawGlyph(ctx: CanvasRenderingContext2D, seat: number, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  if (seat === 0) ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else ctx.rect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fill();
}

/** A face of a die of a player: the color of its seat, white pips and the mark of the seat in a corner. */
export function drawDieFace(value: number, seat: number, px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const body = seatColor(seat);
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
    lit.addColorStop(0, "#E9E3D8");
    lit.addColorStop(1, "#FFFFFF");
    ctx.fillStyle = lit;
    disc(ctx, cx, cy, r);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  drawGlyph(ctx, seat, px * 0.15, px * 0.15, px * 0.062);
  return canvas;
}

/** A face of a binary die: a big 0 or 1 on ivory. */
export function drawBinaryFace(bit: 0 | 1, px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const gradient = ctx.createLinearGradient(0, 0, px, px);
  gradient.addColorStop(0, shade(BINARY_COLOR, 0.35));
  gradient.addColorStop(1, shade(BINARY_COLOR, -0.06));
  ctx.fillStyle = gradient;
  roundedRect(ctx, 0, 0, px, px, px * 0.145);
  ctx.fill();
  ctx.fillStyle = bit === 1 ? COLORS.ink : COLORS.muted;
  ctx.font = `800 ${px * 0.78}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(bit), px / 2, px * 0.54);
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


/** The eight-pointed star of the tile, as offsets from its centre, in grid units. */
const STAR: readonly (readonly [number, number])[] = [
  [4, 0], [3, 1], [3, 3], [1, 3], [0, 4], [-1, 3], [-3, 3], [-3, 1],
  [-4, 0], [-3, -1], [-3, -3], [-1, -3], [0, -4], [1, -3], [3, -3], [3, -1],
];

/** Pip radius and stroke width of the motif, in grid units (the same for every motif of the collection). */
const PIP_R = 0.31;
const STROKE = 0.26;

/**
 * A strip of the star and cross tile of the Shesh (ADR 0005), `length` long along x with its outer edge at
 * y = 0, on a grid of spacing `u`. The tile is stretched a little along the strip so that a whole number of
 * repeats fits.
 */
function drawBand(ctx: CanvasRenderingContext2D, length: number, u: number, color: string): void {
  const repeats = Math.max(1, Math.round(length / (BAND_W * u)));
  const k = length / (repeats * BAND_W * u);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = STROKE * u;
  ctx.lineJoin = "miter";
  ctx.lineCap = "square";
  for (const y of [0.25, BAND_H - 0.25]) {
    ctx.beginPath();
    ctx.moveTo(0, y * u);
    ctx.lineTo(length, y * u);
    ctx.stroke();
  }
  for (let i = 0; i < repeats; i++) {
    const x0 = i * BAND_W;
    const at = (x: number) => (x0 + x) * u * k;
    ctx.beginPath();
    STAR.forEach(([dx, dy], n) => {
      const x = at(4 + dx);
      const y = (4.5 + dy) * u;
      if (n === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    disc(ctx, at(4), 4.5 * u, PIP_R * u * 1.3);
    ctx.fill();
    for (const [x, y] of [[0, 1.25], [0, BAND_H - 1.25]] as const) {
      disc(ctx, at(x), y * u, PIP_R * u);
      ctx.fill();
    }
  }
  for (const y of [1.25, BAND_H - 1.25]) {
    disc(ctx, length, y * u, PIP_R * u);
    ctx.fill();
  }
}

/** The face of six, the mark of the collection, with the sixth pip (the Shesh) filled. */
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
    if (i === 5) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(0.8, size * 0.03);
      ctx.stroke();
    }
  });
}

/** A star of `points` points, as a path around (cx, cy). */
function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, points: number): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const radius = i % 2 === 0 ? outer : inner;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The upper left corner of the cell at table position (x, z), in pixels of the sketch. */
function cellCorner(layout: FrameLayout, x: number, z: number): { x: number; y: number } {
  return { x: layout.gridAt + (x + BOARD_CELLS / 2 - 0.5) * layout.cell, y: layout.gridAt + (z + BOARD_CELLS / 2 - 0.5) * layout.cell };
}

/**
 * The board of the Seks, seen as the Shesh uses it: the four bands of the star tile with the face of six at
 * the corners, the plate, the grid of 11 by 11 cells and the track on top: the two own lanes in the colors of
 * the seats, the middle lane in turquoise, each square numbered along the path of its player, the red square
 * in the middle, and the arrows where the dice come in and go out. Row `z` of the table is row `z + 6` from the
 * top of the texture; the first player sits at the bottom.
 */
export function drawBoard(px: number, layout: FrameLayout): HTMLCanvasElement {
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
    drawBand(ctx, along, layout.u, COLORS.shesh);
    ctx.restore();
  }
  for (const [x, y] of [[0, 0], [S - t, 0], [0, S - t], [S - t, S - t]] as const) drawFace6(ctx, x + t / 2, y + t / 2, t * 0.78, COLORS.shesh);

  const { plateAt, plate, gridAt, cell } = layout;
  ctx.fillStyle = COLORS.wool;
  ctx.fillRect(plateAt, plateAt, plate, plate);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(plateAt, plateAt, plate, plate);

  const trail: { seat: number; square: number }[] = [];
  for (let square = 1; square <= 17; square++) {
    if (square >= 5 && square <= 15) {
      if (!trail.some((c) => c.square === square)) trail.push({ seat: 0, square });
    } else {
      trail.push({ seat: 0, square }, { seat: 1, square });
    }
  }
  // The tint of the track: the own lanes in the color of the seat, the middle lane in turquoise.
  for (const { seat, square } of trail) {
    const spot = squareSpot(seat, square);
    const { x, y } = cellCorner(layout, spot.x, spot.z);
    ctx.fillStyle = square >= 5 && square <= 15 ? "rgba(22,127,136,0.28)" : seat === 0 ? "rgba(184,83,43,0.32)" : "rgba(44,90,154,0.32)";
    ctx.fillRect(x, y, cell, cell);
  }
  // The red square.
  const centre = cellCorner(layout, 0, 0);
  ctx.fillStyle = COLORS.rosette;
  ctx.fillRect(centre.x, centre.y, cell, cell);
  ctx.fillStyle = "rgba(251,248,241,0.9)";
  starPath(ctx, centre.x + cell / 2, centre.y + cell / 2, cell * 0.38, cell * 0.2, 8);
  ctx.fill();

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
  // The cells of the track are outlined, so the path reads at a glance.
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  for (const { seat, square } of trail) {
    const spot = squareSpot(seat, square);
    const { x, y } = cellCorner(layout, spot.x, spot.z);
    ctx.strokeRect(x, y, cell, cell);
  }
  ctx.lineWidth = 1.4;
  ctx.strokeRect(gridAt, gridAt, BOARD_CELLS * cell, BOARD_CELLS * cell);

  // The numbers of the squares, upright for the owner of the lane; and the arrows of the entry and the exit.
  const fs = cell * 0.3;
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.muted;
  for (const { seat, square } of trail) {
    const spot = squareSpot(seat, square);
    const { x, y } = cellCorner(layout, spot.x, spot.z);
    ctx.save();
    if (seat === 1 && !(square >= 5 && square <= 15)) {
      ctx.translate(x + cell, y + cell);
      ctx.rotate(Math.PI);
    } else {
      ctx.translate(x, y);
    }
    ctx.fillText(String(square), cell * 0.07, cell * 0.04);
    ctx.restore();
  }
  for (const seat of [0, 1]) {
    for (const [square, label] of [[0, "entra"], [18, "sai"]] as const) {
      const spot = square === 0 ? entrySpot(seat) : squareSpot(seat, square);
      const { x, y } = cellCorner(layout, spot.x, spot.z);
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      ctx.fillStyle = seatColor(seat);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(cx - cell * 0.3, cy);
      ctx.lineTo(cx + cell * 0.1, cy - cell * 0.22);
      ctx.lineTo(cx + cell * 0.1, cy + cell * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx + cell * 0.1, cy - cell * 0.08, cell * 0.2, cell * 0.16);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(cx, cy);
      if (seat === 1) ctx.rotate(Math.PI);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `700 ${cell * 0.2}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, cell * 0.36);
      ctx.restore();
    }
  }
  return canvas;
}

export type MarkKind = "ring" | "claim" | "selected" | "last" | "origin" | "hover";

/**
 * A mark of play in one cell (`px` by `px`). Each has its own shape, so the
 * color never carries information alone: a destination is a ring, a die that
 * can move has a bracket, the selection a thick square, the origin of the last
 * move a dashed square and its destination corners.
 */
export function drawMark(kind: MarkKind, px: number, accent: string = COLORS.shesh): HTMLCanvasElement {
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
    case "hover":
      ctx.fillStyle = "rgba(22,127,136,0.26)";
      ctx.fillRect(px * 0.04, px * 0.04, px * 0.92, px * 0.92);
      break;
  }
  return canvas;
}
