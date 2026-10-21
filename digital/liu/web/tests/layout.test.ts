import { describe, expect, it } from "vitest";
import { bagSpot, cellAt, MARKET_RADIUS, marketSpot, MAT_SIZE, seatToTable, tableToSeat } from "../src/table/layout";

describe("table layout", () => {
  it("turns between the frame of a seat and the table both ways", () => {
    for (const seats of [2, 3, 4]) {
      for (let seat = 0; seat < seats; seat++) {
        const local = { x: 1.5, z: -2.25 };
        const back = tableToSeat(seat, seats, seatToTable(seat, seats, local));
        expect(back.x).toBeCloseTo(local.x);
        expect(back.z).toBeCloseTo(local.z);
      }
    }
  });

  it("puts seat 0 at the bottom and the next seat to its left", () => {
    expect(seatToTable(0, 4, { x: 0, z: 0 }).z).toBeGreaterThan(0);
    expect(seatToTable(1, 4, { x: 0, z: 0 }).x).toBeLessThan(0);
  });

  it("keeps the mats apart and the bag off every mat", () => {
    for (const seats of [2, 3, 4]) {
      const bag = bagSpot(seats);
      for (let seat = 0; seat < seats; seat++) {
        const local = tableToSeat(seat, seats, bag);
        expect(Math.max(Math.abs(local.x), Math.abs(local.z))).toBeGreaterThan(MAT_SIZE / 2 + 0.8);
      }
    }
  });

  it("lays the market inside the tray", () => {
    for (let count = 1; count <= 20; count++) {
      for (let i = 0; i < count; i++) {
        const at = marketSpot(i, count);
        expect(Math.hypot(at.x, at.z)).toBeLessThan(MARKET_RADIUS - 0.5);
      }
    }
  });

  it("reads the cell under a point of a mat", () => {
    expect(cellAt({ x: 1.2, z: -0.7 })).toEqual({ row: -1, col: 1 });
    expect(cellAt({ x: 3.6, z: 0 })).toBeNull();
  });
});
