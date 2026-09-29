import argparse
from collections.abc import Sequence

from .app import App
from .themes import DEFAULT_THEME, THEMES


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """
    Parse the command line arguments of the ``seks`` command.

    The ``theme`` attribute of the result holds the selected Theme object.
    """
    parser = argparse.ArgumentParser(
        prog="seks",
        description="Seks: an abstract strategy game played with dice.",
    )
    parser.add_argument(
        "--theme",
        choices=list(THEMES),
        default=DEFAULT_THEME,
        metavar="NAME",
        help=f"color theme: {', '.join(THEMES)} (default: %(default)s)",
    )
    args = parser.parse_args(argv)
    args.theme = THEMES[args.theme]
    return args


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    app = App(theme=args.theme)
    app.run()


if __name__ == "__main__":
    main()
