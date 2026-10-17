"""Checks on the published output (build/site/*.html, the print HTML and the PDF).

Fails on:
- any emoji or pictographic symbol (see symbols.FORBIDDEN_CHARS_RE);
- unpublishable text: "(aberto", "precisa de confirmação", TODO, and the
  status labels of regras/ (see markers.py), which mean a note leaked;
- forbidden synonyms from a game's `Não usar:` lines (singular and plural,
  any case), checked in the text between that game's `<!--jogo:ID-->` marks;
- leaks of the derivation model: links to .md files, `regras/` paths and
  frontmatter keys.

The PDF text has no game marks, so it is checked for everything except the
synonyms, which the print HTML already covers.
"""

import html
import re
import shutil
import subprocess
from dataclasses import dataclass

from . import glossary, paths
from .markers import UNPUBLISHABLE_RE
from .symbols import forbidden_chars

STYLE_SCRIPT_RE = re.compile(r"<(style|script)\b.*?</\1>", re.DOTALL | re.IGNORECASE)
GAME_RE = re.compile(r"<!--jogo:([a-z0-9-]+)-->(.*?)<!--/jogo-->", re.DOTALL)
LEAK_RE = re.compile(
    r'href="[^"#]*\.md\b|\bregras/|^\s*(titulo|jogo|jogadores|fonte|secoes|rascunho):',
    re.MULTILINE,
)


@dataclass
class Finding:
    where: str
    line: int
    message: str

    def __str__(self) -> str:
        return f"{self.where}:{self.line}: {self.message}"


def check_text(text: str, where: str) -> list[Finding]:
    findings = [Finding(where, line, f"forbidden symbol {what}") for line, what in forbidden_chars(text)]
    for number, line in enumerate(text.splitlines(), start=1):
        for match in UNPUBLISHABLE_RE.finditer(line):
            findings.append(Finding(where, number, f"unpublishable text '{match.group(0)}'"))
        for match in LEAK_RE.finditer(line):
            findings.append(Finding(where, number, f"internal reference '{match.group(0).strip()}'"))
    return findings


def check_synonyms(text: str, where: str, glossaries: glossary.Glossaries) -> list[Finding]:
    """Forbidden synonyms inside each game's marks, with line numbers of the whole text."""
    findings = []
    for match in GAME_RE.finditer(text):
        offset = text.count("\n", 0, match.start(2))
        found = glossary.find_forbidden(match.group(2), glossaries.patterns(match.group(1)))
        findings += [Finding(where, offset + line, message) for line, message in found]
    return findings


def check_html(text: str, where: str, glossaries: glossary.Glossaries) -> list[Finding]:
    # Blank out <style>/<script> but keep their newlines so line numbers stay right.
    text = STYLE_SCRIPT_RE.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    text = html.unescape(text)
    return check_text(text, where) + check_synonyms(text, where, glossaries)


def pdf_text() -> str | None:
    if not shutil.which("pdftotext"):
        return None
    done = subprocess.run(
        ["pdftotext", "-enc", "UTF-8", str(paths.PDF), "-"],
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    return done.stdout


def run() -> tuple[list[Finding], list[str]]:
    """(findings, notes). Findings mean failure."""
    findings, notes = [], []
    glossaries = glossary.load()
    pages = sorted(paths.SITE.glob("*.html"))
    if not pages:
        return [Finding(str(paths.SITE), 0, "no HTML found; run the build first")], notes
    for page in pages:
        where = page.relative_to(paths.MANUAL).as_posix()
        findings += check_html(page.read_text(encoding="utf-8"), where, glossaries)
    notes.append(f"checked {len(pages)} site pages")
    if paths.PRINT_HTML.exists():
        where = paths.PRINT_HTML.relative_to(paths.MANUAL).as_posix()
        findings += check_html(paths.PRINT_HTML.read_text(encoding="utf-8"), where, glossaries)
        notes.append("checked print HTML")
    if paths.PDF.exists():
        text = pdf_text()
        if text is None:
            notes.append("pdftotext not found: PDF checked through its print HTML only")
        else:
            findings += check_text(text, paths.PDF.relative_to(paths.MANUAL).as_posix())
            notes.append("checked PDF text")
    return findings, notes
