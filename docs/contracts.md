# A.R.E.S. Twin — contratos de integración

Fuente única de verdad entre los cinco frentes. Si un frente necesita cambiar un contrato, lo anota aquí en «Cambios» y lo avisa en su informe final; no cambia silenciosamente el formato.

Principio de honestidad (heredado del README): nada se presenta como «% de similitud planetaria» ni como «en vivo» si no lo es. Todo dato lleva `source`/`provenance`; todo valor de literatura o modelado se marca como tal (`kind`).

## 1. Escenarios — `assets/data/scenarios.json` (fijo)

Cuatro escenarios de la demo. Cada uno empareja un gemelo terrestre con un objetivo extraterrestre:

| id | Tierra (`earthId`) | Objetivo (`targetId`) | Cuerpo |
| --- | --- | --- | --- |
| `lava-tube` | `la-corona` | `marius-hills` | moon |
| `polar-shadow` | `wright-valley` | `shackleton` | moon |
| `hyperarid-salt` | `atacama` | `jezero` | mars |
| `wind-canyon` | `wadi-rum` | `valles-marineris` | mars |

`wadi-rum` y `la-corona` son sitios solo de escenario: no se añaden a `data.js` (el catálogo documental se mantiene en 14 sitios y sus tests). `la-corona` sustituye a Caldera Blanca (`lanzarote`, que sigue en el catálogo) porque esa ventana caía sobre el borde de un cráter (pendiente p90 31°) y no sobre un campo de lava con tubo.

### 1.1 Elección de ventanas y correspondencia entre cuerpos

La correspondencia entre una ventana terrestre y una extraterrestre se mide siempre con la misma receta: ventana de 2400 m, rejilla 65×65 a 37.5 m (fila 0 = norte), métricas de `scripts/terrain_metrics.py` e índice de `similarity.mjs`. `terrain_metrics.geometric_index` replica ese índice en Python (sin rugosidad) y `tests/analog-match.test.mjs` comprueba que ambos dan el mismo entero.

`scripts/analog_match.py` busca, alrededor de un punto de referencia, la ventana con mayor índice frente a una referencia:

- `earth --lat --lon --ref <rejilla>`: ventanas de GLO-30 (30 m remuestreado a 37.5 m) en la Tierra; descarta ventanas con mar o sin dato (GLO-30 rellena el mar con 0 m).
- `target --id <targetId> --ref <rejilla>`: ventanas del DEM nativo del objetivo (`fetch-targets.py`), remuestreado al mismo paso.

Los centros terrestres de los cuatro escenarios salen de esa búsqueda a pocos km de un punto de referencia documentado, que queda en `anchor` de la rejilla; el centro elegido no es un punto de ensayo publicado. Una selección manual de área debe usar esta misma receta (misma extensión, paso, orientación, métricas y exclusión de nodata) para que su índice sea comparable con el de los escenarios. El índice solo mide geometría: no sustituye a la temperatura, iluminación, atmósfera ni a la resolución nativa (`comparable`).

## 2. Rejilla de terreno (Tierra y objetivos)

Archivos: `assets/data/scenarios/earth/<earthId>.json` y `assets/data/scenarios/targets/<targetId>.json`.

```jsonc
{
  "id": "atacama",                 // earthId o targetId
  "body": "earth",                 // "earth" | "moon" | "mars"
  "name": "Desierto de Atacama · Yungay",
  "center": [-24.10945, -70.10923], // lat, lon planetocéntricos (este positivo)
  "anchor": { "center": [-24.102, -70.138], "label": "data.js (ARADS)" },  // solo Tierra: punto de referencia documentado (§1.1)
  "gridSize": 65,                  // N, rejilla N×N
  "spacingMeters": 37.5,           // separación métrica entre nodos
  "extentMeters": 2400,            // (N-1)·spacing
  "elevation": [/* N*N metros, fila 0 = NORTE, columna 0 = OESTE (row-major) */],
  "imagery": { "path": "assets/data/scenarios/earth/atacama.jpg", "credit": "…", "license": "…", "source": "…" } ,  // o null
  "dataset": "Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)",
  "nativeResolutionMeters": 30,
  "source": "https://…",
  "fetchedAt": "ISO-8601",
  "metrics": {                     // calculadas con scripts/terrain_metrics.py SOBRE ESTA REJILLA
    "slopeP50Deg": 0, "slopeP90Deg": 0, "reliefP95P5M": 0, "triMeanM": 0,
    "comparable": true,            // false si la resolución nativa > 2× spacingMeters (dato interpolado)
    "roughness": { "value": 0, "unit": "dB | CPR | …", "method": "…", "source": "…" }  // o null
  },
  "thermal": {                     // o null
    "kind": "live | diviner | literature | model",
    "minK": 0, "maxK": 0, "meanK": 0,
    "curve": [{ "hourLocal": 0, "tempK": 0 }],   // o null
    "source": "…"
  },
  "environment": { "gravityMs2": 9.81, "solarConstantWm2": 1361, "atmosphere": "…", "dayLengthHours": 24 },
  "provenance": [{ "label": "…", "url": "https://…" }],
  "notes": ["limitaciones en español"]
}
```

Ventana estándar de comparación: **2400 m × 2400 m, 65×65 nodos a 37.5 m**. Si el producto nativo es más grueso (p. ej. MOLA 463 m), se remuestrea igualmente pero `metrics.comparable=false` y se explica en `notes`.

## 3. API del backend (FastAPI, `server/`)

Todo bajo el mismo origen que los estáticos (el contenedor sirve el repo en `/`).

- `GET /api/health` → `{ "status":"ok", "version":"2.0.0", "providers": { "weather":"meteomatics|open-meteo", "ai":"gemini|anthropic|none" } }`
- `GET /api/telemetry?lat=<f>&lon=<f>&site=<id>` →
  ```jsonc
  { "site":"atacama", "lat":-24.1, "lon":-70.1, "observedAt":"ISO", "provider":"meteomatics|open-meteo|snapshot",
    "live": true, "cached": false, "ageSeconds": 0,
    "values": { "solarRadiationWm2":0, "temperatureC":0, "windSpeedMs":0, "windGustMs":0, "relativeHumidityPct":0, "cloudCoverPct":0 },
    "source": { "label":"…", "url":"https://…" } }
  ```
  Caché en memoria de 10 min por (lat,lon redondeados a 0.01). Si el proveedor falla: último valor en caché o `assets/data/telemetry-snapshot.json` con `live:false, provider:"snapshot"`.
- `POST /api/copilot` body `{ "question": "…", "context": { …ver §5… } }` → `{ "answer":"texto en español", "provider":"gemini|anthropic", "model":"…", "grounded":["earth.telemetry.temperatureC", …], "generatedAt":"ISO", "disclaimer":"…" }`. Sin clave de IA configurada → **HTTP 503** `{ "error":"no-ai-provider" }` y el frontend usa `copilot-rules.mjs`.

Variables de entorno: `METEOMATICS_USERNAME`, `METEOMATICS_PASSWORD`, `GEMINI_API_KEY` (o `ANTHROPIC_API_KEY`), `ALLOWED_ORIGINS`.

`assets/data/telemetry-snapshot.json`: `{ "<siteId>": <respuesta de /api/telemetry> }` para los 14 sitios + `wadi-rum` y `la-corona`. Lo usa el frontend cuando no hay backend (p. ej. GitHub Pages).

## 4. Módulos JS puros (sin DOM, con tests `node --test`)

`sim-physics.mjs`
- `BODY_ENV[body]` → `{ gravityMs2, solarConstantWm2, dayLengthHours, atmosphere }` para earth/moon/mars.
- `attitude(grid, x, z, headingDeg)` → `{ pitchDeg, rollDeg }` (usa `sampleHeight` de `mission-math.mjs`; positivo = morro arriba / inclinado a la derecha).
- `solarPowerW({ irradianceWm2, panelAreaM2=2, efficiency=0.28, tiltDeg=0 })` → W.
- `batteryStep({ batteryPct, capacityWh=1000, solarW, loadW, dtSeconds })` → nuevo %.
- `driveLoadW({ speedMs, slopeDeg, gravityMs2, massKg=350 })` → W.
- `thermalStatus({ ambientK, minOpK=233, maxOpK=323 })` → `{ level:"nominal|caution|critical", marginK, text }`.

`similarity.mjs`
- `compareTerrain(earth, target)` → `{ index: 0-100 | null, comparable, components:[{ key, label, earth, target, score, weight }], caveats:[…] }` usando solo `metrics` medidas (pendiente p50/p90, desnivel, TRI, rugosidad si ambas existen). `index` es «índice de similitud geométrica», nunca «similitud planetaria». `null` si faltan métricas.

`copilot-rules.mjs`
- `answerLocally(question, context)` → misma forma que `/api/copilot` con `provider:"rules"`.

## 5. Contexto del copiloto (lo arma `mission.js`)

```jsonc
{ "scenario": { "id", "title", "focus" },
  "earth":  { "id", "name", "metrics", "telemetry": /* respuesta §3 */, "thermal" },
  "target": { "id", "name", "body", "metrics", "thermal", "environment" },
  "rover":  { "pitchDeg", "rollDeg", "batteryPct", "solarW", "slopeDeg", "thermal": /* thermalStatus */ },
  "similarity": /* compareTerrain */ }
```

## 7. Módulo 3 · Procesos dinámicos (rama `feature/modulo-3-procesos`)

- `GET /api/processes/forecast?lat&lon&site` → `{ site, lat, lon, provider:"meteomatics|open-meteo|snapshot", live, cached, ageSeconds, fetchedAt, timezone, utcOffsetSeconds, hours:[{ time:"ISO UTC", tempC, groundTempC, windMs, gustMs, radiationWm2, rhPct, precipMm }], source }`. 72 horas, caché de 30 min por celda de 0,01°, respaldo en `assets/data/processes-forecast-snapshot.json` (`python -m server.forecast_snapshot`). Sin proveedor ni snapshot cercano → 503 `forecast-unavailable`.
- `processes.mjs` (puro, con tests): `analyzeProcesses(forecast, targetGrid)` → ventanas `thermal` (forma y fase de la curva diurna normalizada frente a `thermal.curve` del objetivo; nunca temperatura absoluta), `aeolian` (saltación: u* por perfil logarítmico, umbral 0,22 m/s, inhibida por humedad), `freeze` (cruces de 0 °C en superficie, rápidos si ≤ −1,5 °C/h en 3 h) y `cold` (mínimo térmico con la menor radiación; para objetivos lunares sin curva). `best` según el cuerpo del objetivo. `summarizeProcesses()` va al contexto del copiloto como `processes` (§5).
- `assets/data/processes/<earthId>.json`: serie Sentinel-1 RTC de 12 meses (misma órbita relativa), `series[{date, meanDb, deltaDb, changeFlag, precipMm}]`, `lastPairChangedFraction`, `method`, `interpretation` (`scripts/fetch-process-history.py`).
- RADARSAT-1/RCM no se usa: requiere cuenta EODMS; Sentinel-1 cubre la serie histórica sin credenciales.

## 8. Clima visual, simulación y entorno 3D (rama `feature/modulo-3-procesos`)

`WeatherState` (lo produce `weather-sim.mjs` a partir de la telemetría real o de una simulación; lo consume `scene-fx.mjs`):

```jsonc
{ "source": "live|snapshot|simulated", "label": "Tormenta de polvo regional",
  "tempC": 0, "rhPct": 0, "windMs": 0, "gustMs": 0, "windDirDeg": 0,   // dirección DE DONDE sopla, meteorológica
  "cloudPct": 0, "rainMmH": 0, "snow": false,
  "dustTau": 0.3,            // profundidad óptica del aire (Tierra despejada ~0,05–0,2; Marte normal ~0,5; tormenta global 3–10)
  "visibilityKm": 30, "solarFactor": 1 }  // fracción de irradiancia que llega al panel respecto a cielo limpio
```

Escena (unidades de `mission.js`): `U = 0.1` unidades por metro, relieve exagerado `EXAG = 2`, la ventana 2400 m mide 240 unidades centrada en el origen, eje x = este, z = sur, y = arriba; altura de un punto = `(h − base) · EXAG · U`.

Contexto ampliado: `assets/data/scenarios/context/<id>.json` (+ `.jpg`) con el mismo esquema de rejilla §2, ventana mayor (≈ 12–20 km) y menor resolución, misma convención fila 0 = norte. Se dibuja alrededor de la ventana medida como «contexto de menor resolución», nunca como dato medido de la ventana.

## 6. Propiedad de archivos (trabajo en paralelo)

| Frente | Archivos |
| --- | --- |
| 1 Datos Tierra | `scripts/fetch-scenarios-earth.py`, `assets/data/scenarios/earth/**` |
| 2 Datos Luna/Marte | `scripts/fetch-targets.py`, `assets/data/scenarios/targets/**`, `docs/targets-sources.md` |
| 3 Backend/infra | `server/**`, `Dockerfile`, `.dockerignore`, `scripts/deploy-cloudrun.sh`, `assets/data/telemetry-snapshot.json`, `.gitignore` |
| 4 Frontend 3D/HUD | `index.html`, `styles.css`, `mission.js`, `mission-math.mjs`, `app.js`, `tests/mission-math.test.mjs`, `tests/responsive-preview.html` |
| 5 Simulación/IA local/pitch | `sim-physics.mjs`, `similarity.mjs`, `copilot-rules.mjs`, `tests/sim-physics.test.mjs`, `tests/similarity.test.mjs`, `tests/copilot-rules.test.mjs`, `package.json`, `docs/pitch.md`, `docs/demo-script.md` |
| Coordinación | `docs/contracts.md`, `assets/data/scenarios.json`, `scripts/terrain_metrics.py`, `README.md`, `docs/qa.md` |

Nadie hace commits; la coordinación integra y verifica al final.

## Cambios

- Frente 5: `thermalStatus` sin temperatura devuelve `level:"unknown"` y `marginK:null` (cuarto nivel, como `slopeAlert`).
- Frente 5: `attitude` con rejilla inválida devuelve `{ pitchDeg:null, rollDeg:null }`; comprobar antes de formatear.
- Frente 1: campos aditivos `metrics.roughness.{stdDb, polarization, acquired, license, credit}`, `imagery.{product, acquired, sceneCloudCoverPct, windowCloudFraction}` y en raíz `license`, `demCredit`. La rugosidad Tierra (dB, S1 RTC) nunca coincide en unidad con Luna (CPR, Mini-RF), así que `compareTerrain` ya la excluye; no hace falta comparar polarización mientras no haya pares Tierra–Tierra.
- Frente 3: errores extra 503 `ai-provider-unavailable`/`telemetry-unavailable`, 429, 413, 422; caché vieja con `live:false, cached:true`; cualquier valor de `values` puede ser `null`.
- Frente 4: si `/api/health` da `ai:"none"`, el frontend no llama a `/api/copilot` y usa reglas locales.
- Frente 5: `compareTerrain` acepta una rejilla §2, el objeto de contexto §5 o un objeto `metrics` directamente.
