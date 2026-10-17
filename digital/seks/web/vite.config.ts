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
      // The WebAssembly package built by `just seks-wasm` (not in git).
      "@seks-wasm": resolve(here, "../wasm/pkg/seks_wasm.js"),
    },
  },
  server: { fs: { allow: [".."] } },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 700 },
  test: { include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"] },
});
