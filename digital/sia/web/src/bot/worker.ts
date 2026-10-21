// The Web Worker of the bot: the Monte Carlo search runs here so that the
// page keeps answering while the bot thinks. It receives `BotRequest`s and
// answers `BotResponse`s (bot/handler.ts).
import { loadWasm } from "../engine/wasm";
import { handleBotRequest } from "./handler";
import type { BotRequest } from "./protocol";

const ready = loadWasm();

self.onmessage = async (event: MessageEvent<BotRequest>) => {
  await ready;
  self.postMessage(handleBotRequest(event.data));
};
