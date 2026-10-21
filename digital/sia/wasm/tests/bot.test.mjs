// Plays whole games with the `Bot` of the WebAssembly package, as the bot
// Worker of the web interface does, and times the decisions of the PIMC.
// Build the package first: `just sia-wasm`.
//
//   node --test digital/sia/wasm/tests/bot.test.mjs
//
// SIA_BENCH=N times N PIMC decisions at the start of the game and prints
// the mean (it is the measure behind the target of half a second).

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("sia_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/sia/wasm/pkg has not been built: run `just sia-wasm`.");
}
const { Bot, Game, initSync } = await import(new URL("sia_wasm.js", pkg).href);
initSync({ module: readFileSync(wasmFile) });

const json = (text) => JSON.parse(text);

test("bots play legal commands to the end", () => {
  const pairs = [
    ["greedy", "random"],
    ["pimc:samples=2,top=3,turns=6", "greedy:noise=1.5"],
  ];
  for (const [index, specs] of pairs.entries()) {
    const game = new Game(BigInt(41 + index));
    const bots = specs.map((spec) => new Bot(spec));
    let n = 0;
    while (json(game.view()).end === null) {
      const legal = json(game.legalCommands());
      const command = bots[json(game.view()).toMove].choose(game, ++n);
      // A reroll may name any of several equal dice; the engine checks it.
      assert.ok(json(command).kind === "reroll" || legal.some((c) => JSON.stringify(c) === command), command);
      game.command(command);
    }
    assert.throws(() => bots[0].choose(game, 1), /game is over/);
    for (const bot of bots) bot.free();
  }
});

test("the same seed gives the same command, and bad specs throw", () => {
  const game = new Game(3n);
  const a = new Bot("greedy:noise=3");
  const b = new Bot("greedy:noise=3");
  assert.equal(a.choose(game, 9), b.choose(game, 9));
  assert.match(new Bot("pimc").name(), /^pimc:samples=\d+/);
  assert.throws(() => new Bot("nobody"), /unknown bot/);
  assert.throws(() => new Bot("@weights.json"), /bot files/);
});

test("the default PIMC answers in well under half a second", () => {
  const decisions = Number(process.env.SIA_BENCH ?? 6);
  const bot = new Bot("pimc");
  let total = 0;
  let worst = 0;
  for (let i = 0; i < decisions; i++) {
    const game = new Game(BigInt(100 + i));
    // A few commands in, so the sides are not empty.
    const greedy = new Bot("greedy");
    for (let k = 0; k < 6; k++) game.command(greedy.choose(game, k + 1));
    const started = performance.now();
    bot.choose(game, i + 1);
    const ms = performance.now() - started;
    total += ms;
    worst = Math.max(worst, ms);
  }
  const mean = total / decisions;
  console.log(`pimc: ${mean.toFixed(0)} ms per decision (worst ${worst.toFixed(0)}), ${decisions} decisions`);
  assert.ok(mean < 500, `mean ${mean} ms`);
});
