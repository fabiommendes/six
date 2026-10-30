import type { Kind, Mission } from "../engine/game";
import { faceText, MISSION_NAMES, MISSION_RULES, missionNumber } from "../logic/texts";
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

/** A zone of a tray in pixels, from its top-left corner. */
export interface PixelZone {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The tray of a seat: wool, a band in the seat color, the name and the points, the reserve on the wool and the hand on its own darker mat. */
export function drawTray(width: number, height: number, seat: number, title: string, detail: string, active: boolean, reserve: PixelZone, hand: PixelZone, label: number): HTMLCanvasElement {
  const canvas = makeCanvas(width, height);
  const ctx = context(canvas);
  roundedRect(ctx, 4, 4, width - 8, height - 8, 22);
  ctx.fillStyle = COLORS.wool;
  ctx.fill();
  ctx.lineWidth = active ? 10 : 4;
  ctx.strokeStyle = active ? COLORS.ink : COLORS.line;
  ctx.stroke();
  ctx.fillStyle = seatColor(seat);
  ctx.fillRect(4 + 11, 4, 18, height - 8);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 36px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(title, reserve.x, 30);
  ctx.font = `700 32px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(detail, reserve.x + reserve.w, 30);

  // The reserve: a faint well with its label.
  roundedRect(ctx, reserve.x, reserve.y, reserve.w, reserve.h, 12);
  ctx.fillStyle = "rgba(30, 27, 24, 0.05)";
  ctx.fill();
  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 21px ${SC_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("reserva", reserve.x + 12, reserve.y + reserve.h / 2);

  // The hand: a felt mat, the dice that play this round.
  roundedRect(ctx, hand.x, hand.y, hand.w, hand.h, 16);
  ctx.fillStyle = "#3D5E4A";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#24392C";
  ctx.stroke();
  ctx.fillStyle = "rgba(251, 248, 241, 0.85)";
  ctx.font = `700 26px ${SC_FONT}`;
  ctx.fillText("mão", hand.x + 14, hand.y + hand.h / 2);
  ctx.strokeStyle = "rgba(251, 248, 241, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hand.x + label - 8, hand.y + 14);
  ctx.lineTo(hand.x + label - 8, hand.y + hand.h - 14);
  ctx.stroke();
  return canvas;
}

/** The mat of the showcase, with its label. */
export function drawShowcase(width: number, height: number): HTMLCanvasElement {
  const canvas = makeCanvas(width, height);
  const ctx = context(canvas);
  roundedRect(ctx, 4, 4, width - 8, height - 8, 20);
  ctx.fillStyle = "rgba(251, 248, 241, 0.14)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(251, 248, 241, 0.4)";
  ctx.stroke();
  ctx.fillStyle = "rgba(251, 248, 241, 0.9)";
  ctx.font = `700 30px ${SC_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("vitrine", width / 2, 10);
  return canvas;
}

/** A chip to tap on the table, such as the direction of a modifier: dark, with light text. */
export function drawChip(text: string, width: number, height: number): HTMLCanvasElement {
  const canvas = makeCanvas(width, height);
  const ctx = context(canvas);
  roundedRect(ctx, 3, 3, width - 6, height - 6, height * 0.3);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS.wool;
  ctx.stroke();
  ctx.fillStyle = COLORS.wool;
  ctx.font = `800 ${Math.round(height * 0.5)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2 + 2);
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

/**
 * A mission card: the name (a number mission shows its value large), what
 * it asks ("objetivo") and what it scores ("pontuação"), and room at the
 * bottom for the markers; `result` is what the player deciding now makes on
 * it. A sabotaged mission is covered: it stays on the table and plays
 * again next round.
 */
export function drawCard(mission: Mission, sabotaged: boolean, result: string | null, w: number, h: number): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  const ctx = context(canvas);
  const standard = mission === "standard";
  const number = missionNumber(mission);
  roundedRect(ctx, 6, 6, w - 12, h - 12, 28);
  ctx.fillStyle = standard ? "#EFE6D2" : COLORS.wool;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.accent;
  ctx.font = `700 30px ${SC_FONT}`;
  ctx.fillText(standard ? "padrão, sempre na mesa" : number !== null ? "carta de número" : "carta", w / 2, 20);
  ctx.fillStyle = COLORS.ink;
  let top: number;
  if (number !== null) {
    ctx.font = `800 150px ${FONT}`;
    ctx.fillText(String(number), w / 2, 44);
    top = 200;
  } else {
    ctx.font = `800 76px ${FONT}`;
    ctx.fillText(MISSION_NAMES[mission], w / 2, 52);
    top = 142;
  }
  // The largest text size at which both parts fit above the markers.
  const rule = MISSION_RULES[mission];
  const sections = [
    { label: "objetivo", text: rule.goal, weight: 400 },
    { label: "pontuação", text: rule.score, weight: 700 },
  ];
  const label = 32;
  const bottom = h - 104;
  const layout = (size: number) =>
    sections.map((section) => {
      ctx.font = `${section.weight} ${size}px ${FONT}`;
      return wrap(ctx, section.text, w - 48);
    });
  const height = (size: number, lines: string[][]) => lines.reduce((sum, l) => sum + label + 6 + l.length * (size + 4) + 16, 0);
  let size = 52;
  let lines = layout(size);
  while (size > 32 && top + height(size, lines) > bottom) {
    size -= 2;
    lines = layout(size);
  }
  let y = top;
  sections.forEach((section, i) => {
    ctx.fillStyle = COLORS.accent;
    ctx.font = `700 ${label}px ${SC_FONT}`;
    ctx.fillText(section.label, w / 2, y);
    y += label + 6;
    ctx.fillStyle = COLORS.ink;
    ctx.font = `${section.weight} ${size}px ${FONT}`;
    lines[i]!.forEach((line, j) => ctx.fillText(line, w / 2, y + j * (size + 4)));
    y += lines[i]!.length * (size + 4) + 16;
  });
  if (result !== null && !sabotaged) {
    ctx.font = `800 40px ${FONT}`;
    const width = ctx.measureText(result).width + 36;
    roundedRect(ctx, w - 24 - width, h - 92, width, 64, 14);
    ctx.fillStyle = COLORS.ink;
    ctx.fill();
    ctx.fillStyle = COLORS.wool;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(result, w - 24 - width / 2, h - 58);
  }
  if (sabotaged) {
    // Covers the whole card, so it reads as out of play.
    ctx.fillStyle = "#2B2723";
    roundedRect(ctx, 6, 6, w - 12, h - 12, 28);
    ctx.fill();
    ctx.fillStyle = COLORS.wool;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${number !== null ? 120 : 64}px ${FONT}`;
    ctx.fillText(number !== null ? String(number) : MISSION_NAMES[mission], w / 2, h / 2 - 110);
    ctx.font = `800 76px ${FONT}`;
    ctx.fillStyle = DIE_LOOKS.gold.body;
    ctx.fillText("sabotada", w / 2, h / 2 + 10);
    ctx.fillStyle = COLORS.wool;
    ctx.font = `700 38px ${FONT}`;
    ctx.fillText("volta na próxima rodada", w / 2, h / 2 + 80);
  }
  return canvas;
}
