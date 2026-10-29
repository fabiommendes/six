import { describe, expect, it } from "vitest";
import { SheshBot, SheshGame, type Event } from "../src/engine/game";
import { effectsText, endText, eventText, floatText, happeningText, hint, moveText, pointsText, squaresText, turnTitle, winnerText } from "../src/logic/texts";

const NAMES = ["Ana", "Bia"];

/** Every event the engine produces over many games, by kind. */
function eventsByKind(): Map<string, Event[]> {
  const found = new Map<string, Event[]>();
  for (let seed = 1n; seed <= 40n; seed++) {
    const game = SheshGame.create(seed);
    const bots = [new SheshBot("random", Number(seed)), new SheshBot("greedy", 1)];
    while (game.view().end === null) {
      for (const event of game.command(bots[game.view().toMove]!.choose(game)).events) {
        const list = found.get(event.kind) ?? [];
        list.push(event);
        found.set(event.kind, list);
      }
    }
  }
  return found;
}

describe("texts", () => {
  const events = eventsByKind();

  it("says every event the games produce, in Portuguese", () => {
    for (const kind of ["rolled", "entered", "moved", "fused", "worn", "captured", "touched", "exited", "extraTurn", "ended"]) {
      expect(events.get(kind)?.length, kind).toBeGreaterThan(0);
    }
    const view = SheshGame.create(1n).view();
    for (const list of events.values()) {
      for (const event of list.slice(0, 20)) {
        const text = eventText(event, NAMES, view);
        expect(text, event.kind).toBeTruthy();
        expect(text).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it("uses the terms of the RFC for the five things that can happen", () => {
    const first = (kind: string) => events.get(kind)![0]!;
    expect(eventText(first("captured"), NAMES)).toMatch(/Comeu/);
    expect(eventText(first("worn"), NAMES)).toMatch(/Desgastou/);
    expect(eventText(first("touched"), NAMES)).toMatch(/Encostou/);
    expect(eventText(first("fused"), NAMES)).toMatch(/Fundiu/);
    expect(eventText(first("exited"), NAMES)).toMatch(/pontos?/);
  });

  it("floats a short word for the events worth one", () => {
    expect(floatText({ kind: "captured", player: 0, square: 7, value: 3, taken: 2 })).toBe("Comeu o 2");
    expect(floatText({ kind: "fused", player: 0, square: 7, value: 6, lost: 3 })).toBe("Fundiu · 6 (−3)");
    expect(floatText({ kind: "exited", player: 1, value: 4, points: 9 })).toBe("Saiu · +4");
    expect(floatText({ kind: "entered", player: 0, value: 1, square: 2 })).toBeNull();
    expect(happeningText({ kind: "rolled", player: 1, roll: 2 }, NAMES)).toBe("Bia rola os dados binários.");
  });

  it("describes a legal move with what it does", () => {
    for (let seed = 1n; seed < 60n; seed++) {
      const game = SheshGame.create(seed);
      const bot = new SheshBot("greedy", 1);
      for (let i = 0; i < 25 && game.view().end === null; i++) {
        const view = game.view();
        for (const move of view.moves) {
          const text = moveText(view, move);
          expect(text).not.toMatch(/undefined|NaN/);
          if (move.events.some((e) => e.kind === "captured")) expect(effectsText(move)).toMatch(/come o/);
        }
        game.command(bot.choose(game));
      }
      bot.free();
    }
  });

  it("tells what to do in each state of the turn", () => {
    for (let seed = 1n; seed < 20n; seed++) {
      const view = SheshGame.create(seed).view();
      expect(hint(view, null, NAMES)).toMatch(new RegExp(`deram ${view.roll}`));
      expect(hint(view, view.moves[0]!, NAMES)).toMatch(/Toque no destino/);
      expect(hint(view, null, NAMES, true)).toMatch(/pensando/);
    }
  });

  it("names the end of the game and the winner", () => {
    const view = { players: [{ points: 12 }, { points: 3 }] } as never;
    expect(endText({ kind: "points", player: 0 }, NAMES)).toBe("Ana chegou a 10 pontos.");
    expect(endText({ kind: "allHome", player: 1 }, NAMES, view)).toMatch(/Venceu quem tem mais pontos \(3 pontos contra 12\): Bia/);
    expect(winnerText(1, NAMES)).toBe("Bia venceu!");
    expect(winnerText(null, NAMES)).toBe("");
    expect(turnTitle(SheshGame.create(1n).view(), NAMES, false, 1)).toBe("Sua vez");
    expect(pointsText(1)).toBe("1 ponto");
    expect(squaresText(2)).toBe("2 casas");
  });
});
