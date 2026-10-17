import { describe, expect, it } from "vitest";
import { BotCancelled, WorkerBot, type WorkerLike } from "../src/bot/client";
import { handleBotRequest } from "../src/bot/handler";
import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../src/bot/levels";
import type { BotRequest } from "../src/bot/protocol";
import { SeksGame } from "../src/engine/game";

const level = DEFAULT_BOT_LEVEL;

/** A Worker that answers in-process, through the same handler as the real one. */
class InProcessWorker implements WorkerLike {
  onmessage: WorkerLike["onmessage"] = null;
  onerror: WorkerLike["onerror"] = null;
  terminated = false;
  requests: BotRequest[] = [];
  /** When false, the answer waits for `flush()`. */
  auto = true;
  private queue: BotRequest[] = [];

  postMessage(message: BotRequest): void {
    this.requests.push(message);
    if (this.auto) this.answer(message);
    else this.queue.push(message);
  }

  flush(): void {
    for (const message of this.queue.splice(0)) this.answer(message);
  }

  private answer(message: BotRequest): void {
    queueMicrotask(() => this.onmessage?.({ data: handleBotRequest(message) }));
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe("levels", () => {
  it("has three named levels and a default among them", () => {
    expect(BOT_LEVELS.map((l) => l.id)).toEqual(["easy", "medium", "hard"]);
    expect(BOT_LEVELS).toContain(DEFAULT_BOT_LEVEL);
  });
});

describe("handleBotRequest", () => {
  it("rebuilds the game from its state and answers a legal command", () => {
    const game = SeksGame.create();
    game.command("b2-b4");
    for (let i = 0; i < 20; i++) {
      const response = handleBotRequest({ id: 7, state: game.stateJson(), level });
      expect(response.id).toBe(7);
      expect("command" in response && game.legalCommands()).toContain("command" in response ? response.command : "");
    }
  });

  it("answers an error, without throwing, for a bad state or a game with no legal command", () => {
    expect("error" in handleBotRequest({ id: 1, state: "{}", level })).toBe(true);
    // The Whites have no dice, so there is nothing to play.
    const stuck = SeksGame.fromDiagram(
      Array.from({ length: 11 }, (_, i) => (i === 0 ? ".. .. .. .. .. .. .. .. .. .. b1" : ".. ".repeat(10) + "..")).join("\n"),
      "white",
    );
    const response = handleBotRequest({ id: 2, state: stuck.stateJson(), level });
    expect(response).toMatchObject({ id: 2, error: expect.stringContaining("no legal command") });
  });

  it("uses the random source it is given", () => {
    const game = SeksGame.create();
    const first = handleBotRequest({ id: 1, state: game.stateJson(), level }, () => 0);
    const last = handleBotRequest({ id: 1, state: game.stateJson(), level }, () => 0.999999);
    expect("command" in first && first.command).toBe(game.legalCommands()[0]);
    expect("command" in last && last.command).toBe(game.legalCommands().at(-1));
  });
});

describe("WorkerBot", () => {
  it("sends the state and the level and resolves with the command of the Worker", async () => {
    const worker = new InProcessWorker();
    const bot = new WorkerBot(() => worker);
    const game = SeksGame.create();
    const command = await bot.choose(game.stateJson(), level);
    expect(game.legalCommands()).toContain(command);
    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0]).toMatchObject({ state: game.stateJson(), level });
  });

  it("starts the Worker only when the first request comes, and reuses it", async () => {
    let spawned = 0;
    const worker = new InProcessWorker();
    const bot = new WorkerBot(() => (spawned++, worker));
    expect(spawned).toBe(0);
    const state = SeksGame.create().stateJson();
    await bot.choose(state, level);
    await bot.choose(state, level);
    expect(spawned).toBe(1);
    bot.dispose();
    expect(worker.terminated).toBe(true);
  });

  it("rejects a request that was cancelled and ignores its late answer", async () => {
    const worker = new InProcessWorker();
    worker.auto = false;
    const bot = new WorkerBot(() => worker);
    const state = SeksGame.create().stateJson();
    const first = bot.choose(state, level);
    bot.cancel();
    await expect(first).rejects.toBeInstanceOf(BotCancelled);
    const second = bot.choose(state, level);
    worker.flush();
    await expect(second).resolves.toMatch(/-|\+/);
  });

  it("rejects with the error of the Worker, and when the Worker dies", async () => {
    const worker = new InProcessWorker();
    const bot = new WorkerBot(() => worker);
    await expect(bot.choose("{}", level)).rejects.toThrow();

    const dying = new InProcessWorker();
    dying.auto = false;
    const bot2 = new WorkerBot(() => dying);
    const pending = bot2.choose(SeksGame.create().stateJson(), level);
    dying.onerror?.({});
    await expect(pending).rejects.toThrow(/parou/);
    expect(dying.terminated).toBe(true);
  });

  it("makes a quick answer wait for the minimum thinking time", async () => {
    const bot = new WorkerBot(() => new InProcessWorker(), 60);
    const started = Date.now();
    await bot.choose(SeksGame.create().stateJson(), level);
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
  });
});
