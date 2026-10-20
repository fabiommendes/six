import "./styles/fonts.css";
import "./styles/app.css";
import { LiuGame } from "./engine/game";
import { loadWasm } from "./engine/wasm";
import { clear, deviceStore, load, save } from "./logic/save";
import { GameScreen } from "./ui/game";
import { need } from "./ui/dom";
import { showStart } from "./ui/start";

const host = need(document, "#app");
const store = deviceStore();

function play(game: LiuGame, names: readonly string[]): void {
  const keep = () => {
    if (store) save(store, { names, state: game.state() });
  };
  keep();
  new GameScreen(host, game, {
    names,
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
    onStart: ({ names }) => play(LiuGame.create(names.length), names),
    onResume: () => {
      try {
        play(LiuGame.fromState(saved!.state), saved!.names);
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
