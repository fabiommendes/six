// Plays the bot of the WebAssembly package, as the Web Worker of the web
// interface does. Build the package first: `just seks-wasm`.
//
//   node --test digital/seks/wasm/tests/bot.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("seks_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/seks/wasm/pkg has not been built: run `just seks-wasm`.");
}
const { Bot, Game, initSync } = await import(new URL("seks_wasm.js", pkg).href);
initSync({ module: readFileSync(wasmFile) });

const json = (text) => JSON.parse(text);

/** Few nodes keep the test fast; the strength does not matter here. */
const NODES = 200;

/** Plays until the game ends or `maxPlies`; `pick(game, ply)` chooses each command. */
function play(game, pick, maxPlies) {
  const commands = [];
  let view = json(game.view());
  while (view.outcome === null && commands.length < maxPlies) {
    const command = pick(game, commands.length);
    assert.ok(json(game.legalCommands()).includes(command), `${command} is legal`);
    view = json(game.command(command)).view;
    commands.push(command);
  }
  return { commands, view };
}

/** A deterministic pick among the legal commands (an LCG, so a failing game replays). */
function randomPicker(seed) {
  let a = seed;
  return (game) => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    const legal = json(game.legalCommands());
    return legal[a % legal.length];
  };
}

test("the bot plays a legal command, the same one for the same seed", () => {
  const game = new Game();
  const bot = new Bot(NODES, undefined, 0);
  const command = bot.choose(game, 5);
  assert.ok(json(game.legalCommands()).includes(command));
  bot.newGame();
  assert.equal(bot.choose(game, 5), command);
  assert.equal(new Bot(NODES, undefined, 0).choose(game, 5), command);
  assert.equal(game.canUndo(), false, "choosing does not touch the game");
  bot.free();
  game.free();
});

test("the default level exists and the parameters are checked", () => {
  assert.ok(Number.isInteger(Bot.defaultNodes()) && Bot.defaultNodes() > 0);
  new Bot(undefined, undefined, 0).free();
  new Bot(undefined, 2, 0).free();
  assert.throws(() => new Bot(undefined, 0, 0), /depth/);
  assert.throws(() => new Bot(undefined, undefined, -1), /noise/);
});

test("the bot beats a random player as White and as Black", () => {
  for (const [bots, seed] of [["white", 11], ["black", 12]]) {
    const bot = new Bot(NODES, undefined, 0);
    const random = randomPicker(seed);
    const game = new Game();
    const { commands, view } = play(
      game,
      (g, ply) => ((ply % 2 === 0) === (bots === "white") ? bot.choose(g, ply) : random(g)),
      400,
    );
    assert.equal(view.outcome?.kind, "win", `${bots}: the game ended after ${commands.length} plies`);
    assert.equal(view.outcome.winner, bots);
    assert.throws(() => bot.choose(game, 0), /game is over/);
    bot.free();
    game.free();
  }
});

test("the bot plays a short game against itself, with noise, and keeps going after newGame", () => {
  const white = new Bot(NODES, undefined, 150);
  const black = new Bot(NODES, 3, 0);
  const game = new Game();
  const { commands } = play(game, (g, ply) => (ply % 2 === 0 ? white : black).choose(g, ply), 8);
  assert.equal(commands.length, 8);
  white.newGame();
  black.newGame();
  assert.ok(json(game.legalCommands()).includes(white.choose(game, 99)));
  // A Worker rebuilds the game from the state, and the bot answers the same.
  const rebuilt = Game.fromState(game.state());
  black.newGame();
  const fromRebuilt = black.choose(rebuilt, 1);
  black.newGame();
  assert.equal(black.choose(game, 1), fromRebuilt);
  rebuilt.free();
  white.free();
  black.free();
  game.free();
});
