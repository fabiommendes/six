"""Build the site (build/site/) and the PDF (build/manual.pdf) from one set of sources."""

import datetime
import shutil
from dataclasses import dataclass

from markupsafe import Markup

from . import assets, chapters, glossary, palette, paths
from .chapters import Chapter
from .render import BuildError, ContentRenderer, Rendered, print_links, site_links, template_env
from .sources import head_commit
from .symbols import SymbolTable


@dataclass
class Edition:
    """Build stamp shown in the footers and on the back cover."""

    date: str
    commit: str | None
    draft: bool

    @classmethod
    def now(cls, draft: bool) -> "Edition":
        today = datetime.date.today().strftime("%d/%m/%Y")
        return cls(today, head_commit(), draft)


def render_chapters(include_drafts: bool) -> tuple[list[Rendered], list[str]]:
    """Validate and render every published chapter. Returns (chapters, warnings)."""
    # Drafts are validated too, so their `fonte:` stays correct while they wait.
    errors = [error for chapter in chapters.load_all(include_drafts=True) for error in chapter.validate()]
    errors += palette.check_styles()
    if errors:
        raise BuildError(errors)
    published = chapters.load_all(include_drafts=include_drafts)
    glossaries = glossary.load()
    renderer = ContentRenderer(SymbolTable.load(), glossaries)
    rendered, errors = [], []
    for chapter in published:
        try:
            rendered.append(renderer.render(chapter))
        except BuildError as error:
            errors.extend(error.messages)
    if errors:
        raise BuildError(errors)
    return rendered, glossaries.warnings


def games(rendered: list[Rendered]) -> list[Chapter]:
    """The first chapter of each game, in book order, for the landing page."""
    seen: dict[str, Chapter] = {}
    for item in rendered:
        if item.chapter.game and item.chapter.game not in seen:
            seen[item.chapter.game] = item.chapter
    return list(seen.values())


def build_site(rendered: list[Rendered], edition: Edition) -> None:
    env = template_env()
    known = {r.chapter.slug for r in rendered}
    nav = [(r.chapter, r.toc) for r in rendered]
    common = {"nav": nav, "edition": edition}

    # The site root is the landing page of the collection; the manual starts at manual.html.
    landing = env.get_template("site/landing.html").render(games=games(rendered), edition=edition)
    (paths.SITE / "index.html").write_text(landing, encoding="utf-8")
    home = env.get_template("site/manual.html").render(page=None, **common)
    (paths.SITE / "manual.html").write_text(home, encoding="utf-8")
    for position, item in enumerate(rendered):
        previous = rendered[position - 1].chapter if position > 0 else None
        following = rendered[position + 1].chapter if position + 1 < len(rendered) else None
        page = env.get_template("site/chapter.html").render(
            page=item.chapter,
            body=Markup(site_links(item.html, known)),
            toc=item.toc,
            previous=previous,
            following=following,
            **common,
        )
        (paths.SITE / f"{item.chapter.slug}.html").write_text(page, encoding="utf-8")


def build_pdf(rendered: list[Rendered], edition: Edition) -> None:
    from weasyprint import HTML  # slow import; only needed here

    env = template_env()
    known = {r.chapter.slug for r in rendered}
    sections = [(r.chapter, Markup(print_links(r.html, r.chapter.slug, known))) for r in rendered]
    document = env.get_template("print/manual.html").render(sections=sections, edition=edition)
    paths.PRINT_HTML.parent.mkdir(parents=True, exist_ok=True)
    # Saved for inspection and for the lint; <base> makes it open correctly from build/print/.
    paths.PRINT_HTML.write_text(document.replace("<head>", '<head>\n<base href="../site/">', 1), encoding="utf-8")
    HTML(string=document, base_url=str(paths.SITE) + "/").write_pdf(paths.PDF)
    shutil.copy2(paths.PDF, paths.SITE / "manual.pdf")


def build(include_drafts: bool = False, pdf: bool = True) -> list[str]:
    """Full build. Returns warnings; raises BuildError on errors."""
    rendered, warnings = render_chapters(include_drafts)
    if paths.SITE.exists():
        for html_file in paths.SITE.glob("*.html"):
            html_file.unlink()
    paths.SITE.mkdir(parents=True, exist_ok=True)
    assets.build()
    edition = Edition.now(draft=include_drafts)
    build_site(rendered, edition)
    if pdf:
        build_pdf(rendered, edition)
    else:
        # A PDF from an earlier build would no longer match the site.
        for stale in (paths.PDF, paths.PRINT_HTML, paths.SITE / "manual.pdf"):
            stale.unlink(missing_ok=True)
    return warnings
