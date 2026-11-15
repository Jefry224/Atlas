# Earth Terrain integration evidence

Status: implementation delivered in `d840ad7`; final independent acceptance and main synchronization are pending. This directory records the integration baseline and coordinator verification; the initial audit does not certify the finished feature.

## Preserved baseline

- Local work snapshot: `55bc64e` (landing, preparation, reports and M2 inspector).
- Team changes integrated from `a395f01`; resolved merge: `79138b6`.
- Integration branch: `feature/terrain-3d-expeditions`.
- Baseline checks after resolving the merge: 225 JavaScript tests and 150 backend tests passed.
- Discovery and Mission Dossier navigation were opened in the Orca browser against the integrated application. The controlled delayed-response reproduction in `dossier-race-before.json` demonstrates a wrong-site context that must be corrected before publishing main.

`baseline-audit.md` is the read-only reviewer report copied from its original temporary artifact. It identifies provider context truncation, asynchronous dossier identity, active Earth copilot/history isolation, exported site/DEM identity and data-honesty constraints. Its acceptance matrix is the scope for the completed field expedition, not a statement that those requirements already pass.

## Evidence interpretation

Earlier captures and exports in `docs/evidencias/descenso-*`, `mision-destino*` and `preparacion-rendimiento` are preserved historical local work. In particular, the saved Jezero mission report identified in the baseline audit contains the earlier catalogue-versus-scenario site mismatch. It is not evidence for corrected export identity. New acceptance artifacts must verify the currently selected site/grid/session directly.

No external AI credentials or provider requests were used for the baseline browser reproduction. Meteorology was deliberately unavailable in that controlled test. Published terrain data was not regenerated.

## Candidate verification: dossier request ownership

The working-tree repair in `dossier-session.mjs` and `dossier.js` has [actual browser evidence](../dossier-session/browser-after.json) for six controlled cases: reverse terrain completion/loading gate; late provider success/finally during a newer generation; late provider error/finally with a matching Markdown filename/content; current terrain failure; late terrain failure; and the retained Discovery candidate context. Published DEMs were used, optional weather was deliberately unavailable, and provider responses were local QA mocks.

The corrected delayed-load case keeps `hyperarid-salt` paired with Atacama/Jezero instead of the previous Wright Valley/Shackleton context. Generation is disabled during loading and after terrain failure. Availability text now distinguishes the included M2 audit from unavailable M3 processes. This verifies that targeted repair in the candidate working tree; it does not verify external AI responses or completion of the Earth expedition. Final combined checks and committed/main identity are still pending.

## Independent coordinator candidate run

The coordinator manually prepared and confirmed the default Pampa de La Joya traverse, explicitly inspected its first stop, resumed the actual rover, waited for natural arrival at its second stop, inspected it, and closed the expedition. No position or clock override was used. The actual browser downloads were parsed: [JSON](coordinator-pampa-success.json), [Markdown](coordinator-pampa-success.md), and [eight identity/evidence checks](coordinator-run.json).

Both reports retain the same site/session and operational task, two location-aware DEM inspections, over 400 m travelled, the proposed energy model, native 90 m resolution versus 300 m grid spacing, source-linked terrain and explicitly unavailable planetary comparison. Environment remains archived site/window context rather than a stop measurement. This run exercised a candidate version while the implementation worker continued its own work; it supplements the final acceptance evidence rather than replacing checks on the finished merged code.

The dossier repair is preserved in `3be43d7`; bounded provider transport and its documentation/tests are preserved in `c0c3b35`. The Earth implementation task has delivered `d840ad7`: 261 JavaScript tests, 161 backend tests, 54 rendered-flow assertions and five independent report/source checks passed. The ten delivery source hashes match the committed files. Independent final audit task `task_529eba25032c` is ready for dispatch; main synchronization remains pending.

## Completion evidence still required

- Earth plan, selected objective/load/limits, map stops, explicit confirmation, actual rover execution, inspections and distinct completed/partial outcomes.
- One-cutoff report/context identity across JSON, Markdown and any supported spreadsheet workflow, including an incomplete expedition.
- Current Earth site/DEM/source/scale, honest reference comparison and unresolved physical properties.
- Site/mode/session changes, stale network responses, conversation history, manual drive, hidden/paused behavior and reset.
- Preserved destination preparation, landing/contact/deployment, M2 inspector, Discovery and Mission Dossier.
- Actual provider serialization retains decision evidence for both copilot and dossier under its bounded input policy.
- Desktop/mobile/reduced-motion/fallback behavior and final combined checks after all workers settle.
- Fresh remote fetch, conflict resolution if needed, pushed main, remote HEAD agreement and a reviewed working tree.
