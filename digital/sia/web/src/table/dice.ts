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
import { STONE_SUIT, SUIT_COLORS } from "../ui/svg";
import { drawDieFace, FACE_SHARE, OUT_COLOR, shade } from "./drawing";
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

/** The suit of a die: 0 to 3 for the bag, `STONE_SUIT` for the stones. */
export type DieColor = number;

const key = (suit: DieColor, value: number) => `${suit}:${value}`;

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
  private readonly grayMaps = new Map<string, Texture>();

  bodyMaterial(color: DieColor, ghost = false): Material {
    const id = `${color}${ghost ? "g" : ""}`;
    let found = this.bodies.get(id);
    if (!found) {
      const hex = shade(SUIT_COLORS[color] ?? SUIT_COLORS[STONE_SUIT], -0.08);
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

  /** Steps of the grey that fades over a die going out of the game. */
  static readonly FADE_STEPS = 10;

  /** The grey body that fades over a die, `level` of `FADE_STEPS` (1 to FADE_STEPS) opaque. */
  fadeBodyMaterial(level: number): Material {
    const id = `out-body${level}`;
    let found = this.bodies.get(id);
    if (!found) {
      found = new MeshStandardMaterial({ color: shade(OUT_COLOR, -0.08), roughness: 0.5, transparent: true, opacity: level / DieAssets.FADE_STEPS, depthWrite: false });
      this.bodies.set(id, found);
    }
    return found;
  }

  /** The grey face of `value` that fades over a die, with dark pips. */
  fadeFaceMaterial(value: number, level: number): Material {
    const id = `out-face${value}:${level}`;
    let found = this.faces.get(id);
    if (!found) {
      found = new MeshStandardMaterial({
        map: this.grayMap(value),
        roughness: 0.55,
        transparent: true,
        opacity: level / DieAssets.FADE_STEPS,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      this.faces.set(id, found);
    }
    return found;
  }

  private grayMap(value: number): Texture {
    const id = `out-map${value}`;
    let found = this.grayMaps.get(id);
    if (!found) {
      found = texture(drawDieFace(value, STONE_SUIT, 128, true));
      this.grayMaps.set(id, found);
      this.textures.push(found);
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
    private readonly assets: DieAssets,
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

  private shell: { readonly body: Mesh; readonly faces: Mesh[]; level: number } | null = null;

  /**
   * How far the die has gone out of the game, 0 (its colors) to 1 (grey, the
   * pips still readable). A grey shell fades in over the colored die.
   */
  setOut(amount: number): void {
    const steps = DieAssets.FADE_STEPS;
    const level = Math.round(Math.min(1, Math.max(0, amount)) * steps);
    let shell = this.shell;
    if (level === (shell?.level ?? 0)) return;
    if (!shell) {
      const body = new Mesh(this.assets.body, this.assets.fadeBodyMaterial(1));
      body.scale.setScalar(1.0125);
      const faces = FACES.map((face) => {
        const mesh = new Mesh(this.assets.face, this.assets.fadeFaceMaterial(face.value, 1));
        mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(face.right, face.up, face.normal));
        mesh.position.copy(face.normal).multiplyScalar(DIE_SIZE / 2 + 0.0065);
        return mesh;
      });
      this.tumbler.add(body, ...faces);
      shell = { body, faces, level: 0 };
      this.shell = shell;
    }
    shell.level = level;
    shell.body.visible = level > 0;
    for (const mesh of shell.faces) mesh.visible = level > 0;
    if (level > 0) {
      shell.body.material = this.assets.fadeBodyMaterial(level);
      FACES.forEach((face, i) => (shell.faces[i]!.material = this.assets.fadeFaceMaterial(face.value, level)));
    }
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
