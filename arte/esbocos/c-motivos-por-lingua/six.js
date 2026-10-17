// Shared drawing code for the "one motif per language" sketch.
// Every motif is drawn on the same pip grid: points spaced by `u`,
// with three marks only: a pip (filled dot), a stroke between grid
// points and a filled polygon whose vertices are grid points.

const SIX = (() => {
  const COLORS = {
    ink: "#1E1B18",
    paper: "#F4EEE2",
    wool: "#FBF8F1",
    line: "#CDC3B0",
    muted: "#6B6257",
    seks: "#A3302A",
    liu: "#4C7A34",
    zes: "#1F4E9B",
    ono: "#6B3F22",
    suqta: "#A8740C",
    shesh: "#167F88",
  };

  const GAMES = [
    { id: "seks", name: "Seks", lang: "dinamarquês, norueguês, feroês", word: "seks", motif: "malha nórdica", genre: "estratégia abstrata, 2 jogadores", state: "regras escritas" },
    { id: "liu", name: "Liu", lang: "mandarim", word: "liù", motif: "treliça de janela", genre: "estilo sudoku", state: "em desenho" },
    { id: "zes", name: "Zes", lang: "holandês", word: "zes", motif: "azulejo de Delft", genre: "leilão e sequências", state: "em desenho" },
    { id: "ono", name: "Ono", lang: "havaiano, maori, taitiano", word: "ono", motif: "tapa de casca", genre: "cooperativo", state: "em desenho" },
    { id: "suqta", name: "Suqta", lang: "quíchua", word: "suqta", motif: "tecido andino", genre: "dados mentirosos", state: "em desenho" },
    { id: "shesh", name: "Shesh", lang: "persa", word: "shesh", motif: "azulejo de estrela e cruz", genre: "gamão", state: "em desenho" },
  ];

  // Pip and stroke size, in grid units. Same for every motif.
  const PIP_R = 0.31;
  const STROKE = 0.26;

  const f = (n) => +n.toFixed(2);

  // Pips from a chart: 'X' is a pip. Copies at +-w/+-h keep tiles seamless.
  function chart(rows, u, color, w, h, ox = 0, oy = 0) {
    let s = "";
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== "X") return;
        for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
          const cx = (x + ox + dx + 0.5) * u, cy = (y + oy + dy + 0.5) * u;
          if (cx < -u || cy < -u || cx > (w + 1) * u || cy > (h + 1) * u) continue;
          s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(PIP_R * u)}" fill="${color}"/>`;
        }
      });
    });
    return s;
  }

  const pip = (x, y, u, color, scale = 1) =>
    `<circle cx="${f(x * u)}" cy="${f(y * u)}" r="${f(PIP_R * u * scale)}" fill="${color}"/>`;

  // Polyline through grid points, e.g. [[0,0],[0,4],[3,4]].
  const line = (pts, u, color, close = false, w = 1) =>
    `<path d="M${pts.map(([x, y]) => `${f(x * u)} ${f(y * u)}`).join(" L")}${close ? " Z" : ""}" fill="none" stroke="${color}" stroke-width="${f(STROKE * u * w)}" stroke-linecap="square" stroke-linejoin="miter"/>`;

  const poly = (pts, u, color, stroke) =>
    `<path d="M${pts.map(([x, y]) => `${f(x * u)} ${f(y * u)}`).join(" L")} Z" fill="${color}"${stroke ? ` stroke="${stroke}" stroke-width="${f(STROKE * u)}" stroke-linejoin="miter"` : ""}/>`;

  const arc = (cx, cy, r, a0, a1, u, color) => {
    const p = (a) => [(cx + r * Math.cos(a)) * u, (cy + r * Math.sin(a)) * u];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return `<path d="M${f(x0)} ${f(y0)} A${f(r * u)} ${f(r * u)} 0 ${large} 1 ${f(x1)} ${f(y1)}" fill="none" stroke="${color}" stroke-width="${f(STROKE * u)}"/>`;
  };

  // --- Seks: Nordic knitting, every stitch is a pip --------------------
  const SEKS_BAND = [
    "XXXXXXXX",
    ".X.X.X.X",
    "........",
    "....X...",
    "X..XXX..",
    "..XX.XX.",
    ".XX...XX",
    "XX..X..X",
    ".XX...XX",
    "..XX.XX.",
    "X..XXX..",
    "....X...",
    "........",
    ".X.X.X.X",
    "XXXXXXXX",
  ];
  const SEKS_THIN = ["XXXX", "....", "X...", ".X.X", "..X.", "....", "XXXX"];
  const SNOWFLAKE = [
    "X..X..X",
    ".X.X.X.",
    "..XXX..",
    "XXX.XXX",
    "..XXX..",
    ".X.X.X.",
    "X..X..X",
  ];
  // Eight-point star of eight rhombi, after the Selbu rose, 17 by 17 stitches.
  const STAR = [
    "........X........",
    "........X........",
    "..X....XXX....X..",
    "...XX..XXX..XX...",
    "...XXX.XXX.XXX...",
    "....XXX.X.XXX....",
    ".....XX.X.XX.....",
    "..XXX..XXX..XXX..",
    "XXXXXXXX.XXXXXXXX",
    "..XXX..XXX..XXX..",
    ".....XX.X.XX.....",
    "....XXX.X.XXX....",
    "...XXX.XXX.XXX...",
    "...XX..XXX..XX...",
    "..X....XXX....X..",
    "........X........",
    "........X........",
  ];

  // --- Shesh: star and cross tile ---------------------------------------
  const starPts = (cx, cy) => [
    [4, 0], [3, 1], [3, 3], [1, 3], [0, 4], [-1, 3], [-3, 3], [-3, 1],
    [-4, 0], [-3, -1], [-3, -3], [-1, -3], [0, -4], [1, -3], [3, -3], [3, -1],
  ].map(([x, y]) => [cx + x, cy + y]);

  // --- Suqta: stepped diamond ---------------------------------------------
  function steppedDiamond(cx, cy, r) {
    // Walk the outline clockwise on the grid.
    const pts = [];
    // top edge to right tip: from (cx, cy-r) staircase down-right
    let x = 0, y = -r;
    pts.push([x, y]);
    while (y < 0) { x += 1; pts.push([x, y]); y += 1; pts.push([x, y]); }
    while (x > 0) { y += 1; pts.push([x, y]); x -= 1; pts.push([x, y]); }
    while (y > 0) { x -= 1; pts.push([x, y]); y -= 1; pts.push([x, y]); }
    while (x < 0) { y -= 1; pts.push([x, y]); x += 1; pts.push([x, y]); }
    return pts.map(([a, b]) => [cx + a, cy + b]);
  }

  // Motif tiles. Each returns {w, h, svg} in grid units for a given u.
  const MOTIFS = {
    seks: {
      band: (u, c) => ({ w: 8, h: 15, svg: chart(SEKS_BAND, u, c, 8, 15) }),
      thin: (u, c) => ({ w: 4, h: 7, svg: chart(SEKS_THIN, u, c, 4, 7) }),
      tile: (u, c) => ({
        w: 10, h: 10,
        svg: chart(SNOWFLAKE, u, c, 10, 10, 2, 2) +
          chart(["X....X", "......", "......", "......", "......", "X"], u, c, 10, 10),
      }),
      star: (u, c) => ({ w: 17, h: 17, svg: chart(STAR, u, c, 1000, 1000) }),
    },
    liu: {
      band: (u, c) => {
        let s = line([[0, 0.5], [8, 0.5]], u, c) + line([[0, 8.5], [8, 8.5]], u, c);
        s += line([[1, 8.5], [1, 2], [7, 2], [7, 7], [3, 7], [3, 4], [5, 4], [5, 5]], u, c);
        return { w: 8, h: 9, svg: s };
      },
      thin: (u, c) => {
        let s = line([[0, 0.5], [6, 0.5]], u, c) + line([[0, 6.5], [6, 6.5]], u, c);
        s += line([[1, 6.5], [1, 2], [5, 2], [5, 5], [3, 5], [3, 3.5]], u, c);
        return { w: 6, h: 7, svg: s };
      },
      tile: (u, c) => {
        let s = line([[0, 0], [8, 0]], u, c) + line([[0, 0], [0, 8]], u, c);
        s += line([[2, 2], [6, 2], [6, 6], [2, 6]], u, c, true);
        s += line([[4, 0], [4, 2]], u, c) + line([[4, 6], [4, 8]], u, c);
        s += line([[0, 4], [2, 4]], u, c) + line([[6, 4], [8, 4]], u, c);
        s += pip(4, 4, u, c, 1.3);
        for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) s += pip(x, y, u, c, 1.3);
        return { w: 8, h: 8, svg: s };
      },
    },
    zes: {
      band: (u, c) => {
        const t = MOTIFS.zes.tile(u, c);
        const s = t.svg + line([[0, 0.15], [8, 0.15]], u, c) + line([[0, 7.85], [8, 7.85]], u, c);
        return { w: 8, h: 8, svg: s };
      },
      thin: (u, c) => {
        let s = line([[0, 0.5], [6, 0.5]], u, c, false, 0.6) + line([[0, 5.5], [6, 5.5]], u, c, false, 0.6);
        s += arc(3, 3, 1.5, 0, 2 * Math.PI - 0.001, u, c) + pip(3, 3, u, c);
        s += pip(0, 3, u, c, 0.8) + pip(6, 3, u, c, 0.8);
        return { w: 6, h: 6, svg: s };
      },
      tile: (u, c) => {
        let s = line([[0, 0], [8, 0]], u, c, false, 0.5) + line([[0, 0], [0, 8]], u, c, false, 0.5);
        for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
          s += arc(x, y, 2, 0, 2 * Math.PI - 0.001, u, c) + pip(x, y, u, c);
        }
        s += arc(4, 4, 2, 0, 2 * Math.PI - 0.001, u, c) + pip(4, 4, u, c, 1.2);
        for (const [x, y] of [[4, 1], [4, 7], [1, 4], [7, 4]]) s += pip(x, y, u, c);
        for (const [x, y] of [[2.5, 2.5], [5.5, 2.5], [2.5, 5.5], [5.5, 5.5]]) s += pip(x, y, u, c, 0.7);
        return { w: 8, h: 8, svg: s };
      },
    },
    ono: {
      band: (u, c) => {
        let s = line([[0, 0.5], [4, 0.5]], u, c) + line([[0, 8.5], [4, 8.5]], u, c);
        s += poly([[0, 1.5], [4, 1.5], [2, 3.5]], u, c);
        s += poly([[2, 7.5], [6, 7.5], [4, 5.5]], u, c) + poly([[-2, 7.5], [2, 7.5], [0, 5.5]], u, c);
        s += pip(1, 4.5, u, c, 0.8) + pip(3, 4.5, u, c, 0.8);
        return { w: 4, h: 9, svg: s };
      },
      thin: (u, c) => {
        let s = line([[0, 0.5], [4, 0.5]], u, c) + line([[0, 6.5], [4, 6.5]], u, c);
        s += poly([[0, 5.5], [4, 5.5], [2, 1.5]], u, c);
        return { w: 4, h: 7, svg: s };
      },
      tile: (u, c) => {
        let s = MOTIFS.ono.band(u, c).svg;
        return { w: 4, h: 9, svg: s };
      },
    },
    suqta: {
      band: (u, c) => {
        let s = line([[0, 0.5], [8, 0.5]], u, c) + line([[0, 10.5], [8, 10.5]], u, c);
        s += line(steppedDiamond(4, 5.5, 4), u, c, true);
        s += poly(steppedDiamond(4, 5.5, 2), u, c);
        s += pip(4, 5.5, u, COLORS.wool);
        s += poly([[-1, 1.5], [1, 1.5], [0, 2.5]], u, c) + poly([[7, 1.5], [9, 1.5], [8, 2.5]], u, c);
        s += poly([[-1, 9.5], [1, 9.5], [0, 8.5]], u, c) + poly([[7, 9.5], [9, 9.5], [8, 8.5]], u, c);
        return { w: 8, h: 11, svg: s };
      },
      thin: (u, c) => {
        let s = line([[0, 0.5], [4, 0.5]], u, c) + line([[0, 6.5], [4, 6.5]], u, c);
        s += line([[0, 5], [0, 4], [1, 4], [1, 3], [2, 3], [2, 2], [3, 2], [3, 3], [4, 3]], u, c);
        return { w: 4, h: 7, svg: s };
      },
      tile: (u, c) => {
        let s = line(steppedDiamond(4, 4, 4), u, c, true) + poly(steppedDiamond(4, 4, 2), u, c) + pip(4, 4, u, COLORS.wool);
        for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) s += pip(x, y, u, c);
        return { w: 8, h: 8, svg: s };
      },
    },
    shesh: {
      band: (u, c) => {
        let s = line([[0, 0.25], [8, 0.25]], u, c) + line([[0, 8.75], [8, 8.75]], u, c);
        s += line(starPts(4, 4.5), u, c, true);
        s += pip(4, 4.5, u, c, 1.3);
        s += pip(0, 1.25, u, c) + pip(8, 1.25, u, c) + pip(0, 7.75, u, c) + pip(8, 7.75, u, c);
        return { w: 8, h: 9, svg: s };
      },
      thin: (u, c) => {
        let s = line([[0, 0.5], [6, 0.5]], u, c) + line([[0, 6.5], [6, 6.5]], u, c);
        s += poly([[3, 1.5], [3.75, 2.75], [5, 3.5], [3.75, 4.25], [3, 5.5], [2.25, 4.25], [1, 3.5], [2.25, 2.75]], u, c);
        return { w: 6, h: 7, svg: s };
      },
      tile: (u, c) => {
        let s = "";
        for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) s += line(starPts(x, y), u, c, true) + pip(x, y, u, c, 1.3);
        s += pip(4, 4, u, c);
        for (const [x, y] of [[4, 1.5], [4, 6.5], [1.5, 4], [6.5, 4]]) s += pip(x, y, u, c, 0.7);
        return { w: 8, h: 8, svg: s };
      },
    },
  };

  let uid = 0;

  // A rectangle filled with a motif. kind: band | thin | tile.
  // The tile is stretched slightly so that a whole number of repeats fits.
  function fill(game, kind, x, y, w, h, u, color, { rotate = 0, fit = true, bg = null } = {}) {
    const m = MOTIFS[game][kind](u, color);
    const along = rotate ? h : w;
    let sx = 1;
    if (fit) {
      const n = Math.max(1, Math.round(along / (m.w * u)));
      sx = along / (n * m.w * u);
    }
    const id = `p${++uid}`;
    const pw = m.w * u * sx, ph = m.h * u;
    let tr = `translate(${f(x)} ${f(y)})`;
    if (rotate === 90) tr = `translate(${f(x + w)} ${f(y)}) rotate(90)`;
    if (rotate === -90) tr = `translate(${f(x)} ${f(y + h)}) rotate(-90)`;
    if (rotate === 180) tr = `translate(${f(x + w)} ${f(y + h)}) rotate(180)`;
    return `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${f(pw)}" height="${f(ph)}" patternTransform="${tr}">` +
      `<g transform="scale(${sx.toFixed(4)} 1)">${m.svg}</g></pattern></defs>` +
      (bg ? `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${bg}"/>` : "") +
      `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="url(#${id})"/>`;
  }

  // A frame of four bands around a rectangle, with square corners.
  // The band runs with its "top" facing outward on every side.
  function frame(game, kind, x, y, w, h, u, color, corner, bg = null) {
    const m = MOTIFS[game][kind](u, color);
    const t = m.h * u;
    let s = "";
    if (bg) s += `<path d="M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z M${f(x + t)} ${f(y + t)}v${f(h - 2 * t)}h${f(w - 2 * t)}v${f(-h + 2 * t)}Z" fill="${bg}" fill-rule="evenodd"/>`;
    s += fill(game, kind, x + t, y, w - 2 * t, t, u, color);
    s += fill(game, kind, x + t, y + h - t, w - 2 * t, t, u, color, { rotate: 180 });
    s += fill(game, kind, x, y + t, t, h - 2 * t, u, color, { rotate: -90 });
    s += fill(game, kind, x + w - t, y + t, t, h - 2 * t, u, color, { rotate: 90 });
    for (const [cx, cy] of [[x, y], [x + w - t, y], [x, y + h - t], [x + w - t, y + h - t]]) {
      s += corner ? corner(cx, cy, t) : "";
    }
    return { svg: s, thickness: t };
  }

  // Corner square shared by every game: the six face, with the game's pip.
  function cornerFace(gameIndex, color, ink) {
    return (x, y, t) => face6(x + t / 2, y + t / 2, t * 0.78, gameIndex, color, ink);
  }

  // The collection mark: a six face. Pip i (0..5) belongs to game i.
  // Order: left column top to bottom, then right column top to bottom.
  function face6(cx, cy, size, highlight, color, ink = COLORS.ink, { colors = null, outline = true } = {}) {
    const d = size * 0.25, r = size * 0.095;
    const pos = [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]];
    let s = outline ? `<rect x="${f(cx - size / 2)}" y="${f(cy - size / 2)}" width="${f(size)}" height="${f(size)}" rx="${f(size * 0.16)}" fill="none" stroke="${ink}" stroke-width="${f(Math.max(1, size * 0.045))}"/>` : "";
    pos.forEach(([dx, dy], i) => {
      let fillc = ink;
      if (colors) fillc = colors[i];
      else if (highlight !== null && highlight !== undefined) fillc = i === highlight ? color : "none";
      const st = fillc === "none" ? ` stroke="${ink}" stroke-width="${f(Math.max(0.8, size * 0.03))}"` : "";
      s += `<circle cx="${f(cx + dx)}" cy="${f(cy + dy)}" r="${f(r)}" fill="${fillc}"${st}/>`;
    });
    return s;
  }

  // --- Dice ---------------------------------------------------------------
  const PIPS = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
  };

  // Gradients used by dice; include once per SVG.
  function diceDefs(p = "") {
    return `<defs>
      <linearGradient id="${p}dw" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#F1EDE4"/><stop offset="1" stop-color="#CFC7B8"/></linearGradient>
      <linearGradient id="${p}dwt" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F3EFE7"/></linearGradient>
      <linearGradient id="${p}db" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4A4540"/><stop offset="0.5" stop-color="#2A2622"/><stop offset="1" stop-color="#0E0C0B"/></linearGradient>
      <linearGradient id="${p}dbt" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3A3531"/><stop offset="1" stop-color="#211E1B"/></linearGradient>
      <radialGradient id="${p}pw" cx="0.6" cy="0.62" r="0.7">
        <stop offset="0" stop-color="#4A4540"/><stop offset="1" stop-color="#14120F"/></radialGradient>
      <radialGradient id="${p}pb" cx="0.6" cy="0.62" r="0.7">
        <stop offset="0" stop-color="#C9C2B4"/><stop offset="1" stop-color="#FAF7F0"/></radialGradient>
      <filter id="${p}sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
      <filter id="${p}shl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter>
    </defs>`;
  }

  // A die seen from above: body with rounded edges, a flat top face, pips.
  function die(cx, cy, s, value, side, { lifted = false, p = "", flat = false } = {}) {
    const white = side === "w";
    const r = s * 0.17, half = s / 2;
    let out = "";
    if (!flat) {
      const off = lifted ? s * 0.12 : s * 0.05;
      out += `<rect x="${f(cx - half + off * 0.6)}" y="${f(cy - half + off)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="#000" opacity="${lifted ? 0.3 : 0.32}" filter="url(#${p}${lifted ? "shl" : "sh"})"/>`;
    }
    if (flat) {
      out += `<rect x="${f(cx - half)}" y="${f(cy - half)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="${white ? "#fff" : "#000"}" stroke="#000" stroke-width="${f(s * 0.04)}"/>`;
    } else {
      out += `<rect x="${f(cx - half)}" y="${f(cy - half)}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="url(#${p}${white ? "dw" : "db"})" stroke="${white ? "#9C9282" : "#000"}" stroke-width="${f(s * 0.02)}"/>`;
      const i = s * 0.09;
      out += `<rect x="${f(cx - half + i)}" y="${f(cy - half + i)}" width="${f(s - 2 * i)}" height="${f(s - 2 * i)}" rx="${f(r * 0.7)}" fill="url(#${p}${white ? "dwt" : "dbt"})"/>`;
    }
    const d = s * 0.26, pr = s * 0.085;
    for (const [dx, dy] of PIPS[value]) {
      const fillc = flat ? (white ? "#000" : "#fff") : `url(#${p}${white ? "pw" : "pb"})`;
      out += `<circle cx="${f(cx + dx * d)}" cy="${f(cy + dy * d)}" r="${f(pr)}" fill="${fillc}"/>`;
    }
    return out;
  }

  function dieSVG(value, side, size, opts = {}) {
    const pad = size * 0.25;
    const p = `d${++uid}`;
    return `<svg width="${f(size + pad)}" height="${f(size + pad)}" viewBox="0 0 ${f(size + pad)} ${f(size + pad)}" aria-hidden="true">${diceDefs(p)}${die(size / 2 + pad * 0.3, size / 2 + pad * 0.3, size, value, side, { ...opts, p })}</svg>`;
  }

  return { COLORS, GAMES, MOTIFS, fill, frame, face6, cornerFace, die, dieSVG, diceDefs, pip, chart, f };
})();
