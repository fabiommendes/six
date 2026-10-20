// Plays whole games through the `Game` of the WebAssembly package, as the
// web interface does. Build the package first: `just seks-wasm`.
//
//   node --test digital/seks/wasm/tests/game.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("seks_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/seks/wasm/pkg has not been built: run `just seks-wasm`.");
}
const { Game, initSync } = await import(new URL("seks_wasm.js", pkg).href);
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

/** The die options the interface would ask for before playing `command`. */
function checkOptions(game, command) {
  const from = command.includes("-") ? command.split("-")[0] : command.slice(0, -1);
  const options = json(game.options(from));
  assert.equal(options.at, from);
  if (command.includes("-")) {
    assert.ok(options.moves.includes(command.split("-")[1]), `${command} is among the moves of ${from}`);
  } else {
    assert.ok(options.can_increment, `${from} can be incremented`);
  }
}

/** Plays random legal commands until the game ends; returns what happened. */
function playRandomGame(game, seed) {
  const random = rng(seed);
  const states = [game.state()];
  const kinds = new Set();
  let view = json(game.view());
  let plies = 0;
  while (view.outcome === null) {
    assert.ok(plies < 3000, "the game ends");
    const legal = json(game.legalCommands());
    assert.ok(legal.length > 0, "a game in progress has legal commands");
    const command = legal[Math.floor(random() * legal.length)];
    checkOptions(game, command);
    const mover = view.to_move;

    const transition = json(game.command(command));
    for (const event of transition.events) kinds.add(event.type);
    assert.equal(transition.events[0].side, mover);
    assert.equal(transition.events.at(-1).type === "game_ended", transition.view.outcome !== null);
    assert.deepEqual(transition.view, json(game.view()));
    assert.notEqual(transition.view.to_move, mover);
    for (const event of transition.events.filter((event) => event.type === "captured")) {
      assert.ok(!transition.view.dice.some((die) => die.cell === event.at), "a captured die left the board");
    }
    view = transition.view;
    plies += 1;
    states.push(game.state());

    // The state read back is the same game, hashes and counters included.
    const copy = Game.fromState(game.state());
    assert.deepEqual(json(copy.view()), view);
    copy.free();
  }
  return { view, states, plies, kinds };
}

test("plays a whole game and takes it all back", () => {
  const game = new Game();
  const { view, states, plies, kinds } = playRandomGame(game, 10);
  assert.ok(plies > 10);
  assert.ok(kinds.has("moved"));
  assert.equal(view.outcome === null, false);
  assert.deepEqual(json(game.legalCommands()), []);
  assert.throws(() => game.command("b2-b4"), /game is over/);

  // Undo walks the states back one play at a time, the last play included.
  for (let ply = plies - 1; ply >= 0; ply--) {
    assert.ok(game.canUndo());
    json(game.undo());
    assert.equal(game.state(), states[ply]);
  }
  assert.equal(game.canUndo(), false);
  assert.throws(() => game.undo(), /no play to undo/);
  assert.equal(json(game.view()).to_move, "white");
  game.free();
});

// Fixed seeds keep the check short: 10 has a capture and ends in a draw, 25
// ends in a win. `SEKS_GAMES=200 node --test ...` plays that many more.
const extra = Number(process.env.SEKS_GAMES ?? 0);
const seeds = [10, 25, ...Array.from({ length: extra }, (_, i) => 100 + i)];

test("random games end with a win or a draw", () => {
  const kinds = new Set();
  for (const seed of seeds) {
    const game = new Game();
    const { view, kinds: seen } = playRandomGame(game, seed);
    assert.ok(["win", "draw"].includes(view.outcome.kind));
    seen.forEach((kind) => kinds.add(kind));
    game.free();
  }
  for (const kind of ["moved", "incremented", "captured", "game_ended"]) {
    assert.ok(kinds.has(kind), `some game has a ${kind} event`);
  }
});

test("refuses illegal commands and bad text without changing the game", () => {
  const game = new Game();
  const before = game.state();
  for (const text of ["b2-b9", "b2", "a1-a2", "b10-b8", "z1-a1", "", "b2+b3", "b2-b4 "]) {
    assert.throws(() => game.command(text), undefined, text);
  }
  assert.throws(() => game.options("l1"), /cell/);
  assert.throws(() => Game.fromState("{}"));
  assert.equal(game.state(), before);
  assert.equal(game.canUndo(), false);
  game.free();
});

test("the options of a die say where it goes and whether it can be incremented", () => {
  const game = new Game();
  const options = json(game.options("b2"));
  assert.deepEqual([...options.moves].sort(), ["a3", "b1", "b3", "b4", "c3", "d4"]);
  // The Whites must move on the first turn.
  assert.equal(options.can_increment, false);
  assert.equal(json(game.options("b10")).can_increment, false);
  game.command("b2-b4");
  assert.equal(json(game.options("b10")).can_increment, true);
  const enemy = json(game.options("b4"));
  assert.deepEqual(enemy, { at: "b4", moves: [], can_increment: false, shots: [] });
  game.free();
});

test("a move reports the value walked and an increment the new value", () => {
  const game = new Game();
  const { events } = json(game.command("b2-b4"));
  assert.deepEqual(events, [{ type: "moved", side: "white", from: "b2", to: "b4", value: 2 }]);
  const { events: increment } = json(game.command("b10+"));
  assert.deepEqual(increment, [{ type: "incremented", side: "black", at: "b10", value: 3 }]);
  game.free();
});

test("the view counts the plies without capture and warns before a repetition draw", () => {
  const game = new Game();
  const cycle = ["b2-b4", "b10-b8", "b4-b2", "b8-b10"];
  let view = json(game.view());
  assert.equal(view.plies_without_capture, 0);
  assert.equal(view.max_plies_without_capture, 100);
  assert.deepEqual(view.repetition_draws, []);
  for (const command of [...cycle, ...cycle.slice(0, 3)]) {
    view = json(game.command(command)).view;
  }
  assert.equal(view.plies_without_capture, 7);
  assert.equal(view.repetitions, 2);
  assert.deepEqual(view.repetition_draws, ["b8-b10"]);

  // The warning survives a save and a Worker handing the game over.
  const copy = Game.fromState(game.state());
  assert.deepEqual(json(copy.view()).repetition_draws, ["b8-b10"]);
  const { view: end } = json(copy.command("b8-b10"));
  assert.deepEqual(end.outcome, { kind: "draw", reason: "repetition" });
  assert.equal(json(game.view()).outcome, null);
  copy.free();
  game.free();
});

test("a game starts from a text diagram", () => {
  const diagram = `
    .. .. .. .. .. .. .. .. .. .. b1
    .. .. .. .. .. .. .. .. .. .. ..
    .. .. .. .. .. .. .. .. .. .. ..
    .. .. .. .. .. .. .. .. .. .. ..
    .. .. .. .. .. .. .. .. .. .. ..
    .. .. .. .. .. w6 .. .. .. .. ..
    .. .. .. .. .. .. .. .. .. .. ..
    .. .. .. .. .. .. .. .. .. .. ..
    .. .. .. .. .. .. .. .. .. .. ..
    .. .. .. .. .. .. .. .. .. .. ..
    w1 .. .. .. .. .. .. .. .. .. ..`;
  const game = Game.fromDiagram(diagram, "white");
  const view = json(game.view());
  assert.equal(view.to_move, "white");
  assert.deepEqual(view.dice.map((die) => die.cell).sort(), ["a1", "f6", "k11"]);
  assert.equal(json(game.options("f6")).moves.includes("f11"), true);
  assert.equal(game.canUndo(), false);
  // The state of a diagram game is a state like any other.
  assert.deepEqual(json(Game.fromState(game.state()).view()), view);
  assert.throws(() => Game.fromDiagram(diagram, "green"), /unknown side/);
  assert.throws(() => Game.fromDiagram(".. ..", "white"));
  game.free();
});
