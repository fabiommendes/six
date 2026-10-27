import { describe, expect, it } from "vitest";
import { SiaGame } from "../src/engine/game";
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

describe("save", () => {
  it("keeps the names and a state the engine reads back", () => {
    const store = memory();
    const game = SiaGame.create(5n);
    game.command({ kind: "place", die: 0, stone: 0 });
    save(store, { names: ["Ana", "Bia"], bots: [null, "hard"], state: game.state() });
    const saved = load(store)!;
    expect(saved.names).toEqual(["Ana", "Bia"]);
    expect(saved.bots).toEqual([null, "hard"]);
    expect(SiaGame.fromState(saved.state).view()).toEqual(game.view());
    clear(store);
    expect(load(store)).toBeNull();
  });

  it("ignores a broken save", () => {
    const store = memory();
    store.setItem("sia.partida.v3", "{not json");
    expect(load(store)).toBeNull();
    store.setItem("sia.partida.v3", JSON.stringify({ names: [1], state: {} }));
    expect(load(store)).toBeNull();
    store.setItem("sia.partida.v3", JSON.stringify({ names: ["A", "B"], bots: [null, "genius"], state: {} }));
    expect(load(store)).toBeNull();
  });

  it("reads a save from before the bots as people only", () => {
    const store = memory();
    store.setItem("sia.partida.v3", JSON.stringify({ names: ["A", "B"], state: SiaGame.create(3n).state() }));
    expect(load(store)!.bots).toEqual([null, null]);
  });
});
