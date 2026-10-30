// Plays whole games with the `Bot` of the WebAssembly package, as the bot
// Worker of the web interface does. Build the package first:
// `just conexao-wasm`.
//
//   node --test digital/conexao/wasm/tests/bot.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const pkg = new URL("../pkg/", import.meta.url);
const wasmFile = fileURLToPath(new URL("conexao_wasm_bg.wasm", pkg));
if (!existsSync(wasmFile)) {
  throw new Error("digital/conexao/wasm/pkg has not been built: run `just conexao-wasm`.");
}
const { Bot, Game, initSync } = await import(new URL("conexao_wasm.js", pkg).href);
initSync({ module: readFileSync(wasmFile) });

const json = (text) => JSON.parse(text);
const rules = (changes) => JSON.stringify({ ...json(Game.defaultRules()), ...changes });

test("bots play legal moves to the end", () => {
  const pairs = [
    // Short turn limits keep the test quick: a game that hits one ends in a draw.
    ["greedy", "random", { capture: true, maxTurns: 60 }],
    ["lookahead", "greedy", { size: 9, dice: 12, goal: "reach", maxTurns: 40 }],
    ["random", "random", { maxTurns: 60 }],
  ];
  for (const [index, [a, b, changes]] of pairs.entries()) {
    const game = Game.withRules(rules(changes));
    const bots = [new Bot(a, 10 * index), new Bot(b, 10 * index + 1)];
    let view = json(game.view());
    while (view.end === null) {
      const move = bots[view.toMove].choose(game);
      assert.ok(view.moves.some((m) => JSON.stringify(m) === move), move);
      view = json(game.play(move)).view;
    }
    assert.throws(() => bots[0].choose(game), /game is over/);
    for (const bot of bots) bot.free();
    game.free();
  }
});

test("the search bot answers a legal move", () => {
  const game = Game.withRules(rules({ size: 9, dice: 12, goal: "reach" }));
  const bot = new Bot("search", 3);
  for (let i = 0; i < 4; i++) {
    const view = json(game.view());
    const move = bot.choose(game);
    assert.ok(view.moves.some((m) => JSON.stringify(m) === move), move);
    game.play(move);
  }
});

test("the same seed gives the same move, and bad names throw", () => {
  const game = new Game();
  assert.equal(new Bot("random", 9).choose(game), new Bot("random", 9).choose(game));
  assert.throws(() => new Bot("nobody", 1), /unknown bot/);
});
