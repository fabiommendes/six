import "./styles/fonts.css";
import "./styles/app.css";
import { SeksGame } from "./engine/game";
import { loadWasm } from "./engine/wasm";
import { FIXTURES } from "./logic/fixtures";
import { GameScreen, spawnBot } from "./ui/game";
import { need } from "./ui/dom";
import { DEFAULT_CHOICE, modeFromChoice, showStart, type StartChoice } from "./ui/start";
import { diceDefs } from "./ui/svg";

const host = need(document, "#app");
document.body.insertAdjacentHTML("afterbegin", diceDefs());

let choice: StartChoice = DEFAULT_CHOICE;
let leaveStart: (() => void) | null = null;
let screen: GameScreen | null = null;

function toStart(): void {
  screen?.dispose();
  screen = null;
  leaveStart?.();
  leaveStart = showStart(host, choice, (picked) => {
    choice = picked;
    leaveStart?.();
    leaveStart = null;
    void play(picked);
  });
}

async function play(picked: StartChoice): Promise<void> {
  const mode = modeFromChoice(picked);
  screen = new GameScreen(host, {
    mode,
    game: SeksGame.create(),
    bot: mode.kind === "bot" ? spawnBot() : null,
    onNewGame: toStart,
  });
  await screen.start();
}

/** `?fixture=NAME` opens a ready-made position (see logic/fixtures.ts). */
async function openFixture(name: string): Promise<boolean> {
  const make = FIXTURES[name];
  if (!make) return false;
  const fixture = make();
  screen = new GameScreen(host, {
    mode: fixture.mode,
    game: fixture.game,
    seed: { last: fixture.last, captured: fixture.captured },
    select: fixture.select,
    counterFrom: fixture.counterFrom ?? undefined,
    bot: null,
    onNewGame: toStart,
  });
  await screen.start();
  return true;
}

async function main(): Promise<void> {
  host.textContent = "Carregando…";
  try {
    await loadWasm();
  } catch {
    host.textContent = "Não foi possível iniciar o motor do jogo.";
    return;
  }
  const fixture = new URLSearchParams(location.search).get("fixture");
  if (fixture && (await openFixture(fixture))) return;
  toStart();
}

void main();
