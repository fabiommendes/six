import "./styles/fonts.css";
import "./styles/app.css";
import { SeksGame } from "./engine/game";
import { loadWasm } from "./engine/wasm";
import { FIXTURES } from "./logic/fixtures";
import { clearSession, loadSession, saveSession, type Session, type SessionStore } from "./logic/session";
import { loadTiltedPreference, saveTiltedPreference } from "./logic/view-preference";
import { GameScreen, spawnBot } from "./ui/game";
import { need } from "./ui/dom";
import { DEFAULT_CHOICE, modeFromChoice, showStart, type StartChoice } from "./ui/start";
import { diceDefs } from "./ui/svg";

const host = need(document, "#app");
document.body.insertAdjacentHTML("afterbegin", diceDefs());
const defs = document.body.firstElementChild;

/**
 * In development a match survives a reload of the page and a hot reload of
 * the code: it is kept in the session storage. The production build has no
 * storage (`import.meta.env.DEV` is false there and the code is dropped).
 */
function devStore(): SessionStore | null {
  if (!import.meta.env.DEV) return null;
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}
const store = devStore();
const keep = store ? (session: Session) => saveSession(store, session) : undefined;

/**
 * The view (from above or tilted) the player chose lasts across matches and
 * visits, in every build: it is kept in the local storage.
 */
function viewStore(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
const views = viewStore();
const preferredTilt = () => (views ? (loadTiltedPreference(views) ?? false) : false);
const keepTilt = (tilted: boolean) => {
  if (views) saveTiltedPreference(views, tilted);
};

let choice: StartChoice = DEFAULT_CHOICE;
let leaveStart: (() => void) | null = null;
let screen: GameScreen | null = null;

function toStart(): void {
  screen?.dispose();
  screen = null;
  if (store) clearSession(store);
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
    tilted: preferredTilt(),
    onTilt: keepTilt,
    onSession: keep,
    onNewGame: toStart,
  });
  await screen.start();
}

/** Opens the match that was saved before the reload. */
async function resume(session: Session): Promise<void> {
  screen = new GameScreen(host, {
    mode: session.mode,
    game: SeksGame.fromStateJson(session.base),
    seed: session.seed,
    resume: session.commands,
    // The saved match keeps its own view while it lasts; the next one starts with the preference.
    tilted: session.tilted,
    onTilt: keepTilt,
    viewpoint: session.viewpoint,
    bot: session.mode.kind === "bot" ? spawnBot() : null,
    onSession: keep,
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
    tilted: preferredTilt(),
    onTilt: keepTilt,
    bot: null,
    onNewGame: toStart,
  });
  await screen.start();
  return true;
}

async function main(): Promise<void> {
  host.textContent = "Abrindo o jogo…";
  try {
    await loadWasm();
  } catch {
    host.textContent = "Não foi possível iniciar o motor do jogo.";
    return;
  }
  const fixture = new URLSearchParams(location.search).get("fixture");
  if (fixture && (await openFixture(fixture))) return;
  const saved = store ? loadSession(store) : null;
  if (saved) {
    await resume(saved);
    return;
  }
  toStart();
}

void main();

// A change of the code runs this module again: the old screen goes away and the new one resumes the saved match.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    screen?.dispose();
    leaveStart?.();
    defs?.remove();
  });
  import.meta.hot.accept();
}
