import { BotCancelled, type BotPlayer } from "../bot/client";
import { botLevel } from "../bot/levels";
import type { ConexaoGame, Move, View } from "../engine/game";
import type { SeatBot } from "../logic/save";
import {
  blockRaises,
  blockTargets,
  canIncrease,
  chooseValue,
  click,
  live,
  NONE,
  origins,
  placeTargets,
  squaresOf,
  valueChoices,
  type Outcome,
  type Selection,
} from "../logic/selection";
import { ACTIONS, capturedText, diceCount, endText, hint, moveText, rulesCard, rulesSummary, SIDES, TOOLS, turnTitle, winnerText } from "../logic/texts";
import { Sounds } from "../table/sound";
import { NO_MARKS, Table3D, type LastMove, type TableMarks } from "../table/table3d";
import { esc, need } from "./dom";
import { brandMark, dieIcon, SEAT_INK, seatColor } from "./svg";

/** Lines of the history kept. */
const LOG_LINES = 160;

export interface GameScreenOptions {
  readonly names: readonly string[];
  /** Who plays each seat: a person (null) or a bot. */
  readonly bots: readonly SeatBot[];
  /** Plays for the bot seats; disposed when the screen is left. */
  readonly botPlayer: BotPlayer;
  /** Called after every change, to save the game. */
  readonly onChange: () => void;
  /** Leaves the game for the start screen. */
  readonly onLeave: () => void;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * The game screen: the table in 3D over the whole page, and over it the
 * players, the card of the rules, the prompt with the actions, the history
 * and the end of the game. The engine decides what is legal; the screen turns
 * taps on the board into moves (`logic/selection`) and plays each move on the
 * table before the next one. On a bot's turn it asks the bot player, shows
 * what the bot is about to do, and ignores the taps until the play is over.
 */
export class GameScreen {
  private view: View;
  private selection: Selection = NONE;
  private log: string[] = [];
  private last: LastMove | null = null;
  private error: string | null = null;
  private confirmingLeave = false;
  /** A bot is choosing a move. */
  private thinking = false;
  /** The table is playing a move. */
  private busy = false;
  private historyOpen = false;
  /** On a narrow screen the card of the rules is hidden until asked for. */
  private rulesOpen = false;
  private endCardOpen = true;
  private readonly sounds = new Sounds();
  private readonly table: Table3D | null = null;
  private readonly root: HTMLElement;
  private readonly people: number;
  private bannerTimer = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    private readonly game: ConexaoGame,
    private readonly options: GameScreenOptions,
  ) {
    this.view = game.view();
    this.people = options.bots.filter((b) => b == null).length;
    host.innerHTML = `<div class="game">
      <div class="stage"></div>
      <header class="topbar">
        <div class="brand">${brandMark(22)}<span>SIX</span><b>Conexão</b></div>
        <div class="status" data-status></div>
        <nav class="tools" data-tools></nav>
      </header>
      <div class="left-col">
        <aside class="players" data-players></aside>
        <aside class="rules-card" data-rules aria-label="Regras"></aside>
      </div>
      <div class="banner" data-banner aria-live="polite"></div>
      <section class="dock" data-dock></section>
      <aside class="history" data-history hidden></aside>
      <div class="end" data-end hidden></div>
    </div>`;
    this.root = need(host, ".game");
    try {
      this.table = new Table3D(need(host, ".stage"), {
        names: options.names,
        board: { size: this.view.rules.size, blockRows: this.view.blockRows },
        sounds: this.sounds,
        reducedMotion,
        insets: () => this.insets(),
        onPick: (square) => this.onPick(square),
        canPick: (square) => this.canPick(square),
      });
    } catch (e) {
      need(host, ".stage").innerHTML = `<p class="stage-error">Este navegador não conseguiu desenhar a mesa em 3D (${esc(String(e))}).</p>`;
    }
    // The browser tests find the squares on the page through the table.
    if (import.meta.env.DEV) Object.assign(window, { conexaoTable: this.table, conexaoScreen: this });
    need(host, "[data-rules]").innerHTML = this.rulesMarkup();
    this.table?.setViewer(this.firstViewer(), true);
    host.onclick = (event) => this.onClick(event);
    document.onkeydown = (event) => this.onKey(event);
    this.resizeObserver = new ResizeObserver(() => this.table?.refit());
    for (const selector of ["[data-players]", "[data-dock]", ".topbar"]) this.resizeObserver.observe(need(host, selector));
    this.table?.show(this.view, this.marks());
    this.render();
    if (this.view.end === null && this.view.turns === 0) this.banner(`Começa ${options.names[0]}`, "As Brancas jogam primeiro.");
    this.runBot();
  }

  private get names(): readonly string[] {
    return this.options.names;
  }

  /** The current view, for the tests in the browser. */
  get current(): View {
    return this.view;
  }

  private isBot(player: number): boolean {
    return this.options.bots[player] != null;
  }

  /** Whether the player to move is a bot, in a game not over. */
  private get botToMove(): boolean {
    return this.view.end === null && this.isBot(this.view.toMove);
  }

  /** Whether a person may act now: their turn, and nothing playing on the table. */
  private get personToMove(): boolean {
    return live(this.view) && !this.busy && !this.isBot(this.view.toMove);
  }

  /** The seat the camera sits at first: the player to move if a person, else the first person. */
  private firstViewer(): number {
    if (!this.isBot(this.view.toMove)) return this.view.toMove;
    const person = this.options.bots.findIndex((b) => b == null);
    return person < 0 ? 0 : person;
  }

  // --- Playing ---------------------------------------------------------------

  /** Asks the bot to move, when it is a bot's turn and none is thinking. */
  private runBot(): void {
    const level = this.options.bots[this.view.toMove];
    if (!this.botToMove || this.thinking || this.busy || !level) return;
    this.thinking = true;
    this.renderDock();
    this.renderPlayers();
    this.options.botPlayer.choose(JSON.stringify(this.game.state()), botLevel(level).spec).then(
      async (move) => {
        this.thinking = false;
        this.busy = true;
        this.renderDock();
        await this.table?.preview(move, this.view.toMove);
        this.busy = false;
        void this.play(move);
      },
      (e: unknown) => {
        this.thinking = false;
        if (e instanceof BotCancelled) return;
        this.error = `O bot não conseguiu jogar: ${(e as Error).message}`;
        this.render();
      },
    );
  }

  /** Whether undo can go back to a turn of a person. */
  private canUndo(): boolean {
    return !this.busy && this.game.canUndo() && this.people > 0;
  }

  private async play(move: Move): Promise<void> {
    if (this.busy) return;
    const before = this.view;
    let transition;
    try {
      transition = this.game.play(move);
    } catch (e) {
      this.error = `Esse lance não vale: ${(e as Error).message}`;
      this.selection = NONE;
      this.render();
      return;
    }
    this.error = null;
    this.selection = NONE;
    this.busy = true;
    this.options.onChange();
    this.log.push(moveText(move, before, this.names));
    const captured = capturedText(transition.captured);
    if (captured) this.log.push(captured);
    this.log = this.log.slice(-LOG_LINES);
    this.renderDock();
    this.renderPlayers();
    this.renderHistory();
    const after = transition.view;
    this.last = { seat: before.toMove, ...squaresOf(move) };
    if (this.table) await this.table.animate(transition, before, this.marksFor(after, NONE));
    this.view = after;
    this.busy = false;
    if (after.end !== null) this.log.push(`Fim do jogo. ${endText(after.end, this.names, after.rules, after.captured)}`);
    this.afterPlay(before);
  }

  /** After a play: the camera goes to the next person, the turn is announced, the bot is asked. */
  private afterPlay(before: View): void {
    const view = this.view;
    if (view.end !== null) {
      this.endCardOpen = true;
      this.sounds.play("line");
    } else if (!this.isBot(view.toMove)) {
      this.table?.setViewer(view.toMove);
      this.sounds.play("turn");
      if (this.people > 1 && view.toMove !== before.toMove) this.banner(`Vez de ${this.names[view.toMove]}`, SIDES[view.toMove]!);
    }
    this.render();
    this.runBot();
  }

  private undo(): void {
    if (!this.canUndo()) return;
    // Back to the last move of a person, over the moves of the bots.
    this.options.botPlayer.cancel();
    this.thinking = false;
    this.view = this.game.undo();
    while (this.botToMove && this.game.canUndo()) this.view = this.game.undo();
    this.selection = NONE;
    this.last = null;
    this.error = null;
    this.log.push("Lance desfeito.");
    this.log = this.log.slice(-LOG_LINES);
    this.options.onChange();
    this.table?.show(this.view, this.marks());
    if (!this.isBot(this.view.toMove)) this.table?.setViewer(this.view.toMove);
    this.banner("Lance desfeito", "");
    this.render();
    this.runBot();
  }

  // --- Input -----------------------------------------------------------------

  private canPick(square: number): boolean {
    if (!this.personToMove) return false;
    const outcome = click(this.view, this.selection, square);
    return outcome.move !== null || outcome.selection.kind !== "none" || this.selection.kind !== "none";
  }

  private onPick(square: number | null): void {
    this.dismissLeave();
    if (!this.personToMove) return;
    this.apply(click(this.view, this.selection, square));
  }

  private apply(outcome: Outcome): void {
    this.error = outcome.note;
    if (outcome.move) {
      void this.play(outcome.move);
      return;
    }
    if (outcome.selection.kind !== "none" && outcome.selection !== this.selection) this.sounds.play("pick");
    this.select(outcome.selection);
  }

  private select(selection: Selection): void {
    this.selection = selection;
    this.table?.setMarks(this.marks());
    this.renderDock();
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      if (this.confirmingLeave) return this.dismissLeave();
      if (this.selection.kind !== "none") this.select(NONE);
    } else if ((event.ctrlKey || event.metaKey) && event.key === "z") {
      event.preventDefault();
      this.undo();
    }
  }

  private dismissLeave(): void {
    if (!this.confirmingLeave) return;
    this.confirmingLeave = false;
    this.renderTools();
  }

  private onClick(event: MouseEvent): void {
    this.sounds.unlock();
    const target = event.target as Element;
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;
    if (action !== "leave" && action !== "stay") this.dismissLeave();
    switch (action) {
      case "increase":
        if (this.personToMove && this.selection.kind === "raise" && canIncrease(this.view, this.selection.at)) void this.play({ kind: "increase", at: this.selection.at });
        return;
      case "value": {
        const value = Number(target.closest<HTMLElement>("[data-value]")?.dataset.value);
        if (this.personToMove) this.apply(chooseValue(this.view, this.selection, value));
        return;
      }
      case "cancel":
        this.error = null;
        return this.select(NONE);
      case "undo":
        return this.undo();
      case "recenter":
        return this.table?.resetView();
      case "closer":
        return this.table?.zoomBy(0.8);
      case "farther":
        return this.table?.zoomBy(1.25);
      case "sound":
        this.sounds.enabled = !this.sounds.enabled;
        this.sounds.unlock();
        return this.renderTools();
      case "history":
        this.historyOpen = !this.historyOpen;
        this.renderHistory();
        return this.renderTools();
      case "rules":
        this.rulesOpen = !this.rulesOpen;
        this.root.classList.toggle("show-rules", this.rulesOpen);
        return this.renderTools();
      case "see-table":
        this.endCardOpen = false;
        return this.renderEnd();
      case "results":
        this.endCardOpen = true;
        return this.renderEnd();
      case "stay":
        return this.dismissLeave();
      case "leave":
        if (this.view.end === null && !this.confirmingLeave) {
          this.confirmingLeave = true;
          return this.renderTools();
        }
        return this.leave();
      case "new-game":
        return this.leave();
    }
  }

  private leave(): void {
    this.host.onclick = null;
    document.onkeydown = null;
    clearTimeout(this.bannerTimer);
    this.resizeObserver.disconnect();
    this.options.botPlayer.dispose();
    this.table?.dispose();
    this.options.onLeave();
  }

  // --- Marks -----------------------------------------------------------------

  private marks(): TableMarks {
    return this.marksFor(this.view, this.selection);
  }

  /** What the table marks for a person to move: where a tap plays, given what was chosen. */
  private marksFor(view: View, selection: Selection): TableMarks {
    if (view.end !== null) return { ...NO_MARKS, last: this.last };
    const base = { ...NO_MARKS, active: view.toMove, last: this.last };
    if (this.isBot(view.toMove)) return base;
    switch (selection.kind) {
      case "none":
        return { ...base, places: placeTargets(view), blocks: blockTargets(view).filter((s) => !placeTargets(view).includes(s)) };
      case "raise":
        return { ...base, places: placeTargets(view), blocks: blockTargets(view, selection.at), selected: [selection.at] };
      case "block":
        return { ...base, choices: blockRaises(view, selection.to), selected: [selection.to] };
      case "value":
        return { ...base, selected: [selection.to, ...(selection.raise !== null ? [selection.raise] : [])] };
      case "origin":
        return { ...base, choices: origins(view, selection), selected: [selection.to, ...(selection.raise !== null ? [selection.raise] : [])] };
    }
  }

  /** The room the panels take over the canvas, so the table is framed in the rest. */
  private insets(): { top: number; bottom: number; left: number; right: number } {
    const rect = this.root.getBoundingClientRect();
    const box = (selector: string) => this.root.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
    const dock = box("[data-dock]");
    const players = box("[data-players]");
    const narrow = rect.width < 760;
    return {
      top: Math.max(0, (narrow ? players?.bottom : box(".topbar")?.bottom) ?? 0) - rect.top,
      bottom: dock ? Math.max(0, rect.bottom - dock.top) : 0,
      left: !narrow && players ? Math.max(0, players.right - rect.left) : 0,
      right: 0,
    };
  }

  // --- Drawing the panels ----------------------------------------------------

  private render(): void {
    this.renderStatus();
    this.renderTools();
    this.renderPlayers();
    this.renderDock();
    this.renderHistory();
    this.renderEnd();
  }

  private banner(title: string, detail: string): void {
    const el = need(this.host, "[data-banner]");
    el.innerHTML = `<div class="banner-card"><b>${esc(title)}</b>${detail ? `<span>${esc(detail)}</span>` : ""}</div>`;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => el.classList.remove("show"), 2300);
  }

  private renderStatus(): void {
    const view = this.view;
    const text = view.end === null ? `Turno ${view.turns + 1} de ${view.rules.maxTurns}` : "Fim do jogo";
    need(this.host, "[data-status]").innerHTML = `<span class="pill">${esc(text)}</span>`;
  }

  private renderTools(): void {
    const tools = need(this.host, "[data-tools]");
    if (this.confirmingLeave) {
      tools.innerHTML = `<span class="confirm">${esc(TOOLS.confirmLeave)}</span>
        <button type="button" class="tool danger" data-action="leave">${esc(TOOLS.leave)}</button>
        <button type="button" class="tool" data-action="stay">${esc(TOOLS.stay)}</button>`;
      return;
    }
    const icon = (path: string) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${path}</svg>`;
    const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    tools.innerHTML = [
      `<button type="button" class="tool icon" data-action="farther" title="${TOOLS.farther}" aria-label="${TOOLS.farther}">${icon(`<path ${stroke} d="M5 12h14"/>`)}</button>`,
      `<button type="button" class="tool icon" data-action="closer" title="${TOOLS.closer}" aria-label="${TOOLS.closer}">${icon(`<path ${stroke} d="M5 12h14M12 5v14"/>`)}</button>`,
      `<button type="button" class="tool icon" data-action="recenter" title="${TOOLS.recenter}" aria-label="${TOOLS.recenter}">${icon(`<circle ${stroke} cx="12" cy="12" r="7"/><path ${stroke} d="M12 2v4M12 18v4M2 12h4M18 12h4"/>`)}</button>`,
      `<button type="button" class="tool icon" data-action="sound" aria-pressed="${this.sounds.enabled}" title="${this.sounds.enabled ? TOOLS.soundOn : TOOLS.soundOff}" aria-label="${this.sounds.enabled ? TOOLS.soundOn : TOOLS.soundOff}">${icon(
        this.sounds.enabled
          ? `<path ${stroke} d="M4 10v4h4l5 4V6L8 10H4z"/><path ${stroke} d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>`
          : `<path ${stroke} d="M4 10v4h4l5 4V6L8 10H4z"/><path ${stroke} d="M17 9l5 6M22 9l-5 6"/>`,
      )}</button>`,
      `<button type="button" class="tool rules-toggle" data-action="rules" aria-pressed="${this.rulesOpen}">${TOOLS.rules}</button>`,
      `<button type="button" class="tool" data-action="history" aria-pressed="${this.historyOpen}">${TOOLS.history}</button>`,
      `<button type="button" class="tool" data-action="leave">${TOOLS.leave}</button>`,
    ].join("");
  }

  private renderPlayers(): void {
    const view = this.view;
    const cards = [0, 1]
      .map((i) => {
        const active = view.end === null && view.toMove === i;
        const won = view.winner === i;
        const level = this.options.bots[i];
        const bot = level ? `<span class="tag">Bot ${esc(botLevel(level).label.toLowerCase())}</span>` : "";
        const state = won ? '<span class="tag won">Venceu</span>' : active ? `<span class="tag now">${this.thinking ? "Pensando" : "Vez"}</span>` : "";
        const onBoard = view.cells.filter((d) => d?.owner === i).length;
        return `<article class="player${active ? " active" : ""}${won ? " won" : ""}" style="--seat:${seatColor(i)};--seat-ink:${SEAT_INK[i]}">
          <div class="seat-die">${dieIcon(view.rules.placedValue, 26, i)}</div>
          <div class="who"><div class="name">${esc(this.names[i]!)}</div><div class="tags"><span class="tag side">${SIDES[i]}</span>${bot}${state}</div></div>
          <div class="score"><b>${view.reserve[i]!.reduce((a, b) => a + b, 0)}</b><span>na reserva</span></div>
          <div class="facts">
            <span>${esc(diceCount(onBoard))} no tabuleiro</span>
            <span>${view.captured[i]} ${view.captured[i] === 1 ? "capturado" : "capturados"}</span>
          </div>
          ${active && this.thinking ? '<div class="thinking" aria-hidden="true"><i></i><i></i><i></i></div>' : ""}
        </article>`;
      })
      .join("");
    need(this.host, "[data-players]").innerHTML = cards;
  }

  private renderDock(): void {
    const dock = need(this.host, "[data-dock]");
    const view = this.view;
    if (view.end !== null && !this.busy) {
      dock.innerHTML = `<div class="prompt"><div class="title">${esc(winnerText(view.end, this.names))}</div><p>${esc(endText(view.end, this.names, view.rules, view.captured))}</p></div>
        <div class="actions"><button type="button" class="primary" data-action="results">${TOOLS.results}</button><button type="button" data-action="new-game">${ACTIONS.newGame}</button></div>`;
      return;
    }
    const bot = this.isBot(view.toMove);
    const me = view.toMove;
    const title = turnTitle(view, this.names, bot, this.people);
    let text: string;
    if (this.busy) text = `${this.names[me]} está jogando…`;
    else if (bot) text = `${this.names[me]} está pensando…`;
    else text = hint(view, this.selection);
    const person = this.personToMove;
    const raise = person && this.selection.kind === "raise" && canIncrease(view, this.selection.at);
    const values = person ? valueChoices(view, this.selection) : [];
    const picks = values
      .map((v) => `<button type="button" class="value-pick" data-action="value" data-value="${v}" aria-label="Dado ${v} da reserva (${view.reserve[me]![v]})">${dieIcon(v, 22, me)}<span>×${view.reserve[me]![v]}</span></button>`)
      .join("");
    dock.innerHTML = `<div class="prompt" style="--seat:${seatColor(me)}">
        <div class="title">${dieIcon(view.rules.placedValue, 22, me)}<span>${esc(title)}</span></div>
        <p><span>${esc(text)}</span></p>
        ${this.error ? `<p class="warn">${esc(this.error)}</p>` : ""}
      </div>
      <div class="actions">
        ${picks}
        ${person && this.selection.kind !== "none" ? `<button type="button" class="ghost" data-action="cancel">${ACTIONS.cancel}</button>` : ""}
        ${raise ? `<button type="button" class="primary" data-action="increase">${ACTIONS.increase}</button>` : ""}
        <button type="button" class="ghost" data-action="undo" ${this.canUndo() ? "" : "disabled"} title="Ctrl+Z">${ACTIONS.undo}</button>
      </div>`;
  }

  private renderHistory(): void {
    const el = need(this.host, "[data-history]");
    el.hidden = !this.historyOpen;
    if (!this.historyOpen) return;
    el.innerHTML = `<h2>${TOOLS.history}</h2><ol>${this.log.map((line) => `<li>${esc(line)}</li>`).join("")}</ol>`;
    const list = el.querySelector("ol");
    if (list) list.scrollTop = list.scrollHeight;
  }

  private renderEnd(): void {
    const el = need(this.host, "[data-end]");
    const view = this.view;
    el.hidden = view.end === null || this.busy || !this.endCardOpen;
    if (el.hidden || view.end === null) return;
    const rows = [0, 1]
      .map((i) => {
        const won = view.winner === i;
        const onBoard = view.cells.filter((d) => d?.owner === i).length;
        return `<li class="${won ? "won" : ""}">
          <span class="rank">${dieIcon(view.rules.placedValue, 22, i)}</span>
          <div><b>${esc(this.names[i]!)}</b><small>${SIDES[i]} · ${esc(diceCount(onBoard))} no tabuleiro, ${view.reserve[i]!.reduce((a, b) => a + b, 0)} na reserva, ${view.captured[i]} ${view.captured[i] === 1 ? "capturado" : "capturados"}</small></div>
          <span class="pts">${won ? "Venceu" : ""}</span>
        </li>`;
      })
      .join("");
    el.innerHTML = `<div class="end-card" role="dialog" aria-label="Fim do jogo">
      <div class="kicker">Fim do jogo · ${view.turns} turnos</div>
      <h2>${esc(winnerText(view.end, this.names))}</h2>
      <p class="reason">${esc(endText(view.end, this.names, view.rules, view.captured))}</p>
      <ol class="ranking">${rows}</ol>
      <p class="reason">${esc(rulesSummary(view.rules))}</p>
      <div class="actions"><button type="button" data-action="see-table">${TOOLS.seeTable}</button><button type="button" class="primary" data-action="new-game">${ACTIONS.newGame}</button></div>
    </div>`;
  }

  /** The card of the rules of this game: a few lines per rule and the switches chosen. */
  private rulesMarkup(): string {
    const rows = rulesCard(this.view.rules)
      .map((rule) => `<li><b>${esc(rule.title)}</b><span>${esc(rule.text)}</span></li>`)
      .join("");
    return `<h2>Regras</h2>
      <p class="sub">${esc(rulesSummary(this.view.rules))}. As fileiras do bloqueio estão marcadas nas bordas do tabuleiro. Anel: colocar. Losango: bloquear.</p>
      <ol>${rows}</ol>`;
  }
}
