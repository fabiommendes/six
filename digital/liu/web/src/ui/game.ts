import { BotCancelled, type BotPlayer } from "../bot/client";
import { botLevel } from "../bot/levels";
import type { Command, Event, LiuGame, Pos, View } from "../engine/game";
import type { SeatBot } from "../logic/save";
import { click, keepCommand, NONE, selectedValue, targetsOf, type Click, type Selection } from "../logic/selection";
import { ACTIONS, eventText, hint, points, scoreText, winnersText } from "../logic/texts";
import { esc } from "./dom";
import { brandMark, dieIcon, emptySlot, latticeBand, sealColor, windowSvg } from "./svg";

/** Lines of the log kept on screen. */
const LOG_LINES = 6;

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

/**
 * The game screen: the panel with the market and the actions, and the
 * windows of every player. The engine decides what is legal; the screen
 * only turns clicks into commands (`logic/selection`). On a bot's turn it
 * asks the bot player and ignores the clicks on the game until it answers.
 */
export class GameScreen {
  private view: View;
  private selection: Selection = NONE;
  private log: string[] = [];
  /** The die put last, in whose window. */
  private last: { player: number; at: Pos } | null = null;
  private error: string | null = null;
  private confirmingLeave = false;
  /** A bot is choosing a command. */
  private thinking = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly game: LiuGame,
    private readonly options: GameScreenOptions,
  ) {
    this.view = game.view();
    this.record(game.openingEvents());
    host.onclick = (event) => this.onClick(event);
    document.onkeydown = (event) => {
      if (event.key === "Escape" && this.selection.kind !== "none") {
        this.selection = NONE;
        this.render();
      }
    };
    this.render();
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

  /** Asks the bot to move, when it is a bot's turn and none is thinking. */
  private runBot(): void {
    const level = this.options.bots[this.view.toMove];
    if (!this.botToMove || this.thinking || !level) return;
    this.thinking = true;
    this.options.botPlayer.choose(JSON.stringify(this.game.state()), botLevel(level).spec).then(
      (command) => {
        this.thinking = false;
        this.play(command);
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
    return this.game.canUndo() && this.options.bots.some((b) => b == null);
  }

  private record(events: readonly Event[]): void {
    for (const event of events) {
      const text = eventText(event, this.names);
      if (text) this.log.push(text);
      if (event.kind === "placed") this.last = { player: event.player, at: event.at };
    }
    this.log = this.log.slice(-LOG_LINES);
  }

  private play(command: Command): void {
    try {
      const transition = this.game.command(command);
      this.view = transition.view;
      this.record(transition.events);
      this.error = null;
    } catch (e) {
      this.error = `A jogada não vale: ${(e as Error).message}`;
    }
    this.selection = NONE;
    this.options.onChange();
    this.render();
  }

  private onClick(event: MouseEvent): void {
    const target = event.target as Element;
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action) return this.onAction(action);
    if (this.confirmingLeave) {
      this.confirmingLeave = false;
      this.render();
    }
    if (this.botToMove) return;
    let input: Click | null = null;
    const market = target.closest<HTMLElement>("[data-market]");
    if (market) input = { kind: "market", die: Number(market.dataset.market) };
    else if (target.closest("[data-hand]")) input = { kind: "hand" };
    else {
      const cell = target.closest<SVGElement>(".active .cell");
      if (cell) input = { kind: "cell", at: { row: Number(cell.dataset.row), col: Number(cell.dataset.col) } };
    }
    if (!input) return;
    const outcome = click(this.view, this.selection, input);
    this.selection = outcome.selection;
    if (outcome.command) return this.play(outcome.command);
    this.render();
  }

  private onAction(action: string): void {
    if (this.botToMove && action !== "undo" && action !== "leave") return;
    switch (action) {
      case "keep": {
        const command = keepCommand(this.view, this.selection);
        if (command) this.play(command);
        return;
      }
      case "reroll":
        return this.play({ kind: "reroll" });
      case "pass":
        return this.play({ kind: "pass" });
      case "undo":
        if (!this.canUndo()) return;
        // Back to the last command of a person, over the bots' commands.
        this.options.botPlayer.cancel();
        this.thinking = false;
        this.view = this.game.undo();
        while (this.botToMove && this.game.canUndo()) this.view = this.game.undo();
        this.selection = NONE;
        this.last = null;
        this.log.push("Jogada desfeita.");
        this.log = this.log.slice(-LOG_LINES);
        this.options.onChange();
        return this.render();
      case "leave":
        if (this.view.end === null && !this.confirmingLeave) {
          this.confirmingLeave = true;
          return this.render();
        }
        this.host.onclick = null;
        document.onkeydown = null;
        this.options.botPlayer.dispose();
        return this.options.onLeave();
    }
  }

  private render(): void {
    const view = this.view;
    const over = view.end !== null;
    const me = view.toMove;
    const waiting = this.botToMove;
    const marketDice = view.market
      .map((value, i) => {
        const selected = this.selection.kind === "market" && this.selection.die === i;
        return `<button type="button" class="die" data-market="${i}" aria-pressed="${selected}" aria-label="Dado ${value} do mercado" ${over || waiting ? "disabled" : ""}>${dieIcon(value, 40)}</button>`;
      })
      .join("");
    const keepable = !waiting && keepCommand(view, this.selection) !== null;
    const can = (allowed: boolean) => (allowed && !waiting ? "" : "disabled");
    const actions = over
      ? ""
      : `<div class="actions">
          <button type="button" data-action="keep" ${keepable ? "" : "disabled"}>${ACTIONS.keep}</button>
          <button type="button" data-action="reroll" ${can(view.canReroll)}>${ACTIONS.reroll}</button>
          <button type="button" data-action="pass" ${can(view.canPass)}>${ACTIONS.pass}</button>
          <button type="button" data-action="undo" ${this.canUndo() ? "" : "disabled"}>${ACTIONS.undo}</button>
        </div>`;
    const turn = over
      ? `<div class="turn"><div><div class="who">Fim do jogo</div><div class="what">${esc(winnersText(view.winners ?? [], this.names))}</div></div></div>`
      : `<div class="turn">${dieIcon(view.players[me]!.seal, 34, sealColor(me))}<div><div class="who">${esc(this.names[me]!)}</div><div class="what">Rodada ${view.round} · ${view.bag} dados no saco</div></div></div>`;
    const results = over ? this.resultsHtml() : "";
    const leave = this.confirmingLeave ? "Abandonar esta partida?" : ACTIONS.newGame;
    this.host.innerHTML = `<div class="screen">
      <aside class="panel">
        <div class="brand">${brandMark(24)}<span>SIX</span></div>
        <h1>Liu</h1>
        <div class="band">${latticeBand(296)}</div>
        ${turn}
        <p class="note${over ? " result" : ""}">${esc(hint(view, this.selection, this.names, waiting))}</p>
        ${this.error ? `<p class="note warn">${esc(this.error)}</p>` : ""}
        ${results}
        <section class="market"><h2>Mercado</h2><div class="market-dice">${marketDice || '<span class="empty">vazio</span>'}</div></section>
        ${actions}
        <ol class="log">${this.log.map((line) => `<li>${esc(line)}</li>`).join("")}</ol>
        <div class="foot"><button type="button" data-action="leave" class="${this.confirmingLeave ? "danger" : ""}">${leave}</button></div>
      </aside>
      <main class="windows count-${view.players.length}">${view.players.map((_, i) => this.playerHtml(i)).join("")}</main>
    </div>`;
    this.runBot();
  }

  private resultsHtml(): string {
    const view = this.view;
    const order = view.players
      .map((p, i) => ({ i, p }))
      .sort((a, b) => b.p.score.points - a.p.score.points || b.p.score.dice - a.p.score.dice);
    const rows = order
      .map(({ i, p }) => {
        const won = view.winners?.includes(i) ? " won" : "";
        return `<li class="${won.trim()}">${dieIcon(p.seal, 22, sealColor(i))}<div><b>${esc(this.names[i]!)}</b> · ${points(p.score.points)} · ${p.score.dice} dados<br><span>${esc(scoreText(p.score))}</span></div></li>`;
      })
      .join("");
    return `<ol class="results">${rows}</ol>`;
  }

  private playerHtml(i: number): string {
    const view = this.view;
    const player = view.players[i]!;
    const active = view.end === null && view.toMove === i;
    const human = !this.isBot(i);
    const selection = active && human ? this.selection : NONE;
    const value = active ? selectedValue(view, selection) : null;
    const handSelected = selection.kind === "hand" || selection.kind === "handAt";
    const hand =
      player.hand === null
        ? emptySlot(40)
        : active && human
          ? `<button type="button" class="die" data-hand aria-pressed="${handSelected}" aria-label="Dado ${player.hand} da mão" ${view.canPlaceFromHand ? "" : "disabled"}>${dieIcon(player.hand, 40)}</button>`
          : dieIcon(player.hand, 40);
    const svg = windowSvg(player, {
      player: i,
      targets: active && human ? targetsOf(view, selection) : [],
      pending: selection.kind === "handAt" && value !== null ? { at: selection.at, value } : undefined,
      last: this.last?.player === i ? this.last.at : null,
    });
    const now = active ? '<span class="now">VEZ</span>' : "";
    const bot = human ? "" : '<span class="bot">BOT</span>';
    const won = view.winners?.includes(i) ? '<span class="now">VENCEU</span>' : "";
    return `<section class="player${active ? " active" : ""}" style="--seal:${sealColor(i)}">
      <header>${dieIcon(player.seal, 26, sealColor(i))}<span class="name">${esc(this.names[i]!)}</span>${bot}${now}${won}<span class="pts">${points(player.score.points)}</span></header>
      <div class="board">${svg}<div class="hand"><span>Mão</span>${hand}</div></div>
    </section>`;
  }
}
