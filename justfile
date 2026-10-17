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
    cd digital && cargo test -p seks-engine

# --- Verificações -----------------------------------------------------------

# Tudo o que define "pronto": manual (build, lint e sincronia), protótipo e motor em Rust
[group('check')]
check:
    make -C manual build
    make -C manual check
    cd digital/seks/prototipo && uv run task lint && uv run task test
    cd digital && cargo fmt --check
    cd digital && cargo clippy --all-targets -- -D warnings
    cd digital && cargo test
