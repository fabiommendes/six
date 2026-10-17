import { describe, expect, it } from "vitest";
import { cellName, parseCell } from "../src/engine/cells";
import { SeksGame } from "../src/engine/game";

describe("cells", () => {
  it("reads and writes the notation of the engine", () => {
    expect(parseCell("a1")).toEqual({ col: 0, row: 1 });
    expect(parseCell("k11")).toEqual({ col: 10, row: 11 });
    expect(cellName(5, 6)).toBe("f6");
    for (const bad of ["", "l1", "a0", "a12", "f", "6f"]) expect(() => parseCell(bad)).toThrow();
  });
});

describe("SeksGame", () => {
  it("starts with the Whites to move and 16 dice each", () => {
    const game = SeksGame.create();
    const view = game.view();
    expect(view.to_move).toBe("white");
    expect(view.dice.filter((die) => die.side === "white")).toHaveLength(16);
    expect(view.dice.filter((die) => die.side === "black")).toHaveLength(16);
    expect(game.canUndo()).toBe(false);
  });

  it("gives the options of a die and plays commands, with undo", () => {
    const game = SeksGame.create();
    expect(game.options("b2").moves).toContain("b4");
    expect(game.options("b2").can_increment).toBe(true);
    const transition = game.command("b2-b4");
    expect(transition.events[0]).toMatchObject({ type: "moved", from: "b2", to: "b4", value: 2 });
    expect(transition.view.to_move).toBe("black");
    expect(game.canUndo()).toBe(true);
    expect(game.undo().to_move).toBe("white");
    expect(game.legalCommands()).toContain("b2-b4");
  });

  it("throws the engine's error for an illegal command and keeps the game", () => {
    const game = SeksGame.create();
    const before = game.stateJson();
    expect(() => game.command("b2-b9")).toThrow();
    expect(game.stateJson()).toBe(before);
  });

  it("hands a game over as state JSON, and reads a diagram", () => {
    const game = SeksGame.create();
    game.command("b2-b4");
    const copy = SeksGame.fromStateJson(game.stateJson());
    expect(copy.view()).toEqual(game.view());
    expect(SeksGame.fromState(game.state()).view()).toEqual(game.view());
    const diagram = Array.from({ length: 11 }, (_, i) => (i === 10 ? "w1 .. .. .. .. .. .. .. .. .. .." : ".. ".repeat(10) + "..")).join("\n");
    expect(SeksGame.fromDiagram(diagram, "black").view().dice).toEqual([{ cell: "a1", side: "white", value: 1 }]);
  });
});
