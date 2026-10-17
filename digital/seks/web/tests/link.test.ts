import { describe, expect, it } from "vitest";
import { decodeLink, encodeLink, isGameId, LinkError, randomGameId, type Rules, type Ruleset } from "../src/logic/link";

/** A toy game with `width` legal commands (`m0`, `m1`, ...) until `length` plays are made: no engine, to show the format stands alone. */
function toy(width: number, length: number): Ruleset {
  return {
    open(start) {
      if (start === "bad") throw new Error("no such position");
      let plays = start.length;
      const rules: Rules = {
        legalCommands: () => (plays >= length ? [] : Array.from({ length: width }, (_, i) => `m${i}`)),
        play(command) {
          if (!rules.legalCommands().includes(command)) throw new Error("illegal");
          plays++;
        },
        dispose() {},
      };
      return rules;
    },
  };
}

const ruleset = toy(10, 20);

function error(run: () => unknown): LinkError {
  try {
    run();
  } catch (caught) {
    if (caught instanceof LinkError) return caught;
    throw caught;
  }
  throw new Error("did not throw");
}

describe("link format", () => {
  it("writes version, id, start and the index of each play", () => {
    const text = encodeLink({ id: "abc", start: "", commands: ["m0", "m1", "m9"] }, ruleset);
    expect(text).toBe("v1.abc..AAEJ");
  });

  it("reads back what it wrote, with or without the leading #", () => {
    const link = { id: "g-1_x", start: "XY", commands: ["m3", "m3", "m0", "m9"], left: null };
    const text = encodeLink(link, ruleset);
    expect(decodeLink(text, ruleset)).toEqual(link);
    expect(decodeLink(`#${text}`, ruleset)).toEqual(link);
    expect(decodeLink(`  #${text}\n`, ruleset)).toEqual(link);
  });

  it("marks who left the game in a fifth part", () => {
    const link = { id: "abc", start: "", commands: ["m0"], left: "b" };
    const text = encodeLink(link, ruleset);
    expect(text).toBe("v1.abc..AA.b");
    expect(decodeLink(text, ruleset)).toEqual(link);
    expect(decodeLink("v1.abc..AA", ruleset).left).toBeNull();
    expect(error(() => decodeLink("v1.abc..AA.", ruleset)).code).toBe("format");
    expect(error(() => decodeLink("v1.abc..AA.b.c", ruleset)).code).toBe("format");
    expect(error(() => encodeLink({ ...link, left: "" }, ruleset)).code).toBe("format");
  });

  it("carries a game with no plays", () => {
    const text = encodeLink({ id: "abc", start: "", commands: [] }, ruleset);
    expect(text).toBe("v1.abc..");
    expect(decodeLink(text, ruleset).commands).toEqual([]);
  });

  it("uses two bytes for an index of 128 or more", () => {
    const wide = toy(300, 10);
    const link = { id: "abc", start: "", commands: ["m0", "m127", "m128", "m299"], left: null };
    const text = encodeLink(link, wide);
    expect(decodeLink(text, wide)).toEqual(link);
    // 1 + 1 + 2 + 2 bytes = 6 bytes = 8 characters.
    expect(text.split(".")[3]).toHaveLength(8);
  });

  it("only has characters that need no escaping in a URL fragment", () => {
    const wide = toy(300, 300);
    const commands = Array.from({ length: 300 }, (_, i) => `m${(i * 37) % 300}`);
    const text = encodeLink({ id: randomGameId(), start: "", commands }, wide);
    expect(text).toMatch(/^v1\.[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+$/);
    expect(decodeLink(text, wide).commands).toEqual(commands);
  });

  it("refuses to write a command that is not legal", () => {
    const failure = error(() => encodeLink({ id: "abc", start: "", commands: ["m0", "m55"] }, ruleset));
    expect(failure).toMatchObject({ code: "move", ply: 1 });
  });

  it("refuses to write a game past its end", () => {
    const commands = Array.from({ length: 21 }, () => "m0");
    expect(error(() => encodeLink({ id: "abc", start: "", commands }, ruleset))).toMatchObject({ code: "move", ply: 20 });
  });
});

describe("link errors", () => {
  it("text that is not a link is a format error", () => {
    for (const text of ["", "hello", "v1.abc.", "v1.abc..AAEJ.extra.more", "x1.abc..AAEJ", "v1.a b..AAEJ", "v1..AAEJ", "v1.abc..AQ=="]) {
      expect(error(() => decodeLink(text, ruleset)).code, text).toBe("format");
    }
  });

  it("an unknown version is a version error", () => {
    expect(error(() => decodeLink("v2.abc..AAEJ", ruleset)).code).toBe("version");
    expect(error(() => decodeLink("v0.abc..AAEJ", ruleset)).code).toBe("version");
  });

  it("an index with no legal command is a move error that says where", () => {
    // The bytes 1, 10, 9: index 10 does not exist (only 0 to 9).
    const failure = error(() => decodeLink("v1.abc..AQoJ", ruleset));
    expect(failure).toMatchObject({ code: "move", ply: 1 });
  });

  it("plays after the end of the game are a move error", () => {
    const short = toy(10, 2);
    expect(error(() => decodeLink("v1.abc..AAAA", short))).toMatchObject({ code: "move", ply: 2 });
  });

  it("a start position the ruleset refuses is a start error", () => {
    expect(error(() => decodeLink("v1.abc.bad.", ruleset)).code).toBe("start");
    expect(error(() => encodeLink({ id: "abc", start: "bad", commands: [] }, ruleset)).code).toBe("start");
  });

  it("only one form per game: padding bits and long varints are refused", () => {
    // 'AR' decodes to the byte 0x01 with spare bits set: not what the encoder writes.
    expect(error(() => decodeLink("v1.abc..AR", ruleset)).code).toBe("format");
    // 0x80 0x00 is a long form of 0.
    expect(error(() => decodeLink("v1.abc..gAA", ruleset)).code).toBe("format");
    // A varint cut short (0x80 alone).
    expect(error(() => decodeLink("v1.abc..gA", ruleset)).code).toBe("format");
    // A length that no byte count produces.
    expect(error(() => decodeLink("v1.abc..A", ruleset)).code).toBe("format");
  });
});

describe("game ids", () => {
  it("random ids are valid and differ", () => {
    const ids = new Set(Array.from({ length: 50 }, () => randomGameId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(isGameId(id)).toBe(true);
  });

  it("takes the bytes from the source given", () => {
    expect(randomGameId((bytes) => bytes.fill(0))).toBe("AAAAAAAA");
  });

  it("refuses ids with a dot, a space or nothing", () => {
    for (const id of ["", "a.b", "a b", "a".repeat(33)]) expect(isGameId(id)).toBe(false);
  });
});
