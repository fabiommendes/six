"""Status labels of regras/ and what the manual does with each.

regras/README.md defines the labels. An open point is written inline as
`**(aberto: question)**`; every other status note is a blockquote that starts
with a bold label, e.g. `> **Playtest:** the value may change`.

| Label        | Manual                                                      |
|--------------|-------------------------------------------------------------|
| (aberto      | never published; a chapter or glossary term with it fails   |
| Playtest     | the rule is published, the note is not                      |
| Proposta     | the rule is published; `sync-check` warns for review        |
| Ideia futura | never published                                             |
| Detalhe      | not published by itself (FAQ material)                      |
| Design       | never published                                             |
"""

import re

LABELS = ["Playtest", "Proposta", "Ideia futura", "Detalhe", "Design"]

# Text that must never reach the manual: open points, draft notes, and the
# note labels themselves (a label in the output means a note leaked).
UNPUBLISHABLE_RE = re.compile(
    r"\(aberto|precisa de confirma|\?\?"
    r"|(?-i:\bTODO\b|\bFIXME\b)"
    rf"|(?-i:\b(?:{'|'.join(map(re.escape, LABELS))}):)",
    re.IGNORECASE,
)
OPEN_RE = re.compile(r"\(aberto|precisa de confirma", re.IGNORECASE)
# A status note: a blockquote paragraph whose first line starts with a label.
NOTE_RE = re.compile(
    rf"^> \*\*(?P<label>{'|'.join(map(re.escape, LABELS))}):\*\*.*(?:\n>.*)*",
    re.MULTILINE,
)


def notes(text: str) -> list[str]:
    """Labels of the status notes in `text`, in order."""
    return [match["label"] for match in NOTE_RE.finditer(text)]


def strip_notes(text: str) -> str:
    """`text` without its status notes (for regras text published as is, like the glossary)."""
    return NOTE_RE.sub("", text)
