import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../bot/levels";
import type { BotLevelId } from "../bot/protocol";
import type { Side } from "../engine/game";
import type { Mode } from "../logic/match";
import type { MailGame } from "../logic/mail-games";
import { APP, BUTTONS, MAIL, mailGameStatus, START } from "../logic/texts";
import { esc, need } from "./dom";
import { brandMark, dieIcon, motifStrip, startFigure } from "./svg";

/**
 * The published site puts the game in `seks/` under the rulebook site (`just site`),
 * so the rules chapter and the landing page of the collection are one level up.
 */
export const RULES_URL = "../seks.html";
const COLLECTION_URL = "../";

/** What the player chose on the start screen. */
export interface StartChoice {
  readonly mode: "hotseat" | "bot" | "mail" | "live";
  readonly side: Side;
  readonly level: BotLevelId;
}

/** Who arrives from the site is most often alone: the bot comes first. */
export const DEFAULT_CHOICE: StartChoice = { mode: "bot", side: "white", level: DEFAULT_BOT_LEVEL.id };

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
    <div class="mail-game-text"><span class="t">${esc(MAIL.you(game.player))}</span><span class="d">${esc(mailGameStatus(game))} · ${esc(MAIL.when(game.commands.length, game.updated))}</span></div>
    <button type="button" data-open>${MAIL.open}</button>${over ? `<button type="button" data-remove>${MAIL.remove}</button>` : ""}
  </li>`;
}

/** The games kept here, above the choices: who comes back most often wants to go on. */
function savedGames(games: readonly MailGame[]): string {
  if (games.length === 0) return "";
  return `<section class="mail-list"><h2>${MAIL.listHeading}</h2><ul>${games.map(gameItem).join("")}</ul></section>`;
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
  // The links go under the rule on wide screens and under the choices on narrow ones (see `app.css`).
  const links = `<nav class="start-links"><a href="${RULES_URL}" target="_blank" rel="noopener">${START.rules}</a><a href="${COLLECTION_URL}">${START.collection}</a></nav>`;
  host.innerHTML = `
    <main class="start">
      <div class="start-card">
        <div class="start-intro">
          <div class="brand"><span class="mark"></span>${APP.brand}</div>
          <h1>${APP.title}</h1>
          <p class="pitch">${START.pitch}</p>
          <figure class="start-show">${startFigure()}<figcaption id="start-figure-caption">${START.figure}</figcaption></figure>
          <div class="band"></div>
          ${links}
        </div>
        <div class="start-play">
        ${extras.notice === null ? "" : `<p class="notice" role="alert">${esc(extras.notice)}</p>`}
        ${savedGames(extras.games)}
        <form class="start-form">
          <fieldset>
            <legend>${START.modeLegend}</legend>
            ${radio("mode", "bot", START.bot, START.botNote, initial.mode === "bot")}
            ${radio("mode", "hotseat", START.hotseat, START.hotseatNote, initial.mode === "hotseat")}
            ${radio("mode", "live", START.live, START.liveNote, initial.mode === "live")}
            ${radio("mode", "mail", START.mail, START.mailNote, initial.mode === "mail")}
          </fieldset>
          <fieldset class="side-options"${initial.mode === "hotseat" ? " disabled" : ""}>
            <legend>${START.sideLegend}</legend>
            <div class="sides-choice">${radio("side", "white", START.sideWhite, START.sideWhiteNote, initial.side === "white", dieIcon(6, "white", 22))}
            ${radio("side", "black", START.sideBlack, START.sideBlackNote, initial.side === "black", dieIcon(6, "black", 22))}</div>
          </fieldset>
          <fieldset class="bot-options"${initial.mode === "bot" ? "" : " disabled"}>
            <legend>${START.levelLegend}</legend>
            <div class="levels">${BOT_LEVELS.map((level) => radio("level", level.id, level.label, "", initial.level === level.id)).join("")}</div>
          </fieldset>
          <button type="submit" class="primary">${BUTTONS.play}</button>
        </form>
        ${links}
        </div>
        <div class="foot"></div>
      </div>
    </main>`;
  need(host, ".mark").innerHTML = brandMark(26);
  const form = need<HTMLFormElement>(host, ".start-form");
  const botOptions = need<HTMLFieldSetElement>(host, ".bot-options");
  const sideOptions = need<HTMLFieldSetElement>(host, ".side-options");

  const read = (): StartChoice => {
    const data = new FormData(form);
    return {
      mode: modeOf(data.get("mode")),
      side: data.get("side") === "black" ? "black" : "white",
      level: (BOT_LEVELS.find((level) => level.id === data.get("level")) ?? DEFAULT_BOT_LEVEL).id,
    };
  };
  // The options that do not apply are switched off, not hidden: the card keeps its height, so nothing moves under the pointer.
  const onChange = () => {
    const mode = read().mode;
    botOptions.disabled = mode !== "bot";
    sideOptions.disabled = mode === "hotseat";
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
    const width = (selector: string) => Math.floor(need(host, selector).getBoundingClientRect().width) || 400;
    need(host, ".band").innerHTML = motifStrip("thin", width(".start-intro"), 3);
    need(host, ".foot").innerHTML = motifStrip("band", width(".foot"), 3.6);
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
