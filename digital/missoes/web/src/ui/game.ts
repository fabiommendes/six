import type { Action, Answer, Decision, MissionsGame, Spot, Step, View } from "../engine/game";
import { clickable, clickDie, IDLE, modify, moved, sacrifice, type ActMode, type ActOptions } from "../logic/act";
import {
  faceText,
  KIND_NAMES,
  MISSION_NAMES,
  MISSION_RULES,
  orderLine,
  points,
  prompt,
  roundLine,
  sameSpot,
  spotColumn,
  spotMission,
  stepLine,
  TITLE,
  winnersText,
} from "../logic/texts";
import { Table3D, type Marks, type PickKey } from "../table/table3d";
import { wait } from "../table/motion";
import { esc, need } from "./dom";
import { brandMark, dieIcon, seatColor, seatIcon } from "./svg";

export interface GameOptions {
  readonly names: readonly string[];
  readonly onLeave: () => void;
}

/** The least time a bot answer takes on screen, so its plays can be followed. */
const BOT_PACE_MS = 650;

const keyOf = (spot: Spot) => `card:${spotColumn(spot)}`;

/** The game screen: the table in 3D and a side panel with the players, the decision at hand and the history. */
export class GameScreen {
  private view: View;
  /** The view of the table while the result of a round is shown: the round as it ended. */
  private ended: View | null = null;
  private readonly table: Table3D;
  private readonly side: HTMLElement;
  private readonly overlay: HTMLElement;
  private history: string[] = [];
  /** Dice picked for a select or a cash answer, or the die picked to buy. */
  private picked = new Set<number>();
  private mode: ActMode = IDLE;
  private busy = false;
  private paused = false;
  private error = "";
  private disposed = false;

  constructor(
    host: HTMLElement,
    private readonly game: MissionsGame,
    first: View,
    private readonly options: GameOptions,
  ) {
    this.view = first;
    host.innerHTML = `<div class="game"><div class="stage"></div><aside class="side"></aside><div class="overlay" hidden></div></div>`;
    this.side = need(host, ".side");
    this.overlay = need(host, ".overlay");
    this.table = new Table3D(need(host, ".stage"), {
      onPick: (key) => this.pick(key),
      reducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    this.side.addEventListener("click", (event) => this.sideClick(event));
    this.overlay.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("[data-continue]")) this.resume();
      if ((event.target as HTMLElement).closest("[data-leave]")) this.leave();
    });
    if (import.meta.env.DEV) Object.assign(window, { missoesScreen: this, missoesTable: this.table });
    this.history.push(`Rodada 1. Meta: ${points(first.goal)}.`);
    this.prepare();
    this.render();
    void this.next();
  }

  /** The current view, for tests in the browser. */
  current(): View {
    return this.view;
  }

  dispose(): void {
    this.disposed = true;
    this.table.dispose();
    this.game.dispose();
  }

  private get names(): readonly string[] {
    return this.options.names;
  }

  private personToMove(): boolean {
    const pending = this.view.pending;
    return !!pending && this.view.bots[pending.player] === null;
  }

  private decision(): Decision | null {
    return this.view.pending?.decision ?? null;
  }

  /** Resets the picks for a new decision, with the obvious picks made. */
  private prepare(): void {
    this.picked = new Set();
    this.mode = IDLE;
    const pending = this.view.pending;
    if (pending?.decision.kind === "select" && this.view.reserves[pending.player]!.length === pending.decision.count) {
      this.picked = new Set(this.view.reserves[pending.player]!.map((_, i) => i));
    }
  }

  /** Plays the bots, and the answers a person has no choice about, until a person decides or the game pauses. */
  private async next(): Promise<void> {
    while (!this.disposed && !this.paused && !this.busy && this.view.pending) {
      const pending = this.view.pending;
      if (this.view.bots[pending.player] !== null) {
        const started = performance.now();
        await this.run(() => this.game.playBot(), BOT_PACE_MS - (performance.now() - started));
        if (this.error) return;
        continue;
      }
      if (pending.decision.kind === "cash" && pending.decision.options.length === 0) {
        await this.run(() => this.game.apply({ kind: "cash", dice: [] }), 0);
        if (this.error) return;
        continue;
      }
      return;
    }
  }

  private async answer(answer: Answer): Promise<void> {
    if (this.busy || !this.personToMove()) return;
    await this.run(() => this.game.apply(answer), 0);
    void this.next();
  }

  /** Runs one step of the engine and shows it. */
  private async run(step: () => Promise<Step>, pace: number): Promise<void> {
    this.busy = true;
    this.render();
    try {
      const started = performance.now();
      const result = await step();
      await wait(pace - (performance.now() - started));
      if (this.disposed) return;
      this.error = "";
      this.absorb(result);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
    }
    this.render();
  }

  private absorb(step: Step): void {
    const before = this.view;
    this.view = step.view;
    this.history.push(stepLine(step, before, this.names));
    const order = step.view.current?.order ?? [];
    if (order.length > 0 && (before.current?.order.length ?? 0) === 0 && before.round === step.view.round) {
      this.history.push(orderLine(step.view, this.names));
    }
    if (step.view.last && step.view.last.round !== before.last?.round) {
      this.history.push(roundLine(step.view, this.names));
      if (step.view.pending) this.history.push(`Rodada ${step.view.round + 1}.`);
      this.paused = true;
      this.ended = before;
      this.showRound();
    }
    this.prepare();
  }

  private resume(): void {
    if (!this.view.pending) return;
    this.paused = false;
    this.ended = null;
    this.overlay.hidden = true;
    this.render();
    void this.next();
  }

  private leave(): void {
    this.dispose();
    this.options.onLeave();
  }

  /** The result of the round that just ended, or the end of the game. */
  private showRound(): void {
    const view = this.view;
    const last = view.last!;
    const rows = last.missions
      .map((mission, p) => {
        const hand = last.hands[p]!
          .filter((d) => !d.removed)
          .map((d) => `<span class="${d.counts ? "" : "faded"}">${dieIcon(d.kind, d.face, 24)}</span>`)
          .join("");
        return `<tr><td>${seatIcon(p, 16)} ${esc(this.names[p]!)}</td><td>${MISSION_NAMES[mission]}</td><td class="num">${last.results[p]}</td><td class="num"><b>+${last.deltas[p]}</b></td><td class="num">${view.points[p]}</td><td class="hand">${hand}</td></tr>`;
      })
      .join("");
    const sabotages = last.sabotages.map((s) => `${esc(this.names[s.player]!)} sabotou ${MISSION_NAMES[s.mission]}`).join("; ");
    const over = view.winners !== null;
    const allBots = view.bots.every((b) => b !== null);
    this.overlay.innerHTML = `<div class="dialog" role="dialog" aria-labelledby="round-title">
      <h2 id="round-title">${over ? esc(winnersText(view, this.names)) : `Fim da rodada ${last.round}`}</h2>
      <table class="results"><thead><tr><th>Jogador</th><th>Missão</th><th class="num">Resultado</th><th class="num">Ganhou</th><th class="num">Total</th><th>Mão</th></tr></thead><tbody>${rows}</tbody></table>
      ${sabotages ? `<p class="note">${sabotages}.</p>` : ""}
      ${over ? `<p class="note">${view.winners!.length > 1 ? "Empate nos pontos e no tamanho da reserva." : `Meta de ${points(view.goal)} alcançada na rodada ${last.round}.`}</p><button type="button" class="primary" data-leave>Nova partida</button>` : `<button type="button" class="primary" data-continue>Próxima rodada</button>`}
    </div>`;
    this.overlay.hidden = false;
    if (!over && allBots) {
      setTimeout(() => {
        if (this.paused && this.view === view) this.resume();
      }, 2500);
    }
  }

  // ---- Picks ---------------------------------------------------------------

  private pick(key: PickKey): void {
    if (this.busy || this.paused || !this.personToMove()) return;
    const pending = this.view.pending!;
    const decision = pending.decision;
    const [what, a, b] = key.split(":");
    const index = Number(what === "showcase" || what === "card" ? a : b);
    const mine = what === "showcase" || what === "card" || Number(a) === pending.player;
    if (!mine) return;
    if (what === "reserve" && decision.kind === "select") {
      this.toggle(index, decision.count);
    } else if (what === "reserve" && decision.kind === "cash") {
      if (decision.options.includes(index)) this.toggle(index, Infinity);
    } else if (what === "showcase" && decision.kind === "buy") {
      this.picked = this.picked.has(index) ? new Set() : new Set([index]);
    } else if (what === "card" && decision.kind === "place") {
      const spot = decision.spots.find((s) => spotColumn(s) === index);
      if (spot) void this.answer({ kind: "place", spot });
      return;
    } else if (what === "hand" && decision.kind === "act") {
      const click = clickDie(this.mode, decision, index);
      this.mode = click.mode;
      if (click.action) {
        void this.act(click.action);
        return;
      }
    } else return;
    this.render();
  }

  private toggle(index: number, limit: number): void {
    if (this.picked.has(index)) this.picked.delete(index);
    else if (this.picked.size < limit) this.picked.add(index);
  }

  private act(action: Action): Promise<void> {
    this.mode = IDLE;
    return this.answer({ kind: "act", action });
  }

  private sideClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-pick],[data-do]");
    if (!target || (target as HTMLButtonElement).disabled) return;
    if (target.dataset.pick) {
      this.pick(target.dataset.pick);
      return;
    }
    const decision = this.decision();
    const picked = [...this.picked].sort((x, y) => x - y);
    switch (target.dataset.do) {
      case "select":
        void this.answer({ kind: "select", dice: picked });
        break;
      case "cash":
        void this.answer({ kind: "cash", dice: picked });
        break;
      case "no-cash":
        void this.answer({ kind: "cash", dice: [] });
        break;
      case "buy":
        void this.answer({ kind: "buy", die: picked[0] ?? null });
        break;
      case "no-buy":
        void this.answer({ kind: "buy", die: null });
        break;
      case "place": {
        if (decision?.kind !== "place") break;
        const spot = decision.spots.find((s) => keyOf(s) === target.dataset.spot);
        if (spot) void this.answer({ kind: "place", spot });
        break;
      }
      case "sacrifice":
        this.mode = { kind: "sacrifice", out: null, rerolls: [] };
        this.render();
        break;
      case "confirm-sacrifice": {
        const action = sacrifice(this.mode);
        if (action) void this.act(action);
        break;
      }
      case "cancel":
        this.mode = IDLE;
        this.render();
        break;
      case "up":
      case "down": {
        const action = modify(this.mode, target.dataset.do === "up");
        if (action) void this.act(action);
        break;
      }
      case "sabotage":
        void this.act({ kind: "sabotage", card: Number(target.dataset.card) });
        break;
      case "pass":
        void this.act({ kind: "pass" });
        break;
      case "leave":
        if (!this.view.pending || window.confirm("Sair da partida? Ela não fica salva.")) this.leave();
        break;
    }
  }

  // ---- Rendering -----------------------------------------------------------

  private marks(): Marks {
    const selectable = new Set<PickKey>();
    const selected = new Set<PickKey>();
    const pending = this.view.pending;
    if (!pending || !this.personToMove() || this.busy || this.paused) return { selectable, selected };
    const p = pending.player;
    const d = pending.decision;
    switch (d.kind) {
      case "select":
        this.view.reserves[p]!.forEach((_, r) => selectable.add(`reserve:${p}:${r}`));
        this.picked.forEach((r) => selected.add(`reserve:${p}:${r}`));
        break;
      case "cash":
        d.options.forEach((r) => selectable.add(`reserve:${p}:${r}`));
        this.picked.forEach((r) => selected.add(`reserve:${p}:${r}`));
        break;
      case "buy":
        d.options.forEach((i) => selectable.add(`showcase:${i}`));
        this.picked.forEach((i) => selected.add(`showcase:${i}`));
        break;
      case "place":
        d.spots.forEach((s) => selectable.add(keyOf(s)));
        break;
      case "act": {
        clickable(this.mode, d).forEach((i) => selectable.add(`hand:${p}:${i}`));
        const mode = this.mode;
        if (mode.kind === "zero" || mode.kind === "modify") selected.add(`hand:${p}:${mode.die}`);
        if (mode.kind === "modify" && mode.target !== null) selected.add(`hand:${p}:${mode.target}`);
        if (mode.kind === "sacrifice") {
          if (mode.out !== null) selected.add(`hand:${p}:${mode.out}`);
          mode.rerolls.forEach((i) => selected.add(`hand:${p}:${i}`));
        }
        break;
      }
    }
    return { selectable, selected };
  }

  private render(): void {
    if (this.disposed) return;
    const marks = this.marks();
    this.table.show(this.ended ?? this.view, this.names, marks);
    const view = this.view;
    const roundNumber = view.pending ? view.round + 1 : view.round;
    this.side.innerHTML = `
      <header class="bar"><div class="brand">${brandMark(22)}<span>${TITLE}</span></div><span class="round">Rodada ${roundNumber} · meta ${view.goal}</span><button type="button" class="ghost" data-do="leave">Sair</button></header>
      ${this.scoreboard()}
      <section class="turn">${this.controls(marks)}${this.error ? `<p class="error">${esc(this.error)}</p>` : ""}</section>
      ${this.missions()}
      <section class="showcase"><h3>Vitrine <span class="muted">(${view.market} no mercado)</span></h3><div class="dice">${view.showcase.map((k) => `<span title="${KIND_NAMES[k]}">${dieIcon(k, null, 26)}</span>`).join("") || "<span class='muted'>vazia</span>"}</div></section>
      <section class="history"><h3>Histórico</h3><ol>${this.history.slice(-60).reverse().map((l) => `<li>${esc(l)}</li>`).join("")}</ol></section>`;
  }

  private scoreboard(): string {
    const view = this.view;
    const round = view.current;
    const rows = view.points
      .map((pts, p) => {
        const marker = round?.markers[p];
        const mission = marker ? spotMission(view, marker) : null;
        const money = round && round.hands[p]!.length > 0 ? `<span title="dinheiro">$ ${round.money[p]}</span>` : "";
        const order = round && round.order.length > 0 ? `<span title="ordem">${round.order.indexOf(p) + 1}º</span>` : "";
        const passed = round && view.pending?.decision.kind === "act" && !round.active[p] ? `<span class="tag">passou</span>` : "";
        const bought = round?.bought[p] ? `<span title="comprou">${dieIcon(round.bought[p]!, null, 16)}</span>` : "";
        const toMove = view.pending?.player === p;
        return `<li class="${toMove ? "to-move" : ""}" style="--seat:${seatColor(p)}">${seatIcon(p, 18)}<span class="name">${esc(this.names[p]!)}${view.bots[p] ? ` <span class="muted">(bot)</span>` : ""}</span><span class="pts">${pts}</span><span class="meta">${order}${money}<span title="dados na reserva">${view.reserves[p]!.length} dados</span>${bought}${mission ? `<span>${MISSION_NAMES[mission]}</span>` : ""}${passed}</span></li>`;
      })
      .join("");
    return `<ol class="scores">${rows}</ol>`;
  }

  private missions(): string {
    const view = this.view;
    const round = view.current;
    const table = round ? round.table : view.table;
    const spots: Spot[] = [{ kind: "standard" }, ...table.map((_, card) => ({ kind: "card", card }) as Spot)];
    const items = spots
      .map((spot) => {
        const mission = spot.kind === "standard" ? "standard" : table[spot.card];
        if (!mission) return `<li class="gone">${MISSION_NAMES[view.table[(spot as { card: number }).card]!]} <span class="muted">sabotada</span></li>`;
        const here = round ? round.markers.map((m, p) => (sameSpot(m, spot) ? seatIcon(p, 14) : "")).join("") : "";
        return `<li><b>${MISSION_NAMES[mission]}</b> ${here}<br><span class="muted">${MISSION_RULES[mission]}</span></li>`;
      })
      .join("");
    return `<section class="missions"><h3>Missões <span class="muted">(${view.deck} no baralho)</span></h3><ul>${items}</ul></section>`;
  }

  private controls(marks: Marks): string {
    const view = this.view;
    const pending = view.pending;
    if (!pending) return `<h2>${esc(winnersText(view, this.names))}</h2><button type="button" class="primary" data-do="leave">Nova partida</button>`;
    const head = `<h2>${esc(prompt(view, this.names))}</h2>`;
    if (this.paused) return `${head}<p class="muted">Veja o resultado da rodada.</p>`;
    if (view.bots[pending.player] !== null) return `${head}<p class="muted thinking">O bot está pensando</p>`;
    const p = pending.player;
    const d = pending.decision;
    const round = view.current!;
    const reserveButton = (r: number, enabled: boolean) => {
      const kind = view.reserves[p]![r]!;
      const key = `reserve:${p}:${r}`;
      return `<button type="button" class="die${marks.selected.has(key) ? " on" : ""}" data-pick="${key}" ${enabled ? "" : "disabled"} title="${KIND_NAMES[kind]}" aria-pressed="${marks.selected.has(key)}">${dieIcon(kind, null, 34)}</button>`;
    };
    const disabled = this.busy ? "disabled" : "";
    switch (d.kind) {
      case "select": {
        const dice = view.reserves[p]!.map((_, r) => reserveButton(r, true)).join("");
        return `${head}<p class="muted">Os outros dados ficam de fora nesta rodada. Escolhidos: ${this.picked.size} de ${d.count}.</p><div class="dice pick">${dice}</div><div class="actions"><button type="button" class="primary" data-do="select" ${this.picked.size === d.count ? disabled : "disabled"}>Rolar</button></div>`;
      }
      case "cash": {
        const dice = d.options.map((r) => reserveButton(r, true)).join("");
        return `${head}<p class="muted">Cada dado da reserva fora da mão que você tira do jogo vale 1 de dinheiro. Ouro na mão: ${round.gold[p]}. O dinheiro dá a ordem da rodada.</p>${this.handLine(p)}<div class="dice pick">${dice}</div><div class="actions"><button type="button" class="primary" data-do="cash" ${this.picked.size > 0 ? disabled : "disabled"}>Tirar ${this.picked.size} do jogo</button><button type="button" data-do="no-cash" ${disabled}>Não trocar</button></div>`;
      }
      case "buy": {
        const dice = d.options
          .map((i) => {
            const kind = view.showcase[i]!;
            const key = `showcase:${i}`;
            return `<button type="button" class="die${marks.selected.has(key) ? " on" : ""}" data-pick="${key}" title="${KIND_NAMES[kind]}" aria-pressed="${marks.selected.has(key)}">${dieIcon(kind, null, 34)}<small>${KIND_NAMES[kind]}</small></button>`;
          })
          .join("");
        const chosen = [...this.picked][0];
        return `${head}<p class="muted">Dinheiro: ${round.money[p]}. O dado comprado é rolado e entra na mão; quem compra tira os seus ouros da missão.</p>${this.handLine(p)}<div class="dice pick">${dice}</div><div class="actions"><button type="button" class="primary" data-do="buy" ${chosen !== undefined ? disabled : "disabled"}>${chosen !== undefined ? `Comprar ${KIND_NAMES[view.showcase[chosen]!]}` : "Comprar"}</button><button type="button" data-do="no-buy" ${disabled}>Não comprar</button></div>`;
      }
      case "place": {
        const buttons = d.spots
          .map((spot) => {
            const mission = spotMission(view, spot)!;
            const result = round.results[p]![spotColumn(spot)]!;
            const others = round.markers.map((m, q) => (q !== p && sameSpot(m, spot) ? seatIcon(q, 14) : "")).join("");
            return `<button type="button" class="spot" data-do="place" data-spot="${keyOf(spot)}" ${disabled}><b>${MISSION_NAMES[mission]}</b> <span>você faz ${result}</span> ${others}</button>`;
          })
          .join("");
        return `${head}${this.handLine(p)}<div class="spots">${buttons}</div>`;
      }
      case "act":
        return head + this.actControls(p, d, round, disabled);
    }
  }

  /** The hand of `p` as icons, with what it makes on each mission. */
  private handLine(p: number): string {
    const hand = this.view.current?.hands[p] ?? [];
    return `<div class="dice hand">${hand.map((die) => `<span class="${die.counts ? "" : "faded"}" title="${KIND_NAMES[die.kind]}">${dieIcon(die.kind, die.face, 28)}</span>`).join("")}</div>`;
  }

  private actControls(p: number, d: ActOptions, round: NonNullable<View["current"]>, disabled: string): string {
    const view = this.view;
    const hand = round.hands[p]!;
    const can = clickable(this.mode, d);
    const mode = this.mode;
    const dice = hand
      .map((die, i) => {
        const key = `hand:${p}:${i}`;
        const on = (mode.kind === "zero" || mode.kind === "modify") && mode.die === i || (mode.kind === "modify" && mode.target === i) || (mode.kind === "sacrifice" && (mode.out === i || mode.rerolls.includes(i)));
        const label = `${KIND_NAMES[die.kind]} ${faceText(die.kind, die.face)}${die.removed ? " (sacrificado)" : die.used ? " (usado)" : !die.counts ? " (não conta)" : ""}`;
        const tag = mode.kind === "sacrifice" && mode.out === i ? "sai" : mode.kind === "sacrifice" && mode.rerolls.includes(i) ? "rola" : "";
        return `<button type="button" class="die${on ? " on" : ""}${die.counts ? "" : " faded"}" data-pick="${key}" ${can.has(i) && !this.busy ? "" : "disabled"} title="${esc(label)}" aria-label="${esc(label)}" aria-pressed="${on}">${dieIcon(die.kind, die.face, 38)}${tag ? `<small>${tag}</small>` : ""}</button>`;
      })
      .join("");
    const marker = round.markers[p];
    const mission = marker ? spotMission(view, marker) : null;
    const result = marker ? round.results[p]![spotColumn(marker)] : 0;
    const status = `<p class="muted">Na ${mission ? MISSION_NAMES[mission] : "?"} você faz <b>${result}</b>; como está, ganha <b>${round.score[p]}</b>.</p>`;
    let hint = "";
    let buttons = "";
    switch (mode.kind) {
      case "idle":
        hint = d.zeros.length + d.modifiers.length > 0 ? "Toque num 0 ou num modificador para usá-lo, ou escolha uma ação." : "Escolha uma ação.";
        buttons = [
          d.sacrifice.length > 0 ? `<button type="button" data-do="sacrifice" ${disabled}>Sacrificar…</button>` : "",
          ...d.sabotage.map((card) => `<button type="button" data-do="sabotage" data-card="${card}" ${disabled}>Sabotar ${MISSION_NAMES[round.table[card]!]} (−${view.sabotageCost})</button>`),
          `<button type="button" class="primary" data-do="pass" ${disabled}>Passar</button>`,
        ].join("");
        break;
      case "zero":
        hint = "Toque no dado que o 0 rola de novo.";
        buttons = `<button type="button" data-do="cancel">Cancelar</button>`;
        break;
      case "modify": {
        const step = hand[mode.die]!.face;
        if (mode.target === null) hint = `Toque no dado que o modificador ±${step} move.`;
        else {
          const face = hand[mode.target]!.face;
          hint = `Mover o ${KIND_NAMES[hand[mode.target]!.kind]} ${face} para cima ou para baixo.`;
          buttons = `<button type="button" class="primary" data-do="up" ${disabled}>+${step} (fica ${moved(face, step)})</button><button type="button" class="primary" data-do="down" ${disabled}>−${step} (fica ${moved(face, -step)})</button>`;
        }
        buttons += `<button type="button" data-do="cancel">Cancelar</button>`;
        break;
      }
      case "sacrifice":
        hint = mode.out === null ? "Toque no dado que sai da mão." : "Toque nos dados que rolam de novo, todos de uma vez.";
        buttons = `<button type="button" class="primary" data-do="confirm-sacrifice" ${mode.out === null ? "disabled" : disabled}>Sacrificar${mode.rerolls.length ? ` e rolar ${mode.rerolls.length}` : ""}</button><button type="button" data-do="cancel">Cancelar</button>`;
        break;
    }
    return `${status}<div class="dice pick">${dice}</div><p class="hint">${hint}</p><div class="actions">${buttons}</div>`;
  }
}
