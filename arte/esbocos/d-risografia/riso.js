// Shared drawing helpers: SVG filters, dice, the Seks position and its moves.

const RISO_FILTERS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="ink" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="7" result="edge"/>
      <feDisplacementMap in="SourceGraphic" in2="edge" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="rough"/>
      <feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="2" result="grain"/>
      <feColorMatrix in="grain" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -24 0 0 0 18" result="speck"/>
      <feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="5" result="cloud"/>
      <feColorMatrix in="cloud" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .45 0 0 0 .78" result="mottle"/>
      <feComposite in="speck" in2="mottle" operator="in" result="mask"/>
      <feComposite in="rough" in2="mask" operator="in"/>
    </filter>
    <filter id="ink-soft" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="11" result="grain"/>
      <feColorMatrix in="grain" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -28 0 0 0 21.5" result="speck"/>
      <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="3" result="cloud"/>
      <feColorMatrix in="cloud" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .45 0 0 0 .78" result="mottle"/>
      <feComposite in="speck" in2="mottle" operator="in" result="mask"/>
      <feComposite in="SourceGraphic" in2="mask" operator="in"/>
    </filter>
    <linearGradient id="face-w" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ebe5d6"/>
    </linearGradient>
    <linearGradient id="edge-w" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d9d2c1"/><stop offset="1" stop-color="#a9a190"/>
    </linearGradient>
    <radialGradient id="pip-w" cx=".4" cy=".35" r=".7">
      <stop offset="0" stop-color="#2a2a30"/><stop offset=".7" stop-color="#151519"/><stop offset="1" stop-color="#3b3a3f"/>
    </radialGradient>
    <linearGradient id="face-b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#46464f"/><stop offset="1" stop-color="#25252b"/>
    </linearGradient>
    <linearGradient id="edge-b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c1c21"/><stop offset="1" stop-color="#08080a"/>
    </linearGradient>
    <radialGradient id="pip-b" cx=".55" cy=".6" r=".7">
      <stop offset="0" stop-color="#fffaf0"/><stop offset=".75" stop-color="#e9e2d2"/><stop offset="1" stop-color="#b8b1a2"/>
    </radialGradient>
  </defs>
</svg>`;

function installFilters() {
  document.body.insertAdjacentHTML("afterbegin", RISO_FILTERS);
}

const PIPS = {
  1: [[0, 0]],
  2: [[1, -1], [-1, 1]],
  3: [[1, -1], [0, 0], [-1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

// A die seen from above, drawn as an object: rounded body, bevelled top
// face, recessed pips and a hard offset shadow (a second ink, not a blur).
function dieSVG(value, side, { shadow = "rgba(61,85,136,.30)", lift = 0, cls = "" } = {}) {
  const s = side === "w" ? "w" : "b";
  const cx = 45.5, cy = 44.5, d = 20.5, r = 7.4;
  const pips = PIPS[value]
    .map(([x, y]) => `<circle cx="${cx + x * d}" cy="${cy + y * d}" r="${r}" fill="url(#pip-${s})"/>`)
    .join("");
  const sh = shadow
    ? `<rect x="${7 + lift}" y="${9 + lift}" width="88" height="88" rx="17" fill="${shadow}"/>`
    : "";
  return `<svg class="die die-${s} ${cls}" viewBox="0 0 100 100" aria-hidden="true">${sh}
    <g transform="translate(${-lift / 2} ${-lift / 2})">
      <rect x="2" y="2" width="88" height="88" rx="17" fill="url(#edge-${s})"/>
      <rect x="4.5" y="3.5" width="82" height="81" rx="14.5" fill="url(#face-${s})"/>
      ${pips}
    </g></svg>`;
}

const COLS = "abcdefghijk";

const POSITION = `
11  b1 .. b1 .. .. .. b1 .. b1 .. b1
10  b2 b2 .. b2 b3 .. b2 b2 .. b2 ..
 9  .. .. b4 .. .. .. .. .. .. .. ..
 8  .. .. .. .. .. b5 .. .. .. .. ..
 7  .. .. .. w3 .. .. .. .. .. .. ..
 6  .. .. .. .. .. w6 b2 .. .. .. ..
 5  .. .. .. .. .. .. .. .. w4 .. ..
 4  .. w2 .. .. .. .. .. .. .. .. ..
 3  .. .. .. .. .. .. .. .. .. .. ..
 2  w2 .. w2 w2 .. .. w2 .. .. w2 ..
 1  w1 .. w1 .. w1 .. w1 .. w1 .. w1`;

function parsePosition(text = POSITION) {
  const board = {};
  for (const line of text.trim().split("\n")) {
    const [row, ...cells] = line.trim().split(/\s+/);
    cells.forEach((c, i) => {
      if (c !== "..") board[COLS[i] + row] = { side: c[0], value: +c[1] };
    });
  }
  return board;
}

// Cells a die can move to: 8 directions, 1..value cells, no jumping.
function destinations(board, from) {
  const die = board[from];
  const c0 = COLS.indexOf(from[0]), r0 = +from.slice(1);
  const out = [];
  for (const [dc, dr] of [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]) {
    for (let k = 1; k <= die.value; k++) {
      const c = c0 + dc * k, r = r0 + dr * k;
      if (c < 0 || c > 10 || r < 1 || r > 11) break;
      const key = COLS[c] + r;
      if (board[key]) break;
      out.push(key);
    }
  }
  return out;
}

// Eight-petal star of Selbu knitting: one petal per direction a die moves.
function selbuStar(size = "100%", fill = "currentColor", extra = "") {
  const petals = [];
  for (let i = 0; i < 8; i++) {
    petals.push(`<path d="M50 50 L61 22 L50 4 L39 22 Z" transform="rotate(${i * 45} 50 50)"/>`);
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" ${extra}><g fill="${fill}">${petals.join("")}</g><circle cx="50" cy="50" r="5" fill="var(--star-eye, var(--paper))"/></svg>`;
}
