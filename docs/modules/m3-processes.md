# Módulo 3 · Procesos dinámicos, clima visual y escena 3D

Contratos compartidos (API base, módulos puros, contexto copiloto): [`../contracts.md`](../contracts.md).

## API de pronóstico

- `GET /api/processes/forecast?lat&lon&site` → `{ site, lat, lon, provider:"meteomatics|open-meteo|snapshot", live, cached, ageSeconds, fetchedAt, timezone, utcOffsetSeconds, hours:[{ time:"ISO UTC", tempC, groundTempC, windMs, gustMs, radiationWm2, rhPct, precipMm }], source }`. 72 horas, caché de 30 min por celda de 0,01°, respaldo en `assets/data/processes-forecast-snapshot.json` (`python -m server.forecast_snapshot`). Sin proveedor ni snapshot cercano → 503 `forecast-unavailable`.

## Módulos JS

- `processes.mjs` (puro, con tests): `analyzeProcesses(forecast, targetGrid)` → ventanas `thermal` (forma y fase de la curva diurna normalizada frente a `thermal.curve` del objetivo; nunca temperatura absoluta), `aeolian` (saltación: u* por perfil logarítmico, umbral 0,22 m/s, inhibida por humedad), `freeze` (cruces de 0 °C en superficie, rápidos si ≤ −1,5 °C/h en 3 h) y `cold` (mínimo térmico con la menor radiación; para objetivos lunares sin curva). `best` según el cuerpo del objetivo. `summarizeProcesses()` va al contexto del copiloto como `processes` (contexto §5 en `contracts.md`).
- `assets/data/processes/<earthId>.json`: serie Sentinel-1 RTC de 12 meses (misma órbita relativa), `series[{date, meanDb, deltaDb, changeFlag, precipMm}]`, `lastPairChangedFraction`, `method`, `interpretation` (`scripts/fetch-process-history.py`).
- RADARSAT-1/RCM no se usa: requiere cuenta EODMS; Sentinel-1 cubre la serie histórica sin credenciales.

## Clima visual, simulación y entorno 3D

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