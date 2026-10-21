// Plays whole games through the `Game` of the WebAssembly package, as the
// web interface does. Build the package first: `just sia-wasm`.
//
//   node --test digital/sia/wasm/tests/game.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("sia_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/sia/wasm/pkg has not been built: run `just sia-wasm`.");
}
const { Game, initSync } = await import(new URL("sia_wasm.js", pkg).href);
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

/** Plays a game to the end with random legal commands, rerolling rarely. */
function play(game, seed) {
  const random = rng(seed);
  let view = json(game.view());
  let commands = 0;
  while (view.end === null) {
    const legal = json(game.legalCommands());
    const calm = legal.filter((c) => c.kind !== "reroll");
    const pool = calm.length > 0 && random() < 0.95 ? calm : legal;
    const command = pool[Math.floor(random() * pool.length)];
    const transition = json(game.command(JSON.stringify(command)));
    assert.ok(transition.events.length > 0);
    view = transition.view;
    commands += 1;
    assert.ok(commands < 5000, "the game ends");
  }
  return view;
}

test("games with hands of 6, 7 and 8 end with winners", () => {
  for (const size of [6, 7, 8]) {
    for (let seed = 1; seed <= 15; seed++) {
      const game = size === 7 ? new Game(BigInt(seed)) : Game.withHandSize(size, BigInt(seed));
      const view = play(game, seed);
      assert.ok(view.winners.length >= 1);
      assert.equal(view.players[0].hand.length + view.players[0].lost, size);
      assert.ok(view.open.every((open) => !open) && view.claimable.every((c) => !c));
    }
  }
});

test("the preparation, the view and the legal commands agree", () => {
  const game = new Game(7n);
  const events = json(game.openingEvents());
  assert.deepEqual(
    events.map((e) => e.kind),
    ["stonesRolled", "drawn", "drawn", "turnStarted"],
  );
  const view = json(game.view());
  assert.equal(view.stones.length, 9);
  assert.deepEqual(
    view.stones.map((s) => s.number),
    events[0].stones,
  );
  assert.equal(view.players[0].hand.length, 7);
  assert.equal(view.canReroll, true);
  const legal = json(game.legalCommands());
  assert.ok(legal.some((c) => c.kind === "reroll"));
  assert.ok(legal.some((c) => c.kind === "place"));
  assert.ok(!legal.some((c) => c.kind === "pass"));
});

test("the state round-trips and undo goes back to the same dice", () => {
  const game = new Game(7n);
  const saved = game.state();
  const copy = Game.fromState(saved);
  assert.equal(copy.state(), saved);

  const command = JSON.stringify({ kind: "place", die: 0, stone: 4 });
  const first = game.command(command);
  assert.ok(game.canUndo());
  game.undo();
  assert.equal(game.state(), saved);
  assert.equal(game.command(command), first);
});

test("a reroll costs a die and the hand comes back one die short", () => {
  const game = new Game(11n);
  const me = json(game.view()).toMove;
  const transition = json(game.command(JSON.stringify({ kind: "reroll", target: me, lost: 0, dice: 0b110 })));
  const reroll = transition.events[0];
  assert.equal(reroll.kind, "rerolled");
  assert.equal(reroll.rolled.length, 2);
  assert.equal(transition.view.players[me].hand.length, 6);
  assert.equal(transition.view.canReroll, false);
  const placed = json(game.command(JSON.stringify({ kind: "place", die: 0, stone: 0 })));
  assert.deepEqual(
    placed.events.map((e) => e.kind),
    ["placed", "drawn", "turnStarted"],
  );
  assert.equal(placed.view.players[me].hand.length, 6);
  assert.equal(placed.view.players[me].lost, 1);
});

test("illegal commands throw and change nothing", () => {
  const game = new Game(3n);
  const before = game.state();
  assert.throws(() => game.command(JSON.stringify({ kind: "pass" })), /place one/);
  assert.throws(() => game.command(JSON.stringify({ kind: "claim", stone: 0 })), /not proven/);
  assert.throws(() => game.command(JSON.stringify({ kind: "place", die: 0, stone: 9 })), /no stone/);
  assert.throws(() => game.command(JSON.stringify({ kind: "reroll", target: 0, lost: 0, dice: 0 })));
  assert.throws(() => game.command("{}"));
  assert.throws(() => Game.withHandSize(11, 1n), /2 to 10/);
  assert.throws(() => Game.fromState("{}"));
  assert.equal(game.state(), before);
  assert.ok(!game.canUndo());
});
