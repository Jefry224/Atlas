# Earth Terrain integration evidence

Status at this evidence cutoff: **accepted for publication**. Implementation `d840ad7` and destination-summary correction `f3a6125` have passed independent review, including [the final follow-up disposition](../earth-final-review/follow-up-disposition.md). No unresolved product finding remains from that audit. The final combined source verification below binds the passing checks to the corrected code; publication is established separately by the subsequent main merge and remote-ref verification. Initial audits and preflights remain historical records.

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

The corrected delayed-load case keeps `hyperarid-salt` paired with Atacama/Jezero instead of the previous Wright Valley/Shackleton context. Generation is disabled during loading and after terrain failure. Availability text now distinguishes the included M2 audit from unavailable M3 processes. This verifies request ownership and document identity; it does not verify external AI answer quality.

## Independent coordinator candidate run

The coordinator manually prepared and confirmed the default Pampa de La Joya traverse, explicitly inspected its first stop, resumed the actual rover, waited for natural arrival at its second stop, inspected it, and closed the expedition. No position or clock override was used. The actual browser downloads were parsed: [JSON](coordinator-pampa-success.json), [Markdown](coordinator-pampa-success.md), and [eight identity/evidence checks](coordinator-run.json).

Both reports retain the same site/session and operational task, two location-aware DEM inspections, over 400 m travelled, the proposed energy model, native 90 m resolution versus 300 m grid spacing, source-linked terrain and explicitly unavailable planetary comparison. Environment remains archived site/window context rather than a stop measurement. This run exercised a candidate version while the implementation worker continued its own work; it supplements the final acceptance evidence rather than replacing checks on the finished merged code.

The dossier repair is preserved in `3be43d7`; bounded provider transport and its documentation/tests are preserved in `c0c3b35`. Earth implementation `d840ad7` passed 261 JavaScript tests, 161 backend tests, 54 rendered-flow assertions and five independent report/source checks. The independent reviewer verified the ten delivery source hashes against candidate `3c6c472` before the destination-summary correction. Those delivery hashes remain a historical record; final publication must identify the corrected source separately.

## Independent acceptance disposition

The [independent acceptance matrix](../earth-final-review/acceptance-audit.md) covers every original baseline requirement. It distinguishes directly exercised behavior from inspected delivery evidence and source-level proof.

| Requirement | Evidence and disposition |
| --- | --- |
| Prepared objective, payload, editable DEM stops, confirmation and actual rover execution | Independent Atacama UI run and [runtime checks](../earth-final-review/independent-runtime.json); complete and incomplete outcomes parsed. |
| Site/DEM identity, native versus effective scale, actual-pose inspections and source limits | Independent published-DEM resampling and [artifact validation](../earth-final-review/artifact-validation.json); Atacama, Merzouga and coordinator Pampa evidence. |
| Matching local reports and copied context | Independent [completed JSON](../earth-final-review/independent-completed.json), [Markdown](../earth-final-review/independent-completed.md), [partial JSON](../earth-final-review/independent-partial.json) and [copied context](../earth-final-review/independent-copy-context.json). Standalone Earth reports preserve the fixed destination M2 spreadsheet workflow. |
| Benchmarks, analogy breakdown and next validation | Named Jezero comparison for Atacama; explicit unavailable comparison for Merzouga/Pampa; distinct complete/partial decisions and unresolved material properties. |
| Provider input parity and scoped history | Actual locally captured browser POST plus [independent current copilot/dossier prompt projection](../earth-final-review/independent-provider-projection.json); delivery late-reply/site/mode/session tests. No external provider call. |
| Pause/reset/manual controls, asynchronous loading, missing data, mobile and WebGL fallback | Independent pause/reset and inspected source-matching delivery fixtures. [Native Chromium visibility proof](../earth-final-review/native-visibility-proof.json) adds eight passing checks: trusted hide events, unchanged pose/path/SIM battery/energy/inspections across a 2.9-second hidden interval, continued pause on visible return and movement only after explicit resume. Chromium used an isolated profile/display because Orca forces embedded pages visible; native visibility getters and the simulation were not overridden. |
| Destination landing/deployment, M2 inspector/exports, Discovery and Dossier retained | Independent source/preservation audit and actual delivery landing/export navigation. Retained destination tilt/thermal findings F1/F2 were repaired in `f3a6125`; [26 targeted tests and two actual UI cases](../earth-expedition/physics-summary/README.md) passed. The independent follow-up additionally verifies the production destination UI, all sixteen thermal pairs, eight tilt fixtures and five malformed thermal inputs. Both findings are resolved. |
| Latest team code and main publication | Team baseline ancestry and conflict resolution recorded. [Historical preflight](publication-preflight.json) proves only candidate mergeability at its timestamp. Publication requires a fresh remote check, a main merge containing both the latest team main and this reviewed feature, a successful push and matching local/remote main refs. These are Git publication checks performed after this evidence cutoff, not inferred from browser tests. |

## Final combined verification

[final-source-verification.json](final-source-verification.json) compares fourteen source files against their delivery, remediation and independent-review hashes on code commit `f3a6125`. The original delivery's `mission.js` hash is superseded only by the explicitly documented destination-summary repair; all other delivered files retain their tested contents.

The latest full JavaScript check passed syntax discovery and **287 tests** after that source correction. The backend's **161 passing tests** remain applicable because the entire `server/` tree is unchanged since the tested Earth delivery. Both final independent artifacts are complete and their source hashes match the corrected committed files. Source-matching browser evidence covers complete/partial expeditions, provider transport, preserved destination behavior, missing and delayed data, mobile/fallback controls, and native hidden-page pause/resume. The corrected source was not modified during final evidence archiving.

Field safety, measured geology, calibrated battery endurance and external AI answer quality are not established by these simulations or local transport tests.
