// Shared drawing code for the geometric sketch: dice, board, motifs, logo.
// Board units: one cell is 100 units; a die is 80 units (16 mm die, 20 mm cell).

const SVG_NS = "http://www.w3.org/2000/svg";
const COLS = "abcdefghijk";

const PALETTE = {
  ink: "#141414",
  paper: "#F3F1EC",
  cell: "#DCD8CF",
  backRow: "#CBC6BB",
  label: "#6E6A62",
  seks: "#E2231A",
};

// The six kit colours, one accent per game, 60 degrees apart on the colour wheel.
const GAMES = [
  { name: "Seks", lang: "dinamarquês", color: "#E2231A", colorName: "vermelho", motif: "face", status: "regras prontas" },
  { name: "Liu", lang: "mandarim", color: "#F2B200", colorName: "amarelo", motif: "triangle", status: "em desenho" },
  { name: "Zes", lang: "holandês", color: "#F26B00", colorName: "laranja", motif: "brick", status: "em desenho" },
  { name: "Ono", lang: "polinésio", color: "#00905A", colorName: "verde", motif: "wave", status: "em desenho" },
  { name: "Suqta", lang: "quíchua", color: "#6A3D9A", colorName: "violeta", motif: "stairs", status: "em desenho" },
  { name: "Shesh", lang: "persa", color: "#0B5CB5", colorName: "azul", motif: "ring", status: "em desenho" },
];

function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.appendChild(child);
  return node;
}

// Pip centres for a face value, as offsets in units of the pip step.
function pipOffsets(value) {
  const faces = {
    1: [[0, 0]],
    2: [[1, -1], [-1, 1]],
    3: [[1, -1], [0, 0], [-1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
  };
  return faces[value];
}

const DIE_STYLES = {
  // screen: discreet volume, a hard offset shadow and a darker side band
  w: { side: "#B9B3A7", face: "#FBFAF6", pip: "#161616", edge: "#FFFFFF", edgeOpacity: 0.9, shadow: 0.22 },
  b: { side: "#000000", face: "#2A2A2A", pip: "#F1EEE6", edge: "#FFFFFF", edgeOpacity: 0.16, shadow: 0.3 },
  // print: black ink only, side band as a flat tint
  wPrint: { side: "#9A9A9A", face: "#FFFFFF", pip: "#000000", edge: null, outline: "#000000", shadow: 0 },
  bPrint: { side: "#000000", face: "#333333", pip: "#FFFFFF", edge: null, outline: "#000000", shadow: 0 },
};

// A die seen from above with discreet volume. (x, y) is its top-left corner.
function die(x, y, value, styleKey, size = 80) {
  const s = DIE_STYLES[styleKey] || styleKey;
  const k = size / 80;
  const g = el("g", { class: "die" });
  if (s.shadow) {
    g.appendChild(el("rect", { x: x + 3 * k, y: y + 5 * k, width: size, height: size, rx: 14 * k, fill: "#000", "fill-opacity": s.shadow }));
  }
  g.appendChild(el("rect", { x, y, width: size, height: size, rx: 14 * k, fill: s.side, ...(s.outline ? { stroke: s.outline, "stroke-width": 2.2 * k } : {}) }));
  const face = size - 5 * k;
  g.appendChild(el("rect", { x, y, width: face, height: face, rx: 12 * k, fill: s.face, ...(s.outline ? { stroke: s.outline, "stroke-width": 2.2 * k } : {}) }));
  if (s.edge) {
    const r = 12 * k;
    const d = `M ${x + 1.6 * k} ${y + face - r} V ${y + r} A ${r - 1.6 * k} ${r - 1.6 * k} 0 0 1 ${x + r} ${y + 1.6 * k} H ${x + face - r}`;
    g.appendChild(el("path", { d, fill: "none", stroke: s.edge, "stroke-opacity": s.edgeOpacity, "stroke-width": 2.2 * k, "stroke-linecap": "round" }));
  }
  const cx = x + face / 2;
  const cy = y + face / 2;
  const step = 19.5 * k;
  for (const [dx, dy] of pipOffsets(value)) {
    g.appendChild(el("circle", { cx: cx + dx * step, cy: cy + dy * step, r: 7 * k, fill: s.pip }));
  }
  return g;
}

// Standalone die icon as an <svg> element, for text panels.
function dieIcon(value, styleKey, px) {
  const svg = el("svg", { viewBox: "-2 -2 90 90", width: px, height: px, class: "die-icon", "aria-hidden": "true" });
  svg.appendChild(die(0, 0, value, styleKey));
  return svg;
}

function parsePosition(rows) {
  // rows: strings from row 11 down to row 1, cells separated by spaces
  const pos = new Map();
  rows.forEach((line, i) => {
    const row = 11 - i;
    line.trim().split(/\s+/).forEach((tok, c) => {
      if (tok !== "..") pos.set(COLS[c] + row, { side: tok[0], value: Number(tok[1]) });
    });
  });
  return pos;
}

function squareOf(name) {
  return { c: COLS.indexOf(name[0]), r: Number(name.slice(1)) };
}

function nameOf(c, r) {
  return COLS[c] + r;
}

// Cells a die can move to: 8 directions, 1..value cells, no jumping, no leaving the board.
function destinations(pos, from) {
  const { c, r } = squareOf(from);
  const { value } = pos.get(from);
  const out = [];
  for (const [dc, dr] of [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]) {
    for (let n = 1; n <= value; n++) {
      const nc = c + dc * n;
      const nr = r + dr * n;
      if (nc < 0 || nc > 10 || nr < 1 || nr > 11) break;
      const name = nameOf(nc, nr);
      if (pos.has(name)) break;
      out.push(name);
    }
  }
  return out;
}

// Board drawing. opts: { cols: [c0, c1], rows: [r0, r1], print, selected, targets, lastFrom, lastTo, arrows, captured, ghosts }
function board(pos, opts = {}) {
  const [c0, c1] = opts.cols || [0, 10];
  const [r0, r1] = opts.rows || [1, 11];
  const w = (c1 - c0 + 1) * 100;
  const h = (r1 - r0 + 1) * 100;
  const pad = opts.pad ?? 56;
  const print = !!opts.print;
  const accent = opts.accent || PALETTE.seks;
  const svg = el("svg", { viewBox: `${-pad} ${-12} ${w + pad + 12} ${h + pad + 12}`, class: "board", role: "img" });
  const X = (c) => (c - c0) * 100;
  const Y = (r) => (r1 - r) * 100;

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const back = r === 1 || r === 11;
      const name = nameOf(c, r);
      let fill = print ? "#FFFFFF" : back ? PALETTE.backRow : PALETTE.cell;
      if (name === opts.selected) fill = print ? "#000" : accent;
      svg.appendChild(el("rect", {
        x: X(c) + 3, y: Y(r) + 3, width: 94, height: 94, fill,
        ...(print ? { stroke: "#000", "stroke-width": 1.6 } : {}),
        "data-cell": name,
      }));
      if (print && back && name !== opts.selected) {
        svg.appendChild(el("rect", { x: X(c) + 3, y: Y(r) + 3, width: 94, height: 94, fill: "url(#hatch)" }));
      }
    }
  }
  if (print) {
    const defs = el("defs");
    const pat = el("pattern", { id: "hatch", width: 10, height: 10, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pat.appendChild(el("rect", { width: 2, height: 10, fill: "#000", "fill-opacity": 0.35 }));
    defs.appendChild(pat);
    svg.prepend(defs);
  }

  // coordinates
  const labelFill = print ? "#000" : PALETTE.label;
  for (let c = c0; c <= c1; c++) {
    const t = el("text", { x: X(c) + 50, y: h + 44, "text-anchor": "middle", class: "coord", fill: labelFill });
    t.textContent = COLS[c];
    svg.appendChild(t);
  }
  for (let r = r0; r <= r1; r++) {
    const t = el("text", { x: -22, y: Y(r) + 59, "text-anchor": "end", class: "coord", fill: labelFill });
    t.textContent = r;
    svg.appendChild(t);
  }

  const ink = print ? "#000" : PALETTE.ink;
  if (opts.lastFrom) {
    const { c, r } = squareOf(opts.lastFrom);
    svg.appendChild(el("rect", { x: X(c) + 12, y: Y(r) + 12, width: 74, height: 74, rx: 12, fill: "none", stroke: ink, "stroke-width": 4, "stroke-dasharray": "10 7" }));
  }
  for (const g of opts.ghosts || []) {
    const { c, r } = squareOf(g);
    svg.appendChild(el("rect", { x: X(c) + 12, y: Y(r) + 12, width: 74, height: 74, rx: 12, fill: "none", stroke: ink, "stroke-width": 4, "stroke-dasharray": "10 7" }));
  }
  if (opts.lastTo) {
    const { c, r } = squareOf(opts.lastTo);
    svg.appendChild(el("rect", { x: X(c) + 3, y: Y(r) + 3, width: 94, height: 94, fill: "none", stroke: ink, "stroke-width": 6 }));
  }
  for (const [a, b] of opts.arrows || []) {
    const p = squareOf(a);
    const q = squareOf(b);
    const x1 = X(p.c) + 50, y1 = Y(p.r) + 50, x2 = X(q.c) + 50, y2 = Y(q.r) + 50;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const ex = x2 - ux * 52, ey = y2 - uy * 52;
    svg.appendChild(el("line", { x1: x1 + ux * 46, y1: y1 + uy * 46, x2: ex - ux * 16, y2: ey - uy * 16, stroke: ink, "stroke-width": 6 }));
    svg.appendChild(el("path", { d: `M ${ex} ${ey} L ${ex - ux * 24 - uy * 13} ${ey - uy * 24 + ux * 13} L ${ex - ux * 24 + uy * 13} ${ey - uy * 24 - ux * 13} Z`, fill: ink }));
  }
  for (const t of opts.targets || []) {
    const { c, r } = squareOf(t);
    svg.appendChild(el("circle", { cx: X(c) + 50, cy: Y(r) + 50, r: 13, fill: print ? "#000" : accent, "data-target": t }));
  }

  for (const [name, d] of pos) {
    const { c, r } = squareOf(name);
    if (c < c0 || c > c1 || r < r0 || r > r1) continue;
    const key = print ? (d.side === "w" ? "wPrint" : "bPrint") : d.side;
    svg.appendChild(die(X(c) + 10, Y(r) + 9, d.value, key));
  }
  for (const name of opts.captured || []) {
    const { c, r } = squareOf(name);
    const x = X(c) + 50, y = Y(r) + 48;
    svg.appendChild(el("path", { d: `M ${x - 30} ${y - 30} L ${x + 30} ${y + 30} M ${x + 30} ${y - 30} L ${x - 30} ${y + 30}`, stroke: print ? "#FFF" : PALETTE.paper, "stroke-width": 16, "stroke-linecap": "square" }));
    svg.appendChild(el("path", { d: `M ${x - 30} ${y - 30} L ${x + 30} ${y + 30} M ${x + 30} ${y - 30} L ${x - 30} ${y + 30}`, stroke: print ? "#000" : accent, "stroke-width": 8, "stroke-linecap": "square" }));
  }
  return svg;
}

// Game motifs: six pips each, in a module of 22 units, centred in a square of side 100.
const MOTIFS = {
  face: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  triangle: [[1, 0], [0.5, 1], [1.5, 1], [0, 2], [1, 2], [2, 2]],
  brick: [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [2.5, 1]],
  wave: [0, 1, 2, 3, 4, 5].map((i) => [i * 0.62, (i % 2) * 0.62]),
  stairs: [[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [3, 0]],
  ring: [0, 1, 2, 3, 4, 5].map((i) => [1.1 * Math.sin((i * Math.PI) / 3), -1.1 * Math.cos((i * Math.PI) / 3)]),
};

function motif(name, fill, px, bg = null) {
  const svg = el("svg", { viewBox: "0 0 100 100", width: px, height: px, class: "motif", "aria-hidden": "true" });
  if (bg) svg.appendChild(el("rect", { width: 100, height: 100, fill: bg }));
  const pts = MOTIFS[name];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const unit = 22;
  for (const [x, y] of pts) {
    svg.appendChild(el("circle", { cx: 50 + (x - midX) * unit, cy: 50 + (y - midY) * unit, r: 7.5, fill }));
  }
  return svg;
}

// Collection mark: the six face, square with die-like corners.
function mark(fill, pip, px) {
  const svg = el("svg", { viewBox: "0 0 100 100", width: px, height: px, class: "mark", "aria-hidden": "true" });
  svg.appendChild(el("rect", { width: 100, height: 100, rx: 16, fill }));
  for (const [x, y] of [[30, 22], [30, 50], [30, 78], [70, 22], [70, 50], [70, 78]]) {
    svg.appendChild(el("circle", { cx: x, cy: y, r: 10, fill: pip }));
  }
  return svg;
}

// Wordmark "six" in Archivo ExtraBold, with the dot of the i as a round pip.
// Metrics measured from Archivo at 1000 units: advances s 579, dotless i 288.
function wordmark(ink, dot, heightPx) {
  const top = -780, bottom = 18, left = 28, right = 1372;
  const svg = el("svg", {
    viewBox: `${left} ${top} ${right - left} ${bottom - top}`,
    height: heightPx, width: (heightPx * (right - left)) / (bottom - top),
    class: "wordmark-svg", role: "img", "aria-label": "six",
  });
  const text = el("text", { x: 0, y: 0, fill: ink, "font-family": "Archivo", "font-weight": 800, "font-size": 1000, "letter-spacing": -55, style: "text-transform:none;font-style:normal" });
  text.textContent = "sıx";
  svg.appendChild(text);
  svg.appendChild(el("circle", { cx: 524 + 140, cy: -672, r: 102, fill: dot }));
  return svg;
}

// Mark and wordmark side by side; the mark spans baseline to the top of the dot.
function lockup(ink, pip, dot, heightPx) {
  const box = document.createElement("span");
  box.className = "lockup";
  box.style.cssText = `display:inline-flex;align-items:flex-end;gap:${heightPx * 0.16}px`;
  const m = mark(ink, pip, heightPx * (774 / 798));
  m.style.marginBottom = `${heightPx * (18 / 798)}px`;
  box.appendChild(m);
  box.appendChild(wordmark(ink, dot, heightPx));
  return box;
}
