import type { Side } from "../engine/game";
import { isGameId, randomGameId, type Link } from "./link";

/**
 * The games by correspondence that this browser keeps, to come back to them
 * without the link. One entry per game, found by the id the link carries.
 */
export interface MailGame {
  readonly id: string;
  /** The start position, as in the link. */
  readonly start: string;
  /** The side this browser plays. */
  readonly player: Side;
  readonly commands: readonly string[];
  /**
   * How many of the commands the opponent already has: the ones that came in
   * a link and the ones sent by copying or sharing. Only the plies after it
   * can be undone.
   */
  readonly shared: number;
  /** Who is to move, so the list can say it without replaying the game. */
  readonly toMove: Side;
  readonly over: boolean;
  /** The side that left the game (resigned) and told it in a link; `null` while both are in. */
  readonly leftBy: Side | null;
  /** When the entry last changed (ms since the epoch), to list the latest first. */
  readonly updated: number;
}

/** The part of `Storage` that the games use. */
export type MailStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const MAIL_KEY = "seks-web:mail";
/** Bumped when the saved format changes; an older save is dropped. */
const VERSION = 1;

export const opposite = (side: Side): Side => (side === "white" ? "black" : "white");

const isSide = (value: unknown): value is Side => value === "white" || value === "black";

/** A new game by correspondence, from the standard position, for `player`. */
export function newMailGame(player: Side, now: number = Date.now(), id: string = randomGameId()): MailGame {
  return { id, start: "", player, commands: [], shared: 0, toMove: "white", over: false, leftBy: null, updated: now };
}

/**
 * The entry after the player resigned: marked with the side that left, and kept
 * (not removed) until the link that tells the opponent is sent, so a reload
 * does not lose it.
 */
export function markResigned(game: MailGame, now: number = Date.now()): MailGame {
  return { ...game, leftBy: game.player, updated: now };
}

/** Whether the player of this entry resigned and the link that tells it is still to be sent. */
export const isResigned = (game: MailGame): boolean => game.leftBy === game.player;

/** What the player of this entry may do with the game now. */
export function mailStatus(game: MailGame): "yours" | "waiting" | "over" {
  if (game.over) return "over";
  return game.toMove === game.player ? "yours" : "waiting";
}

/** The saved games, latest first. A damaged save yields the entries that still hold, or none. */
export function loadMailGames(store: MailStore): MailGame[] {
  let text: string | null;
  try {
    text = store.getItem(MAIL_KEY);
  } catch {
    return [];
  }
  if (text === null) return [];
  try {
    const saved = JSON.parse(text) as { version?: unknown; games?: unknown } | null;
    if (saved?.version !== VERSION || !Array.isArray(saved.games)) return [];
    return saved.games.filter(isMailGame).sort((a, b) => b.updated - a.updated);
  } catch {
    return [];
  }
}

function isMailGame(value: unknown): value is MailGame {
  const game = value as Partial<MailGame> | null;
  return (
    game !== null &&
    typeof game === "object" &&
    typeof game.id === "string" &&
    isGameId(game.id) &&
    typeof game.start === "string" &&
    isSide(game.player) &&
    Array.isArray(game.commands) &&
    game.commands.every((command) => typeof command === "string") &&
    Number.isInteger(game.shared) &&
    game.shared! >= 0 &&
    game.shared! <= game.commands.length &&
    isSide(game.toMove) &&
    typeof game.over === "boolean" &&
    (game.leftBy === null || isSide(game.leftBy)) &&
    typeof game.updated === "number"
  );
}

/** The game with this id, or `null`. */
export function findMailGame(store: MailStore, id: string): MailGame | null {
  return loadMailGames(store).find((game) => game.id === id) ?? null;
}

function write(store: MailStore, games: readonly MailGame[]): void {
  try {
    store.setItem(MAIL_KEY, JSON.stringify({ version: VERSION, games }));
  } catch {
    // A full or blocked storage is not an error: the game goes on, unsaved.
  }
}

/** Adds the game or replaces the entry with the same id. */
export function saveMailGame(store: MailStore, game: MailGame): void {
  write(store, [game, ...loadMailGames(store).filter((other) => other.id !== game.id)]);
}

export function removeMailGame(store: MailStore, id: string): void {
  write(store, loadMailGames(store).filter((game) => game.id !== id));
}

/** A storage that lives as long as the page, for browsers that block the real one. */
export function memoryStore(): MailStore {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

/** How a game replayed from a link looks at its end (see `outlook` in `seks-link.ts`). */
export interface LinkOutlook {
  readonly toMove: Side;
  readonly over: boolean;
  readonly lastMover: Side | null;
}

/** What opening a link leads to. */
export type Opening =
  | {
      /** The game to show and keep. */
      readonly kind: "open";
      readonly game: MailGame;
      /** The link was older than the game kept here, which is more advanced. */
      readonly stale: boolean;
    }
  /** The link cannot be taken for this game: see the reasons. */
  | { readonly kind: "refused"; readonly reason: "format" | "other-game" | "diverged" };

const isPrefix = (short: readonly string[], long: readonly string[]) => short.length <= long.length && short.every((command, i) => command === long[i]);

/** The side a `left` token of a link names (`w` or `b`, see `sideToken` in `seks-link.ts`). */
const sideOfToken = (token: string): Side | null => (token === "w" ? "white" : token === "b" ? "black" : null);

/**
 * Opens a link (already replayed, so every command in it is legal) against
 * the entry with its id, if any.
 *
 * - No entry: a new game; this browser plays the side that the link leaves to
 *   move (or, for a finished game, the side that did not play last; for a
 *   link in which someone left, the other side).
 * - The link goes beyond the entry: the entry takes it, all of it known to the
 *   opponent. The side stays the one the entry had.
 * - The link is the entry or an older state of it: the entry stays (except
 *   for who left, which a link may tell).
 * - Anything else is refused: it is not the same game.
 */
export function openLink(link: Link, existing: MailGame | null, ending: LinkOutlook, now: number = Date.now()): Opening {
  const left = link.left === undefined || link.left === null ? null : sideOfToken(link.left);
  if (link.left !== undefined && link.left !== null && left === null) return { kind: "refused", reason: "format" };
  if (existing === null) {
    const player = left !== null ? opposite(left) : ending.lastMover === null ? ending.toMove : opposite(ending.lastMover);
    return {
      kind: "open",
      stale: false,
      game: { id: link.id, start: link.start, player, commands: link.commands, shared: link.commands.length, toMove: ending.toMove, over: ending.over, leftBy: left, updated: now },
    };
  }
  if (existing.start !== link.start || left === existing.player) return { kind: "refused", reason: "other-game" };
  if (isPrefix(link.commands, existing.commands)) {
    const game = left === null || left === existing.leftBy ? existing : { ...existing, leftBy: left, updated: now };
    return { kind: "open", stale: link.commands.length < existing.commands.length, game };
  }
  if (!isPrefix(existing.commands, link.commands)) return { kind: "refused", reason: "diverged" };
  return {
    kind: "open",
    stale: false,
    game: { ...existing, commands: link.commands, shared: link.commands.length, toMove: ending.toMove, over: ending.over, leftBy: left ?? existing.leftBy, updated: now },
  };
}

/** What the fragment of the page asks for. */
export type Route = { readonly kind: "none" } | { readonly kind: "link"; readonly fragment: string } | { readonly kind: "game"; readonly id: string };

/** `#g.<id>`: this browser's own game; anything else after the `#` is taken for a link. */
export function parseRoute(hash: string): Route {
  const text = hash.trim().replace(/^#/, "");
  if (text === "") return { kind: "none" };
  const own = /^g\.(.+)$/.exec(text);
  if (own !== null && isGameId(own[1]!)) return { kind: "game", id: own[1]! };
  return { kind: "link", fragment: text };
}

/** The fragment that points at this browser's game. */
export function gameRoute(id: string): string {
  return `#g.${id}`;
}
