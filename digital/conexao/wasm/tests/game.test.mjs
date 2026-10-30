// Plays whole games through the `Game` of the WebAssembly package, as the
// web interface does. Build the package first: `just conexao-wasm`.
//
//   node --test digital/conexao/wasm/tests/game.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("conexao_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/conexao/wasm/pkg has not been built: run `just conexao-wasm`.");
}
const { Game, initSync } = await import(new URL("conexao_wasm.js", pkg).href);
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

const rules = (changes) => ({ ...json(Game.defaultRules()), ...changes });

/** Dice of each color on the board, in the reserve and captured: always the dice of the rules. */
function assertDiceKept(view) {
  for (const owner of [0, 1]) {
    const onBoard = view.cells.filter((die) => die?.owner === owner).length;
    const reserve = view.reserve[owner].reduce((a, b) => a + b, 0);
    assert.equal(onBoard + reserve + view.captured[owner], view.rules.dice);
  }
}

/** Plays a game to the end with random legal moves; returns the last view. */
function play(game, seed) {
  const random = rng(seed);
  let view = json(game.view());
  while (view.end === null) {
    assert.ok(view.moves.length > 0);
    const move = view.moves[Math.floor(random() * view.moves.length)];
    const before = view;
    const transition = json(game.play(JSON.stringify(move)));
    assert.deepEqual(transition.move, move);
    for (const { at, die } of transition.captured) {
      assert.deepEqual(before.cells[at], die);
      assert.equal(transition.view.cells[at], null);
    }
    view = transition.view;
    assertDiceKept(view);
  }
  return view;
}

test("random games end, with and without capture, on both boards", () => {
  let captured = 0;
  const variants = [
    { capture: false },
    { capture: true },
    { capture: true, size: 9, dice: 12, goal: "reach" },
    { capture: false, blockFromBoard: false, maxTurns: 80 },
    { capture: true, size: 9, dice: 12, extra: [0, 0, 0, 1, 1, 1, 1] },
  ];
  for (const [i, changes] of variants.entries()) {
    for (let seed = 0; seed < 2; seed++) {
      const game = Game.withRules(JSON.stringify(rules({ maxTurns: 150, ...changes })));
      const view = play(game, 100 * i + seed);
      assert.equal(view.moves.length, 0);
      if (view.end.kind === "turnLimit") assert.equal(view.winner, null);
      else assert.equal(view.winner, view.end.winner);
      captured += view.captured[0] + view.captured[1];
      if (!changes.capture) assert.deepEqual(view.captured, [0, 0]);
      game.free();
    }
  }
  assert.ok(captured > 0, "no random game captured a die");
});

test("the state round-trips and a broken one throws", () => {
  const game = Game.withRules(JSON.stringify(rules({ capture: true })));
  const random = rng(7);
  for (let i = 0; i < 40; i++) {
    const view = json(game.view());
    game.play(JSON.stringify(view.moves[Math.floor(random() * view.moves.length)]));
  }
  const copy = Game.fromState(game.state());
  assert.equal(copy.view(), game.view());
  const broken = json(game.state());
  broken.reserve[0][1] += 1;
  assert.throws(() => Game.fromState(JSON.stringify(broken)), /dice/);
  assert.throws(() => Game.withRules(JSON.stringify(rules({ size: 13 }))), /size/);
});

test("illegal moves throw and change nothing; undo goes back", () => {
  const game = new Game();
  const start = game.view();
  assert.throws(() => game.play(JSON.stringify({ kind: "place", to: 60, from: { reserve: 1 } })), /illegal/);
  assert.equal(game.view(), start);
  assert.equal(game.canUndo(), false);
  const first = json(start).moves.find((m) => m.kind === "place");
  game.play(JSON.stringify(first));
  assert.equal(game.canUndo(), true);
  assert.equal(game.undo(), start);
  assert.throws(() => game.undo(), /nothing to undo/);
});

test("a varied reserve offers one placement per value and spends that value", () => {
  const extra = [0, 0, 0, 1, 1, 1, 1];
  const game = Game.withRules(JSON.stringify(rules({ size: 9, dice: 12, extra })));
  const view = json(game.view());
  const placed = view.rules.placedValue;
  assert.deepEqual(view.reserve[0], extra.map((n, value) => (value === placed ? 11 - 4 : n)));
  const target = view.moves.find((m) => m.kind === "place").to;
  const values = view.moves.filter((m) => m.kind === "place" && m.to === target).map((m) => m.from.reserve);
  assert.deepEqual([...new Set(values)].sort(), [3, 4, 5, 6, placed].sort());
  const after = json(game.play(JSON.stringify({ kind: "place", to: target, from: { reserve: 5 } }))).view;
  assert.equal(after.cells[target].value, 5);
  assert.equal(after.reserve[0][5], 0);
  assert.equal(after.reserve[1][5], 1);
  // A value the reserve no longer has is illegal.
  assert.throws(() => game.undo() && game.play(JSON.stringify({ kind: "place", to: target, from: { reserve: 2 === placed ? 1 : 2 } })), /illegal/);
});

test("with capture, losing dice-size+1 dice ends the game", () => {
  const game = Game.withRules(JSON.stringify(rules({ size: 9, dice: 12, capture: true })));
  const random = rng(5);
  let view = json(game.view());
  const limit = view.rules.dice - view.rules.size + 1;
  while (view.end === null) {
    view = json(game.play(JSON.stringify(view.moves[Math.floor(random() * view.moves.length)]))).view;
    for (const owner of [0, 1]) {
      if (view.captured[owner] >= limit) {
        assert.equal(view.end.kind, "noMove");
        assert.equal(view.winner, 1 - owner);
      }
    }
  }
});
