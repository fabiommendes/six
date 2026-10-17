# Interface web do Seks

Vite, TypeScript e Three.js. O motor roda no navegador em WebAssembly
(`digital/seks/wasm`). Contexto: `dev/issues/interface-web-do-seks.md`.

## Comandos

- `just seks-wasm`: gera o pacote WASM em `digital/seks/wasm/pkg` (a interface
  importa dele; não vai para o git).
- `just seks-web-install`: instala as dependências (pnpm).
- `just seks-web-dev`: servidor de desenvolvimento.
- `just seks-web-check`: tipos, testes e build (`dist/`).
