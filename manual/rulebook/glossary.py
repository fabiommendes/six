"""Glossaries: one per game, parsed from regras/<game>/GLOSSARY.md.

Format (defined in each file): one `## Term` heading per term, a definition
paragraph, and optional lines `en: term` (English term), `Ver também: A, B`
(related terms) and `Não usar: x, y` (forbidden synonyms). Text before the
first `##` is for rule writers and is not published. `en` and `Não usar` lines
are not published either; `Não usar` lines feed the terminology checks
(`forbidden_patterns`). Terms whose definition still contains open or
unconfirmed markers are skipped with a warning, so they never reach the
published output. Status notes (`> **Playtest:**` and the other labels of
markers.py) are dropped from definitions.

A word may be a game term in one game and a forbidden synonym in another, so
every check takes the glossary of one game. Term anchors carry the game id
(`seks-captura`), because two games may define the same term.
"""

import re
from dataclasses import dataclass, field

from . import markers, paths
from .markdown_sections import sections, slugify, split_frontmatter

LIST_LINE_RE = re.compile(r"^(?P<key>en|Ver também|Não usar):\s*(?P<items>.+?)\s*\.?\s*$", re.MULTILINE)
VOWELS = "aeiouáéíóúâêôãõà"

Patterns = list[tuple[re.Pattern, str, str]]


@dataclass
class Term:
    game: str
    name: str
    slug: str
    definition: str
    see_also: list[str] = field(default_factory=list)
    avoid: list[str] = field(default_factory=list)

    @property
    def anchor(self) -> str:
        return f"{self.game}-{self.slug}"


@dataclass
class Glossary:
    game: str
    terms: dict[str, Term]
    warnings: list[str]
    # Forbidden synonyms of every term, including skipped ones: word -> term.
    forbidden: dict[str, str] = field(default_factory=dict)

    def find(self, name: str) -> Term | None:
        return self.terms.get(slugify(name))


@dataclass
class Glossaries:
    by_game: dict[str, Glossary]

    @property
    def warnings(self) -> list[str]:
        return [w for g in self.by_game.values() for w in g.warnings]

    def find(self, game: str | None, name: str) -> Term | None:
        """`name` in `game`'s glossary; `jogo:Termo` picks the game explicitly."""
        if ":" in name:
            game, name = name.split(":", 1)
        glossary = self.by_game.get(game or "")
        return glossary.find(name) if glossary else None

    def patterns(self, game: str | None) -> Patterns:
        glossary = self.by_game.get(game or "")
        return forbidden_patterns(glossary) if glossary else []


def inflections(word: str) -> list[str]:
    """The word and its Portuguese plural(s): território -> territórios."""
    lower = word.lower()
    forms = {lower}
    if lower.endswith("ão"):
        forms |= {lower[:-2] + "ões", lower[:-2] + "ães", lower + "s"}
    elif lower.endswith("m"):
        forms.add(lower[:-1] + "ns")
    elif lower.endswith("l"):
        forms.add(lower[:-1] + "is")
    elif lower[-1] in "rzs":
        forms.add(lower + "es")
    elif lower[-1] in VOWELS:
        forms.add(lower + "s")
    return sorted(forms, key=len, reverse=True)


def forbidden_patterns(glossary: Glossary) -> Patterns:
    """(pattern, forbidden word, term to use) for each `Não usar` entry.

    Whole words, case-insensitive, singular and plural.
    """
    result = []
    for word, term in sorted(glossary.forbidden.items()):
        alternatives = "|".join(re.escape(form) for form in inflections(word))
        pattern = re.compile(rf"(?<![\w-])(?:{alternatives})(?![\w-])", re.IGNORECASE)
        result.append((pattern, word, term))
    return result


def find_forbidden(text: str, patterns: Patterns) -> list[tuple[int, str]]:
    """(line number, message) for each forbidden synonym in `text`."""
    found = []
    for number, line in enumerate(text.splitlines(), start=1):
        for pattern, word, term in patterns:
            for match in pattern.finditer(line):
                found.append((number, f"forbidden synonym '{match.group(0)}' (glossary: use '{term}', not '{word}')"))
    return found


def load_game(game: str) -> Glossary:
    file = paths.glossary_file(game)
    if not file.is_file():
        return Glossary(game, {}, [f"glossary: regras/{game}/ has no GLOSSARY.md"])
    _, body = split_frontmatter(file.read_text(encoding="utf-8"))
    terms: dict[str, Term] = {}
    forbidden: dict[str, str] = {}
    warnings = []
    where = f"glossary {game}"
    for slug, section in sections(body).items():
        if section.level != 2:
            continue
        text = section.text.split("\n", 1)[1] if "\n" in section.text else ""
        lists = {"en": [], "Ver também": [], "Não usar": []}
        for match in LIST_LINE_RE.finditer(text):
            lists[match["key"]] = [item.strip() for item in match["items"].split(",") if item.strip()]
        definition = markers.strip_notes(LIST_LINE_RE.sub("", text)).strip()
        for word in lists["Não usar"]:
            forbidden[word.lower()] = section.title
        if markers.OPEN_RE.search(definition):
            warnings.append(f"{where}: '{section.title}' skipped: marked open or unconfirmed")
            continue
        if not definition:
            warnings.append(f"{where}: '{section.title}' skipped: empty definition")
            continue
        terms[slug] = Term(game, section.title, slug, definition, lists["Ver também"], lists["Não usar"])
    for term in terms.values():
        for name in term.see_also:
            if slugify(name) not in terms:
                warnings.append(f"{where}: '{term.name}': 'Ver também' term '{name}' not found")
    return Glossary(game, terms, warnings, forbidden)


def load() -> Glossaries:
    return Glossaries({game: load_game(game) for game in paths.games()})
