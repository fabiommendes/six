"""Manual chapters: hand-written markdown in capitulos/ with YAML frontmatter.

File names are `NN-slug.md` for chapters and `AN-slug.md` for appendices; the
slug becomes the page name on the site. Frontmatter keys (Portuguese, because
authors write them):

    titulo:    chapter title (required)
    jogo:      id of the game the chapter is about (a folder of regras/);
               `[[Termo]]` links and forbidden synonyms use its glossary
    jogadores: player count shown on the landing page, e.g. "2"
    fonte:     list of regras/ references the whole chapter is based on;
               `[]` means the chapter has no rules source (e.g. credits)
    secoes:    per-section sources, keyed by heading slug:
                 {captura: {fonte: [regras/seks/04-captura.md]}}
    rascunho:  true to leave the chapter out of the published build
    resumo:    one-line description for the table of contents (optional)
    digital:   folder of the digital version in the published site, e.g.
               "seks/"; the landing page links to it (optional)

Every section must be covered: by `fonte`, or by an entry in `secoes` for
each `##` section when there is no chapter-level `fonte`.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path

from . import paths
from .markdown_sections import sections, split_frontmatter
from .sources import SourceError, SourceRef

FILENAME_RE = re.compile(r"^(?P<number>\d\d|A\d)-(?P<slug>[a-z0-9-]+)\.md$")
KNOWN_KEYS = {"titulo", "jogo", "jogadores", "fonte", "secoes", "rascunho", "resumo", "digital"}


@dataclass
class Chapter:
    path: Path
    number: str
    slug: str
    title: str
    body: str
    summary: str = ""
    game: str | None = None
    players: str = ""
    digital: str = ""
    draft: bool = False
    sources: list[SourceRef] | None = None
    section_sources: dict[str, list[SourceRef]] = field(default_factory=dict)
    # Position among the chapters (or appendices) in this build, from 1. File
    # numbers only set the order, so leaving a draft out does not leave a gap.
    ordinal: int = 0

    @property
    def appendix(self) -> bool:
        return self.number.startswith("A")

    @property
    def label(self) -> str:
        """'Capítulo 4' / 'Apêndice A', numbered among the chapters being published."""
        if self.appendix:
            return f"Apêndice {chr(ord('A') + self.ordinal - 1)}"
        return f"Capítulo {self.ordinal}"

    @property
    def rel(self) -> str:
        """Id used in the lock file and in messages: capitulos/03-seks.md."""
        return self.path.relative_to(paths.MANUAL).as_posix()

    def consumers(self) -> list[tuple[str, list[SourceRef]]]:
        """(consumer id, sources) pairs checked by `sync-check`."""
        found = []
        if self.sources:
            found.append((self.rel, self.sources))
        for slug, refs in self.section_sources.items():
            found.append((f"{self.rel}#{slug}", refs))
        return found

    def validate(self) -> list[str]:
        errors = []
        if self.game is not None and self.game not in paths.games():
            errors.append(f"{self.rel}: jogo '{self.game}' has no folder in regras/")
        own = sections(self.body)
        for slug in self.section_sources:
            if slug not in own:
                errors.append(f"{self.rel}: secoes.{slug}: no heading with that slug")
        if self.sources is None:
            if not self.section_sources:
                errors.append(f"{self.rel}: declare `fonte:` (or `fonte: []`) or `secoes:`")
            for slug, section in own.items():
                if section.level == 2 and slug not in self.section_sources:
                    errors.append(f"{self.rel}: section '{slug}' has no `fonte`")
        for _, refs in self.consumers():
            for ref in refs:
                try:
                    ref.text()
                except SourceError as error:
                    errors.append(f"{self.rel}: {error}")
        return errors


def _refs(value, where: str) -> list[SourceRef]:
    if not isinstance(value, list):
        raise ValueError(f"{where}: `fonte` must be a list")
    return [SourceRef.parse(item) for item in value]


def load(path: Path) -> Chapter:
    match = FILENAME_RE.match(path.name)
    if not match:
        raise ValueError(f"{path.name}: chapter files are named NN-slug.md or AN-slug.md")
    meta, body = split_frontmatter(path.read_text(encoding="utf-8"))
    unknown = set(meta) - KNOWN_KEYS
    if unknown:
        raise ValueError(f"{path.name}: unknown frontmatter keys {sorted(unknown)}")
    if "titulo" not in meta:
        raise ValueError(f"{path.name}: missing `titulo`")
    section_sources = {
        slug: _refs((spec or {}).get("fonte"), f"{path.name}: secoes.{slug}")
        for slug, spec in (meta.get("secoes") or {}).items()
    }
    return Chapter(
        path=path,
        number=match["number"],
        slug=match["slug"],
        title=meta["titulo"],
        summary=meta.get("resumo", ""),
        game=meta.get("jogo"),
        players=str(meta.get("jogadores", "")),
        digital=meta.get("digital", ""),
        body=body,
        draft=bool(meta.get("rascunho", False)),
        sources=_refs(meta["fonte"], path.name) if "fonte" in meta else None,
        section_sources=section_sources,
    )


def load_all(include_drafts: bool = True) -> list[Chapter]:
    """Chapters sorted so that numbered chapters come before appendices."""
    chapters = [load(path) for path in sorted(paths.CHAPTERS.glob("*.md"))]
    chapters.sort(key=lambda c: (c.appendix, c.number))
    chapters = [c for c in chapters if include_drafts or not c.draft]
    for appendix in (False, True):
        for ordinal, chapter in enumerate((c for c in chapters if c.appendix == appendix), start=1):
            chapter.ordinal = ordinal
    return chapters
