import { PIPS } from "./pips";

/** Palette of the collection (arte/esbocos/c-motivos-por-lingua/LEIAME.md), with the accent of the Sia. */
export const COLORS = {
  ink: "#1E1B18",
  paper: "#F4EEE2",
  wool: "#FBF8F1",
  line: "#CDC3B0",
  muted: "#6B6257",
  sia: "#46607A",
} as const;

/** The suit of the stones (the fifth): it counts as any suit. The suits of the bag are 0 to 3. */
export const STONE_SUIT = 4;

/** The body color of each suit: red, blue, yellow and green for the bag, graphite for the stones. */
export const SUIT_COLORS = ["#B83A2E", "#2B62B8", "#E3B323", "#3E8A43", "#34383D"] as const;

/** Names of the suits, for texts. */
export const SUIT_NAMES = ["vermelho", "azul", "amarelo", "verde", "dos marcos"] as const;

/** The color of each seat, far from every suit: teal and plum. */
export const SEAT_COLORS = ["#12807A", "#8E3B8F"] as const;

export const seatColor = (player: number) => SEAT_COLORS[player % SEAT_COLORS.length]!;

/** Whether the pips on a body of `suit` are light (all but the yellow). */
export const lightPips = (suit: number) => suit !== 2;

/** Round to two decimals, for compact SVG. */
const f = (n: number) => +n.toFixed(2);

/** A small shape that tells the suit apart without color: circle, square, triangle, diamond. */
function glyph(suit: number, cx: number, cy: number, r: number, fill: string): string {
  switch (suit) {
    case 0:
      return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"/>`;
    case 1:
      return `<rect x="${f(cx - r)}" y="${f(cy - r)}" width="${f(2 * r)}" height="${f(2 * r)}" fill="${fill}"/>`;
    case 2:
      return `<polygon points="${f(cx)},${f(cy - r)} ${f(cx + r)},${f(cy + r)} ${f(cx - r)},${f(cy + r)}" fill="${fill}"/>`;
    case 3:
      return `<polygon points="${f(cx)},${f(cy - r * 1.15)} ${f(cx + r * 1.15)},${f(cy)} ${f(cx)},${f(cy + r * 1.15)} ${f(cx - r * 1.15)},${f(cy)}" fill="${fill}"/>`;
    default:
      return "";
  }
}

/** A die seen from above, centred at (cx, cy) with side `s`, in the color of its suit. */
export function dieMarkup(cx: number, cy: number, s: number, value: number, suit: number, opacity = 1): string {
  const half = s / 2;
  const r = s * 0.17;
  const body = SUIT_COLORS[suit] ?? SUIT_COLORS[STONE_SUIT];
  const ink = lightPips(suit) ? "#FFFFFF" : COLORS.ink;
  const op = opacity < 1 ? ` opacity="${opacity}"` : "";
  let out = `<g${op}>`;
  out += `<rect x="${f(cx - half + s * 0.03)}" y="${f(cy - half + s * 0.05)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="#000" opacity="0.18"/>`;
  out += `<rect x="${f(cx - half)}" y="${f(cy - half)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="${body}" stroke="${COLORS.ink}" stroke-width="${f(s * 0.025)}"/>`;
  const d = s * 0.26;
  for (const [dx, dy] of PIPS[value] ?? []) {
    out += `<circle cx="${f(cx + dx * d)}" cy="${f(cy + dy * d)}" r="${f(s * 0.085)}" fill="${ink}"/>`;
  }
  out += glyph(suit, cx - half + s * 0.15, cy - half + s * 0.15, s * 0.065, ink);
  return out + "</g>";
}

/** A die as an inline icon of `size` pixels. */
export function dieIcon(value: number, size: number, suit: number = STONE_SUIT): string {
  const box = f(size * 1.12);
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true">${dieMarkup(size / 2 + size * 0.03, size / 2 + size * 0.03, size, value, suit)}</svg>`;
}

/** An empty place for a die. */
export function emptySlot(size: number): string {
  const box = f(size * 1.12);
  const s = size * 0.94;
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true"><rect x="${f((size * 1.12 - s) / 2)}" y="${f((size * 1.12 - s) / 2)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.17)}" fill="none" stroke="${COLORS.line}" stroke-width="2" stroke-dasharray="5 4"/></svg>`;
}

/** The face of six, the mark of the collection, with the pip of the Sia filled. */
export function brandMark(size: number): string {
  const box = size * 0.92;
  const c = size / 2;
  const d = box * 0.25;
  const r = box * 0.095;
  let s = `<rect x="${f(c - box / 2)}" y="${f(c - box / 2)}" width="${f(box)}" height="${f(box)}" rx="${f(box * 0.16)}" fill="none" stroke="${COLORS.ink}" stroke-width="${f(Math.max(1, box * 0.045))}"/>`;
  const positions: [number, number][] = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
  positions.forEach(([dx, dy], i) => {
    s += `<circle cx="${f(c + dx)}" cy="${f(c + dy)}" r="${f(r)}" fill="${i === 4 ? COLORS.sia : COLORS.ink}"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${s}</svg>`;
}
