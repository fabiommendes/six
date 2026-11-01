import { PIPS } from "../board/pips";
import { COLORS } from "../board/layout";
import { strip, type MotifKind } from "../board/motif";
import type { Side } from "../engine/game";
import type { LegendMark } from "../logic/legend";

/** Round to two decimals, for compact SVG. */
const f = (n: number) => +n.toFixed(2);

/**
 * The gradients and filters of the dice, once per page (`diceDefs()`). Every
 * SVG die refers to them by id, so the sheet stays in the document and is
 * never hidden with `display: none` (some browsers then drop the gradients).
 */
export function diceDefs(): string {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="dw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#F1EDE4"/><stop offset="1" stop-color="#CFC7B8"/></linearGradient>
    <linearGradient id="dwt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F3EFE7"/></linearGradient>
    <linearGradient id="db" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A4540"/><stop offset="0.5" stop-color="#2A2622"/><stop offset="1" stop-color="#0E0C0B"/></linearGradient>
    <linearGradient id="dbt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A3531"/><stop offset="1" stop-color="#211E1B"/></linearGradient>
    <radialGradient id="pw" cx="0.6" cy="0.62" r="0.7"><stop offset="0" stop-color="#4A4540"/><stop offset="1" stop-color="#14120F"/></radialGradient>
    <radialGradient id="pb" cx="0.6" cy="0.62" r="0.7"><stop offset="0" stop-color="#C9C2B4"/><stop offset="1" stop-color="#FAF7F0"/></radialGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs></svg>`;
}

/** A die seen from above, as in the sketch: body with soft edges, a flat top face and the pips. */
/** The soft shadow a die of side `s` casts on the board, a little down and to the right. */
function dieShadow(cx: number, cy: number, s: number): string {
  const half = s / 2;
  const off = s * 0.05;
  return `<rect x="${f(cx - half + off * 0.6)}" y="${f(cy - half + off)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.17)}" fill="#000" opacity="0.32" filter="url(#sh)"/>`;
}

function dieMarkup(cx: number, cy: number, s: number, value: number, side: Side, shadow = true): string {
  const white = side === "white";
  const r = s * 0.17;
  const half = s / 2;
  let out = shadow ? dieShadow(cx, cy, s) : "";
  out += `<rect x="${f(cx - half)}" y="${f(cy - half)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="url(#${white ? "dw" : "db"})" stroke="${white ? "#9C9282" : "#000"}" stroke-width="${f(s * 0.02)}"/>`;
  const i = s * 0.09;
  out += `<rect x="${f(cx - half + i)}" y="${f(cy - half + i)}" width="${f(s - 2 * i)}" height="${f(s - 2 * i)}" rx="${f(r * 0.7)}" fill="url(#${white ? "dwt" : "dbt"})"/>`;
  const d = s * 0.26;
  const pr = s * 0.085;
  for (const [dx, dy] of PIPS[value] ?? []) {
    out += `<circle cx="${f(cx + dx * d)}" cy="${f(cy + dy * d)}" r="${f(pr)}" fill="url(#${white ? "pw" : "pb"})"/>`;
  }
  return out;
}

/** A die as a small icon: `size` is the side of the die; the SVG leaves room around it for the shadow. */
export function dieIcon(value: number, side: Side, size: number): string {
  const pad = size * 0.25;
  const box = f(size + pad);
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true">${dieMarkup(size / 2 + pad * 0.3, size / 2 + pad * 0.3, size, value, side)}</svg>`;
}

/**
 * The figure of the start screen, the rule of the game in one play: a row of
 * five cells, a 4 of the Whites in the first one and the rings of the cells it
 * reaches, 1 to 4. The CSS of `.start-figure` lifts the die, walks it two
 * cells and turns it a quarter, to the 2 (a face next to the 4); without
 * motion the figure stays as drawn, before the play.
 */
export function startFigure(): string {
  const u = 72;
  const w = 5 * u;
  const h = u;
  let s = `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="${COLORS.wool}" stroke="${COLORS.ink}" stroke-width="2"/>`;
  for (let i = 1; i < 5; i++) s += `<line x1="${i * u}" y1="1" x2="${i * u}" y2="${h - 1}" stroke="#cdc3b0" stroke-width="1.5"/>`;
  for (let i = 1; i <= 4; i++) {
    const c = i * u + u / 2;
    s += `<g class="ring" style="--i:${i - 1}"><circle cx="${c}" cy="${u / 2}" r="${f(u * 0.27)}" fill="none" stroke="${COLORS.seks}" stroke-width="3"/>`;
    s += `<text x="${c}" y="${f(u / 2 + 1)}" text-anchor="middle" dominant-baseline="central" font-family="Alegreya Sans, sans-serif" font-weight="800" font-size="${f(u * 0.34)}" fill="${COLORS.seks}">${i}</text></g>`;
  }
  // The shadow stays apart from the faces: it does not turn with the die, and it falls further while the die is lifted.
  const die = (value: number) => dieMarkup(u / 2, u / 2, u * 0.7, value, "white", false);
  s += `<g class="walker"><g class="die-shadow">${dieShadow(u / 2, u / 2, u * 0.7)}</g><g class="die-body"><g class="face-4">${die(4)}</g><g class="face-2">${die(2)}</g></g></g>`;
  return `<svg class="start-figure" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="start-figure-caption">${s}</svg>`;
}

/** The face of six, the mark of the collection, with the pip of the Seks filled. */
export function brandMark(size: number): string {
  const d = size * 0.25 * 0.92;
  const r = (size * 0.92) * 0.095;
  const c = size / 2;
  const box = size * 0.92;
  let s = `<rect x="${f(c - box / 2)}" y="${f(c - box / 2)}" width="${f(box)}" height="${f(box)}" rx="${f(box * 0.16)}" fill="none" stroke="${COLORS.ink}" stroke-width="${f(Math.max(1, box * 0.045))}"/>`;
  const positions: [number, number][] = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
  positions.forEach(([dx, dy], i) => {
    s += i === 0
      ? `<circle cx="${f(c + dx)}" cy="${f(c + dy)}" r="${f(r)}" fill="${COLORS.seks}"/>`
      : `<circle cx="${f(c + dx)}" cy="${f(c + dy)}" r="${f(r)}" fill="none" stroke="${COLORS.ink}" stroke-width="${f(Math.max(0.8, box * 0.03))}"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${s}</svg>`;
}

/** A strip of the motif, `width` long. */
export function motifStrip(kind: MotifKind, width: number, u: number): string {
  const { pips, thickness, radius } = strip(kind, width, u);
  const circles = pips.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(radius)}"/>`).join("");
  return `<svg width="${f(width)}" height="${f(thickness)}" viewBox="0 0 ${f(width)} ${f(thickness)}" fill="${COLORS.seks}" aria-hidden="true">${circles}</svg>`;
}

/** A mark of play, in the shape it has on the board. */
export function markIcon(kind: LegendMark, size = 22): string {
  const c = size / 2;
  const k = size * 0.28;
  let s = "";
  if (kind === "destination") {
    s = `<circle cx="${c}" cy="${c}" r="${f(size * 0.36)}" fill="none" stroke="${COLORS.seks}" stroke-width="1.8"/>`;
    s += `<text x="${c}" y="${f(c + size * 0.02)}" text-anchor="middle" dominant-baseline="central" font-family="Alegreya Sans, sans-serif" font-weight="800" font-size="${f(size * 0.48)}" fill="${COLORS.seks}">2</text>`;
  }
  if (kind === "capture") {
    s = `<circle cx="${c}" cy="${c}" r="${f(size * 0.3)}" fill="none" stroke="${COLORS.seks}" stroke-width="1.6"/><circle cx="${c}" cy="${c}" r="${f(size * 0.45)}" fill="none" stroke="${COLORS.seks}" stroke-width="1.6"/>`;
    s += `<text x="${c}" y="${f(c + size * 0.02)}" text-anchor="middle" dominant-baseline="central" font-family="Alegreya Sans, sans-serif" font-weight="800" font-size="${f(size * 0.4)}" fill="${COLORS.seks}">2</text>`;
  }
  if (kind === "victim" || kind === "custody") s = `<path d="M2 2L${f(size * 0.27)} ${f(size * 0.27)}M${size - 2} 2L${f(size * 0.73)} ${f(size * 0.27)}M2 ${size - 2}L${f(size * 0.27)} ${f(size * 0.73)}M${size - 2} ${size - 2}L${f(size * 0.73)} ${f(size * 0.73)}" fill="none" stroke="${COLORS.seks}" stroke-width="2.5" stroke-linecap="round"/>`;
  if (kind === "target") s = `<path d="M${c} 1V${f(size * 0.3)}M${c} ${size - 1}V${f(size * 0.7)}M1 ${c}H${f(size * 0.3)}M${size - 1} ${c}H${f(size * 0.7)}" fill="none" stroke="${COLORS.seks}" stroke-width="2.5"/>`;
  if (kind === "selected") s = `<rect x="2" y="2" width="${size - 4}" height="${size - 4}" fill="${COLORS.selection}" stroke="${COLORS.seks}" stroke-width="3"/>`;
  if (kind === "origin") s = `<rect x="3" y="3" width="${size - 6}" height="${size - 6}" fill="none" stroke="${COLORS.ink}" stroke-width="1.6" stroke-dasharray="2.3 2.3"/>`;
  if (kind === "decisive") {
    const t = f(size * 0.36);
    const e = f(size - size * 0.36);
    s = `<path d="M1 1H${t}L1 ${t}ZM${size - 1} 1H${e}L${size - 1} ${t}ZM1 ${size - 1}H${t}L1 ${e}ZM${size - 1} ${size - 1}H${e}L${size - 1} ${e}Z" fill="${COLORS.seks}"/>`;
  }
  if (kind === "last") s = `<path d="M1 ${f(1 + k)}V1H${f(1 + k)}M${f(size - 1 - k)} 1H${size - 1}V${f(1 + k)}M${size - 1} ${f(size - 1 - k)}V${size - 1}H${f(size - 1 - k)}M${f(1 + k)} ${size - 1}H1V${f(size - 1 - k)}" fill="none" stroke="${COLORS.ink}" stroke-width="2.2"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${s}</svg>`;
}
