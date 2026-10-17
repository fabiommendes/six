"""References from the manual to sections of `regras/` (`fonte:` entries).

A reference is a repo-relative path with an optional heading anchor:

    regras/seks/03-turno.md             whole file (frontmatter excluded)
    regras/seks/03-turno.md#mover       one section, including subsections
    regras/seks/GLOSSARY.md             a game's glossary, also part of the rules
"""

import hashlib
import subprocess
from dataclasses import dataclass

from . import paths
from .markdown_sections import normalize, sections, split_frontmatter


class SourceError(Exception):
    pass


@dataclass(frozen=True)
class SourceRef:
    path: str
    anchor: str | None = None

    @classmethod
    def parse(cls, ref: str) -> "SourceRef":
        path, _, anchor = str(ref).partition("#")
        return cls(path.strip(), anchor.strip() or None)

    def __str__(self) -> str:
        return f"{self.path}#{self.anchor}" if self.anchor else self.path

    def text(self, file_text: str | None = None) -> str:
        """Current text of the referenced section (or `file_text`'s version of it)."""
        if file_text is None:
            file = paths.REPO / self.path
            if not self.path.startswith("regras/") or not file.is_file():
                raise SourceError(f"{self}: file not found under regras/")
            file_text = file.read_text(encoding="utf-8")
        _, body = split_frontmatter(file_text)
        if self.anchor is None:
            return body
        found = sections(body)
        if self.anchor not in found:
            known = ", ".join(sorted(found))
            raise SourceError(f"{self}: no section '{self.anchor}' (known: {known})")
        return found[self.anchor].text

    def fingerprint(self) -> str:
        return fingerprint(self.text())

    def text_at(self, commit: str) -> str | None:
        """Section text as of `commit`, or None if unavailable."""
        old = git("show", f"{commit}:{self.path}")
        if old is None:
            return None
        try:
            return self.text(old)
        except SourceError:
            return None


def fingerprint(text: str) -> str:
    return "sha256:" + hashlib.sha256(normalize(text).encode()).hexdigest()[:16]


def git(*args: str) -> str | None:
    """Output of a git command run in the repo, or None if it fails."""
    try:
        done = subprocess.run(
            ["git", "-C", str(paths.REPO), *args],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return done.stdout


def head_commit() -> str | None:
    out = git("rev-parse", "--short=12", "HEAD")
    return out.strip() if out else None


def is_committed(path: str) -> bool:
    """True if `path` has no uncommitted changes (so HEAD holds its current text)."""
    out = git("status", "--porcelain", "--", path)
    return out is not None and out.strip() == ""
