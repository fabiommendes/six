import type { View } from "../engine/game";
import { ownedStones } from "./formation";

/** What the table needs to know about a change, kept apart from the drawing. */

/**
 * The slot of a stone taken by `player` among the formations the player
 * has taken, left to right: the stones taken, by position, in order.
 * Returns -1 for a stone the player has not taken.
 */
export function claimSlot(view: Pick<View, "stones">, player: number, stone: number): number {
  return ownedStones(view, player).indexOf(stone);
}

/** The same as `claimSlot`, from the owner of each stone. */
export function slotAmong(owners: readonly (number | null)[], player: number, stone: number): number {
  if (owners[stone] !== player) return -1;
  return owners.slice(0, stone).filter((o) => o === player).length;
}
