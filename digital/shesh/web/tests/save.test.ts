import { describe, expect, it } from "vitest";
import { SheshGame } from "../src/engine/game";
import { clear, load, save, type SaveStore } from "../src/logic/save";

function memory(): SaveStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const KEY = "shesh.partida.v2";

describe("save", () => {
  it("keeps the names, the bots, the dice that left and a state the engine reads back", () => {
    const store = memory();
    const game = SheshGame.create(5n);
    game.command(game.view().moves[0]!.command);
    save(store, { names: ["Ana", "Bia"], bots: [null, "hard"], state: game.state(), left: game.leftDice() });
    const saved = load(store)!;
    expect(saved.names).toEqual(["Ana", "Bia"]);
    expect(saved.bots).toEqual([null, "hard"]);
    const back = SheshGame.fromState(saved.state, saved.left);
    expect(back.view()).toEqual(game.view());
    expect(back.state()).toEqual(game.state());
    clear(store);
    expect(load(store)).toBeNull();
  });

  it("ignores a broken save", () => {
    const store = memory();
    store.setItem(KEY, "{not json");
    expect(load(store)).toBeNull();
    store.setItem(KEY, JSON.stringify({ names: [1], state: {} }));
    expect(load(store)).toBeNull();
    store.setItem(KEY, JSON.stringify({ names: ["A", "B"], bots: [null, "genius"], state: {} }));
    expect(load(store)).toBeNull();
  });

  it("reads a save without the bots or the dice that left as people only and an empty heap", () => {
    const store = memory();
    store.setItem(KEY, JSON.stringify({ names: ["A", "B"], state: SheshGame.create(3n).state() }));
    const saved = load(store)!;
    expect(saved.bots).toEqual([null, null]);
    expect(saved.left).toEqual([[], []]);
  });

  it("is refused by the engine when the state could not be reached", () => {
    const state = SheshGame.create(3n).state();
    expect(() => SheshGame.fromState({ ...state, roll: 9 })).toThrow();
  });
});
