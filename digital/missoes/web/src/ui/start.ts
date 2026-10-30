import { BOT_LEVELS, botName, DEFAULT_NAMES, GOALS, isBotId, type BotId } from "../logic/seats";
import { TITLE } from "../logic/texts";
import { esc } from "./dom";
import { brandMark, dieIcon, seatColor, seatIcon } from "./svg";

export interface StartChoice {
  readonly names: string[];
  /** Who plays each seat: a person (null) or a bot. */
  readonly bots: (BotId | null)[];
  readonly goal: number;
}

const KEY = "missoes.inicio";

interface Remembered {
  names: string[];
  bots: (BotId | null)[];
  count: number;
  goal: number;
}

function recall(): Remembered {
  const fallback: Remembered = { names: [], bots: [null, "greedy"], count: 2, goal: 30 };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Remembered> | null;
    if (!saved) return fallback;
    return {
      names: Array.isArray(saved.names) ? saved.names.filter((n): n is string => typeof n === "string") : [],
      bots: Array.isArray(saved.bots) ? saved.bots.map((b) => (isBotId(b) ? b : null)) : fallback.bots,
      count: saved.count === 3 || saved.count === 4 ? saved.count : 2,
      goal: GOALS.includes(saved.goal as 30) ? saved.goal! : 30,
    };
  } catch {
    return fallback;
  }
}

function remember(state: Remembered): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // No storage: nothing to remember.
  }
}

/** The start screen: how many play, their names, who is a bot, and the goal. */
export function showStart(host: HTMLElement, onStart: (choice: StartChoice) => void): void {
  const state = recall();
  const fallbackName = (i: number) => (state.bots[i] ? botName(i) : DEFAULT_NAMES[i]!);
  const render = () => {
    const rows = DEFAULT_NAMES.slice(0, state.count)
      .map((_, i) => {
        const options = [`<option value="">Pessoa</option>`]
          .concat(BOT_LEVELS.map((l) => `<option value="${l.id}"${state.bots[i] === l.id ? " selected" : ""}>${l.label}</option>`))
          .join("");
        return `<div class="name-row" style="--seat:${seatColor(i)}">${seatIcon(i, 26)}<input name="p${i}" maxlength="20" placeholder="${esc(fallbackName(i))}" value="${esc(state.names[i] ?? "")}" autocomplete="off" aria-label="Nome do jogador ${i + 1}" /><select name="b${i}" aria-label="Quem joga no lugar ${i + 1}">${options}</select></div>`;
      })
      .join("");
    const counts = [2, 3, 4].map((n) => `<button type="button" data-count="${n}" aria-pressed="${n === state.count}">${n}</button>`).join("");
    const goals = GOALS.map((g) => `<button type="button" data-goal="${g}" aria-pressed="${g === state.goal}">${g} pontos</button>`).join("");
    const dice = (["common", "gold", "one", "low", "high", "even", "odd", "binary", "modifier"] as const).map((k, i) => dieIcon(k, [5, 4, 1, 2, 6, 4, 3, 1, 2][i]!, 30)).join("");
    host.innerHTML = `<div class="start-wrap"><div class="start">
      <div class="brand">${brandMark(26)}<span>SIX</span></div>
      <h1>${TITLE}</h1>
      <p class="sub">Escolha seis dados, compre dados novos, dispute as missões da mesa e role de novo até a mão servir. Protótipo: as regras ainda são uma proposta. De 2 a 4 jogadores, no mesmo aparelho e contra bots.</p>
      <div class="dice-row">${dice}</div>
      <form class="new-game">
        <fieldset><legend>Quantos jogam</legend><div class="counts">${counts}</div></fieldset>
        <fieldset><legend>Jogadores, na ordem dos lugares</legend>${rows}</fieldset>
        <fieldset><legend>Meta</legend><div class="counts">${goals}</div></fieldset>
        <button type="submit" class="primary">Começar</button>
      </form>
    </div></div>`;
  };
  const keepTyped = () => {
    host.querySelectorAll<HTMLInputElement>("input[name^=p]").forEach((input, i) => {
      state.names[i] = input.value.trim();
    });
  };
  render();
  host.onchange = (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>("select[name^=b]");
    if (!select) return;
    keepTyped();
    state.bots[Number(select.name.slice(1))] = isBotId(select.value) ? select.value : null;
    render();
  };
  host.onclick = (event) => {
    const target = event.target as HTMLElement;
    const count = target.closest<HTMLElement>("[data-count]");
    const goal = target.closest<HTMLElement>("[data-goal]");
    if (!count && !goal) return;
    keepTyped();
    if (count) state.count = Number(count.dataset.count);
    if (goal) state.goal = Number(goal.dataset.goal);
    render();
  };
  host.onsubmit = (event) => {
    event.preventDefault();
    keepTyped();
    const bots = Array.from({ length: state.count }, (_, i) => state.bots[i] ?? null);
    const names = bots.map((_, i) => state.names[i] || fallbackName(i));
    remember(state);
    host.onclick = null;
    host.onchange = null;
    host.onsubmit = null;
    onStart({ names, bots, goal: state.goal });
  };
}
