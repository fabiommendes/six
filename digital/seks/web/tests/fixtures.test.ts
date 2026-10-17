import { describe, expect, it } from "vitest";
import { FIXTURES, sketchFixture, withPliesWithoutCapture } from "../src/logic/fixtures";
import { SeksGame } from "../src/engine/game";
import { newMatch } from "./fakes";

describe("the fixture of the sketch", () => {
  it("is the position of the art sketch: Whites to move, 23 plies without capture", () => {
    const fixture = sketchFixture();
    const view = fixture.game.view();
    expect(view.to_move).toBe("white");
    expect(view.plies_without_capture).toBe(23);
    expect(view.dice.find((die) => die.cell === "f6")).toEqual({ cell: "f6", side: "white", value: 6 });
    expect(view.dice.find((die) => die.cell === "g6")).toEqual({ cell: "g6", side: "black", value: 2 });
    expect(view.outcome).toBeNull();
    expect(FIXTURES.esboco).toBe(sketchFixture);
  });

  it("has 16 dice per side minus the captured ones, as the sketch counts", () => {
    const fixture = sketchFixture();
    const dice = fixture.game.view().dice;
    for (const side of ["white", "black"] as const) {
      const captured = fixture.captured.filter((die) => die.side === side).length;
      expect(dice.filter((die) => die.side === side)).toHaveLength(16 - captured);
    }
  });

  it("selects f6 and the engine gives it the 23 cells of the sketch", async () => {
    const fixture = sketchFixture();
    const { match, stage } = newMatch(fixture.game, fixture.mode, null, { last: fixture.last, captured: fixture.captured });
    await match.start();
    await match.click(fixture.select!);
    expect(stage.lastMarks.selected).toBe("f6");
    expect(stage.lastMarks.destinations).toHaveLength(23);
    expect(stage.lastMarks).toMatchObject({ lastFrom: "g8", lastTo: "g6" });
    expect(match.snapshot().canUndo).toBe(false);
  });
});

describe("withPliesWithoutCapture", () => {
  it("keeps the position and sets the count", () => {
    const game = SeksGame.create();
    const same = withPliesWithoutCapture(game, 80);
    expect(same.view().dice).toEqual(game.view().dice);
    expect(same.view().plies_without_capture).toBe(80);
  });
});

describe("the fixtures for looking at the screen", () => {
  it("counter shows the count by the rule, with no selection", () => {
    const fixture = FIXTURES.contador!();
    expect(fixture.game.view().plies_without_capture).toBe(85);
    expect(fixture.counterFrom).toBeNull();
    expect(fixture.select).toBeNull();
  });

  it("ending ends the game with a single move: c8 to c11", async () => {
    const fixture = FIXTURES.fim!();
    const { match } = newMatch(fixture.game, fixture.mode, null);
    await match.start();
    await match.click("c8");
    await match.click("c11");
    expect(match.snapshot().view.outcome).toEqual({ kind: "win", winner: "white", reason: "back_row" });
  });
});
