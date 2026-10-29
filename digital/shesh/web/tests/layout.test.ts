import { describe, expect, it } from "vitest";
import {
  arrangementFor,
  binaryFaces,
  binarySpot,
  BOARD_HALF,
  cellOf,
  EXIT,
  extentPoints,
  frameLayout,
  laneOf,
  ownRow,
  ROSETTE,
  seatToTable,
  squareAt,
  squareSpot,
  TRAY_SLOTS,
  trayCentre,
  traySize,
  traySpot,
  type Arrangement,
} from "../src/table/layout";

describe("the track", () => {
  it("follows the board of Ur: entry lane in columns 6 to 3, middle lane in row 6 from column 3 to 10, exit lane in columns 10 and 9", () => {
    // The columns count from 1 on the left: column c is at x = c - 6.
    expect([1, 2, 3, 4].map((s) => squareSpot(0, s).x)).toEqual([0, -1, -2, -3]);
    expect([5, 6, 12].map((s) => squareSpot(0, s))).toEqual([{ x: -3, z: 0 }, { x: -2, z: 0 }, { x: 4, z: 0 }]);
    expect([13, 14, EXIT].map((s) => squareSpot(0, s).x)).toEqual([4, 3, 2]);
  });

  it("puts the own lanes on the row of each player and the middle lane on the central row", () => {
    expect(ownRow(0)).toBe(1);
    expect(ownRow(1)).toBe(-1);
    for (const seat of [0, 1]) {
      for (let s = 1; s <= EXIT; s++) expect(squareSpot(seat, s).z).toBe(laneOf(s) === "middle" ? 0 : ownRow(seat));
    }
  });

  it("shares the middle lane and keeps the own lanes apart", () => {
    for (let s = 5; s <= 12; s++) expect(squareSpot(0, s)).toEqual(squareSpot(1, s));
    for (const s of [1, 2, 3, 4, 13, 14]) expect(squareSpot(0, s)).not.toEqual(squareSpot(1, s));
  });

  it("has the red square in the middle of the board", () => {
    expect(squareSpot(0, ROSETTE)).toEqual({ x: 0, z: 0 });
    expect(squareSpot(1, ROSETTE)).toEqual({ x: 0, z: 0 });
  });

  it("names the three lanes", () => {
    expect([1, 4, 5, 12, 13, 14].map(laneOf)).toEqual(["entry", "entry", "middle", "middle", "exit", "exit"]);
  });

  it("finds the square of a cell, and nothing off the track", () => {
    for (const seat of [0, 1]) {
      for (let s = 1; s <= EXIT; s++) {
        const p = squareSpot(seat, s);
        expect(squareAt(seat, p.x, p.z)).toBe(s);
      }
    }
    expect(squareAt(0, 0, 3)).toBeNull();
    expect(squareAt(0, -2, -1)).toBeNull();
    // The lane of the other player is not on the track of this one.
    expect(squareAt(0, squareSpot(1, 2).x, squareSpot(1, 2).z)).toBeNull();
    expect(cellOf(0.4, -1.6)).toEqual({ x: 0, z: -2 });
  });
});

describe("the trays", () => {
  const arrangements: Arrangement[] = ["wide", "tall"];

  it("changes with the shape of the screen", () => {
    expect(arrangementFor(1.6)).toBe("wide");
    expect(arrangementFor(0.5)).toBe("tall");
  });

  it("holds the dice of a player in 12 slots of a grid", () => {
    for (const a of arrangements) {
      const size = traySize(a);
      expect(size.cols * size.rows).toBe(TRAY_SLOTS);
      const spots = Array.from({ length: TRAY_SLOTS }, (_, i) => traySpot(0, "reserve", i, a));
      expect(new Set(spots.map((p) => `${p.x}|${p.z}`)).size).toBe(TRAY_SLOTS);
    }
  });

  it("keeps the trays off the board and off each other", () => {
    for (const a of arrangements) {
      const size = traySize(a);
      const boxes = [0, 1].flatMap((seat) => (["reserve", "points"] as const).map((kind) => ({ seat, c: trayCentre(seat, kind, a) })));
      for (const { c } of boxes) {
        const outside = Math.abs(c.x) - size.width / 2 >= BOARD_HALF || Math.abs(c.z) - size.depth / 2 >= BOARD_HALF;
        expect(outside, `${a} ${JSON.stringify(c)}`).toBe(true);
      }
      boxes.forEach((p, i) =>
        boxes.slice(i + 1).forEach((q) => {
          const apart = Math.abs(p.c.x - q.c.x) >= size.width || Math.abs(p.c.z - q.c.z) >= size.depth;
          expect(apart, `${a}: ${JSON.stringify(p)} and ${JSON.stringify(q)}`).toBe(true);
        }),
      );
    }
  });

  it("mirrors the second seat through the centre", () => {
    for (const a of arrangements) {
      const c0 = trayCentre(0, "reserve", a);
      expect(trayCentre(1, "reserve", a)).toEqual(seatToTable(1, seatToTable(0, c0)));
      expect(trayCentre(1, "reserve", a).x).toBeCloseTo(-c0.x);
      expect(trayCentre(1, "reserve", a).z).toBeCloseTo(-c0.z);
    }
  });

  it("keeps every tray inside the points the camera frames", () => {
    for (const a of arrangements) {
      const points = extentPoints(a);
      const size = traySize(a);
      for (const seat of [0, 1]) {
        for (const kind of ["reserve", "points"] as const) {
          const c = trayCentre(seat, kind, a);
          expect(points.some((p) => Math.abs(p.x - (c.x + size.width / 2)) < 1e-9 || Math.abs(p.x - (c.x - size.width / 2)) < 1e-9)).toBe(true);
        }
      }
    }
  });
});

describe("the binary dice", () => {
  it("rest on the free rows of the side of the player who rolled, clear of the track", () => {
    for (const seat of [0, 1]) {
      const spots = [0, 1, 2, 3].map((i) => binarySpot(seat, i));
      expect(new Set(spots.map((p) => p.x)).size).toBe(4);
      for (const p of spots) expect(Math.abs(p.z)).toBeGreaterThan(2);
      expect(Math.sign(spots[0]!.z)).toBe(seat === 0 ? 1 : -1);
    }
  });

  it("show as many ones as the roll, the same every time for the same turn", () => {
    for (let turn = 1; turn < 30; turn++) {
      for (let roll = 0; roll <= 4; roll++) {
        const faces = binaryFaces(roll, turn);
        expect(faces.filter(Boolean).length).toBe(roll);
        expect(binaryFaces(roll, turn)).toEqual(faces);
      }
    }
    const arrangements = new Set(Array.from({ length: 40 }, (_, turn) => binaryFaces(2, turn).join()));
    expect(arrangements.size).toBeGreaterThan(3);
  });
});

describe("the frame", () => {
  it("fits the plate and the cells in the sketch", () => {
    const f = frameLayout();
    expect(f.plateAt + f.plate + f.plateAt).toBeCloseTo(f.sketch);
    expect(f.gridAt + 11 * f.cell).toBeLessThan(f.plateAt + f.plate);
    expect(f.worldSize).toBeCloseTo(f.sketch / f.cell);
  });
});
