"""Board diagrams: ```tabuleiro blocks in the chapters become SVG figures.

A block has option lines, then one line per row of the board, top row
first, with one token per cell separated by spaces:

    ```tabuleiro
    legenda: As Brancas capturam o 2 preto.
    seta: 4,2 -> 2,2
    . . . . .
    . . B3 . .
    . . P2x . .
    . o B3* . .
    ```

Cell tokens:

    .        empty cell
    o        empty cell, highlighted (a cell a die may reach)
    B1..B6   white die with that value
    P1..P6   black die with that value
    suffix * highlighted die (the die that moves)
    suffix x captured die (drawn faded and crossed out)

Options:

    legenda: text   caption below the figure (markdown is not parsed)
    seta: r,c -> r,c  an arrow between two cells; row and column from 1, top left
    titulo: text    accessible title of the SVG (defaults to the caption)

The dice are drawn with pips, as the physical dice of the kit.
"""

import html
import re
from dataclasses import dataclass, field

from . import palette

CELL = 40
DIE = 30
MARGIN = 6
PIPS = {
    1: [(0, 0)],
    2: [(-1, -1), (1, 1)],
    3: [(-1, -1), (0, 0), (1, 1)],
    4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
    5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
    6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)],
}
TOKEN_RE = re.compile(r"^(?:(?P<empty>\.)|(?P<target>o)|(?P<side>[BP])(?P<value>[1-6])(?P<marks>[*x]*))$")
OPTION_RE = re.compile(r"^(?P<key>legenda|seta|titulo):\s*(?P<value>.*)$")
ARROW_RE = re.compile(r"^(\d+)\s*,\s*(\d+)\s*->\s*(\d+)\s*,\s*(\d+)$")


class DiagramError(ValueError):
    pass


@dataclass
class Cell:
    side: str | None = None  # "B" or "P"
    value: int = 0
    target: bool = False
    highlight: bool = False
    captured: bool = False


@dataclass
class Board:
    rows: list[list[Cell]]
    caption: str = ""
    title: str = ""
    arrows: list[tuple[int, int, int, int]] = field(default_factory=list)


def parse(source: str) -> Board:
    rows: list[list[Cell]] = []
    options: dict[str, str] = {}
    arrows = []
    for number, line in enumerate(source.strip().splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        option = OPTION_RE.match(line)
        if option and not rows:
            if option["key"] == "seta":
                found = ARROW_RE.match(option["value"].strip())
                if not found:
                    raise DiagramError(f"line {number}: arrow must be 'r,c -> r,c', got {option['value']!r}")
                arrows.append(tuple(int(n) for n in found.groups()))
            else:
                options[option["key"]] = option["value"].strip()
            continue
        row = []
        for token in line.split():
            match = TOKEN_RE.match(token)
            if not match:
                raise DiagramError(f"line {number}: unknown cell {token!r}")
            if match["side"]:
                marks = match["marks"]
                row.append(Cell(match["side"], int(match["value"]), highlight="*" in marks, captured="x" in marks))
            else:
                row.append(Cell(target=bool(match["target"])))
        rows.append(row)
    if not rows:
        raise DiagramError("no board rows")
    width = len(rows[0])
    if any(len(row) != width for row in rows):
        raise DiagramError("every row needs the same number of cells")
    for r1, c1, r2, c2 in arrows:
        for r, c in ((r1, c1), (r2, c2)):
            if not (1 <= r <= len(rows) and 1 <= c <= width):
                raise DiagramError(f"arrow cell {r},{c} is outside the board")
    caption = options.get("legenda", "")
    return Board(rows, caption, options.get("titulo", caption), arrows)


def _center(row: int, column: int) -> tuple[float, float]:
    return MARGIN + (column - 1) * CELL + CELL / 2, MARGIN + (row - 1) * CELL + CELL / 2


def _die(cell: Cell, cx: float, cy: float) -> str:
    color = palette.hex_color
    fill, ink = (color("dado-branco"), color("dado-preto")) if cell.side == "B" else (color("dado-preto"), color("dado-branco"))
    half = DIE / 2
    step = DIE * 0.27
    faded = ' opacity="0.35"' if cell.captured else ""
    parts = [
        f'<g class="dado"{faded}>',
        f'<rect x="{cx - half:.1f}" y="{cy - half:.1f}" width="{DIE}" height="{DIE}" rx="5" '
        f'fill="{fill}" stroke="{color("dado-preto")}" stroke-width="1.5"/>',
    ]
    for dx, dy in PIPS[cell.value]:
        parts.append(f'<circle cx="{cx + dx * step:.1f}" cy="{cy + dy * step:.1f}" r="2.9" fill="{ink}"/>')
    parts.append("</g>")
    if cell.captured:
        d = half + 3
        stroke = f'stroke="{color("destaque")}" stroke-width="3" stroke-linecap="round"'
        parts.append(f'<line x1="{cx - d:.1f}" y1="{cy - d:.1f}" x2="{cx + d:.1f}" y2="{cy + d:.1f}" {stroke}/>')
        parts.append(f'<line x1="{cx - d:.1f}" y1="{cy + d:.1f}" x2="{cx + d:.1f}" y2="{cy - d:.1f}" {stroke}/>')
    return "".join(parts)


def _arrow(r1: int, c1: int, r2: int, c2: int) -> str:
    x1, y1 = _center(r1, c1)
    x2, y2 = _center(r2, c2)
    length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 or 1
    ux, uy = (x2 - x1) / length, (y2 - y1) / length
    # Start and end at the edge of the dice, not at their centers.
    trim = DIE / 2 + 2
    x1, y1, x2, y2 = x1 + ux * trim, y1 + uy * trim, x2 - ux * trim, y2 - uy * trim
    # The head is a triangle drawn in place: SVG markers need ids, and the
    # print build renames ids.
    head, wing = 10, 6
    bx, by = x2 - ux * head, y2 - uy * head
    points = f"{x2:.1f},{y2:.1f} {bx - uy * wing:.1f},{by + ux * wing:.1f} {bx + uy * wing:.1f},{by - ux * wing:.1f}"
    color = palette.hex_color("destaque")
    return (
        f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{bx:.1f}" y2="{by:.1f}" stroke="{color}" '
        'stroke-width="3" stroke-linecap="round"/>'
        f'<polygon points="{points}" fill="{color}"/>'
    )


def svg(board: Board) -> str:
    color = palette.hex_color
    rows, columns = len(board.rows), len(board.rows[0])
    width, height = 2 * MARGIN + columns * CELL, 2 * MARGIN + rows * CELL
    parts = [
        f'<svg class="diagrama__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img">',
        f"<title>{html.escape(board.title or 'Tabuleiro')}</title>",
        f'<rect x="0" y="0" width="{width}" height="{height}" rx="6" fill="{color("tabuleiro")}"/>',
    ]
    for r, row in enumerate(board.rows, start=1):
        for c, cell in enumerate(row, start=1):
            x, y = MARGIN + (c - 1) * CELL, MARGIN + (r - 1) * CELL
            parts.append(
                f'<rect x="{x}" y="{y}" width="{CELL}" height="{CELL}" fill="none" '
                f'stroke="{color("tabuleiro-linha")}" stroke-width="1"/>'
            )
            if cell.target or cell.highlight:
                dashed = ' stroke-dasharray="4 3"' if cell.target else ""
                parts.append(
                    f'<rect x="{x + 3}" y="{y + 3}" width="{CELL - 6}" height="{CELL - 6}" rx="4" fill="none" '
                    f'stroke="{color("destaque")}" stroke-width="2.5"'
                    f"{dashed}/>"
                )
    for r, row in enumerate(board.rows, start=1):
        for c, cell in enumerate(row, start=1):
            if cell.side:
                parts.append(_die(cell, *_center(r, c)))
    parts += [_arrow(*arrow) for arrow in board.arrows]
    parts.append("</svg>")
    return "".join(parts)


def render(source: str) -> str:
    """The <figure> of one ```tabuleiro block."""
    board = parse(source)
    caption = f"<figcaption>{html.escape(board.caption)}</figcaption>" if board.caption else ""
    return f'<figure class="diagrama">{svg(board)}{caption}</figure>'
