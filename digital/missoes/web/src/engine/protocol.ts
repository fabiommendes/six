import type { Answer, Setup, Step, View } from "./game";

/** What the page asks the game Worker. The first request of a Worker is `start`. */
export type GameRequest =
  | { readonly id: number; readonly op: "start"; readonly setup: Setup; readonly seed: string }
  | { readonly id: number; readonly op: "view" }
  | { readonly id: number; readonly op: "apply"; readonly answer: Answer }
  | { readonly id: number; readonly op: "bot" };

/** What the Worker answers: a view, a step, or why it could not. */
export type GameResponse =
  | { readonly id: number; readonly view: View }
  | { readonly id: number; readonly step: Step }
  | { readonly id: number; readonly error: string };
