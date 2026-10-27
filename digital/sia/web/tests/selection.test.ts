import { describe, expect, it } from "vitest";
import type { View } from "../src/engine/game";
import { SiaGame } from "../src/engine/game";
import { click, diceMask, NONE, placeTargets, REROLL_START, rerollCommand, rerollPreview, rerollStart, selectedDie, type Selection } from "../src/logic/selection";

/** A fresh game and its view: both hands have 6 dice, the first of them the joker and every stone is open. */
function fresh(seed = 4n): { game: SiaGame; view: View } {
  const game = SiaGame.create(seed);
  return { game, view: game.view() };
}

const reroll = (patch: Partial<Extract<Selection, { kind: "reroll" }>>): Selection => ({ ...REROLL_START, ...patch }) as Selection;

describe("putting a die", () => {
  it("takes a die of the hand, then a stone, and makes a place command", () => {
    const { game, view } = fresh();
    const me = view.toMove;
    const picked = click(view, NONE, { kind: "hand", seat: me, die: 0 });
    expect(picked.selection).toEqual({ kind: "die", die: 0 });
    expect(picked.command).toBeNull();
    expect(placeTargets(view, picked.selection)).toHaveLength(9);
    const done = click(view, picked.selection, { kind: "side", seat: me, stone: 5 });
    expect(done.command).toEqual({ kind: "place", die: 0, stone: 5 });
    expect(game.legalCommands()).toContainEqual({ kind: "place", die: 0, stone: 5 });
    expect(done.selection).toEqual(NONE);
  });

  it("also puts the die when the stone itself is clicked", () => {
    const { view } = fresh();
    const me = view.toMove;
    const done = click(view, { kind: "die", die: 0 }, { kind: "stone", stone: 2 });
    expect(done.command).toEqual({ kind: "place", die: 0, stone: 2 });
    expect(me).toBeGreaterThanOrEqual(0);
  });

  it("clicking the die again puts it back, and another die swaps the selection", () => {
    const { view } = fresh();
    const me = view.toMove;
    expect(click(view, { kind: "die", die: 1 }, { kind: "hand", seat: me, die: 1 }).selection).toEqual(NONE);
    expect(click(view, { kind: "die", die: 1 }, { kind: "hand", seat: me, die: 4 }).selection).toEqual({ kind: "die", die: 4 });
  });

  it("asks for a die before a side, and ignores the other player's hand and side", () => {
    const { view } = fresh();
    const me = view.toMove;
    const other = 1 - me;
    const side = click(view, NONE, { kind: "side", seat: me, stone: 0 });
    expect(side.command).toBeNull();
    expect(side.note).toMatch(/dado/);
    expect(click(view, NONE, { kind: "hand", seat: other, die: 0 }).selection).toEqual(NONE);
    expect(click(view, { kind: "die", die: 0 }, { kind: "side", seat: other, stone: 0 }).command).toBeNull();
  });

  it("does not select a die when no stone has room", () => {
    const { view } = fresh();
    const full: View = { ...view, open: view.open.map(() => false) };
    const out = click(full, NONE, { kind: "hand", seat: full.toMove, die: 0 });
    expect(out.selection).toEqual(NONE);
    expect(out.note).not.toBeNull();
  });

  it("shows the die selected", () => {
    const { view } = fresh();
    expect(selectedDie(view, { kind: "die", die: 2 })).toEqual(view.players[view.toMove]!.hand[2]);
    expect(selectedDie(view, NONE)).toBeNull();
  });
});

describe("claiming", () => {
  it("a click on a stone that can be claimed makes a claim, whatever is selected", () => {
    const { view } = fresh();
    const claimable: View = { ...view, claimable: view.claimable.map((_, i) => i === 6) };
    expect(click(claimable, NONE, { kind: "stone", stone: 6 }).command).toEqual({ kind: "claim", stone: 6 });
    expect(click(claimable, { kind: "die", die: 0 }, { kind: "stone", stone: 6 }).command).toEqual({ kind: "claim", stone: 6 });
    expect(click(claimable, NONE, { kind: "stone", stone: 5 }).command).toBeNull();
  });
});

describe("rerolling", () => {
  it("builds the command from the die to lose, the hand and the dice to roll", () => {
    const { game, view } = fresh();
    const me = view.toMove;
    let selection: Selection = REROLL_START;
    expect(rerollCommand(selection)).toBeNull();
    selection = click(view, selection, { kind: "hand", seat: me, die: 0 }).selection;
    expect(selection).toMatchObject({ lost: 0, target: null });
    selection = click(view, selection, { kind: "hand", seat: me, die: 2 }).selection;
    selection = click(view, selection, { kind: "hand", seat: me, die: 4 }).selection;
    expect(selection).toMatchObject({ lost: 0, target: me, dice: [2, 4] });
    const command = rerollCommand(selection)!;
    expect(command).toEqual({ kind: "reroll", target: me, lost: 0, dice: 0b10100 });
    expect(() => game.command(command)).not.toThrow();
  });

  it("rolls the hand of the other player when one of their dice is picked", () => {
    const { game, view } = fresh();
    const me = view.toMove;
    const other = 1 - me;
    let selection: Selection = click(view, REROLL_START, { kind: "hand", seat: me, die: 1 }).selection;
    selection = click(view, selection, { kind: "hand", seat: other, die: 1 }).selection;
    selection = click(view, selection, { kind: "hand", seat: other, die: 3 }).selection;
    expect(selection).toMatchObject({ lost: 1, target: other, dice: [1, 3] });
    expect(() => game.command(rerollCommand(selection)!)).not.toThrow();
  });

  it("does not pick the joker of the other hand to roll, but does pick the own", () => {
    const { view } = fresh();
    const me = view.toMove;
    const start = click(view, REROLL_START, { kind: "hand", seat: me, die: 1 }).selection;
    const refused = click(view, start, { kind: "hand", seat: 1 - me, die: 0 });
    expect(refused.selection).toEqual(start);
    expect(refused.note).toMatch(/coringa/);
    const own = click(view, start, { kind: "hand", seat: me, die: 0 });
    expect(own.selection).toMatchObject({ target: me, dice: [0] });
  });

  it("switching to the other hand clears the dice picked, and a picked die can be dropped", () => {
    const { view } = fresh();
    const me = view.toMove;
    const picked = reroll({ lost: 0, target: me, dice: [1, 2] });
    const switched = click(view, picked, { kind: "hand", seat: 1 - me, die: 5 }).selection;
    expect(switched).toMatchObject({ target: 1 - me, dice: [5] });
    const dropped = click(view, picked, { kind: "hand", seat: me, die: 2 }).selection;
    expect(dropped).toMatchObject({ dice: [1] });
  });

  it("clicking the die to lose frees it, and the lost die never is among those to roll", () => {
    const { view } = fresh();
    const me = view.toMove;
    expect(click(view, reroll({ lost: 3 }), { kind: "hand", seat: me, die: 3 }).selection).toMatchObject({ lost: null });
    const out = click(view, reroll({ target: me, dice: [2, 3] }), { kind: "hand", seat: me, die: 3 }).selection;
    expect(out).toMatchObject({ lost: 3, dice: [2] });
  });

  it("while a reroll is built, the stones and sides do nothing", () => {
    const { view } = fresh();
    const out = click(view, REROLL_START, { kind: "stone", stone: 1 });
    expect(out.command).toBeNull();
    expect(out.selection).toEqual(REROLL_START);
  });

  it("previews the cost: the die lost, the limit of the hand and the dice rolled", () => {
    const { view } = fresh();
    const me = view.toMove;
    const hand = view.players[me]!.hand;
    const preview = rerollPreview(view, reroll({ lost: 0, target: me, dice: [1, 2] }))!;
    expect(preview.lost).toEqual(hand[0]);
    expect(preview.handLimit).toBe(5);
    expect(preview.rolled).toEqual([hand[1], hand[2]]);
    expect(rerollPreview(view, NONE)).toBeNull();
    expect(rerollPreview(view, REROLL_START)!.lost).toBeNull();
  });

  it("makes the bit mask of dice", () => {
    expect(diceMask([])).toBe(0);
    expect(diceMask([0, 3, 6])).toBe(0b1001001);
  });
});

describe("starting a reroll", () => {
  it("opens empty when no die is selected", () => {
    const { view } = fresh();
    expect(rerollStart(view, NONE)).toEqual(REROLL_START);
  });

  it("opens with the own hand chosen and the selected die marked to roll", () => {
    const { view } = fresh();
    const started = rerollStart(view, { kind: "die", die: 2 });
    expect(started).toEqual({ kind: "reroll", target: view.toMove, lost: null, dice: [2] });
    expect(rerollPreview(view, started)?.rolled).toEqual([view.players[view.toMove]!.hand[2]]);
    // Picking another die of the own hand now loses it.
    const lost = click(view, started, { kind: "hand", seat: view.toMove, die: 5 });
    expect(rerollCommand(lost.selection)).toEqual({ kind: "reroll", target: view.toMove, lost: 5, dice: diceMask([2]) });
  });
});
