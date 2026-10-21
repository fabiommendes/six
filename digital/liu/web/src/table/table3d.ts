import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  LatheGeometry,
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
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from "three";
import type { Bounds } from "@wire/Bounds";
import type { Command, Event, PlayerView, Pos, View } from "../engine/game";
import { lineCells, newLines, pointsGained, sealOwner } from "../logic/feedback";
import { COLORS, SEAL_COLORS } from "../ui/svg";
import { DieAssets, Die3D, orientation } from "./dice";
import { drawCell, drawHandPlate, drawLabel, drawMark, drawMat, drawTray, drawWood, shade, type MarkKind } from "./drawing";
import {
  bagSpot,
  cellAt,
  HAND_AT,
  MARKET_RADIUS,
  marketSpot,
  MAT_SIZE,
  REACH,
  seatAngle,
  seatToTable,
  tableExtent,
  tableToSeat,
  type Spot,
} from "./layout";
import { easeInOut, easeOut, tween, wait } from "./motion";
import type { Sounds } from "./sound";

/** What a click or a tap on the table hits. */
export type Pick =
  | { readonly kind: "market"; readonly die: number }
  | { readonly kind: "hand"; readonly seat: number }
  | { readonly kind: "cell"; readonly seat: number; readonly at: Pos };

/** What the table marks, besides the dice: the turn, the selection and what it allows. */
export interface TableMarks {
  /** The seat to move, lit on the table; null once the game is over. */
  readonly active: number | null;
  /** The selected die of the market. */
  readonly selectedMarket: number | null;
  /** The die of the hand of the active seat is selected. */
  readonly handSelected: boolean;
  /** Where the selected die may go, in the window of the active seat. */
  readonly targets: readonly Pos[];
  /** The value of the selected die, shown in a cell under the pointer. */
  readonly ghostValue: number | null;
  /** A die about to be put: the die of the hand waiting for a die of the market. */
  readonly pending: { readonly at: Pos; readonly value: number } | null;
  /** The dice of the market that fit nowhere in the window of the active seat (when a person plays). */
  readonly unfit: readonly boolean[];
  /** The die put last. */
  readonly last: { readonly seat: number; readonly at: Pos } | null;
}

export const NO_MARKS: TableMarks = { active: null, selectedMarket: null, handSelected: false, targets: [], ghostValue: null, pending: null, unfit: [], last: null };

/** Room the page covers over the canvas, in CSS pixels: the table is framed in what is left. */
export interface Insets {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface TableOptions {
  readonly names: readonly string[];
  readonly sounds: Sounds;
  reducedMotion(): boolean;
  /** The parts of the canvas under the panels of the page. */
  insets(): Insets;
  onPick(pick: Pick | null): void;
  /** Whether a pick does something: the pointer cursor shows over it. */
  canPick(pick: Pick): boolean;
}

/** What the table reports while it plays the events of a command. */
export interface Progress {
  /** An event starts to show. */
  onEvent?(event: Event): void;
  /** The dice left in the bag, as they leave it. */
  onBag?(left: number): void;
}

const SURFACE = { table: 0, mat: 0.012, tray: 0.014, plate: 0.02 } as const;
const MARK_Y = 0.03;
const PLATE_W = 1.3;
const HAND_DIE_Z = HAND_AT.z - 0.15 * PLATE_W;
const PITCH = { initial: 0.86, min: 0.42, max: 1.12 } as const;
const ZOOM = { min: 0.42, max: 1.18 } as const;
const UP = new Vector3(0, 1, 0);
const GROUND = new Plane(new Vector3(0, 1, 0), 0);

const key = (at: Pos) => `${at.row},${at.col}`;
const cellIndex = (at: Pos) => (at.row + REACH) * (2 * REACH + 1) + (at.col + REACH);
const pinned = (b: Bounds) => b.bottom - b.top === 3 && b.right - b.left === 3;

function canvasTexture(canvas: HTMLCanvasElement, mipmaps = true): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = mipmaps ? LinearMipmapLinearFilter : LinearFilter;
  t.generateMipmaps = mipmaps;
  return t;
}

/** A frame of four bars (and the inner grid once the window is pinned) around a rectangle of cells. */
class Frame {
  readonly group = new Group();
  private readonly bars: Mesh[] = [];
  private readonly inner: Mesh[] = [];
  rect = { top: -REACH, bottom: REACH, left: -REACH, right: REACH };
  private grip = 0;

  constructor(geometry: BoxGeometry, private readonly loose: Material, private readonly fixed: Material) {
    for (let i = 0; i < 4; i++) {
      const bar = new Mesh(geometry, loose);
      bar.castShadow = true;
      bar.receiveShadow = true;
      this.bars.push(bar);
      this.group.add(bar);
    }
    for (let i = 0; i < 6; i++) {
      const bar = new Mesh(geometry, fixed);
      bar.castShadow = true;
      bar.visible = false;
      this.inner.push(bar);
      this.group.add(bar);
    }
  }

  /** Places the bars for `rect` (fractional while it moves) and a grip from 0 (loose) to 1 (pinned). */
  place(rect: { top: number; bottom: number; left: number; right: number }, grip: number): void {
    this.rect = rect;
    this.grip = grip;
    const x0 = rect.left - 0.5;
    const x1 = rect.right + 0.5;
    const z0 = rect.top - 0.5;
    const z1 = rect.bottom + 0.5;
    const t = 0.12 + 0.05 * grip;
    const h = 0.1 + 0.1 * grip;
    const [north, south, west, east] = this.bars as [Mesh, Mesh, Mesh, Mesh];
    for (const bar of this.bars) bar.material = grip > 0.5 ? this.fixed : this.loose;
    north.scale.set(x1 - x0 + t, h, t);
    north.position.set((x0 + x1) / 2, h / 2, z0);
    south.scale.set(x1 - x0 + t, h, t);
    south.position.set((x0 + x1) / 2, h / 2, z1);
    west.scale.set(t, h, z1 - z0);
    west.position.set(x0, h / 2, (z0 + z1) / 2);
    east.scale.set(t, h, z1 - z0);
    east.position.set(x1, h / 2, (z0 + z1) / 2);
    // The inner grid of the frame: three bars each way, between the cells.
    const ih = 0.05 * grip;
    this.inner.forEach((bar, i) => {
      bar.visible = grip > 0.01;
      const k = (i % 3) + 1;
      if (i < 3) {
        bar.scale.set(0.05, ih, z1 - z0);
        bar.position.set(x0 + k, ih / 2, (z0 + z1) / 2);
      } else {
        bar.scale.set(x1 - x0, ih, 0.05);
        bar.position.set((x0 + x1) / 2, ih / 2, z0 + k);
      }
    });
  }

  get currentGrip(): number {
    return this.grip;
  }
}

/** The things of one seat: the mat, its cells, the frame, the dice of the window and of the hand, the name. */
interface Seat {
  readonly index: number;
  readonly angle: number;
  readonly group: Group;
  readonly glow: Mesh;
  readonly cells: Mesh[];
  readonly frame: Frame;
  readonly dice: Map<string, Die3D>;
  hand: Die3D | null;
  readonly label: Sprite;
  labelKey: string;
  bounds: Bounds;
  readonly lines: Mesh[];
}

/** A short-lived text over the table: rises and fades. */
interface Floater {
  readonly sprite: Sprite;
  readonly texture: Texture;
}

/**
 * The table in Three.js: a wooden table with one mat per seat (the window,
 * its frame and the hand), the market on a tray in the middle and the bag.
 * The camera sits behind the player who looks at the table and turns with
 * the turn of each person; it can be dragged, zoomed and reset. The table
 * draws what the screen tells it and plays the events of each command as
 * animations; it knows no rule.
 */
export class Table3D {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, 0.5, 200);
  private readonly world = new Group();
  private readonly assets = new DieAssets();
  private readonly raycaster = new Raycaster();
  private readonly seats: Seat[] = [];
  private market: Die3D[] = [];
  private readonly bag = new Group();
  private readonly bagLabel: Sprite;
  private bagCount = -1;
  private readonly sealTags: Mesh[] = [];
  private readonly textures: Texture[] = [];
  private readonly materials: Material[] = [];
  private readonly geometries: { dispose(): void }[] = [];
  private readonly markMaterials: Record<MarkKind, MeshBasicMaterial>;
  private readonly markGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly rings: Mesh[] = [];
  private readonly slashes: Mesh[] = [];
  private readonly selectedMark: Mesh;
  private readonly lastMark: Mesh;
  private readonly hoverMark: Mesh;
  private readonly hoverRow: Mesh;
  private readonly hoverCol: Mesh;
  private readonly ghost: Die3D;
  private readonly pendingDie: Die3D;
  private readonly floaters = new Set<Floater>();
  private readonly cellGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly lineGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly lineMaterial: MeshBasicMaterial;
  private marks: TableMarks = NO_MARKS;
  private hovered: Pick | null = null;
  private fitPoints: Vector3[] = [];

  // The camera: where it looks from, smoothed towards its targets.
  private viewer = 0;
  private yaw = 0;
  private yawGoal = 0;
  private pitch: number = PITCH.initial;
  private pitchGoal: number = PITCH.initial;
  private zoom = 1;
  private zoomGoal = 1;
  private cameraKey = "";

  private dirty = true;
  private running = 0;
  private loop = 0;
  private lastFrame = 0;
  private readonly observer: ResizeObserver;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private press: { x: number; y: number; moved: boolean; yaw: number; pitch: number } | null = null;
  private pinch: { distance: number; zoom: number } | null = null;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly seatCount: number,
    private readonly options: TableOptions,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
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
    sun.position.set(-6, 16, 8);
    sun.castShadow = true;
    const reach = tableExtent() + 2;
    sun.shadow.camera.left = -reach;
    sun.shadow.camera.right = reach;
    sun.shadow.camera.top = reach;
    sun.shadow.camera.bottom = -reach;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 50;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    this.scene.add(sun);

    const mark = (kind: MarkKind) => {
      const map = this.texture(drawMark(kind, 128));
      return new MeshBasicMaterial({ map, transparent: true, depthWrite: false });
    };
    this.markMaterials = { ring: mark("ring"), selected: mark("selected"), last: mark("last"), line: mark("line"), hover: mark("hover"), unfit: mark("unfit") };
    this.lineMaterial = new MeshBasicMaterial({ color: COLORS.liu, transparent: true, opacity: 0.38, depthWrite: false });
    this.materials.push(this.lineMaterial);
    this.selectedMark = this.newMark("selected");
    this.lastMark = this.newMark("last");
    this.hoverMark = this.newMark("hover");
    this.hoverRow = this.newMark("hover");
    this.hoverCol = this.newMark("hover");

    this.buildTable();
    this.buildMarket();
    this.buildBag();
    this.bagLabel = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false }));
    this.bagLabel.renderOrder = 10;
    this.world.add(this.bagLabel);
    for (let i = 0; i < seatCount; i++) this.seats.push(this.buildSeat(i));
    this.fitPoints = this.computeFitPoints();

    this.ghost = new Die3D(null, 1, this.assets, true);
    this.ghost.root.visible = false;
    this.world.add(this.ghost.root);
    this.pendingDie = new Die3D(null, 1, this.assets, true);
    this.pendingDie.root.visible = false;
    this.world.add(this.pendingDie.root);

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("dblclick", this.onDoubleClick);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.loop = requestAnimationFrame(this.frame);
    // The labels are drawn with the fonts of the page: draw them again once they are in.
    void document.fonts?.ready.then(() => {
      for (const seat of this.seats) seat.labelKey = "";
      this.bagCount = -1;
      this.dirty = true;
    });
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
    const side = 2 * tableExtent() + 3;
    const wood = this.texture(drawWood(1024));
    wood.wrapS = wood.wrapT = RepeatWrapping;
    wood.repeat.set(2, 2);
    const top = this.material(new MeshStandardMaterial({ map: wood, roughness: 0.62, metalness: 0 }));
    const edge = this.material(new MeshStandardMaterial({ color: "#3E2819", roughness: 0.7 }));
    const geometry = new BoxGeometry(side, 0.8, side);
    this.geometries.push(geometry);
    const table = new Mesh(geometry, [edge, edge, top, edge, edge, edge]);
    table.position.y = -0.4;
    table.receiveShadow = true;
    this.world.add(table);
  }

  private buildMarket(): void {
    const geometry = new CircleGeometry(MARKET_RADIUS, 96).rotateX(-Math.PI / 2);
    this.geometries.push(geometry);
    const tray = new Mesh(geometry, this.material(new MeshLambertMaterial({ map: this.texture(drawTray(1024)) })));
    tray.position.y = SURFACE.tray;
    tray.receiveShadow = true;
    // The rim of the tray, a low ring of wood.
    const rimGeometry = new TorusGeometry(MARKET_RADIUS + 0.02, 0.07, 10, 96).rotateX(Math.PI / 2);
    this.geometries.push(rimGeometry);
    const rim = new Mesh(rimGeometry, this.material(new MeshStandardMaterial({ color: "#4A3020", roughness: 0.5 })));
    rim.position.y = 0.04;
    rim.castShadow = true;
    this.world.add(tray, rim);
  }

  private buildBag(): void {
    const profile = [
      [0.0, 0], [0.75, 0.02], [0.98, 0.25], [1.05, 0.62], [0.92, 1.05], [0.6, 1.35], [0.38, 1.5], [0.42, 1.62], [0.62, 1.82], [0.55, 1.9], [0.3, 1.78],
    ].map(([x, y]) => new Vector2(x!, y!));
    const geometry = new LatheGeometry(profile, 40);
    this.geometries.push(geometry);
    const cloth = this.material(new MeshStandardMaterial({ color: shade(COLORS.liu, -0.35), roughness: 0.95 }));
    const body = new Mesh(geometry, cloth);
    body.castShadow = true;
    body.receiveShadow = true;
    const cordGeometry = new TorusGeometry(0.42, 0.045, 8, 32).rotateX(Math.PI / 2);
    this.geometries.push(cordGeometry);
    const cord = new Mesh(cordGeometry, this.material(new MeshStandardMaterial({ color: "#D9C7A0", roughness: 0.8 })));
    cord.position.y = 1.52;
    cord.castShadow = true;
    this.bag.add(body, cord);
    const at = bagSpot(this.seatCount);
    this.bag.position.set(at.x, 0, at.z);
    this.world.add(this.bag);
  }

  private buildSeat(index: number): Seat {
    const angle = seatAngle(index, this.seatCount);
    const centre = seatToTable(index, this.seatCount, { x: 0, z: 0 });
    const group = new Group();
    group.position.set(centre.x, 0, centre.z);
    group.rotation.y = angle;
    this.world.add(group);
    const color = SEAL_COLORS[index]!;

    const glowGeometry = new PlaneGeometry(MAT_SIZE + 0.7, MAT_SIZE + 0.7).rotateX(-Math.PI / 2);
    this.geometries.push(glowGeometry);
    const glow = new Mesh(glowGeometry, this.material(new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false })));
    glow.position.y = 0.004;
    group.add(glow);

    const matGeometry = new BoxGeometry(MAT_SIZE, 0.024, MAT_SIZE);
    this.geometries.push(matGeometry);
    const paper = this.material(new MeshLambertMaterial({ map: this.texture(drawMat(2 * REACH + 1, MAT_SIZE, 150, color)) }));
    const edge = this.material(new MeshLambertMaterial({ color: COLORS.line }));
    const mat = new Mesh(matGeometry, [edge, edge, paper, edge, edge, edge]);
    mat.position.y = SURFACE.mat - 0.012;
    mat.receiveShadow = true;
    group.add(mat);

    const cellMaterial = this.material(new MeshLambertMaterial({ map: this.texture(drawCell(128)), transparent: true }));
    const cells: Mesh[] = [];
    for (let row = -REACH; row <= REACH; row++) {
      for (let col = -REACH; col <= REACH; col++) {
        const cell = new Mesh(this.cellGeometry, cellMaterial);
        cell.position.set(col, SURFACE.mat + 0.003, row);
        cell.receiveShadow = true;
        cells.push(cell);
        group.add(cell);
      }
    }

    const barGeometry = new BoxGeometry(1, 1, 1);
    this.geometries.push(barGeometry);
    const frame = new Frame(
      barGeometry,
      this.material(new MeshStandardMaterial({ color: "#9C8B70", roughness: 0.8 })),
      this.material(new MeshStandardMaterial({ color: shade(COLORS.liu, -0.25), roughness: 0.55 })),
    );
    frame.group.position.y = SURFACE.mat;
    frame.place({ top: -REACH, bottom: REACH, left: -REACH, right: REACH }, 0);
    group.add(frame.group);

    const plateGeometry = new PlaneGeometry(PLATE_W, PLATE_W * 1.3).rotateX(-Math.PI / 2);
    this.geometries.push(plateGeometry);
    const plate = new Mesh(plateGeometry, this.material(new MeshLambertMaterial({ map: this.texture(drawHandPlate(256)), transparent: true })));
    plate.position.set(HAND_AT.x, SURFACE.plate, HAND_AT.z);
    plate.receiveShadow = true;
    group.add(plate);

    const label = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false }));
    label.renderOrder = 10;
    const at = seatToTable(index, this.seatCount, { x: 0, z: MAT_SIZE / 2 + 0.75 });
    label.position.set(at.x, 0.5, at.z);
    this.world.add(label);

    return { index, angle, group, glow, cells, frame, dice: new Map(), hand: null, label, labelKey: "", bounds: { top: -REACH, bottom: REACH, left: -REACH, right: REACH }, lines: [] };
  }

  private newMark(kind: MarkKind): Mesh {
    const mesh = new Mesh(this.markGeometry, this.markMaterials[kind]);
    mesh.renderOrder = 2;
    mesh.visible = false;
    this.world.add(mesh);
    return mesh;
  }

  private computeFitPoints(): Vector3[] {
    const points: Vector3[] = [];
    const h = MAT_SIZE / 2;
    for (let s = 0; s < this.seatCount; s++) {
      for (const local of [{ x: -h, z: -h }, { x: h, z: -h }, { x: -h, z: h + 1.1 }, { x: h, z: h + 1.1 }, { x: HAND_AT.x + PLATE_W / 2, z: HAND_AT.z + PLATE_W * 0.65 }]) {
        const p = seatToTable(s, this.seatCount, local);
        points.push(new Vector3(p.x, 0, p.z));
      }
    }
    const bag = bagSpot(this.seatCount);
    points.push(new Vector3(bag.x, 2, bag.z));
    return points;
  }

  /** The window of the viewer, its hand and the market: what a narrow screen frames. */
  private closePoints(): Vector3[] {
    const h = MAT_SIZE / 2;
    const points = [{ x: -h, z: -h }, { x: h, z: -h }, { x: -h, z: h + 1.1 }, { x: h, z: h + 1.1 }, { x: HAND_AT.x + PLATE_W / 2, z: HAND_AT.z }].map((local) => {
      const p = seatToTable(this.viewer, this.seatCount, local);
      return new Vector3(p.x, 0, p.z);
    });
    const a = seatAngle(this.viewer, this.seatCount);
    for (const [x, z] of [[-1, 0], [1, 0], [0, -1]] as const) {
      const r = MARKET_RADIUS;
      points.push(new Vector3((x * Math.cos(a) + z * Math.sin(a)) * r, 0, (-x * Math.sin(a) + z * Math.cos(a)) * r));
    }
    return points;
  }

  // --- What the screen tells -------------------------------------------------

  /** Shows `view` at once, without animation: at the start, after an undo and after each animation. */
  show(view: View, marks: TableMarks): void {
    this.syncMarket(view.market);
    view.players.forEach((player, i) => this.syncSeat(this.seats[i]!, player, false));
    this.setBag(view.bag);
    this.updateLabels(view);
    this.setMarks(marks, view);
    this.dirty = true;
  }

  private view: View | null = null;

  setMarks(marks: TableMarks, view: View | null = this.view): void {
    this.marks = marks;
    if (view) this.view = view;
    const current = this.view;
    this.market.forEach((die, i) => {
      die.lift = marks.selectedMarket === i ? 0.45 : 0;
    });
    const selected = marks.selectedMarket !== null ? this.market[marks.selectedMarket] : null;
    const activeSeat = marks.active !== null ? this.seats[marks.active] : undefined;
    if (selected) this.placeMarkAt(this.selectedMark, selected.root.position, 0, 1.12);
    else if (marks.handSelected && activeSeat?.hand) this.placeMarkAt(this.selectedMark, activeSeat.hand.root.position, activeSeat.angle, 1.12);
    else this.selectedMark.visible = false;
    for (const seat of this.seats) {
      if (seat.hand) seat.hand.lift = marks.handSelected && seat.index === marks.active ? 0.45 : 0;
    }
    // Rings on the cells where the selected die may go.
    while (this.rings.length < marks.targets.length) this.rings.push(this.newMark("ring"));
    this.rings.forEach((ring, i) => {
      const at = marks.targets[i];
      if (!at || !activeSeat) {
        ring.visible = false;
        return;
      }
      this.placeMarkAt(ring, this.cellPoint(activeSeat, at), activeSeat.angle, 1);
    });
    // A slash under the dice that fit nowhere.
    while (this.slashes.length < this.market.length) this.slashes.push(this.newMark("unfit"));
    this.slashes.forEach((slash, i) => {
      const die = this.market[i];
      if (!die || !marks.unfit[i]) {
        slash.visible = false;
        return;
      }
      this.placeMarkAt(slash, die.root.position, 0, 1.05);
    });
    if (marks.last && this.seats[marks.last.seat]) {
      const seat = this.seats[marks.last.seat]!;
      this.placeMarkAt(this.lastMark, this.cellPoint(seat, marks.last.at), seat.angle, 1);
    } else this.lastMark.visible = false;
    if (marks.pending && activeSeat) {
      this.pendingDie.root.visible = true;
      const p = this.cellPoint(activeSeat, marks.pending.at);
      this.pendingDie.root.position.set(p.x, SURFACE.mat, p.z);
      this.pendingDie.show(marks.pending.value, activeSeat.angle);
    } else this.pendingDie.root.visible = false;
    this.updateSealTags(current);
    this.updateHover();
    this.dirty = true;
  }

  /** Looks at the table from the seat of `seat`, turning there unless `instant`. */
  setViewer(seat: number, instant = false): void {
    if (seat === this.viewer && !instant) return;
    this.viewer = seat;
    // Turn the short way round.
    const goal = seatAngle(seat, this.seatCount);
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
    this.yawGoal = seatAngle(this.viewer, this.seatCount) + Math.round((this.yawGoal - seatAngle(this.viewer, this.seatCount)) / (2 * Math.PI)) * 2 * Math.PI;
    this.pitchGoal = PITCH.initial;
    this.zoomGoal = 1;
    this.dirty = true;
  }

  /** Closer to the window of the viewer (`in`) or back to the whole table. */
  zoomBy(factor: number): void {
    this.zoomGoal = Math.min(ZOOM.max, Math.max(ZOOM.min, this.zoomGoal * factor));
    this.dirty = true;
  }

  // --- Syncing ---------------------------------------------------------------

  private syncMarket(values: readonly number[]): void {
    const keep = [...this.market];
    const next: Die3D[] = [];
    for (const value of values) {
      const i = keep.findIndex((d) => d.value === value);
      if (i >= 0) next.push(keep.splice(i, 1)[0]!);
      else {
        const die = new Die3D(null, value, this.assets);
        die.show(value, this.marketYaw());
        this.world.add(die.root);
        next.push(die);
      }
    }
    for (const die of keep) this.world.remove(die.root);
    this.market = next;
    this.market.forEach((die, i) => {
      const at = marketSpot(i, this.market.length);
      die.root.position.set(at.x, SURFACE.tray, at.z);
    });
  }

  private marketYaw(): number {
    return seatAngle(this.viewer, this.seatCount) + (Math.random() - 0.5) * 0.5;
  }

  /**
   * Puts the dice of a window as in `player`, and the hand unless `hand` is
   * false (an animation still has to bring it); `animate` the frame when the
   * bounds change.
   */
  private syncSeat(seat: Seat, player: PlayerView, animate: boolean, hand = true): void {
    const wanted = new Map(player.window.map((d) => [key(d.at), d]));
    for (const [k, die] of [...seat.dice]) {
      const want = wanted.get(k);
      if (!want || want.value !== die.value) {
        this.world.remove(die.root);
        seat.dice.delete(k);
      }
    }
    for (const [k, want] of wanted) {
      if (seat.dice.has(k)) continue;
      const seal = want.at.row === 0 && want.at.col === 0;
      const die = new Die3D(seal ? seat.index : null, want.value, this.assets);
      const p = this.cellPoint(seat, want.at);
      die.root.position.set(p.x, SURFACE.mat, p.z);
      die.show(want.value, seat.angle);
      this.world.add(die.root);
      seat.dice.set(k, die);
    }
    if (!hand) {
      // The hand waits for its animation.
    } else if (player.hand === null) {
      if (seat.hand) this.world.remove(seat.hand.root);
      seat.hand = null;
    } else if (!seat.hand || seat.hand.value !== player.hand) {
      if (seat.hand) this.world.remove(seat.hand.root);
      seat.hand = this.newHandDie(seat, player.hand);
    }
    this.setBounds(seat, player.bounds, animate);
    this.setLines(seat, player);
  }

  private newHandDie(seat: Seat, value: number): Die3D {
    const die = new Die3D(null, value, this.assets);
    const p = this.handPoint(seat);
    die.root.position.set(p.x, SURFACE.plate, p.z);
    die.show(value, seat.angle);
    this.world.add(die.root);
    return die;
  }

  private setBounds(seat: Seat, bounds: Bounds, animate: boolean): void {
    seat.bounds = bounds;
    const inside = (b: Bounds, row: number, col: number) => row >= b.top && row <= b.bottom && col >= b.left && col <= b.right;
    for (let row = -REACH; row <= REACH; row++) {
      for (let col = -REACH; col <= REACH; col++) {
        const cell = seat.cells[cellIndex({ row, col })]!;
        const show = inside(bounds, row, col);
        if (!show && cell.visible && animate && !this.options.reducedMotion()) {
          void this.run(260, (t) => {
            cell.scale.setScalar(1 - easeInOut(t));
            if (t === 1) {
              cell.visible = false;
              cell.scale.setScalar(1);
            }
          });
        } else cell.visible = show;
      }
    }
    const grip = pinned(bounds) ? 1 : 0;
    const from = { ...seat.frame.rect };
    const fromGrip = seat.frame.currentGrip;
    const to = { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right };
    const same = from.top === to.top && from.bottom === to.bottom && from.left === to.left && from.right === to.right && fromGrip === grip;
    if (same) return;
    if (!animate || this.options.reducedMotion()) {
      seat.frame.place(to, grip);
      return;
    }
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    void this.run(grip > fromGrip ? 520 : 380, (t) => {
      const e = easeInOut(t);
      // A frame that gets pinned rises and settles, a little beyond its height.
      const g = grip > fromGrip ? Math.min(1.25, lerp(fromGrip, grip, e) + 0.6 * Math.sin(Math.PI * t) * (1 - t)) : lerp(fromGrip, grip, e);
      seat.frame.place({ top: lerp(from.top, to.top, e), bottom: lerp(from.bottom, to.bottom, e), left: lerp(from.left, to.left, e), right: lerp(from.right, to.right, e) }, t === 1 ? grip : g);
    });
  }

  /** The complete rows and columns of a window: a band of jade under their dice. */
  private setLines(seat: Seat, player: PlayerView): void {
    const lines = player.score.lines;
    while (seat.lines.length < lines.length) {
      const mesh = new Mesh(this.lineGeometry, this.lineMaterial);
      mesh.renderOrder = 1;
      seat.group.add(mesh);
      seat.lines.push(mesh);
    }
    seat.lines.forEach((mesh, i) => {
      const line = lines[i]?.line;
      mesh.visible = line !== undefined;
      if (!line) return;
      const cells = lineCells(player, line);
      const first = cells[0]!;
      const last = cells[cells.length - 1]!;
      const along = line.kind === "row" ? last.col - first.col + 1 : last.row - first.row + 1;
      mesh.position.set((first.col + last.col) / 2, SURFACE.mat + 0.005, (first.row + last.row) / 2);
      mesh.scale.set(line.kind === "row" ? along : 0.9, 1, line.kind === "row" ? 0.9 : along);
    });
  }

  private setBag(count: number): void {
    if (count === this.bagCount) return;
    this.bagCount = count;
    const material = this.bagLabel.material;
    material.map?.dispose();
    const canvas = drawLabel(count === 1 ? "1 dado no saco" : `${count} dados no saco`, { px: 46, background: "rgba(251,248,241,0.94)", color: COLORS.ink, weight: 700 });
    material.map = canvasTexture(canvas, false);
    material.needsUpdate = true;
    const h = 0.62;
    this.bagLabel.scale.set((h * canvas.width) / canvas.height, h, 1);
    const at = bagSpot(this.seatCount);
    this.bagLabel.position.set(at.x, 2.45, at.z);
    this.dirty = true;
  }

  private updateLabels(view: View): void {
    for (const seat of this.seats) {
      const player = view.players[seat.index];
      if (!player) continue;
      const active = view.end === null && view.toMove === seat.index;
      const won = view.winners?.includes(seat.index) ?? false;
      const points = player.score.points === 1 ? "1 ponto" : `${player.score.points} pontos`;
      const text = `${this.options.names[seat.index] ?? ""} · ${points}${won ? " · venceu" : ""}`;
      const labelKey = `${text}|${active}|${won}`;
      if (labelKey === seat.labelKey) continue;
      seat.labelKey = labelKey;
      const color = SEAL_COLORS[seat.index]!;
      const canvas = drawLabel(text, { px: 52, background: active || won ? color : "rgba(251,248,241,0.94)", color: active || won ? "#FFFFFF" : COLORS.ink });
      const material = seat.label.material;
      material.map?.dispose();
      material.map = canvasTexture(canvas, false);
      material.needsUpdate = true;
      const h = 0.72;
      seat.label.scale.set((h * canvas.width) / canvas.height, h, 1);
    }
    this.dirty = true;
  }

  /** A coloured disc under each die of the market that shows a seal number, in the colour of its seat. */
  private updateSealTags(view: View | null): void {
    if (!view) return;
    let used = 0;
    this.market.forEach((die) => {
      const owner = sealOwner(view, die.value);
      if (owner === null) return;
      let tag = this.sealTags[used];
      if (!tag) {
        const geometry = new CircleGeometry(0.56, 40).rotateX(-Math.PI / 2);
        this.geometries.push(geometry);
        tag = new Mesh(geometry, this.material(new MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false })));
        tag.renderOrder = 1;
        this.world.add(tag);
        this.sealTags.push(tag);
      }
      (tag.material as MeshBasicMaterial).color.set(SEAL_COLORS[owner]!);
      tag.position.set(die.root.position.x, SURFACE.tray + 0.004, die.root.position.z);
      tag.visible = true;
      used++;
    });
    for (let i = used; i < this.sealTags.length; i++) this.sealTags[i]!.visible = false;
  }

  private placeMarkAt(mesh: Mesh, at: { x: number; z: number }, angle: number, size: number): void {
    mesh.visible = true;
    mesh.position.set(at.x, MARK_Y, at.z);
    mesh.rotation.y = angle;
    mesh.scale.set(size, 1, size);
  }

  private cellPoint(seat: Seat, at: Pos): Spot {
    return seatToTable(seat.index, this.seatCount, { x: at.col, z: at.row });
  }

  private handPoint(seat: Seat): Spot {
    return seatToTable(seat.index, this.seatCount, { x: HAND_AT.x, z: HAND_DIE_Z });
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

  /**
   * A die flies from where it is to `to` in an arc, turning to `end`. With
   * `tumble` it spins on the way, as a die thrown.
   */
  private async fly(die: Die3D, to: { x: number; y: number; z: number }, end: Quaternion, options: { duration: number; height: number; tumble?: number }): Promise<void> {
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

  /** The dice of the market slide to their places, after one left or came. */
  private async layoutMarket(duration = 260): Promise<void> {
    const moves = this.market.map((die, i) => ({ die, from: die.root.position.clone(), to: marketSpot(i, this.market.length) }));
    await this.run(this.ms(duration), (t) => {
      const e = easeInOut(t);
      for (const { die, from, to } of moves) die.root.position.set(from.x + (to.x - from.x) * e, SURFACE.tray, from.z + (to.z - from.z) * e);
    });
    if (this.view) this.updateSealTags(this.view);
  }

  /** The bag gives a die: it puffs a little. */
  private puffBag(): void {
    void this.run(this.ms(220), (t) => {
      const k = Math.sin(Math.PI * t);
      this.bag.scale.set(1 + 0.06 * k, 1 - 0.07 * k, 1 + 0.06 * k);
    });
  }

  private bagMouth(): Vector3 {
    const at = bagSpot(this.seatCount);
    return new Vector3(at.x, 1.7, at.z);
  }

  /** A text that rises over a point of the table and fades. */
  private float(text: string, at: { x: number; z: number }, options: { color?: string; background?: string; height?: number; duration?: number } = {}): void {
    const canvas = drawLabel(text, { px: 56, color: options.color ?? "#FFFFFF", background: options.background ?? COLORS.liu });
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
    void this.run(options.duration ?? 1500, (t) => {
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

  /**
   * Shows what a command is about to take, before it plays: the die of a
   * bot lifts, and a ring shows where it goes. So a play of a bot can be
   * followed.
   */
  async preview(command: Command, seat: number): Promise<void> {
    if (!this.motion) return;
    const marks: TableMarks = { ...NO_MARKS, active: seat, last: this.marks.last };
    if (command.kind === "placeFromMarket" || command.kind === "keep") {
      this.setMarks({ ...marks, selectedMarket: command.die, targets: command.kind === "placeFromMarket" ? [command.at] : [] });
    } else if (command.kind === "placeFromHand") {
      this.setMarks({ ...marks, handSelected: true, targets: [command.at] });
      await wait(380);
      this.setMarks({ ...marks, handSelected: true, selectedMarket: command.die, pending: { at: command.at, value: this.seats[seat]?.hand?.value ?? 1 } });
    } else if (command.kind === "reroll") {
      this.setMarks({ ...marks, handSelected: true });
    } else return;
    this.options.sounds.play("pick");
    await wait(command.kind === "placeFromHand" ? 380 : 520);
  }

  /**
   * Plays the events of `command` as animations, from the table of
   * `before` to that of `after`, and leaves the table as `after` with
   * `marks`. `progress` follows the events as they show.
   */
  async animate(command: Command, events: readonly Event[], before: View, after: View, marks: TableMarks, progress: Progress = {}): Promise<void> {
    this.setMarks({ ...NO_MARKS, active: before.toMove, last: this.marks.last });
    let bag = before.bag;
    const commandDie = "die" in command ? command.die : null;
    for (const event of events) {
      progress.onEvent?.(event);
      switch (event.kind) {
        case "marketFilled": {
          if (event.drawn.length === 0) break;
          const count = this.market.length + event.drawn.length;
          // The dice already there make room first.
          const old = this.market.map((die, i) => ({ die, from: die.root.position.clone(), to: marketSpot(i, count) }));
          void this.run(this.ms(300), (t) => {
            const e = easeInOut(t);
            for (const { die, from, to } of old) die.root.position.set(from.x + (to.x - from.x) * e, SURFACE.tray, from.z + (to.z - from.z) * e);
          });
          const flights: Promise<void>[] = [];
          for (const value of event.drawn) {
            const die = new Die3D(null, value, this.assets);
            const mouth = this.bagMouth();
            die.root.position.copy(mouth);
            die.show(value, this.marketYaw());
            const end = die.tumbler.quaternion.clone();
            die.tumbler.quaternion.random();
            this.world.add(die.root);
            const index = this.market.length;
            this.market.push(die);
            const to = marketSpot(index, count);
            bag--;
            progress.onBag?.(bag);
            this.setBag(bag);
            this.puffBag();
            flights.push(this.fly(die, { x: to.x, y: SURFACE.tray, z: to.z }, end, { duration: 560, height: 1.6, tumble: 2 }).then(() => this.land(die, 0.7)));
            if (this.motion) await wait(150);
          }
          await Promise.all(flights);
          this.updateSealTags(before);
          break;
        }
        case "roundStarted": {
          this.updateSealTags(after);
          // The dice of the seal number that has the majority hop, one after the other.
          const seal = after.players[event.first]?.seal;
          const majority = this.market.filter((d) => d.value === seal);
          for (const die of majority) {
            void this.run(this.ms(320), (t) => {
              die.lift = 0.4 * Math.sin(Math.PI * t);
            });
            if (this.motion) await wait(110);
          }
          if (this.motion) await wait(500);
          break;
        }
        case "placed": {
          const seat = this.seats[event.player];
          if (!seat) break;
          let die: Die3D | null = null;
          if (event.fromHand) {
            die = seat.hand;
            seat.hand = null;
          } else if (commandDie !== null) {
            die = this.market.splice(commandDie, 1)[0] ?? null;
          }
          if (!die) break;
          die.lift = 0;
          const p = this.cellPoint(seat, event.at);
          const flight = this.fly(die, { x: p.x, y: SURFACE.mat, z: p.z }, orientation(event.value, seat.angle), { duration: 620, height: 1.4, tumble: 0 });
          if (!event.fromHand) void this.layoutMarket(320);
          await flight;
          seat.dice.set(key(event.at), die);
          this.placeMarkAt(this.lastMark, p, seat.angle, 1);
          await this.land(die);
          this.syncSeat(seat, after.players[event.player]!, true, false);
          const lines = newLines(before.players[event.player]!.score, after.players[event.player]!.score);
          if (lines.length > 0) {
            this.options.sounds.play("line");
            await this.flashLines(seat, after.players[event.player]!, lines);
            const gained = pointsGained(before, after, event.player);
            const text = gained > 0 ? `+${gained} ${gained === 1 ? "ponto" : "pontos"}` : lines.length === 1 ? "Linha completa" : "Linhas completas";
            this.float(text, p, { height: 1.4 });
          }
          this.updateLabels(after);
          break;
        }
        case "kept": {
          const seat = this.seats[event.player];
          if (!seat || commandDie === null) break;
          // "Place from hand" took the die of the market after the die of the hand was put: the same index.
          const die = this.market.splice(commandDie, 1)[0];
          if (!die) break;
          die.lift = 0;
          const p = this.handPoint(seat);
          void this.layoutMarket(320);
          await this.fly(die, { x: p.x, y: SURFACE.plate, z: p.z }, orientation(event.value, seat.angle), { duration: 560, height: 1.2 });
          seat.hand = die;
          await this.land(die, 0.8);
          break;
        }
        case "rerolled": {
          const seat = this.seats[event.player];
          if (!seat) break;
          const back = seat.hand;
          seat.hand = null;
          if (back) {
            back.lift = 0;
            const count = this.market.length + 1;
            const to = marketSpot(count - 1, count);
            this.market.push(back);
            void this.layoutMarket(300);
            await this.fly(back, { x: to.x, y: SURFACE.tray, z: to.z }, back.tumbler.quaternion.clone(), { duration: 480, height: 1.1 });
          }
          // Every die of the market jumps and lands on its new number.
          this.options.sounds.play("roll");
          this.setMarks({ ...NO_MARKS, active: before.toMove, last: this.marks.last });
          for (const tag of this.sealTags) tag.visible = false;
          const throws = this.market.map((die, i) => {
            const value = event.market[i] ?? die.value;
            const from = die.root.position.clone();
            const end = orientation(value, this.marketYaw());
            die.value = value;
            return this.fly(die, { x: from.x, y: SURFACE.tray, z: from.z }, end, { duration: 620 + Math.random() * 200, height: 0.9 + Math.random() * 0.6, tumble: 2 + Math.random() });
          });
          await Promise.all(throws);
          this.options.sounds.play("land");
          this.updateSealTags(after);
          break;
        }
        case "passed": {
          const seat = this.seats[event.player];
          if (!seat) break;
          this.float("Passou", seatToTable(seat.index, this.seatCount, { x: 0, z: 0 }), { background: COLORS.ink, height: 1 });
          if (this.motion) await wait(650);
          break;
        }
        case "sealBonus": {
          const seat = this.seats[event.player];
          if (!seat) break;
          const die = new Die3D(null, event.value, this.assets);
          die.root.position.copy(this.bagMouth());
          die.tumbler.quaternion.random();
          this.world.add(die.root);
          bag--;
          progress.onBag?.(bag);
          this.setBag(bag);
          this.puffBag();
          const p = this.handPoint(seat);
          await this.fly(die, { x: p.x, y: SURFACE.plate, z: p.z }, orientation(event.value, seat.angle), { duration: 820, height: 2.2, tumble: 1.5 });
          seat.hand = die;
          await this.land(die, 0.8);
          this.float("Bônus do selo", p, { background: SEAL_COLORS[seat.index]!, height: 1 });
          break;
        }
        case "gameOver":
          break;
      }
    }
    // Whatever the animations left, the table is now the one of `after`.
    this.show(after, marks);
  }

  /** The new complete lines light up, one after the other. */
  private async flashLines(seat: Seat, player: PlayerView, lines: readonly import("@wire/Line").Line[]): Promise<void> {
    for (const line of lines) {
      const cells = lineCells(player, line);
      const dice = cells.map((at) => seat.dice.get(key(at))).filter((d): d is Die3D => d !== undefined);
      await this.run(this.ms(420), (t) => {
        dice.forEach((die, i) => {
          const local = Math.min(1, Math.max(0, t * 1.6 - i * 0.18));
          die.lift = 0.3 * Math.sin(Math.PI * local);
        });
      });
      for (const die of dice) die.lift = 0;
    }
  }

  /** Marks the lines that scored at the end of the game, with their points over each. */
  showFinal(view: View): void {
    for (const seat of this.seats) {
      const player = view.players[seat.index];
      if (!player) continue;
      for (const scored of player.score.lines) {
        const cells = lineCells(player, scored.line);
        const last = cells[cells.length - 1]!;
        // The points float just past the end of the line.
        const local = scored.line.kind === "row" ? { x: last.col + 0.9, z: last.row } : { x: last.col, z: last.row + 0.9 };
        const at = seatToTable(seat.index, this.seatCount, local);
        this.float(`+${scored.points}`, at, { height: 0.9, duration: 2600 });
      }
    }
  }

  // --- Camera and drawing ----------------------------------------------------

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    this.loop = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    const k = 1 - Math.exp(-dt * 7);
    const settle = (value: number, goal: number) => (Math.abs(goal - value) < 1e-4 ? goal : value + (goal - value) * k);
    const moving = this.yaw !== this.yawGoal || this.pitch !== this.pitchGoal || this.zoom !== this.zoomGoal;
    if (moving) {
      this.yaw = settle(this.yaw, this.yawGoal);
      this.pitch = settle(this.pitch, this.pitchGoal);
      this.zoom = settle(this.zoom, this.zoomGoal);
      this.dirty = true;
    }
    // The seat to move glows, gently.
    const active = this.marks.active;
    for (const seat of this.seats) {
      const material = seat.glow.material as MeshBasicMaterial;
      const target = seat.index === active ? 0.42 + 0.18 * Math.sin(now / 420) : 0;
      if (Math.abs(material.opacity - target) > 0.003) {
        material.opacity = target;
        this.dirty = true;
      }
    }
    if (!this.dirty && this.running === 0) return;
    this.dirty = false;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  };

  private updateCamera(): void {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const insets = this.options.insets();
    const camKey = `${this.yaw}|${this.pitch}|${this.zoom}|${width}|${height}|${insets.top}|${insets.bottom}|${insets.left}|${insets.right}`;
    if (camKey === this.cameraKey) return;
    this.cameraKey = camKey;
    const camera = this.camera;
    camera.aspect = width / height;
    // The box of the canvas left free by the panels, in normalized device coordinates.
    const box = {
      left: -1 + (2 * insets.left) / width + 0.04,
      right: 1 - (2 * insets.right) / width - 0.04,
      bottom: -1 + (2 * insets.bottom) / height + 0.04,
      top: 1 - (2 * insets.top) / height - 0.04,
    };
    const dir = new Vector3(Math.sin(this.yaw) * Math.sin(this.pitch), Math.cos(this.pitch), Math.cos(this.yaw) * Math.sin(this.pitch));
    const toward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const viewerMat = seatToTable(this.viewer, this.seatCount, { x: 0, z: 0 });
    // Zooming in moves the eye towards the window of the viewer.
    const focus = Math.min(1, Math.max(0, (1 - this.zoom) / (1 - ZOOM.min)));
    // On a tall and narrow screen the whole table would be tiny: frame the window of the viewer and the market.
    const points = width / height < 0.85 ? this.closePoints() : this.fitPoints;
    let pan = 0;
    let side = 0;
    let distance = 30;
    const place = (d: number, p: number, q: number) => {
      const target = toward.clone().multiplyScalar(p).addScaledVector(right, q);
      target.x += (viewerMat.x - target.x) * focus;
      target.z += (viewerMat.z - target.z) * focus;
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
      let high = 160;
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        if (fits(extent(mid, pan, side))) high = mid;
        else low = mid;
      }
      distance = high;
      // One step of Newton for each way the target slides, with the slope measured.
      const e = extent(distance, pan, side);
      const dy = extent(distance, pan + 0.5, side).cy - e.cy;
      if (Math.abs(dy) > 1e-6) pan -= ((e.cy - goal.y) / dy) * 0.5;
      const e2 = extent(distance, pan, side);
      const dx = extent(distance, pan, side + 0.5).cx - e2.cx;
      if (Math.abs(dx) > 1e-6) side -= ((e2.cx - goal.x) / dx) * 0.5;
    }
    place(distance * this.zoom, pan, side);
    camera.near = Math.max(0.5, distance * this.zoom - 40);
    camera.far = distance * this.zoom + 60;
    camera.updateProjectionMatrix();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.cameraKey = "";
    this.dirty = true;
  }

  /** Frames the table again: the panels of the page changed size. */
  refit(): void {
    this.cameraKey = "";
    this.dirty = true;
  }

  /** Where a pick is on the page, in CSS pixels: for the tests in the browser. */
  screenOf(pick: Pick): { x: number; y: number } | null {
    let point: Vector3 | null = null;
    if (pick.kind === "market") {
      const die = this.market[pick.die];
      if (die) point = die.root.position.clone().setY(0.4);
    } else {
      const seat = this.seats[pick.seat];
      if (!seat) return null;
      const p = pick.kind === "hand" ? this.handPoint(seat) : this.cellPoint(seat, pick.at);
      point = new Vector3(p.x, 0.1, p.z);
    }
    if (!point) return null;
    this.updateCamera();
    const ndc = point.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((ndc.x + 1) / 2) * rect.width, y: rect.top + ((1 - ndc.y) / 2) * rect.height };
  }

  // --- Pointer ---------------------------------------------------------------

  private ndc(event: { clientX: number; clientY: number }): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
  }

  private pick(event: { clientX: number; clientY: number }): Pick | null {
    this.raycaster.setFromCamera(this.ndc(event), this.camera);
    const bodies = [...this.market.map((d) => d.body), ...this.seats.flatMap((s) => (s.hand ? [s.hand.body] : []))];
    const hit = this.raycaster.intersectObjects(bodies, false)[0]?.object.userData.die as Die3D | undefined;
    if (hit) {
      const die = this.market.indexOf(hit);
      if (die >= 0) return { kind: "market", die };
      const seat = this.seats.find((s) => s.hand === hit);
      if (seat) return { kind: "hand", seat: seat.index };
    }
    const point = this.raycaster.ray.intersectPlane(GROUND, new Vector3());
    if (!point) return null;
    for (const seat of this.seats) {
      const local = tableToSeat(seat.index, this.seatCount, { x: point.x, z: point.z });
      const plate = Math.abs(local.x - HAND_AT.x) <= PLATE_W / 2 && Math.abs(local.z - HAND_AT.z) <= PLATE_W * 0.65;
      if (plate) return { kind: "hand", seat: seat.index };
      const at = cellAt(local);
      if (at) return { kind: "cell", seat: seat.index, at };
    }
    // A die of the market may be picked on the tray just around it.
    let best = -1;
    let closest = 0.6;
    this.market.forEach((die, i) => {
      const d = Math.hypot(die.root.position.x - point.x, die.root.position.z - point.z);
      if (d < closest) {
        best = i;
        closest = d;
      }
    });
    return best >= 0 ? { kind: "market", die: best } : null;
  }

  private setHover(pick: Pick | null): void {
    const same = JSON.stringify(pick) === JSON.stringify(this.hovered);
    if (same) return;
    this.hovered = pick;
    this.updateHover();
  }

  /** Over a cell where the selected die may go: the die shows there, and its row and column light up. */
  private updateHover(): void {
    const pick = this.hovered;
    const marks = this.marks;
    const seat = marks.active !== null ? this.seats[marks.active] : undefined;
    const onTarget = pick?.kind === "cell" && seat && pick.seat === seat.index && marks.targets.some((t) => t.row === pick.at.row && t.col === pick.at.col);
    if (!onTarget || !seat || pick?.kind !== "cell" || marks.ghostValue === null) {
      this.ghost.root.visible = false;
      this.hoverMark.visible = this.hoverRow.visible = this.hoverCol.visible = false;
      this.dirty = true;
      return;
    }
    const p = this.cellPoint(seat, pick.at);
    this.ghost.root.visible = true;
    this.ghost.root.position.set(p.x, SURFACE.mat, p.z);
    this.ghost.show(marks.ghostValue, seat.angle);
    this.hoverMark.visible = false;
    const b = seat.bounds;
    const row = seatToTable(seat.index, this.seatCount, { x: (b.left + b.right) / 2, z: pick.at.row });
    this.placeMarkAt(this.hoverRow, row, seat.angle, 1);
    this.hoverRow.scale.set(b.right - b.left + 1, 1, 1);
    const col = seatToTable(seat.index, this.seatCount, { x: pick.at.col, z: (b.top + b.bottom) / 2 });
    this.placeMarkAt(this.hoverCol, col, seat.angle, 1);
    this.hoverCol.scale.set(1, 1, b.bottom - b.top + 1);
    this.dirty = true;
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
    this.press = { x: event.clientX, y: event.clientY, moved: false, yaw: this.yawGoal, pitch: this.pitchGoal };
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
      if (press.moved) {
        // Dragging turns the table and leans the camera.
        this.yawGoal = press.yaw - (dx / Math.max(320, this.canvas.clientWidth)) * Math.PI * 1.2;
        this.pitchGoal = Math.min(PITCH.max, Math.max(PITCH.min, press.pitch + (dy / Math.max(320, this.canvas.clientHeight)) * 1.2));
        this.yaw = this.yawGoal;
        this.pitch = this.pitchGoal;
        this.dirty = true;
        this.canvas.style.cursor = "grabbing";
        return;
      }
    }
    if (event.pointerType === "touch") return;
    const pick = this.pick(event);
    this.setHover(pick);
    this.canvas.style.cursor = pick && this.options.canPick(pick) ? "pointer" : "default";
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

  private readonly onPointerLeave = () => {
    this.setHover(null);
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
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("dblclick", this.onDoubleClick);
    for (const floater of [...this.floaters]) this.dropFloater(floater);
    this.assets.dispose();
    for (const m of Object.values(this.markMaterials)) m.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const g of this.geometries) g.dispose();
    this.markGeometry.dispose();
    this.cellGeometry.dispose();
    this.lineGeometry.dispose();
    for (const sprite of [this.bagLabel, ...this.seats.map((s) => s.label)]) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    this.renderer.dispose();
    this.canvas.remove();
  }
}

