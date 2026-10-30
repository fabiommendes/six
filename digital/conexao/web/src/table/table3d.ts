import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from "three";
import type { Move, Transition, View } from "../engine/game";
import { reserveValueOf, squaresOf } from "../logic/selection";
import { COLORS, seatColor } from "../ui/svg";
import { Die3D, DieAssets, orientation } from "./dice";
import { drawBoard, drawLabel, drawMark, drawTrayTop, drawWood, shade, type BoardMarks, type MarkKind } from "./drawing";
import {
  type Arrangement,
  arrangementFor,
  BOARD_HALF,
  DIE_SIZE,
  extentPoints,
  frameLayout,
  seatAngle,
  squareAt,
  squareSpot,
  TRAY_SLOTS,
  trayCentre,
  traySize,
  traySpot,
  type TrayKind,
} from "./layout";
import { easeInOut, easeOut, tween, wait } from "./motion";
import type { Sounds } from "./sound";

/** The squares of the last move: where the die went (or the die increased), the die increased with a block, and the die taken from the board. */
export interface LastMove {
  readonly seat: number;
  readonly to: number;
  readonly raise: number | null;
  readonly from: number | null;
}

/** What the table marks, besides the dice: the turn, where a tap plays, the choices and the last move. */
export interface TableMarks {
  /** The seat to move, lit on the table; null once the game is over. */
  readonly active: number | null;
  /** Empty squares where a tap places a die: rings. */
  readonly places: readonly number[];
  /** Empty squares where a blocking die can go: diamonds. */
  readonly blocks: readonly number[];
  /** Dice to choose from (the die to increase with a block, the die taken from the board): brackets. */
  readonly choices: readonly number[];
  /** The die and the square chosen so far: thick squares. */
  readonly selected: readonly number[];
  readonly last: LastMove | null;
}

export const NO_MARKS: TableMarks = { active: null, places: [], blocks: [], choices: [], selected: [], last: null };

/** Room the page covers over the canvas, in CSS pixels: the table is framed in what is left. */
export interface Insets {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface TableOptions {
  readonly names: readonly string[];
  /** The size of the game and its rows of the block, drawn on the board. */
  readonly board: BoardMarks;
  readonly sounds: Sounds;
  reducedMotion(): boolean;
  /** The parts of the canvas under the panels of the page. */
  insets(): Insets;
  /** A tap on a square of the game (`null` off the board). */
  onPick(square: number | null): void;
  /** Whether a tap on the square does something: the pointer cursor shows over it. */
  canPick(square: number): boolean;
}

const BOARD_Y = 0.05;
const TRAY_Y = 0.045;
const MARK_Y = 0.075;
/** The values of the reserve dice of `seat`, highest first. */
function reserveDice(view: View, seat: number): number[] {
  return view.reserve[seat]!.flatMap((n, value) => Array.from({ length: n }, () => value)).reverse();
}

/** The camera leans at a fixed angle from the vertical; only the zoom and the seat change the view. */
const PITCH = 0.6;
const ZOOM = { min: 0.42, max: 1.18 } as const;
const UP = new Vector3(0, 1, 0);
const GROUND = new Plane(new Vector3(0, 1, 0), 0);
/** Squares of the engine grid. */
const CELLS = 121;

function canvasTexture(canvas: HTMLCanvasElement, mipmaps = true): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = mipmaps ? LinearMipmapLinearFilter : LinearFilter;
  t.generateMipmaps = mipmaps;
  return t;
}

interface Floater {
  readonly sprite: Sprite;
  readonly texture: Texture;
}

interface Tray {
  readonly glow: Mesh;
  readonly mesh: Mesh;
  readonly label: Sprite;
  labelKey: string;
  trayKey: string;
}

type Point3 = { x: number; y: number; z: number };

const TRAYS: readonly TrayKind[] = ["reserve", "captured"];

/** The kinds of marks that come in pools, one mesh per marked square. */
type PoolKind = "ring" | "block" | "claim" | "selected" | "last";

/**
 * The table in 3D: the board of the Seks with the dice of both players on
 * it, and for each player a tray with the reserve and a tray with the dice of
 * their color that were captured. It shows a `View` at once, or plays a move
 * as an animation, and reports the taps on the board.
 */
export class Table3D {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, 0.5, 200);
  private readonly world = new Group();
  private readonly assets = new DieAssets();
  private readonly raycaster = new Raycaster();
  /** `trays[seat][kind]`. */
  private readonly trays: Record<TrayKind, Tray>[] = [];
  private readonly textures: Texture[] = [];
  private readonly materials: Material[] = [];
  private readonly geometries: { dispose(): void }[] = [];
  private readonly markGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly markMaterials = new Map<string, MeshBasicMaterial>();
  private readonly floaters = new Set<Floater>();
  private readonly pools: Record<PoolKind, Mesh[]> = { ring: [], block: [], claim: [], selected: [], last: [] };
  private readonly originMark: Mesh;

  // What the table shows.
  /** The dice on the board, by square of the engine. */
  private board: (Die3D | null)[] = Array.from({ length: CELLS }, () => null);
  private reserve: Die3D[][] = [[], []];
  /** The dice of each color out of the game. */
  private captured: Die3D[][] = [[], []];
  private view: View | null = null;
  private marks: TableMarks = NO_MARKS;
  private arrangement: Arrangement = "wide";

  // The camera: where it looks from, smoothed towards its targets.
  private viewer = 0;
  private yaw = 0;
  private yawGoal = 0;
  private zoom = 1;
  private zoomGoal = 1;
  private cameraKey = "";

  private dirty = true;
  private running = 0;
  private loop = 0;
  private lastFrame = 0;
  private readonly observer: ResizeObserver;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private press: { x: number; y: number; moved: boolean } | null = null;
  private pinch: { distance: number; zoom: number } | null = null;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: TableOptions,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: import.meta.env.DEV });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.classList.add("table-canvas");
    container.append(this.canvas);

    this.scene.add(this.world);
    this.scene.add(new HemisphereLight(0xfff4e0, 0x3a2a1c, 1.25));
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xfff1dc, 2.1);
    sun.position.set(-6, 18, 9);
    sun.castShadow = true;
    const reach = 15;
    sun.shadow.camera.left = -reach;
    sun.shadow.camera.right = reach;
    sun.shadow.camera.top = reach;
    sun.shadow.camera.bottom = -reach;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    this.scene.add(sun);

    this.originMark = this.newMark("origin", seatColor(0));

    this.buildTable();
    this.buildBoard();
    for (let i = 0; i < 2; i++) this.trays.push(this.buildTrays(i));
    this.applyArrangement(this.arrangement);

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("dblclick", this.onDoubleClick);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.loop = requestAnimationFrame(this.frame);
    // The labels are drawn with the fonts of the page: draw them again once they are in.
    void document.fonts?.ready.then(() => {
      for (const seat of this.trays) for (const tray of Object.values(seat)) tray.labelKey = "";
      if (this.view) this.updateLabels(this.view);
      this.dirty = true;
    });
  }

  private get size(): number {
    return this.options.board.size;
  }

  // --- Building --------------------------------------------------------------

  private texture(canvas: HTMLCanvasElement, mipmaps = true): CanvasTexture {
    const t = canvasTexture(canvas, mipmaps);
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures.push(t);
    return t;
  }

  private material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  private buildTable(): void {
    const side = 60;
    const wood = this.texture(drawWood(1024));
    wood.wrapS = wood.wrapT = RepeatWrapping;
    wood.repeat.set(3, 3);
    const top = this.material(new MeshStandardMaterial({ map: wood, roughness: 0.62, metalness: 0 }));
    const edge = this.material(new MeshStandardMaterial({ color: "#3E2819", roughness: 0.7 }));
    const geometry = new BoxGeometry(side, 0.8, side);
    this.geometries.push(geometry);
    const table = new Mesh(geometry, [edge, edge, top, edge, edge, edge]);
    table.position.y = -0.4;
    table.receiveShadow = true;
    this.world.add(table);
  }

  /** The board of the Seks: a slab with the frame, the grid, the back rows and the rows of the block on top. */
  private buildBoard(): void {
    const layout = frameLayout();
    const map = this.texture(drawBoard(2048, layout, this.options.board));
    const top = this.material(new MeshLambertMaterial({ map }));
    const edge = this.material(new MeshStandardMaterial({ color: "#2B2A27", roughness: 0.6 }));
    const geometry = new BoxGeometry(layout.worldSize, 0.2, layout.worldSize);
    this.geometries.push(geometry);
    const slab = new Mesh(geometry, [edge, edge, top, edge, edge, edge]);
    slab.position.y = BOARD_Y - 0.1;
    slab.receiveShadow = true;
    slab.castShadow = true;
    this.world.add(slab);
  }

  private buildTrays(index: number): Record<TrayKind, Tray> {
    const color = seatColor(index);
    const make = (): Tray => {
      const glowGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      this.geometries.push(glowGeometry);
      const glow = new Mesh(glowGeometry, this.material(new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false })));
      glow.position.y = 0.012;
      this.world.add(glow);
      const trayGeometry = new BoxGeometry(1, 0.06, 1);
      this.geometries.push(trayGeometry);
      const felt = this.material(new MeshStandardMaterial({ color: shade(color, -0.3), roughness: 0.9 }));
      const mesh = new Mesh(trayGeometry, [felt, felt, felt, felt, felt, felt]);
      mesh.receiveShadow = true;
      this.world.add(mesh);
      return { glow, mesh, label: this.newLabelSprite(), labelKey: "", trayKey: "" };
    };
    return { reserve: make(), captured: make() };
  }

  private newLabelSprite(): Sprite {
    const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false }));
    sprite.renderOrder = 10;
    this.world.add(sprite);
    return sprite;
  }

  private setLabel(sprite: Sprite, text: string, height: number, options: { background?: string; color?: string } = {}): void {
    const canvas = drawLabel(text, { px: 52, background: options.background ?? "rgba(251,248,241,0.94)", color: options.color ?? COLORS.ink });
    const material = sprite.material;
    material.map?.dispose();
    material.map = canvasTexture(canvas, false);
    material.needsUpdate = true;
    sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
    this.dirty = true;
  }

  private markMaterial(kind: MarkKind, accent: string): MeshBasicMaterial {
    const key = `${kind}:${accent}`;
    let found = this.markMaterials.get(key);
    if (!found) {
      found = new MeshBasicMaterial({ map: this.texture(drawMark(kind, 128, accent)), transparent: true, depthWrite: false });
      this.markMaterials.set(key, found);
    }
    return found;
  }

  private newMark(kind: MarkKind, accent: string = COLORS.accent): Mesh {
    const mesh = new Mesh(this.markGeometry, this.markMaterial(kind, accent));
    mesh.renderOrder = 2;
    mesh.visible = false;
    this.world.add(mesh);
    return mesh;
  }

  /** Puts everything that depends on the arrangement where it belongs. */
  private applyArrangement(arrangement: Arrangement): void {
    this.arrangement = arrangement;
    this.trays.forEach((seatTrays, seat) => {
      for (const kind of TRAYS) {
        const size = traySize(kind, arrangement);
        const tray = seatTrays[kind];
        const c = trayCentre(seat, kind, arrangement);
        tray.mesh.scale.set(size.width, 1, size.depth);
        tray.mesh.position.set(c.x, TRAY_Y - 0.03, c.z);
        tray.glow.scale.set(size.width + 0.7, 1, size.depth + 0.7);
        tray.glow.position.set(c.x, 0.012, c.z);
        // The felt takes a texture drawn for the proportions of the tray.
        const key = `${arrangement}:${kind}`;
        if (tray.trayKey !== key) {
          tray.trayKey = key;
          const accent = kind === "reserve" ? seatColor(seat) : shade(seatColor(seat), -0.3);
          const map = this.texture(drawTrayTop(Math.round(size.width * 96), Math.round(size.depth * 96), accent));
          const felt = this.material(new MeshLambertMaterial({ map }));
          const edge = this.material(new MeshStandardMaterial({ color: shade(seatColor(seat), -0.55), roughness: 0.8 }));
          tray.mesh.material = [edge, edge, felt, edge, edge, edge];
        }
        // The label sits between the trays when they are beside the board, and on the edge near the seat when they are below it.
        const outward = seat === 0 ? 1 : -1;
        const side = arrangement === "wide" ? -1 : 1;
        tray.label.position.set(c.x, 0.4, c.z + side * outward * (size.depth / 2 + 0.45));
      }
    });
    this.cameraKey = "";
    // The dice of the trays move to the spots of the new arrangement, wherever the animations left them.
    for (let seat = 0; seat < 2; seat++) {
      this.reserve[seat]!.forEach((die, i) => this.put(die, this.trayPoint(seat, "reserve", i)));
      this.captured[seat]!.forEach((die, i) => this.put(die, this.trayPoint(seat, "captured", i)));
    }
    this.dirty = true;
  }

  private put(die: Die3D, at: Point3): void {
    die.root.position.set(at.x, at.y, at.z);
  }

  // --- What the screen tells -------------------------------------------------

  /** Shows `view` at once, without animation: after an undo and after each animation. */
  show(view: View, marks: TableMarks): void {
    this.view = view;
    this.clearDice();
    view.cells.forEach((die, square) => {
      if (die) this.board[square] = this.newDie(die.owner, die.value, this.squarePoint(square));
    });
    for (const seat of [0, 1]) {
      // The reserve dice lie in the tray from the highest value to the lowest.
      this.reserve[seat] = reserveDice(view, seat).map((value, i) => this.newDie(seat, value, this.trayPoint(seat, "reserve", i)));
      this.captured[seat] = Array.from({ length: view.captured[seat]! }, (_, i) => this.newDie(seat, 4, this.trayPoint(seat, "captured", i)));
    }
    this.updateLabels(view);
    this.setMarks(marks, view);
    this.dirty = true;
  }

  private clearDice(): void {
    const all = [...this.board, ...this.reserve.flat(), ...this.captured.flat()];
    for (const die of all) if (die) this.world.remove(die.root);
    this.board = Array.from({ length: CELLS }, () => null);
    this.reserve = [[], []];
    this.captured = [[], []];
  }

  private newDie(color: number, value: number, at: Point3, yaw = seatAngle(color)): Die3D {
    const die = new Die3D(color, value, this.assets);
    this.put(die, at);
    die.show(value, yaw);
    this.world.add(die.root);
    return die;
  }

  private squarePoint(square: number): Point3 {
    const p = squareSpot(square, this.size);
    return { x: p.x, y: BOARD_Y, z: p.z };
  }

  private trayPoint(seat: number, kind: TrayKind, slot: number): Point3 {
    const p = traySpot(seat, kind, Math.min(slot, TRAY_SLOTS[kind] - 1), this.arrangement);
    return { x: p.x, y: TRAY_Y, z: p.z };
  }

  private updateLabels(view: View): void {
    this.trays.forEach((seatTrays, seat) => {
      const active = view.end === null && view.toMove === seat;
      const won = view.winner === seat;
      const texts: Record<TrayKind, string> = {
        reserve: `${this.options.names[seat] ?? ""} · reserva ${view.reserve[seat]!.reduce((a, b) => a + b, 0)}${won ? " · venceu" : ""}`,
        captured: `Capturados · ${view.captured[seat]}`,
      };
      for (const kind of TRAYS) {
        const tray = seatTrays[kind];
        const highlight = kind === "reserve" && (active || won);
        const key = `${texts[kind]}|${highlight}`;
        if (key === tray.labelKey) continue;
        tray.labelKey = key;
        const options = highlight ? (seat === 0 ? { background: seatColor(0), color: COLORS.ink } : { background: COLORS.ink, color: COLORS.wool }) : {};
        this.setLabel(tray.label, texts[kind], kind === "reserve" ? 0.72 : 0.55, options);
      }
    });
    this.dirty = true;
  }

  /** The height of the top face of the die on `square`, or of the board when it is empty: marks lie there, to be seen over the die. */
  private markY(square: number): number {
    const die = this.board[square];
    return die ? die.root.position.y + die.tumbler.position.y + DIE_SIZE / 2 + 0.03 : MARK_Y;
  }

  /** Shows one mark of `kind` on each of `squares`, from its pool. */
  private placePool(kind: PoolKind, squares: readonly number[], accent: string, size: number, lift = 0): void {
    const pool = this.pools[kind];
    while (pool.length < squares.length) pool.push(this.newMark(kind));
    pool.forEach((mesh, i) => {
      const square = squares[i];
      if (square === undefined) {
        mesh.visible = false;
        return;
      }
      mesh.material = this.markMaterial(kind, accent);
      this.placeMark(mesh, squareSpot(square, this.size), size, this.markY(square) + lift);
    });
  }

  setMarks(marks: TableMarks, view: View | null = this.view): void {
    this.marks = marks;
    if (view) this.view = view;
    for (const die of this.board) if (die) die.lift = 0;
    for (const square of marks.selected) {
      const die = this.board[square];
      if (die) die.lift = 0.3;
    }
    this.placePool("ring", marks.places, COLORS.accent, 0.95);
    this.placePool("block", marks.blocks, COLORS.accent, 0.95);
    this.placePool("claim", marks.choices, COLORS.accent, 1.08, 0.01);
    this.placePool("selected", marks.selected, COLORS.ink, 1.12);
    const last = marks.last;
    const lastSquares = last ? [last.to, ...(last.raise !== null ? [last.raise] : [])] : [];
    const lastColor = last ? (last.seat === 0 ? "#8C7A55" : COLORS.ink) : COLORS.ink;
    this.placePool("last", lastSquares, lastColor, 1);
    if (last && last.from !== null) {
      this.originMark.material = this.markMaterial("origin", lastColor);
      this.placeMark(this.originMark, squareSpot(last.from, this.size), 1, MARK_Y - 0.01);
    } else this.originMark.visible = false;
    this.dirty = true;
  }

  private placeMark(mesh: Mesh, at: { x: number; z: number }, size: number, y = MARK_Y): void {
    mesh.visible = true;
    mesh.position.set(at.x, y, at.z);
    mesh.rotation.y = 0;
    mesh.scale.set(size, 1, size);
  }

  /** Looks at the table from the seat of `seat`, turning there unless `instant`. */
  setViewer(seat: number, instant = false): void {
    if (seat === this.viewer && !instant) return;
    this.viewer = seat;
    const goal = seat === 0 ? 0 : Math.PI;
    let delta = goal - this.yawGoal;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.yawGoal += delta;
    this.zoomGoal = Math.min(this.zoomGoal, 1);
    if (instant || this.options.reducedMotion()) {
      this.yaw = this.yawGoal;
      this.zoom = this.zoomGoal;
    }
    this.dirty = true;
  }

  /** Back to the view from the seat, at the usual distance. */
  resetView(): void {
    const home = this.viewer === 0 ? 0 : Math.PI;
    this.yawGoal = home + Math.round((this.yawGoal - home) / (2 * Math.PI)) * 2 * Math.PI;
    this.zoomGoal = 1;
    this.dirty = true;
  }

  /** Closer to the board (below 1) or back to the whole table. */
  zoomBy(factor: number): void {
    this.zoomGoal = Math.min(ZOOM.max, Math.max(ZOOM.min, this.zoomGoal * factor));
    this.dirty = true;
  }

  // --- Animations ------------------------------------------------------------

  /** Runs a tween and keeps the table drawing while it runs. */
  private async run(duration: number, step: (t: number) => void): Promise<void> {
    this.running++;
    try {
      await tween(duration, step);
    } finally {
      this.running--;
      this.dirty = true;
    }
  }

  private get motion(): boolean {
    return !this.options.reducedMotion();
  }

  /** How long an animation of `ms` lasts: nothing when motion is off. */
  private ms(ms: number): number {
    return this.motion ? ms : 0;
  }

  private async pause(ms: number): Promise<void> {
    if (this.motion) await wait(ms);
  }

  /** A die flies from where it is to `to` in an arc, turning to `end`. With `tumble` it spins on the way. */
  private async fly(die: Die3D, to: Point3, end: Quaternion, options: { duration: number; height: number; tumble?: number }): Promise<void> {
    const from = die.root.position.clone();
    const start = die.tumbler.quaternion.clone();
    const axis = new Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
    const spin = (options.tumble ?? 0) * Math.PI * 2;
    const turn = new Quaternion();
    await this.run(this.ms(options.duration), (t) => {
      const e = easeInOut(t);
      die.root.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e + options.height * Math.sin(Math.PI * t), from.z + (to.z - from.z) * e);
      die.tumbler.quaternion.slerpQuaternions(start, end, easeOut(t));
      if (spin) die.tumbler.quaternion.premultiply(turn.setFromAxisAngle(axis, spin * (1 - easeOut(t))));
    });
    die.root.position.set(to.x, to.y, to.z);
    die.tumbler.quaternion.copy(end);
  }

  /** A die lands: a little bounce and a knock. */
  private async land(die: Die3D, strength = 1): Promise<void> {
    this.options.sounds.play("land", strength);
    const y = die.root.position.y;
    await this.run(this.ms(150), (t) => {
      die.root.position.y = y + 0.07 * strength * Math.sin(Math.PI * t);
    });
    die.root.position.y = y;
  }

  /** A text that rises over a point of the table and fades. */
  private float(text: string, at: { x: number; z: number }, options: { color?: string; background?: string; height?: number; duration?: number } = {}): void {
    const canvas = drawLabel(text, { px: 56, color: options.color ?? "#FFFFFF", background: options.background ?? COLORS.accent });
    const texture = canvasTexture(canvas, false);
    const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.renderOrder = 20;
    const h = 0.85;
    sprite.scale.set((h * canvas.width) / canvas.height, h, 1);
    const y0 = options.height ?? 1.2;
    sprite.position.set(at.x, y0, at.z);
    this.world.add(sprite);
    const floater = { sprite, texture };
    this.floaters.add(floater);
    void this.run(options.duration ?? 1700, (t) => {
      sprite.position.y = y0 + 1.1 * easeOut(t);
      sprite.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      if (t === 1) this.dropFloater(floater);
    });
  }

  private dropFloater(floater: Floater): void {
    if (!this.floaters.delete(floater)) return;
    this.world.remove(floater.sprite);
    floater.sprite.material.dispose();
    floater.texture.dispose();
  }

  /** The die rises, turns to its new value and settles: an increase. */
  private async raise(die: Die3D, value: number, seat: number): Promise<void> {
    this.options.sounds.play("pick");
    this.float("+1", die.root.position, { background: COLORS.accent, height: 1.3, duration: 1200 });
    const start = die.tumbler.quaternion.clone();
    const end = orientation(value, seatAngle(seat));
    await this.run(this.ms(420), (t) => {
      die.lift = 0.55 * Math.sin(Math.PI * t);
      die.tumbler.quaternion.slerpQuaternions(start, end, easeInOut(t));
    });
    die.show(value, seatAngle(seat));
    die.lift = 0;
  }

  /**
   * Shows what a move is about to do, before it plays: the squares it uses
   * are marked, so a play of a bot can be followed.
   */
  async preview(move: Move, seat: number): Promise<void> {
    const view = this.view;
    if (!this.motion || !view) return;
    const { to, raise, from } = squaresOf(move);
    const selected = move.kind === "increase" ? [to] : raise !== null ? [raise] : [];
    this.setMarks({
      ...NO_MARKS,
      active: seat,
      places: move.kind === "place" ? [to] : [],
      blocks: move.kind === "block" ? [to] : [],
      choices: from !== null ? [from] : [],
      selected,
      last: this.marks.last,
    });
    this.options.sounds.play("pick");
    await wait(700);
  }

  /**
   * Plays a move as an animation, from the table as it is (the view before
   * the move), and leaves the table as `transition.view` with `marks`.
   */
  async animate(transition: Transition, before: View, marks: TableMarks): Promise<void> {
    const seat = before.toMove;
    const move = transition.move;
    this.setMarks({ ...NO_MARKS, active: seat, last: this.marks.last }, before);
    if (move.kind === "increase" || move.kind === "block") {
      const at = move.kind === "increase" ? move.at : move.raise;
      const die = this.board[at];
      const old = before.cells[at];
      if (die && old) await this.raise(die, old.value + 1, old.owner);
    }
    if (move.kind === "place" || move.kind === "block") {
      let die: Die3D | undefined;
      const spent = reserveValueOf(move);
      let value = move.kind === "block" ? 1 : (spent ?? 1);
      if (spent !== null) {
        const dice = this.reserve[seat]!;
        const index = dice.findIndex((d) => d.value === spent);
        die = index >= 0 ? dice.splice(index, 1)[0] : dice.pop();
      } else {
        const { from } = squaresOf(move);
        die = from === null ? undefined : (this.board[from] ?? undefined);
        if (from !== null) {
          this.board[from] = null;
          if (move.kind === "place") value = before.cells[from]?.value ?? value;
        }
      }
      if (die) {
        const to = this.squarePoint(move.to);
        await this.fly(die, to, orientation(value, seatAngle(seat)), { duration: spent !== null ? 650 : 520, height: 1.3 });
        die.value = value;
        this.board[move.to] = die;
        await this.land(die);
      }
    }
    if (transition.captured.length > 0) {
      const flights = transition.captured.map(async ({ at, die: { owner, value } }, i) => {
        const die = this.board[at];
        if (!die) return;
        this.board[at] = null;
        this.float("Capturado", die.root.position, { background: COLORS.ink, height: 1.4 });
        await this.pause(250 + 120 * i);
        const slot = this.captured[owner]!.length;
        this.captured[owner]!.push(die);
        await this.fly(die, this.trayPoint(owner, "captured", slot), orientation(value, seatAngle(owner)), { duration: 750, height: 1.8, tumble: 1 });
        await this.land(die, 0.7);
      });
      this.options.sounds.play("line");
      await Promise.all(flights);
    }
    // Whatever the animations left, the table is now the one of the new view.
    this.show(transition.view, marks);
  }

  // --- Camera and drawing ----------------------------------------------------

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    this.loop = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    const k = 1 - Math.exp(-dt * 7);
    const settle = (value: number, goal: number) => (Math.abs(goal - value) < 1e-4 ? goal : value + (goal - value) * k);
    const moving = this.yaw !== this.yawGoal || this.zoom !== this.zoomGoal;
    if (moving) {
      this.yaw = settle(this.yaw, this.yawGoal);
      this.zoom = settle(this.zoom, this.zoomGoal);
      this.dirty = true;
    }
    // The trays of the seat to move glow, gently; the brackets on the dice that can move breathe.
    const active = this.marks.active;
    this.trays.forEach((seatTrays, seat) => {
      for (const kind of TRAYS) {
        const material = seatTrays[kind].glow.material as MeshBasicMaterial;
        const target = seat === active ? 0.4 + 0.18 * Math.sin(now / 420) : 0;
        if (Math.abs(material.opacity - target) > 0.003) {
          material.opacity = target;
          this.dirty = true;
        }
      }
    });
    if (this.marks.choices.length > 0) {
      const s = 1.05 + 0.07 * Math.sin(now / 260);
      for (const mesh of this.pools.claim) if (mesh.visible) mesh.scale.set(s, 1, s);
      this.dirty = true;
    }
    if (!this.dirty && this.running === 0) return;
    this.dirty = false;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  };

  private fitPoints(): Vector3[] {
    const points = extentPoints(this.arrangement).map((p) => new Vector3(p.x, 0, p.z));
    for (const p of extentPoints(this.arrangement).slice(0, 4)) points.push(new Vector3(p.x, 0.8, p.z));
    return points;
  }

  private updateCamera(): void {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const insets = this.options.insets();
    const camKey = `${this.yaw}|${this.zoom}|${width}|${height}|${insets.top}|${insets.bottom}|${insets.left}|${insets.right}|${this.arrangement}`;
    if (camKey === this.cameraKey) return;
    this.cameraKey = camKey;
    const camera = this.camera;
    camera.aspect = width / height;
    // The box of the canvas left free by the panels, in normalized device coordinates.
    const box = {
      left: -1 + (2 * insets.left) / width + 0.03,
      right: 1 - (2 * insets.right) / width - 0.03,
      bottom: -1 + (2 * insets.bottom) / height + 0.03,
      top: 1 - (2 * insets.top) / height - 0.03,
    };
    const dir = new Vector3(Math.sin(this.yaw) * Math.sin(PITCH), Math.cos(PITCH), Math.cos(this.yaw) * Math.sin(PITCH));
    const toward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // Zooming in moves the eye towards the board.
    const focus = Math.min(1, Math.max(0, (1 - this.zoom) / (1 - ZOOM.min)));
    const points = this.fitPoints();
    let pan = 0;
    let side = 0;
    let distance = 30;
    const place = (d: number, p: number, q: number) => {
      const target = toward.clone().multiplyScalar(p).addScaledVector(right, q);
      target.x -= target.x * focus;
      target.z -= target.z * focus;
      camera.position.copy(target).addScaledVector(dir, d);
      camera.up.copy(UP);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
    };
    const extent = (d: number, p: number, q: number) => {
      place(d, p, q);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const point of points) {
        const ndc = point.clone().project(camera);
        minX = Math.min(minX, ndc.x);
        maxX = Math.max(maxX, ndc.x);
        minY = Math.min(minY, ndc.y);
        maxY = Math.max(maxY, ndc.y);
      }
      return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    };
    const fits = (e: ReturnType<typeof extent>) => e.minX >= box.left && e.maxX <= box.right && e.minY >= box.bottom && e.maxY <= box.top;
    const goal = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
    for (let round = 0; round < 4; round++) {
      let low = 4;
      let high = 200;
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        if (fits(extent(mid, pan, side))) high = mid;
        else low = mid;
      }
      distance = high;
      const e = extent(distance, pan, side);
      const dy = extent(distance, pan + 0.5, side).cy - e.cy;
      if (Math.abs(dy) > 1e-6) pan -= ((e.cy - goal.y) / dy) * 0.5;
      const e2 = extent(distance, pan, side);
      const dx = extent(distance, pan, side + 0.5).cx - e2.cx;
      if (Math.abs(dx) > 1e-6) side -= ((e2.cx - goal.x) / dx) * 0.5;
    }
    place(distance * this.zoom, pan, side);
    camera.near = Math.max(0.5, distance * this.zoom - 40);
    camera.far = distance * this.zoom + 80;
    camera.updateProjectionMatrix();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.cameraKey = "";
    this.checkArrangement();
    this.dirty = true;
  }

  /** The table changes shape with the free part of the screen. */
  private checkArrangement(): void {
    const insets = this.options.insets();
    const width = Math.max(1, this.container.clientWidth - insets.left - insets.right);
    const height = Math.max(1, this.container.clientHeight - insets.top - insets.bottom);
    const wanted = arrangementFor(width / height);
    if (wanted !== this.arrangement) this.applyArrangement(wanted);
  }

  /** Frames the table again: the panels of the page changed size. */
  refit(): void {
    this.cameraKey = "";
    this.checkArrangement();
    this.dirty = true;
  }

  // --- Pointer ---------------------------------------------------------------

  private ndc(event: { clientX: number; clientY: number }): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
  }

  /** The square of the game under the pointer: the die there, or the cell of the board. */
  private pick(event: { clientX: number; clientY: number }): number | null {
    this.raycaster.setFromCamera(this.ndc(event), this.camera);
    const bodies: Mesh[] = [];
    for (const die of this.board) if (die) bodies.push(die.body);
    const hit = this.raycaster.intersectObjects(bodies, false)[0]?.object.userData.die as Die3D | undefined;
    if (hit) {
      const square = this.board.indexOf(hit);
      return square >= 0 ? square : null;
    }
    const point = this.raycaster.ray.intersectPlane(GROUND, new Vector3());
    if (!point || Math.abs(point.x) > BOARD_HALF || Math.abs(point.z) > BOARD_HALF) return null;
    return squareAt(point.x, point.z, this.size);
  }

  /** Where a square is on the page, in CSS pixels: for the tests in the browser. */
  screenOf(square: number): { x: number; y: number } {
    const p = squareSpot(square, this.size);
    const point = new Vector3(p.x, this.board[square] ? 0.5 : 0.1, p.z);
    this.updateCamera();
    const ndc = point.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((ndc.x + 1) / 2) * rect.width, y: rect.top + ((1 - ndc.y) / 2) * rect.height };
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.options.sounds.unlock();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.canvas.setPointerCapture(event.pointerId);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoomGoal };
      this.press = null;
      return;
    }
    this.press = { x: event.clientX, y: event.clientY, moved: false };
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomGoal = Math.min(ZOOM.max, Math.max(ZOOM.min, this.pinch.zoom * (this.pinch.distance / Math.max(1, distance))));
      this.dirty = true;
      return;
    }
    const press = this.press;
    if (press && this.pointers.has(event.pointerId)) {
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (!press.moved && Math.hypot(dx, dy) > 8) press.moved = true;
      // A press that moved is not a tap: it picks nothing.
      if (press.moved) return;
    }
    if (event.pointerType === "touch") return;
    const square = this.pick(event);
    this.canvas.style.cursor = square !== null && this.options.canPick(square) ? "pointer" : "default";
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const press = this.press;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    this.press = null;
    this.canvas.style.cursor = "default";
    if (!press || press.moved) return;
    this.options.onPick(this.pick(event));
  };

  private readonly onPointerCancel = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    this.press = null;
    this.pinch = null;
  };

  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.zoomBy(Math.exp(event.deltaY * 0.0012));
  };

  private readonly onDoubleClick = () => {
    this.resetView();
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.loop);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("dblclick", this.onDoubleClick);
    for (const floater of [...this.floaters]) this.dropFloater(floater);
    this.assets.dispose();
    for (const m of this.markMaterials.values()) m.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const g of this.geometries) g.dispose();
    this.markGeometry.dispose();
    for (const seat of this.trays) {
      for (const tray of Object.values(seat)) {
        tray.label.material.map?.dispose();
        tray.label.material.dispose();
      }
    }
    this.renderer.dispose();
    this.canvas.remove();
  }
}
