// Fails when the WebAssembly package (digital/conexao/wasm/pkg) is missing or
// older than the Rust it is built from, so a stale engine shows up as one
// clear message instead of a parse error deep in a test.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const digital = fileURLToPath(new URL("../../..", import.meta.url));
const wasm = join(digital, "conexao/wasm/pkg/conexao_wasm_bg.wasm");
const sources = ["conexao/engine/src", "conexao/bots/src", "conexao/wasm/src", "conexao/engine/Cargo.toml", "conexao/bots/Cargo.toml", "conexao/wasm/Cargo.toml"];

function newest(path) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return { time: 0, path };
  if (!stat.isDirectory()) return { time: stat.mtimeMs, path };
  return readdirSync(path)
    .map((name) => newest(join(path, name)))
    .reduce((a, b) => (b.time > a.time ? b : a), { time: 0, path });
}

const built = statSync(wasm, { throwIfNoEntry: false })?.mtimeMs ?? 0;
const source = sources.map((s) => newest(join(digital, s))).reduce((a, b) => (b.time > a.time ? b : a));
if (source.time > built) {
  const why = built === 0 ? "conexao/wasm/pkg has not been built" : `conexao/wasm/pkg is older than ${source.path.slice(digital.length)}`;
  console.error(`${why}: run \`just conexao-wasm\`.`);
  process.exit(process.argv.includes("--warn") ? 0 : 1);
}
