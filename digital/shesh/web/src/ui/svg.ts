import { PIPS } from "./pips";

/** Palette of the collection (arte/esbocos/c-motivos-por-lingua/LEIAME.md), with the turquoise of the Shesh. */
export const COLORS = {
  ink: "#1E1B18",
  paper: "#F4EEE2",
  wool: "#FBF8F1",
  line: "#CDC3B0",
  muted: "#6B6257",
  shesh: "#167F88",
  /** The red square in the middle of the board. */
  rosette: "#A3302A",
} as const;

/** The color of each seat, which is also the color of its dice: terracotta and blue. */
export const SEAT_COLORS = ["#B8532B", "#2C5A9A"] as const;

export const seatColor = (player: number) => SEAT_COLORS[player % SEAT_COLORS.length]!;

/** The body of a binary die. */
export const BINARY_COLOR = "#EFE7D4";

/** Round to two decimals, for compact SVG. */
const f = (n: number) => +n.toFixed(2);

/** A small shape that tells the seats apart without color: a circle for the first, a square for the second. */
function glyph(seat: number, cx: number, cy: number, r: number, fill: string): string {
  return seat === 0
    ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"/>`
    : `<rect x="${f(cx - r)}" y="${f(cy - r)}" width="${f(2 * r)}" height="${f(2 * r)}" fill="${fill}"/>`;
}

/** A die of a player seen from above, centred at (cx, cy) with side `s`, in the color of its seat. */
export function dieMarkup(cx: number, cy: number, s: number, value: number, seat: number, opacity = 1): string {
  const half = s / 2;
  const r = s * 0.17;
  const op = opacity < 1 ? ` opacity="${opacity}"` : "";
  let out = `<g${op}>`;
  out += `<rect x="${f(cx - half + s * 0.03)}" y="${f(cy - half + s * 0.05)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="#000" opacity="0.18"/>`;
  out += `<rect x="${f(cx - half)}" y="${f(cy - half)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="${seatColor(seat)}" stroke="${COLORS.ink}" stroke-width="${f(s * 0.025)}"/>`;
  const d = s * 0.26;
  for (const [dx, dy] of PIPS[value] ?? []) {
    out += `<circle cx="${f(cx + dx * d)}" cy="${f(cy + dy * d)}" r="${f(s * 0.085)}" fill="#FFFFFF"/>`;
  }
  out += glyph(seat, cx - half + s * 0.15, cy - half + s * 0.15, s * 0.065, "#FFFFFF");
  return out + "</g>";
}

/** A die of a player as an inline icon of `size` pixels. */
export function dieIcon(value: number, size: number, seat: number): string {
  const box = f(size * 1.12);
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true">${dieMarkup(size / 2 + size * 0.03, size / 2 + size * 0.03, size, value, seat)}</svg>`;
}

/** A binary die showing `bit` (0 or 1) as an inline icon. */
export function binaryIcon(bit: 0 | 1, size: number): string {
  const box = f(size * 1.12);
  const c = size / 2 + size * 0.03;
  const half = size / 2;
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true"><rect x="${f(c - half)}" y="${f(c - half)}" width="${f(size)}" height="${f(size)}" rx="${f(size * 0.17)}" fill="${BINARY_COLOR}" stroke="${COLORS.ink}" stroke-width="${f(size * 0.04)}"/><text x="${f(c)}" y="${f(c + size * 0.07)}" text-anchor="middle" dominant-baseline="middle" font-family="Alegreya Sans, sans-serif" font-weight="800" font-size="${f(size * 0.7)}" fill="${COLORS.ink}">${bit}</text></svg>`;
}

/** An empty place for a die. */
export function emptySlot(size: number): string {
  const box = f(size * 1.12);
  const s = size * 0.94;
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true"><rect x="${f((size * 1.12 - s) / 2)}" y="${f((size * 1.12 - s) / 2)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.17)}" fill="none" stroke="${COLORS.line}" stroke-width="2" stroke-dasharray="5 4"/></svg>`;
}

/** The face of six, the mark of the collection, with the sixth pip (the Shesh) filled. */
export function brandMark(size: number): string {
  const box = size * 0.92;
  const c = size / 2;
  const d = box * 0.25;
  const r = box * 0.095;
  let s = `<rect x="${f(c - box / 2)}" y="${f(c - box / 2)}" width="${f(box)}" height="${f(box)}" rx="${f(box * 0.16)}" fill="none" stroke="${COLORS.ink}" stroke-width="${f(Math.max(1, box * 0.045))}"/>`;
  const positions: [number, number][] = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
  positions.forEach(([dx, dy], i) => {
    s += `<circle cx="${f(c + dx)}" cy="${f(c + dy)}" r="${f(r)}" fill="${i === 5 ? COLORS.shesh : COLORS.ink}"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${s}</svg>`;
}
