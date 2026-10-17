// The Web Worker of the bot: the search runs here so that the page keeps
// answering while the bot thinks. It receives `BotRequest`s and answers
// `BotResponse`s; the choice itself is `BotRunner` (bot/chooser.ts). The page
// starts one Worker per game, so the runner is the bot of that game.
import { loadWasm } from "../engine/wasm";
import { BotRunner } from "./chooser";
import { handleBotRequest } from "./handler";
import type { BotRequest } from "./protocol";

const ready = loadWasm();
const runner = new BotRunner();

self.onmessage = async (event: MessageEvent<BotRequest>) => {
  await ready;
  self.postMessage(handleBotRequest(event.data, runner));
};
