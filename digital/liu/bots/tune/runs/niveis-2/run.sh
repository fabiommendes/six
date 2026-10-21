#!/bin/bash
cd "$(dirname "$0")/../../../../../.."
while read a b n; do
  echo "== $a vs $b"
  just liu-batch "$a" "$b" --games "$n" --seed 930000 2>&1 | grep -E "games,|ms per|vs"
done <<'L'
greedy:noise=1 random 500
greedy:noise=1 greedy 500
greedy @liu/bots/tune/runs/fase2.json 500
pimc greedy 300
pimc @liu/bots/tune/runs/fase2-pimc.json 300
L
