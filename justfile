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

# --- Bots do Seks -----------------------------------------------------------

# Lote entre dois bots do Seks, cada abertura com as duas cores (ex.: just seks-batch ab random)
[group('seks')]
seks-batch a b *flags:
    cd digital && cargo build --release -q -p seks-bots
    cd digital/seks/bots && ../../target/release/seks-bots batch --bots {{a}},{{b}} --openings openings/base.txt {{flags}}

# Treina os pesos dos bots do Seks a partir de uma configuração; retoma se parou
[group('seks')]
seks-train config="train/base.json":
    cd digital && cargo build --release -q -p seks-bots
    cd digital/seks/bots && ../../target/release/seks-bots train {{config}}

# Grade de experimentos de treino, com uma linha de resumo por experimento
[group('seks')]
seks-experiments grid *flags:
    cd digital/seks/bots/train/scripts && uv run experiments.py run {{grid}} {{flags}}

# Velocidade do bot padrão do Seks, nativo e em WASM no Node (pede `rustup target add wasm32-wasip1`)
[group('seks')]
seks-bench:
    cd digital && cargo build --release -q -p seks-bots --example bench
    cd digital && cargo build --release -q -p seks-bots --example bench --target wasm32-wasip1
    cd digital && ./target/release/examples/bench
    node digital/seks/bots/wasm/bench.mjs

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
    cd digital && cargo build -q -p seks-bots --lib --target wasm32-unknown-unknown
