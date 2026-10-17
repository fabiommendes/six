# Ações do ciclo de desenvolvimento do Six. `just` lista as receitas.

set shell := ["bash", "-euo", "pipefail", "-c"]

# Lista as receitas
default:
    @just --list --unsorted

# --- Manual ---------------------------------------------------------------

# Gera o site e o PDF do livro de regras e abre o PDF
[group('manual')]
manual:
    make -C manual
    xdg-open manual/build/manual.pdf

# Gera o site (sem PDF) e serve em http://127.0.0.1:PORT
[group('manual')]
manual-serve port="8000":
    make -C manual site
    (sleep 1 && xdg-open http://127.0.0.1:{{port}}/) &
    cd manual && .venv/bin/python -m rulebook serve --port {{port}}

# Trechos do manual cujas fontes em regras/ mudaram desde a última revisão
[group('manual')]
manual-check:
    make -C manual check

# Seções de regras/ que nenhum trecho do manual usa ainda
[group('manual')]
manual-coverage:
    make -C manual coverage

# --- Protótipo do Seks ------------------------------------------------------

# Joga o protótipo em Python do Seks
[group('seks')]
seks-prototipo:
    cd digital/seks/prototipo && uv run seks

# --- Motor do Seks ----------------------------------------------------------

# Testes do motor do Seks em Rust
[group('seks')]
seks-engine-test:
    cd digital && cargo test -p seks-engine --all-features

# Regenera os tipos TypeScript do wire do motor em digital/seks/wasm/types (ts-rs)
[group('seks')]
seks-types:
    rm -rf digital/seks/wasm/types
    cd digital && TS_RS_EXPORT_DIR="$PWD/seks/wasm/types" CARGO_BUILD_JOBS=4 nice -n 19 cargo test -q -p seks-engine --features wire --lib export_bindings

# Falha se digital/seks/wasm/types está desatualizado em relação ao wire do motor
[group('seks')]
seks-types-check:
    #!/usr/bin/env bash
    set -euo pipefail
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    cd digital
    TS_RS_EXPORT_DIR="$tmp" CARGO_BUILD_JOBS=4 nice -n 19 cargo test -q -p seks-engine --features wire --lib export_bindings
    diff -r "$tmp" seks/wasm/types || { echo "tipos desatualizados: rode just seks-types" >&2; exit 1; }

# Gera o pacote WebAssembly do motor do Seks em digital/seks/wasm/pkg (pede wasm-pack e o alvo wasm32-unknown-unknown)
[group('seks')]
seks-wasm:
    cd digital && CARGO_BUILD_JOBS=4 nice -n 19 wasm-pack build seks/wasm --target web --release

# Gera o pacote WebAssembly e joga duas partidas inteiras pelo Game no Node (SEKS_GAMES=N joga N a mais)
[group('seks')]
seks-wasm-test: seks-wasm
    nice -n 19 node --test digital/seks/wasm/tests/game.test.mjs

# --- Bots do Seks -----------------------------------------------------------

# Teto das execuções caras dos bots (lotes, treino, experimentos, bench):
# 600% de CPU, 4 GB de memória e prioridade mínima de CPU e disco, para não
# travar a máquina, que outras sessões também usam. Os comandos usam 6
# threads por padrão (--threads N ou "threads" na configuração mudam).
seks_limits := "systemd-run --user --scope -q -p CPUQuota=600% -p MemoryMax=4G -- nice -n 19 ionice -c3"

# Lote entre dois bots do Seks, cada abertura com as duas cores (ex.: just seks-batch ab random)
[group('seks')]
seks-batch a b *flags:
    cd digital && CARGO_BUILD_JOBS=4 cargo build --release -q -p seks-bots
    cd digital/seks/bots && {{seks_limits}} ../../target/release/seks-bots batch --bots {{a}},{{b}} --openings openings/base.txt {{flags}}

# Treina os pesos dos bots do Seks a partir de uma configuração; retoma se parou
[group('seks')]
seks-train config="train/base.json":
    cd digital && CARGO_BUILD_JOBS=4 cargo build --release -q -p seks-bots
    cd digital/seks/bots && {{seks_limits}} ../../target/release/seks-bots train {{config}}

# Grade de experimentos de treino, com uma linha de resumo por experimento
[group('seks')]
seks-experiments grid *flags:
    cd digital && CARGO_BUILD_JOBS=4 cargo build --release -q -p seks-bots
    cd digital/seks/bots/train/scripts && {{seks_limits}} uv run experiments.py run {{grid}} {{flags}}

# Velocidade do bot padrão do Seks, nativo e em WASM no Node (pede `rustup target add wasm32-wasip1`)
[group('seks')]
seks-bench:
    cd digital && CARGO_BUILD_JOBS=4 cargo build --release -q -p seks-bots --example bench
    cd digital && CARGO_BUILD_JOBS=4 cargo build --release -q -p seks-bots --example bench --target wasm32-wasip1
    cd digital && {{seks_limits}} ./target/release/examples/bench
    {{seks_limits}} node digital/seks/bots/wasm/bench.mjs

# Testes lentos dos bots do Seks (centenas de partidas), fora do check
[group('seks')]
seks-bots-slow-test:
    cd digital && CARGO_BUILD_JOBS=4 {{seks_limits}} cargo test --release -q -p seks-bots -- --ignored --skip generate_the_suite

# --- Verificações -----------------------------------------------------------

# Tudo o que define "pronto": manual (build, lint e sincronia), protótipo, motor e bots em Rust (e o build WASM dos bots)
[group('check')]
check:
    make -C manual build
    make -C manual check
    cd digital/seks/prototipo && uv run task lint && uv run task test
    cd digital && cargo fmt --check
    cd digital && cargo clippy --all-targets --all-features -- -D warnings
    cd digital && cargo test --all-features
    just seks-types-check
    just seks-wasm-test
    cd digital && cargo build -q -p seks-bots --lib --target wasm32-unknown-unknown
