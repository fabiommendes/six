import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../bot/levels";
import type { BotLevelId } from "../bot/protocol";
import type { Side } from "../engine/game";
import type { Mode } from "../logic/match";
import { APP, BUTTONS, START } from "../logic/texts";
import { need } from "./dom";
import { brandMark, dieIcon, motifStrip } from "./svg";

/** What the player chose on the start screen. */
export interface StartChoice {
  readonly mode: "hotseat" | "bot";
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

function radio(name: string, value: string, label: string, note: string, checked: boolean, icon = ""): string {
  return `<label class="choice"><input type="radio" name="${name}" value="${value}"${checked ? " checked" : ""}>
    <span class="choice-body">${icon ? `<span class="choice-icon">${icon}</span>` : ""}<span class="choice-text"><span class="t">${label}</span>${note ? `<span class="d">${note}</span>` : ""}</span></span></label>`;
}

/**
 * The start screen: hotseat or against the bot, with the colour of the human
 * and the level of the bot (R1). Calls `onPlay` with the choices.
 */
export function showStart(host: HTMLElement, initial: StartChoice, onPlay: (choice: StartChoice) => void): () => void {
  host.className = "";
  host.innerHTML = `
    <main class="start">
      <div class="start-card">
        <div class="brand"><span class="mark"></span>${APP.brand}<span class="of">${APP.ofSix}</span></div>
        <h1>${APP.title}</h1>
        <div class="band"></div>
        <form class="start-form">
          <fieldset>
            <legend>${START.modeLegend}</legend>
            ${radio("mode", "hotseat", START.hotseat, START.hotseatNote, initial.mode === "hotseat")}
            ${radio("mode", "bot", START.bot, START.botNote, initial.mode === "bot")}
          </fieldset>
          <div class="bot-options"${initial.mode === "bot" ? "" : " hidden"}>
            <fieldset>
              <legend>${START.sideLegend}</legend>
              ${radio("side", "white", START.sideWhite, START.sideWhiteNote, initial.side === "white", dieIcon(6, "white", 22))}
              ${radio("side", "black", START.sideBlack, START.sideBlackNote, initial.side === "black", dieIcon(6, "black", 22))}
            </fieldset>
            <fieldset>
              <legend>${START.levelLegend}</legend>
              <div class="levels">${BOT_LEVELS.map((level) => radio("level", level.id, level.label, "", initial.level === level.id)).join("")}</div>
            </fieldset>
            <p class="provisional">${START.provisionalBot}</p>
          </div>
          <button type="submit" class="primary">${BUTTONS.play}</button>
        </form>
        <div class="foot"></div>
        <p class="foot-cap">${APP.caption.replace("seks", "<i>seks</i>")}</p>
      </div>
    </main>`;
  need(host, ".mark").innerHTML = brandMark(26);
  const form = need<HTMLFormElement>(host, ".start-form");
  const botOptions = need(host, ".bot-options");

  const read = (): StartChoice => {
    const data = new FormData(form);
    return {
      mode: data.get("mode") === "bot" ? "bot" : "hotseat",
      side: data.get("side") === "black" ? "black" : "white",
      level: (BOT_LEVELS.find((level) => level.id === data.get("level")) ?? DEFAULT_BOT_LEVEL).id,
    };
  };
  const onChange = () => {
    botOptions.hidden = read().mode !== "bot";
  };
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
    form.removeEventListener("change", onChange);
    form.removeEventListener("submit", onSubmit);
  };
}
