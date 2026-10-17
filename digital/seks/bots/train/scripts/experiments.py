"""Run grids of experiments with `seks-bots` and print one short line each.

The long output of the batches goes to files under the grid's output
directory; only the summary reaches the terminal, so an agent can run large
grids without reading the batch logs.

    uv run experiments.py run GRID.json [--only NAME] [--dry-run]
    uv run experiments.py log RUN_DIR

A grid file (paths relative to `digital/seks/bots/`):

    {
      "name": "nodes",
      "defaults": {"openings": "openings/base.txt", "threads": 10},
      "experiments": [
        {"name": "vs-random", "kind": "batch",
         "bots": ["ab:nodes={nodes}", "random"], "grid": {"nodes": [5000, 20000]}},
        {"name": "tune", "kind": "tune", "data": ["train/runs/a/gen-001/data.bin"],
         "init": "weights/hand.json", "grid": {"lambda": [0.3, 0.7]},
         "gate": {"bot": "ab:nodes=5000", "games": 400}},
        {"name": "base", "kind": "train", "config": "train/base.json"}
      ]
    }

Kinds:

- `batch`: `seks-bots batch` between `bots[0]` (A) and `bots[1]` (B).
  Keys: `bots`, `openings`, `games`, `seed`, `threads`, `max_plies`.
- `selfplay`: `seks-bots selfplay`. Keys: `bot`, `openings`, `games`,
  `seed`, `threads`, `noise`, `noise_plies`, `max_plies`.
- `tune`: `seks-bots tune`, then, with `gate`, a batch of the tuned weights
  against `init`. Keys: `data` (list), `init`, `lambda`, `epochs`, `lr`,
  `l2`, `patience`, `threads`, `gate` (`bot`, `games`, `openings`).
- `train`: `seks-bots train` on `config`; prints the line of each
  generation of its `log.csv`.

`grid` maps keys to lists of values: the experiment runs once per
combination, and `{key}` in any string value is replaced by the value.
Results go to `train/runs/experiments/<grid name>/<experiment>/`.
"""

from __future__ import annotations

import argparse
import csv
import itertools
import json
import subprocess
import sys
from pathlib import Path

BOTS_DIR = Path(__file__).resolve().parents[2]
BINARY = BOTS_DIR.parents[1] / "target" / "release" / "seks-bots"


def build() -> None:
    """Builds the release binary, quietly."""
    subprocess.run(
        ["cargo", "build", "--release", "--quiet", "-p", "seks-bots"],
        cwd=BOTS_DIR,
        check=True,
    )


def substitute(value, params: dict):
    """`value` with `{key}` replaced by the grid values, recursively."""
    if isinstance(value, str):
        return value.format(**params) if params else value
    if isinstance(value, list):
        return [substitute(item, params) for item in value]
    if isinstance(value, dict):
        return {key: substitute(item, params) for key, item in value.items()}
    return value


def expand(experiment: dict, defaults: dict) -> list[tuple[str, dict]]:
    """One `(name, settings)` per combination of the experiment's grid."""
    grid = experiment.get("grid", {})
    keys = sorted(grid)
    runs = []
    for values in itertools.product(*(grid[key] for key in keys)):
        params = dict(zip(keys, values))
        settings = {**defaults, **experiment, **params}
        settings.pop("grid", None)
        settings = substitute(settings, {k: v for k, v in params.items()})
        suffix = "-".join(f"{key}={value}" for key, value in params.items())
        name = experiment["name"] + (f"-{suffix}" if suffix else "")
        runs.append((name, settings))
    return runs


def flags(settings: dict, names: dict[str, str]) -> list[str]:
    """`--flag value` for each settings key in `names` that is present."""
    out = []
    for key, flag in names.items():
        if key in settings:
            out += [flag, str(settings[key])]
    return out


def call(args: list[str], log: Path) -> None:
    """Runs `seks-bots args`, with stdout and stderr to `log`."""
    with log.open("w") as file:
        result = subprocess.run(
            [str(BINARY), *args], cwd=BOTS_DIR, stdout=file, stderr=subprocess.STDOUT
        )
    if result.returncode != 0:
        tail = log.read_text().strip().splitlines()[-3:]
        raise RuntimeError(f"seks-bots {args[0]} failed: {' | '.join(tail)}")


def elo(value: float | None, score: float) -> str:
    """An Elo difference; JSON has no infinity, so a sweep comes as null."""
    if value is None:
        return "+inf" if score > 0.5 else "-inf"
    return f"{value:+.0f}"


def batch_line(summary: dict) -> str:
    """The short line of a batch summary."""
    a, b = summary["bots"]
    ends = ", ".join(f"{end} {n}" for end, n in summary["ends"].items())
    score = summary["score"]
    return (
        f"{a} vs {b}: +{summary['wins']} ={summary['draws']} -{summary['losses']}, "
        f"Elo {elo(summary['elo'], score)} "
        f"[{elo(summary['elo_low'], score)}, {elo(summary['elo_high'], score)}], "
        f"A wins {100 * summary['win_rate'][0]:.1f}% "
        f"[{100 * summary['win_rate_low'][0]:.1f}, {100 * summary['win_rate_high'][0]:.1f}], "
        f"ends: {ends}; A {summary['ms_per_move'][0]:.0f} ms/move "
        f"(max {summary['max_ms'][0]:.0f}), {summary['nodes_per_move'][0]:.0f} nodes/move"
    )


def run_batch(settings: dict, out: Path) -> str:
    bots = settings["bots"]
    args = ["batch", "--bots", f"{bots[0]},{bots[1]}"]
    args += flags(
        settings,
        {
            "openings": "--openings",
            "games": "--games",
            "seed": "--seed",
            "threads": "--threads",
            "max_plies": "--max-plies",
        },
    )
    args += ["--out", str(out / "games.jsonl"), "--summary", str(out / "summary.json")]
    call(args, out / "batch.log")
    return batch_line(json.loads((out / "summary.json").read_text()))


def run_selfplay(settings: dict, out: Path) -> str:
    args = ["selfplay", "--out", str(out / "data.bin")]
    args += flags(
        settings,
        {
            "bot": "--bot",
            "openings": "--openings",
            "games": "--games",
            "seed": "--seed",
            "threads": "--threads",
            "noise": "--noise",
            "noise_plies": "--noise-plies",
            "max_plies": "--max-plies",
        },
    )
    call(args, out / "selfplay.log")
    return (out / "selfplay.log").read_text().strip().splitlines()[-1]


def run_tune(settings: dict, out: Path) -> str:
    weights = out / "weights.json"
    args = ["tune", "--out", str(weights)]
    for data in settings["data"]:
        args += ["--data", data]
    args += flags(
        settings,
        {
            "init": "--init",
            "lambda": "--lambda",
            "epochs": "--epochs",
            "lr": "--lr",
            "l2": "--l2",
            "patience": "--patience",
            "threads": "--threads",
        },
    )
    call(args, out / "tune.log")
    meta = json.loads(weights.read_text())["meta"]
    line = (
        f"loss validation {meta['validation_loss_before']:.5f} -> "
        f"{meta['validation_loss']:.5f} (step {meta['best_epoch']}, "
        f"{meta['train_samples']} train positions)"
    )
    gate = settings.get("gate")
    if gate:
        bot = gate["bot"]
        sep = "," if ":" in bot else ":"
        gate_settings = {
            "bots": [f"{bot}{sep}weights=@{weights}", f"{bot}{sep}weights=@{settings['init']}"],
            "openings": gate.get("openings", settings.get("openings")),
            "games": gate.get("games"),
            "threads": settings.get("threads"),
        }
        gate_settings = {k: v for k, v in gate_settings.items() if v is not None}
        line += "; gate " + run_batch(gate_settings, out)
    return line


def run_train(settings: dict, out: Path) -> str:
    call(["train", settings["config"]], out / "train.log")
    config = json.loads((BOTS_DIR / settings["config"]).read_text())
    run_dir = BOTS_DIR / config.get("out", "train/runs") / config["name"]
    return log_lines(run_dir)


def log_lines(run_dir: Path) -> str:
    """One line per generation of a training run's `log.csv`."""
    lines = []
    with (run_dir / "log.csv").open() as file:
        for row in csv.DictReader(file):
            lines.append(
                f"gen {row['generation']}: {row['samples']} positions, validation loss "
                f"{float(row['validation_loss_before']):.5f} -> "
                f"{float(row['validation_loss']):.5f}, Elo {float(row['elo']):+.0f} "
                f"[{float(row['elo_low']):+.0f}, {float(row['elo_high']):+.0f}], "
                f"draws {row['draws']}, mirror draws {row.get('mirror_draws', '-')}, "
                f"{'promoted' if row['promoted'] == 'true' else 'kept'}, "
                f"{float(row['seconds']):.0f} s"
            )
    state = json.loads((run_dir / "state.json").read_text())
    lines.append(f"current weights: {state['current']}")
    return "\n  ".join(lines)


KINDS = {"batch": run_batch, "selfplay": run_selfplay, "tune": run_tune, "train": run_train}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="run a grid of experiments")
    run.add_argument("grid", type=Path)
    run.add_argument("--only", help="run only the experiments whose name starts with this")
    run.add_argument("--dry-run", action="store_true", help="list the runs and stop")
    log = sub.add_parser("log", help="summarize a training run")
    log.add_argument("run_dir", type=Path)
    args = parser.parse_args()

    if args.command == "log":
        print(log_lines(args.run_dir))
        return 0

    grid = json.loads(args.grid.read_text())
    root = BOTS_DIR / "train" / "runs" / "experiments" / grid["name"]
    runs = [
        run
        for experiment in grid["experiments"]
        for run in expand(experiment, grid.get("defaults", {}))
        if not args.only or run[0].startswith(args.only)
    ]
    if args.dry_run:
        for name, settings in runs:
            print(name, json.dumps(settings))
        return 0
    build()
    failed = 0
    for name, settings in runs:
        out = root / name
        out.mkdir(parents=True, exist_ok=True)
        (out / "settings.json").write_text(json.dumps(settings, indent=2))
        try:
            print(f"{name}: {KINDS[settings['kind']](settings, out)}", flush=True)
        except (RuntimeError, KeyError) as error:
            failed += 1
            print(f"{name}: FAILED: {error}", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
