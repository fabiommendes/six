/**
 * The way two browsers talk in a live match (`dev/rfc/rede-sem-servidor.md`).
 * Nothing here knows Seks or any library: the page uses `trystero-transport.ts`
 * and the tests use an in-memory one, so the library can change without
 * touching the rest.
 *
 * A room holds the two players. It carries texts only; what they mean is the
 * business of `live-protocol.ts`.
 */

/** What a room tells the page. */
export interface RoomHandlers {
  /** A text from the other player. */
  onMessage(text: string): void;
  /** Someone arrived in the room: the page tells them the position. */
  onJoin(): void;
  /** Someone left the room (a closed tab, a lost connection). */
  onLeave(): void;
  /** The room could not be joined or the connection could not be made (for a screen to say). */
  onError?(reason: string): void;
}

export interface Room {
  /** How many other players are in the room now (0 or 1 in a match; more if a stranger found the room). */
  readonly peers: number;
  /** Sends a text to whoever is in the room; dropped if nobody is. */
  send(text: string): void;
  /** Leaves the room and stops every handler. */
  leave(): void;
}

export interface Transport {
  /** Joins the room with this name. */
  join(roomId: string, handlers: RoomHandlers): Room;
}

/** The room of a match: the same on both sides, from the id of the match. */
export const roomIdOf = (matchId: string): string => `seks.${matchId}`;
