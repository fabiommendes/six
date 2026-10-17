"""Markdown helpers shared by rules sources and manual chapters.

Sections are addressed by the slug of their heading. A section runs from its
heading to the next heading of the same or a higher level, so it includes its
subsections.
"""

import re
import unicodedata
from dataclasses import dataclass

import yaml

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
EXPLICIT_ID_RE = re.compile(r"\s*\{:?\s*#([\w-]+)\s*\}\s*$")
FENCE_RE = re.compile(r"^(```|~~~)")


def slugify(text: str, separator: str = "-") -> str:
    """ASCII slug: 'Peças, líderes, QGs e bases' -> 'pecas-lideres-qgs-e-bases'."""
    text = re.sub(r"[*_`]", "", text)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-zA-Z0-9]+", separator, text.lower())
    return text.strip(separator)


def split_frontmatter(text: str) -> tuple[dict, str]:
    """Return (frontmatter, body). Files without frontmatter get {}."""
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("unterminated YAML frontmatter")
    meta = yaml.safe_load(text[4:end]) or {}
    return meta, text[end + 5 :]


@dataclass
class Section:
    slug: str
    title: str
    level: int
    text: str


def headings(body: str) -> list[tuple[int, int, str]]:
    """(line index, level, title) of every heading outside fenced code."""
    found = []
    in_fence = False
    for index, line in enumerate(body.splitlines()):
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        match = None if in_fence else HEADING_RE.match(line)
        if match:
            found.append((index, len(match.group(1)), match.group(2)))
    return found


def sections(body: str) -> dict[str, Section]:
    """All sections of a markdown body, keyed by unique slug."""
    lines = body.splitlines()
    marks = headings(body)
    result: dict[str, Section] = {}
    for position, (start, level, title) in enumerate(marks):
        end = len(lines)
        for next_start, next_level, _ in marks[position + 1 :]:
            if next_level <= level:
                end = next_start
                break
        # `## Title {#id}` (attr_list syntax) sets the slug explicitly.
        explicit = EXPLICIT_ID_RE.search(title)
        if explicit:
            title = title[: explicit.start()]
        slug = base = explicit.group(1) if explicit else slugify(title)
        suffix = 1
        while slug in result:
            suffix += 1
            slug = f"{base}-{suffix}"
        result[slug] = Section(slug, title, level, "\n".join(lines[start:end]))
    return result


def normalize(text: str) -> str:
    """Whitespace-insensitive form used for fingerprints (reflowing is not a change)."""
    return " ".join(text.split())
