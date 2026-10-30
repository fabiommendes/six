import { describe, expect, it } from "vitest";
import { clickable, clickCard, clickDie, confirmed, IDLE, modify, moved, type ActOptions, type Turn } from "../src/logic/act";

const options: ActOptions = {
  kind: "act",
  sacrifice: [0, 1, 2, 3, 4],
  zeros: [{ die: 1, targets: [0, 2] }],
  modifiers: [{ die: 3, targets: [0, 2] }],
  sabotage: [{ kind: "standard" }, { kind: "card", card: 1 }],
};
/** Die 4 is a used 0: it lies in the reserve, so it can leave but not be rerolled. */
const turn: Turn = { options, mat: [0, 1, 2, 3] };

describe("building a turn by clicks on the table", () => {
  it("a zero and its target make a zero action", () => {
    const first = clickDie(IDLE, turn, 1);
    expect(first.mode).toEqual({ kind: "zero", die: 1 });
    expect(clickDie(first.mode, turn, 3).mode).toEqual(first.mode);
    expect(clickDie(first.mode, turn, 2)).toEqual({ mode: IDLE, action: { kind: "zero", zero: 1, target: 2 } });
  });

  it("a second click on a zero or a modifier sacrifices it", () => {
    expect(clickDie({ kind: "zero", die: 1 }, turn, 1).mode).toEqual({ kind: "sacrifice", out: 1, rerolls: [] });
    expect(clickDie({ kind: "modify", die: 3, target: null }, turn, 3).mode).toEqual({ kind: "sacrifice", out: 3, rerolls: [] });
  });

  it("a modifier needs a target, then a direction", () => {
    const picked = clickDie(IDLE, turn, 3).mode;
    expect(modify(picked, true)).toBeNull();
    const target = clickDie(picked, turn, 0).mode;
    expect(modify(target, false)).toEqual({ kind: "modify", modifier: 3, target: 0, up: false });
    expect(clickable(target, turn).dice).toEqual(new Set([3, 0, 2]));
  });

  it("any other die of the hand starts a sacrifice, and the dice on the mat reroll with it", () => {
    let mode = clickDie(IDLE, turn, 2).mode;
    expect(confirmed(mode)).toEqual({ kind: "sacrifice", out: 2, rerolls: [] });
    mode = clickDie(mode, turn, 3).mode;
    mode = clickDie(mode, turn, 0).mode;
    expect(confirmed(mode)).toEqual({ kind: "sacrifice", out: 2, rerolls: [0, 3] });
    mode = clickDie(mode, turn, 3).mode;
    expect(confirmed(mode)).toEqual({ kind: "sacrifice", out: 2, rerolls: [0] });
    expect(clickDie(mode, turn, 2).mode).toEqual(IDLE);
  });

  it("a used die in the reserve can leave but not reroll", () => {
    const mode = clickDie(IDLE, turn, 4).mode;
    expect(mode).toEqual({ kind: "sacrifice", out: 4, rerolls: [] });
    expect(clickable(mode, turn).dice).toEqual(new Set([4, 0, 1, 2, 3]));
    const other = clickDie(IDLE, turn, 0).mode;
    expect(clickDie(other, turn, 4).mode).toEqual(other);
  });

  it("a mission is picked to sabotage, by its column, then confirmed", () => {
    expect(clickCard(IDLE, turn, 1).mode).toEqual(IDLE);
    const mode = clickCard(IDLE, turn, 2).mode;
    expect(confirmed(mode)).toEqual({ kind: "sabotage", spot: { kind: "card", card: 1 } });
    expect(clickCard(mode, turn, 2).mode).toEqual(IDLE);
    const standard = clickCard(mode, turn, 0).mode;
    expect(confirmed(standard)).toEqual({ kind: "sabotage", spot: { kind: "standard" } });
  });

  it("idle shows every die that can do something and the missions to sabotage", () => {
    expect(clickable(IDLE, turn)).toEqual({ dice: new Set([0, 1, 2, 3, 4]), cards: new Set([0, 2]) });
  });

  it("a modifier keeps the die within 1 and 6", () => {
    expect(moved(5, 2)).toBe(6);
    expect(moved(2, -2)).toBe(1);
    expect(moved(3, 1)).toBe(4);
  });
});
