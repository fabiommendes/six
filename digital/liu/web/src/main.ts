import "./styles/fonts.css";
import "./styles/app.css";
import { adaptWorker, WorkerBot } from "./bot/client";
import { LiuGame } from "./engine/game";
import { loadWasm } from "./engine/wasm";
import { clear, deviceStore, load, save, type SeatBot } from "./logic/save";
import { GameScreen } from "./ui/game";
import { need } from "./ui/dom";
import { showStart } from "./ui/start";

const host = need(document, "#app");
const store = deviceStore();

/** The bot of a game: a Web Worker, and at least 0.6 s per command so its plays can be followed. */
const botPlayer = () => new WorkerBot(() => adaptWorker(new Worker(new URL("./bot/worker.ts", import.meta.url), { type: "module" })), 600);

function play(game: LiuGame, names: readonly string[], bots: readonly SeatBot[]): void {
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
    saved: saved?.names ?? null,
    onStart: ({ names, bots }) => play(LiuGame.create(names.length), names, bots),
    onResume: () => {
      try {
        play(LiuGame.fromState(saved!.state), saved!.names, saved!.bots);
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
