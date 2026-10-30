import { readFileSync } from "node:fs";
import { loadWasmFrom } from "../src/engine/wasm";

// The package built by `just conexao-wasm`, loaded once for every test file.
loadWasmFrom(readFileSync(new URL("../../wasm/pkg/conexao_wasm_bg.wasm", import.meta.url)));
