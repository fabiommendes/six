"""The colors of the manual, in one place.

Provisional and neutral until the visual identity is decided
(dev/rfc/identidade-visual.md). The diagrams (diagrams.py) and the
stylesheets take their colors from here. The build writes them as CSS custom
properties to assets/css/cores.css, which common.css imports. WeasyPrint does
not resolve var() in page margin boxes, so print.css spells some colors out;
`check_styles` fails the build on any color literal in styles/ that is not
listed here.
"""

import re

from . import paths

# CSS name (used as --name) -> hex.
COLORS = {
    "tinta": "#1f1d1a",
    "tinta-suave": "#5c5850",
    "papel": "#fbf9f4",
    "papel-escuro": "#efebe1",
    "linha": "#c8c2b4",
    "branco": "#ffffff",
    "destaque": "#c2410c",
    "rascunho": "#f0bf36",
    # Board diagrams.
    "tabuleiro": "#ece4d2",
    "tabuleiro-linha": "#b9ad94",
    "dado-branco": "#ffffff",
    "dado-preto": "#2a2723",
}

HEX_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGB_RE = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)")


def hex_color(name: str) -> str:
    return COLORS[name]


def css() -> str:
    lines = [f"  --{name}: {value};" for name, value in COLORS.items()]
    return "/* Generated from rulebook/palette.py. Do not edit. */\n:root {\n" + "\n".join(lines) + "\n}\n"


def _expand(value: str) -> str:
    value = value.lower()
    if len(value) == 4:  # #abc
        value = "#" + "".join(c * 2 for c in value[1:])
    return value[:7]


def check_styles() -> list[str]:
    """Color literals in styles/*.css that are not in the palette."""
    known = {value.lower() for value in COLORS.values()}
    errors = []
    for sheet in sorted(paths.STYLES.glob("*.css")):
        for number, line in enumerate(sheet.read_text(encoding="utf-8").splitlines(), start=1):
            found = [_expand(v) for v in HEX_RE.findall(line)]
            found += ["#%02x%02x%02x" % tuple(int(n) for n in m) for m in RGB_RE.findall(line)]
            for value in found:
                if value not in known:
                    errors.append(f"{sheet.relative_to(paths.MANUAL)}:{number}: color {value} is not in rulebook/palette.py")
    return errors
