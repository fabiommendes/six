import { describe, expect, it } from "vitest";
import { LocalGame, type Answer, type View } from "../src/engine/game";
import { GameHandler } from "../src/engine/handler";
import { stepLine } from "../src/logic/texts";

const names = ["Ana", "Bia", "Caio", "Davi"];

/** A simple legal answer from the options of the view. */
function answerFor(view: View, turn: number): Answer {
  const { player, decision } = view.pending!;
  switch (decision.kind) {
    case "select":
      return { kind: "select", dice: view.reserves[player]!.map((_, i) => i).slice(0, decision.count) };
    case "cash":
      return { kind: "cash", dice: decision.options.slice(0, 1) };
    case "buy":
      return { kind: "buy", die: decision.options[0] ?? null };
    case "place":
      return { kind: "place", spot: decision.spots[turn % decision.spots.length]! };
    case "act": {
      const zero = decision.zeros[0];
      if (zero && turn % 2 === 0) return { kind: "act", action: { kind: "zero", zero: zero.die, target: zero.targets[0]! } };
      const mod = decision.modifiers[0];
      if (mod) return { kind: "act", action: { kind: "modify", modifier: mod.die, target: mod.targets[0]!, up: turn % 3 === 0 } };
      if (decision.sabotage.length > 0 && turn % 7 === 0) return { kind: "act", action: { kind: "sabotage", spot: decision.sabotage[0]! } };
      return { kind: "act", action: { kind: "pass" } };
    }
  }
}

describe("a game through the wasm engine", () => {
  it("people and a bot play to the end, and every step reads as a history line", () => {
    const game = new LocalGame({ bots: [null, "greedy", null], goal: 10 }, 11n);
    let view = game.viewNow();
    let turn = 0;
    while (view.pending) {
      const step = game.botToMove() ? game.playBotNow() : game.applyNow(answerFor(view, turn));
      const line = stepLine(step, view, names);
      expect(line).toMatch(/^(Ana|Bia|Caio) /);
      expect(line).not.toMatch(/undefined|NaN/);
      view = step.view;
      expect(++turn).toBeLessThan(5000);
    }
    expect(view.winners!.length).toBeGreaterThan(0);
    expect(Math.max(...view.points)).toBeGreaterThanOrEqual(10);
    game.dispose();
  });

  it("an illegal answer rejects and changes nothing", async () => {
    const game = new LocalGame({ bots: [null, null] }, 2n);
    const before = await game.view();
    await expect(game.apply({ kind: "select", dice: [0] })).rejects.toThrow(/selected/);
    expect(await game.view()).toEqual(before);
    game.dispose();
  });

  it("the Worker handler starts a game and answers errors as messages", () => {
    const handler = new GameHandler();
    expect(handler.handle({ id: 1, op: "view" })).toEqual({ id: 1, error: "no game started" });
    const started = handler.handle({ id: 2, op: "start", setup: { bots: ["random", "random"] }, seed: "5" });
    expect("view" in started && started.view.players).toBe(2);
    const step = handler.handle({ id: 3, op: "bot" });
    expect("step" in step && step.step.answer.kind).toBe("select");
    expect(handler.handle({ id: 4, op: "start", setup: { bots: [null] }, seed: "1" })).toMatchObject({ id: 4, error: expect.stringMatching(/2 to 4/) });
  });
});
