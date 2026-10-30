import { describe, expect, it } from "vitest";
import { clickable, clickDie, IDLE, modify, moved, sacrifice, type ActOptions } from "../src/logic/act";

const options: ActOptions = {
  kind: "act",
  sacrifice: [0, 1, 2, 3],
  zeros: [{ die: 1, targets: [0, 2] }],
  modifiers: [{ die: 3, targets: [0, 2] }],
  sabotage: [],
};

describe("building a turn die by die", () => {
  it("a zero and its target make a zero action", () => {
    const first = clickDie(IDLE, options, 1);
    expect(first.mode).toEqual({ kind: "zero", die: 1 });
    expect(clickDie(first.mode, options, 3).mode).toEqual(first.mode);
    expect(clickDie(first.mode, options, 2)).toEqual({ mode: IDLE, action: { kind: "zero", zero: 1, target: 2 } });
    expect(clickDie(first.mode, options, 1).mode).toEqual(IDLE);
  });

  it("a modifier needs a target, then a direction", () => {
    const picked = clickDie(IDLE, options, 3).mode;
    expect(modify(picked, true)).toBeNull();
    const target = clickDie(picked, options, 0).mode;
    expect(modify(target, false)).toEqual({ kind: "modify", modifier: 3, target: 0, up: false });
    expect(clickable(target, options)).toEqual(new Set([3, 0, 2]));
  });

  it("a sacrifice takes a die out and rerolls others", () => {
    let mode = clickDie({ kind: "sacrifice", out: null, rerolls: [] }, options, 2).mode;
    expect(sacrifice(mode)).toEqual({ kind: "sacrifice", out: 2, rerolls: [] });
    mode = clickDie(mode, options, 3).mode;
    mode = clickDie(mode, options, 0).mode;
    expect(sacrifice(mode)).toEqual({ kind: "sacrifice", out: 2, rerolls: [0, 3] });
    mode = clickDie(mode, options, 3).mode;
    expect(sacrifice(mode)).toEqual({ kind: "sacrifice", out: 2, rerolls: [0] });
    expect(sacrifice(clickDie(mode, options, 2).mode)).toBeNull();
  });

  it("idle clicks only start zeros and modifiers", () => {
    expect(clickDie(IDLE, options, 0).mode).toEqual(IDLE);
    expect(clickable(IDLE, options)).toEqual(new Set([1, 3]));
  });

  it("a modifier keeps the die within 1 and 6", () => {
    expect(moved(5, 2)).toBe(6);
    expect(moved(2, -2)).toBe(1);
    expect(moved(3, 1)).toBe(4);
  });
});
