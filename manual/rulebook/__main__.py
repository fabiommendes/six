"""Command line: python -m rulebook {build,lint,sync-check,sync-mark,serve}.

Run from manual/ (the Makefile does this for you).
"""

import argparse
import functools
import http.server
import sys

from . import lint, paths, sync
from .render import BuildError


def cmd_build(args: argparse.Namespace) -> int:
    from .build import build

    try:
        warnings = build(include_drafts=args.drafts, pdf=not args.no_pdf)
    except BuildError as error:
        print("Build failed:", file=sys.stderr)
        for message in error.messages:
            print(f"  {message}", file=sys.stderr)
        return 1
    for warning in warnings:
        print(f"warning: {warning}")
    print(f"site: {paths.SITE}")
    if not args.no_pdf:
        print(f"pdf:  {paths.PDF}")
    return 0 if args.no_lint else cmd_lint(args)


def cmd_lint(_args: argparse.Namespace) -> int:
    findings, notes = lint.run()
    for note in notes:
        print(f"lint: {note}")
    for finding in findings:
        print(f"LINT {finding}", file=sys.stderr)
    if findings:
        print(f"lint: FAILED with {len(findings)} problem(s)", file=sys.stderr)
        return 1
    print("lint: ok")
    return 0


def cmd_sync_check(args: argparse.Namespace) -> int:
    if args.coverage:
        return sync.coverage()
    return sync.check(show_diff=args.diff)


def cmd_sync_mark(args: argparse.Namespace) -> int:
    if not args.all and not args.targets:
        print("Give consumer ids (see sync-check) or --all.", file=sys.stderr)
        return 2
    return sync.mark(args.targets, everything=args.all)


def cmd_serve(args: argparse.Namespace) -> int:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(paths.SITE))
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Serving {paths.SITE} at http://127.0.0.1:{args.port}/")
        server.serve_forever()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m rulebook", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    build = commands.add_parser("build", help="build site and PDF, then lint the output")
    build.add_argument("--drafts", action="store_true", help="include chapters marked `rascunho: true`")
    build.add_argument("--no-pdf", action="store_true", help="skip the PDF (faster)")
    build.add_argument("--no-lint", action="store_true", help="skip the output lint")
    build.set_defaults(func=cmd_build)

    commands.add_parser("lint", help="check the built output").set_defaults(func=cmd_lint)

    check = commands.add_parser("sync-check", help="list manual text whose regras/ sources changed")
    check.add_argument("--diff", action="store_true", help="show what changed in each source")
    check.add_argument("--coverage", action="store_true", help="list regras/ sections no manual text uses")
    check.set_defaults(func=cmd_sync_check)

    mark = commands.add_parser("sync-mark", help="record that manual text was reviewed against its sources")
    mark.add_argument("targets", nargs="*", help="consumer ids, e.g. capitulos/03-seks.md#captura")
    mark.add_argument("--all", action="store_true", help="mark every consumer")
    mark.set_defaults(func=cmd_sync_mark)

    serve = commands.add_parser("serve", help="serve build/site/ locally")
    serve.add_argument("--port", type=int, default=8000)
    serve.set_defaults(func=cmd_serve)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
