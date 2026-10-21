import { COLORS } from "../ui/svg";
import { PIPS } from "../ui/pips";

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

/**
 * A face of a die. A common die is ivory with dark pips; a seal has the
 * colour of its player and light pips.
 */
export function drawDieFace(value: number, color: string | null, px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const gradient = ctx.createLinearGradient(0, 0, px, px);
  if (color) {
    gradient.addColorStop(0, shade(color, 0.12));
    gradient.addColorStop(1, shade(color, -0.08));
  } else {
    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(1, "#F1ECE2");
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
    const lit = ctx.createRadialGradient(cx + 0.2 * r, cy + 0.24 * r, 0, cx + 0.2 * r, cy + 0.24 * r, 1.4 * r);
    lit.addColorStop(0, color ? "#E9E3D8" : "#4A4540");
    lit.addColorStop(1, color ? "#FFFFFF" : "#14120F");
    ctx.fillStyle = lit;
    disc(ctx, cx, cy, r);
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

/** A strip of the lattice of the Liu (ADR 0005) along `x`, `length` long, on a grid of spacing `u`. */
function drawLattice(ctx: CanvasRenderingContext2D, length: number, u: number, color: string): void {
  const tileW = 8;
  const repeats = Math.max(1, Math.round(length / (tileW * u)));
  const stretch = length / (repeats * tileW * u);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.26 * u * 2;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  const line = (points: readonly (readonly [number, number])[], i: number) => {
    ctx.beginPath();
    points.forEach(([gx, gy], k) => {
      const x = (i * tileW + gx) * u * stretch;
      const y = gy * u;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  ctx.beginPath();
  ctx.moveTo(0, 0.5 * u);
  ctx.lineTo(length, 0.5 * u);
  ctx.moveTo(0, 8.5 * u);
  ctx.lineTo(length, 8.5 * u);
  ctx.stroke();
  const hook = [[1, 8.5], [1, 2], [7, 2], [7, 7], [3, 7], [3, 4], [5, 4], [5, 5]] as const;
  for (let i = 0; i < repeats; i++) line(hook, i);
}

/** The face of six of the collection, the pip of the Liu filled and the others hollow. */
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
    if (i === 1) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(0.8, size * 0.03);
      ctx.stroke();
    }
  });
}

/**
 * The mat of a window, `cells` wide plus the band: paper with the lattice
 * on the four sides and the face of six at the corners, and a faint grid of
 * the 7 by 7 cells. `px` per cell.
 */
export function drawMat(cells: number, side: number, px: number, accent: string): HTMLCanvasElement {
  const S = side * px;
  const canvas = makeCanvas(Math.round(S));
  const ctx = context(canvas);
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, S, S);
  const random = noise(3);
  // Paper fibres.
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(120,100,70,${random() * 0.05})`;
    ctx.fillRect(random() * S, random() * S, 1 + random() * 3, 1);
  }
  const band = (side - cells) / 2;
  const u = (band * px * 0.62) / 9;
  const t = 9 * u;
  const inset = band * px * 0.16;
  const along = S - 2 * inset - 2 * t;
  const sides: [number, number, number][] = [
    [inset + t, inset, 0],
    [S - inset - t, S - inset, Math.PI],
    [inset, S - inset - t, -Math.PI / 2],
    [S - inset, inset + t, Math.PI / 2],
  ];
  for (const [x, y, angle] of sides) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    drawLattice(ctx, along, u, COLORS.liu);
    ctx.restore();
  }
  for (const [x, y] of [[inset, inset], [S - inset - t, inset], [inset, S - inset - t], [S - inset - t, S - inset - t]] as const) {
    drawFace6(ctx, x + t / 2, y + t / 2, t * 0.8, COLORS.liu);
  }
  // The grid of every cell the window could ever use.
  const g = band * px;
  ctx.strokeStyle = "rgba(107,98,87,0.28)";
  ctx.lineWidth = Math.max(1, px * 0.012);
  ctx.setLineDash([px * 0.06, px * 0.06]);
  ctx.beginPath();
  for (let i = 0; i <= cells; i++) {
    ctx.moveTo(g + i * px, g);
    ctx.lineTo(g + i * px, g + cells * px);
    ctx.moveTo(g, g + i * px);
    ctx.lineTo(g + cells * px, g + i * px);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // The seat colour, as a thin rule along the owner's edge.
  ctx.fillStyle = accent;
  ctx.fillRect(inset + t, S - inset * 0.55, along, inset * 0.25);
  return canvas;
}

/** A cell the window may still use: lighter than the mat, with a fine border. */
export function drawCell(px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const i = px * 0.035;
  ctx.fillStyle = COLORS.wool;
  ctx.fillRect(i, i, px - 2 * i, px - 2 * i);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = px * 0.02;
  ctx.strokeRect(i, i, px - 2 * i, px - 2 * i);
  return canvas;
}

/** The tray of the market: a disc of wool with a jade rule and a ring of pips. */
export function drawTray(px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const c = px / 2;
  const gradient = ctx.createRadialGradient(c, c, px * 0.1, c, c, px / 2);
  gradient.addColorStop(0, COLORS.wool);
  gradient.addColorStop(1, COLORS.paper);
  ctx.fillStyle = gradient;
  disc(ctx, c, c, px / 2 - 1);
  ctx.fill();
  ctx.strokeStyle = COLORS.liu;
  ctx.lineWidth = px * 0.008;
  disc(ctx, c, c, px * 0.47);
  ctx.stroke();
  disc(ctx, c, c, px * 0.425);
  ctx.stroke();
  ctx.fillStyle = COLORS.liu;
  const pips = 48;
  for (let i = 0; i < pips; i++) {
    const a = (i / pips) * Math.PI * 2;
    disc(ctx, c + Math.cos(a) * px * 0.4475, c + Math.sin(a) * px * 0.4475, px * 0.0065);
    ctx.fill();
  }
  ctx.font = `700 ${px * 0.032}px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(c, c + px * 0.395);
  ctx.fillText("MERCADO", 0, 0);
  ctx.restore();
  return canvas;
}

/** The place of the hand: a small dished square with its label. */
export function drawHandPlate(px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px, Math.round(px * 1.3));
  const ctx = context(canvas);
  ctx.fillStyle = COLORS.paper;
  roundedRect(ctx, 2, 2, px - 4, px * 1.3 - 4, px * 0.12);
  ctx.fill();
  ctx.strokeStyle = COLORS.liu;
  ctx.lineWidth = px * 0.03;
  ctx.stroke();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = px * 0.02;
  ctx.setLineDash([px * 0.06, px * 0.05]);
  roundedRect(ctx, px * 0.12, px * 0.12, px * 0.76, px * 0.76, px * 0.1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `800 ${px * 0.17}px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MÃO", px / 2, px * 1.08);
  return canvas;
}

export type MarkKind = "ring" | "selected" | "last" | "line" | "hover" | "unfit";

/**
 * A mark of play in one cell (`px` by `px`). Each has its own shape, so the
 * colour never carries information alone (ADR 0005): the destination is a
 * ring, the selection a thick square, the die put last has corners.
 */
export function drawMark(kind: MarkKind, px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const c = px / 2;
  switch (kind) {
    case "ring":
      disc(ctx, c, c, px * 0.27);
      ctx.strokeStyle = COLORS.wool;
      ctx.lineWidth = px * 0.15;
      ctx.stroke();
      ctx.strokeStyle = COLORS.liu;
      ctx.lineWidth = px * 0.09;
      ctx.stroke();
      break;
    case "hover":
      ctx.fillStyle = "rgba(76,122,52,0.22)";
      ctx.fillRect(px * 0.04, px * 0.04, px * 0.92, px * 0.92);
      break;
    case "selected": {
      const i = px * 0.07;
      ctx.strokeStyle = COLORS.wool;
      ctx.lineWidth = px * 0.14;
      ctx.strokeRect(i, i, px - 2 * i, px - 2 * i);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = px * 0.09;
      ctx.strokeRect(i, i, px - 2 * i, px - 2 * i);
      break;
    }
    case "last": {
      const i = px * 0.05;
      const w = px - 2 * i;
      const k = px * 0.24;
      ctx.strokeStyle = COLORS.liu;
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
    case "line":
      ctx.fillStyle = "rgba(76,122,52,0.3)";
      ctx.fillRect(0, px * 0.06, px, px * 0.88);
      break;
    case "unfit":
      // A die of the market that fits nowhere in the window: a slash under it.
      ctx.strokeStyle = "rgba(30,27,24,0.55)";
      ctx.lineWidth = px * 0.05;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px * 0.12, px * 0.88);
      ctx.lineTo(px * 0.88, px * 0.12);
      ctx.stroke();
      break;
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
