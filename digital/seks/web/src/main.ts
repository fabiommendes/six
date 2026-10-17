import "./styles/fonts.css";
import "./styles/app.css";
import { SeksGame, type Command } from "./engine/game";
import { loadWasm } from "./engine/wasm";
import { FIXTURES } from "./logic/fixtures";
import { clearSession, loadSession, saveSession, type Session, type SessionStore } from "./logic/session";
import { decodeLink, encodeLink, LinkError } from "./logic/link";
import {
  findMailGame,
  gameRoute,
  isResigned,
  loadMailGames,
  markResigned,
  memoryStore,
  newMailGame,
  openLink,
  parseRoute,
  removeMailGame,
  saveMailGame,
  type MailGame,
  type MailStore,
  type Route,
} from "./logic/mail-games";
import { gameFromStart, outlook, seksRuleset, sideToken } from "./logic/seks-link";
import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "./bot/levels";
import type { BotLevelId } from "./bot/protocol";
import { linkErrorText, MAIL } from "./logic/texts";
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

/** The games by correspondence live in the local storage, or in memory if the browser blocks it. */
function mailStore(): MailStore {
  try {
    return localStorage;
  } catch {
    return memoryStore();
  }
}
const mails = mailStore();

let choice: StartChoice = DEFAULT_CHOICE;
let leaveStart: (() => void) | null = null;
let screen: GameScreen | null = null;

/** Takes down whatever is on the page. */
function clear(): void {
  screen?.dispose();
  screen = null;
  leaveStart?.();
  leaveStart = null;
}

/** The address of the page without a fragment, to build links from and to clean the bar. */
const pageUrl = () => `${location.origin}${location.pathname}`;

function setFragment(fragment: string): void {
  history.replaceState(null, "", `${location.pathname}${location.search}${fragment}`);
}

function toStart(notice: string | null = null): void {
  clear();
  if (store) clearSession(store);
  setFragment("");
  leaveStart = showStart(
    host,
    choice,
    (picked) => {
      choice = picked;
      clear();
      void play(picked);
    },
    {
      games: loadMailGames(mails),
      notice,
      onOpenGame: (id) => openSaved(id),
      onRemoveGame: (id) => {
        removeMailGame(mails, id);
        toStart();
      },
    },
  );
}

const newGame = () => toStart();

async function play(picked: StartChoice): Promise<void> {
  if (picked.mode === "mail") {
    const game = newMailGame(picked.side);
    saveMailGame(mails, game);
    await openMail(game, null);
    return;
  }
  const mode = modeFromChoice(picked);
  screen = new GameScreen(host, {
    mode,
    game: SeksGame.create(),
    bot: mode.kind === "bot" ? spawnBot() : null,
    tilted: preferredTilt(),
    onTilt: keepTilt,
    onSession: keep,
    spawnBot,
    onNewGame: newGame,
  });
  await screen.start();
}

/** Opens a game by correspondence, with a notice to show if there is one. */
async function openMail(game: MailGame, notice: string | null): Promise<void> {
  setFragment(gameRoute(game.id));
  let latest = game;
  const linkFor = (commands: readonly Command[], left: boolean) =>
    `${pageUrl()}#${encodeLink({ id: game.id, start: game.start, commands, left: left ? sideToken(game.player) : null }, seksRuleset)}`;
  screen = new GameScreen(host, {
    mode: { kind: "correspondence", human: game.player, id: game.id },
    game: gameFromStart(game.start),
    resume: game.commands as Command[],
    tilted: preferredTilt(),
    onTilt: keepTilt,
    bot: null,
    notice: notice ?? undefined,
    mail: {
      linkFor,
      shared: game.shared,
      // A game the player resigned stays in the list, marked, until the link that tells it is sent.
      resigned: isResigned(game),
      leftBy: isResigned(game) ? null : game.leftBy,
      onChange: (change) => {
        const same =
          change.shared === latest.shared && change.toMove === latest.toMove && change.over === latest.over && change.commands.length === latest.commands.length;
        if (same) return;
        latest = { ...latest, ...change, updated: Date.now() };
        saveMailGame(mails, latest);
      },
      onResign: () => {
        latest = markResigned(latest);
        saveMailGame(mails, latest);
      },
      onResignSent: () => removeMailGame(mails, game.id),
      onContinue: (level) => void continueAgainstBot(latest, level),
      onEnd: () => {
        removeMailGame(mails, game.id);
        toStart();
      },
    },
    onNewGame: newGame,
  });
  await screen.start();
}

/** The opponent left: the game goes on against the bot, from this position and with the same side. */
async function continueAgainstBot(game: MailGame, levelId: BotLevelId): Promise<void> {
  const level = BOT_LEVELS.find((candidate) => candidate.id === levelId) ?? DEFAULT_BOT_LEVEL;
  removeMailGame(mails, game.id);
  clear();
  setFragment("");
  screen = new GameScreen(host, {
    mode: { kind: "bot", human: game.player, level },
    game: gameFromStart(game.start),
    resume: game.commands as Command[],
    tilted: preferredTilt(),
    onTilt: keepTilt,
    bot: spawnBot(),
    onSession: keep,
    spawnBot,
    onNewGame: newGame,
  });
  await screen.start();
}

/** Opens a saved game from the list, or says it is gone. */
function openSaved(id: string): void {
  const game = findMailGame(mails, id);
  clear();
  if (game === null) toStart(MAIL.missing);
  else void openMail(game, null);
}

/** Opens what the fragment of the page asks for; `false` if it asks for nothing. */
function openRoute(route: Route): boolean {
  if (route.kind === "none") return false;
  clear();
  if (route.kind === "game") {
    openSaved(route.id);
    return true;
  }
  let link;
  let ending;
  try {
    link = decodeLink(route.fragment, seksRuleset);
    ending = outlook(link.start, link.commands);
  } catch (error) {
    toStart(error instanceof LinkError ? linkErrorText(error) : linkErrorText(new LinkError("format", "")));
    return true;
  }
  const opening = openLink(link, findMailGame(mails, link.id), ending);
  if (opening.kind === "refused") {
    toStart(opening.reason === "other-game" ? MAIL.otherGame : opening.reason === "diverged" ? MAIL.diverged : linkErrorText(new LinkError("format", "")));
    return true;
  }
  saveMailGame(mails, opening.game);
  void openMail(opening.game, opening.stale ? MAIL.stale : null);
  return true;
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
    spawnBot,
    onNewGame: newGame,
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
    bot: fixture.mode.kind === "bot" ? spawnBot() : null,
    spawnBot,
    onNewGame: newGame,
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
  if (openRoute(parseRoute(location.hash))) return;
  const saved = store ? loadSession(store) : null;
  if (saved) {
    await resume(saved);
    return;
  }
  toStart();
}

void main();

// A link pasted into a tab that is already open only changes the fragment.
const onHashChange = () => {
  if (!openRoute(parseRoute(location.hash))) toStart();
};
window.addEventListener("hashchange", onHashChange);

// A change of the code runs this module again: the old screen goes away and the new one resumes the saved match.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("hashchange", onHashChange);
    screen?.dispose();
    leaveStart?.();
    defs?.remove();
  });
  import.meta.hot.accept();
}
