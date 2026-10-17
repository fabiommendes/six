import { Board3D } from "../board/board3d";
import { COMPACT_BELOW } from "../board/layout";
import { adaptWorker, WorkerBot } from "../bot/client";
import type { BotPlayer } from "../bot/client";
import type { Cell } from "../engine/cells";
import type { Command, SeksGame, Side } from "../engine/game";
import { Match, type Mode, type Seed } from "../logic/match";
import type { Session } from "../logic/session";
import { drawStatus } from "../logic/status";
import {
  APP,
  BUTTONS,
  COUNTER,
  LEGEND,
  SIDE_NAME,
  boardLabel,
  diceCount,
  hint,
  lastPlayText,
  modeLine,
  repetitionWarning,
  resultText,
  sideTag,
  turnSubtitle,
  turnTitle,
  type Gesture,
} from "../logic/texts";
import { esc, need } from "./dom";
import { flyToPanel } from "./flight";
import { brandMark, dieIcon, markIcon, motifStrip, tally } from "./svg";

export interface GameScreenOptions {
  readonly mode: Mode;
  readonly game: SeksGame;
  readonly seed?: Seed;
  /** A die to select once the match starts (a loaded position). */
  readonly select?: Cell | null;
  /** From how many plies without capture the count shows. */
  readonly counterFrom?: number;
  /** The bot, when `mode` is against it. */
  readonly bot: BotPlayer | null;
  /** Commands already played from `game` (a match that resumes), replayed without animation. */
  readonly resume?: readonly Command[];
  /** Whether the camera starts tilted. */
  readonly tilted?: boolean;
  /** Called with what it takes to open this match again, at every change of it. */
  readonly onSession?: (session: Session) => void;
  /** The player asked for a new game. */
  readonly onNewGame: () => void;
}

const SKELETON = `
  <div class="board-wrap"><div class="board" id="board"></div></div>
  <div class="panel">
    <div class="head top">
      <div>
        <div class="brand"><span class="mark"></span>${APP.brand}<span class="of">${APP.ofSix}</span></div>
        <h1>${APP.title}</h1>
      </div>
      <div class="turn mobile-turn"></div>
    </div>
    <p class="sub"></p>
    <div class="band wide"></div>
    <div class="rest">
      <div class="turn desk-turn"></div>
      <p class="note" aria-live="polite"></p>
      <p class="note warn" hidden></p>
      <div class="last"></div>
      <div class="sides"></div>
      <div class="count" hidden></div>
      <div class="legend"></div>
      <div class="actions">
        <button type="button" data-action="undo">${BUTTONS.undo}</button>
        <button type="button" data-action="tilt" aria-pressed="false">${BUTTONS.tiltOn}</button>
        <button type="button" data-action="new">${BUTTONS.newGame}</button>
      </div>
    </div>
    <div class="foot"></div>
    <p class="foot-cap">${esc(APP.caption).replace("seks", "<i>seks</i>")}</p>
  </div>`;

/** The screen of a match: the board in Three.js and the panel of the sketch around it. */
export class GameScreen {
  private readonly match: Match;
  private readonly board: Board3D | null;
  private readonly gesture: Gesture;
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private tilted = false;
  private readonly off: (() => void)[] = [];
  private bandWidth = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly options: GameScreenOptions,
  ) {
    this.gesture = matchMedia("(pointer: coarse)").matches ? "toque" : "clique";
    host.className = "screen";
    host.innerHTML = SKELETON;
    need(host, ".brand .mark").innerHTML = brandMark(26);
    need(host, ".legend").innerHTML = this.legend();

    const container = need(host, "#board");
    let board: Board3D | null = null;
    try {
      board = new Board3D(container, {
        reducedMotion: () => this.reducedMotion.matches,
        flyCaptured: (flight) => flyToPanel(flight, host.querySelector<HTMLElement>(`.side[data-side="${flight.side}"] .cap`)),
        onCell: (cell) => void this.onCell(cell),
      });
    } catch {
      container.innerHTML = `<p class="board-error">Não foi possível iniciar o gráfico 3D neste navegador.</p>`;
    }
    this.board = board;
    // The board needs a stage even when it has no WebGL: the match still runs, unseen.
    const stage = board ?? {
      show() {},
      setMarks() {},
      animate: () => Promise.resolve(),
    };
    this.match = new Match(options.game, options.mode, stage, options.bot, options.seed);
    if (board) board.canActivate = (cell) => this.canActivate(cell);
    if (options.resume) this.match.resume(options.resume);
    if (options.tilted) {
      this.tilted = true;
      board?.setTilted(true, true);
    }

    this.off.push(
      this.match.subscribe((snapshot) => {
        this.render(snapshot);
        this.persist();
      }),
    );
    host.addEventListener("click", this.onButton);
    document.addEventListener("pointerdown", this.onOutside);
    const observer = new ResizeObserver(() => this.drawStrips());
    observer.observe(need(host, ".panel"));
    this.off.push(() => observer.disconnect());
    this.render(this.match.snapshot());
  }

  /** Starts the match: shows the position and, if the bot plays first, asks it. */
  async start(): Promise<void> {
    const started = this.match.start();
    if (this.options.select) await this.match.click(this.options.select);
    await started;
  }

  dispose(): void {
    this.match.dispose();
    this.board?.dispose();
    this.options.bot?.dispose();
    for (const off of this.off) off();
    this.host.removeEventListener("click", this.onButton);
    document.removeEventListener("pointerdown", this.onOutside);
    this.host.className = "";
    this.host.innerHTML = "";
  }

  private persist(): void {
    this.options.onSession?.({ mode: this.options.mode, ...this.match.record(), seed: this.options.seed ?? {}, tilted: this.tilted });
  }

  private canActivate(cell: Cell): boolean {
    const snapshot = this.match.snapshot();
    if (!snapshot.humanToMove || snapshot.busy || snapshot.thinking) return false;
    const die = snapshot.view.dice.find((d) => d.cell === cell);
    return (die !== undefined && die.side === snapshot.view.to_move) || (snapshot.selection?.moves.includes(cell) ?? false);
  }

  private async onCell(cell: Cell | null): Promise<void> {
    if (cell === null) this.match.clearSelection();
    else await this.match.click(cell);
  }

  private readonly onButton = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "undo") this.match.undo();
    else if (action === "new") this.options.onNewGame();
    else if (action === "tilt") {
      this.tilted = !this.tilted;
      this.board?.setTilted(this.tilted);
      this.render(this.match.snapshot());
      this.persist();
    }
  };

  /** A press outside the board and the buttons clears the selection too. */
  private readonly onOutside = (event: PointerEvent) => {
    const target = event.target as Element | null;
    if (target && !target.closest("canvas, button, a, input, label, select")) this.match.clearSelection();
  };

  private legend(): string {
    const item = (mark: Parameters<typeof markIcon>[0], text: string) => `<span>${markIcon(mark)}${text}</span>`;
    return item("selected", LEGEND.selected) + item("destination", LEGEND.destination) + item("origin", LEGEND.origin) + item("last", LEGEND.last);
  }

  /** The strips of motif of the panel, as wide as the panel. */
  private drawStrips(): void {
    const panel = need(this.host, ".panel");
    const width = Math.floor(panel.clientWidth) || 492;
    if (width === this.bandWidth) return;
    this.bandWidth = width;
    need(this.host, ".band").innerHTML = motifStrip("thin", width, 3);
    need(this.host, ".foot").innerHTML = motifStrip("band", width, 3.6);
  }

  private render(snapshot: ReturnType<Match["snapshot"]>): void {
    const host = this.host;
    const compact = window.innerWidth <= COMPACT_BELOW;
    const view = snapshot.view;
    const over = view.outcome !== null;
    const iconSize = compact ? 22 : 40;
    this.drawStrips();

    need(host, ".sub").textContent = modeLine(snapshot.mode);
    need(host, "#board").setAttribute("aria-label", boardLabel(snapshot));

    // The turn, or the end of the game.
    const title = over ? "Fim da partida" : turnTitle(view.to_move);
    const turnIcon = over ? "" : dieIcon(6, view.to_move, iconSize);
    need(host, ".desk-turn").innerHTML = `<span>${turnIcon}</span><div><div class="who">${esc(title)}</div><div class="what">${esc(turnSubtitle(snapshot))}</div></div>`;
    need(host, ".mobile-turn").innerHTML = `${over ? "" : dieIcon(6, view.to_move, 22)}<div class="who">${esc(title)}</div>`;

    // The note: what to do, or how the game ended.
    const note = need(host, ".note:not(.warn)");
    note.classList.toggle("result", over);
    if (view.outcome !== null) {
      const result = resultText(view.outcome, view);
      note.innerHTML = `<b>${esc(result.title)}.</b> ${esc(result.reason)}`;
    } else {
      const text = hint(snapshot, this.gesture);
      note.innerHTML = `${text.strong ? `<b>${esc(text.strong)}</b> ` : ""}${esc(text.rest)}`;
    }
    const warning = repetitionWarning(snapshot);
    const warn = need(host, ".warn");
    warn.hidden = warning === null;
    warn.textContent = warning ?? "";

    const last = need(host, ".last");
    last.innerHTML = snapshot.last
      ? `<span>${markIcon("origin", 20)} ${markIcon("last", 20)}</span>${esc(lastPlayText(snapshot.last))}`
      : "";

    need(host, ".sides").innerHTML = (["black", "white"] as const).map((side) => this.sideRow(snapshot, side)).join("");

    // The count of plies without a capture, from 80.
    const status = drawStatus(view, this.options.counterFrom);
    const count = need(host, ".count");
    count.hidden = !status.showCounter;
    if (status.showCounter) {
      const width = Math.min(need(host, ".panel").clientWidth || 492, 492);
      count.innerHTML = `<div class="num">${status.plies}</div><div class="lbl">${COUNTER.label}<br><span>${esc(COUNTER.limit(status.max))}</span></div><div class="tally">${tally(status.plies, status.max, compact ? Math.min(362, width) : width)}</div>`;
    }

    need<HTMLButtonElement>(host, '[data-action="undo"]').disabled = !snapshot.canUndo;
    const tilt = need<HTMLButtonElement>(host, '[data-action="tilt"]');
    tilt.textContent = this.tilted ? BUTTONS.tiltOff : BUTTONS.tiltOn;
    tilt.setAttribute("aria-pressed", String(this.tilted));
    host.classList.toggle("thinking", snapshot.thinking);
  }

  private sideRow(snapshot: ReturnType<Match["snapshot"]>, side: Side): string {
    const compact = window.innerWidth <= COMPACT_BELOW;
    const count = snapshot.view.dice.filter((die) => die.side === side).length;
    const active = snapshot.view.outcome === null && snapshot.view.to_move === side;
    const tag = sideTag(snapshot.mode, side);
    const captured = snapshot.captured.filter((die) => die.side === side).map((die) => dieIcon(die.value, side, compact ? 20 : 26)).join("");
    return `<div class="side${active ? " active" : ""}" data-side="${side}">
      <span>${dieIcon(6, side, compact ? 18 : 24)}</span>
      <div><span class="name">${SIDE_NAME[side]}</span><span class="n">${diceCount(count)}${tag ? ` · ${tag}` : ""}</span>${active ? '<span class="now">JOGA AGORA</span>' : ""}</div>
      <div class="cap">capturado <span class="cap-dice">${captured}</span></div>
    </div>`;
  }
}

/** A bot in a real Web Worker (bot/worker.ts). */
export function spawnBot(): BotPlayer {
  return new WorkerBot(() => adaptWorker(new Worker(new URL("../bot/worker.ts", import.meta.url), { type: "module" })), 500);
}
