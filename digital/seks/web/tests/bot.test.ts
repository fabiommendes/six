import { describe, expect, it } from "vitest";
import { BotCancelled, WorkerBot, type WorkerLike } from "../src/bot/client";
import { BotRunner } from "../src/bot/chooser";
import { handleBotRequest } from "../src/bot/handler";
import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../src/bot/levels";
import type { BotLevel, BotRequest } from "../src/bot/protocol";
import { SeksBot, SeksGame } from "../src/engine/game";

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

  it("grows the search from level to level, and the strongest one is the default of the bots", () => {
    const [easy, medium, hard] = BOT_LEVELS;
    expect(easy!.nodes!).toBeLessThan(medium!.nodes!);
    expect(hard).toMatchObject({ nodes: null, depth: null, noise: 0 });
    expect(SeksBot.defaultNodes()).toBeGreaterThan(medium!.nodes!);
    expect(easy!.noise).toBeGreaterThan(medium!.noise);
    expect(medium!.noise).toBeGreaterThan(hard!.noise);
  });

  it("builds a bot for each level", () => {
    for (const l of BOT_LEVELS) new SeksBot(l).free();
  });
});

describe("handleBotRequest", () => {
  it("rebuilds the game from its state and answers a legal command, at every level", () => {
    const game = SeksGame.create();
    game.command("b2-b4");
    for (const l of BOT_LEVELS) {
      const response = handleBotRequest({ id: 7, state: game.stateJson(), level: l });
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

  it("plays the same command for the same random source, and noise makes the source matter", () => {
    const game = SeksGame.create();
    const easy = BOT_LEVELS[0]!;
    const play = (source: number) => handleBotRequest({ id: 1, state: game.stateJson(), level: easy }, undefined, () => source);
    expect(play(0.25)).toEqual(play(0.25));
    const commands = new Set(
      Array.from({ length: 40 }, (_, i) => {
        const response = play(i / 40);
        return "command" in response ? response.command : "";
      }),
    );
    expect(commands.size).toBeGreaterThan(1);
  });

  it("keeps the bot of the runner between requests and swaps it when the level changes", () => {
    const runner = new BotRunner();
    const game = SeksGame.create();
    for (const l of [BOT_LEVELS[0]!, BOT_LEVELS[0]!, BOT_LEVELS[1]!, BOT_LEVELS[0]!]) {
      const response = handleBotRequest({ id: 1, state: game.stateJson(), level: l }, runner);
      expect("command" in response).toBe(true);
    }
    runner.dispose();
    expect("command" in handleBotRequest({ id: 2, state: game.stateJson(), level: BOT_LEVELS[1]! }, runner)).toBe(true);
    runner.dispose();
  });

  it("plays whole games: the Hard level beats the Easy one with either colour", () => {
    const [easy, , defaultHard] = BOT_LEVELS as [BotLevel, BotLevel, BotLevel];
    // Hard without noise, on a smaller budget than the default level so the
    // test stays fast.
    const hard: BotLevel = { ...defaultHard, nodes: 5000 };
    for (const hardSide of ["white", "black"] as const) {
      const runners = { easy: new BotRunner(), hard: new BotRunner() };
      const game = SeksGame.create();
      let seed = hardSide === "white" ? 1 : 2;
      const source = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
      let view = game.view();
      for (let ply = 0; ply < 300 && view.outcome === null; ply++) {
        const isHard = view.to_move === hardSide;
        const response = handleBotRequest(
          { id: ply, state: game.stateJson(), level: isHard ? hard : easy },
          isHard ? runners.hard : runners.easy,
          source,
        );
        if (!("command" in response)) throw new Error(response.error);
        view = game.command(response.command).view;
      }
      expect(view.outcome).toMatchObject({ kind: "win", winner: hardSide });
      runners.easy.dispose();
      runners.hard.dispose();
    }
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
