# Earth expedition delivery and verification

Verified on 2026-11-15T08:15:25.288263+00:00. This records the implemented candidate code and local acceptance evidence; the coordinator owns final review, integration, commit and push. No Git mutations, environment-file reads, dependency additions or published data regeneration were performed by this worker. Unrelated work and prior evidence were preserved.

## Delivered behavior

Terrain 3D prepares and executes an Earth remote reconnaissance expedition for a concrete rover mobility, Mars sampling or lunar shelter survey objective. The operator chooses an equipment concept, load, regional slope ceiling and illustrative drive allowance, edits ordered stops on the actual DEM map or with accessible controls, reviews source/resolution/coverage and explicitly confirms preparation. Confirmation holds the rover at the selected first stop; start is separate.

The existing Earth rover follows those stops in Auto or Manual. Arrival requires an explicit inspection at its actual pose, with DEM-derived terrain evidence, UTC and SIM clocks, environmental source context and material properties left unknown. Pause, resume, reset, closure and constraint failures have explicit states. Complete and partial campaigns produce different next-validation decisions. All fourteen catalogue sites and four existing paired Earth windows remain available; missing DEMs block unsupported work, and missing planetary benchmarks are explained.

Standalone JSON/Markdown reports preserve identity, confirmed load/traverse, inspected stops, actual path, sources/resolution, timestamps, limitations and next actions. The legacy mission JSON includes Earth evidence additively. The copilot dispatches by active domain/session and retains a bounded source-linked summary; history and late replies cannot cross identities. Destination descent/contact/deployment, M2 tracking, Mission Dossier, Discovery, camera, weather and existing export formats retain their own contracts.

## Files and architecture

- `earth-expedition.mjs`: pure plan/run/inspection/report/decision engine, independent Earth session identity, private frozen DEM snapshot, direct-leg validation, bounded rover substeps, energy assumptions, benchmark adapter, Markdown and bounded copilot context/local rules.
- `earth-expedition-ui.mjs` and `earth-expedition.css`: scoped preparation, accessible map/stop editing, explicit confirmation, run progress, inspections, decisions, report downloads/copied context and the last three in-tab reports.
- `mission-export-identity.mjs`: authoritative Earth export identity from the active scenario/DEM, including fresh La Corona/Wadi Rum destinations outside the fourteen-site catalogue; absent country/catalogue reference remains null.
- `mission.js`: limited selection/rover/control/camera/3D-stop/radar wiring, asynchronous identity guards, site-weather ownership, additive export metadata and copilot dispatch/history/epoch checks.
- `index.html`: stylesheet, scoped expedition host and Terrain 3D tab label.
- `tests/earth-expedition.test.mjs` (24 cases) and `tests/mission-export-identity.test.mjs` (3 cases).
- `scripts/serve-earth-expedition-qa.py` and `scripts/qa-earth-expedition.py`: self-hosted loopback fixtures and pinned Orca page acceptance through rendered controls and actual UI download Blobs.
- `docs/earth-expedition.md`: usage, coordinates, energy model, scale caveats, identity invariants and reproducible commands.
- `docs/contracts.md`: additive shared changes and the Earth expedition contract, co-maintained with the coordinator.

`source-sha256.json` identifies the code, styles and QA scripts at delivery. This is not a claim about the coordinator's eventual merge commit.

## Verification

`npm run check` passed syntax discovery and **261 JavaScript tests** with zero failures. The backend suite passed **161 tests**. Touched shared files passed `git diff --check`. The checks summary is in `checks.txt`.

**54 rendered-flow assertions passed in the pinned Orca browser**, with no simulation/controller hooks or test-only time acceleration:

- `browser-core.json`: 27 checks covering preparation → map/keyboard edits → confirmation → actual rover progress → two inspections → finish → JSON/Markdown, manual partial coverage, reset, all four paired Earth windows, destination contact/deployment, M2 JSON/Markdown/Excel output Blobs and return-to-Earth isolation.
- `browser-advanced.json`: 22 checks covering fresh-page La Corona and Wadi Rum export identities, missing Earth/target DEM, missing-benchmark local copilot, reverse DEM/benchmark responses, actual provider POST context, history and late-answer isolation including return to the same session, infeasible regional slope constraints, mobile/reduced motion, existing camera and actual WebGL-unavailable execution/export.
- `browser-missing-switch.json`: 5 final checks covering a supported-to-missing DEM switch and the closed partial expedition UI. Missing terrain also clears its former 3D context ring. A closed report offers download/reset rather than a resume or further stop action. `closure-ui.json` records the actual completed 2/2-stop phase, terminal hint and disabled resume control.

`completed-expedition.json` / `.md` and `incomplete-expedition.json` / `.md` are actual UI downloads, from deliberately separate sessions. Their JSON/Markdown pairs share the same closed cutoff and identity. The complete campaign inspected both planned stops; the partial campaign inspected one and explicitly requests plan revision. `report-validation.json` records five independent checks, including sampling the published DEM again at the actual exported rover poses to verify both elevations and slopes.

`provider-context.json` is the actual browser POST context captured by a local provider transport fixture. `provider-projection.json` confirms that all required session/objective/load/stops/inspection/decision/benchmark/scale/limitation facts survive both actual provider prompt builders, within the 400-field budget (168 retained fields). It contains no destination landing, M2 audit or mirrored rover context. The fixture is explicitly a transport response; no external AI provider was called.

The four PNGs show the desktop map and findings, mobile preparation and fallback evidence. Screenshots document layout/rendering; numeric and identity acceptance comes from the exported artifacts and assertions. The final closure wording was checked separately after the captures. The full evidence folder is approximately 1.1 MB, with no regenerated earlier artifacts.

## Limits and remaining integration work

This is DEM-scale remote reconnaissance and an uncalibrated SIM energy exercise. It does not measure soil, mineralogy, cave stability, traction, radiation, ice or field accessibility. The planetary index is regional topography only, with published scale caveats; it is not planetary similarity, certification or a safe-route assessment. Direct legs require operator edits when constraints fail; there is no obstacle-avoiding pathfinder. Source UTC, inspection UTC and SIM are independent. The 5 m arrival threshold is a SIM rule, not source accuracy. Scene weather presets affect rendering and never become measured stop weather or drive this energy model.

In-tab history is bounded and not durable storage; the path retains the last 1,500 sampled positions and 100 events, while total SIM time/distance covers the run. Reports disclose this trace policy. Real field validation, a calibrated energy/traction model and external-provider answer quality were not verified or claimed. The coordinator's independent final audit and Git integration remain; no known failing product or verification check remains in this delivery.

The worker's preview used `http://localhost:8251/` and pinned Orca page `dc008e41-0c10-4f52-b47f-a96cf43c75cd`. Other workers' preview servers and pages were left untouched.
