import { describe, expect, it } from "vitest";
import { claimSlot, slotAmong } from "../src/logic/feedback";

const owned = (owners: (number | null)[]) => ({ stones: owners.map((owner) => ({ number: 1, owner, sides: [] })) });

describe("the slot of a taken formation", () => {
  it("is its rank among the stones of its owner, from the left", () => {
    const view = owned([null, 0, 1, 0, null, 0, null, null, 1]);
    expect(claimSlot(view, 0, 1)).toBe(0);
    expect(claimSlot(view, 0, 3)).toBe(1);
    expect(claimSlot(view, 0, 5)).toBe(2);
    expect(claimSlot(view, 1, 8)).toBe(1);
    expect(claimSlot(view, 1, 3)).toBe(-1);
  });

  it("is the same from the owners alone", () => {
    const owners = [null, 0, 1, 0, null, 0, null, null, 1];
    for (const player of [0, 1]) for (let stone = 0; stone < 9; stone++) expect(slotAmong(owners, player, stone)).toBe(claimSlot(owned(owners), player, stone));
  });
});
