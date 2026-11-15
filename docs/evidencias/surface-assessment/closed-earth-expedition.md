# Earth analogue expedition

Pampa de La Joya · earth-b706c553-168b-4fdf-b768-71894760cc47

Status: finished. Evidence cutoff: 2026-11-15T16:15:40.720Z (UTC). Exported: 2026-11-15T16:15:42.641Z (UTC).
Created: 2026-11-15T16:15:10.702Z; confirmed: 2026-11-15T16:15:37.870Z; started: 2026-11-15T16:15:38.824Z; finished: 2026-11-15T16:15:40.720Z.

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
| 1. Baseline context | 2026-11-15T16:15:39.749Z | 0.0 | -16.700000, -72.017000 | 1111.0 | 1.4 | 100.0 |

Stop 1: 1.4° regional slope, 1111.0 m DEM elevation. Regional terrain variation and a repeatable remote reconnaissance workflow.
Operator note: none.
Environment (site/window context): {"kind":"archived-weather-model","siteId":"pampa-joya","location":{"lat":-16.7,"lon":-72.017},"provider":"snapshot","live":false,"source":{"label":"Instantánea de Open-Meteo Forecast API («current», modelo) tomada el 2026-11-15T02:10:10Z; no es en vivo","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T02:00:00Z","provenance":null,"values":{"temperatureC":21.7,"windSpeedMs":1.8,"windGustMs":3.2,"solarRadiationWm2":0,"relativeHumidityPct":65,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

## Run observations (SIM)

0.0 m travelled; 0.0 SIM s at ×20; 0.00% modeled energy used; observed max regional slope 1.4°.
Run elevation range: 1111.0–1111.0 m.

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

- The Journal of Geology · Barjanes del sur de Perú: https://doi.org/10.1086/626622
- MINCETUR · Pampas de La Joya: https://consultasenlinea.mincetur.gob.pe/fichaInventario/index.aspx?cod_Ficha=12309
- An Earth remote reconnaissance simulation, not a field visit or mission certification.
- DEM elevations and slopes describe regional terrain; interpolation adds no detail. No sub-DEM rocks, safe zones or soil measurements are inferred.
- Comparable topography is not planetary similarity or field feasibility. Earth gravity, atmosphere, radiation, water and biology differ from Moon and Mars conditions.
- Rover motion, payload activity and battery use are illustrative SIM models; no spacecraft descent or target telemetry is generated.
- Stop arrival tolerance (5 m) is a simulated position threshold, not DEM accuracy or an instrument footprint.

Percent-per-SIM-second: (moving ? 0.0018 : 0.0004) × (1 + payloadKg/100) × (1 + slopeDeg/30) + (mobility ? 0.0001 : 0.0003). No solar recharge; uncalibrated editorial model. Drive-only estimate excludes operator dwell and instrument analysis.
The trace retains the latest 1500 positions sampled about every 8 m and the latest 100 session events; total SIM distance and elapsed time cover the full run. Trace sampling is not DEM resolution.

Site/window environmental context: {"kind":"archived-weather-model","siteId":"pampa-joya","location":{"lat":-16.7,"lon":-72.017},"provider":"snapshot","live":false,"source":{"label":"Instantánea de Open-Meteo Forecast API («current», modelo) tomada el 2026-11-15T02:10:10Z; no es en vivo","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T02:00:00Z","provenance":null,"values":{"temperatureC":21.7,"windSpeedMs":1.8,"windGustMs":3.2,"solarRadiationWm2":0,"relativeHumidityPct":65,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

DEM notes (inherited source language):

DEM provenance:

## Session events (UTC and SIM)

- 2026-11-15T16:15:37.870Z · SIM 0.0 s · preparation-confirmed: Objective, load, DEM and traverse explicitly reviewed.
- 2026-11-15T16:15:38.824Z · SIM 0.0 s · resume: At planned stop; inspect before continuing.
- 2026-11-15T16:15:39.749Z · SIM 0.0 s · inspection: Stop 1: DEM evidence recorded; no material measurement.
- 2026-11-15T16:15:40.720Z · SIM 0.0 s · finished: Evidence closed for decision review.


# Rocks and cavities · planning assessment

Context: Pampa de La Joya · earth · earth-b706c553-168b-4fdf-b768-71894760cc47 · earth:pampa-joya:earth-b706c553-168b-4fdf-b768-71894760cc47:dem-d82c2809
Evidence cutoff: 2026-11-15T16:15:40.719Z. DEM: https://open-meteo.com/en/docs/elevation-api.

## Rock hypothesis
Ellipsoid envelope: V = pi × length × width × height / 6; mass = volume × assumed density. Axes are full diameters.
Axes: 2 × 0.8 × 0.5 m. Assumed axis uncertainty: 20%.
Volume: 0.418879 m³; conditional range 0.214466–0.723823 m³.
Assumed density: 2600–3200 kg/m³. Conditional mass: 557.612–2316.23 kg.
Weight at 9.81 m/s²: 5470.17–22722.2 N. Height / assumed clearance: 1.66667.
Effective DEM samples across: 0.00266667. Survey target spacing: 0.266667 m (editorial).
An ellipsoid is a geometric envelope, not measured rock shape or total buried volume. Density bounds and axis uncertainty are operator assumptions. Mass bounds are conditional on those inputs; unknown dimensional uncertainty is not zero. Clearance ratio is not traversability.
Acquire calibrated stereo/lidar dimensions and a material/density measurement. Compare obstacle geometry with a validated rover model before planning a crossing.

## Cavity / vertical pit estimate
Input kind: operator-hypothesis. Source: operator hypothesis; no detected cavity.
Elliptical opening: A = pi × length × width / 4. Vertical cylindrical pit envelope: V = A × depth. A pit is not the connected cave.
Axes/depth: 10 × 6 × 4 m. Assumed axis uncertainty: 20%.
Opening: 47.1239 m²; cylindrical envelope: 188.496 m³.
Envelope bounds: 96.5097–325.72 m³. Ideal drop time: 0.903047 s at 9.81 m/s².
Effective DEM samples across: 0.02. Opening-area ratio to Marius inner pit: 0.0222635.
Connected cave volume, roof thickness and stability: unavailable.
Volume is a cylindrical geometric envelope, not surveyed capacity, shelter area or subsurface extent. Ideal drop time assumes rest and constant gravity, without drag; it is an illustrative comparison, not a descent design. Roof, access, ice and shielding remain unknown.
Obtain local stereo/lidar and subsurface/structural evidence; establish access geometry and survey requirements before selecting a shelter or descent operation.

## Documented comparison
Marius Hills pit · LROC Pit Atlas: 55 × 49 m inner opening, 40 m stereo-derived depth.
Inner pit diameters and stereo-derived depth; not the larger funnel or a mapped connected cave volume. Published uncertainty is unavailable.
https://lroc.im-ldi.com/atlases/pits/1

Planning estimates only. Regional DEMs do not detect individual rocks or underground voids. Geometry does not establish composition, connected cave extent, roof stability, access or route safety.
