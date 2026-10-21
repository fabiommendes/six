import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
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
import type { Command, Die, Event, Formation, View } from "../engine/game";
import { formationText, stoneLetter } from "../logic/formation";
import { slotAmong } from "../logic/feedback";
import { COLORS, seatColor, STONE_SUIT } from "../ui/svg";
import { Die3D, DieAssets, orientation } from "./dice";
import { drawBoard, drawLabel, drawMark, drawTrayTop, drawWood, shade, type MarkKind } from "./drawing";
import {
  type Arrangement,
  arrangementFor,
  bagSpot,
  boxSpot,
  claimedSpot,
  DIE_SIZE,
  extentPoints,
  frameLayout,
  handSpot,
  seatAngle,
  sideSpot,
  STONES,
  stoneSpot,
  trayCentre,
  traySize,
} from "./layout";
import { easeInOut, easeOut, tween, wait } from "./motion";
import type { Sounds } from "./sound";

/** What a click or a tap on the table hits. */
export type Pick =
  | { readonly kind: "hand"; readonly seat: number; readonly die: number }
  | { readonly kind: "stone"; readonly stone: number }
  | { readonly kind: "side"; readonly seat: number; readonly stone: number };

/** What the table marks, besides the dice: the turn, the selection and what it allows. */
export interface TableMarks {
  /** The seat to move, lit on the table; null once the game is over. */
  readonly active: number | null;
  /** The die of the hand of the active seat selected to be put. */
  readonly selectedDie: number | null;
  /** The stones where the selected die may go. */
  readonly targets: readonly number[];
  /** The stones the active seat may claim, with the text of the tag over each. */
  readonly claims: readonly { readonly stone: number; readonly text: string }[];
  /** The die of the active hand that would be lost for ever (a reroll being built). */
  readonly lost: number | null;
  /** The dice of a hand to roll again. */
  readonly rolling: { readonly seat: number; readonly dice: readonly number[] } | null;
  /** The selected die, shown over the column under the pointer. */
  readonly ghost: Die | null;
  /** The stone the page points at (a card hovered). */
  readonly focus: number | null;
  /** The die put last. */
  readonly last: { readonly seat: number; readonly stone: number } | null;
}

export const NO_MARKS: TableMarks = { active: null, selectedDie: null, targets: [], claims: [], lost: null, rolling: null, ghost: null, focus: null, last: null };

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
  /** The pointer is over a stone or the side of one (null: it left). */
  onHover(stone: number | null): void;
}

/** What the table reports while it plays the events of a command. */
export interface Progress {
  /** An event starts to show. */
  onEvent?(event: Event): void;
}

const BOARD_Y = 0.05;
const TRAY_Y = 0.045;
const MARK_Y = 0.075;
const PITCH = { initial: 0.6, min: 0.42, max: 1.12 } as const;
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

interface Seat {
  readonly index: number;
  readonly glow: Mesh;
  readonly tray: Mesh;
  readonly label: Sprite;
  labelKey: string;
  trayKey: string;
}

type Point3 = { x: number; y: number; z: number };

/**
 * The table in 3D: the board of the Seks with the nine stones and the sides
 * of the two players, a hand tray for each, the bag and the box of the dice
 * lost. It shows a `View` at once, or plays the events of a command as
 * animations, and reports the picks of the pointer.
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
  private readonly bag = new Group();
  private readonly bagLabel: Sprite;
  private readonly box = new Group();
  private readonly boxLabel: Sprite;
  private boxKey = "";
  private readonly textures: Texture[] = [];
  private readonly materials: Material[] = [];
  private readonly geometries: { dispose(): void }[] = [];
  private readonly markGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly markMaterials = new Map<string, MeshBasicMaterial>();
  private readonly floaters = new Set<Floater>();
  private readonly tokens: Mesh[] = [];
  private readonly claimTags: Sprite[] = [];
  private readonly rings: Mesh[] = [];
  private readonly rollMarks: Mesh[] = [];
  private readonly claimMarks: Mesh[] = [];
  private readonly blockMats: Mesh[] = [];
  private readonly selectedMark: Mesh;
  private readonly lostMark: Mesh;
  private readonly lastMark: Mesh;
  private readonly focusMark: Mesh;
  private readonly ghosts = new Map<string, Die3D>();
  private ghost: Die3D | null = null;

  // What the table shows.
  private stones: (Die3D | null)[] = Array.from({ length: STONES }, () => null);
  private sides: Die3D[][][] = [this.emptySides(), this.emptySides()];
  private hands: Die3D[][] = [[], []];
  private owners: (number | null)[] = Array.from({ length: STONES }, () => null);
  private view: View | null = null;
  private handSize = 7;
  private marks: TableMarks = NO_MARKS;
  private hovered: Pick | null = null;
  private arrangement: Arrangement = "wide";

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

    this.selectedMark = this.newMark("selected");
    this.lostMark = this.newMark("lost");
    this.lastMark = this.newMark("last", seatColor(0));
    this.focusMark = this.newMark("hover");

    this.buildTable();
    this.buildBoard();
    this.buildBag();
    this.buildBox();
    for (let i = 0; i < 2; i++) this.seats.push(this.buildSeat(i));
    this.bagLabel = this.newLabelSprite();
    this.boxLabel = this.newLabelSprite();
    this.setLabel(this.bagLabel, "Saco", 0.55);
    this.applyArrangement(this.arrangement);

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
      this.boxKey = "";
      this.setLabel(this.bagLabel, "Saco", 0.55);
      if (this.view) this.updateLabels(this.view);
      this.dirty = true;
    });
  }

  private emptySides(): Die3D[][] {
    return Array.from({ length: STONES }, () => []);
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

  /** The board of the Seks: a slab with the frame, the grid and the letters of the stones on top. */
  private buildBoard(): void {
    const layout = frameLayout();
    const map = this.texture(drawBoard(2048, layout, "ABCDEFGHI"));
    const top = this.material(new MeshLambertMaterial({ map }));
    const edge = this.material(new MeshStandardMaterial({ color: "#2B2A27", roughness: 0.6 }));
    const geometry = new BoxGeometry(layout.worldSize, 0.2, layout.worldSize);
    this.geometries.push(geometry);
    const slab = new Mesh(geometry, [edge, edge, top, edge, edge, edge]);
    slab.position.y = BOARD_Y - 0.1;
    slab.receiveShadow = true;
    slab.castShadow = true;
    this.world.add(slab);
    // The taken stones leave a token on their cell, in the color of who took them.
    for (let i = 0; i < STONES; i++) {
      const token = new Mesh(this.markGeometry, this.markMaterial("taken", seatColor(0)));
      token.renderOrder = 1;
      token.visible = false;
      this.world.add(token);
      this.tokens.push(token);
    }
  }

  private buildBag(): void {
    const profile = [
      [0.0, 0], [0.75, 0.02], [0.98, 0.25], [1.05, 0.62], [0.92, 1.05], [0.6, 1.35], [0.38, 1.5], [0.42, 1.62], [0.62, 1.82], [0.55, 1.9], [0.3, 1.78],
    ].map(([x, y]) => new Vector2(x!, y!));
    const geometry = new LatheGeometry(profile, 40);
    this.geometries.push(geometry);
    const cloth = this.material(new MeshStandardMaterial({ color: shade(COLORS.sia, -0.4), roughness: 0.95 }));
    const body = new Mesh(geometry, cloth);
    body.castShadow = true;
    body.receiveShadow = true;
    const cordGeometry = new TorusGeometry(0.42, 0.045, 8, 32).rotateX(Math.PI / 2);
    this.geometries.push(cordGeometry);
    const cord = new Mesh(cordGeometry, this.material(new MeshStandardMaterial({ color: "#D9C7A0", roughness: 0.8 })));
    cord.position.y = 1.52;
    cord.castShadow = true;
    this.bag.add(body, cord);
    this.world.add(this.bag);
  }

  /** The box of the dice lost for ever: an open box of dark wood. */
  private buildBox(): void {
    const wood = this.material(new MeshStandardMaterial({ color: "#5A3A22", roughness: 0.65 }));
    const inner = this.material(new MeshStandardMaterial({ color: "#2A1B10", roughness: 0.9 }));
    const size = 2.1;
    const floor = new BoxGeometry(size, 0.1, size);
    const longWall = new BoxGeometry(size, 0.55, 0.12);
    const shortWall = new BoxGeometry(0.12, 0.55, size);
    this.geometries.push(floor, longWall, shortWall);
    const base = new Mesh(floor, inner);
    base.position.y = 0.05;
    base.receiveShadow = true;
    this.box.add(base);
    for (const [geometry, x, z] of [[longWall, 0, size / 2], [longWall, 0, -size / 2], [shortWall, size / 2, 0], [shortWall, -size / 2, 0]] as const) {
      const wall = new Mesh(geometry, wood);
      wall.position.set(x, 0.3, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.box.add(wall);
    }
    this.world.add(this.box);
  }

  private buildSeat(index: number): Seat {
    const color = seatColor(index);
    const glowGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.geometries.push(glowGeometry);
    const glow = new Mesh(glowGeometry, this.material(new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false })));
    glow.position.y = 0.012;
    this.world.add(glow);
    const trayGeometry = new BoxGeometry(1, 0.06, 1);
    this.geometries.push(trayGeometry);
    const felt = this.material(new MeshStandardMaterial({ color: shade(color, -0.3), roughness: 0.9 }));
    const tray = new Mesh(trayGeometry, [felt, felt, felt, felt, felt, felt]);
    tray.receiveShadow = true;
    this.world.add(tray);
    return { index, glow, tray, label: this.newLabelSprite(), labelKey: "", trayKey: "" };
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

  private newMark(kind: MarkKind, accent: string = COLORS.sia): Mesh {
    const mesh = new Mesh(this.markGeometry, this.markMaterial(kind, accent));
    mesh.renderOrder = 2;
    mesh.visible = false;
    this.world.add(mesh);
    return mesh;
  }

  /** Puts everything that depends on the arrangement where it belongs. */
  private applyArrangement(arrangement: Arrangement): void {
    this.arrangement = arrangement;
    const size = traySize(arrangement, this.handSize);
    for (const seat of this.seats) {
      const c = trayCentre(seat.index, arrangement, this.handSize);
      seat.tray.scale.set(size.width, 1, size.depth);
      seat.tray.position.set(c.x, TRAY_Y - 0.03, c.z);
      seat.glow.scale.set(size.width + 0.7, 1, size.depth + 0.7);
      seat.glow.position.set(c.x, 0.012, c.z);
      // The felt takes a texture drawn for the proportions of the tray.
      const key = `${arrangement}:${this.handSize}`;
      if (seat.trayKey !== key) {
        seat.trayKey = key;
        const map = this.texture(drawTrayTop(Math.round(size.width * 96), Math.round(size.depth * 96), seatColor(seat.index)));
        const felt = this.material(new MeshLambertMaterial({ map }));
        const edge = this.material(new MeshStandardMaterial({ color: shade(seatColor(seat.index), -0.55), roughness: 0.8 }));
        seat.tray.material = [edge, edge, felt, edge, edge, edge];
      }
      seat.tray.rotation.y = 0;
      // The name is written outside the tray, away from the board.
      const outward = seat.index === 0 ? 1 : -1;
      seat.label.position.set(c.x, 0.4, c.z + outward * (size.depth / 2 + 0.75));
    }
    const bag = bagSpot(arrangement);
    this.bag.position.set(bag.x, 0, bag.z);
    this.bagLabel.position.set(bag.x, 2.3, bag.z);
    const box = boxSpot(arrangement);
    this.box.position.set(box.x, 0, box.z);
    this.boxLabel.position.set(box.x, 1.2, box.z);
    this.cameraKey = "";
    if (this.view) this.syncHands(this.view);
    this.dirty = true;
  }

  // --- What the screen tells -------------------------------------------------

  /** Shows `view` at once, without animation: after an undo and after each animation. */
  show(view: View, marks: TableMarks): void {
    this.view = view;
    this.handSize = view.handSize;
    this.clearDice();
    this.owners = view.stones.map((s) => s.owner);
    view.stones.forEach((stone, i) => {
      this.stones[i] = this.newDie(STONE_SUIT, stone.number, this.targetOfStone(i));
      for (const seat of [0, 1]) {
        stone.sides[seat]?.dice.forEach((die, k) => {
          this.sides[seat]![i]!.push(this.newDie(die.suit, die.value, this.targetOfSide(seat, i, k), seatAngle(seat)));
        });
      }
    });
    this.syncHands(view);
    this.updateTokens(view.stones.map((s) => s.owner));
    this.updateLabels(view);
    this.setMarks(marks, view);
    this.dirty = true;
  }

  /** The table before the preparation: no dice anywhere, to be filled by the events. */
  showEmpty(view: View): void {
    this.view = view;
    this.handSize = view.handSize;
    this.clearDice();
    this.owners = Array.from({ length: STONES }, () => null);
    this.updateTokens(this.owners);
    this.updateLabels(view);
    this.setMarks(NO_MARKS, view);
    this.applyArrangement(this.arrangement);
  }

  private clearDice(): void {
    const all = [...this.stones, ...this.sides.flat(2), ...this.hands.flat()];
    for (const die of all) if (die) this.world.remove(die.root);
    this.stones = Array.from({ length: STONES }, () => null);
    this.sides = [this.emptySides(), this.emptySides()];
    this.hands = [[], []];
  }

  private newDie(suit: number, value: number, at: Point3, yaw = 0): Die3D {
    const die = new Die3D(suit, value, this.assets);
    die.root.position.set(at.x, at.y, at.z);
    die.show(value, yaw);
    this.world.add(die.root);
    return die;
  }

  private syncHands(view: View): void {
    for (const seat of [0, 1]) {
      for (const die of this.hands[seat]!) this.world.remove(die.root);
      this.hands[seat] = (view.players[seat]?.hand ?? []).map((die, i) => this.newDie(die.suit, die.value, this.handPoint(seat, i), seatAngle(seat)));
    }
  }

  private handPoint(seat: number, slot: number): Point3 {
    const p = handSpot(seat, slot, this.arrangement, this.handSize);
    return { x: p.x, y: TRAY_Y, z: p.z };
  }

  /** The slot of a stone among those its owner has taken, in the running owners. */
  private slotOf(stone: number): number {
    const owner = this.owners[stone];
    if (owner === null || owner === undefined) return -1;
    return slotAmong(this.owners, owner, stone);
  }

  private targetOfStone(stone: number): Point3 {
    const owner = this.owners[stone];
    const slot = this.slotOf(stone);
    const p = owner !== null && owner !== undefined && slot >= 0 ? claimedSpot(owner, slot, 0) : stoneSpot(stone);
    return { x: p.x, y: BOARD_Y, z: p.z };
  }

  private targetOfSide(seat: number, stone: number, k: number): Point3 {
    const owner = this.owners[stone];
    const slot = this.slotOf(stone);
    const p = owner === seat && slot >= 0 ? claimedSpot(seat, slot, k + 1) : sideSpot(seat, stone, k);
    return { x: p.x, y: BOARD_Y, z: p.z };
  }

  /** A mat under each taken formation, in the color of its owner, so it is clear whose each one is. */
  private updateBlockMats(owners: readonly (number | null)[]): void {
    const blocks = [0, 1].flatMap((seat) => owners.flatMap((o, stone) => (o === seat ? [{ seat, slot: slotAmong(owners, seat, stone) }] : [])));
    while (this.blockMats.length < blocks.length) {
      const mesh = this.newMark("block");
      mesh.renderOrder = 0;
      this.blockMats.push(mesh);
    }
    this.blockMats.forEach((mesh, i) => {
      const block = blocks[i];
      if (!block) {
        mesh.visible = false;
        return;
      }
      const a = claimedSpot(block.seat, block.slot, 0);
      const b = claimedSpot(block.seat, block.slot, 3);
      mesh.material = this.markMaterial("block", seatColor(block.seat));
      this.placeMark(mesh, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, 2.1, BOARD_Y + 0.004);
    });
  }

  private updateTokens(owners: readonly (number | null)[]): void {
    this.updateBlockMats(owners);
    this.tokens.forEach((token, i) => {
      const owner = owners[i];
      token.visible = owner !== null && owner !== undefined;
      if (owner === null || owner === undefined) return;
      token.material = this.markMaterial("taken", seatColor(owner));
      const p = stoneSpot(i);
      token.position.set(p.x, BOARD_Y + 0.006, p.z);
    });
  }

  private updateLabels(view: View): void {
    for (const seat of this.seats) {
      const player = view.players[seat.index];
      if (!player) continue;
      const active = view.end === null && view.toMove === seat.index;
      const won = view.winners?.includes(seat.index) ?? false;
      const stones = player.stones === 1 ? "1 marco" : `${player.stones} marcos`;
      const text = `${this.options.names[seat.index] ?? ""} · ${stones}${won ? " · venceu" : ""}`;
      const labelKey = `${text}|${active}|${won}`;
      if (labelKey !== seat.labelKey) {
        seat.labelKey = labelKey;
        const color = seatColor(seat.index);
        this.setLabel(seat.label, text, 0.72, { background: active || won ? color : "rgba(251,248,241,0.94)", color: active || won ? "#FFFFFF" : COLORS.ink });
      }
    }
    const lost = view.players.reduce((n, p) => n + p.lost, 0);
    const boxKey = `${lost}`;
    if (boxKey !== this.boxKey) {
      this.boxKey = boxKey;
      this.setLabel(this.boxLabel, lost === 0 ? "Caixa" : lost === 1 ? "Caixa · 1 dado perdido" : `Caixa · ${lost} dados perdidos`, 0.55);
    }
    this.dirty = true;
  }

  setMarks(marks: TableMarks, view: View | null = this.view): void {
    this.marks = marks;
    if (view) this.view = view;
    const active = marks.active;
    const hand = active !== null ? this.hands[active] : undefined;
    this.hands.forEach((dice, seat) =>
      dice.forEach((die, i) => {
        const selected = seat === active && marks.selectedDie === i;
        const losing = seat === active && marks.lost === i;
        die.lift = selected ? 0.45 : losing ? 0.25 : 0;
      }),
    );
    // Selection, cross on the die to lose, circles on the dice to roll.
    const selected = marks.selectedDie !== null ? hand?.[marks.selectedDie] : undefined;
    // The marks on a die of a hand lie on its top face, so a crowded tray still shows them.
    const topOf = (die: Die3D) => die.root.position.y + die.tumbler.position.y + DIE_SIZE / 2 + 0.03;
    if (selected) this.placeMark(this.selectedMark, selected.root.position, 1.12, topOf(selected));
    else this.selectedMark.visible = false;
    const lost = marks.lost !== null ? hand?.[marks.lost] : undefined;
    if (lost) this.placeMark(this.lostMark, lost.root.position, 0.95, topOf(lost) + 0.01);
    else this.lostMark.visible = false;
    const rolling = marks.rolling;
    const rollDice = rolling ? rolling.dice.flatMap((i) => (this.hands[rolling.seat]?.[i] ? [this.hands[rolling.seat]![i]!] : [])) : [];
    this.fillMarks(this.rollMarks, rollDice.length, "roll", COLORS.ink, (mesh, i) => this.placeMark(mesh, rollDice[i]!.root.position, 1.1, topOf(rollDice[i]!)));
    // Rings on the next free cell of the active side of each stone where the die may go.
    const accent = active !== null ? seatColor(active) : COLORS.sia;
    this.fillMarks(this.rings, marks.targets.length, "ring", accent, (mesh, i) => {
      const stone = marks.targets[i]!;
      const seat = active ?? 0;
      const k = Math.min(2, this.sides[seat]?.[stone]?.length ?? 0);
      const p = sideSpot(seat, stone, k);
      this.placeMark(mesh, p, 1);
    });
    this.fillMarks(this.claimMarks, marks.claims.length, "claim", accent, (mesh, i) => {
      const p = stoneSpot(marks.claims[i]!.stone);
      this.placeMark(mesh, p, 1.2);
    });
    while (this.claimTags.length < marks.claims.length) this.claimTags.push(this.newLabelSprite());
    this.claimTags.forEach((tag, i) => {
      const claim = marks.claims[i];
      tag.visible = claim !== undefined;
      if (!claim) return;
      const key = `${claim.text}|${accent}`;
      if (tag.userData.key !== key) {
        tag.userData.key = key;
        this.setLabel(tag, claim.text, 0.62, { background: accent, color: "#FFFFFF" });
      }
      const p = stoneSpot(claim.stone);
      tag.position.set(p.x, 1.7, p.z - (active === 1 ? -1 : 1) * 0.4);
    });
    if (marks.last) {
      const list = this.sides[marks.last.seat]?.[marks.last.stone];
      const die = list?.[list.length - 1];
      if (die) {
        this.lastMark.material = this.markMaterial("last", seatColor(marks.last.seat));
        this.placeMark(this.lastMark, die.root.position, 1);
      } else this.lastMark.visible = false;
    } else this.lastMark.visible = false;
    if (marks.focus !== null) {
      const p = stoneSpot(marks.focus);
      this.focusMark.visible = true;
      this.focusMark.position.set(p.x, MARK_Y - 0.02, p.z);
      this.focusMark.scale.set(1, 1, 7.4);
      this.focusMark.rotation.y = 0;
    } else this.focusMark.visible = false;
    this.updateHover();
    this.dirty = true;
  }

  private fillMarks(pool: Mesh[], count: number, kind: MarkKind, accent: string, place: (mesh: Mesh, i: number) => void): void {
    while (pool.length < count) pool.push(this.newMark(kind));
    pool.forEach((mesh, i) => {
      if (i >= count) {
        mesh.visible = false;
        return;
      }
      mesh.material = this.markMaterial(kind, accent);
      place(mesh, i);
    });
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
    this.pitchGoal = PITCH.initial;
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

  private async relayoutHand(seat: number, duration = 300): Promise<void> {
    await this.slide(this.hands[seat]!.map((die, i) => ({ die, to: this.handPoint(seat, i) })), duration);
  }

  /** The stones and the dice of the taken formations slide to where the owners say they go. */
  private async relayoutBoard(duration = 700, height = 0.9): Promise<void> {
    const moves: { die: Die3D; to: Point3 }[] = [];
    this.stones.forEach((die, i) => {
      if (die) moves.push({ die, to: this.targetOfStone(i) });
    });
    for (const seat of [0, 1]) {
      this.sides[seat]!.forEach((dice, stone) => dice.forEach((die, k) => moves.push({ die, to: this.targetOfSide(seat, stone, k) })));
    }
    await this.slide(moves, duration, height);
  }

  private puffBag(): void {
    void this.run(this.ms(220), (t) => {
      const k = Math.sin(Math.PI * t);
      this.bag.scale.set(1 + 0.06 * k, 1 - 0.07 * k, 1 + 0.06 * k);
    });
  }

  private bagMouth(): Point3 {
    const at = bagSpot(this.arrangement);
    return { x: at.x, y: 1.7, z: at.z };
  }

  /** A text that rises over a point of the table and fades. */
  private float(text: string, at: { x: number; z: number }, options: { color?: string; background?: string; height?: number; duration?: number } = {}): void {
    const canvas = drawLabel(text, { px: 56, color: options.color ?? "#FFFFFF", background: options.background ?? COLORS.sia });
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
   * Shows what a command is about to do, before it plays: the die of a bot
   * lifts and a ring shows where it goes, a stone to claim is bracketed, a
   * reroll marks the die lost and the dice rolled. So a play of a bot can be
   * followed.
   */
  async preview(command: Command, seat: number): Promise<void> {
    if (!this.motion || !this.view) return;
    const base: TableMarks = { ...NO_MARKS, active: seat, last: this.marks.last };
    if (command.kind === "place") {
      this.setMarks({ ...base, selectedDie: command.die, targets: [command.stone] });
    } else if (command.kind === "claim") {
      this.setMarks({ ...base, claims: [{ stone: command.stone, text: "Reivindicar" }] });
    } else if (command.kind === "reroll") {
      const dice = [...Array(16).keys()].filter((i) => (command.dice >> i) & 1);
      this.setMarks({ ...base, lost: command.lost, rolling: { seat: command.target, dice } });
    } else return;
    this.options.sounds.play("pick");
    await wait(command.kind === "reroll" ? 900 : 650);
  }

  /**
   * Plays the events as animations, from the table as it is (`showEmpty`
   * for the preparation, `show` otherwise), and leaves the table as `after`
   * with `marks`. `progress` follows the events as they show.
   */
  async animate(events: readonly Event[], after: View, marks: TableMarks, progress: Progress = {}): Promise<void> {
    this.setMarks({ ...NO_MARKS, active: this.marks.active, last: this.marks.last }, this.view);
    this.owners = this.owners.slice();
    for (const event of events) {
      progress.onEvent?.(event);
      switch (event.kind) {
        case "stonesRolled":
          await this.rollStones(event.stones);
          break;
        case "drawn":
          await this.draw(event.player, event.dice);
          break;
        case "turnStarted":
          break;
        case "rerolled":
          await this.reroll(event);
          break;
        case "claimed":
          await this.claim(event.player, event.stone, event.formation, true);
          break;
        case "placed":
          await this.place(event);
          break;
        case "passed": {
          const c = trayCentre(event.player, this.arrangement, this.handSize);
          this.float("Passou", c, { background: COLORS.ink, height: 1 });
          await this.pause(650);
          break;
        }
        case "awarded":
          await this.award(event.stone, event.player);
          break;
        case "gameEnded":
          break;
      }
    }
    // Whatever the animations left, the table is now the one of `after`.
    this.show(after, marks);
  }

  /** The stones are thrown on the middle row, one after the other. */
  private async rollStones(numbers: readonly number[]): Promise<void> {
    this.options.sounds.play("roll");
    const flights: Promise<void>[] = [];
    for (let i = 0; i < numbers.length; i++) {
      const value = numbers[i]!;
      const to = this.targetOfStone(i);
      const die = new Die3D(STONE_SUIT, value, this.assets);
      die.root.position.set(to.x + (Math.random() - 0.5) * 2, 4.5, to.z + 5.5 * (i % 2 ? 1 : -1));
      die.tumbler.quaternion.random();
      this.world.add(die.root);
      this.stones[i] = die;
      flights.push(this.fly(die, to, orientation(value, 0), { duration: 780 + Math.random() * 200, height: 1.2 + Math.random() * 0.6, tumble: 2.5 }).then(() => this.land(die, 0.8)));
      await this.pause(80);
    }
    await Promise.all(flights);
  }

  /** Dice leave the bag and are rolled into the hand of a player, one after the other. */
  private async draw(seat: number, dice: readonly Die[]): Promise<void> {
    const flights: Promise<void>[] = [];
    for (const drawn of dice) {
      const die = new Die3D(drawn.suit, drawn.value, this.assets);
      const mouth = this.bagMouth();
      die.root.position.set(mouth.x, mouth.y, mouth.z);
      die.tumbler.quaternion.random();
      this.world.add(die.root);
      const slot = this.hands[seat]!.length;
      this.hands[seat]!.push(die);
      this.puffBag();
      this.options.sounds.play("pick");
      flights.push(this.fly(die, this.handPoint(seat, slot), orientation(drawn.value, seatAngle(seat)), { duration: 620, height: 1.6, tumble: 2 }).then(() => this.land(die, 0.7)));
      await this.pause(dice.length > 4 ? 90 : 170);
    }
    await Promise.all(flights);
  }

  private async reroll(event: Extract<Event, { kind: "rerolled" }>): Promise<void> {
    const hand = this.hands[event.target]!;
    const own = this.hands[event.player]!;
    const lostDie = own[event.lostIndex];
    const rolled = event.rolled.map((r) => ({ die: hand[r.index], to: r.to })).filter((r): r is { die: Die3D; to: Die } => r.die !== undefined);
    // The dice to roll show first, and the die to lose is marked, so the cost is clear.
    this.setMarks({ ...NO_MARKS, active: event.player, lost: event.lostIndex, rolling: { seat: event.target, dice: event.rolled.map((r) => r.index) } });
    this.options.sounds.play("pick");
    await this.pause(600);
    this.setMarks({ ...NO_MARKS, active: event.player });
    if (lostDie) {
      // The lost die goes to the box and does not come back.
      lostDie.lift = 0;
      const box = boxSpot(this.arrangement);
      own.splice(event.lostIndex, 1);
      void this.relayoutHand(event.player, 420);
      this.float("Perdido para sempre", this.handPoint(event.player, 0), { background: "#8D2A24", height: 1.4, duration: 2000 });
      await this.fly(lostDie, { x: box.x, y: 0.3, z: box.z }, lostDie.tumbler.quaternion.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 1).normalize(), 1.2)), { duration: 760, height: 2.4, tumble: 1 });
      this.options.sounds.play("land", 0.6);
      this.world.remove(lostDie.root);
    }
    if (rolled.length > 0) {
      this.options.sounds.play("roll");
      await Promise.all(
        rolled.map(({ die, to }) => {
          const at = die.root.position.clone();
          die.value = to.value;
          return this.fly(die, { x: at.x, y: at.y, z: at.z }, orientation(to.value, seatAngle(event.target)), { duration: 700 + Math.random() * 200, height: 1.1 + Math.random() * 0.6, tumble: 2 + Math.random() });
        }),
      );
      this.options.sounds.play("land");
    }
  }

  /** A claim: the stone and the formation light up, then slide to the side of who took them. */
  private async claim(player: number, stone: number, formation: Formation, flash: boolean): Promise<void> {
    const dice = this.sides[player]![stone] ?? [];
    const stoneDie = this.stones[stone];
    const at = stoneSpot(stone);
    if (flash) {
      this.options.sounds.play("line");
      this.float(`${stoneLetter(stone)} · ${formationText(formation)}`, at, { background: seatColor(player), height: 1.6, duration: 2200 });
      await this.wave(stoneDie ? [stoneDie, ...dice] : dice, 0.5);
    }
    this.owners[stone] = player;
    this.updateTokens(this.owners);
    const token = this.tokens[stone];
    if (token) {
      void this.run(this.ms(500), (t) => {
        token.scale.setScalar(easeOut(t));
      });
    }
    await this.relayoutBoard(flash ? 800 : 600);
    for (const die of [stoneDie, ...dice]) if (die) die.lift = 0;
    this.options.sounds.play("land", 0.8);
  }

  private async award(stone: number, player: number | null): Promise<void> {
    if (player === null) {
      this.float(`${stoneLetter(stone)} · sem dono`, stoneSpot(stone), { background: COLORS.ink, height: 1.4 });
      await this.pause(500);
      return;
    }
    const side = this.view?.stones[stone]?.sides[player]?.formation ?? null;
    await this.claim(player, stone, side ?? { kind: "sum", sum: 0 }, false);
  }

  private async place(event: Extract<Event, { kind: "placed" }>): Promise<void> {
    const hand = this.hands[event.player]!;
    const die = hand[event.handIndex];
    if (!die) return;
    die.lift = 0;
    hand.splice(event.handIndex, 1);
    const side = this.sides[event.player]![event.stone]!;
    const k = side.length;
    const to = this.targetOfSide(event.player, event.stone, k);
    void this.relayoutHand(event.player, 360);
    await this.fly(die, to, orientation(event.die.value, seatAngle(event.player)), { duration: 700, height: 1.5 });
    side.push(die);
    this.setMarks({ ...NO_MARKS, active: this.marks.active, last: { seat: event.player, stone: event.stone } });
    await this.land(die);
    if (event.completes) {
      this.options.sounds.play("line");
      this.float("Lado completo", { x: to.x, z: to.z }, { background: seatColor(event.player), height: 1.3 });
      await this.wave(side, 0.3);
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
    // The tray of the seat to move glows, gently; the claim brackets breathe.
    const active = this.marks.active;
    for (const seat of this.seats) {
      const material = seat.glow.material as MeshBasicMaterial;
      const target = seat.index === active ? 0.4 + 0.18 * Math.sin(now / 420) : 0;
      if (Math.abs(material.opacity - target) > 0.003) {
        material.opacity = target;
        this.dirty = true;
      }
    }
    if (this.marks.claims.length > 0) {
      const s = 1.2 + 0.07 * Math.sin(now / 260);
      for (const mesh of this.claimMarks) mesh.scale.set(s, 1, s);
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
    const camKey = `${this.yaw}|${this.pitch}|${this.zoom}|${width}|${height}|${insets.top}|${insets.bottom}|${insets.left}|${insets.right}|${this.arrangement}`;
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
    const dir = new Vector3(Math.sin(this.yaw) * Math.sin(this.pitch), Math.cos(this.pitch), Math.cos(this.yaw) * Math.sin(this.pitch));
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
  screenOf(pick: Pick): { x: number; y: number } | null {
    let point: Vector3 | null = null;
    if (pick.kind === "hand") {
      const die = this.hands[pick.seat]?.[pick.die];
      if (die) point = die.root.position.clone().setY(0.4);
    } else if (pick.kind === "stone") {
      const p = stoneSpot(pick.stone);
      point = new Vector3(p.x, 0.4, p.z);
    } else {
      const p = sideSpot(pick.seat, pick.stone, 1);
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
    const bodies: Mesh[] = [];
    for (const dice of this.hands) for (const die of dice) bodies.push(die.body);
    for (const die of this.stones) if (die) bodies.push(die.body);
    const hit = this.raycaster.intersectObjects(bodies, false)[0]?.object.userData.die as Die3D | undefined;
    if (hit) {
      for (let seat = 0; seat < 2; seat++) {
        const die = this.hands[seat]!.indexOf(hit);
        if (die >= 0) return { kind: "hand", seat, die };
      }
      const stone = this.stones.indexOf(hit);
      if (stone >= 0) return { kind: "stone", stone };
    }
    const point = this.raycaster.ray.intersectPlane(GROUND, new Vector3());
    if (!point) return null;
    const stone = Math.round(point.x + (STONES - 1) / 2);
    if (stone < 0 || stone >= STONES || Math.abs(point.x - Math.round(point.x)) > 0.5) return null;
    if (Math.abs(point.z) <= 0.55) return { kind: "stone", stone };
    if (Math.abs(point.z) <= 3.6) return { kind: "side", seat: point.z > 0 ? 0 : 1, stone };
    return null;
  }

  private setHover(pick: Pick | null): void {
    const same = JSON.stringify(pick) === JSON.stringify(this.hovered);
    if (same) return;
    this.hovered = pick;
    this.options.onHover(pick && (pick.kind === "stone" || pick.kind === "side") ? pick.stone : null);
    this.updateHover();
  }

  /** Over a stone where the selected die may go: the die shows on its next cell. */
  private updateHover(): void {
    const pick = this.hovered;
    const marks = this.marks;
    const active = marks.active;
    const onTarget = pick !== null && pick.kind !== "hand" && marks.targets.includes(pick.stone);
    if (!onTarget || active === null || marks.ghost === null || pick === null) {
      if (this.ghost) this.ghost.root.visible = false;
      this.dirty = true;
      return;
    }
    const key = `${marks.ghost.suit}:${marks.ghost.value}`;
    let ghost = this.ghosts.get(key);
    if (!ghost) {
      ghost = new Die3D(marks.ghost.suit, marks.ghost.value, this.assets, true);
      ghost.show(marks.ghost.value, seatAngle(active));
      this.world.add(ghost.root);
      this.ghosts.set(key, ghost);
    }
    if (this.ghost && this.ghost !== ghost) this.ghost.root.visible = false;
    this.ghost = ghost;
    const k = Math.min(2, this.sides[active]?.[pick.stone]?.length ?? 0);
    const p = sideSpot(active, pick.stone, k);
    ghost.root.visible = true;
    ghost.root.position.set(p.x, BOARD_Y, p.z);
    ghost.show(marks.ghost.value, seatAngle(active));
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
    for (const m of this.markMaterials.values()) m.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const g of this.geometries) g.dispose();
    this.markGeometry.dispose();
    for (const sprite of [this.bagLabel, this.boxLabel, ...this.claimTags, ...this.seats.map((s) => s.label)]) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    this.renderer.dispose();
    this.canvas.remove();
  }
}
