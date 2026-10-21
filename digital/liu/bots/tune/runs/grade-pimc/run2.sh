#!/usr/bin/env bash
# Second grid: temperature and samples with turns=8, against greedy, same deals as run.sh.
cd "$(dirname "$0")/.."
for spec in pimc:turns=8,temp=1 pimc:turns=8,temp=4 pimc:samples=24,turns=8 pimc:samples=32,turns=8; do
  echo "== $spec"
  ./liu-bots batch --bots "$spec",greedy --games 300 --seed 700000 | tail -3
done
