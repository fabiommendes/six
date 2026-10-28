import { describe, expect, it } from "vitest";
import { diceFor, SheshBot, SheshGame, type Command } from "../src/engine/game";

/** Plays a whole game with the given bot name, with a fixed list of bots per seat. */
function playOut(game: SheshGame, names: [string, string]): void {
  const bots = names.map((name, i) => new SheshBot(name, i + 1));
  let plays = 0;
  while (game.view().end === null) {
    const view = game.view();
    game.command(bots[view.toMove]!.choose(game));
    if (++plays > 5000) throw new Error("the game does not end");
  }
  for (const bot of bots) bot.free();
}

describe("SheshGame", () => {
  it("starts with six dice in each reserve and the first roll made", () => {
    const view = SheshGame.create(11n).view();
    for (const player of view.players) {
      expect(player.reserve).toEqual([1, 2, 3, 4, 5, 6]);
      expect(player.points).toBe(0);
    }
    expect(view.roll).toBeGreaterThanOrEqual(0);
    expect(view.roll).toBeLessThanOrEqual(4);
  });

  it("keeps the dice that left the track, whose values add up to the points", () => {
    const game = SheshGame.create(21n);
    playOut(game, ["expecti", "greedy"]);
    const view = game.view();
    expect(view.end).not.toBeNull();
    view.players.forEach((player, i) => {
      expect(game.leftDice()[i]!.reduce((a, b) => a + b, 0)).toBe(player.points);
    });
    expect(game.leftDice().flat().length).toBeGreaterThan(0);
  });

  it("takes the dice back on undo", () => {
    const game = SheshGame.create(4n);
    // Play until a die leaves the track.
    const bots = [new SheshBot("greedy", 1), new SheshBot("greedy", 2)];
    let before = game.leftDice().map((d) => [...d]);
    let command: Command;
    while (game.view().end === null) {
      before = game.leftDice().map((d) => [...d]);
      command = bots[game.view().toMove]!.choose(game);
      game.command(command);
      if (game.leftDice().flat().length > before.flat().length) break;
    }
    expect(game.leftDice().flat().length).toBe(before.flat().length + 1);
    game.undo();
    expect(game.leftDice()).toEqual(before);
  });

  it("rebuilds the dice that left from the points when the save has none", () => {
    expect(diceFor(0)).toEqual([]);
    expect(diceFor(4)).toEqual([4]);
    expect(diceFor(15)).toEqual([6, 6, 3]);
    const game = SheshGame.create(8n);
    playOut(game, ["greedy", "greedy"]);
    const restored = SheshGame.fromState(game.state());
    restored.view().players.forEach((player, i) => expect(restored.leftDice()[i]!.reduce((a, b) => a + b, 0)).toBe(player.points));
    // A list that does not add up to the points is ignored.
    const wrong = SheshGame.fromState(game.state(), [[1], [1]]);
    wrong.view().players.forEach((player, i) => expect(wrong.leftDice()[i]!.reduce((a, b) => a + b, 0)).toBe(player.points));
  });

  it("refuses an illegal command and changes nothing", () => {
    const game = SheshGame.create(2n);
    const before = JSON.stringify(game.state());
    expect(() => game.command({ kind: "move", from: 17 })).toThrow();
    expect(JSON.stringify(game.state())).toBe(before);
    expect(game.canUndo()).toBe(false);
  });

  it("lists, for each legal move, the events it would cause", () => {
    for (let seed = 1n; seed < 30n; seed++) {
      const game = SheshGame.create(seed);
      const view = game.view();
      expect(view.moves.map((m) => m.command)).toEqual(game.legalCommands());
      for (const move of view.moves) expect(move.events.length).toBeGreaterThan(0);
    }
  });
});
