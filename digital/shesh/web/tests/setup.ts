import { readFileSync } from "node:fs";
import { loadWasmFrom } from "../src/engine/wasm";

// The package built by `just shesh-wasm`, loaded once for every test file.
loadWasmFrom(readFileSync(new URL("../../wasm/pkg/shesh_wasm_bg.wasm", import.meta.url)));
