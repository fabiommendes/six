/**
 * The messages of a live match, version 1. Each one is a JSON object in a text:
 *
 * - `{"t":"state","v":1,"g":"<link>"}`: the whole match in the fragment format of
 *   `logic/link.ts` (without the `#`). Sent when the other player arrives, after
 *   a reconnection, and to resynchronize;
 * - `{"t":"move","v":1,"n":<ply>,"c":"<command>","h":"<hash>"}`: one play. `n`
 *   is the index of the play from 0 (how many plays came before it) and `h` is
 *   the hash of the position after it;
 * - `{"t":"resign","v":1}`: the sender left the match.
 *
 * Anything else (another version, a malformed text) is ignored.
 */

export const PROTOCOL_VERSION = 1;

export type Message =
  | { readonly t: "state"; readonly g: string }
  | { readonly t: "move"; readonly n: number; readonly c: string; readonly h: string }
  | { readonly t: "resign" };

export function encodeMessage(message: Message): string {
  return JSON.stringify({ ...message, v: PROTOCOL_VERSION });
}

/** The message in `text`, or `null` if it is not one this code reads. */
export function decodeMessage(text: string): Message | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const message = value as Record<string, unknown>;
  if (message.v !== PROTOCOL_VERSION) return null;
  if (message.t === "resign") return { t: "resign" };
  if (message.t === "state" && typeof message.g === "string") return { t: "state", g: message.g };
  if (message.t === "move" && Number.isInteger(message.n) && (message.n as number) >= 0 && typeof message.c === "string" && typeof message.h === "string") {
    return { t: "move", n: message.n as number, c: message.c, h: message.h };
  }
  return null;
}
