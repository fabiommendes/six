import { Group, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { BOARD_THICKNESS, cellAtScreen, cellCenter } from "../src/board/geometry";
import { BoardCameras, FOV_DEGREES, TILT_DEGREES, turnExtent } from "../src/board/view";
import { cellName } from "../src/engine/cells";

/** Wide and compact frames (`worldSize` of `frameLayout`), and the canvases of the sketches: square, a tall phone, a wide window. */
const SIZES = [12.74, 13.0];
const ASPECTS = [1, 390 / 844, 1440 / 900];

function cameras(tilt: number, aspect: number, size: number): BoardCameras {
  const set = new BoardCameras();
  set.update(tilt, aspect, size, BOARD_THICKNESS);
  return set;
}

function corners(size: number): Vector3[] {
  const half = size / 2;
  return [-half, half].flatMap((x) => [0, -BOARD_THICKNESS].flatMap((y) => [-half, half].map((z) => new Vector3(x, y, z))));
}

describe("the cameras of the board", () => {
  it("looks from above with an orthographic camera and tilted with a perspective one", () => {
    expect(cameras(0, 1, 12.74).active.type).toBe("OrthographicCamera");
    for (const tilt of [0.01, 0.5, 1]) expect(cameras(tilt, 1, 12.74).active.type).toBe("PerspectiveCamera");
  });

  it("tilts less than 45 degrees, with a moderate field of view", () => {
    expect(TILT_DEGREES).toBeLessThan(45);
    expect(FOV_DEGREES).toBeGreaterThanOrEqual(30);
    expect(FOV_DEGREES).toBeLessThanOrEqual(40);
    const full = cameras(1, 1, 12.74).active as PerspectiveCamera;
    expect(full.fov).toBeCloseTo(FOV_DEGREES);
  });

  it("fits the whole board in the canvas at every tilt, in landscape and portrait, and does not waste the room", () => {
    for (const size of SIZES) {
      for (const aspect of ASPECTS) {
        for (const tilt of [0, 0.01, 0.3, 0.6, 1]) {
          const camera = cameras(tilt, aspect, size).active;
          const ndc = corners(size).map((corner) => corner.clone().project(camera));
          const reach = Math.max(...ndc.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]));
          expect(reach, `size ${size} aspect ${aspect} tilt ${tilt}`).toBeLessThanOrEqual(1 + 1e-9);
          expect(reach).toBeGreaterThan(0.9);
          if (tilt === 1) {
            const ys = ndc.map((p) => p.y);
            expect(Math.max(...ys) + Math.min(...ys), "centred").toBeCloseTo(0, 1);
          }
        }
      }
    }
  });

  it("keeps the back row on the canvas when tilted", () => {
    for (const aspect of ASPECTS) {
      const camera = cameras(1, aspect, 12.74).active;
      const back = cellCenter("f11");
      const ndc = new Vector3(back.x, 0, back.z - 0.5).project(camera);
      expect(ndc.y).toBeLessThan(1);
      expect(ndc.y).toBeGreaterThan(-1);
    }
  });
});

describe("picking a cell through the camera", () => {
  it("finds the cell under the centre of every cell, from above and tilted", () => {
    for (const size of SIZES) {
      for (const aspect of ASPECTS) {
        for (const tilt of [0, 0.4, 1]) {
          const camera = cameras(tilt, aspect, size).active;
          for (let col = 0; col < 11; col++) {
            for (let row = 1; row <= 11; row++) {
              const cell = cellName(col, row);
              const { x, z } = cellCenter(cell);
              const ndc = new Vector3(x, 0, z).project(camera);
              expect(cellAtScreen(camera, ndc.x, ndc.y), `${cell} size ${size} aspect ${aspect} tilt ${tilt}`).toBe(cell);
            }
          }
        }
      }
    }
  });

  it("finds the cell near its corners too, in perspective", () => {
    const camera = cameras(1, 1, 12.74).active;
    const { x, z } = cellCenter("c8");
    for (const [dx, dz] of [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]]) {
      const ndc = new Vector3(x + dx!, 0, z + dz!).project(camera);
      expect(cellAtScreen(camera, ndc.x, ndc.y)).toBe("c8");
    }
  });

  it("finds no cell off the board, nor on the side of the block", () => {
    const camera = cameras(1, 1, 12.74).active;
    expect(cellAtScreen(camera, 0, -1)).toBeNull();
    const front = new Vector3(0, -BOARD_THICKNESS / 2, 12.74 / 2).project(camera);
    expect(cellAtScreen(camera, front.x, front.y)).toBeNull();
  });
});

describe("the board seen from the Blacks (turned half a turn)", () => {
  /** A world turned `yaw` radians, as the board turns on the screen. */
  function turned(yaw: number): Group {
    const world = new Group();
    world.rotation.y = yaw;
    world.updateMatrixWorld(true);
    return world;
  }

  it("shows row 11 at the bottom and file k at the left, and picks the cell under every point", () => {
    const world = turned(Math.PI);
    for (const tilt of [0, 1]) {
      const camera = cameras(tilt, 1, 12.74).active;
      const screen = (cell: string) => world.localToWorld(new Vector3(cellCenter(cell as never).x, 0, cellCenter(cell as never).z)).project(camera);
      expect(screen("a11").y).toBeLessThan(screen("a1").y);
      expect(screen("k1").x).toBeLessThan(screen("a1").x);
      for (let col = 0; col < 11; col++) {
        for (let row = 1; row <= 11; row++) {
          const cell = cellName(col, row);
          const ndc = screen(cell);
          expect(cellAtScreen(camera, ndc.x, ndc.y, undefined, Math.PI), `${cell} tilt ${tilt}`).toBe(cell);
        }
      }
    }
  });

  it("would pick the opposite cell if the turn were ignored", () => {
    const camera = cameras(1, 1, 12.74).active;
    const world = turned(Math.PI);
    const ndc = world.localToWorld(new Vector3(cellCenter("c3").x, 0, cellCenter("c3").z)).project(camera);
    expect(cellAtScreen(camera, ndc.x, ndc.y)).toBe("i9");
  });

  it("picks right in the middle of the turn too", () => {
    const camera = cameras(1, 1, 12.74).active;
    for (const yaw of [0.3, Math.PI / 2, 2.2, 4]) {
      const world = turned(yaw);
      const ndc = world.localToWorld(new Vector3(cellCenter("d4").x, 0, cellCenter("d4").z)).project(camera);
      expect(cellAtScreen(camera, ndc.x, ndc.y, undefined, yaw)).toBe("d4");
    }
  });

  it("keeps the whole board in the canvas at every angle of the turn", () => {
    for (const aspect of ASPECTS) {
      for (let step = 0; step <= 20; step++) {
        const yaw = (Math.PI * step) / 20;
        const camera = cameras(1, aspect, 12.74 * turnExtent(yaw)).active;
        const world = turned(yaw);
        for (const corner of corners(12.74)) {
          const ndc = world.localToWorld(corner.clone()).project(camera);
          expect(Math.max(Math.abs(ndc.x), Math.abs(ndc.y)), `yaw ${yaw} aspect ${aspect}`).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  it("needs no extra room at a quarter turn and its multiples", () => {
    for (const yaw of [0, Math.PI / 2, Math.PI]) expect(turnExtent(yaw)).toBeCloseTo(1);
    expect(turnExtent(Math.PI / 4)).toBeCloseTo(Math.SQRT2);
  });
});
