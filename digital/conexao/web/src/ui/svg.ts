import { PIPS } from "./pips";

/** Palette of the collection (arte/esbocos/c-motivos-por-lingua/LEIAME.md), with the accent of this prototype. */
export const COLORS = {
  ink: "#1E1B18",
  paper: "#F4EEE2",
  wool: "#FBF8F1",
  line: "#CDC3B0",
  muted: "#6B6257",
  /** The accent of the connection game, a prototype without a name and without a color of its own yet. */
  accent: "#7A3E6B",
} as const;

/** The dice of the Seks: white and black. */
export const DIE_BODIES = ["#F1EDE4", "#2A2622"] as const;
export const DIE_PIPS = ["#1E1B18", "#F4EEE2"] as const;

/** The color of a seat on the panels: a warm stone for the White, ink for the Black. */
export const SEAT_COLORS = ["#B3A68C", "#1E1B18"] as const;
/** The text over a seat color. */
export const SEAT_INK = ["#1E1B18", "#FBF8F1"] as const;

export const seatColor = (seat: number) => SEAT_COLORS[seat % 2]!;
export const dieBody = (seat: number) => DIE_BODIES[seat % 2]!;

/** Round to two decimals, for compact SVG. */
const f = (n: number) => +n.toFixed(2);

/** A die of a player seen from above, centred at (cx, cy) with side `s`. */
export function dieMarkup(cx: number, cy: number, s: number, value: number, seat: number): string {
  const half = s / 2;
  const r = s * 0.17;
  let out = `<g>`;
  out += `<rect x="${f(cx - half + s * 0.03)}" y="${f(cy - half + s * 0.05)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="#000" opacity="0.18"/>`;
  out += `<rect x="${f(cx - half)}" y="${f(cy - half)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="${dieBody(seat)}" stroke="${seat === 0 ? "#9C9282" : "#000"}" stroke-width="${f(s * 0.03)}"/>`;
  const d = s * 0.26;
  for (const [dx, dy] of PIPS[value] ?? []) {
    out += `<circle cx="${f(cx + dx * d)}" cy="${f(cy + dy * d)}" r="${f(s * 0.085)}" fill="${DIE_PIPS[seat % 2]}"/>`;
  }
  return out + "</g>";
}

/** A die of a player as an inline icon of `size` pixels. */
export function dieIcon(value: number, size: number, seat: number): string {
  const box = f(size * 1.12);
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true">${dieMarkup(size / 2 + size * 0.03, size / 2 + size * 0.03, size, value, seat)}</svg>`;
}

/** The face of six, the mark of the collection; this prototype has no pip of its own yet, so none is filled. */
export function brandMark(size: number): string {
  const box = size * 0.92;
  const c = size / 2;
  const d = box * 0.25;
  const r = box * 0.095;
  let s = `<rect x="${f(c - box / 2)}" y="${f(c - box / 2)}" width="${f(box)}" height="${f(box)}" rx="${f(box * 0.16)}" fill="none" stroke="${COLORS.ink}" stroke-width="${f(Math.max(1, box * 0.045))}"/>`;
  const positions: [number, number][] = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
  for (const [dx, dy] of positions) s += `<circle cx="${f(c + dx)}" cy="${f(c + dy)}" r="${f(r)}" fill="${COLORS.ink}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${s}</svg>`;
}
