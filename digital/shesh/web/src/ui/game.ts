import { BotCancelled, type BotPlayer } from "../bot/client";
import { botLevel } from "../bot/levels";
import type { Command, Event, Move, SheshGame, View } from "../engine/game";
import type { SeatBot } from "../logic/save";
import { click, destinationOf, NONE, mustPass, sourceOf, sources, type Click, type Selection } from "../logic/selection";
import {
  ACTIONS,
  diceText,
  endText,
  eventText,
  happeningText,
  hint,
  moveText,
  pointsText,
  RULES_CARD,
  TOOLS,
  turnTitle,
  winnerText,
} from "../logic/texts";
import { EXIT, binaryFaces } from "../table/layout";
import { Sounds } from "../table/sound";
import { NO_MARKS, Table3D, type Pick, type TableMarks } from "../table/table3d";
import { esc, need } from "./dom";
import { binaryIcon, brandMark, dieIcon, seatColor } from "./svg";

/** Lines of the history kept. */
const LOG_LINES = 120;

export interface GameScreenOptions {
  readonly names: readonly string[];
  /** Who plays each seat: a person (null) or a bot level. */
  readonly bots: readonly SeatBot[];
  /** Plays for the bot seats; disposed when the screen is left. */
  readonly botPlayer: BotPlayer;
  /** A game just begun: its first roll is played on the table. */
  readonly fresh: boolean;
  /** Called after every change, to save the game. */
  readonly onChange: () => void;
  /** Leaves the game for the start screen. */
  readonly onLeave: () => void;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * The game screen: the table in 3D over the whole page, and over it the
 * players, the card of the rules, the prompt with the legal moves and the
 * actions, the history and the end of the game. The engine decides what is
 * legal; the screen turns picks on the table into moves (`logic/selection`)
 * and plays the events of each command on the table before the next one. On
 * a bot's turn it asks the bot player, shows what the bot is about to do, and
 * ignores the picks until the play is over.
 */
export class GameScreen {
  private view: View;
  private selection: Selection = NONE;
  private log: string[] = [];
  /** The last move: the squares where the die started (null from the reserve) and stopped. */
  private last: { seat: number; from: number | null; to: number } | null = null;
  private error: string | null = null;
  private confirmingLeave = false;
  /** A bot is choosing a command. */
  private thinking = false;
  /** The table is playing the events of a command. */
  private busy = false;
  /** What the table is showing while busy, for the prompt. */
  private happening: string | null = null;
  private historyOpen = false;
  /** On a narrow screen the card of the rules is hidden until asked for. */
  private rulesOpen = false;
  private endCardOpen = true;
  /** The seat whose side is at the bottom of the screen. */
  private viewer = 0;
  private readonly sounds = new Sounds();
  private readonly table: Table3D | null = null;
  private readonly root: HTMLElement;
  private readonly people: number;
  private bannerTimer = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    private readonly game: SheshGame,
    private readonly options: GameScreenOptions,
  ) {
    this.view = game.view();
    this.people = options.bots.filter((b) => b == null).length;
    host.innerHTML = `<div class="game">
      <div class="stage"></div>
      <header class="topbar">
        <div class="brand">${brandMark(22)}<span>SIX</span><b>Shesh</b></div>
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
        sounds: this.sounds,
        reducedMotion,
        insets: () => this.insets(),
        onPick: (pick) => this.onPick(pick),
        canPick: (pick) => this.canPick(pick),
      });
    } catch (e) {
      need(host, ".stage").innerHTML = `<p class="stage-error">Este navegador não conseguiu desenhar a mesa em 3D (${esc(String(e))}).</p>`;
    }
    // The browser tests find the dice and the cells on the page through the table.
    if (import.meta.env.DEV) Object.assign(window, { sheshTable: this.table, sheshScreen: this });
    need(host, "[data-rules]").innerHTML = rulesCard();
    this.viewer = this.firstViewer();
    this.table?.setViewer(this.viewer, true);
    host.onclick = (event) => this.onClick(event);
    document.onkeydown = (event) => this.onKey(event);
    this.resizeObserver = new ResizeObserver(() => this.table?.refit());
    for (const selector of ["[data-players]", "[data-dock]", ".topbar"]) this.resizeObserver.observe(need(host, selector));
    this.table?.show(this.view, this.game.leftDice(), this.marks());
    this.render();
    if (options.fresh) void this.opening();
    else this.afterStart();
  }

  private get names(): readonly string[] {
    return this.options.names;
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
    return this.view.end === null && !this.busy && !this.isBot(this.view.toMove);
  }

  /** The seat the camera sits at first: the player to move if a person, else the first person. */
  private firstViewer(): number {
    if (!this.isBot(this.view.toMove)) return this.view.toMove;
    const person = this.options.bots.findIndex((b) => b == null);
    return person < 0 ? 0 : person;
  }

  // --- Playing ---------------------------------------------------------------

  /** The first roll of a new game, thrown on the table. */
  private async opening(): Promise<void> {
    this.busy = true;
    this.renderDock();
    const roll: Event = { kind: "rolled", player: this.view.toMove, roll: this.view.roll };
    await this.table?.animate([roll], this.view, this.game.leftDice(), this.marks(), { onEvent: (event) => this.onEvent(event, this.view) });
    this.busy = false;
    this.happening = null;
    this.render();
    this.afterStart();
  }

  private afterStart(): void {
    if (this.view.end === null) this.banner(`Começa ${this.names[this.view.toMove]}`, "O primeiro jogador foi sorteado.");
    this.runBot();
  }

  /** Asks the bot to move, when it is a bot's turn and none is thinking. */
  private runBot(): void {
    const level = this.options.bots[this.view.toMove];
    if (!this.botToMove || this.thinking || this.busy || !level) return;
    this.thinking = true;
    this.renderDock();
    this.renderPlayers();
    this.options.botPlayer.choose(JSON.stringify(this.game.state()), botLevel(level).spec).then(
      async (command) => {
        this.thinking = false;
        this.busy = true;
        this.renderDock();
        const move = this.view.moves.find((m) => JSON.stringify(m.command) === JSON.stringify(command));
        if (move) await this.table?.preview(move, this.view.toMove);
        this.busy = false;
        void this.play(command);
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

  private record(event: Event, view: View): void {
    const text = eventText(event, this.names, view);
    if (text) this.log.push(text);
    if (event.kind === "entered") this.last = { seat: event.player, from: null, to: event.square };
    if (event.kind === "moved") this.last = { seat: event.player, from: event.from, to: event.to };
    this.log = this.log.slice(-LOG_LINES);
  }

  private async play(command: Command): Promise<void> {
    if (this.busy) return;
    const before = this.view;
    let transition;
    try {
      transition = this.game.command(command);
    } catch (e) {
      this.error = `Esse movimento não vale: ${(e as Error).message}`;
      this.selection = NONE;
      this.render();
      return;
    }
    this.error = null;
    this.selection = NONE;
    this.busy = true;
    this.options.onChange();
    const after = transition.view;
    this.table?.setMarks({ ...NO_MARKS, active: before.toMove, last: this.last });
    this.renderDock();
    this.renderPlayers();
    if (this.table) {
      await this.table.animate(transition.events, after, this.game.leftDice(), this.marksFor(after, NONE), { onEvent: (event) => this.onEvent(event, after) });
    } else {
      for (const event of transition.events) this.onEvent(event, after);
    }
    this.view = after;
    this.busy = false;
    this.happening = null;
    this.afterPlay(before);
  }

  /** An event starts to show on the table: the history, the prompt and the banners follow it. */
  private onEvent(event: Event, after: View): void {
    this.record(event, after);
    this.happening = happeningText(event, this.names, after);
    this.renderDock();
    this.renderHistory();
  }

  /** After a play: the camera goes to the next person, the turn is announced, the bot is asked. */
  private afterPlay(before: View): void {
    const view = this.view;
    if (view.end !== null) {
      this.endCardOpen = true;
      this.sounds.play("line");
    } else if (!this.isBot(view.toMove)) {
      this.setViewer(view.toMove);
      if (view.toMove !== before.toMove) this.sounds.play("turn");
      if (this.people > 1 && view.toMove !== before.toMove) this.banner(`Vez de ${this.names[view.toMove]}`, "");
    }
    this.render();
    this.runBot();
  }

  private setViewer(seat: number): void {
    this.viewer = seat;
    this.table?.setViewer(seat);
  }

  private undo(): void {
    if (!this.canUndo()) return;
    // Back to the last command of a person, over the bots' commands.
    this.options.botPlayer.cancel();
    this.thinking = false;
    this.view = this.game.undo();
    while (this.botToMove && this.game.canUndo()) this.view = this.game.undo();
    this.selection = NONE;
    this.last = null;
    this.error = null;
    this.log.push("Movimento desfeito.");
    this.log = this.log.slice(-LOG_LINES);
    this.options.onChange();
    this.table?.show(this.view, this.game.leftDice(), this.marks());
    if (!this.isBot(this.view.toMove)) this.setViewer(this.view.toMove);
    this.banner("Movimento desfeito", "");
    this.render();
    this.runBot();
  }

  // --- Input -----------------------------------------------------------------

  private canPick(pick: Pick): boolean {
    if (!this.personToMove) return false;
    const view = this.view;
    if (mustPass(view)) return false;
    const chosen = this.selection !== null ? view.moves[this.selection] : undefined;
    if (pick.kind === "square" && chosen && destinationOf(view, chosen) === pick.square) return true;
    return sources(view).some((s) => (s.kind === "reserve" ? pick.kind === "reserve" && pick.value === s.value : pick.kind === "square" && pick.square === s.square));
  }

  private onPick(pick: Pick | null): void {
    this.dismissLeave();
    if (!this.personToMove) return;
    if (!pick) {
      this.select(NONE);
      return;
    }
    const input: Click = pick;
    this.apply(click(this.view, this.selection, input));
  }

  private apply(outcome: ReturnType<typeof click>): void {
    this.error = outcome.note;
    if (outcome.command) {
      void this.play(outcome.command);
      return;
    }
    if (outcome.selection !== null && outcome.selection !== this.selection) this.sounds.play("pick");
    this.select(outcome.selection);
  }

  private select(selection: Selection): void {
    this.selection = selection;
    this.table?.setMarks(this.marks());
    this.renderDock();
    this.renderPlayers();
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      if (this.confirmingLeave) return this.dismissLeave();
      if (this.selection !== null) this.select(NONE);
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
    const moveButton = target.closest<HTMLElement>("[data-move]");
    if (moveButton) {
      this.dismissLeave();
      if (this.personToMove) this.apply(click(this.view, this.selection, { kind: "move", index: Number(moveButton.dataset.move) }));
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;
    if (action !== "leave" && action !== "stay") this.dismissLeave();
    switch (action) {
      case "play":
        if (this.personToMove && this.selection !== null) void this.play(this.view.moves[this.selection]!.command);
        return;
      case "pass":
        if (this.personToMove && mustPass(this.view)) void this.play({ kind: "pass" });
        return;
      case "cancel":
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

  private marksFor(view: View, selection: Selection): TableMarks {
    if (view.end !== null) return { ...NO_MARKS, last: this.last };
    const person = !this.isBot(view.toMove);
    const chosen = selection !== null ? view.moves[selection] : undefined;
    return {
      active: view.toMove,
      sources: person ? sources(view) : [],
      selected: person && chosen ? sourceOf(chosen) : null,
      target: person && chosen ? destinationOf(view, chosen) : null,
      last: this.last,
    };
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
    const text = view.end === null ? `Turno ${view.turn}` : "Fim do jogo";
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
    const cards = view.players
      .map((player, i) => {
        const active = view.end === null && view.toMove === i;
        const won = view.winner === i;
        const level = this.options.bots[i];
        const bot = level ? `<span class="tag">Bot ${esc(botLevel(level).label.toLowerCase())}</span>` : "";
        const state = won ? '<span class="tag won">Venceu</span>' : active ? `<span class="tag now">${this.thinking ? "Pensando" : "Vez"}</span>` : "";
        const onTrack = player.track.filter((v) => v > 0).length;
        return `<article class="player${active ? " active" : ""}${won ? " won" : ""}" style="--seat:${seatColor(i)}">
          <div class="seat-dot"></div>
          <div class="who"><div class="name">${esc(this.names[i]!)}</div><div class="tags">${bot}${state}</div></div>
          <div class="score"><b>${player.points}</b><span>de 12 pontos</span></div>
          <div class="facts">
            <span title="Dados da reserva e dados na trilha">${esc(diceText(player.reserve.length, onTrack))}</span>
          </div>
          ${active && this.thinking ? '<div class="thinking" aria-hidden="true"><i></i><i></i><i></i></div>' : ""}
        </article>`;
      })
      .join("");
    need(this.host, "[data-players]").innerHTML = cards;
  }

  /** The four binary dice of the turn, as icons: so the roll can be read even when the table is far. */
  private binaryRow(): string {
    const view = this.view;
    if (view.end !== null) return "";
    const bits = binaryFaces(view.roll, view.turn);
    return `<span class="roll" aria-label="Dados binários: ${view.roll}">${bits.map((one) => binaryIcon(one ? 1 : 0, 24)).join("")}<b>= ${view.roll}</b></span>`;
  }

  private renderDock(): void {
    const dock = need(this.host, "[data-dock]");
    const view = this.view;
    if (view.end !== null && !this.busy) {
      dock.innerHTML = `<div class="prompt"><div class="title">${esc(winnerText(view.winner, this.names))}</div><p>${esc(endText(view.end, this.names, view))}</p></div>
        <div class="actions"><button type="button" class="primary" data-action="results">${TOOLS.results}</button><button type="button" data-action="new-game">${ACTIONS.newGame}</button></div>`;
      return;
    }
    const bot = this.isBot(view.toMove);
    const me = view.toMove;
    const title = turnTitle(view, this.names, bot, this.people);
    const chosen = this.selection !== null ? view.moves[this.selection] ?? null : null;
    let text: string;
    if (this.busy) text = this.happening ?? `${this.names[me]} está jogando…`;
    else if (bot) text = `${this.names[me]} está pensando…`;
    else text = hint(view, chosen, this.names);
    const live = this.personToMove;
    const pass = live && mustPass(view);
    const list =
      live && !pass
        ? `<ol class="moves">${view.moves
            .map((move: Move, i) => `<li><button type="button" class="move${this.selection === i ? " chosen" : ""}" data-move="${i}" aria-pressed="${this.selection === i}">${esc(moveText(view, move))}</button></li>`)
            .join("")}</ol>`
        : "";
    dock.innerHTML = `<div class="prompt" style="--seat:${seatColor(me)}">
        <div class="title"><i class="seat-dot"></i><span>${esc(title)}</span>${this.binaryRow()}</div>
        <p><span>${esc(text)}</span></p>
        ${list}
        ${this.error ? `<p class="warn">${esc(this.error)}</p>` : ""}
      </div>
      <div class="actions">
        ${live && this.selection !== null ? `<button type="button" class="ghost" data-action="cancel">${ACTIONS.cancel}</button><button type="button" class="primary" data-action="play">${ACTIONS.play}</button>` : ""}
        <button type="button" data-action="pass" ${pass ? "" : "disabled"}>${ACTIONS.pass}</button>
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
    if (el.hidden) return;
    const rows = view.players
      .map((p, i) => ({ i, p }))
      .sort((a, b) => b.p.points - a.p.points || Number(b.i === view.winner) - Number(a.i === view.winner))
      .map(({ i, p }, rank) => {
        const won = view.winner === i;
        const dice = this.game.leftDice()[i] ?? [];
        return `<li class="${won ? "won" : ""}" style="--seat:${seatColor(i)}">
          <span class="rank">${rank + 1}</span><i class="seat-dot"></i>
          <div><b>${esc(this.names[i]!)}</b><small>${dice.length > 0 ? `Dados que saíram: ${dice.map((v) => dieIcon(v, 16, i)).join("")}` : "Nenhum dado saiu."}</small></div>
          <span class="pts">${esc(pointsText(p.points))}</span>
        </li>`;
      })
      .join("");
    el.innerHTML = `<div class="end-card" role="dialog" aria-label="Fim do jogo">
      <div class="kicker">Fim do jogo</div>
      <h2>${esc(winnerText(view.winner, this.names))}</h2>
      <p class="reason">${esc(endText(view.end!, this.names, view))}</p>
      <ol class="ranking">${rows}</ol>
      <div class="actions"><button type="button" data-action="see-table">${TOOLS.seeTable}</button><button type="button" class="primary" data-action="new-game">${ACTIONS.newGame}</button></div>
    </div>`;
  }
}

/** The fixed card of the rules: a few lines per rule, and the numbering of the track. */
function rulesCard(): string {
  const rows = RULES_CARD.map((rule) => `<li><b>${esc(rule.title)}</b><span>${esc(rule.text)}</span></li>`).join("");
  return `<h2>Regras</h2>
    <p class="sub">A trilha tem ${EXIT - 1} casas, como a do Ur: a pista de entrada (1 a 4, a sua), a pista do meio (5 a 12, de todos) e a pista de saída (13 e 14, a sua). A casa ${EXIT} é a saída.</p>
    <ol>${rows}</ol>`;
}
