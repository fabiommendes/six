import { describe, expect, it } from "vitest";
import { DEFAULT_BOT_LEVEL } from "../src/bot/levels";
import { SeksGame } from "../src/engine/game";
import { endingFixture } from "../src/logic/fixtures";
import { Match, type Mode } from "../src/logic/match";
import { endCard, hint, modeLine, sideTag, turnSubtitle } from "../src/logic/texts";
import { RecordingStage, ScriptedBot } from "./fakes";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function newMatch(game: SeksGame, mode: Mode, bot: ScriptedBot | null = null) {
  const stage = new RecordingStage();
  const pauses: number[] = [];
  const match = new Match(game, mode, stage, bot, {}, (ms) => {
    pauses.push(ms);
    return Promise.resolve();
  });
  return { match, stage, pauses };
}

describe("Terminar com bots: the bots play both sides to the end", () => {
  it("from hotseat: plays the rest, with a pause before each play, and ends the game", async () => {
    const { match, pauses } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    await match.click("b2");
    await match.click("b4");
    const bot = new ScriptedBot();
    bot.queue = ["b10-b8", "b4-b5"];
    void match.finishWithBots(bot, DEFAULT_BOT_LEVEL);
    await tick();
    expect(match.mode).toEqual({ kind: "bots", level: DEFAULT_BOT_LEVEL, stopped: false });
    expect(match.record().commands).toEqual(["b2-b4", "b10-b8", "b4-b5"]);
    expect(pauses.length).toBe(3);
    // Both sides were asked, with the level given.
    expect(bot.requests.map((request) => request.level)).toEqual([DEFAULT_BOT_LEVEL, DEFAULT_BOT_LEVEL, DEFAULT_BOT_LEVEL]);
  });

  it("takes no click, no undo and shows no side as the human's", async () => {
    const { match } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    await match.click("b2");
    await match.click("b4");
    const bot = new ScriptedBot();
    void match.finishWithBots(bot, DEFAULT_BOT_LEVEL);
    await tick();
    const snapshot = match.snapshot();
    expect(snapshot.canUndo).toBe(false);
    expect(snapshot.humanToMove).toBe(false);
    expect(snapshot.thinking).toBe(true);
    await match.click("b10");
    expect(match.snapshot().selection).toBeNull();
    match.undo();
    expect(match.record().commands).toEqual(["b2-b4"]);
  });

  it("the end shows the neutral result: no side is the player's", async () => {
    const fixture = endingFixture();
    const { match } = newMatch(fixture.game, fixture.mode);
    await match.start();
    const bot = new ScriptedBot();
    bot.queue = ["c8-c11"];
    void match.finishWithBots(bot, DEFAULT_BOT_LEVEL);
    await tick();
    const snapshot = match.snapshot();
    expect(snapshot.view.outcome).toMatchObject({ kind: "win", winner: "white" });
    expect(endCard(snapshot)).toMatchObject({ title: "Vitória das Brancas", tone: "neutral" });
    expect(snapshot.thinking).toBe(false);
  });

  it("the player can interrupt: the bots stop and the position stays", async () => {
    const { match } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    const bot = new ScriptedBot();
    bot.queue = ["c1-d1"];
    void match.finishWithBots(bot, DEFAULT_BOT_LEVEL);
    await tick();
    expect(bot.requests).toHaveLength(2);
    match.stopBots();
    expect(bot.cancelled).toBeGreaterThan(0);
    expect(match.mode).toMatchObject({ kind: "bots", stopped: true });
    expect(match.snapshot().thinking).toBe(false);
    await tick();
    expect(match.record().commands).toEqual(["c1-d1"]);
    expect(turnSubtitle(match.snapshot())).toBe("Os bots pararam.");
    expect(hint(match.snapshot(), "clique").strong).toBe("Partida interrompida.");
  });

  it("from a match against the bot: the answer in flight is dropped and the other side is asked next", async () => {
    const bot = new ScriptedBot();
    const { match } = newMatch(SeksGame.create(), { kind: "bot", human: "black", level: DEFAULT_BOT_LEVEL }, bot);
    void match.start();
    await tick();
    expect(bot.requests).toHaveLength(1);
    bot.queue = ["c1-d1", "b10-c9"];
    void match.finishWithBots(bot, DEFAULT_BOT_LEVEL);
    await tick();
    expect(bot.cancelled).toBeGreaterThan(0);
    expect(match.record().commands).toEqual(["c1-d1", "b10-c9"]);
  });

  it("while a play is on screen, the bots wait for it to land", async () => {
    const { match, stage } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    let release!: () => void;
    stage.gate = new Promise<void>((resolve) => (release = resolve));
    const clicks = (async () => {
      await match.click("b2");
      await match.click("b4");
    })();
    await tick();
    expect(match.snapshot().busy).toBe(true);
    const bot = new ScriptedBot();
    await match.finishWithBots(bot, DEFAULT_BOT_LEVEL);
    expect(bot.requests).toHaveLength(0);
    release();
    await tick();
    void clicks;
    expect(bot.requests).toHaveLength(1);
  });

  it("texts say the bots play and who is a bot", async () => {
    const { match } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    void match.finishWithBots(new ScriptedBot(), DEFAULT_BOT_LEVEL);
    await tick();
    const snapshot = match.snapshot();
    expect(modeLine(snapshot.mode)).toBe("Os bots jogam o resto da partida · Brancas contra Pretas");
    expect(sideTag(snapshot.mode, "white")).toBe("bot");
    expect(sideTag(snapshot.mode, "black")).toBe("bot");
    expect(turnSubtitle(snapshot)).toBe("Os bots estão jogando.");
    expect(hint(snapshot, "clique").strong).toBe("Assista.");
  });

  it("a match by correspondence cannot be handed to bots", async () => {
    const { match } = newMatch(SeksGame.create(), { kind: "correspondence", human: "white", id: "abc" });
    await match.start();
    await match.finishWithBots(new ScriptedBot(), DEFAULT_BOT_LEVEL);
    expect(match.mode.kind).toBe("correspondence");
  });
});
