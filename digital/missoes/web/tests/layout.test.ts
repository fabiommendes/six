import { describe, expect, it } from "vitest";
import { cardSpot, handSpot, reserveSpot, showcaseSpot, TABLE_D, TABLE_W, trays } from "../src/table/layout";

const inside = (x: number, z: number) => Math.abs(x) < TABLE_W / 2 && Math.abs(z) < TABLE_D / 2;

describe("the table layout", () => {
  it("has a tray per seat, inside the table and apart", () => {
    for (const n of [2, 3, 4]) {
      const all = trays(n);
      expect(all).toHaveLength(n);
      for (const t of all) {
        expect(inside(t.x - t.w / 2, t.z - t.d / 2) && inside(t.x + t.w / 2, t.z + t.d / 2)).toBe(true);
        expect(Math.abs(t.z) - t.d / 2).toBeGreaterThan(1.6);
      }
    }
  });

  it("keeps hands, reserves, cards and the showcase inside the table", () => {
    for (const tray of trays(4)) {
      for (let i = 0; i < 7; i++) expect(inside(handSpot(tray, i, 7).x, handSpot(tray, i, 7).z)).toBe(true);
      for (let i = 0; i < 24; i++) expect(inside(reserveSpot(tray, i).x, reserveSpot(tray, i).z)).toBe(true);
    }
    expect(cardSpot(4).x + 1.2).toBeLessThan(showcaseSpot(0).x - 0.5);
    for (let i = 0; i < 8; i++) expect(inside(showcaseSpot(i).x, showcaseSpot(i).z)).toBe(true);
  });
});
