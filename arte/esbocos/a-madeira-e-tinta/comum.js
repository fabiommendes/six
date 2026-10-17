// Shared drawing code for the "madeira e tinta" sketch: dice, board and
// engraved ornaments, all as SVG strings in millimetres.

const INK = "#2A1D14";
const ACCENT = "#8B2F22";
const COLS = "abcdefghijk";

// SVG defs shared by every drawing on the page. Ids are global, so one copy
// per document is enough.
function sharedDefs() {
  return `
  <defs>
    <linearGradient id="ivoryBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FBF5E6"/>
      <stop offset="0.55" stop-color="#E9DDC2"/>
      <stop offset="1" stop-color="#C7B691"/>
    </linearGradient>
    <radialGradient id="ivoryFace" cx="0.38" cy="0.35" r="0.85">
      <stop offset="0" stop-color="#FAF4E4"/>
      <stop offset="1" stop-color="#E6D9BC"/>
    </radialGradient>
    <linearGradient id="ebonyBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5A473B"/>
      <stop offset="0.45" stop-color="#2B201A"/>
      <stop offset="1" stop-color="#0E0907"/>
    </linearGradient>
    <radialGradient id="ebonyFace" cx="0.38" cy="0.35" r="0.85">
      <stop offset="0" stop-color="#3A2C24"/>
      <stop offset="1" stop-color="#1B130F"/>
    </radialGradient>
    <radialGradient id="pipIvory" cx="0.58" cy="0.6" r="0.6" fx="0.62" fy="0.66">
      <stop offset="0" stop-color="#2E211A"/>
      <stop offset="0.75" stop-color="#1A110C"/>
      <stop offset="1" stop-color="#0B0705"/>
    </radialGradient>
    <radialGradient id="pipEbony" cx="0.6" cy="0.62" r="0.6" fx="0.64" fy="0.68">
      <stop offset="0" stop-color="#F2EAD6"/>
      <stop offset="0.7" stop-color="#DCCFB2"/>
      <stop offset="1" stop-color="#9C8E72"/>
    </radialGradient>
    <filter id="dieShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="0.55"/>
    </filter>
    <filter id="dieShadowHigh" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.3"/>
    </filter>
    <filter id="boneGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.08 1.4" numOctaves="2" seed="2"/>
      <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 0.9 -0.42"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="ebonyGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05 1.1" numOctaves="2" seed="5"/>
      <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0.8 -0.45"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="woodGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="3" seed="11" result="fine"/>
      <feColorMatrix in="fine" values="0 0 0 0 0.55  0 0 0 0 0.35  0 0 0 0 0.15  2.2 0 0 0 -0.9" result="streaks"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.002 0.022" numOctaves="2" seed="3" result="broad"/>
      <feColorMatrix in="broad" values="0 0 0 0 0.66  0 0 0 0 0.45  0 0 0 0 0.24  1.4 0 0 0 -0.58" result="figure"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.9" numOctaves="2" seed="21" result="fib"/>
      <feColorMatrix in="fib" values="0 0 0 0 0.45  0 0 0 0 0.28  0 0 0 0 0.12  2.4 0 0 0 -1.05" result="fibres"/>
      <feMerge result="m"><feMergeNode in="figure"/><feMergeNode in="streaks"/><feMergeNode in="fibres"/></feMerge>
      <feComposite in="m" in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="inkBleed" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="8" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="0.35"/>
    </filter>
  </defs>`;
}

const PIP_LAYOUT = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

// A die seen from above, centred at (x, y), side `s` mm.
// style: "color" (ivory and ebony objects) or "print" (flat black and white).
function die(x, y, value, side, { s = 16, lifted = false, style = "color" } = {}) {
  const h = s / 2;
  const d = s * 0.245;
  if (style === "print") {
    const black = side === "b";
    const pr = s * (value === 1 ? 0.12 : 0.085);
    const pips = PIP_LAYOUT[value]
      .map(([i, j]) => `<circle cx="${x + i * d}" cy="${y + j * d}" r="${pr}" fill="${black ? "#fff" : "#111"}"/>`)
      .join("");
    return `<g>
      <rect x="${x - h}" y="${y - h}" width="${s}" height="${s}" rx="${s * 0.17}" fill="${black ? "#1a1a1a" : "#fff"}" stroke="#111" stroke-width="${s * 0.05}"/>
      <rect x="${x - h + s * 0.09}" y="${y - h + s * 0.09}" width="${s * 0.82}" height="${s * 0.82}" rx="${s * 0.12}" fill="none" stroke="${black ? "#555" : "#bbb"}" stroke-width="${s * 0.025}"/>
      ${pips}</g>`;
  }
  const ivory = side === "w";
  const body = ivory ? "ivoryBody" : "ebonyBody";
  const face = ivory ? "ivoryFace" : "ebonyFace";
  const pip = ivory ? "pipIvory" : "pipEbony";
  const rim = ivory ? "rgba(255,252,240,0.9)" : "rgba(150,125,105,0.55)";
  const pr = s * (value === 1 ? 0.115 : 0.088);
  const off = lifted ? [s * 0.16, s * 0.22] : [s * 0.06, s * 0.08];
  const pips = PIP_LAYOUT[value]
    .map(([i, j]) => {
      const cx = x + i * d, cy = y + j * d;
      return `<circle cx="${cx + pr * 0.14}" cy="${cy + pr * 0.16}" r="${pr}" fill="${rim}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${pr}" fill="url(#${pip})"/>`;
    })
    .join("");
  const fi = s * 0.085;
  return `<g class="die">
    <rect x="${x - h + off[0]}" y="${y - h + off[1]}" width="${s}" height="${s}" rx="${s * 0.2}"
      fill="rgba(45,25,10,${lifted ? 0.42 : 0.5})" filter="url(#${lifted ? "dieShadowHigh" : "dieShadow"})"/>
    <rect x="${x - h}" y="${y - h}" width="${s}" height="${s}" rx="${s * 0.19}" fill="url(#${body})"/>
    <rect x="${x - h + fi}" y="${y - h + fi}" width="${s - 2 * fi}" height="${s - 2 * fi}" rx="${s * 0.12}" fill="url(#${face})"/>
    <rect x="${x - h + fi}" y="${y - h + fi}" width="${s - 2 * fi}" height="${s - 2 * fi}" rx="${s * 0.12}" fill="#fff" filter="url(#${ivory ? "boneGrain" : "ebonyGrain"})" opacity="0.55"/>
    ${pips}</g>`;
}

// Parses the diagram from the brief into {"f6": ["w", 6], ...}.
function parsePosition(text) {
  const pos = {};
  for (const line of text.trim().split("\n")) {
    const parts = line.trim().split(/\s+/);
    const row = Number(parts[0]);
    parts.slice(1).forEach((cell, c) => {
      if (cell !== "..") pos[COLS[c] + row] = [cell[0], Number(cell[1])];
    });
  }
  return pos;
}

// Cells a die can reach: 8 directions, 1..value cells, no jumping.
function destinations(pos, from) {
  const [, value] = pos[from];
  const c0 = COLS.indexOf(from[0]), r0 = Number(from.slice(1));
  const out = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (let k = 1; k <= value; k++) {
      const c = c0 + dc * k, r = r0 + dr * k;
      if (c < 0 || c > 10 || r < 1 || r > 11) break;
      const key = COLS[c] + r;
      if (pos[key]) break;
      out.push(key);
    }
  }
  return out;
}

// Engraved ornaments, all built with ruler and compass, centred at (0, 0)
// with radius ~10. Stroke colour and width are set by the caller.
const MOTIFS = {
  // Seks: hexafoil (daisy wheel), the compass rosette carved on Nordic wood.
  seks() {
    const R = 9;
    let p = `<circle r="${R}"/>`;
    p += `<clipPath id="hexclip"><circle r="${R}"/></clipPath><g clip-path="url(#hexclip)">`;
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      p += `<circle cx="${(R * Math.cos(a)).toFixed(3)}" cy="${(R * Math.sin(a)).toFixed(3)}" r="${R}"/>`;
    }
    p += `</g><circle r="${R * 1.12}"/>`;
    return p;
  },
  // Liu: square thunder spiral (leiwen).
  liu() {
    const pts = [[-1, 9], [-1, -1], [1, -1], [1, 1], [-3, 1], [-3, -3], [3, -3], [3, 3], [-5, 3], [-5, -5], [5, -5], [5, 5], [-7, 5], [-7, -7], [7, -7], [7, 7], [-9, 7]];
    return `<rect x="-9.5" y="-9.5" width="19" height="19"/><polyline points="${pts.map(([a, b]) => a * 0.95 + "," + b * 0.95).join(" ")}"/>`;
  },
  // Zes: the falling auction clock of Aalsmeer, a dial with a pointer.
  zes() {
    let p = `<circle r="9.5"/><circle r="6.6"/><circle r="0.9"/>`;
    for (let k = 0; k < 24; k++) {
      const a = (Math.PI * 2 * k) / 24;
      const r1 = k % 2 ? 7.6 : 6.6;
      p += `<line x1="${(r1 * Math.cos(a)).toFixed(2)}" y1="${(r1 * Math.sin(a)).toFixed(2)}" x2="${(9.5 * Math.cos(a)).toFixed(2)}" y2="${(9.5 * Math.sin(a)).toFixed(2)}"/>`;
    }
    p += `<line x1="0" y1="0" x2="${(6 * Math.cos(-2.2)).toFixed(2)}" y2="${(6 * Math.sin(-2.2)).toFixed(2)}"/>`;
    return p;
  },
  // Ono: niho mano, bands of shark teeth with hatched teeth.
  ono() {
    const L = -9.5, n = 4, h = 19 / 3, w = 19 / n;
    let p = `<rect x="-9.5" y="-9.5" width="19" height="19"/>`;
    for (let row = 0; row < 3; row++) {
      const y0 = L + row * h, y1 = y0 + h;
      if (row) p += `<line x1="${L}" y1="${y0}" x2="${-L}" y2="${y0}"/>`;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = L + i * w;
        pts.push(`${x},${y1}`, `${x + w / 2},${y0}`);
      }
      pts.push(`${-L},${y1}`);
      p += `<polyline points="${pts.join(" ")}"/>`;
    }
    return p;
  },
  // Suqta: chakana, the Andean stepped cross, with the hollow centre.
  suqta() {
    const u = 2.7;
    const s = [[1, 3.5], [1, 2.5], [2.5, 2.5], [2.5, 1], [3.5, 1]];
    const pts = [];
    for (let q = 0; q < 4; q++) {
      for (const [a, b] of s) {
        const [x, y] = [[a, b], [b, -a], [-a, -b], [-b, a]][q];
        pts.push(`${(x * u).toFixed(2)},${(-y * u).toFixed(2)}`);
      }
    }
    return `<polygon points="${pts.join(" ")}"/><circle r="3.4"/>`;
  },
  // Shesh: eight-pointed star of two squares (khatam), from Persian girih.
  shesh() {
    const r = 9.5;
    const sq = (rot) => {
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const a = rot + (Math.PI / 2) * k;
        pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
      }
      return `<polygon points="${pts.join(" ")}"/>`;
    };
    return sq(0) + sq(Math.PI / 4) + `<circle r="4.2"/><circle r="1.4"/>`;
  },
};

function motif(name, x, y, size, color, width) {
  const k = size / 20;
  return `<g transform="translate(${x} ${y}) scale(${k})" fill="none" color="${color}" stroke="${color}" stroke-width="${width / k}"
    stroke-linejoin="round" stroke-linecap="round">${MOTIFS[name]()}</g>`;
}

// A wooden board (or a crop of it) as an SVG string.
// opts: cols/rows to show, pos, selected, targets, last {from, to}, style.
function board({
  pos = {}, selected = null, targets = [], last = null, captured = [], arrow = null,
  cols = [0, 10], rows = [1, 11], style = "color", margin = 13, coords = true, cell = 20, frame = true,
} = {}) {
  const nc = cols[1] - cols[0] + 1, nr = rows[1] - rows[0] + 1;
  const W = nc * cell + 2 * margin, H = nr * cell + 2 * margin;
  const print = style === "print";
  const ink = print ? "#111" : INK;
  const accent = print ? "#111" : ACCENT;
  const cx = (key) => margin + (COLS.indexOf(key[0]) - cols[0]) * cell + cell / 2;
  const cy = (key) => margin + (rows[1] - Number(key.slice(1))) * cell + cell / 2;
  const x0 = margin, y0 = margin, x1 = W - margin, y1 = H - margin;
  let s = "";

  // Wood, or plain paper in print.
  if (print) {
    if (frame) s += `<rect x="0.3" y="0.3" width="${W - 0.6}" height="${H - 0.6}" fill="#fff" stroke="#111" stroke-width="0.6"/>`;
  } else {
    s += `<rect x="0" y="0" width="${W}" height="${H}" rx="1.2" fill="#E6CD9F"/>`;
    s += `<rect x="0" y="0" width="${W}" height="${H}" rx="1.2" fill="#fff" filter="url(#woodGrain)" opacity="0.85"/>`;
    // chamfered edge
    s += `<rect x="0.6" y="0.6" width="${W - 1.2}" height="${H - 1.2}" rx="0.9" fill="none" stroke="rgba(255,245,220,0.55)" stroke-width="1.2"/>`;
    s += `<rect x="0.15" y="0.15" width="${W - 0.3}" height="${H - 0.3}" rx="1.1" fill="none" stroke="rgba(70,40,15,0.45)" stroke-width="0.3"/>`;
  }

  // Engraved grid: an ink line with a light lip below it, the cut catching light.
  let grid = "";
  for (let i = 0; i <= nc; i++) {
    const x = x0 + i * cell;
    grid += `M${x} ${y0}V${y1}`;
  }
  for (let j = 0; j <= nr; j++) {
    const y = y0 + j * cell;
    grid += `M${x0} ${y}H${x1}`;
  }
  if (!print) s += `<path d="${grid}" transform="translate(0.28 0.32)" stroke="rgba(255,244,214,0.75)" stroke-width="0.35" fill="none"/>`;
  s += `<path d="${grid}" stroke="${ink}" stroke-width="${print ? 0.35 : 0.42}" fill="none" ${print ? "" : 'filter="url(#inkBleed)"'} opacity="${print ? 1 : 0.88}"/>`;

  // Back rows: a double rule outside rows 1 and 11, the goal of each side.
  const rule = (y, dir) => `<path d="M${x0} ${y + dir * 1.6}H${x1}" stroke="${ink}" stroke-width="0.9" opacity="${print ? 1 : 0.85}"/>`;
  if (rows[1] === 11) s += rule(y0, -1);
  if (rows[0] === 1) s += rule(y1, 1);

  // Corner hexafoils in the accent ink.
  if (!print && nc === 11 && nr === 11) {
    for (const [x, y] of [[margin / 2, margin / 2], [W - margin / 2, margin / 2], [margin / 2, H - margin / 2], [W - margin / 2, H - margin / 2]]) {
      s += motif("seks", x, y, 7.2, accent, 0.32);
    }
  }

  // Coordinates.
  if (coords) {
    const font = `font-family="Alegreya SC" font-size="${print ? 5.4 : 5}" fill="${ink}" opacity="${print ? 1 : 0.8}" text-anchor="middle"`;
    for (let c = cols[0]; c <= cols[1]; c++) {
      const x = margin + (c - cols[0]) * cell + cell / 2;
      s += `<text x="${x}" y="${H - margin / 2 + 1.9}" ${font}>${COLS[c]}</text>`;
    }
    for (let r = rows[0]; r <= rows[1]; r++) {
      const y = margin + (rows[1] - r) * cell + cell / 2 + 1.5;
      s += `<text x="${margin / 2}" y="${y}" ${font} class="tabular">${r}</text>`;
    }
  }

  // Last move: hollow ink ring at the origin, thin square at the destination.
  if (last) {
    s += `<circle cx="${cx(last.from)}" cy="${cy(last.from)}" r="5.2" fill="none" stroke="${ink}" stroke-width="0.7" stroke-dasharray="1.6 1.1" opacity="0.9"/>`;
    s += `<rect x="${cx(last.to) - 9.3}" y="${cy(last.to) - 9.3}" width="18.6" height="18.6" fill="none" stroke="${ink}" stroke-width="0.6" opacity="0.9"/>`;
  }

  // Destinations: stamped ink dots.
  for (const t of targets) {
    s += `<circle cx="${cx(t)}" cy="${cy(t)}" r="2.6" fill="${accent}" opacity="${print ? 1 : 0.88}" ${print ? "" : 'filter="url(#inkBleed)"'}/>`;
  }

  // Selection: heavy accent corner brackets around the cell.
  if (selected) {
    const x = cx(selected), y = cy(selected), a = 9.6, b = 4.2;
    let br = "";
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      br += `M${x + sx * a} ${y + sy * (a - b)}V${y + sy * a}H${x + sx * (a - b)}`;
    }
    s += `<path d="${br}" stroke="${accent}" stroke-width="1.6" fill="none" stroke-linecap="square"/>`;
  }

  // Move arrow (manual diagrams).
  if (arrow) {
    const [ax, ay, bx, by] = [cx(arrow.from), cy(arrow.from), cx(arrow.to), cy(arrow.to)];
    const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
    const sx = ax + ux * 9.5, sy = ay + uy * 9.5, ex = bx - ux * 10.5, ey = by - uy * 10.5;
    s += `<circle cx="${ax}" cy="${ay}" r="5" fill="none" stroke="${ink}" stroke-width="0.6" stroke-dasharray="1.4 1"/>`;
    s += `<path d="M${sx} ${sy}L${ex} ${ey}" stroke="${ink}" stroke-width="0.9"/>`;
    s += `<path d="M${ex + ux * 1.8} ${ey + uy * 1.8}l${-ux * 3.2 - uy * 1.8} ${-uy * 3.2 + ux * 1.8}l${uy * 3.6} ${-ux * 3.6}z" fill="${ink}"/>`;
  }

  // Dice. Only cells inside the visible window.
  for (const [key, [side, value]] of Object.entries(pos)) {
    const c = COLS.indexOf(key[0]), r = Number(key.slice(1));
    if (c < cols[0] || c > cols[1] || r < rows[0] || r > rows[1]) continue;
    s += die(cx(key), cy(key), value, side, { lifted: key === selected, style });
  }

  // Captured marks (manual diagrams): a cross in the cell corner.
  for (const k of captured) {
    const x = cx(k) + 7.2, y = cy(k) - 7.2;
    s += `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" stroke="${ink}" stroke-width="0.5"/>`;
    s += `<path d="M${x - 1.2} ${y - 1.2}l2.4 2.4M${x + 1.2} ${y - 1.2}l-2.4 2.4" stroke="${ink}" stroke-width="0.6"/>`;
  }

  return { svg: s, W, H };
}

function svgWrap(content, W, H, attrs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${attrs}>${content}</svg>`;
}

const BRIEF_POSITION = `
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
