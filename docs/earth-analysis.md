# Earth field-test analysis workspace

**Terrain 3D** exposes **M2 Test Inspector**, **Processes 72 h**, and **Surface, rocks & cavities · AI** directly above the expedition. The same tools are available in the shared details drawer. The former destination-only empty prompts appear only in the globe view.

## M2 on an Earth expedition

The Compare drawer contains an independent instance of the existing nine-factor M2 inspector. It uses the actual Earth DEM and sourced local telemetry, alongside an explicitly selected Moon/Mars comparison reference. A published paired site selects its existing reference automatically; other catalogue sites show the selected reference explicitly and allow changing it. This selection is a comparison setup, not evidence of site feasibility or a planetary-similarity claim.

The target's proposed equipment profile belongs to its reference scenario. It remains a design proposal, separate from measured/configured mission inputs and the optional manual lab. The Earth rover stays in its field expedition; selecting a benchmark does not start a destination descent.

The Earth and destination inspectors have independent controllers and recorders. Reused static labels, form controls and NASA bench IDs are namespaced with `earth-`. Destination landing records, preparation IDs and exports retain their original scope. Field-run session, Earth DEM or reference changes open a separate Earth M2 log; finishing the asynchronous reference load alone does not restart it. A late response from an earlier location/reference cannot update the current workspace.

Earth M2 JSON/Markdown include additive `analysisContext`: domain `earth-field-test`, actual Earth site, expedition session, DEM identity and reference scenario/body/target. The original candidate schema and four published base profile IDs are retained. Mission JSON adds the Earth audit under `earthAnalysis`; destination `analogyDossier` remains separate. Existing spreadsheet generation is reused with the actual Earth candidate and its independent session.

## Processes at the active Earth location

Processes uses the active Earth site's forecast and historical series through the existing Module 3 engine. A target thermal curve is a comparison reference only. The forecast's site must match the active Earth location; no forecast is copied from the previously selected destination. Archived forecasts retain their date/source and archive label. If no matching forecast is supplied, the panel states that limitation and leaves the isolated process lab available.

The panel, charts, hourly table, current-hour lab action and resize handling read the active domain's process context. Destination process data can finish loading in the background without replacing Earth data on screen. Switching back restores the destination context.

## Surface evidence and AI

[Automatic surface evidence](surface-assessment.md) uses the Earth DEM for Terrain 3D and the target DEM for destination missions. It fills regional values without manual inputs. Marius published pit geometry is loaded only at lunar Marius; no rock or terrestrial cavity dimensions are invented.

Earth Flight Director requests include the captured field context, independent M2 audit/reference, bounded process summary and compact automatic surface evidence. Pending replies are invalidated when the Earth run or comparison reference changes. Provider projection remains bounded and reports omissions honestly.

## Validation

Run `npm run check` and backend tests when prompts/provider transport change. Pure tests verify field identity, reference-only roles, source matching, unchanged scope during loading, all catalogue DEMs and unknown individual-rock properties.

For browser validation, start the existing loopback QA server and run:

```sh
python3 scripts/serve-earth-expedition-qa.py 8284
python3 scripts/qa-earth-analysis.py OWNED_ORCA_PAGE_ID http://localhost:8284/
```

The script uses actual UI handlers and JSON/Markdown export Blobs. It suppresses external providers, uses published weather snapshots, and explicitly mocks provider transport for context/race checks. It does not replace terrain, mission controllers or source values. Results are written under `docs/evidencias/earth-analysis/`. Previous evidence folders remain historical snapshots of earlier interfaces.
