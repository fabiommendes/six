# Contributing to Seks

Thanks for your interest in improving Seks! Bug reports, rule suggestions and
pull requests are all welcome.

## Setting up

You need [uv](https://docs.astral.sh/uv/). Clone the repository and install
the development environment:

```bash
git clone https://github.com/fabiommendes/seks.git
cd seks
uv sync
```

Run the game from the source tree with `uv run seks`.

## Tasks

Common commands are defined as [taskipy](https://github.com/taskipy/taskipy)
tasks in `pyproject.toml`. Run them with `uv run task <name>`:

| Task          | What it does                                                    |
|---------------|-----------------------------------------------------------------|
| `run`         | Start the game.                                                 |
| `test`        | Run the test suite with coverage.                               |
| `format`      | Format the code and apply safe lint fixes.                      |
| `lint`        | Check formatting, lint with ruff and type check with mypy.      |
| `docs`        | Build the documentation with doc-zero (needs Python 3.13+).     |
| `screenshots` | Play a scripted game and regenerate the README screenshots.     |
| `ci`          | Run `lint`, `test` and `docs`, like the CI pipeline.            |
| `release`     | Run `ci`, build the package and check the distribution files.   |

`task screenshots` opens a window. On a headless machine, run it with
`xvfb-run -a uv run task screenshots`.

## Guidelines

* Everything public in the repository (code, comments, docstrings, docs,
  commit messages, issues and pull requests) is written in English.
* Keep game logic (`seks/grid.py`, `seks/types.py`) free of drawing code, so it
  stays easy to test without a display.
* Add tests for rule changes and bug fixes, and update the rules manual in the
  README when the rules change.
* Run `uv run task ci` before opening a pull request.

## Releasing

1. Update the version in `pyproject.toml` and add an entry to `CHANGELOG.md`.
2. Run `uv run task release`.
3. Commit, create a tag named `v<version>` and push it. The release workflow
   publishes the package to PyPI.
