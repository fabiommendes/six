import { describe, expect, it } from "vitest";
import { LiuGame, type View } from "../src/engine/game";
import { click, keepCommand, NONE, targetsOf } from "../src/logic/selection";

/** A view with a market and hand chosen by the test, over a real game. */
function viewWith(patch: Partial<View>): View {
  const view = LiuGame.create(2, 11n).view();
  return { ...view, ...patch };
}

const at = (row: number, col: number) => ({ row, col });

describe("selection", () => {
  it("a market die and a target cell place from the market", () => {
    const view = viewWith({ market: [3, 5], targets: [[], [], [at(0, 1)], [], [], []] });
    const picked = click(view, NONE, { kind: "market", die: 0 });
    expect(picked.selection).toEqual({ kind: "market", die: 0 });
    expect(targetsOf(view, picked.selection)).toEqual([at(0, 1)]);
    const placed = click(view, picked.selection, { kind: "cell", at: at(0, 1) });
    expect(placed.command).toEqual({ kind: "placeFromMarket", die: 0, at: at(0, 1) });
    expect(placed.selection).toEqual(NONE);
  });

  it("a cell that is not a target drops the selection", () => {
    const view = viewWith({ market: [3], targets: [[], [], [at(0, 1)], [], [], []] });
    const outcome = click(view, { kind: "market", die: 0 }, { kind: "cell", at: at(1, 1) });
    expect(outcome).toEqual({ selection: NONE });
  });

  it("the hand die, a cell and a market die place from the hand", () => {
    const base = viewWith({ market: [2, 6], targets: [[at(1, 0)], [], [], [], [], []], canPlaceFromHand: true });
    const view = { ...base, players: base.players.map((p, i) => (i === base.toMove ? { ...p, hand: 1 } : p)) };
    const hand = click(view, NONE, { kind: "hand" });
    expect(hand.selection).toEqual({ kind: "hand" });
    const cell = click(view, hand.selection, { kind: "cell", at: at(1, 0) });
    expect(cell.selection).toEqual({ kind: "handAt", at: at(1, 0) });
    expect(cell.command).toBeUndefined();
    // A cell click while waiting for the market die keeps waiting.
    expect(click(view, cell.selection, { kind: "cell", at: at(2, 2) }).selection).toEqual(cell.selection);
    const take = click(view, cell.selection, { kind: "market", die: 1 });
    expect(take.command).toEqual({ kind: "placeFromHand", die: 1, at: at(1, 0) });
  });

  it("the hand is not selectable when its die fits nowhere", () => {
    const view = viewWith({ canPlaceFromHand: false });
    expect(click(view, NONE, { kind: "hand" }).selection).toEqual(NONE);
  });

  it("clicking the selected die again drops it", () => {
    const view = viewWith({ market: [3, 5] });
    expect(click(view, { kind: "market", die: 1 }, { kind: "market", die: 1 }).selection).toEqual(NONE);
  });

  it("keep needs a market die and an empty hand", () => {
    expect(keepCommand(viewWith({ canKeep: true }), { kind: "market", die: 2 })).toEqual({ kind: "keep", die: 2 });
    expect(keepCommand(viewWith({ canKeep: false }), { kind: "market", die: 2 })).toBeNull();
    expect(keepCommand(viewWith({ canKeep: true }), NONE)).toBeNull();
  });

  it("nothing is selectable once the game is over", () => {
    const view = viewWith({ end: { kind: "noPlacement" } });
    expect(click(view, NONE, { kind: "market", die: 0 })).toEqual({ selection: NONE });
  });
});
