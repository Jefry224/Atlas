# Earth analogue expedition

Pampa de La Joya · earth-06f77be9-f429-4050-8681-700b3c9bc3d9

Status: finished. Exported: 2026-11-15T07:48:38.453Z (UTC).
Created: 2026-11-15T07:31:59.932Z; confirmed: 2026-11-15T07:36:32.088Z; started: 2026-11-15T07:37:03.810Z; finished: 2026-11-15T07:46:32.621Z.

## Operational objective

Prepare a Moon or Mars rover route reconnaissance method by comparing regional slopes and relief at two or more stops.
Equipment concept: Navigation camera. Payload: 12 kg (SIM).
Constraints: regional slope ≤ 15°; SIM energy allowance 20%.

## DEM evidence

Copernicus DEM 2021 GLO-90 · 9×9 nodes · 300 m spacing · 90 m native resolution · 2400 m window.
Source: https://open-meteo.com/en/docs/elevation-api. Acquired/fetched: 2026-11-14T16:40:11.300057+00:00. DEM identity: dem-d82c2809.
DEM centre: [-16.7,-72.017]. Bounding box: [-72.0282544173455,-16.71077973409989,-72.0057455826545,-16.689220265900108].

## Confirmed plan

| Stop | East x (m) | South z (m) |
| --- | ---: | ---: |
| 1. Baseline context | 0.0 | 0.0 |
| 2. Terrain contrast | 300.0 | -300.0 |

Drive estimate: 424.3 m; 1.20% energy; max regional slope 2.2°.

## Inspected stops

| Stop | UTC | SIM s | Approx. latitude, longitude | DEM elevation (m) | DEM slope (°) | Battery (%) |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| 1. Baseline context | 2026-11-15T07:38:53.706Z | 0.0 | -16.700000, -72.017000 | 1111.0 | 1.4 | 100.0 |
| 2. Terrain contrast | 2026-11-15T07:44:50.912Z | 524.3 | -16.697336, -72.014218 | 1122.9 | 1.6 | 98.8 |

Stop 1: 1.4° regional slope, 1111.0 m DEM elevation. Regional terrain variation and a repeatable remote reconnaissance workflow.
Operator note: Coordinator QA: regional DEM context only; no field instrument measurement..
Environment (site/window context): {"kind":"archived-weather-model","siteId":"pampa-joya","location":{"lat":-16.7,"lon":-72.017},"provider":"snapshot","live":false,"source":{"label":"Instantánea de Open-Meteo Forecast API («current», modelo) tomada el 2026-11-15T02:10:10Z; no es en vivo","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T02:00:00Z","provenance":null,"values":{"temperatureC":21.7,"windSpeedMs":1.8,"windGustMs":3.2,"solarRadiationWm2":0,"relativeHumidityPct":65,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

Stop 2: 1.6° regional slope, 1122.9 m DEM elevation. Regional terrain variation and a repeatable remote reconnaissance workflow.
Operator note: none.
Environment (site/window context): {"kind":"archived-weather-model","siteId":"pampa-joya","location":{"lat":-16.7,"lon":-72.017},"provider":"snapshot","live":false,"source":{"label":"Instantánea de Open-Meteo Forecast API («current», modelo) tomada el 2026-11-15T02:10:10Z; no es en vivo","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T02:00:00Z","provenance":null,"values":{"temperatureC":21.7,"windSpeedMs":1.8,"windGustMs":3.2,"solarRadiationWm2":0,"relativeHumidityPct":65,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

## Run observations (SIM)

419.4 m travelled; 524.3 SIM s at ×20; 1.17% modeled energy used; observed max regional slope 2.2°.
Run elevation range: 1111.0–1122.9 m.

## Planetary reference

No paired benchmark.
No paired planetary benchmark is published for this catalogue site. Select a documented reference before making a quantitative comparison.
Topography index: unavailable/100; scale comparable: false.
Target DEM source: unavailable; spacing unavailable m; native resolution unavailable m.
Comparison components: [].
Published Earth metrics: null.

## Decision

Advance to targeted validation
2/2 planned stops inspected in SIM. Regional terrain variation and a repeatable remote reconnaissance workflow.

Strengths:
- Regional terrain variation and a repeatable remote reconnaissance workflow.
- Source-linked regional DEM and traceable stop coordinates.

Breakdowns:
- Wheel traction, bearing capacity, small obstacles and autonomous perception require field measurements.
- DEM elevations and slopes describe regional terrain; interpolation adds no detail. No sub-DEM rocks, safe zones or soil measurements are inferred.
- Comparable topography is not planetary similarity or field feasibility. Earth gravity, atmosphere, radiation, water and biology differ from Moon and Mars conditions.
- Rover motion, payload activity and battery use are illustrative SIM models; no spacecraft descent or target telemetry is generated.

Next validation actions:
- Acquire rover-scale stereo or lidar and measure traction before choosing a field traverse.
- Choose an independently documented planetary reference and audit scale, geology and environmental differences.
- Confirm permits, access, field safety and instrument calibration with local specialists.

## Sources and limitations

- The Journal of Geology · Barjanes del sur de Perú: https://doi.org/10.1086/626622
- MINCETUR · Pampas de La Joya: https://consultasenlinea.mincetur.gob.pe/fichaInventario/index.aspx?cod_Ficha=12309
- An Earth remote reconnaissance simulation, not a field visit or mission certification.
- DEM elevations and slopes describe regional terrain; interpolation adds no detail. No sub-DEM rocks, safe zones or soil measurements are inferred.
- Comparable topography is not planetary similarity or field feasibility. Earth gravity, atmosphere, radiation, water and biology differ from Moon and Mars conditions.
- Rover motion, payload activity and battery use are illustrative SIM models; no spacecraft descent or target telemetry is generated.
- Stop arrival tolerance (5 m) is a simulated position threshold, not DEM accuracy or an instrument footprint.

Percent-per-SIM-second: (moving ? 0.0018 : 0.0004) × (1 + payloadKg/100) × (1 + slopeDeg/30) + (mobility ? 0.0001 : 0.0003). No solar recharge; uncalibrated editorial model. Drive-only estimate excludes operator dwell and instrument analysis.

Site/window environmental context: {"kind":"archived-weather-model","siteId":"pampa-joya","location":{"lat":-16.7,"lon":-72.017},"provider":"snapshot","live":false,"source":{"label":"Instantánea de Open-Meteo Forecast API («current», modelo) tomada el 2026-11-15T02:10:10Z; no es en vivo","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T02:00:00Z","provenance":null,"values":{"temperatureC":21.7,"windSpeedMs":1.8,"windGustMs":3.2,"solarRadiationWm2":0,"relativeHumidityPct":65,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

DEM notes (inherited source language):

DEM provenance:

## Session events (UTC and SIM)

- 2026-11-15T07:36:32.088Z · SIM 0.0 s · preparation-confirmed: Objective, load, DEM and traverse explicitly reviewed.
- 2026-11-15T07:37:03.810Z · SIM 0.0 s · resume: At planned stop; inspect before continuing.
- 2026-11-15T07:38:53.706Z · SIM 0.0 s · inspection: Stop 1: DEM evidence recorded; no material measurement.
- 2026-11-15T07:40:30.339Z · SIM 0.0 s · resume: Following the confirmed Earth traverse.
- 2026-11-15T07:44:22.153Z · SIM 524.3 s · arrived: Stop 2
- 2026-11-15T07:44:50.912Z · SIM 524.3 s · inspection: Stop 2: DEM evidence recorded; no material measurement.
- 2026-11-15T07:46:32.621Z · SIM 524.3 s · finished: Evidence closed for decision review.
