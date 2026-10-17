import {
  CanvasTexture,
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  MeshBasicMaterial,
  type BufferGeometry,
  type Material,
  type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Cell } from "../engine/cells";
import type { Side } from "../engine/game";
import { drawDieFace, drawShadow, FACE_SHARE } from "./drawing";
import { cellCenter, DIE_SIZE, FACES, orientation } from "./geometry";

/** How much a selected die rises: the die lifts, grows a little and its shadow spreads. */
const LIFT = { height: 0.12, scale: 1.05, shift: { x: -0.025, z: -0.032 } } as const;

const SIDES: readonly Side[] = ["white", "black"];

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** What every die shares: geometry, materials and textures. Create once per board, dispose with it. */
export class DieAssets {
  readonly body: BufferGeometry = new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 3, 0.1);
  readonly face: BufferGeometry = new PlaneGeometry(DIE_SIZE * FACE_SHARE, DIE_SIZE * FACE_SHARE);
  readonly shadowPlane: BufferGeometry = new PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2);
  readonly bodyMaterial: Record<Side, Material> = {
    white: new MeshStandardMaterial({ color: "#E9E4D8", roughness: 0.55, metalness: 0 }),
    black: new MeshStandardMaterial({ color: "#26221F", roughness: 0.45, metalness: 0 }),
  };
  readonly faceMaterial = new Map<string, Material>();
  readonly shadowMaterial: { rest: Material; lifted: Material };
  private readonly textures: Texture[] = [];

  constructor() {
    for (const side of SIDES) {
      for (let value = 1; value <= 6; value++) {
        const map = texture(drawDieFace(side === "white", value, 256));
        this.textures.push(map);
        this.faceMaterial.set(`${side}${value}`, new MeshLambertMaterial({ map, transparent: true, polygonOffset: true, polygonOffsetFactor: -1 }));
      }
    }
    const rest = texture(drawShadow(128, 0.557, 8));
    const lifted = texture(drawShadow(128, 0.557, 16));
    this.textures.push(rest, lifted);
    const shadow = (map: Texture, opacity: number) => new MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false });
    this.shadowMaterial = { rest: shadow(rest, 0.36), lifted: shadow(lifted, 0.3) };
  }

  dispose(): void {
    this.body.dispose();
    this.face.dispose();
    this.shadowPlane.dispose();
    for (const material of [...Object.values(this.bodyMaterial), ...this.faceMaterial.values(), this.shadowMaterial.rest, this.shadowMaterial.lifted]) material.dispose();
    for (const t of this.textures) t.dispose();
  }
}

/** A die on the board: a rounded body with a face of pips on each side, and its shadow on the board. */
export class Die3D {
  /** On the plane of the board: moves the die and its shadow. */
  readonly root = new Object3D();
  /** Holds the body and the faces: what lifts, hops and rotates. */
  readonly tumbler = new Group();
  readonly body: Mesh;
  private readonly shadow: Mesh;
  private lifted = false;
  value: number;

  constructor(
    readonly side: Side,
    value: number,
    cell: Cell,
    private readonly assets: DieAssets,
  ) {
    this.value = value;
    this.body = new Mesh(assets.body, assets.bodyMaterial[side]);
    this.body.userData.die = this;
    this.tumbler.add(this.body);
    for (const face of FACES) {
      const mesh = new Mesh(assets.face, assets.faceMaterial.get(`${side}${face.value}`)!);
      mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(face.right, face.up, face.normal));
      mesh.position.copy(face.normal).multiplyScalar(DIE_SIZE / 2 + 0.002);
      this.tumbler.add(mesh);
    }
    this.shadow = new Mesh(assets.shadowPlane, assets.shadowMaterial.rest);
    this.shadow.position.y = 0.002;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow, this.tumbler);
    this.cell = cell;
    this.rest();
    this.setValue(value);
  }

  private currentCell: Cell = "a1";

  get cell(): Cell {
    return this.currentCell;
  }

  set cell(cell: Cell) {
    this.currentCell = cell;
    const { x, z } = cellCenter(cell);
    this.root.position.set(x, 0, z);
  }

  setValue(value: number): void {
    this.value = value;
    this.tumbler.quaternion.copy(orientation(value));
  }

  /** The orientation that shows `value` on top. */
  static orientation(value: number): Quaternion {
    return orientation(value);
  }

  /** Lifts the die (selected) or puts it back. */
  setLifted(lifted: boolean): void {
    this.lifted = lifted;
    this.rest();
  }

  /** Puts the tumbler back at rest, lifted or not, with `hop` extra height and scale (an animation). */
  rest(hop = 0): void {
    const lift = this.lifted ? 1 : 0;
    const scale = 1 + (LIFT.scale - 1) * lift + 0.08 * hop;
    this.tumbler.position.set(LIFT.shift.x * lift, DIE_SIZE / 2 + LIFT.height * lift + 0.45 * hop, LIFT.shift.z * lift);
    this.tumbler.scale.setScalar(scale);
    this.shadow.material = this.lifted ? this.assets.shadowMaterial.lifted : this.assets.shadowMaterial.rest;
    const off = this.lifted ? 0.12 : 0.05;
    this.shadow.position.set(off * 0.6 * DIE_SIZE + 0.02, 0.002, off * DIE_SIZE + 0.03);
    this.shadow.scale.setScalar(1 + 0.12 * lift - 0.1 * hop);
  }
}
