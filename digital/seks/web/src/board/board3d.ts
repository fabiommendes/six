import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import type { Event } from "@wire/Event";
import type { Cell } from "../engine/cells";
import type { Side, View } from "../engine/game";
import { NO_MARKS, type Marks } from "../logic/marks";
import type { Stage } from "../logic/match";
import { drawBoardTexture, drawMark, type MarkKind } from "./drawing";
import { DieAssets, Die3D } from "./die3d";
import { BOARD_THICKNESS, cellAtScreen, cellCenter, DIE_SIZE, orientation } from "./geometry";
import { COMPACT_BELOW, frameLayout, type FrameLayout } from "./layout";
import { BoardCameras, turnExtent } from "./view";

/** A captured die that leaves the board: where it is on screen, to fly to the panel. */
export interface CapturedFlight {
  readonly side: Side;
  readonly value: number;
  /** Centre of the die, in CSS pixels of the page. */
  readonly x: number;
  readonly y: number;
  /** Side of the die on screen, in CSS pixels. */
  readonly size: number;
}

export interface BoardOptions {
  /** Whether to skip the animations (the player asked for less motion). */
  reducedMotion(): boolean;
  /** Flies a captured die from the board to the panel; resolves when it lands. */
  flyCaptured(flight: CapturedFlight): Promise<void>;
  /** The click or tap of the player on a cell, or outside the cells (`null`). */
  onCell(cell: Cell | null): void;
}

const FONT = '"Alegreya Sans", sans-serif';
const MARK_HEIGHT = 0.004;
const BOARD_TEXTURE = 2048;
const RING_POOL = 48;
/** The sides of the board, lit from the north west: the sun falls on the west and north sides. */
const BLOCK_COLORS = { west: "#DDD2BD", north: "#DDD2BD", east: "#C9BCA3", south: "#C9BCA3" } as const;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Runs `step(t)` for `t` from 0 to 1 over `duration` ms, one call per frame. */
function tween(duration: number, step: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    if (duration <= 0) {
      step(1);
      resolve();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      step(t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function markTexture(kind: MarkKind): CanvasTexture {
  const t = new CanvasTexture(drawMark(kind, 128));
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * The board in Three.js: the 11 by 11 cells seen from above (orthographic) or
 * tilted (perspective, with the board showing its thickness), the dice as
 * rounded cubes with pips, the marks of play as flat shapes on the board. It draws what the match tells it to (`Stage`) and reports clicks
 * and taps; it knows no rule.
 */
export class Board3D implements Stage {
  readonly canvas: HTMLCanvasElement;
  /** Whether a cell answers to a click: the pointer cursor shows over it. */
  canActivate: (cell: Cell) => boolean = () => false;

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cameras = new BoardCameras();
  private readonly assets = new DieAssets();
  private readonly dice = new Map<Cell, Die3D>();
  private readonly raycaster = new Raycaster();
  private readonly frame: Mesh;
  /** The block under the frame: its sides show when the view is tilted. */
  private readonly block: Mesh;
  /** What turns with the point of view: the board, the dice and the marks. The camera and the light stay put. */
  private readonly world = new Group();
  /** The board texture twice: with the coordinates as drawn and turned upside down (for the view from the Blacks). */
  private readonly frameTextures: (CanvasTexture | null)[] = [null, null];
  private readonly frameCanvases: (HTMLCanvasElement | null)[] = [null, null];
  private layout: FrameLayout = frameLayout(false);
  private readonly markTextures: Record<MarkKind, CanvasTexture>;
  private readonly markMaterials: Record<MarkKind, Material>;
  private readonly markGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly selectedMark: Mesh;
  private readonly fromMark: Mesh;
  private readonly toMark: Mesh;
  private readonly rings: Mesh[] = [];
  private marks: Marks = NO_MARKS;
  /** How far the world is turned, in radians: 0 for the Whites' point of view, a half turn more for each change. */
  private yaw = 0;
  private yawTarget = 0;
  private yawRun = 0;
  private tilt = 0;
  private tiltTarget = 0;
  private tiltRun = 0;
  private frameRequest = 0;
  private readonly observer: ResizeObserver;
  private down: { x: number; y: number } | null = null;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: BoardOptions,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.classList.add("board-canvas");
    container.append(this.canvas);

    this.scene.add(new AmbientLight(0xffffff, 1.7));
    const sun = new DirectionalLight(0xffffff, 1.7);
    sun.position.set(-3, 7, -3.5);
    this.scene.add(sun);
    this.scene.add(this.world);

    const frameMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false });
    this.frame = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), frameMaterial);
    this.frame.renderOrder = 0;
    this.world.add(this.frame);

    // The top of the block is the frame itself, so it has no face of its own.
    const side = (color: string) => new MeshLambertMaterial({ color });
    const hidden = new MeshLambertMaterial({ visible: false });
    this.block = new Mesh(new BoxGeometry(1, 1, 1), [side(BLOCK_COLORS.east), side(BLOCK_COLORS.west), hidden, side(BLOCK_COLORS.east), side(BLOCK_COLORS.south), side(BLOCK_COLORS.north)]);
    this.block.visible = false;
    this.world.add(this.block);

    this.markTextures = { ring: markTexture("ring"), selected: markTexture("selected"), from: markTexture("from"), to: markTexture("to") };
    const markMaterial = (kind: MarkKind) => new MeshBasicMaterial({ map: this.markTextures[kind], transparent: true, depthWrite: false });
    this.markMaterials = { ring: markMaterial("ring"), selected: markMaterial("selected"), from: markMaterial("from"), to: markMaterial("to") };
    this.selectedMark = this.newMark("selected");
    this.fromMark = this.newMark("from");
    this.toMark = this.newMark("to");

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    void this.drawFrame();
  }

  // --- Stage -----------------------------------------------------------------

  show(view: View, marks: Marks): void {
    this.sync(view);
    this.setMarks(marks);
  }

  setMarks(marks: Marks): void {
    this.marks = marks;
    for (const die of this.dice.values()) die.setLifted(die.cell === marks.selected);
    this.placeMark(this.selectedMark, marks.selected, 0.0);
    this.placeMark(this.fromMark, marks.lastFrom, 0.001);
    this.placeMark(this.toMark, marks.lastTo, 0.001);
    marks.destinations.forEach((cell, i) => this.placeMark(this.ring(i), cell, 0.002));
    for (let i = marks.destinations.length; i < this.rings.length; i++) this.rings[i]!.visible = false;
    this.invalidate();
  }

  async animate(events: readonly Event[], view: View, marks: Marks): Promise<void> {
    const motion = !this.options.reducedMotion();
    // The selection goes away at once; the marks of the last play come when the die lands.
    this.setMarks({ ...this.marks, selected: null, destinations: [] });
    const captured: Extract<Event, { type: "captured" }>[] = [];
    for (const event of events) {
      if (event.type === "moved") await this.slide(event, motion);
      else if (event.type === "incremented") await this.turnInPlace(event, motion);
      else if (event.type === "captured") captured.push(event);
    }
    this.setMarks(marks);
    await Promise.all(captured.map((event) => this.leave(event, motion)));
    this.sync(view);
    this.invalidate();
  }

  // --- Camera ----------------------------------------------------------------

  /** Tilts the camera (or looks from above again), turning smoothly unless motion is off or `instant`. */
  setTilted(tilted: boolean, instant = false): void {
    this.tiltTarget = tilted ? 1 : 0;
    const run = ++this.tiltRun;
    const from = this.tilt;
    const duration = instant || this.options.reducedMotion() ? 0 : 450;
    void tween(duration, (t) => {
      if (run !== this.tiltRun) return;
      this.tilt = from + (this.tiltTarget - from) * easeInOut(t);
      this.updateCamera();
      this.renderNow();
    });
  }

  /**
   * Looks at the board from the side of `side`: the Whites see row 1 at the
   * bottom, the Blacks row 11. The board turns half a turn about the vertical,
   * in the same direction every time, unless motion is off or `instant`.
   */
  setViewpoint(side: Side, instant = false): void {
    const blacks = Math.round(this.yawTarget / Math.PI) % 2 !== 0;
    if (blacks === (side === "black")) return;
    this.yawTarget += Math.PI;
    const run = ++this.yawRun;
    const from = this.yaw;
    const to = this.yawTarget;
    const duration = instant || this.options.reducedMotion() ? 0 : 600;
    void tween(duration, (t) => {
      if (run !== this.yawRun) return;
      this.yaw = from + (to - from) * easeInOut(t);
      this.updateCamera();
      this.renderNow();
    });
  }

  // --- Dice and marks --------------------------------------------------------

  private sync(view: View): void {
    const wanted = new Map(view.dice.map((die) => [die.cell, die]));
    for (const [cell, die3d] of [...this.dice]) {
      const want = wanted.get(cell);
      if (!want || want.side !== die3d.side) {
        this.world.remove(die3d.root);
        this.dice.delete(cell);
      }
    }
    for (const [cell, want] of wanted) {
      const existing = this.dice.get(cell);
      if (existing) {
        existing.setValue(want.value);
        existing.rest();
        continue;
      }
      const die3d = new Die3D(want.side, want.value, cell, this.assets);
      this.dice.set(cell, die3d);
      this.world.add(die3d.root);
    }
    for (const die of this.dice.values()) die.setLifted(die.cell === this.marks.selected);
    this.invalidate();
  }

  private newMark(kind: MarkKind): Mesh {
    const mesh = new Mesh(this.markGeometry, this.markMaterials[kind]);
    mesh.renderOrder = 2;
    mesh.visible = false;
    this.world.add(mesh);
    return mesh;
  }

  private ring(index: number): Mesh {
    while (this.rings.length <= Math.max(index, RING_POOL - 1)) this.rings.push(this.newMark("ring"));
    return this.rings[index]!;
  }

  private placeMark(mesh: Mesh, cell: Cell | null, height: number): void {
    mesh.visible = cell !== null;
    if (cell === null) return;
    const { x, z } = cellCenter(cell);
    mesh.position.set(x, MARK_HEIGHT + height, z);
  }

  private async slide(event: Extract<Event, { type: "moved" }>, motion: boolean): Promise<void> {
    const die = this.dice.get(event.from);
    if (!die) return;
    this.dice.delete(event.from);
    die.setLifted(false);
    const from = cellCenter(event.from);
    const to = cellCenter(event.to);
    const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.z - from.z));
    const duration = motion ? Math.min(750, 280 + 90 * distance) : 0;
    const start = orientation(die.value);
    const end = orientation(event.value);
    await tween(duration, (t) => {
      const e = easeInOut(t);
      die.root.position.set(from.x + (to.x - from.x) * e, 0, from.z + (to.z - from.z) * e);
      die.tumbler.quaternion.slerpQuaternions(start, end, e);
      die.rest(Math.sin(Math.PI * t));
      this.renderNow();
    });
    die.cell = event.to;
    die.setValue(event.value);
    die.rest();
    this.dice.set(event.to, die);
  }

  private async turnInPlace(event: Extract<Event, { type: "incremented" }>, motion: boolean): Promise<void> {
    const die = this.dice.get(event.at);
    if (!die) return;
    die.setLifted(false);
    const start = orientation(die.value);
    const end = orientation(event.value);
    await tween(motion ? 320 : 0, (t) => {
      die.tumbler.quaternion.slerpQuaternions(start, end, easeInOut(t));
      die.rest(Math.sin(Math.PI * t) * 0.6);
      this.renderNow();
    });
    die.setValue(event.value);
    die.rest();
  }

  private async leave(event: Extract<Event, { type: "captured" }>, motion: boolean): Promise<void> {
    const die = this.dice.get(event.at);
    if (!die) return;
    const flight = this.screenOf(die, event);
    this.dice.delete(event.at);
    this.world.remove(die.root);
    this.renderNow();
    if (!motion) return;
    await this.options.flyCaptured(flight);
  }

  /** Where a die is on the page, for the flight of a captured die. */
  private screenOf(die: Die3D, event: Extract<Event, { type: "captured" }>): CapturedFlight {
    const rect = this.canvas.getBoundingClientRect();
    const camera = this.cameras.active;
    const { x, z } = die.root.position;
    // The die is in the turned world: from its own coordinates to the page.
    const toPage = (point: Vector3) => {
      const ndc = this.world.localToWorld(point).project(camera);
      return { x: rect.left + ((ndc.x + 1) / 2) * rect.width, y: rect.top + ((1 - ndc.y) / 2) * rect.height };
    };
    const centre = toPage(new Vector3(x, DIE_SIZE / 2, z));
    // The width of the die at its own height, whichever way the board is turned.
    const west = toPage(new Vector3(x - DIE_SIZE / 2, DIE_SIZE / 2, z));
    const east = toPage(new Vector3(x + DIE_SIZE / 2, DIE_SIZE / 2, z));
    return { side: event.side, value: event.value, x: centre.x, y: centre.y, size: Math.hypot(east.x - west.x, east.y - west.y) };
  }

  // --- Drawing ---------------------------------------------------------------

  private async drawFrame(): Promise<void> {
    try {
      await Promise.all([document.fonts.load(`500 20px ${FONT}`), document.fonts.ready]);
    } catch {
      // Draw with the fallback font rather than not at all.
    }
    if (this.disposed) return;
    for (const turned of [0, 1]) {
      const canvas = (this.frameCanvases[turned] ??= document.createElement("canvas"));
      canvas.width = canvas.height = BOARD_TEXTURE;
      drawBoardTexture(canvas, this.layout, FONT, turned === 1);
      let texture = this.frameTextures[turned];
      if (!texture) {
        texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        this.frameTextures[turned] = texture;
      }
      texture.needsUpdate = true;
    }
    (this.frame.material as MeshBasicMaterial).needsUpdate = true;
    this.frame.scale.setScalar(this.layout.worldSize);
    this.block.scale.set(this.layout.worldSize, BOARD_THICKNESS, this.layout.worldSize);
    this.block.position.y = -BOARD_THICKNESS / 2;
    this.updateCamera();
    this.invalidate();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    // The frame is drawn for the square the board fits in, which is the shorter side of the canvas.
    const compact = Math.min(width, height) < COMPACT_BELOW;
    if (compact !== this.layout.compact) {
      this.layout = frameLayout(compact);
      void this.drawFrame();
    }
    this.updateCamera();
    this.invalidate();
  }

  private updateCamera(): void {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight) || 1;
    // While the board turns its corners reach out: the camera backs off to keep it all in the canvas.
    this.cameras.update(this.tilt, aspect, this.layout.worldSize * turnExtent(this.yaw), BOARD_THICKNESS);
    this.world.rotation.y = this.yaw;
    this.world.updateMatrixWorld(true);
    // Seen from straight above, the sides are edge-on: do not draw them.
    this.block.visible = this.tilt > 0;
    // The coordinates read upright: the turned texture once the board is more than a quarter turn round.
    const quarter = Math.floor((this.yaw + Math.PI / 2) / Math.PI);
    const upsideDown = quarter % 2 !== 0;
    const map = this.frameTextures[upsideDown ? 1 : 0];
    if (map) (this.frame.material as MeshBasicMaterial).map = map;
  }

  /** Draws on the next frame, once, however many changes come before it. */
  private invalidate(): void {
    if (this.frameRequest || this.disposed) return;
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0;
      this.renderNow();
    });
  }

  private renderNow(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.cameras.active);
  }

  // --- Pointer ---------------------------------------------------------------

  private pick(event: PointerEvent): Cell | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
    this.raycaster.setFromCamera(ndc, this.cameras.active);
    const hits = this.raycaster.intersectObjects([...this.dice.values()].map((die) => die.body), false);
    const die = hits[0]?.object.userData.die as Die3D | undefined;
    if (die) return die.cell;
    return cellAtScreen(this.cameras.active, ndc.x, ndc.y, this.raycaster, this.yaw);
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.down = { x: event.clientX, y: event.clientY };
  };

  /** A click or a tap is the same gesture: press and release on the same spot. */
  private readonly onPointerUp = (event: PointerEvent) => {
    const down = this.down;
    this.down = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 14) return;
    this.options.onCell(this.pick(event));
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const cell = this.pick(event);
    this.canvas.style.cursor = cell !== null && this.canActivate(cell) ? "pointer" : "default";
  };

  private readonly onPointerLeave = () => {
    this.down = null;
    this.canvas.style.cursor = "default";
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameRequest);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.assets.dispose();
    for (const t of Object.values(this.markTextures)) t.dispose();
    for (const m of Object.values(this.markMaterials)) m.dispose();
    this.markGeometry.dispose();
    for (const t of this.frameTextures) t?.dispose();
    this.frame.geometry.dispose();
    this.block.geometry.dispose();
    for (const m of this.block.material as Material[]) m.dispose();
    (this.frame.material as Material).dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
