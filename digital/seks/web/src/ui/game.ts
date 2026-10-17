import { Board3D } from "../board/board3d";
import { COMPACT_BELOW } from "../board/layout";
import { adaptWorker, WorkerBot } from "../bot/client";
import type { BotPlayer } from "../bot/client";
import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../bot/levels";
import type { BotLevelId } from "../bot/protocol";
import type { Cell } from "../engine/cells";
import type { Command, SeksGame, Side } from "../engine/game";
import { Match, type Mode, type Seed } from "../logic/match";
import type { Session } from "../logic/session";
import { drawStatus } from "../logic/status";
import {
  APP,
  BUTTONS,
  COUNTER,
  endCard,
  LEGEND,
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
import { esc, need } from "./dom";
import { flyToPanel } from "./flight";
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
  /** The player resigned: the game leaves the saved list (the link to send stays on the screen). */
  readonly onResign: () => void;
  /** The opponent left and the player goes on against the bot, from this position. */
  readonly onContinue: (level: BotLevelId) => void;
  /** The opponent left and the player ends the game. */
  readonly onEnd: () => void;
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
  /** Makes a bot for "Terminar com bots", when the match has none of its own. */
  readonly spawnBot?: () => BotPlayer;
  /** The player asked for a new game. */
  readonly onNewGame: () => void;
}

const SKELETON = `
  <div class="board-wrap">
    <div class="board" id="board"></div>
    <div class="end-card" role="dialog" aria-label="Fim da partida" hidden>
      <h2 class="end-title"></h2>
      <p class="end-reason"></p>
      <p class="end-extra" hidden></p>
      <div class="end-buttons">
        <button type="button" data-action="new"></button>
        <button type="button" data-action="dismiss-end">${BUTTONS.viewBoard}</button>
      </div>
    </div>
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
      <p class="notice" hidden></p>
      <div class="mail" hidden>
        <input class="mail-link" type="text" readonly aria-label="${MAIL.linkLabel}">
        <div class="mail-buttons">
          <button type="button" data-action="copy">${MAIL.copy}</button>
          <button type="button" data-action="share" hidden>${MAIL.share}</button>
        </div>
        <p class="mail-status" aria-live="polite"></p>
      </div>
      <div class="left" hidden>
        <label class="left-level">${MAIL.levelLabel} <select>${BOT_LEVELS.map((level) => `<option value="${level.id}"${level.id === DEFAULT_BOT_LEVEL.id ? " selected" : ""}>${level.label}</option>`).join("")}</select></label>
        <div class="left-buttons">
          <button type="button" data-action="continue">${MAIL.continueWithBot}</button>
          <button type="button" data-action="end">${MAIL.end}</button>
        </div>
      </div>
      <div class="ask" role="alertdialog" aria-live="polite" hidden>
        <p class="ask-text"></p>
        <div class="ask-buttons"></div>
      </div>
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
  /** What the confirmation under the panel asks, if it is open. */
  private asking: "resign" | "leave" | null = null;
  /** The bot made to play both sides when the player chose to finish with bots (a hotseat match has none of its own). */
  private extraBot: BotPlayer | null = null;
  private mailLinkShown = "";
  /** The player closed the card of the end of the game to look at the board. */
  private endDismissed = false;

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
    this.shared = options.mail?.shared ?? 0;
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
      this.endDismissed = true;
      this.render(this.match.snapshot());
    } else if (action === "resign") this.ask("resign");
    else if (action === "leave") this.ask("leave");
    else if (action === "stop-bots") this.match.stopBots();
    else if (action === "finish-with-bots") this.finishWithBots();
    else if (action === "cancel") this.ask(null);
    else if (action === "confirm-resign") this.resign();
    else if (action === "copy") void this.copyLink();
    else if (action === "share") void this.shareLink();
    else if (action === "continue") this.options.mail?.onContinue(this.chosenLevel());
    else if (action === "end") this.options.mail?.onEnd();
    else if (action === "tilt") {
      this.tilted = !this.tilted;
      this.board?.setTilted(this.tilted);
      this.render(this.match.snapshot());
      this.persist();
      this.options.onTilt?.(this.tilted);
    }
  };

  private chosenLevel(): BotLevelId {
    const value = need<HTMLSelectElement>(this.host, ".left-level select").value;
    return (BOT_LEVELS.find((level) => level.id === value) ?? DEFAULT_BOT_LEVEL).id;
  }

  /** The bots play the rest of the game, both sides, while the player watches. */
  private finishWithBots(): void {
    const bot = this.options.bot ?? (this.extraBot ??= this.options.spawnBot?.() ?? null);
    this.asking = null;
    if (bot === null) {
      this.render(this.match.snapshot());
      return;
    }
    void this.match.finishWithBots(bot, DEFAULT_BOT_LEVEL);
  }

  private ask(question: "resign" | "leave" | null): void {
    this.asking = question;
    this.render(this.match.snapshot());
  }

  /** The player leaves the game: it goes out of the list and the link that tells the opponent stays here. */
  private resign(): void {
    const mail = this.options.mail;
    if (!mail || this.resignedLink !== null) return;
    this.resignedLink = mail.linkFor(this.match.record().commands, true);
    this.asking = null;
    mail.onResign();
    this.render(this.match.snapshot());
  }

  /** The URL to send now: the plies played, or the notice of the resignation. */
  private currentLink(): string {
    return this.resignedLink ?? this.options.mail?.linkFor(this.match.record().commands, false) ?? "";
  }

  private setMailStatus(text: string): void {
    need(this.host, ".mail-status").textContent = text;
  }

  /** The opponent has the plies once the link was copied or shared: from then on they cannot be undone. */
  private markShared(): void {
    this.shared = this.match.record().commands.length;
    this.match.lock();
  }

  private async copyLink(): Promise<void> {
    const input = need<HTMLInputElement>(this.host, ".mail-link");
    const link = this.currentLink();
    let copied = false;
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
    } catch {
      input.select();
      copied = document.execCommand?.("copy") ?? false;
    }
    if (!copied) {
      input.select();
      this.setMailStatus(MAIL.copyFailed);
      return;
    }
    this.setMailStatus(MAIL.copied);
    if (this.resignedLink === null) this.markShared();
  }

  private async shareLink(): Promise<void> {
    try {
      await navigator.share({ title: MAIL.shareTitle, text: this.resignedLink === null ? MAIL.shareText : MAIL.shareLeftText, url: this.currentLink() });
    } catch {
      // The player closed the sheet: nothing was sent.
      return;
    }
    this.setMailStatus(MAIL.sharedDone);
    if (this.resignedLink === null) this.markShared();
  }

  /** Whether a match by correspondence waits for the other player: the link is to be sent. */
  private mailWaiting(snapshot: ReturnType<Match["snapshot"]>): boolean {
    if (this.options.mail === undefined || this.options.mail.leftBy !== null) return false;
    if (snapshot.view.outcome !== null) return snapshot.last !== null && snapshot.mode.kind === "correspondence" && snapshot.last.side === snapshot.mode.human;
    return !snapshot.humanToMove;
  }

  /** The parts of the panel that exist only for play by correspondence, and the confirmation. */
  private renderMail(snapshot: ReturnType<Match["snapshot"]>): void {
    const host = this.host;
    const mail = this.options.mail;
    const showLink = this.resignedLink !== null || this.mailWaiting(snapshot);
    need(host, ".mail").hidden = !showLink;
    if (showLink) {
      const link = this.currentLink();
      const input = need<HTMLInputElement>(host, ".mail-link");
      if (link !== this.mailLinkShown) {
        this.mailLinkShown = link;
        input.value = link;
        this.setMailStatus("");
      }
      need(host, '[data-action="share"]').hidden = typeof navigator.share !== "function";
    }
    const notice = need(host, ".notice");
    notice.hidden = !this.options.notice;
    notice.textContent = this.options.notice ?? "";
    const left = mail?.leftBy ?? null;
    const showLeft = left !== null && this.resignedLink === null;
    need(host, ".left").hidden = !showLeft;
    need(host, '[data-action="continue"]').hidden = snapshot.view.outcome !== null;
    need(host, ".left-level").hidden = snapshot.view.outcome !== null;
    need<HTMLButtonElement>(host, '[data-action="resign"]').hidden = !mail || this.frozen || snapshot.view.outcome !== null;

    const ask = need(host, ".ask");
    ask.hidden = this.asking === null;
    if (this.asking === "leave") {
      need(host, ".ask-text").textContent = MAIL.leaveAsk;
      need(host, ".ask-buttons").innerHTML =
        `<button type="button" data-action="new">${BUTTONS.backToStart}</button>` +
        (this.options.bot !== null || this.options.spawnBot ? `<button type="button" data-action="finish-with-bots">${BUTTONS.finishWithBots}</button>` : "") +
        `<button type="button" data-action="cancel">${BUTTONS.cancel}</button>`;
    }
    if (this.asking === "resign") {
      need(host, ".ask-text").textContent = MAIL.resignAsk;
      need(host, ".ask-buttons").innerHTML = `<button type="button" data-action="confirm-resign">${MAIL.resignConfirm}</button><button type="button" data-action="cancel">${BUTTONS.cancel}</button>`;
    }

    // Against the other player's absence the note says what happened.
    const note = need(host, ".note:not(.warn)");
    if (this.resignedLink !== null) note.innerHTML = `<b>${esc(MAIL.resignedTitle)}</b> ${esc(MAIL.resignedRest)}`;
    else if (showLeft && left !== null) note.innerHTML = `<b>${esc(MAIL.leftTitle(left))}</b> ${esc(snapshot.view.outcome === null ? MAIL.leftRest : MAIL.leftOverRest)}`;
    if (this.frozen) need<HTMLButtonElement>(host, '[data-action="undo"]').disabled = true;
    const home = mail ? BUTTONS.home : BUTTONS.newGame;
    const over = snapshot.view.outcome !== null;
    const local = snapshot.mode.kind === "hotseat" || snapshot.mode.kind === "bot";
    const leaving = local && !over;
    const watching = snapshot.mode.kind === "bots" && !snapshot.mode.stopped && !over;
    need(host, '[data-action="leave"]').hidden = !leaving;
    need(host, '[data-action="stop-bots"]').hidden = !watching;
    need(host, '.actions [data-action="new"]').hidden = leaving || watching;
    need(host, '.actions [data-action="new"]').textContent = home;
    this.renderEnd(snapshot, home);
  }

  /** The card over the board at the end of the game, on the side of the board away from the last play. */
  private renderEnd(snapshot: ReturnType<Match["snapshot"]>, home: string): void {
    const card = endCard(snapshot);
    if (card === null) this.endDismissed = false;
    const element = need(this.host, ".end-card");
    // The card waits for the last play to land.
    element.hidden = card === null || this.endDismissed || snapshot.busy;
    if (card === null) return;
    element.dataset.tone = card.tone;
    need(this.host, ".end-title").textContent = card.title;
    need(this.host, ".end-reason").textContent = card.reason;
    const extra = need(this.host, ".end-extra");
    const sendLink = this.mailWaiting(snapshot);
    extra.hidden = !sendLink;
    extra.textContent = sendLink ? MAIL.sendResult : "";
    need(this.host, '.end-card [data-action="new"]').textContent = home;
    // Seen from the bottom, a play in the upper half of the board is far from a card at the bottom.
    const row = snapshot.last === null ? 1 : Number(snapshot.last.to.slice(1));
    const fromBottom = this.viewpoint === "white" ? row : 12 - row;
    element.classList.toggle("top", fromBottom <= 6);
    element.classList.toggle("bottom", fromBottom > 6);
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
    this.renderMail(snapshot);
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
