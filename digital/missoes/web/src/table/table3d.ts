import {
  AmbientLight,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Kind, Mission, View } from "../engine/game";
import { KIND_FACES } from "../logic/texts";
import { DIE_LOOKS, seatColor } from "../ui/svg";
import { drawCard, drawChip, drawCloth, drawDieFace, drawShowcase, drawTray, shade } from "./drawing";
import {
  CARD_D,
  CARD_W,
  cardSpot,
  HAND_DIE,
  handSpot,
  reserveSpot,
  SHOWCASE_AREA,
  SHOWCASE_DIE,
  showcaseSpot,
  TABLE_D,
  TABLE_W,
  trays,
  ZONE_LABEL,
  zones,
  type Tray,
} from "./layout";
import { easeOut, tween } from "./motion";

/**
 * What can be picked on the table, as a key: `hand:P:I` (die I of the hand
 * of player P, wherever it lies), `reserve:P:R` (reserve die R out of the
 * hand), `showcase:I`, `card:C` (C is the column: 0 for the standard
 * mission, then the cards) and `chip:NAME` (a chip the screen asked for).
 */
export type PickKey = string;

/** A chip to tap, floating behind a die (`near`): at its left (`offset` −1) or right (+1). */
export interface Chip {
  readonly key: PickKey;
  readonly text: string;
  readonly near: PickKey;
  readonly offset: number;
}

/** What the screen asks the table to show besides the view. */
export interface Marks {
  /** Dice and cards that can be picked now, and those picked. */
  readonly selectable: ReadonlySet<PickKey>;
  readonly selected: ReadonlySet<PickKey>;
  /** Reserve dice picked for the hand of a seat that is selecting: they wait on its mat. */
  readonly picks?: { readonly seat: number; readonly dice: ReadonlySet<number> };
  /** A die of a hand shown back in the reserve before it leaves: the die a sacrifice being built takes out. */
  readonly aside?: { readonly seat: number; readonly die: number };
  /** For each column of the missions, what the player deciding makes there. */
  readonly results?: readonly (string | null)[];
  readonly chips?: readonly Chip[];
}

export interface TableOptions {
  onPick(key: PickKey): void;
  reducedMotion(): boolean;
}

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** A die on the table: a rounded body and the face on top. */
interface DieMesh {
  readonly root: Group;
  readonly tumbler: Group;
  readonly kind: Kind;
  readonly face: number;
}

/** Shared geometry, materials and textures, cached by what they show. */
class Assets {
  readonly body: BufferGeometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.12);
  readonly top: BufferGeometry = new PlaneGeometry(0.86, 0.86);
  readonly plane: BufferGeometry = new PlaneGeometry(1, 1);
  readonly token: BufferGeometry[] = [
    new CylinderGeometry(0.26, 0.26, 0.22, 24),
    new CylinderGeometry(0.33, 0.33, 0.22, 4, 1, false, Math.PI / 4),
    new CylinderGeometry(0.34, 0.34, 0.22, 3),
    new CylinderGeometry(0.32, 0.32, 0.22, 4),
  ];
  private readonly materials = new Map<string, Material>();
  private readonly textures: Texture[] = [];

  material(id: string, make: () => Material): Material {
    let found = this.materials.get(id);
    if (!found) {
      found = make();
      this.materials.set(id, found);
    }
    return found;
  }

  canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
    const t = texture(canvas);
    this.textures.push(t);
    return t;
  }

  bodyMaterial(kind: Kind, opacity: number): Material {
    return this.material(`body:${kind}:${opacity}`, () => {
      const look = DIE_LOOKS[kind];
      return new MeshStandardMaterial({ color: shade(look.body, -0.06), roughness: 0.5, transparent: opacity < 1, opacity });
    });
  }

  faceMaterial(kind: Kind, face: number, opacity: number): Material {
    return this.material(`face:${kind}:${face}:${opacity}`, () => {
      const map = this.canvasTexture(drawDieFace(kind, face, 128));
      return new MeshStandardMaterial({ map, roughness: 0.55, transparent: true, opacity, polygonOffset: true, polygonOffsetFactor: -1 });
    });
  }

  /** Invisible, for the boxes that take the clicks on dice. */
  readonly hit: Material = new MeshBasicMaterial({ visible: false });

  /** The square under a die that can be picked (thin) or is picked (thick). */
  frameMaterial(thick: boolean): Material {
    return this.material(`frame:${thick}`, () => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const ctx = c.getContext("2d")!;
      // Gold reads on the wool of the reserve and on the dark mat of the hand alike.
      ctx.strokeStyle = thick ? "#E8B730" : "#FBF8F1";
      ctx.lineWidth = thick ? 16 : 7;
      ctx.setLineDash(thick ? [] : [18, 10]);
      ctx.strokeRect(10, 10, 108, 108);
      return new MeshBasicMaterial({ map: this.canvasTexture(c), transparent: true, depthWrite: false });
    });
  }

  dispose(): void {
    for (const g of [this.body, this.top, this.plane, ...this.token]) g.dispose();
    this.hit.dispose();
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}

/** The table in 3D: the cloth, a tray per seat with its reserve and hand, the mission cards with the markers, and the showcase. */
export class Table3D {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, 0.1, 200);
  private readonly assets = new Assets();
  /** What is rebuilt on every view, with its own textures. */
  private layer = new Group();
  private layerTextures: Texture[] = [];
  private readonly pickables: Object3D[] = [];
  private readonly faces = new Map<PickKey, { kind: Kind; face: number }>();
  /** Where each die was last shown, by seat and reserve index, so a die that changes place slides. */
  private places = new Map<string, { x: number; z: number }>();
  private nextPlaces = new Map<string, { x: number; z: number }>();
  /** Where each pickable die is in this view. */
  private readonly spots = new Map<PickKey, { x: number; z: number; size: number }>();
  private readonly observer: ResizeObserver;
  private loop = 0;
  private readonly raycaster = new Raycaster();

  constructor(
    private readonly host: HTMLElement,
    private readonly options: TableOptions,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add("table-canvas");

    this.scene.add(new HemisphereLight(0xfff4e0, 0x3a2a1c, 1.1));
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xffffff, 1.4);
    sun.position.set(-6, 18, 10);
    this.scene.add(sun);

    const clothMap = this.assets.canvasTexture(drawCloth(256));
    clothMap.wrapS = clothMap.wrapT = RepeatWrapping;
    clothMap.repeat.set(6, 4);
    const cloth = new Mesh(new PlaneGeometry(TABLE_W, TABLE_D), new MeshStandardMaterial({ map: clothMap, roughness: 0.95 }));
    cloth.rotation.x = -Math.PI / 2;
    this.scene.add(cloth);
    const rim = new Mesh(new PlaneGeometry(TABLE_W + 1.2, TABLE_D + 1.2), new MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.7 }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = -0.02;
    this.scene.add(rim);
    this.scene.add(this.layer);

    this.renderer.domElement.addEventListener("click", this.click);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.loop = requestAnimationFrame(this.frame);
  }

  /**
   * Shows `view`: in each tray the reserve and the hand. A die of the hand
   * that is used (a 0 or a modifier) or sacrificed lies back in the reserve,
   * with the face it shows. Dice whose face changed tumble; dice that
   * changed place slide.
   */
  show(view: View, names: readonly string[], marks: Marks): void {
    this.scene.remove(this.layer);
    this.layer.traverse((o) => {
      if (o instanceof Mesh && o.userData.own) (o.material as Material).dispose();
    });
    for (const t of this.layerTextures) t.dispose();
    this.layerTextures = [];
    this.pickables.length = 0;
    this.spots.clear();
    this.nextPlaces = new Map();
    this.layer = new Group();
    this.scene.add(this.layer);

    const seats = trays(view.players);
    const round = view.current;
    const hands = round?.hands ?? view.last?.hands ?? [];
    const pending = view.pending?.player ?? -1;
    const seen = new Set<PickKey>();
    seats.forEach((tray, p) => {
      const passed = round && round.order.length > 0 && view.pending?.decision.kind === "act" && !round.active[p];
      const playing = round && round.hands[p]!.length > 0;
      const score = round ? `${view.points[p]}+${round.score[p]}` : `${view.points[p]}`;
      const detail = `${score} pts${playing ? ` · $${round.money[p]}` : ""}${passed ? " · passou" : ""}`;
      this.addTray(tray, p, names[p]!, detail, p === pending);
      const hand = hands[p] ?? [];
      const bySource = new Map<number, number>();
      hand.forEach((die, i) => {
        if (die.source !== null) bySource.set(die.source, i);
      });
      // What lies on the mat and what lies in the reserve, in the order of the reserve.
      const onMat: { key: PickKey; ident: string; kind: Kind; face: number | null; alpha: number }[] = [];
      const inReserve: { key: PickKey; ident: string; kind: Kind; face: number | null; slot: number }[] = [];
      const picks = marks.picks?.seat === p ? marks.picks.dice : null;
      const out = (i: number) => hand[i]!.removed || hand[i]!.used || (marks.aside?.seat === p && marks.aside.die === i);
      hand.forEach((die, i) => {
        if (out(i)) return;
        const goldOff = !die.counts && (die.kind === "gold" || die.kind === "highGold");
        onMat.push({ key: `hand:${p}:${i}`, ident: `${p}:${die.source ?? `h${i}`}`, kind: die.kind, face: die.face, alpha: goldOff ? 0.55 : 1 });
      });
      view.reserves[p]!.forEach((kind, r) => {
        const i = bySource.get(r);
        if (i !== undefined) {
          const die = hand[i]!;
          if (out(i)) inReserve.push({ key: `hand:${p}:${i}`, ident: `${p}:${r}`, kind: die.kind, face: die.face, slot: r });
        } else if (picks?.has(r)) {
          onMat.push({ key: `reserve:${p}:${r}`, ident: `${p}:${r}`, kind, face: null, alpha: 1 });
        } else {
          inReserve.push({ key: `reserve:${p}:${r}`, ident: `${p}:${r}`, kind, face: null, slot: r });
        }
      });
      onMat.forEach((d, slot) => {
        seen.add(d.key);
        this.addDie(d.key, d.ident, d.kind, d.face, { ...handSpot(tray, slot, onMat.length), size: HAND_DIE }, marks, d.alpha);
      });
      // While the seat picks its hand, the reserve keeps its slots, so the dice left do not move under the finger.
      const slots = picks ? view.reserves[p]!.length : inReserve.length;
      inReserve.forEach((d, slot) => {
        seen.add(d.key);
        this.addDie(d.key, d.ident, d.kind, d.face, reserveSpot(tray, picks ? d.slot : slot, slots), marks, 1);
      });
    });
    for (const key of [...this.faces.keys()]) if (!seen.has(key)) this.faces.delete(key);
    this.places = this.nextPlaces;

    const missions: (Mission | null)[] = [round?.standard === false ? null : "standard", ...(round ? round.table : view.table)];
    missions.forEach((mission, column) => {
      const shown = mission ?? (column === 0 ? "standard" : view.table[column - 1]) ?? null;
      if (!shown) return;
      this.addCard(column, missions.length, shown, mission === null, marks.results?.[column] ?? null, marks);
    });
    if (round) {
      const columnOf = (s: NonNullable<(typeof round.markers)[number]>) => (s.kind === "standard" ? 0 : s.card + 1);
      round.markers.forEach((spot, p) => {
        if (!spot) return;
        const column = columnOf(spot);
        const onSame = round.markers.slice(0, p).filter((s) => s && columnOf(s) === column).length;
        this.addToken(column, missions.length, p, onSame);
      });
    }
    this.addShowcaseMat();
    view.showcase.forEach((kind, i) => this.addDie(`showcase:${i}`, null, kind, null, { ...showcaseSpot(i), size: SHOWCASE_DIE }, marks, 1));
    for (const chip of marks.chips ?? []) this.addChip(chip, marks);
  }

  /** Where a pickable thing is on the page, for tests in the browser. */
  screenOf(key: PickKey): { x: number; y: number } | null {
    const found = this.pickables.find((o) => o.userData.pick === key);
    if (!found) return null;
    const v = new Vector3();
    found.getWorldPosition(v).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  dispose(): void {
    cancelAnimationFrame(this.loop);
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener("click", this.click);
    for (const t of this.layerTextures) t.dispose();
    this.assets.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addTray(tray: Tray, seat: number, name: string, detail: string, active: boolean): void {
    const px = 64;
    const z = zones(tray);
    const pixels = (zone: typeof z.hand) => ({ x: zone.left * px, y: zone.top * px, w: zone.w * px, h: zone.d * px });
    const map = texture(drawTray(Math.round(tray.w * px), Math.round(tray.d * px), seat, name, detail, active, pixels(z.reserve), pixels(z.hand), ZONE_LABEL * px));
    this.layerTextures.push(map);
    const mesh = new Mesh(this.assets.plane, new MeshStandardMaterial({ map, roughness: 0.9 }));
    mesh.userData.own = true;
    mesh.scale.set(tray.w, tray.d, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(tray.x, 0.01, tray.z);
    this.layer.add(mesh);
  }

  private addShowcaseMat(): void {
    const px = 64;
    const map = texture(drawShowcase(Math.round(SHOWCASE_AREA.w * px), Math.round(SHOWCASE_AREA.d * px)));
    this.layerTextures.push(map);
    const mesh = new Mesh(this.assets.plane, new MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
    mesh.userData.own = true;
    mesh.scale.set(SHOWCASE_AREA.w, SHOWCASE_AREA.d, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(SHOWCASE_AREA.x, 0.008, SHOWCASE_AREA.z);
    this.layer.add(mesh);
  }

  /** A chip floating over the table next to a die, to tap. */
  private addChip(chip: Chip, marks: Marks): void {
    const near = this.spots.get(chip.near);
    if (!near) return;
    const w = 1.5;
    const d = 0.75;
    const map = texture(drawChip(chip.text, 240, 120));
    this.layerTextures.push(map);
    const mesh = new Mesh(this.assets.plane, new MeshBasicMaterial({ map, transparent: true, depthTest: false }));
    mesh.userData.own = true;
    mesh.userData.pick = chip.key;
    mesh.renderOrder = 10;
    mesh.scale.set(w, d, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(near.x + chip.offset * (w / 2 + 0.05), 1.6, near.z - near.size / 2 - d / 2 - 0.15);
    if (marks.selected.has(chip.key)) mesh.position.y += 0.1;
    this.layer.add(mesh);
    this.pickables.push(mesh);
  }

  private addCard(column: number, columns: number, mission: Mission, sabotaged: boolean, result: string | null, marks: Marks): void {
    const map = texture(drawCard(mission, sabotaged, result, 520, 650));
    this.layerTextures.push(map);
    const key = `card:${column}`;
    const mesh = new Mesh(this.assets.plane, new MeshStandardMaterial({ map, roughness: 0.8 }));
    mesh.userData.own = true;
    mesh.userData.pick = key;
    const at = cardSpot(column, columns);
    mesh.scale.set(CARD_W, CARD_D, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(at.x, 0.02 + (marks.selected.has(key) ? 0.05 : 0), at.z);
    this.layer.add(mesh);
    this.pickables.push(mesh);
    if (marks.selectable.has(key) || marks.selected.has(key)) {
      const frame = new Mesh(this.assets.plane, this.assets.frameMaterial(marks.selected.has(key)));
      frame.scale.set(CARD_W + 0.35, CARD_D + 0.35, 1);
      frame.rotation.x = -Math.PI / 2;
      frame.position.set(at.x, 0.015, at.z);
      this.layer.add(frame);
    }
  }

  private addToken(column: number, columns: number, seat: number, index: number): void {
    const at = cardSpot(column, columns);
    const material = this.assets.material(`token:${seat}`, () => new MeshStandardMaterial({ color: seatColor(seat), roughness: 0.4 }));
    const mesh = new Mesh(this.assets.token[seat % 4]!, material);
    mesh.scale.setScalar(1.3);
    mesh.position.set(at.x - CARD_W / 2 + 0.6 + index * 0.8, 0.14, at.z + CARD_D / 2 - 0.6);
    this.layer.add(mesh);
  }

  /** A die at `at`; `ident` follows it from view to view (seat and reserve index) so it slides when it changes place. */
  private addDie(key: PickKey, ident: string | null, kind: Kind, face: number | null, at: { x: number; z: number; size: number }, marks: Marks, alpha: number): void {
    const size = at.size;
    const root = new Group();
    const tumbler = new Group();
    const body = new Mesh(this.assets.body, this.assets.bodyMaterial(kind, alpha));
    tumbler.add(body);
    // A die off the hand shows its highest printed face; a rolled die shows the face it rolled.
    const top = face ?? Math.max(...KIND_FACES[kind]);
    const faceMesh = new Mesh(this.assets.top, this.assets.faceMaterial(kind, top, alpha));
    faceMesh.rotation.x = -Math.PI / 2;
    faceMesh.position.y = 0.502;
    tumbler.add(faceMesh);
    tumbler.position.y = 0.5;
    root.add(tumbler);
    root.scale.setScalar(size);
    const selected = marks.selected.has(key);
    root.position.set(at.x, selected ? 0.3 : 0, at.z);
    this.layer.add(root);
    // Clicks hit a still box at the die's place, not the die, which may be sliding or tumbling there.
    const hit = new Mesh(this.assets.body, this.assets.hit);
    hit.userData.pick = key;
    hit.scale.setScalar(size);
    hit.position.set(at.x, size / 2, at.z);
    this.layer.add(hit);
    this.pickables.push(hit);
    this.spots.set(key, at);
    let frame: Mesh | null = null;
    if (selected || marks.selectable.has(key)) {
      frame = new Mesh(this.assets.plane, this.assets.frameMaterial(selected));
      frame.scale.setScalar(size * 1.32);
      frame.rotation.x = -Math.PI / 2;
      frame.position.set(at.x, 0.02, at.z);
      this.layer.add(frame);
    }
    if (ident !== null) {
      const before = this.places.get(ident);
      this.nextPlaces.set(ident, { x: at.x, z: at.z });
      if (before && Math.hypot(before.x - at.x, before.z - at.z) > 0.05 && !this.options.reducedMotion()) this.slide(root, frame, before, at);
    }
    if (face === null) return;
    const was = this.faces.get(key);
    this.faces.set(key, { kind, face });
    if (was && was.kind === kind && was.face === face) return;
    if (this.options.reducedMotion()) return;
    this.tumble({ root, tumbler, kind, face });
  }

  /** Moves a die (and its frame) from where it was to its new place. */
  private slide(root: Group, frame: Mesh | null, from: { x: number; z: number }, to: { x: number; z: number }): void {
    const place = (t: number) => {
      const e = easeOut(t);
      const x = from.x + (to.x - from.x) * e;
      const z = from.z + (to.z - from.z) * e;
      root.position.x = x;
      root.position.z = z;
      frame?.position.set(x, frame.position.y, z);
    };
    place(0);
    void tween(420, place);
  }

  private tumble(die: DieMesh): void {
    const axis = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    const turns = 2 + Math.floor(Math.random() * 2);
    const base = die.root.position.y;
    void tween(520, (t) => {
      const e = easeOut(t);
      die.tumbler.setRotationFromAxisAngle(axis, (1 - e) * turns * Math.PI * 2);
      die.root.position.y = base + Math.sin(Math.PI * t) * 1.4;
    });
  }

  private readonly click = (event: MouseEvent) => {
    this.layer.updateMatrixWorld();
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    const key = hit?.object.userData.pick as PickKey | undefined;
    if (key) this.options.onPick(key);
  };

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const half = Math.tan(((this.camera.fov / 2) * Math.PI) / 180);
    const distance = 1.04 * Math.max((TABLE_D + 1.5) / 2 / half, (TABLE_W + 1.5) / 2 / (half * this.camera.aspect));
    const tilt = 0.28;
    this.camera.position.set(0, distance * Math.cos(tilt), distance * Math.sin(tilt));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private readonly frame = () => {
    this.renderer.render(this.scene, this.camera);
    this.loop = requestAnimationFrame(this.frame);
  };
}
