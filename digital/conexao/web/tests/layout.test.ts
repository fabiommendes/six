import { describe, expect, it } from "vitest";
import { squareOf } from "../src/engine/game";
import { BOARD_HALF, extentPoints, squareAt, squareSpot, trayCentre, traySize, traySpot, TRAY_SLOTS } from "../src/table/layout";

describe("the board on the table", () => {
  it("puts row 0 by the White, at +z, and column 0 on their left", () => {
    expect(squareSpot(squareOf(0, 0), 11)).toEqual({ x: -5, z: 5 });
    expect(squareSpot(squareOf(10, 10), 11)).toEqual({ x: 5, z: -5 });
  });

  it("centres a 9x9 board on the board of the Seks", () => {
    expect(squareSpot(squareOf(0, 0), 9)).toEqual({ x: -4, z: 4 });
    expect(squareSpot(squareOf(4, 4), 9)).toEqual({ x: 0, z: 0 });
  });

  it("finds the square of a cell, and nothing out of the game", () => {
    for (const size of [9, 11]) {
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const square = squareOf(row, col);
          const spot = squareSpot(square, size);
          expect(squareAt(spot.x + 0.3, spot.z - 0.3, size)).toBe(square);
        }
      }
    }
    expect(squareAt(-5, 5, 9)).toBeNull();
    expect(squareAt(0, 0, 9)).toBe(squareOf(4, 4));
  });
});

describe("trays", () => {
  it("stay off the board and inside the points the camera keeps", () => {
    for (const arrangement of ["wide", "tall"] as const) {
      const points = extentPoints(arrangement);
      const maxX = Math.max(...points.map((p) => Math.abs(p.x)));
      const maxZ = Math.max(...points.map((p) => Math.abs(p.z)));
      for (const seat of [0, 1]) {
        for (const kind of ["reserve", "captured"] as const) {
          for (let slot = 0; slot < TRAY_SLOTS[kind]; slot++) {
            const p = traySpot(seat, kind, slot, arrangement);
            expect(Math.abs(p.x) > BOARD_HALF || Math.abs(p.z) > BOARD_HALF).toBe(true);
            expect(Math.abs(p.x)).toBeLessThanOrEqual(maxX);
            expect(Math.abs(p.z)).toBeLessThanOrEqual(maxZ);
          }
        }
      }
    }
  });

  it("do not overlap each other", () => {
    for (const arrangement of ["wide", "tall"] as const) {
      const boxes = [0, 1].flatMap((seat) =>
        (["reserve", "captured"] as const).map((kind) => {
          const c = trayCentre(seat, kind, arrangement);
          const s = traySize(kind, arrangement);
          return { x0: c.x - s.width / 2, x1: c.x + s.width / 2, z0: c.z - s.depth / 2, z1: c.z + s.depth / 2 };
        }),
      );
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b) => {
          const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0;
          expect(apart).toBe(true);
        }),
      );
    }
  });
});
