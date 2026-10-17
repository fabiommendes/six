import { describe, expect, it } from "vitest";
import { SeksGame } from "../src/engine/game";
import { SKETCH_DIAGRAM, withPliesWithoutCapture } from "../src/logic/fixtures";
import { decodeLink, encodeLink, LinkError } from "../src/logic/link";
import { gameFromStart, seksRuleset, startOf } from "../src/logic/seks-link";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * A game of up to `plies` plies by a player that looks for captures (they
 * reset the count of plies without capture, so the game lasts) and avoids
 * ending the game. Deterministic for a seed.
 */
function playGame(seed: number, plies: number, game: SeksGame = SeksGame.create()): string[] {
  const random = rng(seed);
  const commands: string[] = [];
  while (commands.length < plies) {
    const legal = game.legalCommands();
    if (legal.length === 0) break;
    let capture: string | null = null;
    let quiet: string | null = null;
    for (let tries = 0; tries < 12 && capture === null; tries++) {
      const candidate = legal[Math.floor(random() * legal.length)]!;
      const transition = game.command(candidate);
      game.undo();
      if (transition.view.outcome !== null) continue;
      quiet = candidate;
      if (transition.events.some((event) => event.type === "captured")) capture = candidate;
    }
    const command = capture ?? quiet ?? legal[0]!;
    game.command(command);
    commands.push(command);
  }
  return commands;
}

/** The first game, over the seeds, that lasts the whole `plies`. */
function longGame(plies: number): string[] {
  for (let seed = 1; seed <= 60; seed++) {
    const commands = playGame(seed, plies);
    if (commands.length === plies) return commands;
  }
  throw new Error(`no game of ${plies} plies in the seeds tried`);
}

describe("Seks in the link: the order of the engine is part of the format", () => {
  it("pins the first legal commands of the initial position", () => {
    const game = SeksGame.create();
    const legal = game.legalCommands();
    expect(legal.length).toBe(PINNED.initialCount);
    expect(legal.slice(0, 8)).toEqual(PINNED.initialHead);
    expect(legal.slice(-4)).toEqual(PINNED.initialTail);
  });

  it("a fixed game gives a fixed link", () => {
    const link = encodeLink({ id: "teste", start: "", commands: PINNED.commands }, seksRuleset);
    expect(link).toBe(PINNED.link);
    expect(decodeLink(PINNED.link, seksRuleset).commands).toEqual(PINNED.commands);
  });
});

describe("Seks in the link: whole games", () => {
  it("rebuilds games of random plays, ending in the same position", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const commands = playGame(seed, 120);
      const link = decodeLink(encodeLink({ id: "teste", start: "", commands }, seksRuleset), seksRuleset);
      expect(link.commands).toEqual(commands);
      const expected = SeksGame.create();
      const rebuilt = SeksGame.create();
      for (const command of commands) expected.command(command);
      for (const command of link.commands) rebuilt.command(command);
      expect(rebuilt.state()).toEqual(expected.state());
    }
  });

  it("a game of 300 plies fits a link of 2000 characters or less", () => {
    const commands = longGame(300);
    const text = encodeLink({ id: "abcdefgh", start: "", commands }, seksRuleset);
    expect(decodeLink(text, seksRuleset).commands).toEqual(commands);
    // The size is recorded in the test output for the issue.
    console.log(`link of 300 plies: ${text.length} characters`);
    expect(text.length).toBeLessThanOrEqual(2000);
    // And the worst case, two bytes per play, also fits.
    expect(Math.ceil((300 * 2 * 4) / 3) + 16).toBeLessThanOrEqual(2000);
  });

  it("a link that ends the game rebuilds the result", () => {
    const commands = playGame(1, 400);
    const link = decodeLink(encodeLink({ id: "teste", start: "", commands }, seksRuleset), seksRuleset);
    expect(link.commands).toHaveLength(commands.length);
    const game = SeksGame.create();
    for (const command of link.commands) game.command(command);
    expect(game.view().outcome).not.toBeNull();
  });
});

describe("Seks in the link: start positions", () => {
  it("the standard position has an empty start", () => {
    expect(startOf(SeksGame.create())).toBe("");
    expect(gameFromStart("").state()).toEqual(SeksGame.create().state());
  });

  it("a position from a diagram goes in the link and comes back", () => {
    const game = SeksGame.fromDiagram(SKETCH_DIAGRAM, "black");
    const start = startOf(game);
    expect(start).toMatch(/^pb[0-6a-f]{121}$/);
    expect(gameFromStart(start).state()).toEqual(game.state());

    const commands = playGame(3, 20, SeksGame.fromDiagram(SKETCH_DIAGRAM, "black"));
    expect(commands.length).toBeGreaterThan(5);
    const text = encodeLink({ id: "teste", start, commands }, seksRuleset);
    expect(decodeLink(text, seksRuleset)).toEqual({ id: "teste", start, commands, left: null });
  });

  it("refuses a position in the middle of a game, which has a history", () => {
    const game = SeksGame.create();
    game.command("b2-b4");
    expect(() => startOf(game)).toThrow();
    expect(() => startOf(withPliesWithoutCapture(SeksGame.fromDiagram(SKETCH_DIAGRAM, "white"), 23))).toThrow();
  });

  it("refuses texts that are not a position", () => {
    for (const start of ["x", "pw", `pw${"0".repeat(120)}`, `pw${"7".repeat(121)}`, `px${"0".repeat(121)}`]) {
      expect(() => gameFromStart(start), start).toThrow();
      expect(() => decodeLink(`v1.teste.${start}.`, seksRuleset), start).toThrow(LinkError);
    }
  });
});

/** The pinned vector: if the engine changes the order of `legalCommands()`, links already sent would open other games. */
const PINNED = {
  initialCount: 98,
  initialHead: ["a1-b1", "a1+", "c1-b1", "c1-d1", "c1+", "e1-d1", "e1-f1", "e1-f2"],
  initialTail: ["k2-j3", "k2-i4", "k2-j1", "k2+"],
  commands: ["c1-d1", "b10-c9", "a2-a4", "d10-d8", "c2-d3", "e10-d11", "g2-e4", "h10-h9", "i2-j3", "j10-j9", "j3-i3", "c11+", "a4-c6", "g11-h11", "c6-d5", "d8-e7", "i1+", "j9-j8", "d2-b4", "a10-b9", "e2-c2", "g10-e10", "h2+", "i10-k8"],
  link: "v1.teste..AwoRGB8mLTQ7QklQV15lCBEbHyMiMjA_",
};
