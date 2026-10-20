import { describe, expect, it } from "vitest";
import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../src/bot/levels";
import { SeksGame, type Side } from "../src/engine/game";
import type { Mode } from "../src/logic/match";
import { newMatch, ScriptedBot } from "./fakes";

const hotseat: Mode = { kind: "hotseat" };
const botMode = (human: Side): Mode => ({ kind: "bot", human, level: DEFAULT_BOT_LEVEL });

function diagram(dice: Record<string, string>): string {
  const rows: string[] = [];
  for (let row = 11; row >= 1; row--) {
    rows.push(Array.from({ length: 11 }, (_, col) => dice[`${"abcdefghijk"[col]}${row}`] ?? "..").join(" "));
  }
  return rows.join("\n");
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("Match in hotseat: the clicks of R2", () => {
  it("selects a die, marks the destinations the engine gives and shows no list of plays", async () => {
    const { match, stage, game } = newMatch(SeksGame.create(), hotseat);
    await match.start();
    await match.click("b2");
    expect(match.snapshot().selection?.at).toBe("b2");
    expect(stage.lastMarks.selected).toBe("b2");
    expect([...stage.lastMarks.destinations].sort()).toEqual([...game.options("b2").moves].sort());
  });

  it("moves with a click on a destination, animates the events and passes the turn", async () => {
    const { match, stage } = newMatch(SeksGame.create(), hotseat);
    await match.start();
    await match.click("b2");
    await match.click("b4");
    const snapshot = match.snapshot();
    expect(snapshot.selection).toBeNull();
    expect(snapshot.view.to_move).toBe("black");
    expect(snapshot.view.dice.find((die) => die.cell === "b4")).toMatchObject({ side: "white", value: 2 });
    expect(stage.animations).toHaveLength(1);
    expect(stage.animations[0]?.events[0]).toMatchObject({ type: "moved", from: "b2", to: "b4" });
    expect(stage.animations[0]?.marks).toMatchObject({ selected: null, destinations: [], lastFrom: "b2", lastTo: "b4" });
    expect(snapshot.last).toEqual({ side: "white", from: "b2", to: "b4", value: 2, captures: 0 });
  });

  it("increments with a second click on the selected die", async () => {
    // The Whites must move on the first turn: open with a move of each side.
    const game = SeksGame.create();
    game.command("k2-k3");
    game.command("k10-k9");
    const { match, stage } = newMatch(game, hotseat);
    await match.start();
    await match.click("b2");
    await match.click("b2");
    const snapshot = match.snapshot();
    expect(snapshot.view.dice.find((die) => die.cell === "b2")?.value).toBe(3);
    expect(snapshot.view.to_move).toBe("black");
    expect(stage.animations[0]?.events[0]).toMatchObject({ type: "incremented", at: "b2", value: 3 });
    expect(stage.animations[0]?.marks).toMatchObject({ lastFrom: null, lastTo: "b2" });
  });

  it("on a 6, the second click only clears the selection and the turn stays", async () => {
    const game = SeksGame.fromDiagram(diagram({ f6: "w6", a1: "w1", k11: "b1" }), "white");
    const { match, stage } = newMatch(game, hotseat);
    await match.start();
    await match.click("f6");
    expect(match.snapshot().selection?.canIncrement).toBe(false);
    await match.click("f6");
    expect(match.snapshot().selection).toBeNull();
    expect(match.snapshot().view.to_move).toBe("white");
    expect(stage.animations).toHaveLength(0);
    expect(stage.lastMarks.selected).toBeNull();
  });

  it("changes the selection to another die of the player", async () => {
    const { match, stage } = newMatch(SeksGame.create(), hotseat);
    await match.start();
    await match.click("b2");
    await match.click("c2");
    expect(match.snapshot().selection?.at).toBe("c2");
    expect(stage.lastMarks.selected).toBe("c2");
  });

  it("clears the selection with a click on anything else", async () => {
    const { match, stage } = newMatch(SeksGame.create(), hotseat);
    await match.start();
    await match.click("b2");
    await match.click("h6");
    expect(match.snapshot().selection).toBeNull();
    expect(stage.lastMarks).toMatchObject({ selected: null, destinations: [] });
    await match.click("b2");
    await match.click("b10"); // a die of the opponent
    expect(match.snapshot().selection).toBeNull();
    expect(match.snapshot().view.to_move).toBe("white");
  });

  it("does not select a die of the side that is not to move", async () => {
    const { match } = newMatch(SeksGame.create(), hotseat);
    await match.start();
    await match.click("b10");
    expect(match.snapshot().selection).toBeNull();
  });

  it("takes no input while a play is being animated", async () => {
    const { match, stage } = newMatch(SeksGame.create(), hotseat);
    let open!: () => void;
    stage.gate = new Promise<void>((resolve) => (open = resolve));
    await match.start();
    await match.click("b2");
    const playing = match.click("b4");
    expect(match.snapshot().busy).toBe(true);
    expect(match.snapshot().canUndo).toBe(false);
    await match.click("b10");
    open();
    await playing;
    expect(match.snapshot().busy).toBe(false);
    expect(match.snapshot().selection).toBeNull();
  });

  it("takes no input after the game ends", async () => {
    const game = SeksGame.fromDiagram(diagram({ e5: "w6", a1: "w1", k11: "b1" }), "white");
    const { match } = newMatch(game, hotseat);
    await match.start();
    await match.click("e5");
    await match.click("e11");
    expect(match.snapshot().view.outcome).toMatchObject({ kind: "win", winner: "white", reason: "back_row" });
    expect(match.snapshot().humanToMove).toBe(false);
    await match.click("a1");
    expect(match.snapshot().selection).toBeNull();
  });
});

describe("Match: captures and the last play", () => {
  // The white 3 at d6 goes to d4... a capture needs a black die between two whites.
  const position = () => SeksGame.fromDiagram(diagram({ a4: "w1", a5: "b2", a7: "w3", k11: "b1", k1: "w1" }), "white");

  it("keeps the captured dice and counts them in the last play", async () => {
    const { match, stage } = newMatch(position(), hotseat);
    await match.start();
    await match.click("a7");
    await match.click("a6");
    const snapshot = match.snapshot();
    expect(snapshot.captured).toEqual([{ side: "black", value: 2 }]);
    expect(snapshot.last).toMatchObject({ from: "a7", to: "a6", captures: 1 });
    expect(stage.animations[0]?.events.map((event) => event.type)).toEqual(["moved", "captured"]);
  });

  it("starts from the captured dice and the last play of a loaded position", async () => {
    const last = { side: "black", from: "g8", to: "g6", value: 2, captures: 0 } as const;
    const { match } = newMatch(position(), hotseat, null, { last, captured: [{ side: "white", value: 2 }] });
    await match.start();
    expect(match.snapshot().last).toEqual(last);
    expect(match.snapshot().captured).toEqual([{ side: "white", value: 2 }]);
    expect(match.snapshot().canUndo).toBe(false);
  });
});

describe("Match: undo (R6)", () => {
  it("in hotseat takes back one play at a time, even the one that ended the game", async () => {
    const { match, stage } = newMatch(SeksGame.create(), hotseat);
    await match.start();
    expect(match.snapshot().canUndo).toBe(false);
    await match.click("b2");
    await match.click("b4");
    await match.click("b10");
    await match.click("b8");
    match.undo();
    expect(match.snapshot().view.to_move).toBe("black");
    expect(match.snapshot().last).toMatchObject({ from: "b2", to: "b4" });
    expect(stage.shown.at(-1)?.marks).toMatchObject({ lastFrom: "b2", lastTo: "b4", selected: null });
    match.undo();
    expect(match.snapshot().view.to_move).toBe("white");
    expect(match.snapshot().last).toBeNull();
    expect(match.snapshot().canUndo).toBe(false);
    match.undo(); // nothing to undo: no effect
    expect(match.snapshot().view.dice.find((die) => die.cell === "b2")).toBeDefined();
  });

  it("clears the selection and brings back the captured dice", async () => {
    const position = SeksGame.fromDiagram(diagram({ a4: "w1", a5: "b2", a7: "w3", k11: "b1", k1: "w1" }), "white");
    const { match } = newMatch(position, hotseat);
    await match.start();
    await match.click("a7");
    await match.click("a6");
    expect(match.snapshot().captured).toHaveLength(1);
    match.undo();
    expect(match.snapshot().captured).toEqual([]);
    expect(match.snapshot().view.dice.find((die) => die.cell === "a5")).toMatchObject({ side: "black" });
  });

  it("against the bot goes back to the last human play, bot answer included", async () => {
    const bot = new ScriptedBot();
    bot.queue = ["b10-b8", "c10-c8"];
    const { match } = newMatch(SeksGame.create(), botMode("white"), bot);
    await match.start();
    await match.click("b2");
    await match.click("b4"); // human, then the bot plays b10-b8
    await match.click("c2");
    await match.click("c4"); // human, then the bot plays c10-c8
    expect(match.snapshot().view.to_move).toBe("white");
    expect(match.snapshot().canUndo).toBe(true);

    match.undo();
    let snapshot = match.snapshot();
    expect(snapshot.view.to_move).toBe("white");
    expect(snapshot.view.dice.find((die) => die.cell === "c2")).toBeDefined();
    expect(snapshot.view.dice.find((die) => die.cell === "c10")).toBeDefined();
    expect(snapshot.view.dice.find((die) => die.cell === "b8")).toBeDefined();
    expect(snapshot.last).toMatchObject({ side: "black", from: "b10", to: "b8" });

    match.undo();
    snapshot = match.snapshot();
    expect(snapshot.view.dice.find((die) => die.cell === "b2")).toBeDefined();
    expect(snapshot.view.dice.find((die) => die.cell === "b10")).toBeDefined();
    expect(snapshot.last).toBeNull();
    expect(snapshot.canUndo).toBe(false);
  });

  it("while the bot is thinking, cancels it and gives the turn back to the human", async () => {
    const bot = new ScriptedBot();
    const { match } = newMatch(SeksGame.create(), botMode("white"), bot);
    await match.start();
    await match.click("b2");
    const playing = match.click("b4");
    await tick();
    expect(match.snapshot().thinking).toBe(true);
    expect(match.snapshot().canUndo).toBe(true);
    match.undo();
    await playing;
    expect(bot.cancelled).toBeGreaterThan(0);
    const snapshot = match.snapshot();
    expect(snapshot.thinking).toBe(false);
    expect(snapshot.view.to_move).toBe("white");
    expect(snapshot.view.dice.find((die) => die.cell === "b2")).toBeDefined();
    // A late answer of the cancelled request does nothing.
    expect(bot.requests).toHaveLength(1);
  });

  it("when the human plays Blacks, the first bot play is not undone", async () => {
    const bot = new ScriptedBot();
    bot.queue = ["b2-b4"];
    const { match } = newMatch(SeksGame.create(), botMode("black"), bot);
    await match.start();
    expect(match.snapshot().view.to_move).toBe("black");
    expect(match.snapshot().canUndo).toBe(false);
    bot.queue = ["c2-c4"];
    await match.click("b10");
    await match.click("b8");
    expect(match.snapshot().canUndo).toBe(true);
    match.undo();
    expect(match.snapshot().view.to_move).toBe("black");
    expect(match.snapshot().last).toMatchObject({ side: "white", from: "b2", to: "b4" });
    expect(match.snapshot().canUndo).toBe(false);
  });
});

describe("Match against the bot (R1, R5)", () => {
  it("hands the bot the state and the level, then plays what it answers", async () => {
    const bot = new ScriptedBot();
    const level = BOT_LEVELS[2]!;
    const { match, game } = newMatch(SeksGame.create(), { kind: "bot", human: "white", level }, bot);
    await match.start();
    expect(bot.requests).toHaveLength(0); // the human plays first
    await match.click("b2");
    const playing = match.click("b4");
    await tick();
    expect(bot.requests).toHaveLength(1);
    expect(bot.requests[0]?.level).toBe(level);
    expect(SeksGame.fromStateJson(bot.requests[0]!.state).view().to_move).toBe("black");
    expect(match.snapshot().thinking).toBe(true);
    expect(match.snapshot().humanToMove).toBe(false);
    bot.answer("b10-b8");
    await playing;
    expect(match.snapshot().thinking).toBe(false);
    expect(match.snapshot().humanToMove).toBe(true);
    expect(game.view().dice.find((die) => die.cell === "b8")).toMatchObject({ side: "black", value: 2 });
  });

  it("ignores clicks while the bot thinks", async () => {
    const bot = new ScriptedBot();
    const { match } = newMatch(SeksGame.create(), botMode("white"), bot);
    await match.start();
    await match.click("b2");
    const playing = match.click("b4");
    await tick();
    await match.click("c2");
    expect(match.snapshot().selection).toBeNull();
    bot.answer("b10-b8");
    await playing;
  });

  it("does not let the human move the bot's dice", async () => {
    const bot = new ScriptedBot();
    bot.queue = ["b2-b4"];
    const { match } = newMatch(SeksGame.create(), botMode("black"), bot);
    await match.start();
    await match.click("b4"); // a white die: the bot's
    expect(match.snapshot().selection).toBeNull();
    await match.click("b10");
    expect(match.snapshot().selection?.at).toBe("b10");
  });

  it("shows the error when the bot fails, and stops waiting", async () => {
    const bot = new ScriptedBot();
    const { match } = newMatch(SeksGame.create(), botMode("white"), bot);
    await match.start();
    await match.click("b2");
    const playing = match.click("b4");
    await tick();
    bot.fail(new Error("o bot parou de responder"));
    await playing;
    const snapshot = match.snapshot();
    expect(snapshot.thinking).toBe(false);
    expect(snapshot.error).toBe("o bot parou de responder");
    // The human can still undo and play on.
    expect(snapshot.canUndo).toBe(true);
    match.undo();
    expect(match.snapshot().error).toBeNull();
  });

  it("shows the error when the bot answers an illegal command", async () => {
    const bot = new ScriptedBot();
    bot.queue = ["b10-b3"];
    const { match } = newMatch(SeksGame.create(), botMode("white"), bot);
    await match.start();
    await match.click("b2");
    await match.click("b4");
    expect(match.snapshot().error).toBeTruthy();
    expect(match.snapshot().thinking).toBe(false);
    expect(match.snapshot().view.to_move).toBe("black");
  });

  it("stops quietly when disposed while the bot thinks", async () => {
    const bot = new ScriptedBot();
    const { match } = newMatch(SeksGame.create(), botMode("white"), bot);
    await match.start();
    await match.click("b2");
    const playing = match.click("b4");
    await tick();
    match.dispose();
    await playing;
    expect(bot.cancelled).toBeGreaterThan(0);
  });
});

describe("Match notifications", () => {
  it("tells the subscribers after every change, and unsubscribes", async () => {
    const { match } = newMatch(SeksGame.create(), hotseat);
    const seen: (string | null)[] = [];
    const off = match.subscribe((snapshot) => seen.push(snapshot.selection?.at ?? null));
    await match.start();
    await match.click("b2");
    await match.click("b4");
    expect(seen).toContain("b2");
    const count = seen.length;
    off();
    match.undo();
    expect(seen).toHaveLength(count);
  });
});
