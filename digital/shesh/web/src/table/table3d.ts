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
import type { Event, Move, View } from "../engine/game";
import { destinationOf, sourceOf, type Source } from "../logic/selection";
import { floatText } from "../logic/texts";
import { COLORS, seatColor } from "../ui/svg";
import { BINARY, binaryValue, Die3D, DieAssets, orientation } from "./dice";
import { drawBoard, drawLabel, drawMark, drawTrayTop, drawWood, shade, type MarkKind } from "./drawing";
import {
  type Arrangement,
  arrangementFor,
  BINARY_DICE,
  binaryFaces,
  binarySpot,
  BOARD_HALF,
  cellOf,
  DIE_SIZE,
  EXIT,
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

/** What a click or a tap on the table hits, for the player to move: a die of the reserve, or a square of the track. */
export type Pick = { readonly kind: "reserve"; readonly value: number } | { readonly kind: "square"; readonly square: number };

/** What the table marks, besides the dice: the turn, the dice that can move, the selection and where it goes. */
export interface TableMarks {
  /** The seat to move, lit on the table; null once the game is over. */
  readonly active: number | null;
  /** The dice of the active seat that can move now. */
  readonly sources: readonly Source[];
  /** The die chosen to move. */
  readonly selected: Source | null;
  /** The square where the chosen die would stop (`EXIT` for leaving the board). */
  readonly target: number | null;
  /** The last move: where the die started (null when it came from the reserve) and where it stopped. */
  readonly last: { readonly seat: number; readonly from: number | null; readonly to: number } | null;
}

export const NO_MARKS: TableMarks = { active: null, sources: [], selected: null, target: null, last: null };

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
}

const BOARD_Y = 0.05;
const TRAY_Y = 0.045;
const MARK_Y = 0.075;
/** The camera leans at a fixed angle from the vertical; only the zoom and the seat change the view. */
const PITCH = 0.6;
/** How high a die waits over the die it landed on, until the events say what happened. */
const HOVER = 0.85;
const ZOOM = { min: 0.42, max: 1.18 } as const;
const UP = new Vector3(0, 1, 0);
const GROUND = new Plane(new Vector3(0, 1, 0), 0);

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

const TRAYS: readonly TrayKind[] = ["reserve", "points"];

/**
 * The table in 3D: the board of the Seks with the track of the Shesh, the
 * dice of both players on it, a reserve tray and a points tray (the dice that
 * left the track) for each, and the four binary dice rolled on the free rows
 * on the side of the player to move. It shows a `View` at once, or plays the
 * events of a command as animations, and reports the picks of the pointer.
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
  private readonly sourceMarks: Mesh[] = [];
  private readonly targetMark: Mesh;
  private readonly selectedMark: Mesh;
  private readonly originMark: Mesh;
  private readonly lastMark: Mesh;

  // What the table shows.
  /** `track[seat][square]`, squares 1 to 17. */
  private track: (Die3D | null)[][] = [this.emptyTrack(), this.emptyTrack()];
  /** The dice waiting to enter, smallest first. */
  private reserve: Die3D[][] = [[], []];
  /** The dice that left the track, in the order they left. */
  private points: Die3D[][] = [[], []];
  private binary: Die3D[] = [];
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

    this.targetMark = this.newMark("ring");
    this.selectedMark = this.newMark("selected");
    this.originMark = this.newMark("origin", seatColor(0));
    this.lastMark = this.newMark("last", seatColor(0));

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

  private emptyTrack(): (Die3D | null)[] {
    return Array.from({ length: EXIT }, () => null);
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

  /** The board of the Seks: a slab with the frame, the grid and the track on top. */
  private buildBoard(): void {
    const layout = frameLayout();
    const map = this.texture(drawBoard(2048, layout));
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
    return { reserve: make(), points: make() };
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

  private newMark(kind: MarkKind, accent: string = COLORS.shesh): Mesh {
    const mesh = new Mesh(this.markGeometry, this.markMaterial(kind, accent));
    mesh.renderOrder = 2;
    mesh.visible = false;
    this.world.add(mesh);
    return mesh;
  }

  /** Puts everything that depends on the arrangement where it belongs. */
  private applyArrangement(arrangement: Arrangement): void {
    this.arrangement = arrangement;
    const size = traySize(arrangement);
    this.trays.forEach((seatTrays, seat) => {
      for (const kind of TRAYS) {
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
          const accent = kind === "reserve" ? seatColor(seat) : shade(seatColor(seat), -0.2);
          const map = this.texture(drawTrayTop(Math.round(size.width * 96), Math.round(size.depth * 96), accent));
          const felt = this.material(new MeshLambertMaterial({ map }));
          const edge = this.material(new MeshStandardMaterial({ color: shade(seatColor(seat), -0.55), roughness: 0.8 }));
          tray.mesh.material = [edge, edge, felt, edge, edge, edge];
        }
        // The label sits on the edge of the tray away from the board in the tall arrangement, and between the trays in the wide one.
        const outward = seat === 0 ? 1 : -1;
        const toward = arrangement === "wide" ? -1 : 1;
        tray.label.position.set(c.x, 0.4, c.z + toward * outward * (size.depth / 2 + 0.55));
      }
    });
    this.cameraKey = "";
    // The dice of the trays move to the spots of the new arrangement, wherever the animations left them.
    for (let seat = 0; seat < 2; seat++) {
      this.reserve[seat]!.forEach((die, i) => this.put(die, this.reservePoint(seat, i)));
      this.points[seat]!.forEach((die, i) => this.put(die, this.pointsPoint(seat, i)));
    }
    this.dirty = true;
  }

  private put(die: Die3D, at: Point3): void {
    die.root.position.set(at.x, at.y, at.z);
  }

  // --- What the screen tells -------------------------------------------------

  /**
   * Shows `view` at once, without animation: after an undo and after each
   * animation. `left` are the dice that left the track, per player.
   */
  show(view: View, left: readonly (readonly number[])[], marks: TableMarks): void {
    this.view = view;
    this.clearDice();
    view.players.forEach((player, seat) => {
      player.track.forEach((value, square) => {
        if (value > 0 && square >= 1 && square < EXIT) this.track[seat]![square] = this.newDie(seat, value, this.trackPoint(seat, square));
      });
      this.reserve[seat] = player.reserve.map((value, i) => this.newDie(seat, value, this.reservePoint(seat, i)));
      this.points[seat] = (left[seat] ?? []).map((value, i) => this.newDie(seat, value, this.pointsPoint(seat, i)));
    });
    this.showBinary(view);
    this.updateLabels(view);
    this.setMarks(marks, view);
    this.dirty = true;
  }

  private clearDice(): void {
    const all = [...this.track.flat(), ...this.reserve.flat(), ...this.points.flat(), ...this.binary];
    for (const die of all) if (die) this.world.remove(die.root);
    this.track = [this.emptyTrack(), this.emptyTrack()];
    this.reserve = [[], []];
    this.points = [[], []];
    this.binary = [];
  }

  private newDie(color: number, value: number, at: Point3, yaw = seatAngle(color)): Die3D {
    const die = new Die3D(color, value, this.assets);
    this.put(die, at);
    die.show(value, yaw);
    this.world.add(die.root);
    return die;
  }

  /** The four binary dice at rest, showing the roll of the view on the side of the player to move. */
  private showBinary(view: View): void {
    for (const die of this.binary) this.world.remove(die.root);
    this.binary = [];
    if (view.end !== null) return;
    binaryFaces(view.roll, view.turn).forEach((one, i) => {
      const spot = binarySpot(view.toMove, i);
      this.binary.push(this.newDie(BINARY, binaryValue(one ? 1 : 0, i), { x: spot.x, y: BOARD_Y, z: spot.z }, 0));
    });
  }

  private trackPoint(seat: number, square: number): Point3 {
    const p = squareSpot(seat, square);
    return { x: p.x, y: BOARD_Y, z: p.z };
  }

  private reservePoint(seat: number, slot: number): Point3 {
    const p = traySpot(seat, "reserve", Math.min(slot, TRAY_SLOTS - 1), this.arrangement);
    return { x: p.x, y: TRAY_Y, z: p.z };
  }

  private pointsPoint(seat: number, slot: number): Point3 {
    const p = traySpot(seat, "points", Math.min(slot, TRAY_SLOTS - 1), this.arrangement);
    return { x: p.x, y: TRAY_Y, z: p.z };
  }

  private updateLabels(view: View): void {
    this.trays.forEach((seatTrays, seat) => {
      const player = view.players[seat];
      if (!player) return;
      const active = view.end === null && view.toMove === seat;
      const won = view.winner === seat;
      const points = player.points === 1 ? "1 ponto" : `${player.points} pontos`;
      const texts: Record<TrayKind, string> = { reserve: `Reserva · ${player.reserve.length}`, points: `${this.options.names[seat] ?? ""} · ${points}${won ? " · venceu" : ""}` };
      for (const kind of TRAYS) {
        const tray = seatTrays[kind];
        const highlight = kind === "points" && (active || won);
        const key = `${texts[kind]}|${highlight}`;
        if (key === tray.labelKey) continue;
        tray.labelKey = key;
        this.setLabel(tray.label, texts[kind], kind === "points" ? 0.72 : 0.6, highlight ? { background: seatColor(seat), color: "#FFFFFF" } : {});
      }
    });
    this.dirty = true;
  }

  /** The die of a source of the active seat. */
  private dieOf(seat: number, source: Source): Die3D | undefined {
    return source.kind === "reserve" ? this.reserve[seat]?.find((die) => die.value === source.value) : this.track[seat]?.[source.square] ?? undefined;
  }

  setMarks(marks: TableMarks, view: View | null = this.view): void {
    this.marks = marks;
    if (view) this.view = view;
    const active = marks.active;
    const accent = active !== null ? seatColor(active) : COLORS.shesh;
    // The marks lie on the top face of a die, so they are seen over it.
    const topOf = (die: Die3D) => die.root.position.y + die.tumbler.position.y + DIE_SIZE / 2 + 0.03;
    const selectedDie = active !== null && marks.selected ? this.dieOf(active, marks.selected) : undefined;
    for (const seat of [0, 1]) for (const die of [...this.reserve[seat]!, ...this.track[seat]!]) if (die) die.lift = 0;
    if (selectedDie) selectedDie.lift = 0.3;
    if (selectedDie) this.placeMark(this.selectedMark, selectedDie.root.position, 1.12, topOf(selectedDie));
    else this.selectedMark.visible = false;
    // Brackets on the dice that can move.
    const movable = active === null ? [] : marks.sources.flatMap((source) => {
      const die = this.dieOf(active, source);
      return die ? [die] : [];
    });
    while (this.sourceMarks.length < movable.length) this.sourceMarks.push(this.newMark("claim"));
    this.sourceMarks.forEach((mesh, i) => {
      const die = movable[i];
      if (!die) {
        mesh.visible = false;
        return;
      }
      mesh.material = this.markMaterial("claim", accent);
      this.placeMark(mesh, die.root.position, 1.05, topOf(die) + 0.01);
    });
    // The ring where the chosen die stops, over the die it would meet there.
    if (active !== null && marks.target !== null) {
      const spot = squareSpot(active, marks.target);
      const meets = marks.target < EXIT ? this.dieAtCell(spot.x, spot.z) : undefined;
      this.targetMark.material = this.markMaterial("ring", accent);
      this.placeMark(this.targetMark, spot, 1, meets ? topOf(meets) + 0.02 : MARK_Y);
    } else this.targetMark.visible = false;
    // The last move: a dashed square where the die started and corners where it stopped.
    const last = marks.last;
    if (last) {
      this.lastMark.material = this.markMaterial("last", seatColor(last.seat));
      this.placeMark(this.lastMark, squareSpot(last.seat, last.to), 1);
      if (last.from !== null) {
        this.originMark.material = this.markMaterial("origin", seatColor(last.seat));
        this.placeMark(this.originMark, squareSpot(last.seat, last.from), 1, MARK_Y - 0.01);
      } else this.originMark.visible = false;
    } else {
      this.lastMark.visible = false;
      this.originMark.visible = false;
    }
    this.dirty = true;
  }

  /** The die of either player standing on the cell at (x, z), if any. */
  private dieAtCell(x: number, z: number): Die3D | undefined {
    for (const seat of [0, 1]) {
      for (const die of this.track[seat]!) {
        if (die && Math.abs(die.root.position.x - x) < 0.5 && Math.abs(die.root.position.z - z) < 0.5) return die;
      }
    }
    return undefined;
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

  /** Dice slide to their places, all together. */
  private async slide(moves: readonly { die: Die3D; to: Point3 }[], duration: number, height = 0): Promise<void> {
    const list = moves.map((m) => ({ ...m, from: m.die.root.position.clone() }));
    await this.run(this.ms(duration), (t) => {
      const e = easeInOut(t);
      for (const { die, to, from } of list) {
        die.root.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e + height * Math.sin(Math.PI * t), from.z + (to.z - from.z) * e);
      }
    });
  }

  private async relayoutReserve(seat: number, duration = 300): Promise<void> {
    await this.slide(this.reserve[seat]!.map((die, i) => ({ die, to: this.reservePoint(seat, i) })), duration);
  }

  /** A text that rises over a point of the table and fades. */
  private float(text: string, at: { x: number; z: number }, options: { color?: string; background?: string; height?: number; duration?: number } = {}): void {
    const canvas = drawLabel(text, { px: 56, color: options.color ?? "#FFFFFF", background: options.background ?? COLORS.shesh });
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

  /** The dice lift one after the other, as a wave. */
  private async wave(dice: readonly Die3D[], height = 0.45): Promise<void> {
    const waves = dice.map((die, i) =>
      (async () => {
        await this.pause(i * 110);
        await this.run(this.ms(360), (t) => {
          die.lift = height * Math.sin(Math.PI * t);
        });
        die.lift = 0;
      })(),
    );
    await Promise.all(waves);
  }

  /**
   * Shows what a move is about to do, before it plays: the die of a bot
   * lifts and a ring shows where it stops, so a play of a bot can be followed.
   */
  async preview(move: Move, seat: number): Promise<void> {
    const view = this.view;
    if (!this.motion || !view) return;
    const source = sourceOf(move);
    if (!source) return;
    this.setMarks({ ...NO_MARKS, active: seat, selected: source, target: destinationOf(view, move), last: this.marks.last });
    this.options.sounds.play("pick");
    await wait(650);
  }

  /**
   * Plays the events as animations, from the table as it is, and leaves the
   * table as `after` with `marks`. `progress` follows the events as they show.
   */
  async animate(events: readonly Event[], after: View, left: readonly (readonly number[])[], marks: TableMarks, progress: Progress = {}): Promise<void> {
    this.setMarks({ ...NO_MARKS, active: this.marks.active, last: this.marks.last }, this.view);
    // The die in the hands of the move, and the dice it met where it landed.
    let mover: Die3D | null = null;
    let met: { own: Die3D | null; theirs: Die3D | null } = { own: null, theirs: null };
    for (const event of events) {
      progress.onEvent?.(event);
      const text = floatText(event);
      switch (event.kind) {
        case "rolled":
          await this.rollBinary(event.roll, event.player, after.turn, after.end !== null);
          break;
        case "entered": {
          const die = this.takeFromReserve(event.player, event.value);
          if (!die) break;
          void this.relayoutReserve(event.player, 300);
          mover = die;
          met = await this.arrive(event.player, die, event.square, 1.5);
          break;
        }
        case "moved": {
          const die = this.track[event.player]![event.from] ?? null;
          if (!die) break;
          this.track[event.player]![event.from] = null;
          mover = die;
          met = await this.arrive(event.player, die, event.to, 0.9 + 0.25 * (event.to - event.from));
          break;
        }
        case "overtook":
          if (mover) {
            mover.show(event.value, seatAngle(event.player));
            this.float(text!, mover.root.position, { background: seatColor(event.player), height: 1.5 });
            await this.wave([mover], 0.35);
          }
          break;
        case "fused": {
          if (mover && met.own) {
            const target = met.own;
            await this.fly(mover, { x: target.root.position.x, y: BOARD_Y + 0.3, z: target.root.position.z }, mover.tumbler.quaternion.clone(), { duration: 260, height: 0 });
            this.world.remove(mover.root);
            target.show(event.value, seatAngle(event.player));
            this.options.sounds.play("line");
            this.float(text!, target.root.position, { background: seatColor(event.player), height: 1.5 });
            await this.wave([target], 0.4);
          }
          mover = null;
          break;
        }
        case "traded": {
          const other = 1 - event.player;
          this.track[other]![event.square] = null;
          this.float(text!, squareSpot(event.player, event.square), { background: COLORS.ink, height: 1.5 });
          const moves: Promise<void>[] = [];
          if (mover) moves.push(this.sendToReserve(event.player, mover, event.value));
          if (met.theirs) moves.push(this.sendToReserve(other, met.theirs, event.taken));
          await Promise.all(moves);
          mover = null;
          break;
        }
        case "captured": {
          const other = 1 - event.player;
          this.track[other]![event.square] = null;
          this.float(text!, squareSpot(event.player, event.square), { background: COLORS.rosette, height: 1.5 });
          const moves: Promise<void>[] = [];
          if (met.theirs) moves.push(this.sendToReserve(other, met.theirs, event.taken));
          if (mover) {
            const die = mover;
            die.show(event.value, seatAngle(event.player));
            this.track[event.player]![event.square] = die;
            const to = this.trackPoint(event.player, event.square);
            moves.push(this.fly(die, to, orientation(event.value, seatAngle(event.player)), { duration: 300, height: 0.2 }).then(() => this.land(die)));
          }
          // The die the capture earns appears where it happened and goes to the reserve.
          const earned = this.newDie(event.player, event.taken, { ...this.trackPoint(event.player, event.square), y: BOARD_Y + HOVER });
          moves.push(this.sendToReserve(event.player, earned, event.taken));
          await Promise.all(moves);
          mover = null;
          break;
        }
        case "touched": {
          const die = this.track[1 - event.player]![event.square];
          if (die) {
            die.show(event.value, seatAngle(1 - event.player));
            this.float(text!, squareSpot(event.player, event.square), { background: seatColor(event.player), height: 1.5 });
            await this.wave([die], 0.35);
          }
          break;
        }
        case "exited": {
          const die = mover;
          mover = null;
          if (!die) break;
          die.show(event.value, seatAngle(event.player));
          this.options.sounds.play("line");
          this.float(text!, die.root.position, { background: seatColor(event.player), height: 1.6 });
          await this.pause(300);
          const slot = this.points[event.player]!.length;
          this.points[event.player]!.push(die);
          await this.fly(die, this.pointsPoint(event.player, slot), orientation(event.value, seatAngle(event.player)), { duration: 700, height: 1.6 });
          await this.land(die);
          break;
        }
        case "passed":
          this.float(text!, binarySpot(event.player, 1.5), { background: COLORS.ink, height: 1 });
          await this.pause(650);
          break;
        case "extraTurn":
        case "ended":
          break;
      }
    }
    // Whatever the animations left, the table is now the one of `after`.
    this.show(after, left, marks);
  }

  /** Takes the smallest die of value `value` out of the reserve of `seat`. */
  private takeFromReserve(seat: number, value: number): Die3D | undefined {
    const list = this.reserve[seat]!;
    const index = list.findIndex((die) => die.value === value);
    return index >= 0 ? list.splice(index, 1)[0] : undefined;
  }

  /**
   * A die of `seat` flies to `square`. If it meets a die there, it waits above it for the events that say
   * what happened, and the dice met are returned; if not, it lands.
   */
  private async arrive(seat: number, die: Die3D, square: number, height: number): Promise<{ own: Die3D | null; theirs: Die3D | null }> {
    const to = this.trackPoint(seat, square);
    const own = square < EXIT ? (this.track[seat]![square] ?? null) : null;
    const theirs = square < EXIT && square >= 5 && square <= 15 ? (this.track[1 - seat]![square] ?? null) : null;
    const meets = own !== null || theirs !== null || square >= EXIT;
    await this.fly(die, { ...to, y: to.y + (meets ? HOVER : 0) }, orientation(die.value, seatAngle(seat)), { duration: 420 + 60 * height, height: 0.6 + 0.4 * Math.min(height, 2.5) });
    if (!meets) {
      this.track[seat]![square] = die;
      await this.land(die);
    } else await this.pause(250);
    return { own, theirs };
  }

  /** A die goes to the reserve of `seat` showing `value`, and the dice there settle in order. */
  private async sendToReserve(seat: number, die: Die3D, value: number): Promise<void> {
    die.show(value, seatAngle(seat));
    const list = this.reserve[seat]!;
    list.push(die);
    list.sort((a, b) => a.value - b.value);
    const others = list.flatMap((other, i) => (other === die ? [] : [{ die: other, to: this.reservePoint(seat, i) }]));
    void this.slide(others, 360);
    await this.fly(die, this.reservePoint(seat, list.indexOf(die)), orientation(value, seatAngle(seat)), { duration: 650, height: 1.4 });
    await this.land(die, 0.6);
  }

  /** The binary dice are thrown on the free rows of the side of `seat`, showing `roll` ones. */
  private async rollBinary(roll: number, seat: number, turn: number, over: boolean): Promise<void> {
    for (const die of this.binary) this.world.remove(die.root);
    this.binary = [];
    if (over) return;
    this.options.sounds.play("roll");
    const faces = binaryFaces(roll, turn);
    const flights: Promise<void>[] = [];
    for (let i = 0; i < BINARY_DICE; i++) {
      const spot = binarySpot(seat, i);
      const to = { x: spot.x, y: BOARD_Y, z: spot.z };
      const die = new Die3D(BINARY, 1, this.assets);
      die.root.position.set(to.x + (Math.random() - 0.5) * 3, 4.5, to.z + (seat === 0 ? 1 : -1) * 4);
      die.tumbler.quaternion.random();
      this.world.add(die.root);
      this.binary.push(die);
      const value = binaryValue(faces[i] ? 1 : 0, i);
      die.value = value;
      flights.push(this.fly(die, to, orientation(value, 0), { duration: 750 + Math.random() * 200, height: 1.2 + Math.random() * 0.6, tumble: 2.5 }).then(() => this.land(die, 0.8)));
      await this.pause(70);
    }
    await Promise.all(flights);
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
    if (this.marks.sources.length > 0) {
      const s = 1.05 + 0.07 * Math.sin(now / 260);
      for (const mesh of this.sourceMarks) if (mesh.visible) mesh.scale.set(s, 1, s);
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

  /** Where a pick is on the page, in CSS pixels: for the tests in the browser. */
  screenOf(pick: Pick, seat: number): { x: number; y: number } | null {
    let point: Vector3 | null = null;
    if (pick.kind === "reserve") {
      const die = this.reserve[seat]?.find((d) => d.value === pick.value);
      if (die) point = die.root.position.clone().setY(0.4);
    } else {
      const p = squareSpot(seat, pick.square);
      point = new Vector3(p.x, 0.3, p.z);
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

  /** What is under the pointer, for the active seat: one of its reserve dice, or a square of its track. */
  private pick(event: { clientX: number; clientY: number }): Pick | null {
    const seat = this.marks.active;
    if (seat === null) return null;
    this.raycaster.setFromCamera(this.ndc(event), this.camera);
    const bodies: Mesh[] = [];
    for (const dice of [...this.reserve, ...this.track]) for (const die of dice) if (die) bodies.push(die.body);
    const hit = this.raycaster.intersectObjects(bodies, false)[0]?.object.userData.die as Die3D | undefined;
    if (hit) {
      if (this.reserve[seat]!.includes(hit)) return { kind: "reserve", value: hit.value };
      for (const dice of this.reserve) if (dice.includes(hit)) return null;
      const cell = cellOf(hit.root.position.x, hit.root.position.z);
      const square = squareAt(seat, cell.x, cell.z);
      return square === null ? null : { kind: "square", square };
    }
    const point = this.raycaster.ray.intersectPlane(GROUND, new Vector3());
    if (!point) return null;
    const cell = cellOf(point.x, point.z);
    const square = squareAt(seat, cell.x, cell.z);
    return square === null || Math.abs(point.x) > BOARD_HALF || Math.abs(point.z) > BOARD_HALF ? null : { kind: "square", square };
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
    const pick = this.pick(event);
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

