import type { Kind } from "../engine/game";
import { faceText } from "../logic/texts";
import { PIPS } from "./pips";

/** Palette of the collection (arte/esbocos/c-motivos-por-lingua/LEIAME.md). The game has no name yet, so no motif and no color of its own: the gold of its gold dice stands in. */
export const COLORS = {
  ink: "#1E1B18",
  paper: "#F4EEE2",
  wool: "#FBF8F1",
  line: "#CDC3B0",
  muted: "#6B6257",
  accent: "#8A6A12",
} as const;

/** The color of each seat, for its marker and its tray: terracotta, blue, green and plum. */
export const SEAT_COLORS = ["#B8532B", "#2C5A9A", "#4C7A34", "#7A3B69"] as const;

export const seatColor = (seat: number) => SEAT_COLORS[seat % SEAT_COLORS.length]!;

/** How a kind of die looks: its body, its pips and the mark in its corner, so the color is never the only cue. */
export interface DieLook {
  readonly body: string;
  readonly pip: string;
  readonly mark: string;
}

export const DIE_LOOKS: Record<Kind, DieLook> = {
  common: { body: "#FBF8F1", pip: "#1E1B18", mark: "" },
  gold: { body: "#D9AE3A", pip: "#1E1B18", mark: "O" },
  highGold: { body: "#D9AE3A", pip: "#1E1B18", mark: "O+" },
  one: { body: "#2B2723", pip: "#FBF8F1", mark: "U" },
  low: { body: "#1F4E9B", pip: "#FBF8F1", mark: "B" },
  high: { body: "#A3302A", pip: "#FBF8F1", mark: "A" },
  even: { body: "#3F7A4A", pip: "#FBF8F1", mark: "P" },
  odd: { body: "#7A4A26", pip: "#FBF8F1", mark: "I" },
  binary: { body: "#167F88", pip: "#FBF8F1", mark: "01" },
  modifier: { body: "#5E3A87", pip: "#FBF8F1", mark: "±" },
};

/** Round to two decimals, for compact SVG. */
const f = (n: number) => +n.toFixed(2);

/** A small shape per seat, so a seat never rests on color alone: circle, square, triangle, diamond. */
export function glyphMarkup(seat: number, cx: number, cy: number, r: number, fill: string, stroke = "none"): string {
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${f(r * 0.3)}"`;
  switch (seat % 4) {
    case 0:
      return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}/>`;
    case 1:
      return `<rect x="${f(cx - r * 0.9)}" y="${f(cy - r * 0.9)}" width="${f(1.8 * r)}" height="${f(1.8 * r)}" ${attrs}/>`;
    case 2:
      return `<polygon points="${f(cx)},${f(cy - r * 1.1)} ${f(cx + r * 1.1)},${f(cy + r * 0.85)} ${f(cx - r * 1.1)},${f(cy + r * 0.85)}" ${attrs}/>`;
    default:
      return `<polygon points="${f(cx)},${f(cy - r * 1.2)} ${f(cx + r * 1.1)},${f(cy)} ${f(cx)},${f(cy + r * 1.2)} ${f(cx - r * 1.1)},${f(cy)}" ${attrs}/>`;
  }
}

/** The marker of a seat as an inline icon. */
export function seatIcon(seat: number, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${glyphMarkup(seat, size / 2, size / 2, size * 0.36, seatColor(seat), COLORS.ink)}</svg>`;
}

/** A die of `kind` with `face` up, seen from above, as an inline icon of `size` pixels. */
export function dieIcon(kind: Kind, face: number | null, size: number): string {
  const look = DIE_LOOKS[kind];
  const s = size;
  const r = s * 0.17;
  let out = `<rect x="1" y="1" width="${f(s - 2)}" height="${f(s - 2)}" rx="${f(r)}" fill="${look.body}" stroke="${COLORS.ink}" stroke-width="1.5"/>`;
  if (face !== null) {
    if (kind === "modifier" && face > 0) {
      out += `<text x="${f(s / 2)}" y="${f(s * 0.66)}" text-anchor="middle" font-family="Alegreya Sans, sans-serif" font-weight="800" font-size="${f(s * 0.46)}" fill="${look.pip}">${faceText(kind, face)}</text>`;
    } else {
      const d = s * 0.25;
      for (const [dx, dy] of PIPS[face] ?? []) {
        out += `<circle cx="${f(s / 2 + dx * d)}" cy="${f(s / 2 + dy * d)}" r="${f(s * 0.085)}" fill="${look.pip}"/>`;
      }
    }
  }
  if (look.mark) {
    out += `<text x="${f(s - 3)}" y="${f(s * 0.24)}" text-anchor="end" font-family="Alegreya Sans SC, sans-serif" font-weight="700" font-size="${f(s * 0.2)}" fill="${look.pip}" opacity="0.85">${look.mark}</text>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true">${out}</svg>`;
}

/** The face of six, the mark of the collection; the game has no pip of its own yet, so none is filled. */
export function brandMark(size: number): string {
  const box = size * 0.92;
  const c = size / 2;
  const d = box * 0.25;
  const r = box * 0.095;
  let s = `<rect x="${f(c - box / 2)}" y="${f(c - box / 2)}" width="${f(box)}" height="${f(box)}" rx="${f(box * 0.16)}" fill="none" stroke="${COLORS.ink}" stroke-width="${f(Math.max(1, box * 0.045))}"/>`;
  for (const [dx, dy] of [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]] as const) {
    s += `<circle cx="${f(c + dx)}" cy="${f(c + dy)}" r="${f(r)}" fill="${COLORS.ink}"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${s}</svg>`;
}
