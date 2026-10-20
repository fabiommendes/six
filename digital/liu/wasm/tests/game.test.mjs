// Plays whole games through the `Game` of the WebAssembly package, as the
// web interface does. Build the package first: `just liu-wasm`.
//
//   node --test digital/liu/wasm/tests/game.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("liu_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/liu/wasm/pkg has not been built: run `just liu-wasm`.");
}
const { Game, initSync } = await import(new URL("liu_wasm.js", pkg).href);
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

/** Plays a game to the end with random legal commands, passing rarely. */
function play(players, seed) {
  const random = rng(seed);
  const game = new Game(players, BigInt(seed));
  let view = json(game.view());
  let plies = 0;
  while (view.end === null) {
    const commands = json(game.legalCommands());
    const placing = commands.filter((c) => c.kind !== "pass");
    const pool = placing.length > 0 && random() < 0.95 ? placing : commands;
    const command = pool[Math.floor(random() * pool.length)];
    const transition = json(game.command(JSON.stringify(command)));
    assert.ok(transition.events.length > 0);
    view = transition.view;
    plies += 1;
    assert.ok(plies < 10000, "the game ends");
  }
  return { game, view, plies };
}

test("games of 2 to 4 players end with winners", () => {
  for (const players of [2, 3, 4]) {
    for (let seed = 1; seed <= 20; seed++) {
      const { view } = play(players, seed);
      assert.ok(view.winners.length >= 1);
      assert.deepEqual(view.targets, [[], [], [], [], [], []]);
    }
  }
});

test("the state round-trips and undo goes back to the same rolls", () => {
  const game = new Game(3, 7n);
  assert.equal(json(game.openingEvents())[0].kind, "marketFilled");
  const saved = game.state();
  const copy = Game.fromState(saved);
  assert.equal(copy.state(), saved);

  const view = json(game.view());
  const command = view.canReroll ? { kind: "reroll" } : { kind: "pass" };
  const first = game.command(JSON.stringify(command));
  assert.ok(game.canUndo());
  game.undo();
  assert.equal(game.state(), saved);
  assert.equal(game.command(JSON.stringify(command)), first);
});

test("illegal commands throw and change nothing", () => {
  const game = new Game(2, 3n);
  const before = game.state();
  assert.throws(() => game.command(JSON.stringify({ kind: "keep", die: 0 })), /hand already holds/);
  assert.throws(() => game.command(JSON.stringify({ kind: "placeFromMarket", die: 0, at: { row: 3, col: 3 } })));
  assert.throws(() => game.command("{}"));
  assert.throws(() => new Game(5, 1n), /2 to 4/);
  assert.throws(() => Game.fromState("{}"));
  assert.equal(game.state(), before);
  assert.ok(!game.canUndo());
});
