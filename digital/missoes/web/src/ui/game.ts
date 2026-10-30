import type { Action, Answer, MissionsGame, Spot, Step, View } from "../engine/game";
import { clickable, clickCard, clickDie, confirmed, IDLE, modify, moved, type ActMode, type ActOptions, type Turn } from "../logic/act";
import {
  faceText,
  KIND_NAMES,
  MISSION_NAMES,
  MISSION_RULES,
  orderLine,
  points,
  prompt,
  roundLine,
  plural,
  sameSpot,
  spotColumn,
  spotMission,
  stepLine,
  TITLE,
  winnersText,
} from "../logic/texts";
import { Table3D, type Chip, type Marks, type PickKey } from "../table/table3d";
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

/**
 * The game screen: the table in 3D, where a person makes every choice, a
 * dock under it with the prompt and the buttons that have nothing to tap on
 * the table (confirm, cancel, pass), and a side panel with the scores, the
 * missions and the history.
 */
export class GameScreen {
  private view: View;
  /** The view of the table while the result of a round is shown: the round as it ended. */
  private ended: View | null = null;
  private readonly table: Table3D;
  private readonly side: HTMLElement;
  private readonly dock: HTMLElement;
  private readonly overlay: HTMLElement;
  private history: string[] = [];
  /** Dice picked for a select or a cash answer, or the die picked to buy. */
  private picked = new Set<number>();
  private mode: ActMode = IDLE;
  /** The engine's check of the answer a confirmation would play, by its JSON. */
  private verdict: { readonly json: string; readonly problem: string | null } | null = null;
  private checking: string | null = null;
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
    host.innerHTML = `<div class="game"><div class="play"><div class="stage"></div><section class="dock" aria-live="polite"></section></div><aside class="side"></aside><div class="overlay" hidden></div></div>`;
    this.side = need(host, ".side");
    this.dock = need(host, ".dock");
    this.overlay = need(host, ".overlay");
    this.table = new Table3D(need(host, ".stage"), {
      onPick: (key) => this.pick(key),
      reducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    this.side.addEventListener("click", (event) => this.buttonClick(event));
    this.dock.addEventListener("click", (event) => this.buttonClick(event));
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

  /** Resets the picks for a new decision, with the obvious picks made. */
  private prepare(): void {
    this.picked = new Set();
    this.mode = IDLE;
    this.verdict = null;
    this.checking = null;
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
          .filter((d) => !d.removed && !d.used)
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

  /** The turn of the person acting now, as the table shows it. */
  private turn(): Turn | null {
    const pending = this.view.pending;
    if (pending?.decision.kind !== "act") return null;
    const hand = this.view.current?.hands[pending.player] ?? [];
    const mat = hand.flatMap((die, i) => (die.removed || die.used ? [] : [i]));
    return { options: pending.decision, mat };
  }

  private pick(key: PickKey): void {
    if (this.busy || this.paused || !this.personToMove()) return;
    if (!this.marks().selectable.has(key)) return;
    const pending = this.view.pending!;
    const decision = pending.decision;
    const [what, a, b] = key.split(":");
    const index = Number(what === "hand" || what === "reserve" ? b : a);
    if (what === "chip") {
      const action = modify(this.mode, a === "up");
      if (action) void this.act(action);
      return;
    }
    if (what === "reserve" && decision.kind === "select") {
      this.toggle(index, decision.count);
    } else if (what === "reserve" && decision.kind === "cash") {
      this.toggle(index, Infinity);
    } else if (what === "showcase" && decision.kind === "buy") {
      this.picked = this.picked.has(index) ? new Set() : new Set([index]);
    } else if (what === "card" && decision.kind === "place") {
      const spot = decision.spots.find((s) => spotColumn(s) === index);
      if (spot) void this.answer({ kind: "place", spot });
      return;
    } else if (what === "card" && decision.kind === "act") {
      this.mode = clickCard(this.mode, this.turn()!, index).mode;
    } else if (what === "hand" && decision.kind === "act") {
      const click = clickDie(this.mode, this.turn()!, index);
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

  /** The answer the confirm button plays, once the picks make one. */
  private draft(): Answer | null {
    const decision = this.view.pending?.decision;
    const picked = [...this.picked].sort((x, y) => x - y);
    switch (decision?.kind) {
      case "select":
        return picked.length === decision.count ? { kind: "select", dice: picked } : null;
      case "cash":
        return { kind: "cash", dice: picked };
      case "buy":
        return picked.length === 1 ? { kind: "buy", die: picked[0]! } : null;
      case "act": {
        const action = confirmed(this.mode);
        return action ? { kind: "act", action } : null;
      }
      default:
        return null;
    }
  }

  /** Whether the engine accepted the draft: the confirm button waits for it. */
  private draftReady(): boolean {
    const draft = this.draft();
    return !!draft && !this.busy && this.verdict?.json === JSON.stringify(draft) && this.verdict.problem === null;
  }

  /** Asks the engine to check the draft, once per draft. */
  private verify(): void {
    const draft = this.draft();
    if (!draft || this.busy || !this.personToMove()) return;
    const json = JSON.stringify(draft);
    if (this.verdict?.json === json || this.checking === json) return;
    this.checking = json;
    this.game.check(draft).then(
      (problem) => {
        if (this.checking !== json) return;
        this.checking = null;
        this.verdict = { json, problem };
        this.render();
      },
      (error: unknown) => {
        this.checking = null;
        this.error = error instanceof Error ? error.message : String(error);
        this.render();
      },
    );
  }

  private buttonClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-do]");
    if (!target || (target as HTMLButtonElement).disabled) return;
    switch (target.dataset.do) {
      case "confirm": {
        const draft = this.draft();
        if (draft && this.draftReady()) {
          this.mode = IDLE;
          void this.answer(draft);
        }
        break;
      }
      case "no-buy":
        void this.answer({ kind: "buy", die: null });
        break;
      case "cancel":
        this.mode = IDLE;
        this.render();
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
    const round = this.view.current!;
    const results = () => [round.standard ? ("standard" as const) : null, ...round.table].map((m, column) => (m ? `faz ${round.results[p]![column]}` : null));
    switch (d.kind) {
      case "select":
        this.view.reserves[p]!.forEach((_, r) => {
          if (this.picked.has(r) || this.picked.size < d.count) selectable.add(`reserve:${p}:${r}`);
        });
        return { selectable, selected, picks: { seat: p, dice: this.picked } };
      case "cash":
        d.options.forEach((r) => selectable.add(`reserve:${p}:${r}`));
        this.picked.forEach((r) => selected.add(`reserve:${p}:${r}`));
        return { selectable, selected };
      case "buy":
        d.options.forEach((i) => selectable.add(`showcase:${i}`));
        this.picked.forEach((i) => selected.add(`showcase:${i}`));
        return { selectable, selected };
      case "place":
        d.spots.forEach((s) => selectable.add(keyOf(s)));
        return { selectable, selected, results: results() };
      case "act": {
        const can = clickable(this.mode, this.turn()!);
        can.dice.forEach((i) => selectable.add(`hand:${p}:${i}`));
        can.cards.forEach((column) => selectable.add(`card:${column}`));
        const mode = this.mode;
        const chips: Chip[] = [];
        if (mode.kind === "zero" || mode.kind === "modify") selected.add(`hand:${p}:${mode.die}`);
        if (mode.kind === "modify" && mode.target !== null) {
          const hand = round.hands[p]!;
          const target = `hand:${p}:${mode.target}`;
          const step = hand[mode.die]!.face;
          const face = hand[mode.target]!.face;
          selected.add(target);
          chips.push({ key: "chip:down", text: `−${step} → ${moved(face, -step)}`, near: target, offset: -1 });
          chips.push({ key: "chip:up", text: `+${step} → ${moved(face, step)}`, near: target, offset: 1 });
          chips.forEach((c) => selectable.add(c.key));
        }
        if (mode.kind === "sacrifice") {
          selected.add(`hand:${p}:${mode.out}`);
          mode.rerolls.forEach((i) => selected.add(`hand:${p}:${i}`));
        }
        if (mode.kind === "sabotage") selected.add(keyOf(mode.spot));
        const aside = mode.kind === "sacrifice" ? { seat: p, die: mode.out } : undefined;
        return { selectable, selected, results: results(), chips, aside };
      }
    }
  }

  private render(): void {
    if (this.disposed) return;
    const marks = this.marks();
    this.table.show(this.ended ?? this.view, this.names, marks);
    const view = this.view;
    const roundNumber = view.pending ? view.round + 1 : view.round;
    this.dock.innerHTML = this.controls();
    const seat = view.pending?.player;
    if (seat === undefined) this.dock.style.removeProperty("--seat");
    else this.dock.style.setProperty("--seat", seatColor(seat));
    this.side.innerHTML = `
      <header class="bar"><div class="brand">${brandMark(22)}<span>${TITLE}</span></div><span class="round">Rodada ${roundNumber} · meta ${view.goal}</span><button type="button" class="ghost" data-do="leave">Sair</button></header>
      ${this.scoreboard()}
      ${this.missions()}
      <section class="showcase"><h3>Vitrine <span class="muted">(${view.market} no mercado)</span></h3><div class="dice">${view.showcase.map((k) => `<span class="kind">${dieIcon(k, null, 22)}<small>${KIND_NAMES[k]}</small></span>`).join("") || "<span class='muted'>vazia</span>"}</div></section>
      <section class="history"><h3>Histórico</h3><ol>${this.history.slice(-60).reverse().map((l) => `<li>${esc(l)}</li>`).join("")}</ol></section>`;
    this.verify();
  }

  /** The points of each player as `X+Y`: the points so far and what the round would give if it ended now. */
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
        const score = round ? `${pts}+${round.score[p]}` : `${pts}`;
        return `<li class="${toMove ? "to-move" : ""}" style="--seat:${seatColor(p)}">${seatIcon(p, 18)}<span class="name">${esc(this.names[p]!)}${view.bots[p] ? ` <span class="muted">(bot)</span>` : ""}</span><span class="pts" title="pontos + o que a rodada daria se terminasse agora">${score}</span><span class="meta">${order}${money}<span title="dados na reserva">${view.reserves[p]!.length} dados</span>${bought}${mission ? `<span>${MISSION_NAMES[mission]}</span>` : ""}${passed}</span></li>`;
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
        const mission = round ? spotMission(view, spot) : spot.kind === "standard" ? "standard" : table[spot.card]!;
        if (!mission) {
          const gone = spot.kind === "standard" ? "standard" : view.table[spot.card]!;
          return `<li class="gone"><s>${MISSION_NAMES[gone]}</s> <span class="muted">sabotada, volta na próxima rodada</span></li>`;
        }
        const here = round ? round.markers.map((m, p) => (sameSpot(m, spot) ? seatIcon(p, 14) : "")).join("") : "";
        const rule = MISSION_RULES[mission];
        return `<li><b>${MISSION_NAMES[mission]}</b> ${here}<dl><dt>Objetivo</dt><dd>${rule.goal}</dd><dt>Pontuação</dt><dd>${rule.score}</dd></dl></li>`;
      })
      .join("");
    return `<section class="missions"><h3>Missões <span class="muted">(${view.deck} no baralho)</span></h3><ul>${items}</ul></section>`;
  }

  /** The dock: who decides, what to tap on the table, and the buttons with nothing to tap. */
  private controls(): string {
    const view = this.view;
    const pending = view.pending;
    const dock = (title: string, hint: string, buttons = "", seat: number | null = null) =>
      `<div class="prompt"><div class="title">${seat !== null ? seatIcon(seat, 20) : ""}<span>${esc(title)}</span></div><p>${hint}</p>${this.error ? `<p class="warn">${esc(this.error)}</p>` : ""}</div><div class="actions">${buttons}</div>`;
    if (!pending) return dock(winnersText(view, this.names), "A partida acabou.", `<button type="button" class="primary" data-do="leave">Nova partida</button>`);
    const p = pending.player;
    const title = prompt(view, this.names);
    if (this.paused) return dock(title, "Veja o resultado da rodada.", "", p);
    if (view.bots[p] !== null) return dock(`${this.names[p]} está jogando`, `<span class="thinking">O bot está pensando</span>`, "", p);
    const d = pending.decision;
    const round = view.current!;
    const ready = this.draftReady() ? "" : "disabled";
    const off = this.busy ? "disabled" : "";
    switch (d.kind) {
      case "select":
        return dock(
          title,
          `Toque nos dados da reserva para levá-los à mão: ${this.picked.size} de ${d.count}. Os outros ficam de fora nesta rodada; toque num dado da mão para devolvê-lo.`,
          `<button type="button" class="primary" data-do="confirm" ${ready}>Rolar</button>`,
          p,
        );
      case "cash": {
        const n = this.picked.size;
        return dock(
          title,
          `Toque nos dados da reserva que saem do jogo: 1 de dinheiro cada. Ouro na mão: ${round.gold[p]}. O dinheiro dá a ordem da rodada.`,
          `<button type="button" class="primary" data-do="confirm" ${ready}>${n > 0 ? `Tirar ${plural(n, "dado", "dados")} do jogo` : "Não trocar"}</button>`,
          p,
        );
      }
      case "buy": {
        const chosen = [...this.picked][0];
        return dock(
          title,
          `Dinheiro: ${round.money[p]}. Toque num dado da vitrine. Ele é rolado e entra na mão; quem compra tira os seus ouros da missão.`,
          `<button type="button" class="primary" data-do="confirm" ${ready}>${chosen !== undefined ? `Comprar ${KIND_NAMES[view.showcase[chosen]!]}` : "Comprar"}</button><button type="button" data-do="no-buy" ${off}>Não comprar</button>`,
          p,
        );
      }
      case "place":
        return dock(title, "Toque numa missão da mesa. Cada uma mostra quanto você faz nela.", "", p);
      case "act":
        return this.actControls(title, p, d, round, dock);
    }
  }

  private actControls(title: string, p: number, d: ActOptions, round: NonNullable<View["current"]>, dock: (title: string, hint: string, buttons?: string, seat?: number | null) => string): string {
    const view = this.view;
    const hand = round.hands[p]!;
    const mode = this.mode;
    const marker = round.markers[p];
    const mission = marker ? spotMission(view, marker) : null;
    const result = marker ? round.results[p]![spotColumn(marker)] : 0;
    const status = `Na ${mission ? MISSION_NAMES[mission] : "?"} você faz <b>${result}</b>; se a rodada acabasse agora, ganharia <b>${round.score[p]}</b>. `;
    const ready = this.draftReady() ? "" : "disabled";
    const off = this.busy ? "disabled" : "";
    const cancel = `<button type="button" data-do="cancel" ${off}>Cancelar</button>`;
    const dieName = (i: number) => `${KIND_NAMES[hand[i]!.kind]} ${faceText(hand[i]!.kind, hand[i]!.face)}`;
    switch (mode.kind) {
      case "idle": {
        const parts = ["Toque num dado da mão para sacrificá-lo"];
        if (d.zeros.length + d.modifiers.length > 0) parts.push("num 0 ou num modificador para usá-lo");
        if (d.sabotage.length > 0) parts.push(`numa missão para sabotá-la (${points(view.sabotageCost)})`);
        const used = hand.some((die, i) => die.used && !die.removed && d.sacrifice.includes(i));
        const tail = used ? " Um 0 ou modificador já usado, na reserva, ainda pode ser sacrificado." : "";
        const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ou ${parts.at(-1)}` : parts[0];
        return dock(title, `${status}${list}.${tail}`, `<button type="button" class="primary" data-do="pass" ${off}>Passar</button>`, p);
      }
      case "zero":
        return dock(title, `Toque no dado que o 0 rola de novo, ou de novo no 0 para sacrificá-lo.`, cancel, p);
      case "modify": {
        const step = hand[mode.die]!.face;
        if (mode.target === null) return dock(title, `Toque no dado que o modificador ±${step} move, ou de novo no modificador para sacrificá-lo.`, cancel, p);
        return dock(title, `Toque em +${step} ou −${step} sobre o ${dieName(mode.target)}, ou em outro dado.`, cancel, p);
      }
      case "sacrifice": {
        const n = mode.rerolls.length;
        return dock(
          title,
          `O ${dieName(mode.out)} sai da mão e vai para a reserva. Toque nos dados da mão que rolam de novo com ele, todos de uma vez.`,
          `<button type="button" class="primary" data-do="confirm" ${ready}>${n > 0 ? `Sacrificar e rolar ${plural(n, "dado", "dados")}` : "Sacrificar sem rolar"}</button>${cancel}`,
          p,
        );
      }
      case "sabotage": {
        const mission = spotMission(view, mode.spot);
        const who = round.markers.flatMap((m, q) => (q !== p && sameSpot(m, mode.spot) ? [this.names[q]!] : []));
        const moves = who.length > 0 ? ` ${who.join(" e ")} ${who.length > 1 ? "escolhem" : "escolhe"} outra missão.` : "";
        return dock(
          title,
          `Sabotar ${mission ? MISSION_NAMES[mission] : "a missão"} por ${points(view.sabotageCost)}? Ela sai da mesa nesta rodada e volta na próxima.${moves}`,
          `<button type="button" class="primary" data-do="confirm" ${ready}>Sabotar</button>${cancel}`,
          p,
        );
      }
    }
  }
}
