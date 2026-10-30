import { describe, expect, it } from "vitest";
import { ConexaoGame, squareOf, type Die, type Rules, type State, type View } from "../src/engine/game";
import { fullBoard } from "./rules";
import { blockRaises, blockTargets, chooseValue, click, NONE, origins, placeTargets, valueChoices, type Selection } from "../src/logic/selection";

const sq = squareOf;

/** A reserve of `n` dice: those of `extra`, the rest of the placed value. */
function reserveOf(rules: Rules, n: number): number[] {
  const counts = [...rules.extra];
  counts[rules.placedValue]! += Math.max(0, n - counts.reduce((a, b) => a + b, 0));
  return counts;
}

/** A position of the engine, White to move: `dice` maps squares to [owner, value]. */
function position(dice: Record<number, [number, number]>, changes: Partial<Rules> = {}): View {
  const rules = { ...fullBoard(), ...changes };
  const cells: (Die | null)[] = Array.from({ length: 121 }, () => null);
  const count = [0, 0];
  for (const [square, [owner, value]] of Object.entries(dice)) {
    cells[Number(square)] = { owner, value };
    count[owner]! += 1;
  }
  const state = { rules, cells, reserve: [0, 1].map((p) => reserveOf(rules, rules.dice - count[p]!)) as State["reserve"], captured: [0, 0] as [number, number], toMove: 0, turns: 2, winner: null, over: false };
  return ConexaoGame.fromState(state).view();
}

/** White at f1 and f5, Black at f11 and f7: f7 can be blocked from e7 and g7. */
const standoff = (changes: Partial<Rules> = {}) =>
  position({ [sq(0, 5)]: [0, 1], [sq(4, 5)]: [0, 2], [sq(10, 5)]: [1, 1], [sq(6, 5)]: [1, 2] }, changes);

function taps(view: View, squares: number[]): { selection: Selection; move: unknown } {
  let selection: Selection = NONE;
  let move: unknown = null;
  for (const square of squares) {
    const outcome = click(view, selection, square);
    selection = outcome.selection;
    move = outcome.move;
  }
  return { selection, move };
}

describe("taps on the board", () => {
  it("place a die on a ringed square at once", () => {
    const view = ConexaoGame.create(fullBoard()).view();
    expect(placeTargets(view)).toContain(sq(1, 5));
    expect(click(view, NONE, sq(1, 5)).move).toEqual({ kind: "place", to: sq(1, 5), from: { reserve: 2 } });
  });

  it("increase a die with two taps on it", () => {
    const view = ConexaoGame.create(fullBoard()).view();
    const first = click(view, NONE, sq(0, 5));
    expect(first.selection).toEqual({ kind: "raise", at: sq(0, 5) });
    expect(first.move).toBeNull();
    expect(click(view, first.selection, sq(0, 5)).move).toEqual({ kind: "increase", at: sq(0, 5) });
  });

  it("block by the die to increase and then the diamond square", () => {
    const view = standoff();
    expect(blockTargets(view)).toEqual([sq(6, 4), sq(6, 6)]);
    expect(taps(view, [sq(4, 5), sq(6, 6)]).move).toEqual({ kind: "block", raise: sq(4, 5), to: sq(6, 6), from: { reserve: 2 } });
  });

  it("block by the square first and then the die to increase", () => {
    const view = standoff();
    const first = click(view, NONE, sq(6, 6));
    expect(first.selection).toEqual({ kind: "block", to: sq(6, 6) });
    expect(blockRaises(view, sq(6, 6))).toContain(sq(6, 5));
    expect(click(view, first.selection, sq(6, 5)).move).toEqual({ kind: "block", raise: sq(6, 5), to: sq(6, 6), from: { reserve: 2 } });
  });

  it("ask for the die taken from the board once the reserve is empty", () => {
    const view = position({ [sq(0, 5)]: [0, 1], [sq(4, 5)]: [0, 2], [sq(3, 0)]: [0, 2], [sq(10, 5)]: [1, 1], [sq(6, 5)]: [1, 2] }, { dice: 3 });
    expect(view.reserve[0]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    const first = click(view, NONE, sq(5, 5));
    expect(first.selection).toEqual({ kind: "origin", to: sq(5, 5), raise: null });
    // The 1 of f1 keeps its value and would have two neighbors on f6; the 2 of f5 is the die f6 needs to touch.
    expect(origins(view, first.selection)).toEqual([sq(3, 0)]);
    const wrong = click(view, first.selection, sq(4, 5));
    expect(wrong.move).toBeNull();
    expect(wrong.note).not.toBeNull();
    expect(click(view, first.selection, sq(3, 0)).move).toEqual({ kind: "place", to: sq(5, 5), from: { board: sq(3, 0) } });
  });

  it("ask for the origin of a block too, increase and square first", () => {
    const view = position({ [sq(0, 5)]: [0, 1], [sq(4, 5)]: [0, 2], [sq(3, 0)]: [0, 2], [sq(10, 5)]: [1, 1], [sq(6, 5)]: [1, 2] }, { dice: 3 });
    const { selection, move } = taps(view, [sq(4, 5), sq(6, 6)]);
    expect(move).toBeNull();
    expect(selection).toEqual({ kind: "origin", to: sq(6, 6), raise: sq(4, 5) });
    expect(click(view, selection, sq(3, 0)).move).toEqual({ kind: "block", raise: sq(4, 5), to: sq(6, 6), from: { board: sq(3, 0) } });
  });

  it("ask for the value of the reserve die when there are several, and spend that one", () => {
    const view = ConexaoGame.create({ ...fullBoard(), extra: [0, 0, 0, 1, 1, 1, 1] }).view();
    const first = click(view, NONE, sq(1, 5));
    expect(first.move).toBeNull();
    expect(first.selection).toEqual({ kind: "value", to: sq(1, 5), raise: null });
    expect(valueChoices(view, first.selection)).toEqual([6, 5, 4, 3, 2]);
    expect(chooseValue(view, first.selection, 5).move).toEqual({ kind: "place", to: sq(1, 5), from: { reserve: 5 } });
    expect(chooseValue(view, first.selection, 1).move).toBeNull();
    // A tap on the square again drops the choice.
    expect(click(view, first.selection, sq(1, 5)).selection).toEqual(NONE);
  });

  it("ask for the value of a block too", () => {
    const view = standoff({ extra: [0, 0, 0, 0, 0, 1, 1] });
    const { selection, move } = taps(view, [sq(4, 5), sq(6, 6)]);
    expect(move).toBeNull();
    expect(selection).toEqual({ kind: "value", to: sq(6, 6), raise: sq(4, 5) });
    expect(chooseValue(view, selection, 6).move).toEqual({ kind: "block", raise: sq(4, 5), to: sq(6, 6), from: { reserve: 6 } });
  });

  it("drop the choice off the board, or on the chosen square again", () => {
    const view = standoff();
    const chosen = click(view, NONE, sq(6, 6)).selection;
    expect(click(view, chosen, null).selection).toEqual(NONE);
    expect(click(view, chosen, sq(6, 6)).selection).toEqual(NONE);
  });

  it("say why a die of 6 does nothing", () => {
    const view = position({ [sq(0, 5)]: [0, 6], [sq(10, 5)]: [1, 1] });
    const outcome = click(view, NONE, sq(0, 5));
    expect(outcome.selection).toEqual(NONE);
    expect(outcome.note).toMatch(/6/);
  });

  it("do nothing once the game is over", () => {
    const game = ConexaoGame.create({ ...fullBoard(), maxTurns: 1 });
    game.play(game.view().moves[0]!);
    expect(click(game.view(), NONE, sq(1, 5))).toEqual({ selection: NONE, move: null, note: null });
  });
});
