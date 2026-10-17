// Runs the benchmark example built for wasm32-wasip1 under Node's WASI, to
// compare its nodes per second with the native build (R7 of
// dev/issues/bots-do-seks.md).
//
//   cargo build --release -p seks-bots --example bench --target wasm32-wasip1
//   node digital/seks/bots/wasm/bench.mjs [SPEC]

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { WASI } from "node:wasi";

const wasm = fileURLToPath(
  new URL("../../../target/wasm32-wasip1/release/examples/bench.wasm", import.meta.url),
);
const spec = process.argv[2] ?? "ab";
const wasi = new WASI({ version: "preview1", args: ["bench", spec], env: {} });
const module = await WebAssembly.compile(await readFile(wasm));
const instance = await WebAssembly.instantiate(module, wasi.getImportObject());
wasi.start(instance);
