// Plays whole games through the `Game` of the WebAssembly package, as the
// web interface does. Build the package first: `just shesh-wasm`.
//
//   node --test digital/shesh/wasm/tests/game.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("shesh_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/shesh/wasm/pkg has not been built: run `just shesh-wasm`.");
}
const { Game, initSync } = await import(new URL("shesh_wasm.js", pkg).href);
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

/** Dice of a player: on the track and in the reserve. */
const dice = (player) => player.track.filter((v) => v > 0).length + player.reserve.length;

/** Plays a game to the end with random legal commands. */
function play(game, seed) {
  const random = rng(seed);
  let view = json(game.view());
  let commands = 0;
  while (view.end === null) {
    const legal = json(game.legalCommands());
    assert.deepEqual(
      view.moves.map((m) => m.command),
      legal,
      "the view lists the legal commands",
    );
    const command = legal[Math.floor(random() * legal.length)];
    const transition = json(game.command(JSON.stringify(command)));
    assert.ok(transition.events.length > 0);
    view = transition.view;
    for (const player of view.players) {
      assert.ok(player.track.every((v) => v >= 0 && v <= 6));
      assert.equal(player.track[0], 0);
      assert.equal(player.track[18], 0);
    }
    commands += 1;
    assert.ok(commands < 5000, "the game ends");
  }
  return view;
}

test("random games end with a winner and a reason", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const view = play(new Game(BigInt(seed)), seed);
    assert.ok(view.winner === 0 || view.winner === 1);
    assert.ok(["points", "allHome"].includes(view.end.kind));
    assert.equal(view.end.player, view.winner);
    assert.deepEqual(view.moves, []);
    if (view.end.kind === "points") assert.ok(view.players[view.winner].points >= 12);
  }
});

test("the first view has the six dice in each reserve and legal moves", () => {
  const game = new Game(7n);
  const view = json(game.view());
  assert.equal(view.players.length, 2);
  for (const player of view.players) {
    assert.deepEqual(player.reserve, [1, 2, 3, 4, 5, 6]);
    assert.equal(dice(player), 6);
    assert.equal(player.points, 0);
  }
  assert.ok(view.roll >= 0 && view.roll <= 4);
  assert.equal(view.turn, 1);
  if (view.roll === 0) {
    assert.deepEqual(view.moves.map((m) => m.command), [{ kind: "pass" }]);
  } else {
    // Only the smallest die enters.
    assert.deepEqual(view.moves.map((m) => m.command), [{ kind: "enter", value: 1 }]);
    assert.deepEqual(view.moves[0].events[0], { kind: "entered", player: view.toMove, value: 1, square: view.roll });
  }
});

test("a play returns the events and the new view", () => {
  const game = new Game(2n);
  const view = json(game.view());
  const transition = json(game.command(JSON.stringify(view.moves[0].command)));
  assert.deepEqual(transition.view, json(game.view()));
  assert.equal(transition.events.at(-1).kind, "rolled", "the roll of the next turn closes the events");
  assert.equal(transition.events.at(-1).roll, transition.view.roll);
  assert.equal(transition.view.turn, 2);
});

test("the state round-trips and undo goes back to the same rolls", () => {
  const game = new Game(7n);
  const saved = game.state();
  const copy = Game.fromState(saved);
  assert.equal(copy.state(), saved);

  const command = JSON.stringify(json(game.view()).moves[0].command);
  const first = game.command(command);
  assert.ok(game.canUndo());
  game.undo();
  assert.equal(game.state(), saved);
  assert.equal(game.command(command), first);
  assert.throws(() => copy.undo(), /nothing to undo/);
});

test("illegal commands throw and change nothing", () => {
  const game = new Game(3n);
  const before = game.state();
  assert.throws(() => game.command(JSON.stringify({ kind: "move", from: 17 })), /illegal/);
  assert.throws(() => game.command(JSON.stringify({ kind: "enter", value: 6 })), /illegal/);
  assert.throws(() => game.command("{}"));
  assert.throws(() => Game.fromState("{}"));
  const broken = json(before);
  broken.roll = 9;
  assert.throws(() => Game.fromState(JSON.stringify(broken)), /roll/);
  assert.equal(game.state(), before);
  assert.ok(!game.canUndo());
});

test("rules for experiments: an extra turn on the rosettes", () => {
  const rules = JSON.stringify({ extraTurn: true, orderedEntry: false, allHomeWins: true });
  const game = Game.withRules(rules, 4n);
  const view = json(game.view());
  assert.deepEqual(view.rules, { extraTurn: true, orderedEntry: false, allHomeWins: true });
  if (view.roll > 0) assert.equal(view.moves.length, 6, "free entry: any of the six dice");
  assert.throws(() => Game.withRules("{}", 1n));
  play(game, 9);
});
