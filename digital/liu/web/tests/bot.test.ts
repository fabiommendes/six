import { describe, expect, it } from "vitest";
import { BotCancelled, WorkerBot, type WorkerLike } from "../src/bot/client";
import { handleBotRequest } from "../src/bot/handler";
import { BOT_LEVELS } from "../src/bot/levels";
import type { BotRequest } from "../src/bot/protocol";
import { LiuBot, LiuGame } from "../src/engine/game";

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

const FAST = "pimc:samples=2,top=2,turns=4";

describe("levels", () => {
  it("has three levels whose specs the bots read", () => {
    expect(BOT_LEVELS.map((l) => l.id)).toEqual(["easy", "medium", "hard"]);
    for (const level of BOT_LEVELS) new LiuBot(level.spec).free();
  });
});

describe("handleBotRequest", () => {
  it("answers a legal command of the position", () => {
    const game = LiuGame.create(3, 21n);
    const response = handleBotRequest({ id: 4, state: JSON.stringify(game.state()), spec: FAST });
    expect(response.id).toBe(4);
    if (!("command" in response)) throw new Error(response.error);
    expect(game.legalCommands()).toContainEqual(response.command);
  });

  it("turns a bad spec or a finished game into an error", () => {
    const game = LiuGame.create(2, 1n);
    expect(handleBotRequest({ id: 1, state: JSON.stringify(game.state()), spec: "nobody" })).toHaveProperty("error");
    game.command({ kind: "pass" });
    game.command({ kind: "pass" });
    expect(game.view().end).not.toBeNull();
    expect(handleBotRequest({ id: 2, state: JSON.stringify(game.state()), spec: "greedy" })).toHaveProperty("error");
  });
});

describe("WorkerBot", () => {
  it("plays a whole game of bots through the worker", async () => {
    const bot = new WorkerBot(() => new InProcessWorker());
    const game = LiuGame.create(2, 8n);
    while (game.view().end === null) game.command(await bot.choose(JSON.stringify(game.state()), "greedy"));
    expect(game.view().winners!.length).toBeGreaterThan(0);
    bot.dispose();
  });

  it("cancel rejects the request in progress", async () => {
    const worker = new InProcessWorker();
    worker.auto = false;
    const bot = new WorkerBot(() => worker);
    const answer = bot.choose(JSON.stringify(LiuGame.create(2, 3n).state()), FAST);
    bot.cancel();
    worker.flush();
    await expect(answer).rejects.toBeInstanceOf(BotCancelled);
  });
});
