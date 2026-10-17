"""Filesystem layout of the manual and of the repo parts it reads."""

from pathlib import Path

MANUAL = Path(__file__).resolve().parent.parent
REPO = MANUAL.parent

# Inputs owned by other parts of the repo (read only).
REGRAS = REPO / "regras"

# Manual sources.
CHAPTERS = MANUAL / "capitulos"
TEMPLATES = MANUAL / "templates"
STYLES = MANUAL / "styles"
SYMBOLS_FILE = MANUAL / "simbolos.yaml"
LOCK_FILE = MANUAL / "fontes.lock.yaml"

# Generated output.
BUILD = MANUAL / "build"
SITE = BUILD / "site"
ASSETS = SITE / "assets"
PRINT_HTML = BUILD / "print" / "manual.html"
PDF = BUILD / "manual.pdf"


def games() -> list[str]:
    """Ids of the games that have rules: the folder names under regras/."""
    return sorted(path.name for path in REGRAS.iterdir() if path.is_dir())


def glossary_file(game: str) -> Path:
    return REGRAS / game / "GLOSSARY.md"


def repo_relative(path: Path) -> str:
    """Path as written in `fonte:` references and in the lock file."""
    return path.resolve().relative_to(REPO).as_posix()
