import { describe, expect, it } from "vitest";
import { BotCancelled, WorkerBot, type WorkerLike } from "../src/bot/client";
import { handleBotRequest } from "../src/bot/handler";
import { BOT_LEVELS } from "../src/bot/levels";
import type { BotRequest } from "../src/bot/protocol";
import { SheshBot, SheshGame } from "../src/engine/game";

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

describe("levels", () => {
  it("has three levels whose bots exist", () => {
    expect(BOT_LEVELS.map((l) => l.id)).toEqual(["easy", "medium", "hard"]);
    for (const level of BOT_LEVELS) new SheshBot(level.spec, 1).free();
  });
});

describe("handleBotRequest", () => {
  it("answers a legal command of the position", () => {
    const game = SheshGame.create(21n);
    const response = handleBotRequest({ id: 4, state: JSON.stringify(game.state()), spec: "expecti" });
    expect(response.id).toBe(4);
    if (!("command" in response)) throw new Error(response.error);
    expect(game.legalCommands()).toContainEqual(response.command);
  });

  it("turns a bad name or a finished game into an error", () => {
    const game = SheshGame.create(1n);
    expect(handleBotRequest({ id: 1, state: JSON.stringify(game.state()), spec: "nobody" })).toHaveProperty("error");
    while (game.view().end === null) {
      const commands = game.legalCommands();
      game.command(commands[commands.length - 1]!);
    }
    expect(handleBotRequest({ id: 2, state: JSON.stringify(game.state()), spec: "greedy" })).toHaveProperty("error");
  });
});

describe("WorkerBot", () => {
  it("plays a whole game of bots through the worker", async () => {
    const bot = new WorkerBot(() => new InProcessWorker());
    const game = SheshGame.create(8n);
    while (game.view().end === null) game.command(await bot.choose(JSON.stringify(game.state()), "greedy"));
    expect(game.view().winner).not.toBeNull();
    bot.dispose();
  });

  it("cancel rejects the request in progress", async () => {
    const worker = new InProcessWorker();
    worker.auto = false;
    const bot = new WorkerBot(() => worker);
    const answer = bot.choose(JSON.stringify(SheshGame.create(3n).state()), "expecti");
    bot.cancel();
    worker.flush();
    await expect(answer).rejects.toBeInstanceOf(BotCancelled);
  });
});
