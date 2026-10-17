import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

/** How far the tilted camera leans from the vertical. */
export const TILT_DEGREES = 38;
/** Vertical field of view of the tilted camera: moderate, so the perspective does not stretch the dice. */
export const FOV_DEGREES = 35;
/** Field of view at the start of the tilt: so narrow that the view is the one from above. */
const FLAT_FOV_DEGREES = 1;
/** How much of the canvas the tilted board leaves empty around it, at full tilt. */
const MARGIN = 0.03;
/** Distance of the camera that looks from above (it is orthographic, so it only has to clear the board). */
const TOP_DISTANCE = 30;
/** The depth around the board that the camera must render: the board, the dice and a die in flight. */
const DEPTH = 40;

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Where a perspective camera stands so that the whole board fits on the canvas. */
export interface Fit {
  /** From the centre of the board, along the line of sight. */
  readonly distance: number;
  /** How far the point the camera looks at is moved up the screen, so the board is centred. */
  readonly pan: number;
}

/**
 * The closest the camera can be, and the pan that centres the board, so that
 * the box of the board (`size` by `size` cells and `thickness` deep) fits in
 * the canvas. `tilt` is the angle of the line of sight to the vertical, in
 * radians; `fov` is vertical; `margin` is the share of the canvas to leave empty.
 */
export function fitBoard(tilt: number, fov: number, aspect: number, size: number, thickness: number, margin: number): Fit {
  const toCamera = new Vector3(0, Math.cos(tilt), Math.sin(tilt));
  const up = new Vector3(0, Math.sin(tilt), -Math.cos(tilt));
  const reachY = Math.tan(fov / 2) * (1 - margin);
  const reachX = reachY * aspect;
  const half = size / 2;
  const points: { near: number; b: number }[] = [];
  let distanceX = 0;
  // For a corner at `near` along the line of sight and `b` up the screen, the distance that
  // brings it to the top edge is `near + (b - pan) / reachY` and to the bottom edge `near + (pan - b) / reachY`.
  let top = -Infinity;
  let bottom = -Infinity;
  for (const x of [-half, half]) {
    for (const y of [0, -thickness]) {
      for (const z of [-half, half]) {
        const corner = new Vector3(x, y, z);
        const near = corner.dot(toCamera);
        const b = corner.dot(up);
        points.push({ near, b });
        distanceX = Math.max(distanceX, near + Math.abs(x) / reachX);
        top = Math.max(top, near + b / reachY);
        bottom = Math.max(bottom, near - b / reachY);
      }
    }
  }
  const distance = Math.max(distanceX, (top + bottom) / 2);
  // With the distance fixed, the pan that leaves as much canvas above the board as below it.
  const imbalance = (pan: number) => {
    const heights = points.map((p) => (p.b - pan) / (distance - p.near));
    return Math.max(...heights) + Math.min(...heights);
  };
  let low = -size;
  let high = size;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (imbalance(mid) > 0) low = mid;
    else high = mid;
  }
  return { distance, pan: (low + high) / 2 };
}

/**
 * The cameras of the board. From above it is orthographic, as the board is
 * drawn flat. Tilted, it is a perspective camera that starts with a narrow
 * field of view (so the change from above is seamless) and widens to
 * `FOV_DEGREES` while it leans to `TILT_DEGREES`. Both fit the whole board,
 * with its coordinates, in the canvas, whatever its proportions.
 */
export class BoardCameras {
  readonly top = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  readonly tilted = new PerspectiveCamera(FOV_DEGREES, 1, 0.1, 100);
  /** The camera to draw and pick with. */
  active: OrthographicCamera | PerspectiveCamera = this.top;

  /**
   * Places the cameras for a tilt from 0 (from above) to 1, a canvas of the
   * given `aspect` (width over height) and a board of `size` cells in a side
   * and `thickness` cells deep.
   */
  update(tilt: number, aspect: number, size: number, thickness: number): void {
    if (tilt <= 0) {
      this.placeTop(aspect, size);
      this.active = this.top;
    } else {
      this.placeTilted(tilt, aspect, size, thickness);
      this.active = this.tilted;
    }
    this.active.updateMatrixWorld();
  }

  private placeTop(aspect: number, size: number): void {
    const half = size / 2;
    const camera = this.top;
    // The board fits the narrower side of the canvas.
    const reachX = aspect >= 1 ? half * aspect : half;
    const reachY = aspect >= 1 ? half : half / aspect;
    camera.left = -reachX;
    camera.right = reachX;
    camera.top = reachY;
    camera.bottom = -reachY;
    camera.position.set(0, TOP_DISTANCE, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  private placeTilted(tilt: number, aspect: number, size: number, thickness: number): void {
    const camera = this.tilted;
    const angle = rad(TILT_DEGREES) * tilt;
    const fov = rad(FLAT_FOV_DEGREES + (FOV_DEGREES - FLAT_FOV_DEGREES) * tilt);
    const { distance, pan } = fitBoard(angle, fov, aspect, size, thickness, MARGIN * tilt);
    const toCamera = new Vector3(0, Math.cos(angle), Math.sin(angle));
    const up = new Vector3(0, Math.sin(angle), -Math.cos(angle));
    const target = up.clone().multiplyScalar(pan);
    camera.fov = (fov * 180) / Math.PI;
    camera.aspect = aspect;
    camera.near = Math.max(0.1, distance - DEPTH);
    camera.far = distance + DEPTH;
    camera.position.copy(target).addScaledVector(toCamera, distance);
    camera.up.copy(up);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
}
