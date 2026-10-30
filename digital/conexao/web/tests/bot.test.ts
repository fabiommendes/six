import { describe, expect, it } from "vitest";
import { BotCancelled, WorkerBot, type WorkerLike } from "../src/bot/client";
import { handleBotRequest } from "../src/bot/handler";
import { BOT_LEVELS } from "../src/bot/levels";
import type { BotRequest } from "../src/bot/protocol";
import { ConexaoBot, ConexaoGame, defaultRules } from "../src/engine/game";

/** A Worker that answers in-process, through the same handler as the real one. */
class InProcessWorker implements WorkerLike {
  onmessage: WorkerLike["onmessage"] = null;
  onerror: WorkerLike["onerror"] = null;
  /** When false, the answer waits for `flush()`. */
  auto = true;
  private queue: BotRequest[] = [];

  postMessage(message: BotRequest): void {
    if (this.auto) this.answer(message);
    else this.queue.push(message);
  }

  flush(): void {
    for (const message of this.queue.splice(0)) this.answer(message);
  }

  private answer(message: BotRequest): void {
    queueMicrotask(() => this.onmessage?.({ data: handleBotRequest(message, () => 0.5) }));
  }

  terminate(): void {}
}

const small = () => ConexaoGame.create({ ...defaultRules(), size: 9, dice: 12, goal: "reach", maxTurns: 40 });

describe("levels", () => {
  it("offers the greedy, the lookahead and the search bots, which exist", () => {
    expect(BOT_LEVELS.map((l) => l.spec)).toEqual(["greedy", "lookahead", "search"]);
    for (const level of BOT_LEVELS) new ConexaoBot(level.spec, 1).free();
  });
});

describe("handleBotRequest", () => {
  it("answers a legal move of the position", () => {
    const game = small();
    const response = handleBotRequest({ id: 4, state: JSON.stringify(game.state()), spec: "lookahead" });
    expect(response.id).toBe(4);
    if (!("move" in response)) throw new Error(response.error);
    expect(game.view().moves).toContainEqual(response.move);
  });

  it("turns a bad name or a finished game into an error", () => {
    const game = small();
    expect(handleBotRequest({ id: 1, state: JSON.stringify(game.state()), spec: "nobody" })).toHaveProperty("error");
    while (game.view().end === null) game.play(game.view().moves[0]!);
    expect(handleBotRequest({ id: 2, state: JSON.stringify(game.state()), spec: "greedy" })).toHaveProperty("error");
  });
});

describe("WorkerBot", () => {
  it("plays a whole game of bots through the worker", async () => {
    const bot = new WorkerBot(() => new InProcessWorker());
    const game = small();
    while (game.view().end === null) game.play(await bot.choose(JSON.stringify(game.state()), "greedy"));
    expect(game.view().end).not.toBeNull();
    bot.dispose();
  });

  it("cancel rejects the request in progress", async () => {
    const worker = new InProcessWorker();
    worker.auto = false;
    const bot = new WorkerBot(() => worker);
    const answer = bot.choose(JSON.stringify(small().state()), "greedy");
    bot.cancel();
    worker.flush();
    await expect(answer).rejects.toBeInstanceOf(BotCancelled);
  });
});
