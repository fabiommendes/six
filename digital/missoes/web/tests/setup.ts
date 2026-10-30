import { readFileSync } from "node:fs";
import { loadWasmFrom } from "../src/engine/wasm";

// The package built by `just missoes-wasm`, loaded once for every test file.
loadWasmFrom(readFileSync(new URL("../../wasm/pkg/missoes_wasm_bg.wasm", import.meta.url)));
