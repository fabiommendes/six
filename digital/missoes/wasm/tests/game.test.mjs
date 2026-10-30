// Plays whole games through the `Game` of the WebAssembly package, as the
// web interface does: people answer with random legal answers built from the
// options of the view, and bots answer by themselves. Build the package
// first: `just missoes-wasm`.
//
//   node --test digital/missoes/wasm/tests/game.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("missoes_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/missoes/wasm/pkg has not been built: run `just missoes-wasm`.");
}
const { Game, initSync } = await import(new URL("missoes_wasm.js", pkg).href);
initSync({ module: readFileSync(wasmFile) });

const json = (text) => JSON.parse(text);

/** A small deterministic generator (mulberry32) so a failing game replays. */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random legal answer to the pending decision, from its options. */
function randomAnswer(view, random) {
  const pick = (items) => items[Math.floor(random() * items.length)];
  const { player, decision } = view.pending;
  switch (decision.kind) {
    case "select": {
      const all = view.reserves[player].map((_, i) => i).sort(() => random() - 0.5);
      return { kind: "select", dice: all.slice(0, decision.count) };
    }
    case "cash":
      return { kind: "cash", dice: decision.options.filter(() => random() < 0.2) };
    case "buy":
      return { kind: "buy", die: random() < 0.6 ? pick(decision.options) : null };
    case "place":
      return { kind: "place", spot: pick(decision.spots) };
    case "act": {
      const roll = random();
      if (roll < 0.15 && decision.sacrifice.length > 1) {
        const out = pick(decision.sacrifice);
        const rerolls = decision.sacrifice.filter((i) => i !== out && random() < 0.5);
        return { kind: "act", action: { kind: "sacrifice", out, rerolls } };
      }
      if (roll < 0.35 && decision.zeros.length > 0) {
        const use = pick(decision.zeros);
        return { kind: "act", action: { kind: "zero", zero: use.die, target: pick(use.targets) } };
      }
      if (roll < 0.55 && decision.modifiers.length > 0) {
        const use = pick(decision.modifiers);
        return { kind: "act", action: { kind: "modify", modifier: use.die, target: pick(use.targets), up: random() < 0.5 } };
      }
      if (roll < 0.6 && decision.sabotage.length > 0) {
        return { kind: "act", action: { kind: "sabotage", card: pick(decision.sabotage) } };
      }
      return { kind: "act", action: { kind: "pass" } };
    }
  }
  throw new Error(`unknown decision ${decision.kind}`);
}

/** Plays a game to the end; returns the last view and the kinds of answers seen. */
function play(game, seed) {
  const random = rng(seed);
  let view = json(game.view());
  const seen = new Set();
  let steps = 0;
  while (view.pending !== null) {
    const step = game.botToMove() ? json(game.playBot()) : json(game.apply(JSON.stringify(randomAnswer(view, random))));
    seen.add(step.answer.kind === "act" ? step.answer.action.kind : step.answer.kind);
    assert.equal(step.player, view.pending.player);
    assert.deepEqual(step.view, json(game.view()));
    view = step.view;
    for (const hand of view.current?.hands ?? []) {
      for (const die of hand) assert.ok(die.face >= 0 && die.face <= 6);
    }
    assert.ok(++steps < 20000, "the game ends");
  }
  return { view, seen };
}

test("people and bots play whole games with 2 to 4 seats", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 9; seed++) {
    const players = 2 + (seed % 3);
    const bots = Array.from({ length: players }, (_, seat) => (seat === 1 ? "greedy" : seat === 3 ? "random" : null));
    const game = new Game(JSON.stringify({ bots, goal: 15 }), BigInt(seed));
    const result = play(game, seed);
    for (const kind of result.seen) seen.add(kind);
    const { view } = result;
    assert.equal(view.current, null);
    assert.ok(view.winners.length >= 1);
    assert.ok(view.points.some((p) => p >= 15));
    const top = Math.max(...view.points);
    for (const w of view.winners) assert.equal(view.points[w], top);
    assert.ok(view.last.round === view.round);
    game.free();
  }
  for (const kind of ["select", "cash", "buy", "place", "pass", "sacrifice", "zero", "modify", "sabotage"]) {
    assert.ok(seen.has(kind), `no ${kind} answer was played`);
  }
});

test("the first view: six dice each, the showcase and a card per player", () => {
  const game = new Game(JSON.stringify({ bots: [null, null, null] }), 5n);
  const view = json(game.view());
  assert.equal(view.players, 3);
  assert.equal(view.goal, 30);
  assert.equal(view.showcase.length, 6);
  assert.equal(view.table.length, 3);
  for (const reserve of view.reserves) {
    assert.deepEqual([...reserve].sort(), ["common", "common", "common", "common", "common", "gold"]);
  }
  assert.deepEqual(view.pending, { player: 0, decision: { kind: "select", count: 6 } });
  assert.equal(game.botToMove(), false);
});

test("illegal answers throw and change nothing", () => {
  const game = new Game(JSON.stringify({ bots: [null, "greedy"] }), 3n);
  const before = game.view();
  assert.throws(() => game.apply(JSON.stringify({ kind: "select", dice: [0, 1] })), /selected/);
  assert.throws(() => game.apply(JSON.stringify({ kind: "buy", die: 0 })), /answered/);
  assert.throws(() => game.apply("{}"));
  assert.throws(() => game.playBot(), /not a bot/);
  assert.equal(game.view(), before);
  game.apply(JSON.stringify({ kind: "select", dice: [0, 1, 2, 3, 4, 5] }));
  assert.ok(game.botToMove());
  assert.throws(() => game.apply(JSON.stringify({ kind: "select", dice: [0, 1, 2, 3, 4, 5] })), /is a bot/);
});

test("bad setups throw", () => {
  assert.throws(() => new Game(JSON.stringify({ bots: [null] }), 1n), /2 to 4/);
  assert.throws(() => new Game(JSON.stringify({ bots: [null, "nobody"] }), 1n), /unknown bot/);
  assert.throws(() => new Game(JSON.stringify({ bots: [null, null], goal: 0 }), 1n), /goal/);
});

test("the greedy bot answers within a few seconds (the interface runs it in a Worker)", () => {
  const game = new Game(JSON.stringify({ bots: ["greedy", "greedy", "greedy", "greedy"] }), 9n);
  let slowest = 0;
  let steps = 0;
  while (game.botToMove() && steps < 150) {
    const start = performance.now();
    game.playBot();
    slowest = Math.max(slowest, performance.now() - start);
    steps += 1;
  }
  assert.ok(slowest < 5000, `slowest bot answer: ${slowest.toFixed(0)} ms`);
});
