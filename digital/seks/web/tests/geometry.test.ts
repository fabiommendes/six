import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { FACES, cellAtPoint, cellCenter, orientation } from "../src/board/geometry";
import { cellName } from "../src/engine/cells";

const close = (a: Vector3, b: Vector3) => a.distanceTo(b) < 1e-9;

describe("cells on the plane of the board", () => {
  it("puts a1 at the front left and k11 at the back right, a cell per unit", () => {
    expect(cellCenter("a1")).toEqual({ x: -5, z: 5 });
    expect(cellCenter("k11")).toEqual({ x: 5, z: -5 });
    expect(cellCenter("f6")).toEqual({ x: 0, z: 0 });
  });

  it("finds back the cell from any point inside it", () => {
    for (let col = 0; col < 11; col++) {
      for (let row = 1; row <= 11; row++) {
        const cell = cellName(col, row);
        const { x, z } = cellCenter(cell);
        for (const [dx, dz] of [[0, 0], [0.49, 0.49], [-0.49, -0.49], [0.49, -0.49]]) {
          expect(cellAtPoint(x + dx!, z + dz!)).toBe(cell);
        }
      }
    }
  });

  it("returns null outside the board", () => {
    expect(cellAtPoint(5.6, 0)).toBeNull();
    expect(cellAtPoint(-5.6, 0)).toBeNull();
    expect(cellAtPoint(0, 5.6)).toBeNull();
    expect(cellAtPoint(0, -5.6)).toBeNull();
  });
});

describe("die orientation", () => {
  it("has the opposite faces add up to 7 and right x up = normal", () => {
    for (const face of FACES) {
      const opposite = FACES.find((other) => close(other.normal, face.normal.clone().negate()));
      expect(face.value + opposite!.value).toBe(7);
      expect(close(face.right.clone().cross(face.up), face.normal)).toBe(true);
    }
  });

  it("puts the face of the value on top, with its pips upright for the camera", () => {
    for (const face of FACES) {
      const q = orientation(face.value);
      expect(close(face.normal.clone().applyQuaternion(q), new Vector3(0, 1, 0))).toBe(true);
      expect(close(face.right.clone().applyQuaternion(q), new Vector3(1, 0, 0))).toBe(true);
      expect(close(face.up.clone().applyQuaternion(q), new Vector3(0, 0, -1))).toBe(true);
    }
  });

  it("refuses a value that is not on a die", () => {
    expect(() => orientation(0)).toThrow();
    expect(() => orientation(7)).toThrow();
  });
});
