import { describe, expect, it } from "vitest";
import {
  arrangementFor,
  bagSpot,
  boxSpot,
  claimedSpot,
  extentPoints,
  frameLayout,
  handSpot,
  MAX_CLAIMED,
  seatAngle,
  seatToTable,
  sideSpot,
  stoneColumn,
  stoneSpot,
  STONES,
  traySize,
  trayCentre,
} from "../src/table/layout";

const key = (p: { x: number; z: number }) => `${p.x},${p.z}`;

describe("the row of stones", () => {
  it("fills the nine middle cells of the central row, from left to right", () => {
    const columns = Array.from({ length: STONES }, (_, i) => stoneColumn(i));
    expect(columns).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
    for (let i = 0; i < STONES; i++) expect(stoneSpot(i)).toEqual({ x: columns[i], z: 0 });
  });
});

describe("the seats", () => {
  it("face each other: the second player's frame is the first turned half a circle", () => {
    expect(seatToTable(0, { x: 2, z: 3 })).toEqual({ x: 2, z: 3 });
    expect(seatToTable(1, { x: 2, z: 3 })).toEqual({ x: -2, z: -3 });
    expect(seatAngle(1) - seatAngle(0)).toBeCloseTo(Math.PI);
  });

  it("puts the three dice of a side in the column of the stone, on the side of its player", () => {
    for (let stone = 0; stone < STONES; stone++) {
      // Both sides of a stone are in the same column of the board.
      expect(sideSpot(0, stone, 0).x).toBe(stoneColumn(stone));
      expect(sideSpot(1, stone, 2).x).toBe(stoneColumn(stone));
      expect([0, 1, 2].map((k) => sideSpot(0, stone, k).z)).toEqual([1, 2, 3]);
      expect([0, 1, 2].map((k) => sideSpot(1, stone, k).z)).toEqual([-1, -2, -3]);
    }
  });
});

describe("the taken formations", () => {
  it("sit in the two free rows behind the player, a block of 2 by 2 for each", () => {
    for (const seat of [0, 1]) {
      const sign = seat === 0 ? 1 : -1;
      for (let slot = 0; slot < MAX_CLAIMED; slot++) {
        const cells = [0, 1, 2, 3].map((part) => claimedSpot(seat, slot, part));
        for (const cell of cells) expect(Math.abs(cell.z)).toBeGreaterThanOrEqual(4);
        for (const cell of cells) expect(Math.abs(cell.z)).toBeLessThanOrEqual(5);
        for (const cell of cells) expect(Math.sign(cell.z)).toBe(sign);
        for (const cell of cells) expect(Math.abs(cell.x)).toBeLessThanOrEqual(5);
      }
    }
  });

  it("never share a cell, nor take one of the three rows of the sides", () => {
    for (const seat of [0, 1]) {
      const used = new Set<string>();
      for (let slot = 0; slot < MAX_CLAIMED; slot++) {
        for (let part = 0; part < 4; part++) {
          const k = key(claimedSpot(seat, slot, part));
          expect(used.has(k)).toBe(false);
          used.add(k);
        }
      }
      expect(used.size).toBe(MAX_CLAIMED * 4);
    }
  });

  it("start with the stone, on the row nearest the sides", () => {
    expect(claimedSpot(0, 0, 0)).toEqual({ x: -5, z: 4 });
    expect(claimedSpot(0, 1, 3)).toEqual({ x: -2, z: 5 });
    expect(claimedSpot(1, 0, 0)).toEqual({ x: 5, z: -4 });
  });
});

describe("the hands", () => {
  it("give each of the seven dice its own spot, in either arrangement", () => {
    for (const arrangement of ["wide", "tall"] as const) {
      for (const seat of [0, 1]) {
        const spots = Array.from({ length: 7 }, (_, slot) => key(handSpot(seat, slot, arrangement)));
        expect(new Set(spots).size).toBe(7);
      }
    }
  });

  it("keep the tray of a player on their side of the board, clear of the board", () => {
    for (const arrangement of ["wide", "tall"] as const) {
      const size = traySize(arrangement);
      const near = trayCentre(0, arrangement);
      const far = trayCentre(1, arrangement);
      expect(near.z).toBeGreaterThan(0);
      expect(far.z).toBeLessThan(0);
      expect(far.x).toBeCloseTo(-near.x);
      // The tray does not overlap the board (half a side of the frame is 6.8 cells).
      const clearX = Math.abs(near.x) - size.width / 2 >= 6.8 - 1e-9;
      const clearZ = Math.abs(near.z) - size.depth / 2 >= 6.8 - 1e-9;
      expect(clearX || clearZ).toBe(true);
    }
  });

  it("has a tray with a slot for every die", () => {
    expect(traySize("wide", 7).cols * traySize("wide", 7).rows).toBeGreaterThanOrEqual(7);
    expect(traySize("tall", 7).cols).toBe(7);
  });
});

describe("the arrangement", () => {
  it("is wide on a wide screen and tall on a narrow one", () => {
    expect(arrangementFor(16 / 9)).toBe("wide");
    expect(arrangementFor(390 / 600)).toBe("tall");
  });

  it("keeps the bag and the box off the board and the trays", () => {
    for (const arrangement of ["wide", "tall"] as const) {
      for (const spot of [bagSpot(arrangement), boxSpot(arrangement)]) {
        expect(Math.max(Math.abs(spot.x), Math.abs(spot.z))).toBeGreaterThan(6.8);
      }
      expect(extentPoints(arrangement).length).toBeGreaterThan(8);
    }
  });
});

describe("the frame of the board", () => {
  it("has a grid of 11 cells that fit inside the plate, centred", () => {
    const frame = frameLayout();
    expect(frame.gridAt + 11 * frame.cell).toBeCloseTo(frame.sketch - frame.gridAt);
    expect(frame.worldSize).toBeGreaterThan(11);
    expect(frame.worldSize / 2).toBeLessThanOrEqual(7);
  });
});
