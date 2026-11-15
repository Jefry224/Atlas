# Earth analogue expedition

Merzouga · Erg Chebbi · earth-fb69f6e0-11aa-4920-a822-2cdce44b5f05

Status: finished. Evidence cutoff: 2026-11-15T08:07:49.795Z (UTC). Exported: 2026-11-15T08:07:52.184Z (UTC).
Created: 2026-11-15T08:07:19.101Z; confirmed: 2026-11-15T08:07:32.356Z; started: 2026-11-15T08:07:34.797Z; finished: 2026-11-15T08:07:49.795Z.

## Operational objective

Prepare a Moon or Mars rover route reconnaissance method by comparing regional slopes and relief at two or more stops.
Equipment concept: Navigation camera. Payload: 12 kg (SIM).
Constraints: regional slope ≤ 15°; SIM energy allowance 20%.

## DEM evidence

Copernicus DEM 2021 GLO-90 · 9×9 nodes · 300 m spacing · 90 m native resolution · 2400 m window.
Source: https://open-meteo.com/en/docs/elevation-api. Acquired/fetched: 2026-11-14T16:39:57.412241+00:00. DEM identity: dem-fb4c171.
DEM centre: [31.073,-3.97]. Bounding box: [-3.982585642974629,31.06222026590011,-3.9574143570253715,31.083779734099892].

## Confirmed plan

| Stop | East x (m) | South z (m) |
| --- | ---: | ---: |
| 1. Baseline context | 0.0 | 0.0 |
| 2. Terrain contrast | 300.0 | 0.0 |

Drive estimate: 300.0 m; 0.81% energy; max regional slope 0.7°.

## Inspected stops

| Stop | UTC | SIM s | Approx. latitude, longitude | DEM elevation (m) | DEM slope (°) | Battery (%) |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| 1. Baseline context | 2026-11-15T08:07:37.312Z | 0.0 | 31.073000, -3.970000 | 706.0 | 0.7 | 100.0 |

Stop 1: 0.7° regional slope, 706.0 m DEM elevation. Regional terrain variation and a repeatable remote reconnaissance workflow.
Operator note: none.
Environment (site/window context): {"kind":"archived-weather-model","siteId":"merzouga","location":{"lat":31.073,"lon":-3.97},"provider":"snapshot","live":false,"source":{"label":"Instantánea de Open-Meteo Forecast API («current», modelo) tomada el 2026-11-15T02:10:10Z; no es en vivo","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T02:00:00Z","provenance":null,"values":{"temperatureC":17.3,"windSpeedMs":0.7,"windGustMs":1,"solarRadiationWm2":0,"relativeHumidityPct":61,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

## Run observations (SIM)

7.1 m travelled; 121.4 SIM s at ×20; 0.08% modeled energy used; observed max regional slope 0.7°.
Run elevation range: 706.0–706.0 m.

## Planetary reference

No paired benchmark.
No paired planetary benchmark is published for this catalogue site. Select a documented reference before making a quantitative comparison.
Topography index: unavailable/100; scale comparable: false.
Target DEM source: unavailable; spacing unavailable m; native resolution unavailable m.
Comparison components: [].
Published Earth metrics: null.

## Decision

Revise the reconnaissance plan
1/2 planned stops inspected; coverage is incomplete. Complete or revise the traverse before advancing.

Strengths:
- Regional terrain variation and a repeatable remote reconnaissance workflow.
- Source-linked regional DEM and traceable stop coordinates.

Breakdowns:
- Wheel traction, bearing capacity, small obstacles and autonomous perception require field measurements.
- DEM elevations and slopes describe regional terrain; interpolation adds no detail. No sub-DEM rocks, safe zones or soil measurements are inferred.
- Comparable topography is not planetary similarity or field feasibility. Earth gravity, atmosphere, radiation, water and biology differ from Moon and Mars conditions.
- Rover motion, payload activity and battery use are illustrative SIM models; no spacecraft descent or target telemetry is generated.

Next validation actions:
- Review the uninspected legs, revise constraints or acquire missing terrain data, then repeat the campaign.
- Choose an independently documented planetary reference and audit scale, geology and environmental differences.
- Confirm permits, access, field safety and instrument calibration with local specialists.

## Sources and limitations

- LAAS-CNRS · Datos de campo de Erfoud: https://sites.laas.fr/projects/erfoud-dataset/sites.laas.fr/projects/erfoud-dataset/index.html
- ESA · Pruebas de rovers en Marruecos: https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Self-driving_rovers_tested_in_Mars-like_Morocco
- An Earth remote reconnaissance simulation, not a field visit or mission certification.
- DEM elevations and slopes describe regional terrain; interpolation adds no detail. No sub-DEM rocks, safe zones or soil measurements are inferred.
- Comparable topography is not planetary similarity or field feasibility. Earth gravity, atmosphere, radiation, water and biology differ from Moon and Mars conditions.
- Rover motion, payload activity and battery use are illustrative SIM models; no spacecraft descent or target telemetry is generated.
- Stop arrival tolerance (5 m) is a simulated position threshold, not DEM accuracy or an instrument footprint.

Percent-per-SIM-second: (moving ? 0.0018 : 0.0004) × (1 + payloadKg/100) × (1 + slopeDeg/30) + (mobility ? 0.0001 : 0.0003). No solar recharge; uncalibrated editorial model. Drive-only estimate excludes operator dwell and instrument analysis.
The trace retains the latest 1500 positions sampled about every 8 m and the latest 100 session events; total SIM distance and elapsed time cover the full run. Trace sampling is not DEM resolution.

Site/window environmental context: {"kind":"archived-weather-model","siteId":"merzouga","location":{"lat":31.073,"lon":-3.97},"provider":"snapshot","live":false,"source":{"label":"Instantánea de Open-Meteo Forecast API («current», modelo) tomada el 2026-11-15T02:10:10Z; no es en vivo","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T02:00:00Z","provenance":null,"values":{"temperatureC":17.3,"windSpeedMs":0.7,"windGustMs":1,"solarRadiationWm2":0,"relativeHumidityPct":61,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

DEM notes (inherited source language):

DEM provenance:

## Session events (UTC and SIM)

- 2026-11-15T08:07:32.356Z · SIM 0.0 s · preparation-confirmed: Objective, load, DEM and traverse explicitly reviewed.
- 2026-11-15T08:07:34.797Z · SIM 0.0 s · resume: At planned stop; inspect before continuing.
- 2026-11-15T08:07:37.312Z · SIM 0.0 s · inspection: Stop 1: DEM evidence recorded; no material measurement.
- 2026-11-15T08:07:39.762Z · SIM 0.0 s · pilot-mode: manual
- 2026-11-15T08:07:40.970Z · SIM 0.0 s · resume: Following the confirmed Earth traverse.
- 2026-11-15T08:07:46.249Z · SIM 121.4 s · pause: Operator pause
- 2026-11-15T08:07:49.795Z · SIM 121.4 s · finished: Evidence closed for decision review.
