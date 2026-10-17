import { Board3D } from "../board/board3d";
import { COMPACT_BELOW } from "../board/layout";
import { adaptWorker, WorkerBot } from "../bot/client";
import type { BotPlayer } from "../bot/client";
import { DEFAULT_BOT_LEVEL } from "../bot/levels";
import type { BotLevelId } from "../bot/protocol";
import type { Cell } from "../engine/cells";
import type { Command, SeksGame, Side } from "../engine/game";
import { Match, type Mode, type Seed } from "../logic/match";
import type { Session } from "../logic/session";
import type { LiveStatus } from "../net/live-session";
import { drawStatus } from "../logic/status";
import {
  APP,
  BUTTONS,
  COUNTER,
  LEGEND,
  LIVE,
  MAIL,
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
import { ConfirmDialog, type Question } from "./confirm-dialog";
import { esc, need } from "./dom";
import { EndCardView } from "./end-card";
import { flyToPanel } from "./flight";
import { LivePanel } from "./live-panel";
import { MailPanel } from "./mail-panel";
import { brandMark, dieIcon, markIcon, motifStrip, tally } from "./svg";

/** What a match by correspondence needs from the page around it (the links and the saved list). */
export interface MailOptions {
  /** The URL of the link for these commands; `left` for the link that tells the player resigned. */
  readonly linkFor: (commands: readonly Command[], left: boolean) => string;
  /** How many of the plies the opponent already has (they cannot be undone). */
  readonly shared: number;
  /** The side that left the game, if the opponent told so in a link. */
  readonly leftBy: Side | null;
  /** Called at every change, to keep the game in the saved list. */
  readonly onChange: (change: { commands: readonly Command[]; shared: number; toMove: Side; over: boolean }) => void;
  /** The game was resigned and the link that tells it has not been sent yet: the game stays in the saved list. */
  readonly resigned?: boolean;
  /** The player resigned: the saved game is marked, so a reload still has the link to send. */
  readonly onResign: () => void;
  /** The link of the resignation was copied or shared: the game leaves the saved list. */
  readonly onResignSent: () => void;
  /** The opponent left and the player goes on against the bot, from this position. */
  readonly onContinue: (level: BotLevelId) => void;
  /** The opponent left and the player ends the game. */
  readonly onEnd: () => void;
}

/** What a live match needs from the page around it (the session, the saved list and the way out). */
export interface LiveOptions {
  /** The link that invites the other player, to show until they come; `null` for the one who was invited. */
  readonly invite: string | null;
  /** The human made a play (it is the last of the match): tell the other player. */
  readonly onPlay: () => void;
  /** Called at every change, to keep the game in the saved list. */
  readonly onChange: (change: { commands: readonly Command[]; toMove: Side; over: boolean }) => void;
  /** The player confirmed "Desistir". */
  readonly onResign: () => void;
  /** The player chose to go on by correspondence. */
  readonly onFallback: () => void;
}

/** How the connection of a live match looks on the panel. */
export interface LiveView {
  readonly status: LiveStatus;
  /** Correspondence is offered. */
  readonly offered: boolean;
  /** Why the room could not be joined, if it could not. */
  readonly error: string | null;
}

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
  /** Called when the player switches the view, with whether it is now tilted. */
  readonly onTilt?: (tilted: boolean) => void;
  /** The side the board is seen from at the start (a match that resumes); by default, the side the player should see. */
  readonly viewpoint?: Side;
  /** Called with what it takes to open this match again, at every change of it. */
  readonly onSession?: (session: Session) => void;
  /** A notice to show above the panel (for example, a link older than the game kept here). */
  readonly notice?: string;
  /** The match by correspondence; `mode` must be `correspondence`. */
  readonly mail?: MailOptions;
  /** The live match; `mode` must be `live`. */
  readonly live?: LiveOptions;
  /** Makes a bot for "Terminar com bots", when the match has none of its own. */
  readonly spawnBot?: () => BotPlayer;
  /** The player asked for a new game. */
  readonly onNewGame: () => void;
}

const SKELETON = `
  <div class="board-wrap">
    <div class="board" id="board"></div>
    ${EndCardView.html}
  </div>
  <div class="panel">
    <div class="head top">
      <div>
        <div class="brand"><span class="mark"></span>${APP.brand}</div>
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
      ${LivePanel.html}
      ${MailPanel.html}
      ${ConfirmDialog.html}
      <div class="last"></div>
      <div class="sides"></div>
      <div class="count" hidden></div>
      <div class="legend"></div>
      <div class="actions">
        <button type="button" data-action="undo">${BUTTONS.undo}</button>
        <button type="button" data-action="tilt" aria-pressed="false">${BUTTONS.tiltOn}</button>
        <button type="button" data-action="resign" hidden>${BUTTONS.resign}</button>
        <button type="button" data-action="leave" hidden>${BUTTONS.leave}</button>
        <button type="button" data-action="stop-bots" hidden>${BUTTONS.stopBots}</button>
        <button type="button" data-action="new">${BUTTONS.newGame}</button>
      </div>
    </div>
    <div class="foot"></div>
  </div>`;

/** The screen of a match: the board in Three.js and the panel of the sketch around it. */
export class GameScreen {
  private readonly match: Match;
  private readonly board: Board3D | null;
  private readonly gesture: Gesture;
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private tilted = false;
  /** The side the board is seen from: the human's against the bot, the side to move in hotseat. */
  private viewpoint: Side = "white";
  private readonly off: (() => void)[] = [];
  private bandWidth = 0;
  /** Plies the opponent has, in a match by correspondence. */
  private shared = 0;
  /** The URL to send when the player resigned (a match by correspondence); `null` while in. */
  private resignedLink: string | null = null;
  private readonly confirm: ConfirmDialog;
  private readonly mailPanel: MailPanel;
  private readonly livePanel: LivePanel;
  private liveView: LiveView = { status: "connecting", offered: false, error: null };
  private readonly endView: EndCardView;
  /** The bot made to play both sides when the player chose to finish with bots (a hotseat match has none of its own). */
  private extraBot: BotPlayer | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly options: GameScreenOptions,
  ) {
    this.gesture = matchMedia("(pointer: coarse)").matches ? "toque" : "clique";
    host.className = "screen";
    host.innerHTML = SKELETON;
    this.confirm = new ConfirmDialog(host);
    this.endView = new EndCardView(host);
    this.livePanel = new LivePanel(host);
    this.mailPanel = new MailPanel(host, {
      link: () => this.currentLink(),
      resigned: () => this.resignedLink !== null,
      onSent: () => this.markShared(),
      onResignSent: () => options.mail?.onResignSent(),
      onContinue: (level) => options.mail?.onContinue(level),
      onEnd: () => options.mail?.onEnd(),
    });
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
    if (options.live) this.off.push(this.match.onHumanPlay(() => options.live?.onPlay()));
    this.shared = options.mail?.shared ?? 0;
    if (options.mail?.resigned) this.resignedLink = options.mail.linkFor(options.resume ?? [], true);
    if (options.resume) this.match.resume(options.resume, options.mail ? this.shared : undefined);
    if (options.tilted) {
      this.tilted = true;
      board?.setTilted(true, true);
    }

    const first = this.match.snapshot();
    this.viewpoint = options.viewpoint ?? this.sideToSee(first);
    if (this.viewpoint !== "white") board?.setViewpoint(this.viewpoint, true);

    this.off.push(
      this.match.subscribe((snapshot) => {
        this.follow(snapshot);
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

  /** The commands played so far, from the standard position (a live match is never from another). */
  commands(): readonly Command[] {
    return this.match.record().commands;
  }

  /** The hash of the position now. */
  hash(): string {
    return this.options.game.hash();
  }

  /** Plays what the other player of a live match played. Throws, touching nothing, if it is not legal now. */
  playRemote(command: Command): void {
    void this.match.playRemote(command).catch(() => undefined);
  }

  /** Shows where the connection of a live match stands. */
  setLive(view: LiveView): void {
    this.liveView = view;
    this.render(this.match.snapshot());
  }

  dispose(): void {
    this.match.dispose();
    this.board?.dispose();
    this.options.bot?.dispose();
    this.extraBot?.dispose();
    for (const off of this.off) off();
    this.host.removeEventListener("click", this.onButton);
    document.removeEventListener("pointerdown", this.onOutside);
    this.host.className = "";
    this.host.innerHTML = "";
  }

  private persist(): void {
    const mode = this.options.mode;
    if (this.match.mode.kind === "bots") return;
    if (mode.kind === "live") {
      const view = this.match.snapshot().view;
      this.options.live?.onChange({ commands: this.match.record().commands, toMove: view.to_move, over: view.outcome !== null });
      return;
    }
    if (mode.kind === "correspondence") {
      if (this.resignedLink !== null) return;
      const view = this.match.snapshot().view;
      this.options.mail?.onChange({ commands: this.match.record().commands, shared: this.shared, toMove: view.to_move, over: view.outcome !== null });
      return;
    }
    if (mode.kind === "bots") return;
    this.options.onSession?.({ mode, ...this.match.record(), seed: this.options.seed ?? {}, tilted: this.tilted, viewpoint: this.viewpoint });
  }

  /** The player cannot move: they resigned, or the opponent left. */
  private get frozen(): boolean {
    return this.resignedLink !== null || (this.options.mail?.leftBy ?? null) !== null;
  }

  /** The side to see the board from: the human's against the bot; in hotseat the side to move, or the same one when the game is over. */
  private sideToSee(snapshot: ReturnType<Match["snapshot"]>): Side {
    if (snapshot.mode.kind === "bots") return this.viewpoint;
    if (snapshot.mode.kind !== "hotseat") return snapshot.mode.human;
    return snapshot.view.outcome === null ? snapshot.view.to_move : this.viewpoint;
  }

  /** Turns the board to the side to see once a play is over, not while its dice are still moving. */
  private follow(snapshot: ReturnType<Match["snapshot"]>): void {
    if (snapshot.busy) return;
    const side = this.sideToSee(snapshot);
    if (side === this.viewpoint) return;
    this.viewpoint = side;
    this.board?.setViewpoint(side);
  }

  private canActivate(cell: Cell): boolean {
    const snapshot = this.match.snapshot();
    if (this.frozen || !snapshot.humanToMove || snapshot.busy || snapshot.thinking) return false;
    const die = snapshot.view.dice.find((d) => d.cell === cell);
    return (die !== undefined && die.side === snapshot.view.to_move) || (snapshot.selection?.moves.includes(cell) ?? false);
  }

  private async onCell(cell: Cell | null): Promise<void> {
    if (this.frozen) return;
    if (cell === null) this.match.clearSelection();
    else await this.match.click(cell);
  }

  private readonly onButton = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "undo") this.match.undo();
    else if (action === "new") this.options.onNewGame();
    else if (action === "dismiss-end") {
      this.endView.dismiss();
      this.render(this.match.snapshot());
    } else if (action === "resign") this.ask("resign");
    else if (action === "leave") this.ask("leave");
    else if (action === "stop-bots") this.match.stopBots();
    else if (action === "finish-with-bots") this.finishWithBots();
    else if (action === "cancel") this.ask(null);
    else if (action === "confirm-resign") this.resign();
    else if (action === "fallback") this.options.live?.onFallback();
    else if (this.mailPanel.handle(action)) return;
    else if (action === "tilt") {
      this.tilted = !this.tilted;
      this.board?.setTilted(this.tilted);
      this.render(this.match.snapshot());
      this.persist();
      this.options.onTilt?.(this.tilted);
    }
  };

  /** The bots play the rest of the game, both sides, while the player watches. */
  private finishWithBots(): void {
    const bot = this.options.bot ?? (this.extraBot ??= this.options.spawnBot?.() ?? null);
    this.confirm.set(null);
    if (bot === null) {
      this.render(this.match.snapshot());
      return;
    }
    void this.match.finishWithBots(bot, DEFAULT_BOT_LEVEL);
  }

  private ask(question: Question | null): void {
    this.confirm.set(question);
    this.render(this.match.snapshot());
  }

  /** The player leaves the game: it goes out of the list and the link that tells the opponent stays here. */
  private resign(): void {
    if (this.options.live) {
      this.confirm.set(null);
      this.options.live.onResign();
      return;
    }
    const mail = this.options.mail;
    if (!mail || this.resignedLink !== null) return;
    this.resignedLink = mail.linkFor(this.match.record().commands, true);
    this.confirm.set(null);
    mail.onResign();
    this.render(this.match.snapshot());
  }

  /** The URL to send now: the plies played, or the notice of the resignation. */
  private currentLink(): string {
    if (this.options.live) return this.options.live.invite ?? "";
    return this.resignedLink ?? this.options.mail?.linkFor(this.match.record().commands, false) ?? "";
  }

  /** The opponent has the plies once the link was copied or shared: from then on they cannot be undone. */
  private markShared(): void {
    if (this.options.live) return;
    this.shared = this.match.record().commands.length;
    this.match.lock();
  }

  /** Whether a match by correspondence waits for the other player: the link is to be sent. */
  private mailWaiting(snapshot: ReturnType<Match["snapshot"]>): boolean {
    if (this.options.mail === undefined || this.options.mail.leftBy !== null) return false;
    if (snapshot.view.outcome !== null) return snapshot.last !== null && snapshot.mode.kind === "correspondence" && snapshot.last.side === snapshot.mode.human;
    return !snapshot.humanToMove;
  }

  /** The parts of the panel that depend on the kind of match: the link, the confirmation, the buttons and the end card. */
  private renderSession(snapshot: ReturnType<Match["snapshot"]>): void {
    const host = this.host;
    const mail = this.options.mail;
    const over = snapshot.view.outcome !== null;
    const live = this.options.live;
    const left = mail?.leftBy ?? null;
    const showLeft = left !== null && this.resignedLink === null;
    const inviting = live?.invite != null && this.liveView.status !== "connected" && !over && this.match.record().commands.length === 0;
    this.mailPanel.render({ showLink: inviting || this.resignedLink !== null || this.mailWaiting(snapshot), showLeft, over, notice: this.options.notice });
    if (live) this.livePanel.render({ ...this.liveView, inviting, over });
    // While the invite is shown the panel says what to do; the hint on the board waits for the other player.
    need(host, ".note:not(.warn)").hidden = inviting;
    // Live there is no undo: the other player has the play as soon as it is made.
    need<HTMLButtonElement>(host, '[data-action="undo"]').hidden = live !== undefined;
    need<HTMLButtonElement>(host, '[data-action="resign"]').hidden = (!mail && !live) || this.frozen || over;
    this.confirm.render(this.options.bot !== null || this.options.spawnBot !== undefined, live ? LIVE.resignAsk : MAIL.resignAsk);

    // Against the other player's absence the note says what happened.
    const note = need(host, ".note:not(.warn)");
    if (this.resignedLink !== null) note.innerHTML = `<b>${esc(MAIL.resignedTitle)}</b> ${esc(MAIL.resignedRest)}`;
    else if (showLeft && left !== null) note.innerHTML = `<b>${esc(MAIL.leftTitle(left))}</b> ${esc(over ? MAIL.leftOverRest : MAIL.leftRest)}`;
    if (this.frozen) need<HTMLButtonElement>(host, '[data-action="undo"]').disabled = true;
    const home = mail || live ? BUTTONS.home : BUTTONS.newGame;
    const local = snapshot.mode.kind === "hotseat" || snapshot.mode.kind === "bot";
    const leaving = local && !over;
    const watching = snapshot.mode.kind === "bots" && !snapshot.mode.stopped && !over;
    need(host, '[data-action="leave"]').hidden = !leaving;
    need(host, '[data-action="stop-bots"]').hidden = !watching;
    need(host, '.actions [data-action="new"]').hidden = leaving || watching;
    need(host, '.actions [data-action="new"]').textContent = home;
    this.endView.render(snapshot, home, this.mailWaiting(snapshot), this.viewpoint);
  }

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

    // The side the board is seen from is at the bottom, as on the board.
    const order = this.viewpoint === "white" ? (["black", "white"] as const) : (["white", "black"] as const);
    need(host, ".sides").innerHTML = order.map((side) => this.sideRow(snapshot, side)).join("");

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
    this.renderSession(snapshot);
  }

  private sideRow(snapshot: ReturnType<Match["snapshot"]>, side: Side): string {
    const compact = window.innerWidth <= COMPACT_BELOW;
    const count = snapshot.view.dice.filter((die) => die.side === side).length;
    const active = snapshot.view.outcome === null && snapshot.view.to_move === side;
    const tag = sideTag(snapshot.mode, side);
    const captured = snapshot.captured.filter((die) => die.side === side).map((die) => dieIcon(die.value, side, 20)).join("");
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
