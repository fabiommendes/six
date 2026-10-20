import { ACTIONS, DEFAULT_NAMES } from "../logic/texts";
import { esc } from "./dom";
import { brandMark, dieIcon, latticeBand, sealColor } from "./svg";

export interface StartChoice {
  readonly names: string[];
}

export interface StartOptions {
  /** Names of the saved game, when there is one to continue. */
  readonly saved: readonly string[] | null;
  readonly onStart: (choice: StartChoice) => void;
  readonly onResume: () => void;
}

const KEY = "liu.nomes";

function lastNames(): string[] {
  try {
    const names = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    if (Array.isArray(names) && names.every((n) => typeof n === "string")) return names as string[];
  } catch {
    // No storage: the default names.
  }
  return [];
}

function rememberNames(names: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(names));
  } catch {
    // Nothing to do.
  }
}

/** The start screen: how many players and their names, or the saved game. */
export function showStart(host: HTMLElement, options: StartOptions): void {
  const remembered = lastNames();
  let count = Math.min(4, Math.max(2, remembered.length || 2));
  const render = () => {
    const inputs = DEFAULT_NAMES.slice(0, count)
      .map((fallback, i) => {
        const value = remembered[i] && remembered[i] !== fallback ? remembered[i]! : "";
        return `<label class="name-row">${dieIcon(0, 26, sealColor(i))}<input name="p${i}" maxlength="20" placeholder="${esc(fallback)}" value="${esc(value)}" autocomplete="off" /></label>`;
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
      <p class="sub">Dados no estilo do sudoku, de 2 a 4 jogadores, no mesmo aparelho.</p>
      <div class="band">${latticeBand(320)}</div>
      ${resume}
      <form class="new-game">
        <fieldset><legend>Jogadores</legend><div class="counts">${counts}</div></fieldset>
        <fieldset><legend>Nomes, em sentido horário</legend>${inputs}</fieldset>
        <button type="submit" class="primary">${ACTIONS.start}</button>
      </form>
      <p class="rules"><a href="../liu.html">Regras do Liu</a></p>
    </div>`;
  };
  render();
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
      options.onResume();
    }
  };
  const keepTyped = () => {
    host.querySelectorAll<HTMLInputElement>("input[name^=p]").forEach((input, i) => {
      remembered[i] = input.value.trim() || DEFAULT_NAMES[i]!;
    });
  };
  host.onsubmit = (event) => {
    event.preventDefault();
    keepTyped();
    const names = DEFAULT_NAMES.slice(0, count).map((fallback, i) => remembered[i]?.trim() || fallback);
    rememberNames(names);
    host.onclick = null;
    host.onsubmit = null;
    options.onStart({ names });
  };
}
