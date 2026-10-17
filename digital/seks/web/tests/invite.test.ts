import { describe, expect, it } from "vitest";
import { decodeInvite, encodeInvite } from "../src/logic/invite";
import { randomGameId } from "../src/logic/link";

describe("the invite", () => {
  it("writes the id and the side of whoever invites", () => {
    expect(encodeInvite({ id: "abc_-1", host: "white" })).toBe("i1.abc_-1.w");
    expect(encodeInvite({ id: "abc", host: "black" })).toBe("i1.abc.b");
  });

  it("round-trips, with or without the #", () => {
    for (const host of ["white", "black"] as const) {
      const invite = { id: randomGameId(), host };
      expect(decodeInvite(encodeInvite(invite))).toEqual(invite);
      expect(decodeInvite(`#${encodeInvite(invite)}`)).toEqual(invite);
    }
  });

  it("does not write an id that is not valid", () => {
    expect(() => encodeInvite({ id: "a.b", host: "white" })).toThrow();
    expect(() => encodeInvite({ id: "", host: "white" })).toThrow();
  });

  it("reads nothing from what is not an invite", () => {
    for (const text of ["", "i1", "i1.abc", "i1.abc.x", "i1..w", "i2.abc.w", "I1.abc.w", "v1.abc..AAEJ", "i1.abc.w.extra", "i1.a b.w"]) {
      expect(decodeInvite(text), text).toBeNull();
    }
  });
});
