import { isBotLevelId } from "../bot/levels";
import type { BotLevelId } from "../bot/protocol";
import type { State } from "../engine/game";

/** Who plays a seat: a person (null) or a bot. */
export type SeatBot = BotLevelId | null;

/** A game kept on this device between visits: the names, who plays each seat and the engine state (with the rules). */
export interface Saved {
  readonly names: readonly string[];
  readonly bots: readonly SeatBot[];
  readonly state: State;
}

/** The part of `Storage` the save needs, so tests can pass a map. */
export type SaveStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "conexao.partida.v2";
/** The key of the format before the reserve was counted by value: dropped when found. */
const OLD_KEYS = ["conexao.partida.v1"];

export function save(store: SaveStore, saved: Saved): void {
  try {
    store.setItem(KEY, JSON.stringify(saved));
  } catch {
    // A full or blocked storage only loses the save.
  }
}

/** Whether `value` has the shape of the current state: the reserve of each player counted by value. */
function isState(value: unknown): value is State {
  if (typeof value !== "object" || value === null) return false;
  const { reserve, rules } = value as { reserve?: unknown; rules?: unknown };
  const counts = (r: unknown) => Array.isArray(r) && r.length === 7 && r.every((n) => typeof n === "number");
  const extra = (rules as { extra?: unknown } | null | undefined)?.extra;
  return Array.isArray(reserve) && reserve.length === 2 && reserve.every(counts) && (extra === undefined || counts(extra));
}

/** The saved game, or null. The engine checks the state when it reads it. */
export function load(store: SaveStore): Saved | null {
  try {
    for (const old of OLD_KEYS) store.removeItem(old);
    const text = store.getItem(KEY);
    if (!text) return null;
    const saved = JSON.parse(text) as Partial<Saved>;
    if (!Array.isArray(saved.names) || saved.names.length !== 2 || saved.names.some((n) => typeof n !== "string") || !isState(saved.state)) {
      return null;
    }
    const bots = Array.isArray(saved.bots) && saved.bots.length === 2 ? saved.bots : [null, null];
    if (bots.some((b) => b !== null && !isBotLevelId(b))) return null;
    return { names: saved.names, bots, state: saved.state };
  } catch {
    return null;
  }
}

export function clear(store: SaveStore): void {
  try {
    store.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}

/** The local storage, or null where the browser blocks it. */
export function deviceStore(): SaveStore | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
