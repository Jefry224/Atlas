# AGENTS.md — rules for any agent working in this repo

Project: **S.E.L.E.N.E. Ops** (*Surface Exploration, Lithology & Environment Network Engine*),
**ProdKillers** team, NASA Space Apps 2026 — *Identify Earth Locations that Analog the Permanent Moon
Base Locations and Mars*. Five vertical modules share the analog candidate contract
(`CandidateAnalogPayload` in `arquitectura_y_entregables_s_e_l_e_n_e_ops.md`; integrated formats in
`docs/contracts.md`): discover terrestrial micro-analogs, audit analogy breakdown, dynamic processes,
subsurface/hazards, and the Mission Control console (3D twin). Several people work in parallel, each
with their own agents. Read this before touching anything.

Note: `index.html`, `mission.js`, and parts of `docs/` still show the legacy **A.R.E.S. Twin / Analog
Atlas** branding; the official product name is **S.E.L.E.N.E. Ops**. Do not mass-rename in M5 unless
the task explicitly asks for it.

## 1. Non‑negotiable rules

1. **Data honesty.** Never label «planetary similarity %» or «live» unless it truly is. Every datum
   has `source` / `provenance`. Modeled or literature values are marked as such (`kind`). Do not
   invent values, places, or sources; if data is missing, use `null` and say so.
2. **Stay in your module.** Edit only your module’s files (§3 table). If you must change a shared or
   another module’s file, keep the diff minimal and record it in `docs/contracts.md` → «Cambios».
3. **Do not change contracts silently.** Shared contracts live in `docs/contracts.md`; module-specific
   ones in `docs/modules/`. Changes are additive; if you break something, document it and warn the team.
4. **No new dependencies** without a human approving. Frontend is vanilla JS (ES modules, no build, no
   framework); Three.js is in `assets/vendor/`.
5. **No secrets.** Never read, print, or commit `.env`. Do not put keys, emails, or personal data in
   code, commits, or external service requests.
6. **Do not regenerate data or commit, push, or merge** unless the human asks. `scripts/` call external
   services and rewrite `assets/data/`.
7. **Do not reformat or rename** files outside your task. Large diffs in `mission.js`, `styles.css`, or
   `index.html` break everyone else’s work.
8. **English by default.** Everything you write or ship is in **English**: UI (all pages), metadata in
   JSON under `assets/data/`, error messages, export text (Markdown, Excel, dossier), copilot answers,
   test names, comments in new code, and technical docs (`docs/`, README, specs, contracts — including
   this file). Identifiers, commits, and branch names: English. Do not add new Spanish; if you touch a
   surface still in Spanish (e.g. legacy Mission Control), move it to English in the same change or leave
   a `shortcut:` noting the debt. Exception: informal team notes not meant for agents (e.g.
   `arquitectura_y_entregables_s_e_l_e_n_e_ops.md`) may stay in Spanish until the team translates them.

## 2. Architecture and repo map

> **Layout status: done.** Code lives in `src/<module>/`; pages stay at the root. See
> `docs/README.md` for the docs index.

```
index.html  discovery.html  dossier.html  route-explorer.html    pages (public URLs, always at root)
src/
  shared/      pure logic used by several modules: mission-math, similarity, sim-physics,
               copilot-rules, rover-config
  mission/     M5 Mission Control: mission.js, app.js, data.js, styles.css, mission-preparation.*,
               mission-export-identity, physics-evidence, sim-layout, surface-assessment*
  discovery/   M1: discovery.js, discovery-scene, discovery-math, discovery.css
  audit/       M2: analog-audit*, mission-audit, mission-profiles, xlsx-report, nasa-*, bench-*
  processes/   M3: processes, weather-sim, solar, scene-fx, scene-lighting, terrain-shader
  landing/     landing-*, lander-visual, skycrane-visual
  expedition/  earth-expedition*
  hazards/     M4: m4-* (SAR, subsurface, caves, local terrain), route-math, route-explorer.js/.css
  dossier/     dossier.js, dossier.css, dossier-spacing.css, dossier-context, dossier-session
assets/        data/ (published DEM, scenarios, discovery, processes), models/, textures/, vendor/ (Three.js)
server/        FastAPI backend: telemetry, forecast, copilot, static files
scripts/       pipelines that generate assets/data/ and QA scripts (not served)
tests/         JS tests (node --test); tests/manual/ for pages opened by hand; server/tests/ for Python
docs/
  README.md    index of every document
  contracts.md, candidate-analog-payload.schema.json, ejecucion-mise.md
  modules/     per-module contracts, specs and usage guides
  product/     challenge, vision (arquitectura_y_entregables_s_e_l_e_n_e_ops.md), pitch, demo script
  qa/          QA reports, source audits, past visual reviews
  evidencias/  QA evidence written by scripts/ (heavy; do not add files over 1 MB)
```

Rules of the layout:

- **Root holds only** pages, `README*`, `AGENTS.md`, `CLAUDE.md` and tool config (`package.json`,
  `mise.toml`, `Dockerfile`, dotfiles). No new code, CSS or docs at the root.
- **One folder per feature, flat inside.** No sub-folders under `src/<folder>/`. A new folder only
  for a new module (e.g. `src/hazards/` for M4).
- **Dependencies:** `src/shared/` imports nothing outside `shared/`. Feature folders import from
  `shared/` and, sparingly, from another feature. Only page entry points (`mission.js`,
  `discovery.js`, `dossier.js`) wire several features together.
- **Paths:** module imports are relative to the file (`../shared/x.mjs`,
  `../../assets/vendor/three.module.min.js`); `fetch('assets/data/…')` is relative to the page and
  does not change with the folder.
- **Docs:** one topic, one file, in the folder that matches it; add it to `docs/README.md`.
  `docs/contracts.md` stays where it is.
- The site is served as-is (GitHub Pages or `server/main.py`, which mounts the root). There is no
  build step. `.cursor/` is local and not versioned.

## 3. Who touches what

| Module | Branch | Owned files |
| --- | --- | --- |
| M1 Discovery | `feature/module-1-discovery` | `discovery.html`, `src/discovery/**`, `scripts/discover-analogs.py`, `scripts/prefilter-regions.py`, `assets/data/discovery/**`, `tests/discovery.test.mjs`, `docs/modules/m1-discovery.md`, `docs/modules/module-1-discovery-spec.md` |
| M2 Analogy breakdown | `feature/selene-m2-nasa-mvp-plan` | `src/audit/**`, `src/shared/rover-config.mjs`, their tests, `docs/modules/m2-audit.md`, `docs/modules/modulo-2.md`, `docs/modules/perfiles-base-m2.md`, `docs/modules/nasa-assets.md` |
| M3 Dynamic processes | `feature/modulo-3-procesos` | `src/processes/**`, `server/forecast*.py`, `assets/data/processes/**`, `docs/modules/m3-processes.md` |
| M4 Subsurface, hazards & route explorer | `feature/module-4-route-explorer` (merged) | `route-explorer.html`, `src/hazards/**`, `tests/m4-*.test.mjs`, `tests/route-math.test.mjs`, `tests/test_m4_sar_pipeline.py`, `docs/modules/m4-routes.md` |
| M5 Mission Control & dossier | — | `index.html`, `dossier.html`, `src/mission/**` (incl. Flight Director: `surface-assessment*`, `docs/modules/surface-assessment.md`), `src/dossier/**`, `server/` (copilot, static), dossier / report generation |
| Landing and Earth expedition | (owner not recorded; ask before large edits) | `src/landing/**`, `src/expedition/**`, their tests, `docs/modules/descenso-*.md`, `docs/modules/earth-expedition.md` |
| Backend / infra | — | `server/**`, `Dockerfile`, `.dockerignore`, `scripts/deploy-cloudrun.sh` |

**Shared files (high conflict risk — minimal change and announce):** `mission.js`, `styles.css`,
`index.html`, `package.json`, `README.md`, `docs/contracts.md`, everything in `src/shared/`
(`similarity.mjs`, `mission-math.mjs`, `sim-physics.mjs`, `copilot-rules.mjs`, `rover-config.mjs`),
`scripts/fetch-scenarios-earth.py`, `scripts/terrain_metrics.py`.

Practical rule: new functionality goes in **a new file in your module's folder** and wires into
`mission.js` / `index.html` with a few lines. Do not grow `mission.js` (~2500 lines already).

**`mission.js` (repo plan phase 2):** do not rewrite in one shot. Valid pattern: pure ES module or
scoped-DOM `.mjs` + in `mission.js` only `import` and one wiring call (like `scene-fx.mjs` and
`solar.mjs`). Extract a block to a new file **only** when the task already forces you to edit that
block; extraction goes in a **separate commit** from the functional change. Extraction candidates when
needed: globe and markers, rover feed camera, telemetry HUD, copilot panel.

## 4. Commands

```bash
npm run check                                    # syntax + all JS tests
npm test                                         # JS tests only
.venv-server/bin/python -m pytest server/tests   # backend tests, no network
npm start                                        # local demo (see package.json; static fallback: npm run start:static)
.venv-data/bin/python scripts/discover-analogs.py --self-check   # M1 pipeline self-check
```

`.venv-*` environments are not in the repo. If one is missing, say so; do not install globally.

## 5. Conventions

- **Code:** pure logic in `*.mjs` without DOM and with tests in `tests/<name>.test.mjs`; DOM belongs in
  the page `.js`. Use only `textContent` for data-driven text (never `innerHTML`).
- **Python:** terrain metrics always via `scripts/terrain_metrics.py`; outputs with cache and atomic
  writes; each script declares its source in the docstring.
- **Conscious shortcuts:** comment `shortcut: <limit>, <when to improve>`.
- **Language:** see §1.8 (English for product, data, and technical docs).
- **Commits:** `type(scope): message` (`feat(discovery): …`, `fix(server): …`, `docs: …`), small and
  single-module.
- **Branches:** one per module (`feature/<module>-<topic>`), rebased/merged from `main` before asking to
  merge. Do not work directly on `main`.

## 6. Before marking a task done

1. `npm run check` passes (and `pytest` if you touched `server/`).
2. You only changed your module’s files, or you noted the shared change in `docs/contracts.md`.
3. You updated the doc that describes what changed (contract, spec, or README).
4. Say what you **did not** verify (e.g. «did not open in a browser»).