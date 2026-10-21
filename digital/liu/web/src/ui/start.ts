import { BOT_LEVELS, isBotLevelId } from "../bot/levels";
import type { SeatBot } from "../logic/save";
import { ACTIONS, DEFAULT_NAMES, botName } from "../logic/texts";
import { esc } from "./dom";
import { brandMark, dieIcon, latticeBand, sealColor } from "./svg";

export interface StartChoice {
  readonly names: string[];
  /** Who plays each seat: a person (null) or a bot level. */
  readonly bots: SeatBot[];
}

export interface StartOptions {
  /** Names of the saved game, when there is one to continue. */
  readonly saved: readonly string[] | null;
  readonly onStart: (choice: StartChoice) => void;
  readonly onResume: () => void;
}

const KEY = "liu.nomes";
const BOTS_KEY = "liu.bots";

function lastBots(): SeatBot[] {
  try {
    const bots = JSON.parse(localStorage.getItem(BOTS_KEY) ?? "[]") as unknown;
    if (Array.isArray(bots)) return bots.map((b) => (isBotLevelId(b) ? b : null));
  } catch {
    // No storage: people only.
  }
  return [];
}

function lastNames(): string[] {
  try {
    const names = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    if (Array.isArray(names) && names.every((n) => typeof n === "string")) return names as string[];
  } catch {
    // No storage: the default names.
  }
  return [];
}

function rememberNames(names: readonly string[], bots: readonly SeatBot[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(names));
    localStorage.setItem(BOTS_KEY, JSON.stringify(bots));
  } catch {
    // Nothing to do.
  }
}

/** The start screen: how many players, their names and who is a bot, or the saved game. */
export function showStart(host: HTMLElement, options: StartOptions): void {
  const remembered = lastNames();
  const bots = lastBots();
  let count = Math.min(4, Math.max(2, remembered.length || 2));
  const fallbackName = (i: number) => (bots[i] ? botName(i) : DEFAULT_NAMES[i]!);
  /** The name typed for seat `i`, or "" when it is a default name. */
  const typedName = (i: number) => {
    const typed = remembered[i]?.trim() ?? "";
    return typed === DEFAULT_NAMES[i] || typed === botName(i) ? "" : typed;
  };
  const render = () => {
    const inputs = DEFAULT_NAMES.slice(0, count)
      .map((_, i) => {
        const fallback = fallbackName(i);
        const value = typedName(i);
        const options = [`<option value="">Pessoa</option>`]
          .concat(BOT_LEVELS.map((l) => `<option value="${l.id}"${bots[i] === l.id ? " selected" : ""}>Bot ${l.label.toLowerCase()}</option>`))
          .join("");
        return `<div class="name-row">${dieIcon(0, 26, sealColor(i))}<input name="p${i}" maxlength="20" placeholder="${esc(fallback)}" value="${esc(value)}" autocomplete="off" aria-label="Nome do jogador ${i + 1}" /><select name="b${i}" aria-label="Quem joga no lugar ${i + 1}">${options}</select></div>`;
      })
      .join("");
    const counts = [2, 3, 4]
      .map((n) => `<button type="button" data-count="${n}" aria-pressed="${n === count}">${n}</button>`)
      .join("");
    const resume = options.saved
      ? `<button type="button" class="resume" data-resume>${ACTIONS.resume}<span>${esc(options.saved.join(", "))}</span></button>`
      : "";
    host.innerHTML = `<div class="start">
      <div class="brand">${brandMark(26)}<span>SIX</span></div>
      <h1>Liu</h1>
      <p class="sub">Dados no estilo do sudoku, de 2 a 4 jogadores, no mesmo aparelho e contra bots.</p>
      <div class="band">${latticeBand(320)}</div>
      ${resume}
      <form class="new-game">
        <fieldset><legend>Quantos jogam</legend><div class="counts">${counts}</div></fieldset>
        <fieldset><legend>Jogadores, em sentido horário</legend>${inputs}</fieldset>
        <button type="submit" class="primary">${ACTIONS.start}</button>
      </form>
      <p class="rules"><a href="../liu.html">Regras do Liu</a></p>
    </div>`;
  };
  render();
  host.onchange = (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>("select[name^=b]");
    if (!select) return;
    keepTyped();
    const value = select.value;
    bots[Number(select.name.slice(1))] = isBotLevelId(value) ? value : null;
    render();
  };
  host.onclick = (event) => {
    const target = event.target as HTMLElement;
    const countButton = target.closest<HTMLElement>("[data-count]");
    if (countButton) {
      keepTyped();
      count = Number(countButton.dataset.count);
      render();
      return;
    }
    if (target.closest("[data-resume]")) {
      host.onclick = null;
      host.onchange = null;
      options.onResume();
    }
  };
  const keepTyped = () => {
    host.querySelectorAll<HTMLInputElement>("input[name^=p]").forEach((input, i) => {
      remembered[i] = input.value.trim();
    });
  };
  host.onsubmit = (event) => {
    event.preventDefault();
    keepTyped();
    const seats = Array.from({ length: count }, (_, i) => bots[i] ?? null);
    const names = seats.map((_, i) => typedName(i) || fallbackName(i));
    rememberNames(names, seats);
    host.onclick = null;
    host.onchange = null;
    host.onsubmit = null;
    options.onStart({ names, bots: seats });
  };
}
