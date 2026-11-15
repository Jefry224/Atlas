# A.R.E.S. Twin — contratos de integración

Fuente única de verdad entre los cinco frentes. Si un frente necesita cambiar un contrato, lo anota aquí en «Cambios» y lo avisa en su informe final; no cambia silenciosamente el formato.

Principio de honestidad (heredado del README): nada se presenta como «% de similitud planetaria» ni como «en vivo» si no lo es. Todo dato lleva `source`/`provenance`; todo valor de literatura o modelado se marca como tal (`kind`).

## 1. Escenarios — `assets/data/scenarios.json` (fijo)

Cuatro escenarios de la demo. Cada uno empareja un gemelo terrestre con un objetivo extraterrestre:

| id | Tierra (`earthId`) | Objetivo (`targetId`) | Cuerpo |
| --- | --- | --- | --- |
| `lava-tube` | `lanzarote` | `marius-hills` | moon |
| `polar-shadow` | `wright-valley` | `shackleton` | moon |
| `hyperarid-salt` | `atacama` | `jezero` | mars |
| `wind-canyon` | `wadi-rum` | `valles-marineris` | mars |

`wadi-rum` es un sitio solo de escenario: no se añade a `data.js` (el catálogo documental se mantiene en 14 sitios y sus tests).

## 2. Rejilla de terreno (Tierra y objetivos)

Archivos: `assets/data/scenarios/earth/<earthId>.json` y `assets/data/scenarios/targets/<targetId>.json`.

```jsonc
{
  "id": "atacama",                 // earthId o targetId
  "body": "earth",                 // "earth" | "moon" | "mars"
  "name": "Desierto de Atacama · Yungay",
  "center": [-24.102, -70.138],    // lat, lon planetocéntricos (este positivo)
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
    "live": true, "cached": false, "ageSeconds": 0, "fetchedAt":"ISO", "observationAgeSeconds":0,
    "values": { "solarRadiationWm2":0, "temperatureC":0, "windSpeedMs":0, "windGustMs":0, "relativeHumidityPct":0, "cloudCoverPct":0, "surfacePressurePa":null, "windDirDeg":0, "precipMm":0 },
    "source": { "label":"…", "url":"https://…" } }
  ```
  Caché en memoria de 10 min por (lat,lon redondeados a 0.01). Si el proveedor falla: último valor en caché o `assets/data/telemetry-snapshot.json` con `live:false, provider:"snapshot"`.
- `POST /api/copilot` body `{ "question": "…", "context": { …ver §5… } }` → `{ "answer":"texto en español", "provider":"gemini|anthropic", "model":"…", "grounded":["earth.telemetry.temperatureC", …], "generatedAt":"ISO", "disclaimer":"…" }`. Sin clave de IA configurada → **HTTP 503** `{ "error":"no-ai-provider" }` y el frontend usa `copilot-rules.mjs`.

Variables de entorno: `METEOMATICS_USERNAME`, `METEOMATICS_PASSWORD`, `GEMINI_API_KEY` (o `ANTHROPIC_API_KEY`), `ALLOWED_ORIGINS`.

`assets/data/telemetry-snapshot.json`: `{ "<siteId>": <respuesta de /api/telemetry> }` para los 14 sitios + `wadi-rum`. Lo usa el frontend cuando no hay backend (p. ej. GitHub Pages).

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
  "similarity": /* compareTerrain */,
  "analogyAudit": /* resumen módulo 2, §7; null si no disponible */,
  "processes": /* summarizeProcesses, §9; null si no disponible */ }
```

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

## 7. Módulo 2 — candidato, auditoría y dossier v1.0.0

Contrato aditivo implementado en `analog-audit.mjs`: `CandidateAnalogPayload` **1.0.0**, `AnalogAuditResult` **1.0.0** y `AnalogAuditDossier` **1.0.0**. [Esquema JSON del candidato](candidate-analog-payload.schema.json) y [uso, estructura de resultados, fórmulas, fuentes y límites](modulo-2.md). No reemplaza los JSON de escenarios/rejillas de §1–2 ni el índice de geometría.

- `buildCandidateAnalogPayload({scenario, earthGrid, targetGrid, telemetry})` conserva identidad, coordenadas, escala, métricas, térmica superficial, telemetría y procedencia. Cantidades: `{value,unit,kind,source,observedAt}`, ausencias `null`. Aire y superficie permanecen separados. Gravedades son referencias, presión terrestre no se infiere del texto de atmósfera, Luna 0 Pa es vacío ideal y Marte 636 Pa es referencia al radio medio, no dato del sitio.
- `auditAnalog(payload, inputs)` devuelve `matrix:[{id,label,status,strength,breakdown,action,evidence}]`, `counts`, `geometry`, `calibration`, `sources` y `limitations`. Estados `valid|partial|breakdown|unknown`, por alcance de fila; no porcentaje físico global. `calibration` contiene `valid`, errores por campo, `inputs` en SI, `kind:"user-assumption"`, `equipment`, `targetBody`, `gravity`, `pressure`, `thermal`, fórmulas y supuestos. Parámetros inválidos anulan sus resultados; parámetros ausentes quedan desconocidos.
- `createDossier` copia `{schema,version,exportedAt,candidate,audit,disclaimer}`; `dossierMarkdown` lo convierte a informe local con evidencia/fuentes. Exportación JSON de misión añade `analogyDossier` o `null`. No existe importación UI ni PDF en esta versión.
- Contexto §5 añade `analogyAudit:{version,scenarioId,counts,matrix:[{id,status,breakdown}],calibration,limitation}`. Calibración compacta: `{kind,equipment,targetBody,massKg,gravity,pressure,thermal}` o `null` si inválida. El cuerpo del cálculo puede ser hipotético y distinto del objetivo: no cambiar la identidad de la matriz. El LLM sigue siendo opcional; el copiloto local consume este resumen.
- El adaptador solo acepta presión terrestre en la extensión opcional explícita `telemetry.values.surfacePressurePa` (Pa absolutos a la superficie). Open-Meteo y Meteomatics la entregan cuando está disponible, con validación de unidades y respaldo sin presión opcional; nunca se convierte presión MSL. Telemetría de otro sitio se descarta. Las rejillas cruzadas invalidan la auditoría.

## Cambios

- Frente 5: `thermalStatus` sin temperatura devuelve `level:"unknown"` y `marginK:null` (cuarto nivel, como `slopeAlert`).
- Frente 5: `attitude` con rejilla inválida devuelve `{ pitchDeg:null, rollDeg:null }`; comprobar antes de formatear.
- Frente 1: campos aditivos `metrics.roughness.{stdDb, polarization, acquired, license, credit}`, `imagery.{product, acquired, sceneCloudCoverPct, windowCloudFraction}` y en raíz `license`, `demCredit`. La rugosidad Tierra (dB, S1 RTC) nunca coincide en unidad con Luna (CPR, Mini-RF), así que `compareTerrain` ya la excluye; no hace falta comparar polarización mientras no haya pares Tierra–Tierra.
- Frente 3: errores extra 503 `ai-provider-unavailable`/`telemetry-unavailable`, 429, 413, 422; caché vieja con `live:false, cached:true`; cualquier valor de `values` puede ser `null`.
- Frente 4: si `/api/health` da `ai:"none"`, el frontend no llama a `/api/copilot` y usa reglas locales.
- Frente 5: `compareTerrain` acepta una rejilla §2, el objeto de contexto §5 o un objeto `metrics` directamente.

- Módulo 2: extensión aditiva §7 con contrato v1.0.0, auditoría/cálculo JS puro, dossier JSON/Markdown y contexto `analogyAudit`; los contratos anteriores permanecen vigentes.


## 8. Recursos NASA y presentación M2

`assets/data/nasa-assets.json`: `NasaVisualAssets` **1.0.0**, `{schema,version,assets:[{id,label,body,role,localPath,format,sourceUrl,downloadUrl,credit,bytes,sha256,licenseUrl,notes,available}]}`. Siete IDs GLB obligatorios: `scarecrow`, `perseverance`, `moon`, `mars`, `lro`, `block-island`, `apollo-11`; texturas `moon-color`/`mars-color` adicionales. `available:false` es pendiente, nunca éxito de carga. Solo rutas bajo `assets/models/nasa/` o `assets/textures/nasa/`; GLB embebidos sin solicitudes externas. [Adquisición y metadatos](nasa-assets.md).

La UI añade opcionalmente `visualPresentation` al dossier/misión (`AnalogVisualPresentation` 1.0.0): `{schema,version,mode:"offload"|"equivalent",factor,roverReference,normalizedScale:true,scientificSource:false}`. Es metadata de presentación, no entrada de calibración ni extensión del contrato de servidor. `createDossier` puro sigue siendo independiente de escenas. El cuerpo, masa y resultados de `audit.calibration` conservan su significado original; la masa equivalente se deriva de su resultado `gravity.equivalentEarthMassKg` y no reemplaza `inputs.massKg`. [Modos, coordenadas y límites](modulo-2.md#banco-visual-3d-y-explorador-nasa).


## M2 automático, sesión y workbook

`rover-config.mjs` exporta `ROVER_CONFIG` (`id=atlas-prototype-v1`, `source=prototype-config`, `massKg=350`). Simulación y `automaticEngineering(candidate)` consumen esa fuente. `calibration.kind=mission-config` añade `origins` por variable (`mission-config/reference/idealization/weather-model/archive/missing`); la calculadora pura conserva `user-assumption`. Se mantiene CandidateAnalogPayload 1.0.0 con `scenario.focus` opcional; metadatos meteorológicos nuevos son aditivos.

Sesión: `{id, scenario, startedAt, endedAt, latest, rover[], weather[], events[], policy}`. Muestra rover `{utc, elapsed, x, z, heading, speed, distance, battery, latitude, longitude, slopeDeg, pitchDeg, rollDeg, loadW, solarW, kind:sim}`. `elapsed` usa segundos SIM ×20; UTC usa reloj real. Intervalo10s/max2160, clima256 (dedup sitio/proveedor/observedAt), eventos500, sesiones6; memoria sin persistencia al reload. Cambio/reinicio cierra y abre sesión. Muestras del escenario anterior y respuestas tardías nunca se añaden a la nueva sesión.

`missionWorkbook({cutoffUTC,candidate,audit,session,manifest})` escribe OOXML/ZIP STORE+CRC32 de 12 hojas sin fórmulas/código externo. El snapshot es copia aislada tomada al clic; el laboratorio manual no es fuente de los reportes ni del copiloto. Excel conserva fuentes y ausencias, cuerpos, coordenadas, resoluciones y fechas del DEM, observación/captura, unidad por variable, modelo/cache/archive/sim/unknown y las dos alternativas estáticas. Datos fuente faltantes nunca se sustituyen por hipótesis ocultas.

## 9. Módulo 3 · Procesos dinámicos

- `GET /api/processes/forecast?lat&lon&site` → `{ site, lat, lon, provider:"meteomatics|open-meteo|snapshot", live, cached, ageSeconds, fetchedAt, timezone, utcOffsetSeconds, hours:[{ time:"ISO UTC", tempC, groundTempC, windMs, gustMs, radiationWm2, rhPct, precipMm }], source }`. 72 horas, caché de 30 min por celda de 0,01°, respaldo en `assets/data/processes-forecast-snapshot.json` (`python -m server.forecast_snapshot`). Sin proveedor ni snapshot cercano → 503 `forecast-unavailable`.
- `processes.mjs` (puro, con tests): `analyzeProcesses(forecast, targetGrid)` → ventanas `thermal` (forma y fase de la curva diurna normalizada frente a `thermal.curve` del objetivo; nunca temperatura absoluta), `aeolian` (saltación: u* por perfil logarítmico, umbral 0,22 m/s, inhibida por humedad), `freeze` (cruces de 0 °C en superficie, rápidos si ≤ −1,5 °C/h en 3 h) y `cold` (mínimo térmico con la menor radiación; para objetivos lunares sin curva). `best` según el cuerpo del objetivo. `summarizeProcesses()` va al contexto del copiloto como `processes` (§5).
- `assets/data/processes/<earthId>.json`: serie Sentinel-1 RTC de 12 meses (misma órbita relativa), `series[{date, meanDb, deltaDb, changeFlag, precipMm}]`, `lastPairChangedFraction`, `method`, `interpretation` (`scripts/fetch-process-history.py`).
- RADARSAT-1/RCM no se usa: requiere cuenta EODMS; Sentinel-1 cubre la serie histórica sin credenciales.

## 10. Clima visual, simulación y entorno 3D

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

### MissionBaseProfile y representación XLSX

`mission-profiles.mjs` expone `BASE_PROFILE_VERSION`, `getMissionBaseProfile(scenarioOrId)` y `validateMissionBaseProfile(profile)`. Su esquema y sus cuatro IDs están documentados en [perfiles-base-m2.md](perfiles-base-m2.md). `missionDesignEngineering(candidate, profile?)` devuelve `{profile, calibration, scope, airSource}` y evalúa únicamente el banco propuesto, con gas a la temperatura de pared declarada. No modifica `automaticEngineering`, el candidato, la configuración del rover ni el historial.

Los snapshots de descarga y los dossiers JSON añaden `baseProfile` de forma compatible. El exportador permite snapshots previos sin ese campo, resuelve exclusivamente `candidate.scenario.id` y valida que un perfil adjunto pertenezca a la misión. Los valores ausentes del JSON canónico se mantienen como `null`; sus celdas XLSX contienen estado y causa, y ninguna ausencia se convierte en lectura cero. Las filas decorativas, fusiones y el espacio bajo el gráfico son vacíos estructurales; las regiones de datos rectangulares desde la fila 7 no admiten celdas vacías.

Los números térmicos base son setpoints del banco, sin fecha de observación; `revisionDate` fecha el perfil y no una lectura. Las observaciones meteorológicas disponibles conservan prioridad y su fecha/fuente. La columna de masa de instrumentos se expresa por unidad y con ámbito; los 350 kg del prototipo siguen siendo independientes de mallas NASA y de propuestas de componentes.
