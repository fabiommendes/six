import { BOT_LEVELS, isBotLevelId } from "../bot/levels";
import type { SeatBot } from "../logic/save";
import { ACTIONS, DEFAULT_NAMES, botName } from "../logic/texts";
import { esc } from "./dom";
import { brandMark, dieIcon, seatColor, STONE_FACE } from "./svg";

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

const KEY = "sia.nomes";
const BOTS_KEY = "sia.bots";

/** The ways to play: who sits at each seat. */
const MODES = [
  { id: "hotseat", label: "Dois jogadores", detail: "no mesmo aparelho", bots: [null, null] },
  { id: "versus", label: "Contra o bot", detail: "uma pessoa e um bot", bots: [null, "medium"] },
  { id: "bots", label: "Bot contra bot", detail: "só assistir", bots: ["medium", "hard"] },
] as const satisfies readonly { id: string; label: string; detail: string; bots: readonly SeatBot[] }[];

function lastBots(): SeatBot[] {
  try {
    const bots = JSON.parse(localStorage.getItem(BOTS_KEY) ?? "[]") as unknown;
    if (Array.isArray(bots) && bots.length === 2) return bots.map((b) => (isBotLevelId(b) ? b : null));
  } catch {
    // No storage: the default mode.
  }
  return [null, "medium"];
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

/** The mode that matches who sits at the seats, or null for a mix the buttons do not name. */
function modeOf(bots: readonly SeatBot[]): string | null {
  const people = bots.filter((b) => b === null).length;
  return people === 2 ? "hotseat" : people === 1 ? "versus" : "bots";
}

/** The start screen: how to play, the names and who is a bot, or the saved game. */
export function showStart(host: HTMLElement, options: StartOptions): void {
  const remembered = lastNames();
  const bots = lastBots();
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
        const options = [`<option value="">Pessoa</option>`]
          .concat(BOT_LEVELS.map((l) => `<option value="${l.id}"${bots[i] === l.id ? " selected" : ""}>Bot ${l.label.toLowerCase()}</option>`))
          .join("");
        return `<div class="name-row" style="--seat:${seatColor(i)}"><i class="seat-dot"></i><input name="p${i}" maxlength="20" placeholder="${esc(fallbackName(i))}" value="${esc(typedName(i))}" autocomplete="off" aria-label="Nome do jogador ${i + 1}" /><select name="b${i}" aria-label="Quem joga no lugar ${i + 1}">${options}</select></div>`;
      })
      .join("");
    const resume = options.saved
      ? `<button type="button" class="resume" data-resume>${ACTIONS.resume}<span>${esc(options.saved.join(" e "))}</span></button>`
      : "";
    const dice = [0, 1, 2, 3, STONE_FACE].map((suit) => dieIcon(suit === STONE_FACE ? 6 : suit + 2, 26, suit)).join("");
    host.innerHTML = `<div class="start-wrap"><div class="start">
      <div class="brand">${brandMark(26)}<span>SIX</span></div>
      <h1>Sia</h1>
      <p class="sub">Duelo de dados para dois. Monte formações de pôquer ao lado de nove marcos e tome cinco deles, ou três vizinhos.</p>
      <div class="dice-row">${dice}</div>
      ${resume}
      <form class="new-game">
        <fieldset><legend>Como jogar</legend><div class="modes">${modes}</div></fieldset>
        <fieldset><legend>Jogadores</legend>${inputs}</fieldset>
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
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>("select[name^=b]");
    if (!select) return;
    keepTyped();
    const value = select.value;
    bots[Number(select.name.slice(1))] = isBotLevelId(value) ? value : null;
    render();
  };
  host.onclick = (event) => {
    const target = event.target as HTMLElement;
    const modeButton = target.closest<HTMLElement>("[data-mode]");
    if (modeButton) {
      keepTyped();
      const mode = MODES.find((m) => m.id === modeButton.dataset.mode)!;
      mode.bots.forEach((b, i) => {
        // Keep the level the player had chosen for a seat that stays a bot.
        bots[i] = b === null ? null : isBotLevelId(bots[i]) ? bots[i]! : b;
      });
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
    rememberNames(names, seats);
    host.onclick = null;
    host.onchange = null;
    host.onsubmit = null;
    options.onStart({ names, bots: seats });
  };
}
