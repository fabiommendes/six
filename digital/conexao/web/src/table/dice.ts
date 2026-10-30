import {
  CanvasTexture,
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { dieBody } from "../ui/svg";
import { drawDieFace, FACE_SHARE, shade } from "./drawing";
import { DIE_SIZE } from "./layout";

/** One face of a die in the die's own axes: the normal, and where "right" and "up" of its pips point. */
interface Face {
  readonly value: number;
  readonly normal: Vector3;
  readonly right: Vector3;
  readonly up: Vector3;
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** The six faces of a die. Opposite faces add up to 7; for each face `right x up = normal`. */
const FACES: readonly Face[] = [
  { value: 1, normal: v(0, 1, 0), right: v(1, 0, 0), up: v(0, 0, -1) },
  { value: 6, normal: v(0, -1, 0), right: v(1, 0, 0), up: v(0, 0, 1) },
  { value: 2, normal: v(1, 0, 0), right: v(0, 0, -1), up: v(0, 1, 0) },
  { value: 5, normal: v(-1, 0, 0), right: v(0, 0, 1), up: v(0, 1, 0) },
  { value: 3, normal: v(0, 0, 1), right: v(1, 0, 0), up: v(0, 1, 0) },
  { value: 4, normal: v(0, 0, -1), right: v(-1, 0, 0), up: v(0, 1, 0) },
];

/** The orientation that shows `value` on top, upright for someone sitting at `+z`. */
const UPRIGHT: Readonly<Record<number, Quaternion>> = Object.fromEntries(
  FACES.map((face) => {
    const world = new Matrix4().makeBasis(v(1, 0, 0), v(0, 1, 0), v(0, 0, -1));
    const local = new Matrix4().makeBasis(face.right, face.normal, face.up).transpose();
    return [face.value, new Quaternion().setFromRotationMatrix(world.multiply(local))];
  }),
);

const Y = new Vector3(0, 1, 0);

/** The orientation that shows `value` on top, upright for someone looking from `yaw` radians about the vertical. */
export function orientation(value: number, yaw = 0): Quaternion {
  const q = UPRIGHT[value];
  if (!q) throw new Error(`not a die value: ${value}`);
  return new Quaternion().setFromAxisAngle(Y, yaw).multiply(q);
}

/** What a die belongs to: seat 0 (white) or 1 (black). */
export type DieColor = number;

const key = (color: DieColor, value: number) => `${color}:${value}`;

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** What every die shares: geometry, materials and textures. One per table. */
export class DieAssets {
  readonly body: BufferGeometry = new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 3, 0.1);
  readonly face: BufferGeometry = new PlaneGeometry(DIE_SIZE * FACE_SHARE, DIE_SIZE * FACE_SHARE);
  private readonly bodies = new Map<string, Material>();
  private readonly faces = new Map<string, Material>();
  private readonly textures: Texture[] = [];

  bodyMaterial(color: DieColor, ghost = false): Material {
    const id = `${color}${ghost ? "g" : ""}`;
    let found = this.bodies.get(id);
    if (!found) {
      const hex = shade(dieBody(color), color === 0 ? 0.1 : -0.05);
      found = new MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0, transparent: ghost, opacity: ghost ? 0.7 : 1, depthWrite: !ghost });
      this.bodies.set(id, found);
    }
    return found;
  }

  faceMaterial(color: DieColor, value: number, ghost = false): Material {
    const id = key(color, value) + (ghost ? "g" : "");
    let found = this.faces.get(id);
    if (!found) {
      const map = texture(drawDieFace(value, color, 128));
      this.textures.push(map);
      found = new MeshStandardMaterial({ map, roughness: 0.55, transparent: true, opacity: ghost ? 0.75 : 1, depthWrite: !ghost, polygonOffset: true, polygonOffsetFactor: -1 });
      this.faces.set(id, found);
    }
    return found;
  }

  dispose(): void {
    this.body.dispose();
    this.face.dispose();
    for (const m of [...this.bodies.values(), ...this.faces.values()]) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}

/** A die: a rounded body with a face of pips on each side. `root` moves it, `tumbler` turns it. */
export class Die3D {
  readonly root = new Group();
  readonly tumbler = new Group();
  readonly body: Mesh;

  constructor(
    readonly color: DieColor,
    public value: number,
    assets: DieAssets,
    ghost = false,
  ) {
    this.body = new Mesh(assets.body, assets.bodyMaterial(color, ghost));
    this.body.castShadow = !ghost;
    this.body.userData.die = this;
    this.tumbler.add(this.body);
    for (const face of FACES) {
      const mesh = new Mesh(assets.face, assets.faceMaterial(color, face.value, ghost));
      mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(face.right, face.up, face.normal));
      mesh.position.copy(face.normal).multiplyScalar(DIE_SIZE / 2 + 0.002);
      this.tumbler.add(mesh);
    }
    this.tumbler.position.y = DIE_SIZE / 2;
    this.root.add(this.tumbler);
  }

  /** Shows `value` on top, upright for `yaw`. */
  show(value: number, yaw = 0): void {
    this.value = value;
    this.tumbler.quaternion.copy(orientation(value, yaw));
  }

  /** How high the die floats above its place (a selected die lifts). */
  set lift(height: number) {
    this.tumbler.position.y = DIE_SIZE / 2 + height;
  }
}
