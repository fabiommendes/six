import "./styles/fonts.css";
import "./styles/app.css";
import { adaptWorker, WorkerBot } from "./bot/client";
import { ConexaoGame, defaultRules } from "./engine/game";
import { loadWasm } from "./engine/wasm";
import { clear, deviceStore, load, save, type SeatBot } from "./logic/save";
import { GameScreen } from "./ui/game";
import { need } from "./ui/dom";
import { showStart } from "./ui/start";

const host = need(document, "#app");
const store = deviceStore();

/** The bot of a game: a Web Worker, and at least 0.6 s per move so its plays can be followed. */
const botPlayer = () => new WorkerBot(() => adaptWorker(new Worker(new URL("./bot/worker.ts", import.meta.url), { type: "module" })), 600);

function play(game: ConexaoGame, names: readonly string[], bots: readonly SeatBot[]): void {
  const keep = () => {
    if (store) save(store, { names, bots, state: game.state() });
  };
  keep();
  new GameScreen(host, game, {
    names,
    bots,
    botPlayer: botPlayer(),
    onChange: keep,
    onLeave: () => {
      if (store) clear(store);
      game.free();
      start();
    },
  });
}

function start(): void {
  const saved = store ? load(store) : null;
  showStart(host, {
    defaults: defaultRules(),
    saved: saved?.names ?? null,
    onStart: ({ names, bots, rules }) => play(ConexaoGame.create(rules), names, bots),
    onResume: () => {
      try {
        play(ConexaoGame.fromState(saved!.state), saved!.names, saved!.bots);
      } catch {
        // A save the engine refuses (an older version): start over.
        if (store) clear(store);
        start();
      }
    },
  });
}

loadWasm().then(start, (error: unknown) => {
  host.textContent = `Não foi possível carregar o jogo: ${String(error)}`;
});
