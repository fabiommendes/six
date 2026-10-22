#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["cma", "numpy"]
# ///
"""Tunes the evaluation weights of a Sia bot with CMA-ES.

    uv run digital/sia/bots/tune/tune.py CONFIG.json

Each candidate (a vector of weights) plays one `sia-bots batch` against the
opponent; its fitness is its mean share of the win over those games. Every
candidate of a generation plays the same deals, and each generation plays
new ones. Rerunning the same command resumes from the last finished
generation. `flags` in the config are passed on to `sia-bots batch` (the rule
variants, e.g. `["--stone-only-sequences"]`). The config format is in `example.json`; adapted from the tuner
of the Rio (`~/git/games/rio/digital/tools/tune.py`).

Output directory:

- `log.csv`: generation, candidate, fitness, one column per weight.
- `best.json`: the bot with the mean of the CMA-ES distribution after the
  last finished generation, a bot file for `sia-bots batch --bots
  @best.json`. The mean is less noisy than the best candidate.
- `state.pkl`: the CMA-ES state, for resuming.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import pickle
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import cma

BOTS = Path(__file__).resolve().parent.parent
DIGITAL = BOTS.parent.parent


@dataclass(frozen=True)
class Weight:
    """A free weight: its initial value and its bounds."""

    name: str
    init: float
    low: float
    high: float

    def to_unit(self, value: float) -> float:
        return (value - self.low) / (self.high - self.low)

    def from_unit(self, x: float) -> float:
        return self.low + min(1.0, max(0.0, x)) * (self.high - self.low)


@dataclass(frozen=True)
class Config:
    bot: str
    weights: tuple[Weight, ...]
    fixed: dict[str, float]
    opponent: str
    seeds: int
    population: int
    generations: int
    seed: int
    sigma: float
    threads: int
    hand_size: int
    flags: tuple[str, ...]
    binary: Path
    out: Path
    raw: dict


def load_config(path: Path) -> Config:
    raw = json.loads(path.read_text())
    weights = []
    for name, spec in raw["weights"].items():
        weight = Weight(name, spec["init"], spec["min"], spec["max"])
        if not weight.low < weight.high or not weight.low <= weight.init <= weight.high:
            raise SystemExit(f"weight {name}: needs min <= init <= max and min < max")
        weights.append(weight)
    if not weights:
        raise SystemExit("no free weights")
    return Config(
        bot=raw["bot"],
        weights=tuple(weights),
        fixed=raw.get("fixed", {}),
        opponent=raw["opponent"],
        seeds=raw["seeds"],
        population=raw["population"],
        generations=raw["generations"],
        seed=raw.get("seed", 0),
        sigma=raw.get("sigma", 0.25),
        threads=raw.get("threads", 6),
        hand_size=raw.get("hand_size", 7),
        flags=tuple(raw.get("flags", [])),
        binary=Path(raw.get("binary", DIGITAL / "target" / "release" / "sia-bots")),
        out=Path(raw["out"]),
        raw=raw,
    )


def write_atomic(path: Path, data: str | bytes) -> None:
    """Writes `path` whole or not at all."""
    tmp = path.with_name(path.name + ".tmp")
    if isinstance(data, str):
        tmp.write_text(data)
    else:
        tmp.write_bytes(data)
    os.replace(tmp, path)


def values_of(config: Config, x) -> dict[str, float]:
    """The weights a point of the unit cube stands for, with the fixed ones."""
    free = {w.name: round(w.from_unit(xi), 4) for w, xi in zip(config.weights, x)}
    return {**config.fixed, **free}


def bot_json(config: Config, x) -> str:
    return json.dumps({"bot": config.bot, "weights": values_of(config, x)}, indent=2) + "\n"


def evaluate(config: Config, work: Path, x, first_seed: int) -> float:
    """The mean share of the win of candidate `x` against the opponent."""
    candidate = work / "candidate.json"
    write_atomic(candidate, bot_json(config, x))
    spec = f"@{candidate}"
    out = work / "games.jsonl"
    command = [
        str(config.binary), "batch",
        "--bots", f"{spec},{config.opponent}",
        "--games", str(config.seeds),
        "--seed", str(first_seed),
        "--threads", str(config.threads),
        "--hand-size", str(config.hand_size),
        "--out", str(out),
        *config.flags,
    ]  # fmt: skip
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise SystemExit(f"sia-bots failed: {result.stderr.strip()}")
    total = seats = 0.0
    for line in out.read_text().splitlines():
        record = json.loads(line)
        winners = record["winners"]
        for seat, bot in enumerate(record["bots"]):
            if bot == spec:
                seats += 1
                total += 1 / len(winners) if seat in winners else 0.0
    return total / seats


def mean_of(es) -> list[float]:
    """The distribution mean where the candidates live (inside the bounds)."""
    return list(es.boundary_handler.transform(es.mean))


def tune(config: Config) -> None:
    config.out.mkdir(parents=True, exist_ok=True)
    work = config.out / "work"
    work.mkdir(exist_ok=True)
    log = config.out / "log.csv"
    state_path = config.out / "state.pkl"
    identity = {k: v for k, v in config.raw.items() if k not in ("generations", "threads", "binary")}
    if state_path.exists():
        state = pickle.loads(state_path.read_bytes())
        if state["identity"] != identity:
            raise SystemExit(f"{state_path}: the config changed since this run; use another out")
        es, generation = pickle.loads(state["es"]), state["generation"]
        print(f"resuming at generation {generation}", flush=True)
    else:
        x0 = [w.to_unit(w.init) for w in config.weights]
        options = {"popsize": config.population, "bounds": [0, 1], "seed": config.seed + 1, "verbose": -9}
        es, generation = cma.CMAEvolutionStrategy(x0, config.sigma, options), 0
        with log.open("w", newline="") as file:
            csv.writer(file).writerow(["generation", "candidate", "fitness", *(w.name for w in config.weights)])
    write_atomic(config.out / "best.json", bot_json(config, mean_of(es)))
    while generation < config.generations:
        first_seed = config.seed + generation * config.seeds
        candidates = es.ask()
        fitness = []
        for number, x in enumerate(candidates):
            fitness.append(evaluate(config, work, x, first_seed))
            print(f"gen {generation} cand {number}: {fitness[-1]:.4f}", flush=True)
        es.tell(candidates, [-f for f in fitness])
        with log.open("a", newline="") as file:
            writer = csv.writer(file)
            for number, (x, fit) in enumerate(zip(candidates, fitness)):
                values = values_of(config, x)
                writer.writerow([generation, number, f"{fit:.4f}", *(values[w.name] for w in config.weights)])
        generation += 1
        write_atomic(config.out / "best.json", bot_json(config, mean_of(es)))
        write_atomic(state_path, pickle.dumps({"identity": identity, "generation": generation, "es": pickle.dumps(es)}))
        mean_fit = sum(fitness) / len(fitness)
        print(f"generation {generation - 1} done: mean {mean_fit:.4f}, best {max(fitness):.4f}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("config", type=Path)
    args = parser.parse_args()
    try:
        tune(load_config(args.config))
    except KeyboardInterrupt:
        print("interrupted: rerun to resume from the last finished generation", file=sys.stderr)
        sys.exit(130)


if __name__ == "__main__":
    main()
