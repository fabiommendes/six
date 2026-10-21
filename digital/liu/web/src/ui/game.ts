import { BotCancelled, type BotPlayer } from "../bot/client";
import { botLevel } from "../bot/levels";
import type { Command, Event, LiuGame, Pos, View } from "../engine/game";
import { marketFits, sealCounts } from "../logic/feedback";
import type { SeatBot } from "../logic/save";
import { click, keepCommand, NONE, samePos, selectedValue, targetsOf, type Click, type Selection } from "../logic/selection";
import {
  ACTIONS,
  bagText,
  diceCount,
  eventText,
  hint,
  inMarket,
  points,
  roundBanner,
  scoreText,
  TOOLS,
  turnTitle,
  winnersText,
} from "../logic/texts";
import { Sounds } from "../table/sound";
import { NO_MARKS, Table3D, type Pick, type TableMarks } from "../table/table3d";
import { esc, need } from "./dom";
import { brandMark, dieIcon, emptySlot, sealColor } from "./svg";

/** Lines of the history kept. */
const LOG_LINES = 60;

export interface GameScreenOptions {
  readonly names: readonly string[];
  /** Who plays each seat: a person (null) or a bot level. */
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
 * players, the prompt with the actions, the history and the end of the
 * game. The engine decides what is legal; the screen turns picks on the
 * table into commands (`logic/selection`) and plays the events of each
 * command on the table before the next one. On a bot's turn it asks the
 * bot player, shows what the bot takes, and ignores the picks until the
 * play is over.
 */
export class GameScreen {
  private view: View;
  private selection: Selection = NONE;
  private log: string[] = [];
  /** The die put last, in whose window. */
  private last: { seat: number; at: Pos } | null = null;
  private error: string | null = null;
  private confirmingLeave = false;
  /** A bot is choosing a command. */
  private thinking = false;
  /** The table is playing the events of a command. */
  private busy = false;
  /** What the table is showing while busy, for the prompt. */
  private happening: string | null = null;
  /** The dice in the bag as the table shows them. */
  private bag: number;
  private historyOpen = false;
  private endCardOpen = true;
  private readonly sounds = new Sounds();
  private readonly table: Table3D | null = null;
  private readonly root: HTMLElement;
  private readonly people: number;
  private bannerTimer = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    private readonly game: LiuGame,
    private readonly options: GameScreenOptions,
  ) {
    this.view = game.view();
    this.bag = this.view.bag;
    this.people = options.bots.filter((b) => b == null).length;
    host.innerHTML = `<div class="game">
      <div class="stage"></div>
      <header class="topbar">
        <div class="brand">${brandMark(22)}<span>SIX</span><b>Liu</b></div>
        <div class="status" data-status></div>
        <nav class="tools" data-tools></nav>
      </header>
      <aside class="players" data-players></aside>
      <div class="banner" data-banner aria-live="polite"></div>
      <section class="dock" data-dock></section>
      <aside class="history" data-history hidden></aside>
      <div class="end" data-end hidden></div>
    </div>`;
    this.root = need(host, ".game");
    for (const event of game.openingEvents()) this.record(event);
    try {
      this.table = new Table3D(need(host, ".stage"), this.view.players.length, {
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
    if (import.meta.env.DEV) Object.assign(window, { liuTable: this.table, liuScreen: this });
    const viewer = this.firstViewer();
    this.table?.setViewer(viewer, true);
    this.table?.show(this.view, this.marks());
    host.onclick = (event) => this.onClick(event);
    document.onkeydown = (event) => this.onKey(event);
    this.resizeObserver = new ResizeObserver(() => this.table?.refit());
    for (const selector of ["[data-players]", "[data-dock]", ".topbar"]) this.resizeObserver.observe(need(host, selector));
    this.render();
    if (this.view.end === null) {
      const r = roundBanner(this.view.round, this.view.first, this.view.players[this.view.first]!.seal, this.names);
      this.banner(r.title, r.detail);
    }
    this.runBot();
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
        await this.table?.preview(command, this.view.toMove);
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

  private record(event: Event): void {
    const text = eventText(event, this.names);
    if (text) this.log.push(text);
    if (event.kind === "placed") this.last = { seat: event.player, at: event.at };
    this.log = this.log.slice(-LOG_LINES);
  }

  private async play(command: Command): Promise<void> {
    if (this.busy) return;
    const before = this.view;
    let transition;
    try {
      transition = this.game.command(command);
    } catch (e) {
      this.error = `A jogada não vale: ${(e as Error).message}`;
      this.selection = NONE;
      this.render();
      return;
    }
    this.error = null;
    this.selection = NONE;
    this.busy = true;
    this.options.onChange();
    const after = transition.view;
    this.renderDock();
    if (this.table) {
      await this.table.animate(command, transition.events, before, after, this.marksFor(after, NONE), {
        onEvent: (event) => this.onEvent(event, after),
        onBag: (left) => {
          this.bag = left;
          this.renderStatus();
        },
      });
    } else {
      for (const event of transition.events) this.onEvent(event, after);
    }
    this.view = after;
    this.bag = after.bag;
    this.busy = false;
    this.happening = null;
    this.afterPlay(before);
  }

  /** An event starts to show on the table: the history, the prompt and the banners follow it. */
  private onEvent(event: Event, after: View): void {
    this.record(event);
    this.happening = eventText(event, this.names);
    if (event.kind === "roundStarted") {
      const r = roundBanner(event.round, event.first, after.players[event.first]!.seal, this.names);
      this.banner(r.title, r.detail);
    }
    this.renderDock();
    this.renderHistory();
  }

  /** After a play: the camera goes to the next person, the turn is announced, the bot is asked. */
  private afterPlay(before: View): void {
    const view = this.view;
    this.table?.show(view, this.marks());
    if (view.end !== null) {
      this.endCardOpen = true;
      this.table?.showFinal(view);
      this.sounds.play("line");
    } else if (!this.isBot(view.toMove)) {
      this.table?.setViewer(view.toMove);
      if (view.toMove !== before.toMove || view.round !== before.round) this.sounds.play("turn");
      if (this.people > 1 && view.toMove !== before.toMove) this.banner(`Vez de ${this.names[view.toMove]}`, "");
    }
    this.render();
    this.runBot();
  }

  private undo(): void {
    if (!this.canUndo()) return;
    // Back to the last command of a person, over the bots' commands.
    this.options.botPlayer.cancel();
    this.thinking = false;
    this.view = this.game.undo();
    while (this.botToMove && this.game.canUndo()) this.view = this.game.undo();
    this.bag = this.view.bag;
    this.selection = NONE;
    this.last = null;
    this.error = null;
    this.log.push("Jogada desfeita.");
    this.log = this.log.slice(-LOG_LINES);
    this.options.onChange();
    this.table?.show(this.view, this.marks());
    if (!this.isBot(this.view.toMove)) this.table?.setViewer(this.view.toMove);
    this.banner("Jogada desfeita", "");
    this.render();
    this.runBot();
  }

  // --- Input -----------------------------------------------------------------

  /** A pick on the table as a click of the selection, when it is about the player to move. */
  private clickOf(pick: Pick): Click | null {
    const me = this.view.toMove;
    switch (pick.kind) {
      case "market":
        return { kind: "market", die: pick.die };
      case "hand":
        return pick.seat === me ? { kind: "hand" } : null;
      case "cell":
        return pick.seat === me ? { kind: "cell", at: pick.at } : null;
    }
  }

  private canPick(pick: Pick): boolean {
    if (!this.personToMove) return false;
    const view = this.view;
    switch (pick.kind) {
      case "market":
        return true;
      case "hand":
        return pick.seat === view.toMove && view.canPlaceFromHand && !view.rerolled;
      case "cell":
        return pick.seat === view.toMove && targetsOf(view, this.selection).some((t) => samePos(t, pick.at));
    }
  }

  private onPick(pick: Pick | null): void {
    this.dismissLeave();
    if (!this.personToMove) return;
    const input = pick ? this.clickOf(pick) : null;
    if (!input) {
      if (this.selection.kind !== "none" && this.selection.kind !== "handAt") this.select(NONE);
      return;
    }
    const outcome = click(this.view, this.selection, input);
    if (outcome.command) {
      void this.play(outcome.command);
      return;
    }
    if (outcome.selection.kind !== "none" && JSON.stringify(outcome.selection) !== JSON.stringify(this.selection)) this.sounds.play("pick");
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
      case "keep": {
        const command = this.personToMove ? keepCommand(this.view, this.selection) : null;
        if (command) void this.play(command);
        return;
      }
      case "reroll":
        if (this.personToMove && this.view.canReroll) void this.play({ kind: "reroll" });
        return;
      case "pass":
        if (this.personToMove && this.view.canPass) void this.play({ kind: "pass" });
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
    const hand = view.players[view.toMove]?.hand ?? null;
    const choosing = selection.kind === "none" || selection.kind === "market";
    return {
      active: view.toMove,
      selectedMarket: selection.kind === "market" ? selection.die : null,
      handSelected: selection.kind === "hand" || selection.kind === "handAt",
      targets: person ? targetsOf(view, selection) : [],
      ghostValue: selectedValue(view, selection),
      pending: selection.kind === "handAt" && hand !== null ? { at: selection.at, value: hand } : null,
      unfit: person && choosing ? marketFits(view).map((fits) => !fits) : [],
      last: this.last,
    };
  }

  /** The room the panels take over the canvas, so the table is framed in the rest. */
  private insets(): { top: number; bottom: number; left: number; right: number } {
    const rect = this.root.getBoundingClientRect();
    const box = (selector: string) => this.root.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
    const top = box(".topbar");
    const dock = box("[data-dock]");
    const players = box("[data-players]");
    const narrow = rect.width < 760;
    return {
      top: Math.max(0, (narrow && players ? players.bottom : top?.bottom ?? 0) - rect.top),
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
    const round = view.end === null ? `Rodada ${view.round}` : "Fim do jogo";
    need(this.host, "[data-status]").innerHTML = `<span class="pill">${esc(round)}</span><span class="pill bag">${esc(bagText(this.bag))}</span>`;
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
      `<button type="button" class="tool" data-action="history" aria-pressed="${this.historyOpen}">${TOOLS.history}</button>`,
      `<a class="tool" href="../liu.html" target="_blank" rel="noopener">${TOOLS.rules}</a>`,
      `<button type="button" class="tool" data-action="leave">${TOOLS.leave}</button>`,
    ].join("");
  }

  private renderPlayers(): void {
    const view = this.view;
    const counts = sealCounts(view);
    const best = Math.max(...counts);
    const leaders = counts.filter((c) => c === best).length;
    const cards = view.players
      .map((player, i) => {
        const active = view.end === null && view.toMove === i;
        const won = view.winners?.includes(i) ?? false;
        const level = this.options.bots[i];
        const bot = level ? `<span class="tag">Bot ${esc(botLevel(level).label.toLowerCase())}</span>` : "";
        const state = won ? '<span class="tag won">Venceu</span>' : active ? `<span class="tag now">${this.thinking ? "Pensando" : "Vez"}</span>` : "";
        const handSelected = active && (this.selection.kind === "hand" || this.selection.kind === "handAt");
        const hand = player.hand === null ? emptySlot(24) : dieIcon(player.hand, 24);
        const majority = view.end === null && counts[i]! > 0 && counts[i] === best && leaders === 1;
        return `<article class="player${active ? " active" : ""}${won ? " won" : ""}" style="--seat:${sealColor(i)}">
          <div class="seal">${dieIcon(player.seal, 34, sealColor(i))}</div>
          <div class="who"><div class="name">${esc(this.names[i]!)}</div><div class="tags">${bot}${state}</div></div>
          <div class="score"><b>${player.score.points}</b><span>${player.score.points === 1 ? "ponto" : "pontos"}</span></div>
          <div class="facts">
            <span class="hand${handSelected ? " picked" : ""}" title="Mão">${hand}<span>mão</span></span>
            <span class="seal-count${majority ? " lead" : ""}" title="Dados do mercado com o número do selo">${dieIcon(player.seal, 16, sealColor(i))}<span class="long">${esc(inMarket(counts[i]!))}</span><span class="short">${counts[i]}</span></span>
            <span class="dice">${esc(diceCount(player.score.dice))}</span>
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
      dock.innerHTML = `<div class="prompt"><div class="title">${esc(winnersText(view.winners ?? [], this.names))}</div><p>${esc(hint(view, NONE, this.names))}</p></div>
        <div class="actions"><button type="button" class="primary" data-action="results">${TOOLS.results}</button><button type="button" data-action="new-game">${ACTIONS.newGame}</button></div>`;
      return;
    }
    const bot = this.isBot(view.toMove);
    const me = view.toMove;
    const title = turnTitle(view, this.names, bot, this.people);
    let text: string;
    if (this.busy) text = this.happening ?? `${this.names[me]} está jogando…`;
    else if (bot) text = `${this.names[me]} está pensando…`;
    else text = hint(view, this.selection, this.names);
    const live = this.personToMove;
    const keepable = live && keepCommand(view, this.selection) !== null;
    const can = (allowed: boolean) => (live && allowed ? "" : "disabled");
    const cancel = live && this.selection.kind !== "none" ? `<button type="button" class="ghost" data-action="cancel">Cancelar</button>` : "";
    const selected = selectedValue(view, this.selection);
    const chip = live && selected !== null ? `<span class="chip">${dieIcon(selected, 26)}</span>` : "";
    dock.innerHTML = `<div class="prompt" style="--seat:${sealColor(me)}">
        <div class="title">${dieIcon(view.players[me]!.seal, 22, sealColor(me))}<span>${esc(title)}</span></div>
        <p>${chip}<span>${esc(text)}</span></p>
        ${this.error ? `<p class="warn">${esc(this.error)}</p>` : ""}
      </div>
      <div class="actions">
        ${cancel}
        <button type="button" data-action="keep" ${keepable ? "" : "disabled"} title="Pega o dado escolhido do mercado e o guarda na mão">${ACTIONS.keep}</button>
        <button type="button" data-action="reroll" ${can(view.canReroll)} title="Devolve o dado da mão ao mercado e rola o mercado de novo">${ACTIONS.reroll}</button>
        <button type="button" data-action="pass" ${can(view.canPass)}>${ACTIONS.pass}</button>
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
    const order = view.players
      .map((p, i) => ({ i, p }))
      .sort((a, b) => b.p.score.points - a.p.score.points || b.p.score.dice - a.p.score.dice);
    const rows = order
      .map(({ i, p }, rank) => {
        const won = view.winners?.includes(i) ?? false;
        const code = p.score.code ? `<span class="code">código ${p.score.code.join(" ")}</span>` : "";
        return `<li class="${won ? "won" : ""}" style="--seat:${sealColor(i)}">
          <span class="rank">${rank + 1}</span>${dieIcon(p.seal, 28, sealColor(i))}
          <div><b>${esc(this.names[i]!)}</b>${code}<small>${esc(scoreText(p.score))} ${esc(diceCount(p.score.dice))} na janela.</small></div>
          <span class="pts">${esc(points(p.score.points))}</span>
        </li>`;
      })
      .join("");
    el.innerHTML = `<div class="end-card" role="dialog" aria-label="Fim do jogo">
      <div class="kicker">Fim do jogo</div>
      <h2>${esc(winnersText(view.winners ?? [], this.names))}</h2>
      <p class="reason">${esc(hint(view, NONE, this.names))}</p>
      <ol class="ranking">${rows}</ol>
      <div class="actions"><button type="button" data-action="see-table">${TOOLS.seeTable}</button><button type="button" class="primary" data-action="new-game">${ACTIONS.newGame}</button></div>
    </div>`;
  }
}
