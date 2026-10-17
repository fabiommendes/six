import init, { initSync } from "@seks-wasm";

let ready: Promise<void> | null = null;

/** Loads the WebAssembly module of the engine (once). In the browser and in a Worker. */
export function loadWasm(): Promise<void> {
  if (ready === null) ready = init().then(() => undefined);
  return ready;
}

/** Loads the module from its bytes, for hosts without `fetch` of a URL (the tests). */
export function loadWasmFrom(bytes: BufferSource): void {
  initSync({ module: bytes });
  ready = Promise.resolve();
}
