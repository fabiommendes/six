import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOT_LEVELS } from "../src/bot/levels";
import { SeksGame } from "../src/engine/game";
import type { Mode } from "../src/logic/match";
import {
  APP,
  BUTTONS,
  COUNTER,
  LEGEND,
  START,
  boardLabel,
  diceCount,
  hint,
  lastPlayText,
  modeLine,
  repetitionWarning,
  resultText,
  turnSubtitle,
  turnTitle,
} from "../src/logic/texts";
import { newMatch, ScriptedBot } from "./fakes";

const root = new URL("../", import.meta.url).pathname;
const glossary = readFileSync(join(root, "../../../regras/seks/GLOSSARY.md"), "utf8");

/** The words of every `Não usar:` line of the glossary, one by one. */
const forbidden = glossary
  .split("\n")
  .filter((line) => line.startsWith("Não usar:"))
  .flatMap((line) => line.slice("Não usar:".length).split(","))
  .map((word) => word.trim().toLowerCase())
  .filter(Boolean);

function containsWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, "iu").test(text);
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sources(path) : [path];
  });
}

describe("R9: the terms of the glossary", () => {
  it("reads the words to avoid from the glossary", () => {
    expect(forbidden).toEqual(expect.arrayContaining(["peça", "comer", "tomar", "quadrado", "célula", "carregar", "aumentar", "lance", "força"]));
  });

  it("none of them is in any source or page of the interface", () => {
    const files = [...sources(join(root, "src")).filter((f) => /\.(ts|css|html)$/.test(f)), join(root, "index.html")];
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const word of forbidden) {
        expect(containsWord(text, word), `${word} in ${file}`).toBe(false);
      }
    }
  });

  it("none of them is in the sentences the game builds", async () => {
    const bot = new ScriptedBot();
    const sentences: string[] = [
      ...Object.values(APP),
      ...Object.values(BUTTONS),
      ...Object.values(LEGEND),
      ...Object.values(START),
      COUNTER.label,
      COUNTER.limit(100),
      diceCount(1),
      diceCount(15),
    ];
    const modes: Mode[] = [{ kind: "hotseat" }, { kind: "bot", human: "black", level: BOT_LEVELS[0]! }];
    for (const mode of modes) {
      sentences.push(modeLine(mode));
      const { match } = newMatch(SeksGame.create(), mode, mode.kind === "bot" ? bot : null);
      bot.queue = ["b2-b4"];
      await match.start();
      // The human's die: b2 for the Whites (hotseat), b10 for the Blacks against the bot.
      const mine = mode.kind === "bot" ? "b10" : "b2";
      for (const gesture of ["toque", "clique"] as const) {
        sentences.push(hint(match.snapshot(), gesture).strong, hint(match.snapshot(), gesture).rest);
      }
      await match.click(mine);
      const snapshot = match.snapshot();
      for (const gesture of ["toque", "clique"] as const) {
        sentences.push(hint(snapshot, gesture).strong, hint(snapshot, gesture).rest);
      }
      sentences.push(boardLabel(snapshot), turnSubtitle(snapshot));
      for (const side of ["white", "black"] as const) sentences.push(turnTitle(side));
    }
    sentences.push(lastPlayText({ side: "black", from: "g8", to: "g6", value: 2, captures: 2 }), lastPlayText({ side: "white", from: null, to: "g8", value: 4, captures: 0 }));
    for (const sentence of sentences) {
      for (const word of forbidden) expect(containsWord(sentence, word), `${word} in "${sentence}"`).toBe(false);
    }
  });
});

describe("the sentences", () => {
  it("names the sides and counts dice as the glossary does", () => {
    expect(turnTitle("white")).toBe("Vez das Brancas");
    expect(turnTitle("black")).toBe("Vez das Pretas");
    expect(diceCount(1)).toBe("1 dado");
    expect(diceCount(15)).toBe("15 dados");
  });

  it("words the last play", () => {
    expect(lastPlayText({ side: "black", from: "g8", to: "g6", value: 2, captures: 0 })).toBe("Última jogada: Pretas, de g8 para g6.");
    expect(lastPlayText({ side: "white", from: "a7", to: "a6", value: 1, captures: 1 })).toBe("Última jogada: Brancas, de a7 para a6, com captura de 1 dado.");
    expect(lastPlayText({ side: "white", from: null, to: "b2", value: 3, captures: 0 })).toBe("Última jogada: Brancas, b2 incrementado para 3.");
  });

  it("tells the mode", () => {
    expect(modeLine({ kind: "hotseat" })).toBe("Partida local · Brancas contra Pretas");
    expect(modeLine({ kind: "bot", human: "white", level: BOT_LEVELS[1]! })).toBe("Contra o bot, nível Médio · você joga com as Brancas");
  });
});

describe("the note under the title", () => {
  it("asks for a die and says that the Whites must move on the first turn", async () => {
    const { match } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    expect(hint(match.snapshot(), "toque")).toEqual({
      strong: "Escolha um dado.",
      rest: "Toque num dado das Brancas para ver aonde ele vai. No primeiro turno, as Brancas precisam mover.",
    });
    await match.click("b2");
    expect(hint(match.snapshot(), "toque").rest).toBe(
      "Toque numa casa marcada para mover: 6 casas ao alcance. No primeiro turno, as Brancas não incrementam; toque no dado de novo para tirar a seleção.",
    );
  });

  it("asks for a die before anything is selected", async () => {
    const game = SeksGame.create();
    game.command("k2-k3");
    game.command("k10-k9");
    const { match } = newMatch(game, { kind: "hotseat" });
    await match.start();
    expect(hint(match.snapshot(), "toque")).toEqual({
      strong: "Escolha um dado.",
      rest: "Toque num dado das Brancas para ver aonde ele vai; toque nele de novo para incrementar.",
    });
    expect(hint(match.snapshot(), "clique").rest.startsWith("Clique num dado")).toBe(true);
  });

  it("counts the cells at reach of the selected die and says how to increment", async () => {
    const game = SeksGame.create();
    game.command("k2-k3");
    game.command("k10-k9");
    const { match } = newMatch(game, { kind: "hotseat" });
    await match.start();
    await match.click("b2");
    expect(hint(match.snapshot(), "toque")).toEqual({
      strong: "2 em b2 selecionado.",
      rest: "Toque numa casa marcada para mover: 6 casas ao alcance. Toque no dado de novo para incrementar.",
    });
  });

  it("explains that a 6 cannot be incremented", async () => {
    const rows = Array.from({ length: 11 }, (_, i) => (i === 5 ? ".. .. .. .. w6 .. .. .. .. .. .." : i === 0 ? ".. .. .. .. .. .. .. .. .. .. b1" : i === 10 ? "w1 .. .. .. .. .. .. .. .. .. .." : ".. ".repeat(10) + ".."));
    const { match } = newMatch(SeksGame.fromDiagram(rows.join("\n"), "white"), { kind: "hotseat" });
    await match.start();
    await match.click("e6");
    const note = hint(match.snapshot(), "toque");
    expect(note.strong).toBe("6 em e6 selecionado.");
    expect(note.rest).toContain("Um 6 não pode ser incrementado; toque nele de novo para tirar a seleção.");
  });

  it("tells a 6 in the center what it can shoot, and words the shot", async () => {
    // The 6 in f6 sees b1 in k11 on the diagonal.
    const rows = Array.from({ length: 11 }, (_, i) => (i === 5 ? ".. .. .. .. .. w6 .. .. .. .. .." : i === 0 ? ".. .. .. .. .. .. .. .. .. .. b1" : i === 10 ? "w1 .. .. .. .. .. .. .. .. .. .." : ".. ".repeat(10) + ".."));
    const { match } = newMatch(SeksGame.fromDiagram(rows.join("\n"), "white"), { kind: "hotseat" });
    await match.start();
    await match.click("f6");
    const note = hint(match.snapshot(), "clique");
    expect(note.strong).toBe("6 em f6 selecionado.");
    expect(note.rest).toBe("Clique num dado marcado para atirar: 1 alvo. Ou clique numa casa marcada para mover.");
    await match.click("k11");
    const last = match.snapshot().last!;
    expect(last).toEqual({ side: "white", from: "f6", to: "k11", value: 6, captures: 1, shot: true });
    expect(lastPlayText(last)).toBe("Última jogada: Brancas, tiro de f6 em k11, com captura de 1 dado.");
  });

  it("says the bot is thinking, and the human's turn against it", async () => {
    const bot = new ScriptedBot();
    const { match } = newMatch(SeksGame.create(), { kind: "bot", human: "white", level: BOT_LEVELS[1]! }, bot);
    await match.start();
    expect(turnSubtitle(match.snapshot())).toBe("Sua vez: mova ou incremente um dado.");
    expect(hint(match.snapshot(), "toque").rest).toContain("num dos seus dados");
    await match.click("b2");
    const playing = match.click("b4");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(turnSubtitle(match.snapshot())).toBe("O bot está pensando…");
    expect(hint(match.snapshot(), "toque").strong).toBe("O bot está pensando.");
    bot.answer("b10-b8");
    await playing;
  });
});

describe("R7: the sentences of the draws", () => {
  it("warns of a repetition that would draw", () => {
    const game = SeksGame.create();
    const cycle = ["b2-b4", "b10-b8", "b4-b2", "b8-b10"];
    const { match } = newMatch(game, { kind: "hotseat" });
    expect(repetitionWarning(match.snapshot())).toBeNull();
    for (const command of [...cycle, ...cycle.slice(0, 3)]) game.command(command);
    expect(repetitionWarning(match.snapshot())).toBe("Atenção: uma jogada possível repetiria a posição pela 3ª vez e daria empate.");
  });

  it("words the end of the game", () => {
    const game = SeksGame.create();
    const view = game.view();
    expect(resultText({ kind: "draw", reason: "repetition" }, view).title).toBe("Empate");
  });
});
