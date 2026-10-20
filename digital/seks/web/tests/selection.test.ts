import { describe, expect, it } from "vitest";
import { SeksGame, type Side } from "../src/engine/game";
import { click, type Selection, type SelectionBoard } from "../src/logic/selection";

/** The selection board over a real game, as the match builds it. */
function boardOf(game: SeksGame): SelectionBoard {
  const view = game.view();
  return {
    isOwnDie: (cell) => view.dice.some((die) => die.cell === cell && die.side === view.to_move),
    options: (cell) => game.options(cell),
  };
}

function diagram(dice: Record<string, string>): string {
  const rows: string[] = [];
  for (let row = 11; row >= 1; row--) {
    rows.push(Array.from({ length: 11 }, (_, col) => dice[`${"abcdefghijk"[col]}${row}`] ?? "..").join(" "));
  }
  return rows.join("\n");
}

const open = (dice: Record<string, string>, toMove: Side = "white") => SeksGame.fromDiagram(diagram(dice), toMove);

function selected(game: SeksGame, cell: string): Selection {
  const result = click(null, cell, boardOf(game));
  expect(result.selection).not.toBeNull();
  return result.selection!;
}

describe("click: select", () => {
  it("selects a die of the player and takes the destinations from the engine", () => {
    const game = SeksGame.create();
    const result = click(null, "b2", boardOf(game));
    expect(result.command).toBeNull();
    // The Whites must move on the first turn.
    expect(result.selection).toEqual({ at: "b2", moves: game.options("b2").moves, canIncrement: false, shots: [] });
    expect([...result.selection!.moves].sort()).toEqual(["a3", "b1", "b3", "b4", "c3", "d4"]);
  });

  it("does not select a die of the opponent, an empty cell or anything else", () => {
    const game = SeksGame.create();
    expect(click(null, "b10", boardOf(game))).toEqual({ selection: null, command: null });
    expect(click(null, "f6", boardOf(game))).toEqual({ selection: null, command: null });
  });

  it("selects a die that has no play, such as a 6 surrounded", () => {
    const game = open({ a1: "w6", b1: "b1", a2: "b1", b2: "b1", k11: "w1" });
    const selection = selected(game, "a1");
    expect(selection.moves).toEqual([]);
    expect(selection.canIncrement).toBe(false);
  });
});

describe("click: move", () => {
  it("moves the selected die to a marked cell", () => {
    const game = SeksGame.create();
    const selection = selected(game, "b2");
    expect(click(selection, "b4", boardOf(game))).toEqual({ selection: null, command: "b2-b4" });
  });

  it("moves in every direction the engine allows, and no farther", () => {
    const game = open({ f6: "w3", k11: "b1", a1: "w1" });
    const selection = selected(game, "f6");
    expect(click(selection, "i9", boardOf(game)).command).toBe("f6-i9");
    expect(click(selection, "f3", boardOf(game)).command).toBe("f6-f3");
    // Four cells away is out of reach of a 3: that is a click elsewhere.
    expect(click(selection, "f10", boardOf(game))).toEqual({ selection: null, command: null });
  });

  it("produces commands that the engine accepts", () => {
    const game = SeksGame.create();
    const result = click(selected(game, "b2"), "d4", boardOf(game));
    expect(game.command(result.command!).events[0]).toMatchObject({ type: "moved", from: "b2", to: "d4", value: 2 });
  });
});

describe("click: increment", () => {
  it("increments when the selected die is clicked again", () => {
    const game = SeksGame.create();
    game.command("k2-k3");
    game.command("k10-k9");
    const selection = selected(game, "b2");
    const result = click(selection, "b2", boardOf(game));
    expect(result).toEqual({ selection: null, command: "b2+" });
    expect(game.command(result.command!).events[0]).toMatchObject({ type: "incremented", at: "b2", value: 3 });
  });

  it("on a 6 only clears the selection", () => {
    const game = open({ f6: "w6", k11: "b1", a1: "w1" });
    const selection = selected(game, "f6");
    expect(selection.canIncrement).toBe(false);
    expect(click(selection, "f6", boardOf(game))).toEqual({ selection: null, command: null });
  });

  it("on a die that can only be incremented, a second click increments it", () => {
    const game = open({ a1: "w2", b1: "b1", a2: "b1", b2: "b1", k11: "w1" });
    const selection = selected(game, "a1");
    expect(selection.moves).toEqual([]);
    expect(click(selection, "a1", boardOf(game)).command).toBe("a1+");
  });
});

describe("click: shoot", () => {
  // The white 6 in the center sees b1 up the f file and b2 on the diagonal to b10; the white 1 in g7 hides h8.
  const center = () => open({ f6: "w6", f9: "b1", b10: "b2", g7: "w1", h8: "b1", a1: "w1" });

  it("marks the dice the 6 in the center can shoot, from the engine", () => {
    const selection = selected(center(), "f6");
    expect([...selection.shots].sort()).toEqual(["b10", "f9"]);
  });

  it("shoots a marked die, with a command the engine accepts", () => {
    const game = center();
    const result = click(selected(game, "f6"), "b10", boardOf(game));
    expect(result).toEqual({ selection: null, command: "f6xb10" });
    game.command(result.command!);
    expect(game.view().dice.find((die) => die.cell === "b10")).toEqual({ cell: "b10", side: "white", value: 6 });
  });

  it("does not shoot a die that a die of the player hides", () => {
    const game = center();
    expect(click(selected(game, "f6"), "h8", boardOf(game))).toEqual({ selection: null, command: null });
  });

  it("only a 6 in the center has shots", () => {
    expect(selected(open({ f6: "w5", f9: "b1" }), "f6").shots).toEqual([]);
    expect(selected(open({ e6: "w6", e9: "b1" }), "e6").shots).toEqual([]);
  });
});

describe("click: change and clear the selection", () => {
  it("changes the selection to another die of the player", () => {
    const game = SeksGame.create();
    const result = click(selected(game, "b2"), "c2", boardOf(game));
    expect(result.command).toBeNull();
    expect(result.selection?.at).toBe("c2");
    expect(result.selection?.moves).toEqual(game.options("c2").moves);
  });

  it("clears the selection on an empty cell that is not a destination", () => {
    const game = SeksGame.create();
    expect(click(selected(game, "b2"), "h6", boardOf(game))).toEqual({ selection: null, command: null });
  });

  it("clears the selection on a die of the opponent", () => {
    const game = SeksGame.create();
    expect(click(selected(game, "b2"), "b10", boardOf(game))).toEqual({ selection: null, command: null });
  });
});
