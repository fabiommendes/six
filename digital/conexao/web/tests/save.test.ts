import { describe, expect, it } from "vitest";
import { ConexaoGame } from "../src/engine/game";
import { fullBoard } from "./rules";
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

const KEY = "conexao.partida.v2";

describe("save", () => {
  it("keeps the names, the bots and a state the engine reads back, rules included", () => {
    const store = memory();
    const game = ConexaoGame.create({ ...fullBoard(), size: 9, capture: true });
    game.play(game.view().moves.find((m) => m.kind === "place")!);
    save(store, { names: ["Ana", "Bia"], bots: [null, "search"], state: game.state() });
    const saved = load(store)!;
    expect(saved.names).toEqual(["Ana", "Bia"]);
    expect(saved.bots).toEqual([null, "search"]);
    const back = ConexaoGame.fromState(saved.state);
    expect(back.view()).toEqual(game.view());
    expect(back.view().rules.capture).toBe(true);
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

  it("drops a save in the format of the reserve counted as a number", () => {
    const store = memory();
    const state = ConexaoGame.create(fullBoard()).state();
    store.setItem("conexao.partida.v1", JSON.stringify({ names: ["A", "B"], bots: [null, null], state: { ...state, reserve: [15, 15] } }));
    expect(load(store)).toBeNull();
    expect(store.getItem("conexao.partida.v1")).toBeNull();
    store.setItem(KEY, JSON.stringify({ names: ["A", "B"], bots: [null, null], state: { ...state, reserve: [15, 15] } }));
    expect(load(store)).toBeNull();
  });

  it("is refused by the engine when the state could not be reached", () => {
    const state = ConexaoGame.create(fullBoard()).state();
    expect(() => ConexaoGame.fromState({ ...state, reserve: [[0, 3, 0, 0, 0, 0, 0], [0, 15, 0, 0, 0, 0, 0]] })).toThrow();
  });
});
