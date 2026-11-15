# Spec — Módulo 1: Motor de Descubrimiento de "Análogos Ocultos"

> Estado: **propuesto** · Owner del spec: Integrante 1 (Global Hidden-Site Hunter) ·
> Última edición: 2026-11-14
>
> Este documento es asignable por tareas (T1…T6). Cada tarea declara **dueño, entradas,
> salidas, archivos y criterios de aceptación** para que un agente la tome de forma aislada.
> Fuente única de contratos entre frentes: [`docs/contracts.md`](contracts.md).

## 1. Objetivo y alcance

El reto NASA pide **buscar global y sistemáticamente análogos terrestres no reconocidos** de un
punto de la Luna/Marte, considerando la escala. Hoy A.R.E.S. Twin empareja **un** sitio terrestre
elegido a mano por objetivo (4 escenarios fijos en `assets/data/scenarios.json`). El Módulo 1
invierte el flujo: **dado un objetivo planetario, escanea una región poco explorada en celdas de
~2.4 km, calcula las métricas de terreno de cada celda y rankea los Top-N candidatos inéditos**
por similitud geométrica.

**Decisiones de alcance (fijas para el MVP):**

- **Entrega:** pipeline Python que produce un JSON de candidatos **+ panel UI mínimo** para listarlos.
- **Similitud:** **solo geométrica**, reusando `compareTerrain` de `similarity.mjs`
  (pendiente p50/p90, desnivel p95–p5, TRI). La rugosidad radar queda excluida frente al objetivo
  igual que hoy (dB terrestre vs CPR del objetivo). **Nada** de amplitud térmica/aridez en el MVP.
- **Honestidad (regla heredada del repo):** ningún número se llama "% de similitud planetaria";
  todo candidato lleva `provenance` y la nota de que **no es un sitio de ensayo publicado**.

**Fuera de alcance (extensiones documentadas, NO en el MVP):** imagen Sentinel-2 por candidato,
rugosidad Sentinel-1 por candidato, amplitud térmica/aridez, previsualización 3D por candidato.

## 2. Qué se reutiliza (no reescribir)

| Pieza existente | Archivo / símbolo | Uso en Módulo 1 |
| --- | --- | --- |
| Métricas de terreno dependency-free | `scripts/terrain_metrics.py` → `compute_metrics`, `bilinear_resample`, `percentile` | Métricas por celda, idénticas a las de escenarios |
| Ventana DEM + warp + STAC | `scripts/fetch-scenarios-earth.py` → `warp`, `window_lonlat_bbox`, `site_crs`, `catalog`, `sign`, `item_record`, `cached_json`, `GDAL_ENV`, constantes `N`, `SPACING`, `NATIVE_N`, `NATIVE_RES`, `EXTENT` | Traer el DEM de puntuación de cada celda desde JAXA ALOS World 3D-30m (AW3D30) en Planetary Computer `alos-dem` |
| Índice de similitud geométrica | `similarity.mjs` → `compareTerrain(earth, target)`, `SIMILARITY_COMPONENTS`, `ratioScore` | Ranking de selección (puerto Python) y el **índice que se muestra** (recomputado en el browser) |
| Objetivos ya generados | `assets/data/scenarios/targets/<id>.json` (`marius-hills`, `shackleton`, `jezero`, `valles-marineris`) | El objetivo contra el que se rankea (ya trae su bloque `metrics`) |
| Validación/rutas de rejilla | `mission-math.mjs` → `validGrid`, `DEFAULT_EXTENT`; `styles.css` | Validación y estilos del panel |

> El nivel de módulo de `fetch-scenarios-earth.py` solo define constantes/funciones y el dict
> `SITES` (sin efectos secundarios hasta `main()`), así que **importar sus helpers es seguro**,
> usando el mismo truco `sys.path.insert(0, ROOT/'scripts')` que ese script ya aplica para
> `terrain_metrics`.

## 3. Contrato de salida — `assets/data/discovery/<targetId>.json`

Registrar también como **§7 "Descubrimiento"** en `docs/contracts.md`.

```jsonc
{
  "version": 1,
  "targetId": "marius-hills",
  "target": "assets/data/scenarios/targets/marius-hills.json",
  "body": "moon",
  "window": { "extentMeters": 2400, "gridSize": 65, "spacingMeters": 37.5 },
  "region": { "id": "centroamerica-volcanic", "name": "...", "bbox": [W, S, E, N],
              "provenance": [{ "label": "...", "url": "..." }] },
  "scannedCells": 256,
  "generatedAt": "ISO-8601",
  "candidates": [                  // Top-N, orden descendente por índice
    {
      "rank": 1,
      "id": "cand-marius-hills-01",
      "center": [lat, lon],        // planetocéntrico, este positivo
      "selectionIndex": 72,        // score Python de selección (orientativo; el visible lo da el frontend)
      "metrics": { "slopeP50Deg": 0, "slopeP90Deg": 0, "reliefP95P5M": 0,
                   "triMeanM": 0, "comparable": true, "roughness": null },
      "elevation": [ /* 4225 floats; fila 0 = NORTE, col 0 = OESTE (row-major) */ ],
      "gridSize": 65, "spacingMeters": 37.5, "extentMeters": 2400,
      "nativeResolutionMeters": 30,
      "dataset": "ALOS World 3D-30m (AW3D30) · JAXA/EORC and METI, via Planetary Computer alos-dem",
      "provenance": [{ "label": "ALOS World 3D-30m (AW3D30) DSM · JAXA/EORC and METI · tile <id> (Planetary Computer)", "url": "..." }],
      "notes": [ "Candidato descubierto por escaneo en rejilla; no es un sitio de ensayo publicado.",
                 "Sin imagen ni clima: el MVP rankea solo por geometría del relieve." ]
    }
  ],
  "caveats": [ "<GEOMETRY_CAVEAT de similarity.mjs>",
               "Ranking de selección geométrico; el índice mostrado lo recomputa similarity.mjs." ]
}
```

**Invariante clave:** cada `candidate` tiene la **misma forma que un `earth/<id>.json`** (bloque
`metrics` + `elevation` + geometría de ventana), de modo que se pasa directo a
`compareTerrain(candidate, targetJson)` y al renderer de rejillas, sin adaptadores.

## 4. Tareas asignables

### T1 — Refactor habilitador en el pipeline de Tierra · dueño: Datos
Extraer de `fetch_dem` (en `scripts/fetch-scenarios-earth.py`) un helper reutilizable
`dem_window(lat, lon, items) -> list[float]` que recibe las **teselas STAC ya buscadas** y
devuelve el grid 65×65 (reusando `warp` + relleno multi-tesela + `bilinear_resample` tal cual).
`fetch_dem` pasa a: buscar items (cacheado) y delegar en `dem_window`.
- **Entradas:** código actual de `fetch_dem` (líneas ~153–178).
- **Salida:** `dem_window` exportable, `fetch_dem` sin cambio de comportamiento.
- **Archivos:** `scripts/fetch-scenarios-earth.py`.
- **Aceptación:** regenerar un sitio existente (`atacama`) con `--force` produce un JSON idéntico
  en `metrics` al previo; el self-check `__main__` de `terrain_metrics.py` sigue en verde.

### T2 — Script de descubrimiento · dueño: Datos (depende de T1)
Nuevo `scripts/discover-analogs.py`. CLI:
`discover-analogs.py <targetId> [--region <id>] [--top 5] [--limit N] [--force] [--self-check]`.
Lógica:
1. Constante `REGIONS`: `{id, name, bbox:[W,S,E,N], provenance, notes}`. Sembrar con el arco
   volcánico centroamericano, el altiplano andino y una cuenca de Asia Central (bboxes ~40×40 km).
2. Cargar el objetivo desde `assets/data/scenarios/targets/<targetId>.json` y tomar su `metrics`.
3. `cell_centers(region)`: enumerar centros de celda sobre la bbox, paso = `EXTENT` (2400 m)
   convertido a grados con `site_crs`/`Transformer`, para teselar sin solape.
4. STAC **una sola vez por región**: buscar `alos-dem` con la bbox completa, cachear las
   teselas 1°×1°. Por celda, elegir las teselas que la cubren y llamar `dem_window` (T1).
5. Por celda: `compute_metrics(elev, N, SPACING, native_resolution_m=30, roughness=None)` +
   `geo_index(metrics, target_metrics)` (ver T3). Celda que falle (sin tesela / ventana incompleta /
   mar) **se salta, no aborta**. Cachear métricas por celda bajo
   `$XDG_CACHE_HOME/ares-twin-discovery/`.
6. Rankear; guardar `elevation` completo **solo** para los Top-N; escribir el JSON del §3.
- **Entradas:** `dem_window` (T1), helpers de §2, targets existentes.
- **Salida:** `assets/data/discovery/<targetId>.json`.
- **Archivos:** `scripts/discover-analogs.py` (nuevo), `assets/data/discovery/**`.
- **Aceptación:** `discover-analogs.py marius-hills --region centroamerica-volcanic --top 5`
  escribe el JSON con ≥1 candidato, loguea `scannedCells` y los Top-5 con `selectionIndex`;
  re-correr sin `--force` usa caché y es casi instantáneo.
- `shortcut:` un `warp()` remoto por celda; aceptable con GDAL VSI cache para bboxes chicos.
  Upgrade si hay que escanear regiones grandes: bajar el COG de la región una vez y ventanear en memoria.

### T3 — Puerto Python del índice + self-check cruzado · dueño: Datos
`geo_index(metrics, target_metrics) -> float`: réplica exacta de la fórmula de `similarity.mjs`
(solo los 4 componentes geométricos; `ratioScore = 100·min(a',b')/max(a',b')` con `a' = max(|a|, floor)`,
pesos 0.30/0.25/0.20/0.15 renormalizados a 1). Es ~12 líneas.
- **Antideriva:** el número **visible** siempre lo recomputa el frontend con `compareTerrain`
  (T5); `geo_index` solo ordena la selección.
- **Self-check** en `__main__` (estilo `terrain_metrics.py`): para un par de métricas de muestra,
  `geo_index` debe dar el **mismo** valor que `compareTerrain` (valor esperado hardcodeado, tomado
  de correr `similarity.mjs` sobre ese par).
- **Archivos:** dentro de `scripts/discover-analogs.py`.
- **Aceptación:** `discover-analogs.py --self-check` imprime OK; el valor esperado coincide con el
  verificado en `tests/discovery.test.mjs` (T6).

### T4 — Registrar el contrato · dueño: Coordinación
Añadir §7 "Descubrimiento" a `docs/contracts.md` con el JSON del §3 y una línea en `README.md`
(tabla de scripts) para `scripts/discover-analogs.py`.
- **Aceptación:** `docs/contracts.md` documenta el contrato; `README.md` menciona el script y su salida.

### T5 — Panel UI mínimo · dueño: Frontend (depende de T2)
Página autocontenida, **sin tocar `mission.js`** (103 KB). Archivos nuevos `discovery.html` +
`discovery.js` (módulo ES); enlace desde el nav de `index.html` y `catalog.html`.
`discovery.js`:
- selector de objetivo → `fetch('assets/data/discovery/<targetId>.json')` + `fetch(target)`;
- por candidato: `compareTerrain(candidate, targetJson)` (import de `./similarity.mjs`) →
  pintar ranking, **índice autoritativo**, coordenadas, barras por componente (`components[].score`/
  `weight`) y los `caveats`;
- **solo `textContent`** para datos externos (regla de honestidad);
- reusar `styles.css`.
- **Archivos:** `discovery.html`, `discovery.js` (nuevos); enlace en `index.html`, `catalog.html`.
- **Aceptación:** `python3 -m http.server 8000` → `localhost:8000/discovery.html`, elegir
  `marius-hills` muestra 5 candidatos rankeados; el índice del panel coincide con `selectionIndex`
  del JSON (±1 por redondeo). Cada candidato muestra la nota "no es un sitio de ensayo publicado".

### T6 — Tests · dueño: Coordinación
- **JS** `tests/discovery.test.mjs` (`node --test`): cargar un fixture chico de discovery JSON,
  correr `compareTerrain` sobre sus candidatos, afirmar forma y que el orden por índice es
  descendente. Fija el valor esperado que T3 debe replicar.
- **Python:** cubierto por el self-check de T3 (sin red; `cell_centers` sobre una bbox conocida +
  `geo_index` vs valor esperado).
- **Archivos:** `tests/discovery.test.mjs` (nuevo), fixture en `tests/` o `assets/data/discovery/`.
- **Aceptación:** `npm test` en verde incluyendo el nuevo test.

## 5. Dependencias y orden sugerido

```
T1 ──▶ T2 ──▶ T5
        │
        ├─▶ T3 (self-check)
        └─▶ T6 (fija el valor esperado de T3)
T4 (en paralelo, cualquier momento)
```

## 6. Verificación de punta a punta

1. `.venv-data/bin/python scripts/discover-analogs.py marius-hills --region centroamerica-volcanic --top 5`
   → escribe `assets/data/discovery/marius-hills.json`, loguea `scannedCells` y Top-5; celdas
   fallidas se saltan sin abortar.
2. `.venv-data/bin/python scripts/discover-analogs.py --self-check` → OK.
3. `npm test` (incluye `tests/discovery.test.mjs`) en verde.
4. Panel: abrir `discovery.html`, objetivo `marius-hills` → 5 candidatos con índice recomputado por
   `compareTerrain`, coordenadas, desglose por componente y caveats; índice del panel ≈ `selectionIndex`.
5. Honestidad: cada candidato muestra "no es un sitio de ensayo publicado" y el `GEOMETRY_CAVEAT`.

## 7. Riesgos y límites

- **Costo del escaneo** (riesgo principal): un `warp()` remoto por celda. Mitigado con STAC por
  región (no por celda), GDAL range reads/VSI cache ya configurados, bboxes chicos, `--limit` y
  caché de métricas por celda. El primer paso de implementación debe **validar una región chica**
  antes de abrir a las tres.
- **Deriva Python↔JS:** el número visible sale de `compareTerrain`; `geo_index` solo ordena, con
  self-check cruzado (T3/T6).
- **Celdas sin DEM** (mar, borde de tesela): `fetch_dem`/`dem_window` ya lanzan en ventanas
  incompletas; el escaneo las salta.
- **Sin imagen/clima por candidato:** decisión explícita del MVP (solo geometría). Imagery S2,
  rugosidad S1 y amplitud térmica/aridez quedan como extensiones.

---

## 8. Iteración 2 — implementada

De "escaneo de cajas" a buscador sistemático y multidimensional. Contrato en `docs/contracts.md` §7.

- **Prefiltro global** — `scripts/prefilter-regions.py <target> [--step 1.0] [--top-regions 6] [--limit N]`:
  barre cinturones continentales (GLO-90 vía Open-Meteo Elevation), puntúa con el mismo `geo_index` y
  escribe `assets/data/discovery/regions-<target>.json` (regiones rankeadas a refinar).
- **Refinamiento auto + multi-escala** — `discover-analogs.py <target> --region auto --scales 2400,7200`:
  escanea las regiones elegidas, reevalúa un pool a cada escala y conserva la mejor (`scaleMeters`).
  `dem_window(lat, lon, items, extent=EXTENT)` parametriza la ventana (2400 m idéntico; `native_n`
  derivado de `extent`).
- **Térmica + aridez (ERA5)** — solo sobre el pool: `thermal {amplitudeK,minK,maxK,kind,source}` y
  `aridity {annualPrecipMm,class,source}` desde Open-Meteo Archive.
- **Índice + diversidad** — `similarity.mjs` suma la componente **amplitud térmica** (peso 0.15, con
  `THERMAL_CAVEAT`, activa solo si ambos lados la tienen); espejo en `geo_index`; selección final con
  **NMS** (`select_nms`, distancia mínima = escala base). Aridez = filtro/contexto, no puntúa.
- **Panel** — `discovery.js` muestra barra térmica (automática desde `compareTerrain`), insignia de
  aridez, `scaleMeters` y región de origen.
- **Tests** — `node --test`: térmica en `tests/similarity.test.mjs`, NMS/contrato en
  `tests/discovery.test.mjs` (49 en verde). Python: `discover-analogs.py --self-check` (geo_index =
  compareTerrain, térmica, NMS, aridez) corre **sin** `pyproj`.
- **Límites nuevos:** la térmica compara oscilación diurna de aire ERA5 (Tierra) vs superficie
  Diviner/MCD (objetivo) — proxy con caveat, premia mayor oscilación, no afirma equivalencia física
  (enlaza con Módulo 2). El prefiltro es una preselección orientativa (GLO-90), no una medición.
