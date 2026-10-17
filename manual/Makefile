# Rulebook of the collection: site and PDF from the same sources. See README.md.

VENV := .venv
PY := $(VENV)/bin/python

.PHONY: all build site drafts lint check coverage serve clean venv

all: build

$(VENV)/done: requirements.txt
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install --quiet -r requirements.txt
	touch $@

venv: $(VENV)/done

build: venv        ## site + PDF, then lint the output
	$(PY) -m rulebook build

site: venv         ## site only (fast)
	$(PY) -m rulebook build --no-pdf

drafts: venv       ## include chapters marked `rascunho: true` (not for publishing)
	$(PY) -m rulebook build --drafts

lint: venv         ## check the built output for emoji, open points and leaks
	$(PY) -m rulebook lint

check: venv        ## manual text whose regras/ sources changed since the last review
	$(PY) -m rulebook sync-check --diff

coverage: venv     ## regras/ sections that no manual text uses yet
	$(PY) -m rulebook sync-check --coverage

serve: venv
	$(PY) -m rulebook serve

clean:
	rm -rf build
