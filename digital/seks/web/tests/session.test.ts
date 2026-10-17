import { describe, expect, it } from "vitest";
import { BOT_LEVELS } from "../src/bot/levels";
import { SeksGame, type Command, type Side } from "../src/engine/game";
import type { LocalMode as Mode } from "../src/logic/match";
import { clearSession, loadSession, saveSession, SESSION_KEY, type Session, type SessionStore } from "../src/logic/session";
import { newMatch, ScriptedBot } from "./fakes";

/** A storage in memory. */
class MemoryStore implements SessionStore {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

const hotseat: Mode = { kind: "hotseat" };
const level = BOT_LEVELS[0]!;

/** The session of a match that played `clicks` (pairs of cells: select, then destination). */
async function played(mode: Mode, clicks: readonly string[], tilted = false, viewpoint: Side = "white"): Promise<Session> {
  const { match } = newMatch(SeksGame.create(), mode);
  await match.start();
  for (const cell of clicks) await match.click(cell as never);
  return { mode, ...match.record(), seed: {}, tilted, viewpoint };
}

const OPENING = ["b2", "b4", "b10", "b8"];

describe("the saved session", () => {
  it("brings back the match: position, last play, undo history, mode and camera", async () => {
    const session = await played(hotseat, OPENING, true, "black");
    expect(session.commands).toHaveLength(2);
    const store = new MemoryStore();
    saveSession(store, session);

    const loaded = loadSession(store)!;
    expect(loaded).toEqual({ ...session, seed: { last: null, captured: [] } });
    expect(loaded.viewpoint).toBe("black");

    const { match } = newMatch(SeksGame.fromStateJson(loaded.base), loaded.mode);
    match.resume(loaded.commands);
    await match.start();
    const original = (await played(hotseat, OPENING)).commands;
    expect(match.record().commands).toEqual(original);
    const snapshot = match.snapshot();
    expect(snapshot.view.to_move).toBe("white");
    expect(snapshot.last).toMatchObject({ side: "black", from: "b10", to: "b8" });
    expect(snapshot.canUndo).toBe(true);

    // The undo history came back with it: two plays can be taken back.
    match.undo();
    match.undo();
    expect(match.snapshot().view).toEqual(SeksGame.create().view());
    expect(match.snapshot().canUndo).toBe(false);
  });

  it("keeps the colour and the level of the human against the bot", async () => {
    const mode: Mode = { kind: "bot", human: "black", level };
    const store = new MemoryStore();
    saveSession(store, await played(mode, []));
    expect(loadSession(store)?.mode).toEqual(mode);
  });

  it("makes the bot think again when it is its turn in the resumed position", async () => {
    const mode: Mode = { kind: "bot", human: "white", level };
    const store = new MemoryStore();
    // The human played; the bot had not answered when the page went away.
    const bot = new ScriptedBot();
    const first = newMatch(SeksGame.create(), mode, bot);
    await first.match.start();
    void first.match.click("b2").then(() => first.match.click("b4"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(first.match.snapshot().thinking).toBe(true);
    saveSession(store, { mode, ...first.match.record(), seed: {}, tilted: false, viewpoint: "white" });

    const loaded = loadSession(store)!;
    const again = new ScriptedBot();
    const { match } = newMatch(SeksGame.fromStateJson(loaded.base), loaded.mode, again);
    match.resume(loaded.commands);
    void match.start();
    expect(match.snapshot().thinking).toBe(true);
    expect(again.requests).toHaveLength(1);
    expect(JSON.parse(again.requests[0]!.state).to_move).toBe("black");
  });

  it("keeps what a loaded position starts with", async () => {
    const seed = { last: { side: "black" as const, from: "g8" as const, to: "g6" as const, value: 2, captures: 0 }, captured: [{ side: "white" as const, value: 4 }] };
    const store = new MemoryStore();
    saveSession(store, { ...(await played(hotseat, [])), seed });
    expect(loadSession(store)?.seed).toEqual(seed);
  });

  it("is forgotten by clearSession", async () => {
    const store = new MemoryStore();
    saveSession(store, await played(hotseat, OPENING));
    clearSession(store);
    expect(loadSession(store)).toBeNull();
    expect(store.items.size).toBe(0);
  });

  it("is null when nothing was saved", () => {
    expect(loadSession(new MemoryStore())).toBeNull();
  });
});

describe("an invalid saved session", () => {
  const valid = async () => {
    const store = new MemoryStore();
    saveSession(store, await played(hotseat, OPENING));
    return { store, saved: JSON.parse(store.items.get(SESSION_KEY)!) as Record<string, unknown> };
  };
  const discards = (store: MemoryStore, text: string) => {
    store.items.set(SESSION_KEY, text);
    expect(loadSession(store)).toBeNull();
    expect(store.items.has(SESSION_KEY)).toBe(false);
  };

  it("is dropped without error when it is not JSON", () => {
    discards(new MemoryStore(), "{not json");
  });

  it("is dropped when it is not an object of the format", () => {
    discards(new MemoryStore(), "42");
    discards(new MemoryStore(), "null");
    discards(new MemoryStore(), "{}");
  });

  it("is dropped when the format has another version", async () => {
    const { store, saved } = await valid();
    discards(store, JSON.stringify({ ...saved, version: 0 }));
  });

  it("is dropped when the engine refuses the position (the wire changed)", async () => {
    const { store, saved } = await valid();
    discards(store, JSON.stringify({ ...saved, base: '{"board":"other shape"}' }));
  });

  it("is dropped when a command is not legal", async () => {
    const { store, saved } = await valid();
    discards(store, JSON.stringify({ ...saved, commands: ["b2-b4", "b2-b4"] satisfies Command[] }));
  });

  it("is dropped when the mode or the level is unknown", async () => {
    const { store, saved } = await valid();
    discards(store, JSON.stringify({ ...saved, mode: { kind: "bot", human: "white", level: "godlike" } }));
    discards(store, JSON.stringify({ ...saved, mode: { kind: "bot", human: "green", level: "easy" } }));
    discards(store, JSON.stringify({ ...saved, mode: { kind: "network" } }));
  });

  it("is dropped when a field has the wrong type", async () => {
    const { store, saved } = await valid();
    discards(store, JSON.stringify({ ...saved, commands: [1, 2] }));
    discards(store, JSON.stringify({ ...saved, tilted: "yes" }));
    discards(store, JSON.stringify({ ...saved, viewpoint: "north" }));
    const { viewpoint: _gone, ...without } = saved;
    discards(store, JSON.stringify(without));
    discards(store, JSON.stringify({ ...saved, seed: null }));
  });
});
