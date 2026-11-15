# AGENTS.md — reglas para cualquier agente que trabaje en este repo

Proyecto: **A.R.E.S. Twin / Analog Atlas**, prototipo para NASA Space Apps 2026. Consola web que
compara terrenos de la Tierra con sitios de la Luna y Marte. Varias personas trabajan en paralelo,
cada una con sus agentes. Lee esto antes de tocar nada.

## 1. Reglas que no se negocian

1. **Honestidad del dato.** Nada se rotula «% de similitud planetaria» ni «en vivo» si no lo es.
   Todo dato lleva `source` / `provenance`. Lo modelado o de literatura se marca como tal (`kind`).
   No inventes valores, lugares ni fuentes; si falta un dato, va `null` y se dice.
2. **Quédate en tu módulo.** Edita solo los archivos de tu módulo (tabla §3). Si necesitas cambiar
   un archivo compartido o de otro módulo, haz el cambio mínimo y anótalo en `docs/contracts.md`
   → «Cambios».
3. **No cambies un contrato en silencio.** Lo compartido está en `docs/contracts.md`; lo específico
   de cada módulo en `docs/modules/`. Los cambios son aditivos; si rompes algo, lo documentas y avisas.
4. **Sin dependencias nuevas** sin que una persona lo apruebe. El frontend es JS vanilla (módulos
   ES, sin build, sin framework); Three.js está en `assets/vendor/`.
5. **Sin secretos.** Nunca leas, imprimas ni subas `.env`. No pongas claves, correos ni datos
   personales en código, commits ni peticiones a servicios externos.
6. **No regeneres datos ni hagas commits, push o merges** salvo que la persona lo pida. Los scripts
   de `scripts/` llaman a servicios externos y reescriben `assets/data/`.
7. **No reformatees ni renombres** archivos que no son parte de tu tarea. Un diff grande en
   `mission.js`, `styles.css` o `index.html` rompe el trabajo de los demás.

## 2. Mapa del repo

| Ruta | Qué es |
| --- | --- |
| `index.html`, `styles.css`, `mission.js`, `scene-fx.mjs`, `app.js`, `data.js` | Mission Control (consola principal, globo, rover, HUD) |
| `discovery.html`, `discovery.css`, `discovery.js`, `discovery-scene.mjs`, `discovery-math.mjs` | Módulo 1 · Discovery |
| `processes.mjs`, `weather-sim.mjs`, `solar.mjs` | Módulo 3 · procesos, clima y sol |
| `mission-math.mjs`, `similarity.mjs`, `sim-physics.mjs`, `copilot-rules.mjs` | Lógica pura compartida (sin DOM, con tests) |
| `server/` | Backend FastAPI: telemetría, pronóstico, copiloto, estáticos |
| `scripts/` | Pipelines Python que generan `assets/data/` (no se sirven) |
| `assets/data/` | Datos publicados: DEM, escenarios, discovery, procesos |
| `tests/` | Pruebas JS (`node --test`); `server/tests/` pruebas Python |
| `docs/` | Contratos, fuentes, QA, pitch, specs por módulo |
| `.cursor/` (local, sin versionar) | Planes y reglas personales de Cursor; no van al repo |
| `arquitectura_y_entregables_s_e_l_e_n_e_ops.md` | Reparto de los 5 módulos del equipo |

Las páginas (`*.html`) viven en la raíz porque el sitio se sirve tal cual (GitHub Pages o
`server/main.py`, que monta la raíz). No hay paso de build.

## 3. Quién toca qué

| Módulo | Rama | Archivos propios |
| --- | --- | --- |
| M1 Discovery | `feature/module-1-discovery` | `discovery*`, `scripts/discover-analogs.py`, `scripts/prefilter-regions.py`, `assets/data/discovery/**`, `tests/discovery.test.mjs`, `docs/module-1-discovery-spec.md` |
| M2 Auditoría de analogía | `feature/selene-m2-nasa-mvp-plan` | `analog-audit*.mjs`, `mission-audit.mjs`, `xlsx-report.mjs`, `rover-config.mjs`, sus tests |
| M3 Procesos dinámicos | `feature/modulo-3-procesos` | `processes.mjs`, `weather-sim.mjs`, `solar.mjs`, `scene-fx.mjs`, `server/forecast*.py`, `assets/data/processes/**` |
| M5 Mission Control | — | `index.html`, `styles.css`, `mission.js`, `app.js`, `data.js` |
| Backend / infra | — | `server/**`, `Dockerfile`, `.dockerignore`, `scripts/deploy-cloudrun.sh` |

**Archivos compartidos (conflicto casi seguro, cambio mínimo y avisado):** `mission.js`,
`styles.css`, `index.html`, `package.json`, `README.md`, `docs/contracts.md`, `similarity.mjs`,
`mission-math.mjs`, `sim-physics.mjs`, `copilot-rules.mjs`, `scripts/fetch-scenarios-earth.py`,
`scripts/terrain_metrics.py`.

Regla práctica: una funcionalidad nueva va en **un archivo nuevo de tu módulo** y se conecta a
`mission.js` / `index.html` con pocas líneas. No hagas crecer `mission.js` (ya tiene ~2500 líneas).

**`mission.js` (Fase 2 del plan de repo):** no reescribir de golpe. Patrón válido: módulo ES puro o
`.mjs` con DOM acotado + en `mission.js` solo `import` y una llamada de cableado (como
`scene-fx.mjs` y `solar.mjs`). Extrae un bloque a archivo nuevo **solo** cuando la tarea ya te
obliga a tocar ese bloque; la extracción va en un **commit aparte** del cambio funcional. Candidatos
cuando toque: globo y marcadores, cámara de transmisión del rover, HUD de telemetría, panel del
copiloto.

## 4. Comandos

```bash
npm run check                                    # sintaxis + todas las pruebas JS
npm test                                         # solo pruebas JS
.venv-server/bin/python -m pytest server/tests   # pruebas del backend, sin red
python3 -m http.server 8000                      # demo estática en localhost:8000
.venv-data/bin/python scripts/discover-analogs.py --self-check   # autocomprobación del pipeline M1
```

Los entornos `.venv-*` no están en el repo. Si falta uno, dilo; no instales nada global.

## 5. Convenciones

- **Código:** lógica pura en `*.mjs` sin DOM y con test en `tests/<nombre>.test.mjs`; el DOM va en
  el `.js` de la página. Solo `textContent` para texto que viene de datos (nunca `innerHTML`).
- **Python:** métricas de terreno siempre con `scripts/terrain_metrics.py`; salidas con caché y
  escritura atómica; cada script declara su fuente en el docstring.
- **Atajos conscientes:** comentario `shortcut: <límite>, <cuándo mejorar>`.
- **Idioma:** UI de Mission Control en español; UI y datos de Discovery en inglés; documentación en
  español; identificadores y commits en inglés.
- **Commits:** `tipo(ámbito): mensaje` (`feat(discovery): …`, `fix(server): …`, `docs: …`),
  pequeños y de un solo módulo.
- **Ramas:** una por módulo (`feature/<módulo>-<tema>`), actualizada desde `main` antes de pedir
  merge. No se trabaja directo en `main`.

## 6. Antes de dar una tarea por terminada

1. `npm run check` pasa (y `pytest` si tocaste `server/`).
2. Solo cambiaste archivos de tu módulo, o anotaste el cambio compartido en `docs/contracts.md`.
3. Actualizaste el doc que describe lo que cambiaste (contrato, spec o README).
4. Si seguías un plan local en `.cursor/plans/`, marcaste su `todo` como `completed` (solo en tu máquina).
5. Dices qué **no** verificaste (por ejemplo, «no lo abrí en un navegador»).

## 7. Planes

Los planes viven en `.cursor/plans/<tema>_<id>.plan.md`: cabecera YAML (`name`, `overview`, `todos`
con `id` / `content` / `status`) y cuerpo en Markdown. Toma una tarea, cambia su estado a
`in_progress`, y a `completed` al cerrar. No reescribas tareas de otros.
