"""Turn a chapter's markdown into HTML shared by the site and the PDF.

Steps, in order:

1. ```tabuleiro and ```diagrama blocks become SVG figures (see diagrams.py).
2. The body is rendered as a Jinja template, so chapters can call helpers
   such as {{ glossario("seks") }}.
3. [[Termo]], [[Termo|texto]] and [[jogo:Termo]] become links to the
   glossary. Without `jogo:`, the term comes from the chapter's game.
4. Emoji and :shortcodes: become words (simbolos.yaml).
5. Markdown -> HTML.

Links between chapters are written as `slug.md#anchor` in the sources and
rewritten per target by `site_links` and `print_links`.

The text of a game is wrapped in `<!--jogo:ID-->` ... `<!--/jogo-->` marks in
the output, so the lint checks it against that game's forbidden synonyms.
"""

import html
import re
import textwrap
from dataclasses import dataclass
from types import SimpleNamespace

import jinja2
import markdown
from markdown.extensions.toc import TocExtension
from markupsafe import Markup

from . import diagrams, markers, paths
from .chapters import Chapter
from .glossary import Glossaries, find_forbidden
from .markdown_sections import slugify
from .symbols import SymbolTable, forbidden_chars

DIAGRAM_RE = re.compile(
    r"^(?P<indent>[ \t]*)```(?:tabuleiro|diagrama)[ \t]*\n(?P<body>.*?)^(?P=indent)```[ \t]*$",
    re.MULTILINE | re.DOTALL,
)
TERM_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
JINJA_COMMENT_RE = re.compile(r"\{#.*?#\}", re.DOTALL)
BLOCK_TOKEN = "RULEBOOKBLOCK{}X"
BLOCK_RE = re.compile(r"(?:<p>)?RULEBOOKBLOCK(\d+)X(?:</p>)?")
CHAPTER_LINK_RE = re.compile(r'href="([a-z0-9-]+)\.md(?:#([^"]*))?"')
ID_RE = re.compile(r'\sid="([^"]+)"')
LOCAL_LINK_RE = re.compile(r'href="#([^"]+)"')
# Text that must never be published (checked in sources here and in output by lint).
UNPUBLISHABLE_RE = markers.UNPUBLISHABLE_RE
GLOSSARY_SLUG = "glossario"


def game_open(game: str | None) -> Markup:
    return Markup(f"<!--jogo:{game}-->" if game else "")


def game_close(game: str | None) -> Markup:
    return Markup("<!--/jogo-->" if game else "")


class BuildError(Exception):
    def __init__(self, messages: list[str]):
        super().__init__("\n".join(messages))
        self.messages = messages


@dataclass
class Rendered:
    chapter: Chapter
    html: str
    toc: list[tuple[str, str]]


def template_env() -> jinja2.Environment:
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(paths.TEMPLATES),
        autoescape=jinja2.select_autoescape(["html"]),
        undefined=jinja2.StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.globals.update(game_open=game_open, game_close=game_close)
    return env


class ContentRenderer:
    def __init__(self, symbols: SymbolTable, glossaries: Glossaries):
        self.symbols = symbols
        self.glossaries = glossaries
        self.env = template_env()
        self._blocks: list[str] = []

    # -- helpers available inside chapter sources --------------------------

    def _block(self, template: str, **context) -> str:
        self._blocks.append(self.env.get_template(template).render(**context))
        return "\n\n" + BLOCK_TOKEN.format(len(self._blocks) - 1) + "\n\n"

    def helpers(self) -> dict:
        def glossario(game: str) -> str:
            glossary = self.glossaries.by_game.get(game)
            if glossary is None:
                raise jinja2.TemplateRuntimeError(f"glossario: no game '{game}' in regras/")
            terms = [
                SimpleNamespace(
                    name=term.name,
                    anchor=term.anchor,
                    see_also=term.see_also,
                    html=Markup(markdown.markdown(self.symbols.replace(term.definition))),
                )
                for term in sorted(glossary.terms.values(), key=lambda t: t.slug)
            ]
            return self._block(
                "partials/glossary.html", game=game, terms=terms, find=lambda name: glossary.find(name)
            )

        return {"glossario": glossario}

    # -- pipeline -------------------------------------------------------------

    def render(self, chapter: Chapter) -> Rendered:
        self._blocks = []
        errors: list[str] = []
        body = chapter.body

        # Author notes in {# ... #} are dropped by Jinja, so they may mention open points.
        visible = JINJA_COMMENT_RE.sub(lambda m: "\n" * m.group(0).count("\n"), body)
        for number, line in enumerate(visible.splitlines(), start=1):
            for message in UNPUBLISHABLE_RE.findall(line):
                errors.append(f"{chapter.rel}:{number}: unpublishable text '{message}'")
        for number, message in find_forbidden(visible, self.glossaries.patterns(chapter.game)):
            errors.append(f"{chapter.rel}:{number}: {message}")

        def diagram(match: re.Match) -> str:
            source = textwrap.dedent(match["body"])
            try:
                self._blocks.append(diagrams.render(source))
            except diagrams.DiagramError as error:
                errors.append(f"{chapter.rel}: diagram: {error}")
                return ""
            # Keep the indentation so a diagram inside an admonition stays inside it.
            return match["indent"] + BLOCK_TOKEN.format(len(self._blocks) - 1)

        body = DIAGRAM_RE.sub(diagram, body)
        try:
            body = self.env.from_string(body).render(**self.helpers())
        except jinja2.TemplateError as error:
            raise BuildError([f"{chapter.rel}: template error: {error}"]) from error

        def term(match: re.Match) -> str:
            found = self.glossaries.find(chapter.game, match.group(1))
            if not found:
                errors.append(f"{chapter.rel}: [[{match.group(1)}]] is not a glossary term of '{chapter.game}'")
                return match.group(0)
            label = html.escape(match.group(2) or match.group(1).split(":")[-1])
            return f'<a class="termo" href="{GLOSSARY_SLUG}.md#{found.anchor}">{label}</a>'

        body = TERM_RE.sub(term, body)
        body = self.symbols.replace(body)
        for number, description in forbidden_chars(body):
            errors.append(
                f"{chapter.rel}:~{number}: unmapped symbol {description} "
                "(add it to simbolos.yaml or write it as a word)"
            )
        if errors:
            raise BuildError(errors)

        md = markdown.Markdown(
            extensions=[
                "tables",
                "attr_list",
                "admonition",
                "md_in_html",
                "sane_lists",
                "smarty",
                TocExtension(slugify=slugify, toc_depth="2-3"),
            ],
            extension_configs={"smarty": {"smart_angled_quotes": False}},
            output_format="html",
        )
        out = md.convert(body)
        out = BLOCK_RE.sub(lambda m: self._blocks[int(m.group(1))], out)
        toc = [(token["id"], token["name"]) for token in md.toc_tokens]
        return Rendered(chapter, out, toc)


def site_links(text: str, known: set[str]) -> str:
    """`slug.md#x` -> `slug.html#x`, failing on links to unpublished chapters."""

    def link(match: re.Match) -> str:
        slug, anchor = match.group(1), match.group(2)
        if slug not in known:
            raise BuildError([f"link to '{slug}.md', which is not a published chapter"])
        return f'href="{slug}.html{"#" + anchor if anchor else ""}"'

    return CHAPTER_LINK_RE.sub(link, text)


def print_links(text: str, slug: str, known: set[str]) -> str:
    """Single-document form: ids and anchors are prefixed with the chapter slug."""
    text = ID_RE.sub(lambda m: f' id="{slug}--{m.group(1)}"', text)
    text = LOCAL_LINK_RE.sub(lambda m: f'href="#{slug}--{m.group(1)}"', text)

    def link(match: re.Match) -> str:
        target, anchor = match.group(1), match.group(2)
        if target not in known:
            raise BuildError([f"link to '{target}.md', which is not a published chapter"])
        return f'href="#{target}--{anchor}"' if anchor else f'href="#{target}"'

    return CHAPTER_LINK_RE.sub(link, text)
