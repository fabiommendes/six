import { BotCancelled, type BotPlayer } from "../bot/client";
import { botLevel } from "../bot/levels";
import type { Command, Event, SiaGame, View } from "../engine/game";
import { claimable, FORMATION_RULES, FORMATIONS_BY_STRENGTH, FORMATION_NAMES, longestRun, stoneLetter } from "../logic/formation";
import type { SeatBot } from "../logic/save";
import { click, NONE, placeTargets, rerollCommand, rerollPreview, rerollStart, selectedDie, type Click, type Selection } from "../logic/selection";
import {
  ACTIONS,
  claimTag,
  dieText,
  eventText,
  handText,
  happeningText,
  hint,
  sideLines,
  stonesCount,
  TOOLS,
  turnTitle,
  winnersText,
} from "../logic/texts";
import { Sounds } from "../table/sound";
import { NO_MARKS, Table3D, type Pick, type TableMarks } from "../table/table3d";
import { esc, need } from "./dom";
import { brandMark, dieIcon, emptySlot, seatColor, STONE_SUIT } from "./svg";

/** Lines of the history kept. */
const LOG_LINES = 80;

export interface GameScreenOptions {
  readonly names: readonly string[];
  /** Who plays each seat: a person (null) or a bot level. */
  readonly bots: readonly SeatBot[];
  /** Plays for the bot seats; disposed when the screen is left. */
  readonly botPlayer: BotPlayer;
  /** A game just begun: its preparation is played on the table. */
  readonly fresh: boolean;
  /** Called after every change, to save the game. */
  readonly onChange: () => void;
  /** Leaves the game for the start screen. */
  readonly onLeave: () => void;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * The game screen: the table in 3D over the whole page, and over it the
 * players, the cards of the stones, the prompt with the actions, the
 * history and the end of the game. The engine decides what is legal; the
 * screen turns picks on the table into commands (`logic/selection`) and
 * plays the events of each command on the table before the next one. On a
 * bot's turn it asks the bot player, shows what the bot is about to do, and
 * ignores the picks until the play is over.
 */
export class GameScreen {
  private view: View;
  private selection: Selection = NONE;
  private log: string[] = [];
  /** The side of a stone where a die was put last. */
  private last: { seat: number; stone: number } | null = null;
  private error: string | null = null;
  private confirmingLeave = false;
  /** A bot is choosing a command. */
  private thinking = false;
  /** The table is playing the events of a command. */
  private busy = false;
  /** What the table is showing while busy, for the prompt. */
  private happening: string | null = null;
  /** The preparation is playing: the numbers of the stones are not yet known to the cards. */
  private preparing = false;
  private historyOpen = false;
  /** On a narrow screen the card of the formations is hidden until asked for. */
  private formationsOpen = false;
  private endCardOpen = true;
  /** The seat whose side is at the bottom of the screen. */
  private viewer = 0;
  /** The stone the pointer is over, on the table or on a card. */
  private focus: number | null = null;
  private readonly sounds = new Sounds();
  private readonly table: Table3D | null = null;
  private readonly root: HTMLElement;
  private readonly people: number;
  private bannerTimer = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    private readonly game: SiaGame,
    private readonly options: GameScreenOptions,
  ) {
    this.view = game.view();
    this.people = options.bots.filter((b) => b == null).length;
    host.innerHTML = `<div class="game">
      <div class="stage"></div>
      <header class="topbar">
        <div class="brand">${brandMark(22)}<span>SIX</span><b>Sia</b></div>
        <div class="status" data-status></div>
        <nav class="tools" data-tools></nav>
      </header>
      <div class="left-col">
        <aside class="players" data-players></aside>
        <aside class="formations" data-formations aria-label="Formações"></aside>
      </div>
      <section class="stones" data-stones aria-label="Marcos"></section>
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
        onHover: (stone) => this.setFocus(stone),
      });
    } catch (e) {
      need(host, ".stage").innerHTML = `<p class="stage-error">Este navegador não conseguiu desenhar a mesa em 3D (${esc(String(e))}).</p>`;
    }
    // The browser tests find the dice and the cells on the page through the table.
    if (import.meta.env.DEV) Object.assign(window, { siaTable: this.table, siaScreen: this });
    need(host, "[data-formations]").innerHTML = formationsCard();
    this.viewer = this.firstViewer();
    this.table?.setViewer(this.viewer, true);
    host.onclick = (event) => this.onClick(event);
    host.onpointerover = (event) => this.onCardHover(event);
    document.onkeydown = (event) => this.onKey(event);
    this.resizeObserver = new ResizeObserver(() => this.table?.refit());
    for (const selector of ["[data-players]", "[data-formations]", "[data-dock]", "[data-stones]", ".topbar"]) this.resizeObserver.observe(need(host, selector));
    if (options.fresh) {
      this.table?.showEmpty(this.view);
      this.render();
      void this.opening();
    } else {
      this.table?.show(this.view, this.marks());
      this.render();
      this.afterStart();
    }
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

  /** The preparation of a new game, played on the table. */
  private async opening(): Promise<void> {
    this.busy = true;
    this.preparing = true;
    this.renderStones();
    const events = this.game.openingEvents();
    this.renderDock();
    await this.table?.animate(events, this.view, this.marks(), { onEvent: (event) => this.onEvent(event, this.view) });
    this.busy = false;
    this.preparing = false;
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

  private record(event: Event, view: View): void {
    const text = eventText(event, this.names, view);
    if (text) this.log.push(text);
    if (event.kind === "placed") this.last = { seat: event.player, stone: event.stone };
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
    this.table?.setMarks({ ...NO_MARKS, active: before.toMove, last: this.marksLast() });
    this.renderDock();
    this.renderPlayers();
    if (this.table) {
      await this.table.animate(transition.events, after, this.marksFor(after, NONE), { onEvent: (event) => this.onEvent(event, after) });
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
    this.table?.show(this.view, this.marks());
    if (!this.isBot(this.view.toMove)) this.setViewer(this.view.toMove);
    this.banner("Movimento desfeito", "");
    this.render();
    this.runBot();
  }

  // --- Input -----------------------------------------------------------------

  /** A pick on the table as a click of the selection, when it is about the player to move. */
  private clickOf(pick: Pick): Click | null {
    const me = this.view.toMove;
    switch (pick.kind) {
      case "hand":
        // In a reroll both hands can be picked; otherwise only the own.
        return pick.seat === me || this.selection.kind === "reroll" ? { kind: "hand", seat: pick.seat, die: pick.die } : null;
      case "stone":
        return pick;
      case "side":
        return pick.seat === me ? pick : null;
    }
  }

  private canPick(pick: Pick): boolean {
    if (!this.personToMove) return false;
    const view = this.view;
    const selection = this.selection;
    switch (pick.kind) {
      case "hand":
        return selection.kind === "reroll" || pick.seat === view.toMove;
      case "stone":
        return selection.kind !== "reroll" && (view.claimable[pick.stone] === true || (selection.kind === "die" && view.open[pick.stone] === true));
      case "side":
        return selection.kind === "die" && pick.seat === view.toMove && view.open[pick.stone] === true;
    }
  }

  private onPick(pick: Pick | null): void {
    this.dismissLeave();
    if (!this.personToMove) return;
    const input = pick ? this.clickOf(pick) : null;
    if (!input) {
      if (this.selection.kind === "die") this.select(NONE);
      return;
    }
    this.apply(click(this.view, this.selection, input));
  }

  private apply(outcome: ReturnType<typeof click>): void {
    this.error = outcome.note;
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
    this.renderStones();
  }

  private setFocus(stone: number | null): void {
    if (stone === this.focus) return;
    this.focus = stone;
    this.table?.setMarks(this.marks());
    this.renderStones();
  }

  private onCardHover(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    const target = event.target as Element;
    // Moving over the table is reported by the table itself.
    if (target.classList.contains("table-canvas")) return;
    const card = target.closest<HTMLElement>("[data-stone]");
    this.setFocus(card ? Number(card.dataset.stone) : null);
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
    const card = target.closest<HTMLElement>("[data-stone]");
    if (card && !target.closest("[data-action]")) {
      this.dismissLeave();
      if (this.personToMove) this.apply(click(this.view, this.selection, { kind: "stone", stone: Number(card.dataset.stone) }));
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;
    if (action !== "leave" && action !== "stay") this.dismissLeave();
    switch (action) {
      case "reroll":
        if (this.personToMove && this.view.canReroll) this.select(rerollStart(this.view, this.selection));
        return;
      case "reroll-target": {
        if (this.selection.kind !== "reroll") return;
        const seat = Number((target.closest("[data-seat]") as HTMLElement | null)?.dataset.seat);
        this.select({ ...this.selection, target: seat, dice: [] });
        return;
      }
      case "reroll-go": {
        const command = rerollCommand(this.selection);
        if (this.personToMove && command) void this.play(command);
        return;
      }
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
      case "formations":
        this.formationsOpen = !this.formationsOpen;
        this.root.classList.toggle("show-formations", this.formationsOpen);
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
    this.host.onpointerover = null;
    document.onkeydown = null;
    clearTimeout(this.bannerTimer);
    this.resizeObserver.disconnect();
    this.options.botPlayer.dispose();
    this.table?.dispose();
    this.options.onLeave();
  }

  // --- Marks -----------------------------------------------------------------

  private marksLast(): TableMarks["last"] {
    return this.last;
  }

  private marks(): TableMarks {
    return this.marksFor(this.view, this.selection);
  }

  private marksFor(view: View, selection: Selection): TableMarks {
    if (view.end !== null) return { ...NO_MARKS, last: this.last, focus: this.focus };
    const person = !this.isBot(view.toMove);
    const building = selection.kind === "reroll";
    return {
      active: view.toMove,
      selectedDie: selection.kind === "die" ? selection.die : null,
      targets: person ? placeTargets(view, selection) : [],
      claims: person && !building ? claimable(view).map((stone) => ({ stone, text: claimTag(view, stone) })) : [],
      lost: building ? selection.lost : null,
      rolling: building && selection.target !== null ? { seat: selection.target, dice: selection.dice } : null,
      ghost: person ? selectedDie(view, selection) : null,
      focus: this.focus,
      last: this.last,
    };
  }

  /** The room the panels take over the canvas, so the table is framed in the rest. */
  private insets(): { top: number; bottom: number; left: number; right: number } {
    const rect = this.root.getBoundingClientRect();
    const box = (selector: string) => this.root.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
    const stones = box("[data-stones]");
    const dock = box("[data-dock]");
    const players = box("[data-players]");
    const narrow = rect.width < 760;
    return {
      top: Math.max(0, (stones?.bottom ?? box(".topbar")?.bottom ?? 0) - rect.top),
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
    this.renderStones();
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
      `<button type="button" class="tool formations-toggle" data-action="formations" aria-pressed="${this.formationsOpen}">${TOOLS.formations}</button>`,
      `<button type="button" class="tool" data-action="history" aria-pressed="${this.historyOpen}">${TOOLS.history}</button>`,
      `<button type="button" class="tool" data-action="leave">${TOOLS.leave}</button>`,
    ].join("");
  }

  private renderPlayers(): void {
    const view = this.view;
    const cards = view.players
      .map((player, i) => {
        const active = view.end === null && view.toMove === i;
        const won = view.winners?.includes(i) ?? false;
        const level = this.options.bots[i];
        const bot = level ? `<span class="tag">Bot ${esc(botLevel(level).label.toLowerCase())}</span>` : "";
        const state = won ? '<span class="tag won">Venceu</span>' : active ? `<span class="tag now">${this.thinking ? "Pensando" : "Vez"}</span>` : "";
        const run = longestRun(view, i);
        const losing = active && this.selection.kind === "reroll" && this.selection.lost !== null;
        return `<article class="player${active ? " active" : ""}${won ? " won" : ""}" style="--seat:${seatColor(i)}">
          <div class="seat-dot"></div>
          <div class="who"><div class="name">${esc(this.names[i]!)}</div><div class="tags">${bot}${state}</div></div>
          <div class="score"><b>${player.stones}</b><span>de 5 marcos</span></div>
          <div class="facts">
            <span title="Marcos vizinhos em fileira: 3 vencem">vizinhos ${run} de 3</span>
            <span class="hand${losing ? " losing" : ""}" title="Dados na mão">mão: ${esc(handText(player.hand.length, view.handSize, player.lost))}</span>
          </div>
          ${active && this.thinking ? '<div class="thinking" aria-hidden="true"><i></i><i></i><i></i></div>' : ""}
        </article>`;
      })
      .join("");
    need(this.host, "[data-players]").innerHTML = cards;
  }

  /** The nine stones as cards, in the order they are on the screen, with the formation of each side. */
  private renderStones(): void {
    const view = this.view;
    const order = view.stones.map((_, i) => i);
    if (this.viewer === 1) order.reverse();
    const near = this.viewer;
    const far = 1 - near;
    const claimableNow = this.personToMove ? new Set(claimable(view)) : new Set<number>();
    const side = (stone: number, seat: number) => {
      const s = view.stones[stone]!.sides[seat]!;
      const lines = sideLines(s);
      const tiebreak = lines.tiebreak ? `<span class="tie">${esc(lines.tiebreak)}</span>` : "";
      return `<div class="side${s.formation ? "" : " open"}" style="--seat:${seatColor(seat)}" title="${esc(this.names[seat]!)}"><i class="dot"></i><span class="fname">${esc(lines.title)}</span><span class="fnote">${esc(lines.note)}</span>${tiebreak}</div>`;
    };
    need(this.host, "[data-stones]").innerHTML = order
      .map((i) => {
        const stone = view.stones[i]!;
        const owner = stone.owner;
        const can = claimableNow.has(i);
        const classes = ["stone-card"];
        if (owner !== null) classes.push("owned");
        if (can) classes.push("can");
        if (this.focus === i) classes.push("focus");
        const style = owner !== null ? ` style="--owner:${seatColor(owner)}"` : "";
        const ribbon = can ? '<b class="ribbon">Reivindicar</b>' : owner !== null ? `<b class="ribbon taken" title="Tomado por ${esc(this.names[owner]!)}">Tomado</b>` : "";
        return `<button type="button" class="${classes.join(" ")}" data-stone="${i}"${style} aria-label="Marco ${stoneLetter(i)}, número ${stone.number}">
          <header><span class="letter">${stoneLetter(i)}</span>${this.preparing ? emptySlot(22) : dieIcon(stone.number, 22, STONE_SUIT)}${ribbon}</header>
          ${side(i, far)}${side(i, near)}
        </button>`;
      })
      .join("");
    const strip = need(this.host, "[data-stones]");
    // On a narrow screen the strip scrolls: keep the card of interest in view.
    const interest = strip.querySelector<HTMLElement>(".can") ?? strip.querySelector<HTMLElement>(".focus");
    if (interest && strip.scrollWidth > strip.clientWidth) interest.scrollIntoView({ block: "nearest", inline: "center" });
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
    const can = (allowed: boolean) => (live && allowed ? "" : "disabled");
    const rerolling = live && this.selection.kind === "reroll";
    const die = live ? selectedDie(view, this.selection) : null;
    const chip = die ? `<span class="chip">${dieIcon(die.value, 26, die.suit)}</span>` : "";
    dock.innerHTML = `<div class="prompt" style="--seat:${seatColor(me)}">
        <div class="title"><i class="seat-dot"></i><span>${esc(title)}</span></div>
        <p>${chip}<span>${esc(text)}</span></p>
        ${rerolling ? this.rerollPanel() : ""}
        ${this.error ? `<p class="warn">${esc(this.error)}</p>` : ""}
      </div>
      <div class="actions">
        ${rerolling ? `<button type="button" class="ghost" data-action="cancel">${ACTIONS.cancel}</button><button type="button" class="primary" data-action="reroll-go" ${rerollCommand(this.selection) ? "" : "disabled"}>${ACTIONS.confirmReroll}</button>` : `
        ${live && this.selection.kind !== "none" ? `<button type="button" class="ghost" data-action="cancel">${ACTIONS.cancel}</button>` : ""}
        <button type="button" data-action="reroll" ${can(view.canReroll)} title="Perde um dado seu para sempre e rola de novo dados de uma mão">${ACTIONS.reroll}</button>
        <button type="button" data-action="pass" ${can(view.canPass)}>${ACTIONS.pass}</button>
        <button type="button" class="ghost" data-action="undo" ${this.canUndo() ? "" : "disabled"} title="Ctrl+Z">${ACTIONS.undo}</button>`}
      </div>`;
  }

  /** The controls of a reroll: whose hand, and the cost with the dice that are lost and rolled. */
  private rerollPanel(): string {
    const view = this.view;
    const selection = this.selection;
    if (selection.kind !== "reroll") return "";
    const preview = rerollPreview(view, selection)!;
    const me = view.toMove;
    const seg = [me, 1 - me]
      .map((seat) => `<button type="button" data-action="reroll-target" data-seat="${seat}" aria-pressed="${selection.target === seat}" style="--seat:${seatColor(seat)}">${seat === me ? "Minha mão" : `Mão de ${esc(this.names[seat]!)}`}</button>`)
      .join("");
    const lost = preview.lost ? `<span class="cost lose">${dieIcon(preview.lost.value, 22, preview.lost.suit)}<span>perde ${esc(dieText(preview.lost))}</span></span>` : '<span class="cost none">nenhum dado perdido</span>';
    const rolled = preview.rolled.length > 0 ? `<span class="cost roll">${preview.rolled.map((d) => dieIcon(d.value, 20, d.suit)).join("")}<span>rola ${preview.rolled.length === 1 ? "1 dado" : `${preview.rolled.length} dados`}</span></span>` : '<span class="cost none">nenhum dado a rolar</span>';
    return `<div class="reroll"><div class="seg" role="group" aria-label="Mão a rolar">${seg}</div><div class="costs">${lost}${rolled}</div></div>`;
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
      .sort((a, b) => b.p.stones - a.p.stones)
      .map(({ i, p }, rank) => {
        const won = view.winners?.includes(i) ?? false;
        const letters = view.stones.flatMap((s, k) => (s.owner === i ? [stoneLetter(k)] : []));
        return `<li class="${won ? "won" : ""}" style="--seat:${seatColor(i)}">
          <span class="rank">${rank + 1}</span><i class="seat-dot"></i>
          <div><b>${esc(this.names[i]!)}</b><small>${letters.length > 0 ? `Marcos ${letters.join(", ")}` : "Nenhum marco"}.</small></div>
          <span class="pts">${esc(stonesCount(p.stones))}</span>
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

/** The fixed card of the formations: the order, what each one is, and how a tie is broken. */
function formationsCard(): string {
  const rows = FORMATIONS_BY_STRENGTH.map(
    (kind, i) => `<li><span class="pos">${i + 1}</span><div><b>${esc(FORMATION_NAMES[kind])}</b><span>${esc(FORMATION_RULES[kind])}</span></div></li>`,
  ).join("");
  return `<h2>Formações</h2>
    <p class="sub">Da mais forte para a mais fraca. Cada lado vale pelos 3 dados do jogador mais o marco.</p>
    <ol>${rows}</ol>
    <p class="tie-rule"><b>Desempate:</b> a formação do mesmo tipo com maior soma dos 4 números vence; se a soma empata, vence quem completou o lado primeiro.</p>
    <p class="claim-rule"><b>Reivindicar:</b> com os dois lados de um marco completos, a melhor formação o toma. Antes disso, você o toma se nenhuma formação que o adversário ainda possa completar vence a sua. Quem toma o faz no seu turno, e a coluna vai para o seu lado.</p>`;
}
