// Plays whole games with the `Bot` of the WebAssembly package, as the bot
// Worker of the web interface does. Build the package first:
// `just shesh-wasm`.
//
//   node --test digital/shesh/wasm/tests/bot.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("shesh_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/shesh/wasm/pkg has not been built: run `just shesh-wasm`.");
}
const { Bot, Game, initSync } = await import(new URL("shesh_wasm.js", pkg).href);
initSync({ module: readFileSync(wasmFile) });

const json = (text) => JSON.parse(text);

test("bots play legal commands to the end", () => {
  const pairs = [
    ["expecti", "random"],
    ["greedy", "expecti"],
    ["random", "random"],
  ];
  for (const [index, names] of pairs.entries()) {
    const game = new Game(BigInt(41 + index));
    const bots = names.map((name, seat) => new Bot(name, 10 * index + seat));
    let plays = 0;
    let view = json(game.view());
    while (view.end === null) {
      const command = bots[view.toMove].choose(game);
      assert.ok(view.moves.some((m) => JSON.stringify(m.command) === command), command);
      view = json(game.command(command)).view;
      assert.ok(++plays < 5000);
    }
    assert.throws(() => bots[0].choose(game), /game is over/);
    for (const bot of bots) bot.free();
  }
});

test("the same seed gives the same command, and bad names throw", () => {
  const game = new Game(3n);
  const a = new Bot("random", 9);
  const b = new Bot("random", 9);
  assert.equal(a.choose(game), b.choose(game));
  assert.throws(() => new Bot("nobody", 1), /unknown bot/);
});

test("the expecti bot beats the random one", () => {
  let wins = 0;
  const games = 30;
  for (let i = 0; i < games; i++) {
    const game = new Game(BigInt(500 + i));
    const seat = i % 2;
    const bots = [new Bot("random", i), new Bot("random", i)];
    bots[seat] = new Bot("expecti", 0);
    let view = json(game.view());
    while (view.end === null) view = json(game.command(bots[view.toMove].choose(game))).view;
    if (view.winner === seat) wins += 1;
  }
  assert.ok(wins >= 0.65 * games, `${wins} wins of ${games}`);
});
