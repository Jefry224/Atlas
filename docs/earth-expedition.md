# Earth analogue field expeditions

Terrain 3D now asks an operational question: which terrain observations support a future Moon or Mars reconnaissance or sampling campaign, and which validation should come next? This is a remote DEM exercise and a simulated Earth rover run. It is not an Earth spacecraft landing or a field safety assessment.

## Use the experience

Field Expedition follows the Mission Control design system: deep blue surfaces, yellow primary actions, shared Overpass/Fira Sans typography, monospace instrument readings, segmented preparation and compact status badges. The terrain map uses blue elevation shading, a dashed yellow plan, a blue travelled path and a white rover marker. Distance, SIM time, modeled battery and allowance are separate instrument cards; the recorded-evidence log stays expandable during traversal and opens for review. These are presentation changes; the source data, scale, validation and report evidence remain the same.

Design validation (2026-11-15): `npm run check` passed 402 tests. [Nineteen browser checks](evidencias/earth-expedition-design/results.json) cover preparation, confirmation, real SIM traversal, evidence closure, map coordinate aspect ratio, shared visual tokens and mobile layout at 390 px. The primary mobile inspection action is visible before the readings and map. Captures: [preparation](evidencias/earth-expedition-design/desktop-objective.png), [ready](evidencias/earth-expedition-design/desktop-ready.png), [mobile inspection](evidencias/earth-expedition-design/mobile-inspection.png). No physical-device or provider-accuracy validation was performed.

1. Choose any of the fourteen catalogue sites and open **Terrain 3D**. The preparation panel also offers all four existing paired Earth windows, including La Corona and Wadi Rum. A paired high resolution Earth DEM takes priority over its catalogue grid. If unavailable, a published catalogue grid is explicitly provisional. No DEM is generated.
2. Choose **Traverse reconnaissance**, **Sampling campaign design**, or **Lunar shelter reconnaissance**. Each specifies an equipment concept, the observation it supports, unresolved properties and future validation. Set payload mass, an assumed regional slope ceiling, and a SIM drive allowance. Changing these assumptions requires a new confirmation.
3. Open **Terrain & stops**. Review DEM source, date, native resolution, effective spacing, centre and coverage. Select an inspection stop, edit its coordinates, click the elevation map, or focus the map and use arrow keys. Stops are ordered; stop 1 is the actual rover start. The 3D markers and confirmed rover traverse use these same coordinates. Add/remove/reorder stops to compare another direct traverse.
4. Review **Review & confirm**, explicitly acknowledge the limitations and confirm. The rover remains held at stop 1 without recording evidence or advancing SIM time. The ready screen explains the next action and focuses **Start expedition**. Start records the departure DEM baseline and activates the traverse toward stop 2 in one action; a separate initial inspection and resume are no longer required.
5. **Auto** follows the confirmed stops. **Manual** activates the existing drive pad, WASD, or arrow keys with the 3D scene focused; starting does not drive on the operator's behalf. At each later arrival the rover pauses for an explicit inspection. **Inspect & continue** records DEM evidence and resumes toward the next stop; **Record & stay paused** records it without resuming. At the last stop, **Record final inspection** opens the evidence review. Optional notes are kept through pauses, and the main action precedes the map on small screens. Inspections sample the real DEM at the rover pose and record UTC, SIM elapsed time, source identity, coordinates, battery model and optional operator interpretation. The departure baseline is explicitly distinguished from later operator inspections in the UI, JSON, Markdown and copilot context (`recordingMethod: departure-baseline | operator-inspection`). No sample composition, rock, cave entrance or soil strength is fabricated.
6. Pause/resume through either the expedition panel or existing rover controls. Finish after all stops, or finish early with incomplete evidence. A partial report explicitly calls for plan revision. Reset creates a new identity, discards readiness and requires preparation again. The last three started sessions remain downloadable in this tab; export before closing the tab. The trace retains the latest 1,500 positions sampled about every 8 m and the latest 100 events; total distance/time cover the entire run. This is not an unlimited field data logger.
7. Download a standalone **Markdown field report** and **JSON evidence**, or copy the bounded copilot context. The existing mission JSON includes the expedition additively. Destination M2 JSON/Markdown/Excel and Mission Dossier remain separate and retain their original purpose. The standalone field report is the shareable account of this actual Earth run; the separate Mission Dossier synthesizes a scenario.

## What the model establishes

Flight Director AI is available directly in Earth mode through the preparation jump button and shared decision workspace. The adjacent [rocks and cavities laboratory](surface-assessment.md) estimates geometric envelopes, conditional mass/weight, scale and survey needs from explicit hypotheses or a documented pit reference. These planning estimates are separate from DEM stop measurements. Open field reports include the matching assessment; closure freezes it, so subsequent planning edits cannot rewrite expedition evidence.

The success criterion is to inspect every confirmed stop within the chosen regional slope and illustrative energy constraints. Source-backed stop elevations, slopes, traverse observations and published window metrics establish a regional terrain reconnaissance record. They do not establish a planetary analogue in every dimension. Documentary site sources are linked, and the report retains the inherited DEM notes and provenance.

For a paired site, the existing `compareTerrain` engine compares the published median slope, p90 slope, p95–p5 relief and mean TRI. The expedition excludes radar and thermal terms from this index. Its weights are editorial, not calibrated against missions. Native-resolution scale caveats remain explicit. Catalogue sites without a pair, missing target DEMs and missing published metrics have an unavailable benchmark with a reason; their supported Earth observations can still proceed.

Each operational objective names a concrete next validation: rover-scale stereo/lidar and traction for mobility; permitted samples, mineralogy and contamination controls for sampling; subsurface, structural and illumination surveys for shelter reconnaissance. Regional topography alone cannot establish mineralogy, ice, biosignatures, radiation shielding, cave stability or field access. Gravity, atmosphere, radiation, water and biology differ between Earth, Moon and Mars.

## Coordinates, time and sources

Coordinates use the existing local rover convention: x east, z south, in metres from the **actual DEM centre**. Catalogue reference coordinates are retained separately because paired Earth windows can be offset from their documentary marker. Stop latitude/longitude is an approximate local tangent-plane conversion, not a surveyed position. Full JSON retains both local pose and georeference; Markdown includes both the plan and inspected coordinates.

DEM elevations are bilinear interpolations, slopes use the existing `sampleSlope` derivative, and the 3D display exaggerates heights ×2 and draws the rover ×14. The evidence map uses true DEM elevations. Neither interpolation nor display scale adds source detail. Arrival tolerance is 5 SIM metres; it says nothing about DEM precision or instrument footprint. Stops must be distinct by at least one effective grid spacing (minimum 10 m) and remain inside the existing 95% rover window.

Motion is 0.8 m/s, SIM ×20, integrating up to 1 s wall time per rendered frame in at most ten 0.1 s kinematic substeps. This preserves meaningful progress on slow WebGL devices while checking constraints at each substep. SIM freezes while paused or hidden. Hiding the page pauses the Earth session and requires an explicit resume on return. UTC creation, confirmation, inspection, closure and export times are independent of SIM time and DEM acquisition/fetch time. Site/window weather retains its provider, source, coordinates, acquisition time and kind. It is contextual modeled/archive evidence, not an instrument reading at the stop. Cross-site telemetry is rejected; missing weather remains null. Scene weather presets affect rendering and do not become evidence or enter this energy model.

The intentionally uncalibrated energy rate in percent per SIM second is:

```text
(moving ? 0.0018 : 0.0004)
  × (1 + payloadKg / 100)
  × (1 + regionalSlopeDeg / 30)
  + (objective == mobility ? 0.0001 : 0.0003)
```

There is no solar recharge. The direct-leg estimate uses sampled maximum slope and excludes dwell/instrument analysis, return travel, local terrain mechanics and thermal effects. Mass and equipment concepts alter both estimate and run consumption consistently. The operator's allowance can halt a run before the modeled battery is empty. Constraints never certify field feasibility.

## Architecture and identity invariants

- `earth-expedition.mjs` is a DOM-free plan/run/report engine. It validates finite configuration values, 2–6 stops, spatial separation, bounds, direct-leg slopes and modeled drive consumption. It uses the existing rover kinematics and pure terrain/comparison utilities. This is a direct-leg evaluator; it does not promise an obstacle-avoiding route. An invalid direct traverse requires an edited plan or different assumptions.
- `earth-expedition-ui.mjs` owns scoped preparation, elevation-map editing, operator review, progress, inspections, decisions, downloads and a bounded in-tab report archive. It updates moving map elements separately from phase transitions.
- `earth-expedition.css` styles only the expedition. `mission-export-identity.mjs` resolves active Earth identity from scenario/DEM metadata even when a paired site lies outside the fourteen catalogue entries; unknown country/reference coordinates stay null. `mission.js` connects selection, actual rover stepping, planned 3D markers, shared controls, additive JSON and copilot dispatch. No destination profile or M2 recorder accepts an Earth/Discovery identity.
- Each run has an `earth-…` session ID and `earth-expedition/1` schema. The DEM is a deeply frozen private snapshot with a fingerprint including centre, resolution, source timestamp and elevations. Confirmed configuration/stops must continue matching the preparation snapshot. A changed site/window, benchmark or reset starts a new draft. Leaving Earth pauses its session; returning to the same window restores its own rover and pilot mode. A different window closes any prior started session with complete or partial evidence and keeps its local report.
- Earth DEM/reference loading uses a generation guard and site checks after awaits. Shared terrain construction retains its own token. The copilot dispatches by active mode, site and session, clears conversation history on identity changes, and rejects late answers by both identity and request epoch. Earth context contains no destination flight, target rover, M2 recorder or destination process state.
- Copilot context is a compact summary with source-linked inspections and a decision. Raw DEM arrays, path and event histories remain in reports rather than provider context. A local rule fallback answers using the captured Earth context. Existing provider requests and scoped conversational history remain available when the backend supports them.

## Reproduce validation

Use the repository's configured Node and Python environments; no dependencies are added. `npm run check` discovers the pure-engine tests automatically.

The departure UX regression uses an existing Playwright installation. Start the loopback QA server, then run `PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/qa-expedition-start.mjs`. It exercises the actual rendered controls and exported reports: confirmation, one-click departure, pause/shared resume, intermediate Inspect & continue, final inspection/closure, note preservation, Manual control, explicit inspection hold, early finish, mobile ordering/overflow and browser errors. Defaults: `http://127.0.0.1:8259/`, WebGL fallback, artifacts in `/tmp/atlas-expedition-ux`. Override `EXPEDITION_QA_URL`, `EXPEDITION_QA_OUTPUT`, or use `EXPEDITION_QA_WEBGL=1` for the actual 3D scene. External requests are blocked by the test.

Departure UX validation (2026-11-15): `npm run check` passed all 346 tests. The full desktop/mobile browser journey passed [19 checks without uncaught errors](evidencias/earth-expedition-start/results.json); captures show [ready on desktop](evidencias/earth-expedition-start/desktop-ready.png), [inspection](evidencias/earth-expedition-start/desktop-inspection.png) and [ready on mobile](evidencias/earth-expedition-start/mobile-ready.png). That full run uses the WebGL fallback and local archived weather. A separate WebGL run confirmed an active renderer and movement from a single Start, but its full journey did not complete due to browser/action timeouts. No real provider, hardware or physical mobile-device validation is claimed.

```sh
export PATH=/home/jefry/.nvm/versions/node/v22.22.3/bin:$PATH
npm run check
node --test tests/earth-expedition.test.mjs
python3 scripts/serve-earth-expedition-qa.py 8248
orca-ide tab create --url http://localhost:8248/ --json
/tmp/selene-merge-venv/bin/python scripts/qa-earth-expedition.py PAGE_ID http://localhost:8248/
/tmp/selene-merge-venv/bin/python scripts/qa-earth-expedition.py PAGE_ID http://localhost:8248/ --advanced
```

The QA server binds loopback and is separate from other preview servers. Its explicit query fixtures return missing/delayed published assets, suppress actual WebGL creation, or provide a local copilot transport response. Static QA responses use no-store headers so browser cache cannot bypass a selected fault. They make no external provider calls. Browser acceptance operates a pinned Orca page through real DOM controls and captures the actual UI download Blobs, without changing physics, moving the rover through a test hook or accelerating time outside the product. Evidence lives under `docs/evidencias/earth-expedition/`; no prior evidence is regenerated.
