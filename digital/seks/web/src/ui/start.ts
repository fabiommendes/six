import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../bot/levels";
import type { BotLevelId } from "../bot/protocol";
import type { Side } from "../engine/game";
import type { Mode } from "../logic/match";
import type { MailGame } from "../logic/mail-games";
import { APP, BUTTONS, MAIL, mailGameStatus, START } from "../logic/texts";
import { esc, need } from "./dom";
import { brandMark, dieIcon, motifStrip } from "./svg";

/** What the player chose on the start screen. */
export interface StartChoice {
  readonly mode: "hotseat" | "bot" | "mail" | "live";
  readonly side: Side;
  readonly level: BotLevelId;
}

export const DEFAULT_CHOICE: StartChoice = { mode: "hotseat", side: "white", level: DEFAULT_BOT_LEVEL.id };

/** The mode of a match from the choices of the start screen. */
export function modeFromChoice(choice: StartChoice): Mode {
  if (choice.mode === "hotseat") return { kind: "hotseat" };
  const level = BOT_LEVELS.find((candidate) => candidate.id === choice.level) ?? DEFAULT_BOT_LEVEL;
  return { kind: "bot", human: choice.side, level };
}

/** What the start screen shows besides the choices: the games by correspondence kept here and a notice. */
export interface StartExtras {
  readonly games: readonly MailGame[];
  /** A warning to show at the top (a link that did not open), or `null`. */
  readonly notice: string | null;
  readonly onOpenGame: (id: string) => void;
  readonly onRemoveGame: (id: string) => void;
}

function modeOf(value: FormDataEntryValue | null): StartChoice["mode"] {
  return value === "bot" || value === "mail" || value === "live" ? value : "hotseat";
}

function gameItem(game: MailGame): string {
  const over = game.over || game.leftBy !== null;
  return `<li class="mail-game" data-id="${esc(game.id)}">
    <span>${dieIcon(6, game.player, 22)}</span>
    <div class="mail-game-text"><span class="t">${esc(MAIL.you(game.player))}</span><span class="d">${esc(mailGameStatus(game))}</span></div>
    <button type="button" data-open>${MAIL.open}</button>${over ? `<button type="button" data-remove>${MAIL.remove}</button>` : ""}
  </li>`;
}

function radio(name: string, value: string, label: string, note: string, checked: boolean, icon = ""): string {
  return `<label class="choice"><input type="radio" name="${name}" value="${value}"${checked ? " checked" : ""}>
    <span class="choice-body">${icon ? `<span class="choice-icon">${icon}</span>` : ""}<span class="choice-text"><span class="t">${label}</span>${note ? `<span class="d">${note}</span>` : ""}</span></span></label>`;
}

/**
 * The start screen: hotseat, against the bot, live or by correspondence, with
 * the colour of the human and the level of the bot (R1). Calls `onPlay` with the choices.
 */
export function showStart(host: HTMLElement, initial: StartChoice, onPlay: (choice: StartChoice) => void, extras: StartExtras): () => void {
  host.className = "";
  host.innerHTML = `
    <main class="start">
      <div class="start-card">
        <div class="brand"><span class="mark"></span>${APP.brand}</div>
        <h1>${APP.title}</h1>
        <div class="band"></div>
        ${extras.notice === null ? "" : `<p class="notice" role="alert">${esc(extras.notice)}</p>`}
        <form class="start-form">
          <fieldset>
            <legend>${START.modeLegend}</legend>
            ${radio("mode", "hotseat", START.hotseat, START.hotseatNote, initial.mode === "hotseat")}
            ${radio("mode", "bot", START.bot, START.botNote, initial.mode === "bot")}
            ${radio("mode", "live", START.live, START.liveNote, initial.mode === "live")}
            ${radio("mode", "mail", START.mail, START.mailNote, initial.mode === "mail")}
          </fieldset>
          <div class="side-options"${initial.mode === "hotseat" ? " hidden" : ""}>
            <fieldset>
              <legend>${START.sideLegend}</legend>
              ${radio("side", "white", START.sideWhite, START.sideWhiteNote, initial.side === "white", dieIcon(6, "white", 22))}
              ${radio("side", "black", START.sideBlack, START.sideBlackNote, initial.side === "black", dieIcon(6, "black", 22))}
            </fieldset>
          </div>
          <div class="bot-options"${initial.mode === "bot" ? "" : " hidden"}>
            <fieldset>
              <legend>${START.levelLegend}</legend>
              <div class="levels">${BOT_LEVELS.map((level) => radio("level", level.id, level.label, "", initial.level === level.id)).join("")}</div>
            </fieldset>
          </div>
          <button type="submit" class="primary">${BUTTONS.play}</button>
        </form>
        ${
          extras.games.length === 0
            ? ""
            : `<section class="mail-list"><h2>${MAIL.listHeading}</h2><ul>${extras.games.map(gameItem).join("")}</ul></section>`
        }
        <div class="foot"></div>
      </div>
    </main>`;
  need(host, ".mark").innerHTML = brandMark(26);
  const form = need<HTMLFormElement>(host, ".start-form");
  const botOptions = need(host, ".bot-options");
  const sideOptions = need(host, ".side-options");

  const read = (): StartChoice => {
    const data = new FormData(form);
    return {
      mode: modeOf(data.get("mode")),
      side: data.get("side") === "black" ? "black" : "white",
      level: (BOT_LEVELS.find((level) => level.id === data.get("level")) ?? DEFAULT_BOT_LEVEL).id,
    };
  };
  const onChange = () => {
    const mode = read().mode;
    botOptions.hidden = mode !== "bot";
    sideOptions.hidden = mode === "hotseat";
  };
  const onList = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-open], button[data-remove]");
    const id = button?.closest<HTMLElement>("[data-id]")?.dataset.id;
    if (!button || !id) return;
    if (button.hasAttribute("data-open")) extras.onOpenGame(id);
    else extras.onRemoveGame(id);
  };
  host.addEventListener("click", onList);
  const onSubmit = (event: Event) => {
    event.preventDefault();
    onPlay(read());
  };
  form.addEventListener("change", onChange);
  form.addEventListener("submit", onSubmit);

  const strips = () => {
    const width = Math.floor(need(host, ".start-card").getBoundingClientRect().width - 2 * 28) || 400;
    need(host, ".band").innerHTML = motifStrip("thin", width, 3);
    need(host, ".foot").innerHTML = motifStrip("band", width, 3.6);
  };
  strips();
  const observer = new ResizeObserver(strips);
  observer.observe(need(host, ".start-card"));
  return () => {
    observer.disconnect();
    host.removeEventListener("click", onList);
    form.removeEventListener("change", onChange);
    form.removeEventListener("submit", onSubmit);
  };
}
