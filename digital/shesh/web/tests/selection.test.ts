import { describe, expect, it } from "vitest";
import type { View } from "../src/engine/game";
import { SheshBot, SheshGame } from "../src/engine/game";
import { click, destinationOf, mustPass, NONE, sourceOf, sources } from "../src/logic/selection";

/** The first game from a seed whose first roll lets the player move, and a position a few plays in with more than one move. */
function withMoves(): { game: SheshGame; view: View } {
  for (let seed = 1n; seed < 200n; seed++) {
    const game = SheshGame.create(seed);
    const bot = new SheshBot("greedy", 1);
    for (let i = 0; i < 40 && game.view().end === null; i++) {
      const view = game.view();
      if (view.moves.length >= 2 && view.moves.every((m) => m.command.kind !== "pass")) {
        bot.free();
        return { game, view };
      }
      game.command(bot.choose(game));
    }
    bot.free();
  }
  throw new Error("no position with two moves");
}

describe("selection", () => {
  it("has one source per legal move, and a destination along the roll", () => {
    const { view } = withMoves();
    expect(sources(view)).toHaveLength(view.moves.length);
    for (const move of view.moves) {
      const from = sourceOf(move)!;
      const to = destinationOf(view, move)!;
      expect(to).toBe((from.kind === "square" ? from.square : 0) + view.roll);
    }
  });

  it("selects on the first touch of a die and plays on the second", () => {
    const { view } = withMoves();
    const first = click(view, NONE, sourceOf(view.moves[1]!)!);
    expect(first).toEqual({ selection: 1, command: null, note: null });
    const second = click(view, 1, sourceOf(view.moves[1]!)!);
    expect(second.command).toEqual(view.moves[1]!.command);
    expect(second.selection).toBeNull();
  });

  it("plays the chosen move when its destination is touched", () => {
    const { view } = withMoves();
    const to = destinationOf(view, view.moves[0]!)!;
    const outcome = click(view, 0, { kind: "square", square: to });
    expect(outcome.command).toEqual(view.moves[0]!.command);
  });

  it("changes the selection when another die is touched, and clears it on an empty square", () => {
    // A die that is not where the chosen move ends: touching that square would play the move instead.
    for (let seed = 1n; seed < 200n; seed++) {
      const game = SheshGame.create(seed);
      const bot = new SheshBot("greedy", 1);
      for (let i = 0; i < 40 && game.view().end === null; i++) {
        const view = game.view();
        const to = view.moves[0] ? destinationOf(view, view.moves[0]) : null;
        const other = view.moves.findIndex((m, k) => k > 0 && sourceOf(m)?.kind === "square" && (sourceOf(m) as { square: number }).square !== to);
        if (other > 0) {
          bot.free();
          const changed = click(view, 0, sourceOf(view.moves[other]!)!);
          expect(changed).toEqual({ selection: other, command: null, note: null });
          const free = [1, 2, 3, 4, 16, 17].find((sq) => view.players[view.toMove]!.track[sq] === 0 && sq !== to);
          expect(click(view, 0, { kind: "square", square: free! }).selection).toBeNull();
          return;
        }
        game.command(bot.choose(game));
      }
      bot.free();
    }
    throw new Error("no position with two dice that can move");
  });

  it("selects and plays a move of the list", () => {
    const { view } = withMoves();
    expect(click(view, NONE, { kind: "move", index: 1 }).selection).toBe(1);
    expect(click(view, 1, { kind: "move", index: 1 }).command).toEqual(view.moves[1]!.command);
  });

  it("explains a die that cannot move", () => {
    for (let seed = 1n; seed < 100n; seed++) {
      const game = SheshGame.create(seed);
      const bot = new SheshBot("greedy", 1);
      for (let i = 0; i < 30 && game.view().end === null; i++) game.command(bot.choose(game));
      bot.free();
      const now = game.view();
      if (now.end !== null) continue;
      const me = now.players[now.toMove]!;
      const movable = new Set(sources(now).flatMap((s) => (s.kind === "square" ? [s.square] : [])));
      const stuck = me.track.findIndex((v, square) => v > 0 && square >= 1 && square <= 17 && !movable.has(square));
      if (stuck < 0) continue;
      const outcome = click(now, NONE, { kind: "square", square: stuck });
      expect(outcome.command).toBeNull();
      expect(outcome.note).toMatch(/não pode andar/);
      return;
    }
    throw new Error("no position with a die that cannot move");
  });

  it("does nothing when the only move is to pass", () => {
    for (let seed = 1n; seed < 50n; seed++) {
      const game = SheshGame.create(seed);
      const bot = new SheshBot("greedy", 1);
      for (let i = 0; i < 300 && game.view().end === null; i++) {
        const view = game.view();
        if (view.moves.length === 1 && view.moves[0]!.command.kind === "pass") {
          bot.free();
          expect(mustPass(view)).toBe(true);
          expect(sources(view)).toEqual([]);
          expect(click(view, NONE, { kind: "reserve", value: 1 })).toEqual({ selection: null, command: null, note: null });
          return;
        }
        game.command(bot.choose(game));
      }
      bot.free();
    }
    throw new Error("no position where the only move is to pass");
  });
});
