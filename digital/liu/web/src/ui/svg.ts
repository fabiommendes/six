import { PIPS } from "./pips";

/** Palette of the collection (arte/esbocos/c-motivos-por-lingua/LEIAME.md). */
export const COLORS = {
  ink: "#1E1B18",
  paper: "#F4EEE2",
  wool: "#FBF8F1",
  line: "#CDC3B0",
  muted: "#6B6257",
  liu: "#4C7A34",
} as const;

/** The seal colors, by seat: red, blue, ochre and brown, all far from the jade of the marks. */
export const SEAL_COLORS = ["#A3302A", "#1F4E9B", "#A8740C", "#6B3F22"] as const;

export const sealColor = (player: number) => SEAL_COLORS[player % SEAL_COLORS.length]!;

/** Round to two decimals, for compact SVG. */
const f = (n: number) => +n.toFixed(2);

/**
 * A die seen from above, centred at (cx, cy) with side `s`. A common die is
 * white with black pips; a seal has the player's color and white pips.
 */
export function dieMarkup(cx: number, cy: number, s: number, value: number, color: string | null, opacity = 1): string {
  const half = s / 2;
  const r = s * 0.17;
  const body = color ?? "#FFFFFF";
  const face = color ?? "#F6F2EA";
  const ink = color ? "#FFFFFF" : COLORS.ink;
  const edge = color ? COLORS.ink : "#9C9282";
  const op = opacity < 1 ? ` opacity="${opacity}"` : "";
  let out = `<g${op}>`;
  out += `<rect x="${f(cx - half + s * 0.03)}" y="${f(cy - half + s * 0.05)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="#000" opacity="0.18"/>`;
  out += `<rect x="${f(cx - half)}" y="${f(cy - half)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="${body}" stroke="${edge}" stroke-width="${f(s * 0.025)}"/>`;
  const i = s * 0.09;
  out += `<rect x="${f(cx - half + i)}" y="${f(cy - half + i)}" width="${f(s - 2 * i)}" height="${f(s - 2 * i)}" rx="${f(r * 0.7)}" fill="${face}" opacity="${color ? 0.85 : 1}"/>`;
  const d = s * 0.26;
  for (const [dx, dy] of PIPS[value] ?? []) {
    out += `<circle cx="${f(cx + dx * d)}" cy="${f(cy + dy * d)}" r="${f(s * 0.085)}" fill="${ink}"/>`;
  }
  return out + "</g>";
}

/** A die as an inline icon of `size` pixels. */
export function dieIcon(value: number, size: number, color: string | null = null): string {
  const box = f(size * 1.12);
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true">${dieMarkup(size / 2 + size * 0.03, size / 2 + size * 0.03, size, value, color)}</svg>`;
}

/** An empty place for a die: the empty hand. */
export function emptySlot(size: number): string {
  const box = f(size * 1.12);
  const s = size * 0.94;
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true"><rect x="${f((size * 1.12 - s) / 2)}" y="${f((size * 1.12 - s) / 2)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.17)}" fill="none" stroke="${COLORS.line}" stroke-width="2" stroke-dasharray="5 4"/></svg>`;
}

/** The face of six, the mark of the collection, with the pip of the Liu in jade. */
export function brandMark(size: number): string {
  const box = size * 0.92;
  const c = size / 2;
  const d = box * 0.25;
  const r = box * 0.095;
  let s = `<rect x="${f(c - box / 2)}" y="${f(c - box / 2)}" width="${f(box)}" height="${f(box)}" rx="${f(box * 0.16)}" fill="none" stroke="${COLORS.ink}" stroke-width="${f(Math.max(1, box * 0.045))}"/>`;
  const positions: [number, number][] = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
  positions.forEach(([dx, dy], i) => {
    s += `<circle cx="${f(c + dx)}" cy="${f(c + dy)}" r="${f(r)}" fill="${i === 1 ? COLORS.liu : COLORS.ink}"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${s}</svg>`;
}

/**
 * A strip of the window lattice of the Liu (ADR 0005), `width` pixels long:
 * the "thin" tile of `arte/esbocos/c-motivos-por-lingua/six.js`.
 */
export function latticeBand(width: number, u = 3, color: string = COLORS.liu): string {
  const tileW = 6;
  const height = 7 * u;
  const repeats = Math.max(1, Math.round(width / (tileW * u)));
  const stretch = width / (repeats * tileW * u);
  const x = (gx: number, i: number) => f((i * tileW + gx) * u * stretch);
  const y = (gy: number) => f(gy * u);
  const stroke = `stroke="${color}" stroke-width="${f(0.26 * u * 2)}" fill="none" stroke-linecap="square"`;
  let s = `<line x1="0" y1="${y(0.5)}" x2="${f(width)}" y2="${y(0.5)}" ${stroke}/><line x1="0" y1="${y(6.5)}" x2="${f(width)}" y2="${y(6.5)}" ${stroke}/>`;
  const hook: [number, number][] = [[1, 6.5], [1, 2], [5, 2], [5, 5], [3, 5], [3, 3.5]];
  for (let i = 0; i < repeats; i++) {
    s += `<polyline points="${hook.map(([gx, gy]) => `${x(gx, i)},${y(gy)}`).join(" ")}" ${stroke}/>`;
  }
  return `<svg width="${f(width)}" height="${height}" viewBox="0 0 ${f(width)} ${height}" aria-hidden="true">${s}</svg>`;
}
