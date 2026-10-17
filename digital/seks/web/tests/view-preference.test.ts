import { describe, expect, it } from "vitest";
import { loadTiltedPreference, saveTiltedPreference, VIEW_KEY, type PreferenceStore } from "../src/logic/view-preference";

class MemoryStore implements PreferenceStore {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const blocked: PreferenceStore = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("full");
  },
};

describe("the saved view", () => {
  it("is unknown until one is saved", () => {
    expect(loadTiltedPreference(new MemoryStore())).toBeNull();
  });

  it("brings back the last view saved, tilted or from above", () => {
    const store = new MemoryStore();
    saveTiltedPreference(store, true);
    expect(loadTiltedPreference(store)).toBe(true);
    saveTiltedPreference(store, false);
    expect(loadTiltedPreference(store)).toBe(false);
  });

  it("ignores a value that is not a view", () => {
    const store = new MemoryStore();
    for (const value of ["", "true", "1", "TILTED", "{}", "null", "oblique"]) {
      store.items.set(VIEW_KEY, value);
      expect(loadTiltedPreference(store), value).toBeNull();
    }
  });

  it("does not fail on a blocked or full storage", () => {
    expect(() => saveTiltedPreference(blocked, true)).not.toThrow();
    expect(loadTiltedPreference(blocked)).toBeNull();
  });
});
