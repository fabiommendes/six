import { BOT_LEVELS } from "../bot/levels";
import type { Command } from "../engine/game";
import { SeksGame, type Side } from "../engine/game";
import type { Captured, LastPlay, LocalMode, Seed } from "./match";

/** What it takes to open a match again after a reload (see `Match.record()`). */
export interface Session {
  readonly mode: LocalMode;
  /** The `SeksGame.stateJson()` the match started from. */
  readonly base: string;
  /** The commands played since, in order. */
  readonly commands: readonly Command[];
  /** What the match started with besides the position (a loaded position). */
  readonly seed: Seed;
  /** Whether the camera is tilted. */
  readonly tilted: boolean;
  /** The side the board is seen from. */
  readonly viewpoint: Side;
}

/** The part of `Storage` that the session uses. */
export type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const SESSION_KEY = "seks-web:session";
/** Bumped when the saved format changes; an older save is dropped. */
const VERSION = 2;

type SavedMode = { kind: "hotseat" } | { kind: "bot"; human: Side; level: string };

interface Saved {
  version: number;
  mode: SavedMode;
  base: string;
  commands: string[];
  seed: { last: LastPlay | null; captured: Captured[] };
  tilted: boolean;
  viewpoint: Side;
}

const isSide = (value: unknown): value is Side => value === "white" || value === "black";

/** Writes the session. A full or blocked storage is not an error: the match goes on unsaved. */
export function saveSession(store: SessionStore, session: Session): void {
  const mode: SavedMode = session.mode.kind === "hotseat" ? { kind: "hotseat" } : { kind: "bot", human: session.mode.human, level: session.mode.level.id };
  const saved: Saved = {
    version: VERSION,
    mode,
    base: session.base,
    commands: [...session.commands],
    seed: { last: session.seed.last ?? null, captured: [...(session.seed.captured ?? [])] },
    tilted: session.tilted,
    viewpoint: session.viewpoint,
  };
  try {
    store.setItem(SESSION_KEY, JSON.stringify(saved));
  } catch {
    // Nothing to do: it is only a convenience of the development server.
  }
}

/** Forgets the saved session. */
export function clearSession(store: SessionStore): void {
  try {
    store.removeItem(SESSION_KEY);
  } catch {
    // Same as `saveSession`.
  }
}

/**
 * The saved session, or `null` if there is none or it does not hold: another
 * format, a position the engine refuses (the `wire` changed), a command that
 * is not legal. An invalid save is removed.
 */
export function loadSession(store: SessionStore): Session | null {
  let text: string | null;
  try {
    text = store.getItem(SESSION_KEY);
  } catch {
    return null;
  }
  if (text === null) return null;
  const session = parse(text);
  if (session === null) clearSession(store);
  return session;
}

function parse(text: string): Session | null {
  try {
    const saved = JSON.parse(text) as Partial<Saved> | null;
    if (saved?.version !== VERSION || typeof saved.base !== "string" || typeof saved.tilted !== "boolean" || !isSide(saved.viewpoint)) return null;
    if (!Array.isArray(saved.commands) || !saved.commands.every((command) => typeof command === "string")) return null;
    const mode = parseMode(saved.mode);
    if (mode === null || !saved.seed || !Array.isArray(saved.seed.captured)) return null;
    const session: Session = {
      mode,
      base: saved.base,
      commands: saved.commands as Command[],
      seed: { last: saved.seed.last ?? null, captured: saved.seed.captured },
      tilted: saved.tilted,
      viewpoint: saved.viewpoint,
    };
    return replays(session) ? session : null;
  } catch {
    return null;
  }
}

function parseMode(saved: unknown): LocalMode | null {
  const mode = saved as Partial<SavedMode> | null;
  if (mode?.kind === "hotseat") return { kind: "hotseat" };
  if (mode?.kind !== "bot" || !isSide(mode.human)) return null;
  const level = BOT_LEVELS.find((candidate) => candidate.id === mode.level);
  return level ? { kind: "bot", human: mode.human, level } : null;
}

/** Whether the engine takes the position and every command. */
function replays(session: Session): boolean {
  let game: SeksGame | null = null;
  try {
    game = SeksGame.fromStateJson(session.base);
    for (const command of session.commands) game.command(command);
    return true;
  } catch {
    return false;
  } finally {
    game?.free();
  }
}
