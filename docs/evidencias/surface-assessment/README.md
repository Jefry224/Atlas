# Surface assessment and visible Flight Director verification

The initial feature candidate is preserved in `ff40a65`. This folder now records the combined candidate after integrating team main `a68c8f4` and the concurrent local departure-UX improvement. `source-sha256.json` identifies the final tested code at this cutoff.

The shared decision workspace exposes the existing Flight Director in Earth Terrain 3D and destination modes, alongside a source-aware rock/pit planning laboratory. New calculations are independent from rover/landing physics and measured inspection evidence. [Usage and method](../../surface-assessment.md) describe the model and its limits.

## Initial feature verification

- Full `npm run check`: **297 JavaScript tests passed**, including ten numerical, missing-data, range, provenance and report tests; process exit 0.
- Full backend suite: **164 tests passed**, including published full-context transport coverage for the new surface DTO alongside existing expedition, landing, dossier, M2 and M3 facts.
- **18 browser checks passed** through actual controls and export Blobs on an owned pinned Orca page: visible Earth Director, empty/invalid inputs, dimension-dependent results/schematic, local rock/cavity answers, Earth report closure, destination isolation and Marius source attribution, edited-source invalidation, captured provider POSTs and stale replies, mobile/fallback export.
- `provider-parity.json` applies the current production projection and both prompt builders to the actual captured browser POSTs. Every surface field survives, including weight, reference, assumption basis and null roof/connected-volume data. The 400-field global bound remains in force.

`earth-estimates.json/.md`, `marius-estimates.json` and `closed-earth-expedition.json/.md` are actual UI-generated artifacts. The closed Earth report was exported again after editing the laboratory and retained the original assessment and cutoff. Screenshots document the Earth and lunar workspace plus the mobile fallback. Numerical claims rely on parsed exports and tests, not screenshot pixels.

The reproducible harness is `scripts/qa-surface-assessment.py`. Its fixtures suppress API weather/provider requests and use an explicitly local AI transport mock. It does not change controller state, rover pose, simulation clock or published geology/terrain. The final run uses the local no-store static QA server on port 8239 to ensure newly edited modules are not hidden by a browser cache. A first harness assertion expected a rock field to be visible after switching while the cavity tab was selected; it was corrected to inspect the actual exported empty rock/cavity inputs. No product state was changed to satisfy that assertion.

## Combined integration verification

The team added simulator-first layout, English translation, cinematic landing/lighting, higher-resolution imagery and its deployment workflow. Four textual conflicts were resolved in `index.html`, `mission.js`, the shared change log and Flight Director prompt. The final HTML retains all 243 team element IDs with four additive IDs and no duplicates. The decision workspace lives in the existing Flight Director drawer; the Earth jump button opens the matching tab through `revealInDrawer`. The new layout, cinematics, translation, imagery and workflow were retained.

A concurrent agent was improving expedition departure in the same checkout. Its Start behavior records the sourced departure DEM baseline and immediately follows the route, with explicit inspections at subsequent stops. Those source/test/style/documentation changes were preserved. An interim combined check ran before its test updates were complete and failed thirteen old baseline-sequence assertions. The final combined check passes **all 346 JavaScript tests** and **all 164 backend tests**. The browser harness was adapted to the new Start sequence rather than forcing the former extra inspection/resume interaction.

All **18 browser checks pass again** on the combined simulator-first application, including the drawer, frozen closed reports and the preserved departure workflow. The actual captured provider POSTs were projected through both current merged prompt builders; all surface fields survive within the existing global bound. Existing source data and prior evidence folders were not regenerated. The initial pre-integration evidence remains available in commit `ff40a65`; the artifacts and screenshots here reflect the final combined run.

## Scientific scope

Rock dimensions, density bounds, uncertainty and clearance are editable operator assumptions. Their volume/mass/weight outputs are conditional geometric models. The LROC Marius comparison is a documented inner-pit measurement; changing its dimensions removes its published attribution. A cylindrical pit envelope is not surveyed connected cave volume or usable shelter capacity. Regional DEM scale does not detect small rocks, confirm subsurface cavities, establish safe access or certify roof stability. Actual geology, field operations and external AI answer quality are not verified here.
