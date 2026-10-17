import type { Side } from "../engine/game";
import { isGameId } from "./link";

/** The version of the invite this module writes and reads. */
export const INVITE_VERSION = 1;

/** What the link of a live match invites to. */
export interface Invite {
  /** The id of the match, which also names the room. */
  readonly id: string;
  /** The side of whoever invites; the one who opens the link plays the other. */
  readonly host: Side;
}

/** The fragment (without the `#`) of the invite: `i1.<id>.<w|b>`. Throws if the id is not valid. */
export function encodeInvite(invite: Invite): string {
  if (!isGameId(invite.id)) throw new Error(`not a game id: ${JSON.stringify(invite.id)}`);
  return `i${INVITE_VERSION}.${invite.id}.${invite.host === "white" ? "w" : "b"}`;
}

/** The invite in a fragment (with or without the `#`), or `null` if it is not one. */
export function decodeInvite(fragment: string): Invite | null {
  const parts = fragment.trim().replace(/^#/, "").split(".");
  if (parts.length !== 3 || parts[0] !== `i${INVITE_VERSION}`) return null;
  const [, id, side] = parts as [string, string, string];
  if (!isGameId(id) || (side !== "w" && side !== "b")) return null;
  return { id, host: side === "w" ? "white" : "black" };
}
