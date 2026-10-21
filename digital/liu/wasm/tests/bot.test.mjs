// Plays whole games with the `Bot` of the WebAssembly package, as the bot
// Worker of the web interface does. Build the package first: `just liu-wasm`.
//
//   node --test digital/liu/wasm/tests/bot.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("liu_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/liu/wasm/pkg has not been built: run `just liu-wasm`.");
}
const { Bot, Game, initSync } = await import(new URL("liu_wasm.js", pkg).href);
initSync({ module: readFileSync(wasmFile) });

const json = (text) => JSON.parse(text);

test("bots play legal commands to the end, from 2 to 4 players", () => {
  for (const players of [2, 3, 4]) {
    const game = new Game(players, BigInt(40 + players));
    const bots = ["greedy", "pimc:samples=2,top=3,turns=6", "greedy:noise=1.5", "random"].map((spec) => new Bot(spec));
    let seed = 0;
    while (json(game.view()).end === null) {
      const legal = json(game.legalCommands());
      const command = bots[json(game.view()).toMove].choose(game, ++seed);
      assert.ok(legal.some((c) => JSON.stringify(c) === command), command);
      game.command(command);
    }
    assert.throws(() => bots[0].choose(game, 1), /game is over/);
    for (const bot of bots) bot.free();
  }
});

test("the same seed gives the same command, and bad specs throw", () => {
  const game = new Game(2, 3n);
  const a = new Bot("greedy:noise=3");
  const b = new Bot("greedy:noise=3");
  assert.equal(a.choose(game, 9), b.choose(game, 9));
  assert.equal(new Bot("pimc").name(), "pimc:samples=32,top=6,turns=8,temp=2,rerolls=2");
  assert.throws(() => new Bot("nobody"), /unknown bot/);
  assert.throws(() => new Bot("@weights.json"), /bot files/);
});
