/**
 * The game in a link, for play by correspondence (`dev/rfc/rede-sem-servidor.md`).
 *
 * This module knows nothing of Seks, of the DOM or of any storage: it turns a
 * game (an id, a start position and a list of commands) into the text of a URL
 * fragment and back, and it asks a `Ruleset` to validate every command. The
 * live P2P match and other games can reuse it with their own `Ruleset`.
 *
 * Fragment, version 2:
 *
 *     v2.<id>.<start>.<plays>[.<left>]
 *
 * - `id`: names the game, so a returning link finds its entry in the storage;
 * - `start`: the start position as the ruleset words it; empty for the
 *   standard one;
 * - `plays`: for each command, its index in `Rules.legalCommands()` at that
 *   point of the game, as a varint (7 bits per byte, low bits first, the high
 *   bit set when more bytes follow), in base64url without padding.
 *
 * - `left`: present only when the sender left the game (resigned); an
 *   opaque token that says which player left, in the words of the ruleset.
 *
 * The index form only works while a ruleset lists its legal commands in a
 * fixed order; a change of that order breaks old links, so each ruleset must
 * pin it with a test (see `tests/seks-link.test.ts`). Version 2 came when the
 * Whites lost the increments of the first turn, which changed the order.
 */

/** The version this module writes and reads. */
export const LINK_VERSION = 2;

/** A game as the link carries it. */
export interface Link {
  readonly id: string;
  /** The start position in the words of the ruleset; `""` for the standard one. */
  readonly start: string;
  /** The commands played from `start`, in order, in the notation of the ruleset. */
  readonly commands: readonly string[];
  /** Which player left the game with this link (a token of the ruleset); `null` while the game goes on. */
  readonly left?: string | null;
}

/** A game being replayed, which the ruleset owns. */
export interface Rules {
  /** Every legal command of the side to move, always in the same order for the same position. */
  legalCommands(): readonly string[];
  /** Plays a command; throws if it is illegal. */
  play(command: string): void;
  /** Releases what the game holds (engine memory). */
  dispose(): void;
}

/** The rules of a game, as the link needs them. */
export interface Ruleset {
  /** A game at `start`; throws if the position is not one the ruleset reads. */
  open(start: string): Rules;
}

export type LinkErrorCode =
  /** The text is not a link of any version. */
  | "format"
  /** The version is not one this code reads. */
  | "version"
  /** The start position is not valid. */
  | "start"
  /** A play is not legal at its point of the game (`ply` says which). */
  | "move";

/** A link that does not open, or a game that does not fit a link. */
export class LinkError extends Error {
  constructor(
    readonly code: LinkErrorCode,
    message: string,
    /** For `move`: the index of the play, from 0. */
    readonly ply: number | null = null,
  ) {
    super(message);
    this.name = "LinkError";
  }
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const TOKEN = /^[A-Za-z0-9_-]*$/;
/** An index above this does not fit 3 varint bytes: no ruleset has so many legal commands. */
const MAX_VARINT_BYTES = 3;

/** Whether `id` is a valid id of a game. */
export function isGameId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,32}$/.test(id);
}

/** A new random id (8 characters, 48 bits). `random` fills a buffer with random bytes. */
export function randomGameId(random: (bytes: Uint8Array) => void = (bytes) => void crypto.getRandomValues(bytes)): string {
  const bytes = new Uint8Array(6);
  random(bytes);
  return toBase64Url(bytes);
}

/** The fragment (without the `#`) that carries `link`. Throws a `move` error if a command is not legal in its turn. */
export function encodeLink(link: Link, ruleset: Ruleset): string {
  if (!isGameId(link.id)) throw new LinkError("format", `not a game id: ${JSON.stringify(link.id)}`);
  if (!TOKEN.test(link.start)) throw new LinkError("start", "the start position has characters a link cannot carry");
  const indexes = indexesOf(link.commands, link.start, ruleset);
  const parts = [`v${LINK_VERSION}`, link.id, link.start, toBase64Url(varints(indexes))];
  if (link.left !== undefined && link.left !== null) {
    if (link.left === "" || !TOKEN.test(link.left)) throw new LinkError("format", "the player who left has characters a link cannot carry");
    parts.push(link.left);
  }
  return parts.join(".");
}

/**
 * Reads a fragment (with or without the leading `#`) and replays it on the
 * ruleset, so every command it returns is legal in its turn. Throws a
 * `LinkError` for anything else.
 */
export function decodeLink(fragment: string, ruleset: Ruleset): Link {
  const parts = fragment.trim().replace(/^#/, "").split(".");
  if (parts.length !== 4 && parts.length !== 5) throw new LinkError("format", "the link does not have four or five parts");
  const [version, id, start, plays, left = null] = parts as [string, string, string, string, string?];
  const number = /^v(\d+)$/.exec(version);
  if (number === null) throw new LinkError("format", "the link has no version");
  if (Number(number[1]) !== LINK_VERSION) throw new LinkError("version", `link version ${number[1]} is not known`);
  if (!isGameId(id) || !TOKEN.test(start) || !TOKEN.test(plays) || (left !== null && !/^[A-Za-z0-9_-]+$/.test(left))) throw new LinkError("format", "the link has characters it should not");
  const indexes = readVarints(fromBase64Url(plays));
  return { id, start, commands: commandsOf(indexes, start, ruleset), left };
}

function open(start: string, ruleset: Ruleset): Rules {
  try {
    return ruleset.open(start);
  } catch (error) {
    throw new LinkError("start", error instanceof Error ? error.message : String(error));
  }
}

function indexesOf(commands: readonly string[], start: string, ruleset: Ruleset): number[] {
  const rules = open(start, ruleset);
  try {
    return commands.map((command, ply) => {
      const index = rules.legalCommands().indexOf(command);
      if (index < 0) throw new LinkError("move", `${command} is not legal at play ${ply + 1}`, ply);
      rules.play(command);
      return index;
    });
  } finally {
    rules.dispose();
  }
}

function commandsOf(indexes: readonly number[], start: string, ruleset: Ruleset): string[] {
  const rules = open(start, ruleset);
  try {
    return indexes.map((index, ply) => {
      const command = rules.legalCommands()[index];
      if (command === undefined) throw new LinkError("move", `there is no legal command ${index} at play ${ply + 1}`, ply);
      rules.play(command);
      return command;
    });
  } finally {
    rules.dispose();
  }
}

function varints(values: readonly number[]): Uint8Array {
  const bytes: number[] = [];
  for (let value of values) {
    while (value >= 0x80) {
      bytes.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    bytes.push(value);
  }
  return Uint8Array.from(bytes);
}

function readVarints(bytes: Uint8Array): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  let count = 0;
  for (const byte of bytes) {
    value |= (byte & 0x7f) << shift;
    shift += 7;
    count++;
    if ((byte & 0x80) === 0) {
      // A longer form than needed (a trailing zero group) is not the canonical one.
      if (count > 1 && byte === 0) throw new LinkError("format", "the plays are not in the canonical form");
      values.push(value);
      value = 0;
      shift = 0;
      count = 0;
    } else if (count === MAX_VARINT_BYTES) {
      throw new LinkError("format", "a play index is too large");
    }
  }
  if (count !== 0) throw new LinkError("format", "the plays end in the middle of an index");
  return values;
}

function toBase64Url(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(bytes.length - i, 3) + 1;
    for (let c = 0; c < chars; c++) text += ALPHABET.charAt((chunk >> (18 - 6 * c)) & 63);
  }
  return text;
}

function fromBase64Url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new LinkError("format", "the plays have a length no encoding gives");
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const group = text.slice(i, i + 4);
    let chunk = 0;
    for (let c = 0; c < 4; c++) chunk = (chunk << 6) | (c < group.length ? ALPHABET.indexOf(group.charAt(c)) : 0);
    for (let b = 0; b < group.length - 1; b++) bytes.push((chunk >> (16 - 8 * b)) & 0xff);
  }
  const result = Uint8Array.from(bytes);
  // Unused bits at the end must be zero, so each game has one link only.
  if (toBase64Url(result) !== text) throw new LinkError("format", "the plays are not in the canonical form");
  return result;
}
