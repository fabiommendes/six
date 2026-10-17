/** The part of `Storage` that the view preference uses. */
export type PreferenceStore = Pick<Storage, "getItem" | "setItem">;

export const VIEW_KEY = "seks-web:view";

const TILTED = "tilted";
const TOP = "top";

/** The saved view: `true` tilted, `false` from above, `null` if none was saved or the value is not one of the two. */
export function loadTiltedPreference(store: PreferenceStore): boolean | null {
  let value: string | null;
  try {
    value = store.getItem(VIEW_KEY);
  } catch {
    return null;
  }
  if (value === TILTED) return true;
  if (value === TOP) return false;
  return null;
}

/** Saves the view for the next matches and visits. A full or blocked storage is not an error. */
export function saveTiltedPreference(store: PreferenceStore, tilted: boolean): void {
  try {
    store.setItem(VIEW_KEY, tilted ? TILTED : TOP);
  } catch {
    // Nothing to do: the preference only lasts until the page closes.
  }
}
