import "./styles/fonts.css";
import "./styles/app.css";
import { adaptWorker, RemoteGame } from "./engine/remote";
import { loadWasm } from "./engine/wasm";
import { GameScreen } from "./ui/game";
import { need } from "./ui/dom";
import { showStart, type StartChoice } from "./ui/start";

const host = need(document, "#app");

/** The engine and the bots run in a Web Worker: the greedy bot can think for a second or two. */
const spawn = () => adaptWorker(new Worker(new URL("./engine/worker.ts", import.meta.url), { type: "module" }));

async function play(choice: StartChoice): Promise<void> {
  const game = await RemoteGame.start(spawn(), { bots: choice.bots, goal: choice.goal });
  const view = await game.view();
  new GameScreen(host, game, view, { names: choice.names, onLeave: start });
}

function start(): void {
  showStart(host, (choice) => {
    play(choice).catch((error: unknown) => {
      host.textContent = `Não foi possível começar a partida: ${String(error)}`;
    });
  });
}

// The page loads the module too, so a broken build shows up before the first game.
loadWasm().then(start, (error: unknown) => {
  host.textContent = `Não foi possível carregar o jogo: ${String(error)}`;
});
