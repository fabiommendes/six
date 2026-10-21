import { describe, expect, it } from "vitest";
import { LiuGame } from "../src/engine/game";
import { lineCells, marketFits, newLines, sealCounts, sealOwner, takenDie } from "../src/logic/feedback";

describe("feedback", () => {
  it("finds the lines a play completes, and their cells", () => {
    const game = LiuGame.create(2, 5n);
    let found = false;
    for (let i = 0; i < 400 && game.view().end === null && !found; i++) {
      const before = game.view();
      const command = game.legalCommands().find((c) => c.kind === "placeFromMarket") ?? game.legalCommands()[0]!;
      const after = game.command(command).view;
      for (let p = 0; p < after.players.length; p++) {
        const lines = newLines(before.players[p]!.score, after.players[p]!.score);
        for (const line of lines) {
          found = true;
          const cells = lineCells(after.players[p]!, line);
          expect(cells).toHaveLength(4);
          for (const at of cells) expect(line.kind === "row" ? at.row : at.col).toBe(line.index);
        }
      }
    }
    expect(found).toBe(true);
  });

  it("counts the seal numbers in the market and says whose a die is", () => {
    const view = LiuGame.create(3, 2n).view();
    const counts = sealCounts(view);
    view.players.forEach((p, i) => expect(counts[i]).toBe(view.market.filter((v) => v === p.seal).length));
    expect(sealOwner(view, view.players[1]!.seal)).toBe(1);
    const free = [1, 2, 3, 4, 5, 6].find((v) => !view.players.some((p) => p.seal === v))!;
    expect(sealOwner(view, free)).toBeNull();
  });

  it("marks the market dice that fit nowhere", () => {
    const view = LiuGame.create(2, 9n).view();
    expect(marketFits(view)).toEqual(view.market.map((v) => view.targets[v - 1]!.length > 0));
  });

  it("knows which market die a command takes", () => {
    expect(takenDie({ kind: "keep", die: 2 })).toBe(2);
    expect(takenDie({ kind: "placeFromHand", die: 1, at: { row: 0, col: 1 } })).toBe(1);
    expect(takenDie({ kind: "pass" })).toBeNull();
  });
});
