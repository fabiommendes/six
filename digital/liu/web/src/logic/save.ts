import type { State } from "../engine/game";

/** A game kept on this device between visits: the names and the engine state. */
export interface Saved {
  readonly names: readonly string[];
  readonly state: State;
}

/** The part of `Storage` the save needs, so tests can pass a map. */
export type SaveStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "liu.partida.v1";

export function save(store: SaveStore, saved: Saved): void {
  try {
    store.setItem(KEY, JSON.stringify(saved));
  } catch {
    // A full or blocked storage only loses the save.
  }
}

/** The saved game, or null. The engine checks the state when it reads it. */
export function load(store: SaveStore): Saved | null {
  try {
    const text = store.getItem(KEY);
    if (!text) return null;
    const saved = JSON.parse(text) as Partial<Saved>;
    if (!Array.isArray(saved.names) || saved.names.some((n) => typeof n !== "string") || typeof saved.state !== "object" || saved.state === null) {
      return null;
    }
    return { names: saved.names, state: saved.state };
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
