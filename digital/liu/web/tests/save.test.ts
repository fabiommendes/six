import { describe, expect, it } from "vitest";
import { LiuGame } from "../src/engine/game";
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
    const game = LiuGame.create(2, 5n);
    game.command({ kind: "pass" });
    save(store, { names: ["Ana", "Bia"], state: game.state() });
    const saved = load(store)!;
    expect(saved.names).toEqual(["Ana", "Bia"]);
    expect(LiuGame.fromState(saved.state).view()).toEqual(game.view());
    clear(store);
    expect(load(store)).toBeNull();
  });

  it("ignores a broken save", () => {
    const store = memory();
    store.setItem("liu.partida.v1", "{not json");
    expect(load(store)).toBeNull();
    store.setItem("liu.partida.v1", JSON.stringify({ names: [1], state: {} }));
    expect(load(store)).toBeNull();
  });
});
