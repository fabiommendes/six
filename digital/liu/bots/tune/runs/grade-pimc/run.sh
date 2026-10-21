#!/usr/bin/env bash
# Grid of PIMC parameters against greedy, 300 deals (600 games), seeds 700000.
cd "$(dirname "$0")/.."
for spec in pimc pimc:samples=8 pimc:samples=32 pimc:top=3 pimc:top=10 \
            pimc:turns=4 pimc:turns=8 pimc:turns=8,temp=1 pimc:turns=8,temp=4 \
            pimc:rerolls=1 pimc:rerolls=4; do
  echo "== $spec"
  ./liu-bots batch --bots "$spec",greedy --games 300 --seed 700000 | tail -3
done
