import { BOT_LEVELS, isBotLevelId } from "../bot/levels";
import type { Rules } from "../engine/game";
import type { SeatBot } from "../logic/save";
import { ACTIONS, DEFAULT_NAMES, SIDES, botName, rulesSummary } from "../logic/texts";
import { esc } from "./dom";
import { brandMark, dieIcon, seatColor } from "./svg";

export interface StartChoice {
  readonly names: string[];
  /** Who plays each seat: a person (null) or a bot. */
  readonly bots: SeatBot[];
  readonly rules: Rules;
}

export interface StartOptions {
  /** The rules of the proposal, the defaults of the form. */
  readonly defaults: Rules;
  /** Names of the saved game, when there is one to continue. */
  readonly saved: readonly string[] | null;
  readonly onStart: (choice: StartChoice) => void;
  readonly onResume: () => void;
}

const KEY = "conexao.nomes";
const BOTS_KEY = "conexao.bots";
const RULES_KEY = "conexao.regras";

/** The ways to play: who sits at each seat. */
const MODES = [
  { id: "hotseat", label: "Dois jogadores", detail: "no mesmo aparelho", bots: [null, null] },
  { id: "versus", label: "Contra o bot", detail: "você joga com as Brancas", bots: [null, "lookahead"] },
  { id: "bots", label: "Bot contra bot", detail: "só assistir", bots: ["greedy", "lookahead"] },
] as const satisfies readonly { id: string; label: string; detail: string; bots: readonly SeatBot[] }[];

/** The rule switches of the form: each a pair of buttons, the first the value of the proposal. */
const SWITCHES = [
  { key: "size", legend: "Tabuleiro", options: [{ value: 11, label: "11x11" }, { value: 9, label: "9x9" }] },
  { key: "goal", legend: "Meta", options: [{ value: "line", label: "Linha", detail: "de fundo a fundo" }, { value: "reach", label: "Chegar", detail: "à fileira de fundo" }] },
  { key: "capture", legend: "Captura", options: [{ value: false, label: "Sem captura" }, { value: true, label: "Com captura", detail: "o 4º vizinho tira um 4" }] },
  { key: "extra", legend: "Reserva", options: [{ value: [0, 0, 0, 0, 0, 0, 0], label: "Dados iguais" }, { value: [0, 0, 0, 1, 1, 1, 1], label: "Variada", detail: "um 6, um 5, um 4 e um 3" }] },
  { key: "blockFromBoard", legend: "Bloqueante", options: [{ value: true, label: "Reserva ou tabuleiro" }, { value: false, label: "Só da reserva" }] },
] as const satisfies readonly { key: keyof Rules; legend: string; options: readonly { value: Rules[keyof Rules]; label: string; detail?: string }[] }[];

/** The numbers of dice per player offered. */
const DICE = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function read<T>(key: string, check: (value: unknown) => value is T): T | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as unknown;
    return check(value) ? value : null;
  } catch {
    // No storage: the defaults.
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do.
  }
}

const isNames = (v: unknown): v is string[] => Array.isArray(v) && v.every((n) => typeof n === "string");
const isBots = (v: unknown): v is SeatBot[] => Array.isArray(v) && v.length === 2 && v.every((b) => b === null || isBotLevelId(b));
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Whether two rule values are equal; the values are numbers, booleans, strings or arrays of numbers. */
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The rules remembered from the last game, over the defaults; anything odd keeps the default. */
function lastRules(defaults: Rules): Rules {
  const saved = read(RULES_KEY, isObject) ?? {};
  const rules: Rules = { ...defaults };
  for (const s of SWITCHES) {
    const found = s.options.find((o) => sameValue(o.value, saved[s.key]));
    if (found) Object.assign(rules, { [s.key]: found.value });
  }
  if (typeof saved.dice === "number" && DICE.includes(saved.dice)) rules.dice = saved.dice;
  return rules;
}

/** The mode that matches who sits at the seats. */
function modeOf(bots: readonly SeatBot[]): string {
  const people = bots.filter((b) => b === null).length;
  return people === 2 ? "hotseat" : people === 1 ? "versus" : "bots";
}

/** The start screen: how to play, the names and who is a bot, the rules, or the saved game. */
export function showStart(host: HTMLElement, options: StartOptions): void {
  const remembered = read(KEY, isNames) ?? [];
  const bots: SeatBot[] = read(BOTS_KEY, isBots) ?? [null, "lookahead"];
  const rules = lastRules(options.defaults);
  const fallbackName = (i: number) => (bots[i] ? botName(i) : DEFAULT_NAMES[i]!);
  /** The name typed for seat `i`, or "" when it is a default name. */
  const typedName = (i: number) => {
    const typed = remembered[i]?.trim() ?? "";
    return typed === DEFAULT_NAMES[i] || typed === botName(i) ? "" : typed;
  };
  const render = () => {
    const mode = modeOf(bots);
    const modes = MODES.map(
      (m) => `<button type="button" data-mode="${m.id}" aria-pressed="${m.id === mode}"><b>${m.label}</b><span>${m.detail}</span></button>`,
    ).join("");
    const inputs = [0, 1]
      .map((i) => {
        const choices = [`<option value="">Pessoa</option>`]
          .concat(BOT_LEVELS.map((l) => `<option value="${l.id}"${bots[i] === l.id ? " selected" : ""}>Bot ${l.label.toLowerCase()}</option>`))
          .join("");
        return `<div class="name-row" style="--seat:${seatColor(i)}">${dieIcon(1, 22, i)}<input name="p${i}" maxlength="20" placeholder="${esc(fallbackName(i))}" value="${esc(typedName(i))}" autocomplete="off" aria-label="Nome de quem joga com as ${SIDES[i]}" /><select name="b${i}" aria-label="Quem joga com as ${SIDES[i]}">${choices}</select></div>`;
      })
      .join("");
    const levels = BOT_LEVELS.map((l) => `<li><b>${esc(l.label)}</b> ${esc(l.detail)}</li>`).join("");
    const switches = SWITCHES.map((s) => {
      const buttons = s.options
        .map((o) => {
          const detail = "detail" in o ? `<span>${esc(o.detail)}</span>` : "";
          return `<button type="button" data-rule="${s.key}" data-value="${JSON.stringify(o.value).replace(/"/g, "&quot;")}" aria-pressed="${sameValue(rules[s.key], o.value)}"><b>${esc(o.label)}</b>${detail}</button>`;
        })
        .join("");
      return `<div class="rule-row"><span class="rule-name">${s.legend}</span><div class="pair" role="group" aria-label="${s.legend}">${buttons}</div></div>`;
    }).join("");
    const dice = DICE.map((n) => `<option value="${n}"${rules.dice === n ? " selected" : ""}>${n}</option>`).join("");
    const resume = options.saved
      ? `<button type="button" class="resume" data-resume>${ACTIONS.resume}<span>${esc(options.saved.join(" e "))}</span></button>`
      : "";
    const row = [1, 2, 3, 4, 5, 6].map((value) => dieIcon(value, 26, value % 2)).join("");
    host.innerHTML = `<div class="start-wrap"><div class="start">
      <div class="brand">${brandMark(26)}<span>SIX</span></div>
      <h1>Conexão</h1>
      <p class="kicker">Protótipo sem nome</p>
      <p class="sub">Dois jogadores, o tabuleiro e os dados do Seks. O valor de cada dado é o máximo de vizinhos que ele aceita: ligue a sua fileira de fundo à do adversário e bloqueie a linha dele.</p>
      <div class="dice-row">${row}</div>
      ${resume}
      <form class="new-game">
        <fieldset><legend>Como jogar</legend><div class="modes">${modes}</div></fieldset>
        <fieldset><legend>Jogadores</legend>${inputs}<ul class="levels">${levels}</ul></fieldset>
        <fieldset><legend>Regras</legend>${switches}
          <div class="rule-row"><span class="rule-name">Dados</span><label class="dice-count"><select name="dice" aria-label="Dados de cada jogador">${dice}</select> de cada cor, 1 no tabuleiro</label></div>
          <p class="summary">${esc(rulesSummary(rules))}</p>
        </fieldset>
        <button type="submit" class="primary">${ACTIONS.start}</button>
      </form>
    </div></div>`;
  };
  render();
  const keepTyped = () => {
    host.querySelectorAll<HTMLInputElement>("input[name^=p]").forEach((input, i) => {
      remembered[i] = input.value.trim();
    });
  };
  host.onchange = (event) => {
    const target = event.target as HTMLElement;
    const select = target.closest<HTMLSelectElement>("select[name^=b]");
    const dice = target.closest<HTMLSelectElement>("select[name=dice]");
    if (!select && !dice) return;
    keepTyped();
    if (select) bots[Number(select.name.slice(1))] = isBotLevelId(select.value) ? select.value : null;
    if (dice) rules.dice = Number(dice.value);
    render();
  };
  host.onclick = (event) => {
    const target = event.target as HTMLElement;
    const modeButton = target.closest<HTMLElement>("[data-mode]");
    if (modeButton) {
      keepTyped();
      const mode = MODES.find((m) => m.id === modeButton.dataset.mode)!;
      mode.bots.forEach((b, i) => {
        // Keep the bot the player had chosen for a seat that stays a bot.
        bots[i] = b === null ? null : isBotLevelId(bots[i]) ? bots[i]! : b;
      });
      render();
      return;
    }
    const ruleButton = target.closest<HTMLElement>("[data-rule]");
    if (ruleButton) {
      keepTyped();
      Object.assign(rules, { [ruleButton.dataset.rule!]: JSON.parse(ruleButton.dataset.value!) as unknown });
      render();
      return;
    }
    if (target.closest("[data-resume]")) {
      host.onclick = null;
      host.onchange = null;
      options.onResume();
    }
  };
  host.onsubmit = (event) => {
    event.preventDefault();
    keepTyped();
    const seats: SeatBot[] = [bots[0] ?? null, bots[1] ?? null];
    const names = seats.map((_, i) => typedName(i) || fallbackName(i));
    write(KEY, names);
    write(BOTS_KEY, seats);
    write(RULES_KEY, rules);
    host.onclick = null;
    host.onchange = null;
    host.onsubmit = null;
    options.onStart({ names, bots: seats, rules: { ...rules } });
  };
}
