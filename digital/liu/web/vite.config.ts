import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      // The generated TypeScript types of the wire (types only, erased at build time).
      "@wire": resolve(here, "../wasm/types"),
      // The WebAssembly package built by `just liu-wasm` (not in git).
      "@liu-wasm": resolve(here, "../wasm/pkg/liu_wasm.js"),
    },
  },
  // The fonts come from the Seks interface (src/styles/fonts.css), two levels up.
  server: { fs: { allow: ["../.."] } },
  build: { target: "es2022" },
  test: { include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"] },
});
