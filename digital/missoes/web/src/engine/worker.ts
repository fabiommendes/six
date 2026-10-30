// The Web Worker of the game: the engine and the bots run here, so the page
// keeps answering while a bot thinks. It receives `GameRequest`s and answers
// `GameResponse`s (engine/handler.ts).
import { GameHandler } from "./handler";
import type { GameRequest } from "./protocol";
import { loadWasm } from "./wasm";

const ready = loadWasm();
const handler = new GameHandler();

self.onmessage = async (event: MessageEvent<GameRequest>) => {
  await ready;
  self.postMessage(handler.handle(event.data));
};
