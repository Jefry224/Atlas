# Earth analogue expedition

Atacama · Sitio de ensayo ARADS · earth-f2a6d086-fdc9-4f50-92ca-1cc01b72e695

Status: finished. Evidence cutoff: 2026-11-15T08:28:31.422Z (UTC). Exported: 2026-11-15T08:28:34.038Z (UTC).
Created: 2026-11-15T08:27:49.817Z; confirmed: 2026-11-15T08:28:08.143Z; started: 2026-11-15T08:28:10.808Z; finished: 2026-11-15T08:28:31.422Z.

## Operational objective

Prepare a Mars sampling campaign by documenting terrain context and access between candidate inspection stops.
Equipment concept: Context camera + sample handling mock-up. Payload: 28 kg (SIM).
Constraints: regional slope ≤ 15°; SIM energy allowance 20%.

## DEM evidence

Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30) · 65×65 nodes · 37.5 m spacing · 30 m native resolution · 2400 m window.
Source: https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30. Acquired/fetched: 2026-11-15T02:07:24+00:00. DEM identity: dem-3093331f.
DEM centre: [-24.10945,-70.10923]. Bounding box: null.

## Confirmed plan

| Stop | East x (m) | South z (m) |
| --- | ---: | ---: |
| 1. Baseline context | -75.0 | 0.0 |
| 2. Terrain contrast | 75.0 | 0.0 |

Drive estimate: 150.0 m; 0.51% energy; max regional slope 1.5°.

## Inspected stops

| Stop | UTC | SIM s | Approx. latitude, longitude | DEM elevation (m) | DEM slope (°) | Battery (%) |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| 1. Baseline context | 2026-11-15T08:28:12.128Z | 0.0 | -24.109450, -70.109968 | 1035.6 | 1.4 | 100.0 |
| 2. Terrain contrast | 2026-11-15T08:28:30.072Z | 182.7 | -24.109450, -70.108530 | 1034.5 | 1.3 | 99.5 |

Stop 1: 1.4° regional slope, 1035.6 m DEM elevation. Terrain context and the order of candidate sampling inspections.
Operator note: none.
Environment (site/window context): {"kind":"current-weather-model","siteId":"atacama","location":{"lat":-24.1,"lon":-70.14},"provider":"open-meteo","live":true,"source":{"label":"Open-Meteo Forecast API · valores «current» de modelo (15 min)","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T08:15:00Z","provenance":null,"values":{"temperatureC":16.2,"windSpeedMs":1.2,"windGustMs":2.4,"solarRadiationWm2":0,"relativeHumidityPct":52,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

Stop 2: 1.3° regional slope, 1034.5 m DEM elevation. Terrain context and the order of candidate sampling inspections.
Operator note: none.
Environment (site/window context): {"kind":"current-weather-model","siteId":"atacama","location":{"lat":-24.1,"lon":-70.14},"provider":"open-meteo","live":true,"source":{"label":"Open-Meteo Forecast API · valores «current» de modelo (15 min)","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T08:15:00Z","provenance":null,"values":{"temperatureC":16.2,"windSpeedMs":1.2,"windGustMs":2.4,"solarRadiationWm2":0,"relativeHumidityPct":52,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

## Run observations (SIM)

146.1 m travelled; 182.7 SIM s at ×20; 0.50% modeled energy used; observed max regional slope 1.5°.
Run elevation range: 1034.5–1035.6 m.

## Planetary reference

Cráter Jezero · zona de aterrizaje de Perseverance (Octavia E. Butler) (mars) · hyperarid-salt.
Published DEM metrics support a regional topography comparison only.
Topography index: 82/100; scale comparable: true.
Target DEM source: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_045994_1985_ESP_046060_1985/DTEEC_045994_1985_046060_1985_U01.tif; spacing 37.5 m; native resolution 1.02 m.
Comparison components: [{"key":"slopeP50Deg","unit":"°","earth":2.38,"target":1.97,"score":82.8,"weight":0.3333333333333333},{"key":"slopeP90Deg","unit":"°","earth":4.58,"target":4.32,"score":94.3,"weight":0.2777777777777778},{"key":"reliefP95P5M","unit":"m","earth":68.66,"target":47.41,"score":69.1,"weight":0.22222222222222224},{"key":"triMeanM","unit":"m","earth":1.56,"target":1.24,"score":79.5,"weight":0.16666666666666666}].
Published Earth metrics: {"slopeP50Deg":2.38,"slopeP90Deg":4.58,"reliefP95P5M":68.66,"triMeanM":1.56,"comparable":true,"roughness":{"value":-13.25,"unit":"dB","method":"Media de gamma0 VV (RTC, aplanada por terreno) en dB sobre la ventana 2400 m (240×240 px a 10 m, vecino más próximo); desviación típica 2.39 dB. Proxy de rugosidad superficial a escala de la longitud de onda banda C (~5.6 cm), no rugosidad geométrica medida. Escena única 2026-11-12, órbita descending.","source":"https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C_IW_GRDH_1SDV_20261112T100910_20261112T100935_010302_014934_rtc","license":"https://creativecommons.org/licenses/by/4.0/","credit":"Sentinel-1 RTC (Planetary Computer, CC BY 4.0) · contains modified Copernicus Sentinel data","stdDb":2.39,"polarization":"VV","acquired":"2026-11-12T10:09:22.835443Z"}}.

## Decision

Advance to targeted validation
2/2 planned stops inspected in SIM. Terrain context and the order of candidate sampling inspections.

Strengths:
- Terrain context and the order of candidate sampling inspections.
- Source-linked regional DEM and traceable stop coordinates.

Breakdowns:
- Mineralogy, biosignatures, contamination, drillability and soil chemistry have not been measured.
- DEM elevations and slopes describe regional terrain; interpolation adds no detail. No sub-DEM rocks, safe zones or soil measurements are inferred.
- Comparable topography is not planetary similarity or field feasibility. Earth gravity, atmosphere, radiation, water and biology differ from Moon and Mars conditions.
- Rover motion, payload activity and battery use are illustrative SIM models; no spacecraft descent or target telemetry is generated.

Next validation actions:
- Validate access in the field, collect permitted samples and run mineralogy and contamination controls.
- Choose an independently documented planetary reference and audit scale, geology and environmental differences.
- Confirm permits, access, field safety and instrument calibration with local specialists.

## Sources and limitations

- NASA Ames · Programa ARADS: https://www.nasa.gov/universe/atacama-rover-astrobiology-drilling-studies-arads/
- Astrobiology · Ensayo y localización: https://pmc.ncbi.nlm.nih.gov/articles/PMC10750310/
- An Earth remote reconnaissance simulation, not a field visit or mission certification.
- DEM elevations and slopes describe regional terrain; interpolation adds no detail. No sub-DEM rocks, safe zones or soil measurements are inferred.
- Comparable topography is not planetary similarity or field feasibility. Earth gravity, atmosphere, radiation, water and biology differ from Moon and Mars conditions.
- Rover motion, payload activity and battery use are illustrative SIM models; no spacecraft descent or target telemetry is generated.
- Stop arrival tolerance (5 m) is a simulated position threshold, not DEM accuracy or an instrument footprint.

Percent-per-SIM-second: (moving ? 0.0018 : 0.0004) × (1 + payloadKg/100) × (1 + slopeDeg/30) + (mobility ? 0.0001 : 0.0003). No solar recharge; uncalibrated editorial model. Drive-only estimate excludes operator dwell and instrument analysis.
The trace retains the latest 1500 positions sampled about every 8 m and the latest 100 session events; total SIM distance and elapsed time cover the full run. Trace sampling is not DEM resolution.

Site/window environmental context: {"kind":"current-weather-model","siteId":"atacama","location":{"lat":-24.1,"lon":-70.14},"provider":"open-meteo","live":true,"source":{"label":"Open-Meteo Forecast API · valores «current» de modelo (15 min)","url":"https://open-meteo.com/en/docs"},"timestampUTC":"2026-11-15T08:15:00Z","provenance":null,"values":{"temperatureC":16.2,"windSpeedMs":1.2,"windGustMs":2.4,"solarRadiationWm2":0,"relativeHumidityPct":52,"pressureHpa":null},"scope":"Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time."}.

DEM notes (inherited source language):
- El marcador de ARADS en data.js es orientativo; la ventana muestra el entorno, no el punto exacto de perforación.
- Centro de la ventana elegido con scripts/analog_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (-24.102, -70.138), la de mayor índice geométrico frente a «Jezero». Es una elección reproducible del equipo, no un punto de ensayo publicado.
- Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.
- Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).
- thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).
- La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria.

DEM provenance:
- Punto de referencia · data.js (Astrobiology · Ensayo ARADS y localización): https://pmc.ncbi.nlm.nih.gov/articles/PMC10750310/
- Copernicus DEM GLO-30 · tesela Copernicus_DSM_COG_10_S25_00_W071_00_DEM (Planetary Computer): https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus_DSM_COG_10_S25_00_W071_00_DEM
- Sentinel-2 L2A · S2B_MSIL2A_20261113T143649_R096_T19KCP_20261113T181914 (2026-11-13): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_20261113T143649_R096_T19KCP_20261113T181914
- Sentinel-1 RTC · S1C_IW_GRDH_1SDV_20261112T100910_20261112T100935_010302_014934_rtc (2026-11-12): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C_IW_GRDH_1SDV_20261112T100910_20261112T100935_010302_014934_rtc

## Session events (UTC and SIM)

- 2026-11-15T08:28:08.143Z · SIM 0.0 s · preparation-confirmed: Objective, load, DEM and traverse explicitly reviewed.
- 2026-11-15T08:28:10.808Z · SIM 0.0 s · resume: At planned stop; inspect before continuing.
- 2026-11-15T08:28:12.128Z · SIM 0.0 s · inspection: Stop 1: DEM evidence recorded; no material measurement.
- 2026-11-15T08:28:13.438Z · SIM 0.0 s · resume: Following the confirmed Earth traverse.
- 2026-11-15T08:28:16.006Z · SIM 62.6 s · pause: Operator pause
- 2026-11-15T08:28:21.934Z · SIM 62.6 s · resume: Following the confirmed Earth traverse.
- 2026-11-15T08:28:27.411Z · SIM 182.7 s · arrived: Stop 2
- 2026-11-15T08:28:30.072Z · SIM 182.7 s · inspection: Stop 2: DEM evidence recorded; no material measurement.
- 2026-11-15T08:28:31.422Z · SIM 182.7 s · finished: Evidence closed for decision review.
