# Physics summary evidence remediation

Verified 2026-11-15T08:41:26.740081+00:00 on the worker-owned Orca page `747f2ff2-9f23-4720-b99c-46acab018ecc`, served by the coordinator's no-key backend at `http://localhost:8231/`. This is separate follow-up evidence; the original Earth expedition delivery manifest and reviewer-owned final-review folder were not edited.

## Repair and scope

`mission.js` now delegates the existing thermal and tilt plain-card text to the DOM-free `physics-evidence.mjs`. The shared diff adds one import, replaces eight legacy summary lines with three evidence-aware rendering lines and records the inherited energy card's localization shortcut. Physics calculations, operational thresholds, Earth expeditions, destination controls, M2 tracking, reports and their contracts remain unchanged. The added presentation contract is documented in `docs/contracts.md` under Changes.

`regionalTiltSummary` requires two finite pitch/roll readings for a combined maximum absolute tilt. Missing or partial components produce an unavailable combined indication, retaining any known component explicitly. Nothing becomes a synthetic zero. Known zero is still a valid model reading. Low/moderate/elevated bands retain the existing illustrative 6°/12° boundaries, and no low-tilt result receives a green safety signal. Every result states that regional DEM/model tilt cannot resolve wheel-scale obstacles, traction or centre-of-mass stability and is not a local stability certification.

`thermalPairSummary` retains independent Earth and target states and margins. Both must be known nominal readings before the summary uses joint nominal/within-model-threshold wording. Caution, critical and unknown states are described explicitly; a known critical input remains visible even if the other input is unknown. Missing, malformed or inconsistent level/margin pairs remain unknown. Validation follows the existing `thermalStatus` contract: nominal margin ≥15 K, caution 0–15 K, critical negative margin. The summary distinguishes Earth air and target surface inputs from measured rover hardware temperature.

## Checks

- `node --test tests/physics-evidence.test.mjs`: **26 targeted tests passed**, including missing/non-finite components, partial pitch/roll, genuine zero and 6°/12° boundaries, all sixteen Earth/target nominal/caution/critical/unknown pairings, and malformed/missing thermal margins.
- `npm run check`: **287 tests passed**, zero failures, with automatic application syntax discovery.
- `git diff --check` passed for the touched shared files.
- The actual rendered destination UI passed two cases recorded in `browser.json`, with screenshots `published-destination.png` and `missing-destination-inputs.png`.

The first browser case selects the normal Jezero destination using published terrain/thermal data and the backend's sourced Earth weather. The UI showed a low regional tilt with an explicit local-certification limitation and distinct Earth nominal / target critical model states. It did not claim that the rover was safe or jointly within range.

The second case is an explicitly labeled browser-only fault fixture: Earth DEM responses return 404 and the target thermal field is omitted. The original physics functions, rendering code and controls execute unchanged. Both tilt components and the combined tilt were unavailable; the thermal summary retained unknown states without nominal/within-range claims. No missing property was synthesized as zero. No published data or server response source file was changed.

Reproduce the browser cases with:

```sh
/tmp/selene-merge-venv/bin/python docs/evidencias/earth-expedition/physics-summary/verify-browser.py PAGE_ID http://localhost:8231/
```

`remediation-sha256.json` records only this follow-up's source state and does not replace the immutable original delivery manifest.

## Residual limits

These summaries present existing regional DEM/model inputs and illustrative operating thresholds. They cannot establish local vehicle stability, traction, actual rover hardware temperature or mission/field certification. The inherited energy card and surrounding console localization are unchanged and explicitly marked as legacy. No backend, live provider, full field campaign or hardware calibration changes were made or claimed; backend tests were not rerun because no backend code was touched. The coordinator's independent recheck and Git integration remain.
