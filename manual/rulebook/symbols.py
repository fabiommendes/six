"""Internal symbols (emoji shorthand from regras/) and their published form.

`simbolos.yaml` is the single mapping. Authors may write an emoji or a `:id:`
shortcode; the build turns both into the plain word of the entry. Anything
pictographic left afterwards is an error.
"""

import html
import re
import unicodedata
from dataclasses import dataclass

import yaml

from . import paths

# Characters that must never reach published output: emoji and pictographic
# blocks, geometric shapes, variation selectors, joiners and private use.
FORBIDDEN_CHARS_RE = re.compile(
    "["
    "\U0001f000-\U0001faff"  # emoji, playing cards, regional indicators, pictographs
    "⌀-⏿"  # miscellaneous technical (hourglass, watch, ...)
    "■-◿"  # geometric shapes
    "☀-➿"  # miscellaneous symbols and dingbats (die faces U+2680-2685 too)
    "⬀-⯿"  # miscellaneous symbols and arrows (large squares, stars)
    "︎️‍⃣"  # variation selectors, zero-width joiner, keycap
    "-"  # private use area
    "]"
)
SHORTCODE_RE = re.compile(r":([a-z][a-z0-9-]*):")


@dataclass
class Symbol:
    id: str
    nome: str
    emoji: list[str]

    def html(self) -> str:
        return html.escape(self.nome)


class SymbolTable:
    def __init__(self, entries: list[Symbol]):
        self.by_id = {entry.id: entry for entry in entries}
        self.by_emoji = {e: entry for entry in entries for e in entry.emoji}
        emoji = sorted(self.by_emoji, key=len, reverse=True)
        pattern = "|".join(re.escape(e) + "️?" for e in emoji) or "(?!)"
        self._emoji_re = re.compile(pattern)

    @classmethod
    def load(cls) -> "SymbolTable":
        data = yaml.safe_load(paths.SYMBOLS_FILE.read_text(encoding="utf-8")) or {}
        entries = [
            Symbol(id=item["id"], nome=item["nome"], emoji=list(item.get("emoji") or []))
            for item in data.get("simbolos") or []
        ]
        return cls(entries)

    def replace(self, text: str) -> str:
        """Replace mapped emoji and known :shortcodes: with their HTML."""

        def emoji(match: re.Match) -> str:
            return self.by_emoji[match.group(0).rstrip("️")].html()

        def shortcode(match: re.Match) -> str:
            entry = self.by_id.get(match.group(1))
            return entry.html() if entry else match.group(0)

        text = self._emoji_re.sub(emoji, text)
        return SHORTCODE_RE.sub(shortcode, text)


def forbidden_chars(text: str) -> list[tuple[int, str]]:
    """(line number, description) of every forbidden character in `text`."""
    found = []
    for number, line in enumerate(text.splitlines(), start=1):
        for char in FORBIDDEN_CHARS_RE.findall(line):
            name = unicodedata.name(char, "UNNAMED")
            found.append((number, f"U+{ord(char):04X} {char} {name}"))
    return found
