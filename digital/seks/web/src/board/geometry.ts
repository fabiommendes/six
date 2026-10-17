import { Matrix4, Plane, Quaternion, Raycaster, Vector2, Vector3, type Camera } from "three";
import { BOARD_SIZE, cellName, parseCell, type Cell, type Coord } from "../engine/cells";

/** The board is laid out in cell units: a cell is 1 by 1, the origin is the centre of the board. */
export const DIE_SIZE = 0.78;

/** How thick the board is: half a die, about the width of the band of motif of the wide frame. */
export const BOARD_THICKNESS = DIE_SIZE / 2;

/** The centre of a cell on the plane of the board: `x` grows with the file, `z` toward the Whites (row 1). */
export function cellCenter(cell: Cell | Coord): { x: number; z: number } {
  const { col, row } = typeof cell === "string" ? parseCell(cell) : cell;
  return { x: col - (BOARD_SIZE - 1) / 2, z: (BOARD_SIZE + 1) / 2 - row };
}

/** The cell under a point of the plane of the board, or `null` outside the 11 by 11. */
export function cellAtPoint(x: number, z: number): Cell | null {
  const col = Math.floor(x + BOARD_SIZE / 2);
  const row = Math.floor((BOARD_SIZE + 1) / 2 - z + 0.5);
  if (col < 0 || col >= BOARD_SIZE || row < 1 || row > BOARD_SIZE) return null;
  return cellName(col, row);
}

const GROUND = new Plane(new Vector3(0, 1, 0), 0);

/** The cell on the board under a point of the canvas (`x`, `y` in -1..1, y up) seen by `camera`, ignoring the dice. */
export function cellAtScreen(camera: Camera, x: number, y: number, raycaster = new Raycaster()): Cell | null {
  raycaster.setFromCamera(new Vector2(x, y), camera);
  const point = raycaster.ray.intersectPlane(GROUND, new Vector3());
  return point ? cellAtPoint(point.x, point.z) : null;
}

/** One face of a die in the die's own axes: the normal, and where "right" and "up" of its pips point. */
interface Face {
  readonly value: number;
  readonly normal: Vector3;
  readonly right: Vector3;
  readonly up: Vector3;
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * The six faces of a die. Opposite faces add up to 7 (1 and 6, 2 and 5, 3
 * and 4). For each face `right x up = normal`, as seen from outside.
 */
export const FACES: readonly Face[] = [
  { value: 1, normal: v(0, 1, 0), right: v(1, 0, 0), up: v(0, 0, -1) },
  { value: 6, normal: v(0, -1, 0), right: v(1, 0, 0), up: v(0, 0, 1) },
  { value: 2, normal: v(1, 0, 0), right: v(0, 0, -1), up: v(0, 1, 0) },
  { value: 5, normal: v(-1, 0, 0), right: v(0, 0, 1), up: v(0, 1, 0) },
  { value: 3, normal: v(0, 0, 1), right: v(1, 0, 0), up: v(0, 1, 0) },
  { value: 4, normal: v(0, 0, -1), right: v(-1, 0, 0), up: v(0, 1, 0) },
];

/**
 * The orientation of a die that shows `value` on top with the pips upright
 * for a camera that looks down with north (row 11) at the top of the screen.
 */
export const ORIENTATION: Readonly<Record<number, Quaternion>> = Object.fromEntries(
  FACES.map((face) => {
    // Maps (right, normal, up) of the face to (east, up, north) of the world.
    const world = new Matrix4().makeBasis(v(1, 0, 0), v(0, 1, 0), v(0, 0, -1));
    const local = new Matrix4().makeBasis(face.right, face.normal, face.up).transpose();
    return [face.value, new Quaternion().setFromRotationMatrix(world.multiply(local))];
  }),
);

/** The orientation for `value`, from 1 to 6. */
export function orientation(value: number): Quaternion {
  const q = ORIENTATION[value];
  if (!q) throw new Error(`not a die value: ${value}`);
  return q;
}
