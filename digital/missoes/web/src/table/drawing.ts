import type { Kind, Mission } from "../engine/game";
import { faceText, MISSION_NAMES, MISSION_RULES } from "../logic/texts";
import { PIPS } from "../ui/pips";
import { COLORS, DIE_LOOKS, seatColor } from "../ui/svg";

/** The textures of the table, drawn on 2D canvases: dice faces, the wood, the trays and the mission cards. */

export const FONT = '"Alegreya Sans", sans-serif';
const SC_FONT = '"Alegreya Sans SC", sans-serif';

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

/** Lightens (`amount` > 0) or darkens a hex color. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => Math.round(Math.min(255, Math.max(0, amount > 0 ? c + (255 - c) * amount : c * (1 + amount))));
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** A face of a die of `kind` showing `face`: pips (none for 0), or ±1 and ±2 on a modifier, and the mark of the kind in a corner. */
export function drawDieFace(kind: Kind, face: number, px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  const look = DIE_LOOKS[kind];
  const gradient = ctx.createLinearGradient(0, 0, px, px);
  gradient.addColorStop(0, shade(look.body, 0.12));
  gradient.addColorStop(1, shade(look.body, -0.08));
  ctx.fillStyle = gradient;
  roundedRect(ctx, 0, 0, px, px, px * 0.14);
  ctx.fill();
  ctx.fillStyle = look.pip;
  if (kind === "modifier" && face > 0) {
    ctx.font = `800 ${px * 0.5}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(faceText(kind, face), px / 2, px * 0.54);
  } else {
    const d = px * 0.27;
    for (const [dx, dy] of PIPS[face] ?? []) {
      ctx.beginPath();
      ctx.arc(px / 2 + dx * d, px / 2 + dy * d, px * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (look.mark) {
    ctx.globalAlpha = 0.8;
    ctx.font = `700 ${px * 0.2}px ${SC_FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(look.mark, px * 0.95, px * 0.05);
  }
  return canvas;
}

/** The cloth of the table: felt with a faint grain. */
export function drawCloth(px: number): HTMLCanvasElement {
  const canvas = makeCanvas(px);
  const ctx = context(canvas);
  ctx.fillStyle = "#2F4A3A";
  ctx.fillRect(0, 0, px, px);
  let s = 7;
  for (let i = 0; i < px * 6; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const x = s % px;
    s = (s * 1664525 + 1013904223) >>> 0;
    const y = s % px;
    ctx.fillStyle = (s & 1) === 0 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(x, y, 2, 2);
  }
  return canvas;
}

/** The tray of a seat: wool, a band in the seat color, the name and the points. */
export function drawTray(width: number, height: number, seat: number, title: string, detail: string, active: boolean): HTMLCanvasElement {
  const canvas = makeCanvas(width, height);
  const ctx = context(canvas);
  roundedRect(ctx, 4, 4, width - 8, height - 8, 26);
  ctx.fillStyle = COLORS.wool;
  ctx.fill();
  ctx.lineWidth = active ? 10 : 4;
  ctx.strokeStyle = active ? COLORS.ink : COLORS.line;
  ctx.stroke();
  ctx.fillStyle = seatColor(seat);
  ctx.fillRect(4 + 13, 4, 20, height - 8);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 44px ${FONT}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(title, 58, 22);
  ctx.font = `400 34px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "right";
  ctx.fillText(detail, width - 34, 28);
  return canvas;
}

/** Breaks `text` into lines of at most `width` pixels. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** A mission card: the name and the rule; a sabotaged card is crossed out. */
export function drawCard(mission: Mission, sabotaged: boolean, w: number, h: number): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  const ctx = context(canvas);
  roundedRect(ctx, 6, 6, w - 12, h - 12, 28);
  ctx.fillStyle = mission === "standard" ? "#EFE6D2" : COLORS.wool;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
  ctx.fillStyle = COLORS.accent;
  ctx.font = `700 30px ${SC_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(mission === "standard" ? "sempre na mesa" : "carta", w / 2, 30);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 66px ${FONT}`;
  ctx.fillText(MISSION_NAMES[mission], w / 2, 70);
  ctx.font = `400 40px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  wrap(ctx, MISSION_RULES[mission], w - 60).forEach((line, i) => ctx.fillText(line, w / 2, 160 + i * 46));
  if (sabotaged) {
    ctx.fillStyle = "rgba(30,27,24,0.55)";
    roundedRect(ctx, 6, 6, w - 12, h - 12, 28);
    ctx.fill();
    ctx.fillStyle = COLORS.wool;
    ctx.font = `800 52px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText("sabotada", w / 2, h / 2);
  }
  return canvas;
}
