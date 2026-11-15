# Provider context and decision coverage

Both `/api/copilot` and `/api/dossier` call `copilot.flatten_context`, which
delegates to `server/context_projection.py`. The deterministic provider
projection is also used for coverage and citation tracking. The dossier
serializes values as JSON, including `null`, just like the copilot.

The old insertion-order walk reached 400 fields inside ordinary forecast or
landing data and silently lost M2 conclusions, M3 windows and missing-module
notices. The replacement reserves independent space before sharing unused
capacity. The total field limit remains 400, including eleven transport metadata
entries. No local estimated token-count gate is applied; the provider enforces its own token/context limits.

| Section | Initial field reservation | Supplied facts considered |
| --- | ---: | --- |
| Identity | 45 | Mission/scenario, Earth and target site, DEM identity and scale, current rover state, similarity and provenance |
| Expedition | 95 | `earthExpedition`, `expedition` or `activeRun`: session, objective, preparation/load, planned stops, benchmark limits, observations, inspection evidence, decision and limitations |
| Landing | 65 | Destination preparation and landing, including `analogyAudit.landing`, selected plans, target run/contact/outcome and run limits |
| Audit | 60 | M2 matrix, counts, calibration results/inputs/origins and limitations; landing is handled separately |
| Processes | 30 | M3 recommended window, ranked windows, thresholds, current indicators, source and caveats |
| Environment | 20 | Forecast/telemetry/weather source, date, status and current values |
| Gaps | 15 | Explicit hazards, unavailable/missing modules, data gaps and limitations |
| Other | 5 | Legacy or additional context fields, subject to the same bounds |
| Surface | 55 | Complete compact `surfaceAssessment`: active identity, rock/cavity assumptions and geometry, uncertainty, source and unresolved properties |
| Discovery | 40 | Compact Discovery candidate/target identity, selected comparison components, displayed index, provenance and method limitations |

Section reservations total 430; the 400-field limit reserves eleven entries for
projection metadata, leaving at most 389 factual entries. The projection applies
the section reservations in round-robin order within that factual limit, then
shares any unused capacity in section order. Sibling
branches are interleaved, and object keys have a stable semantic order with a
lexical tie break; JSON insertion order does not decide which facts survive.
Each section's scan allowance is divided across its supplied roots so a large
Earth object cannot consume the target identity's entire allowance.

Scientific field names, original list indices, values and `null` are retained.
The existing alias `earth.telemetry.values.temperatureC` →
`earth.telemetry.temperatureC` remains supported. Copilot citations are still
filtered against paths actually sent; citation cleanup additionally recognizes
expedition, scenario, site, DEM, landing and preparation paths. Both provider
messages explain that transport coverage is not scientific evidence.

## Omission and bounds

Raster/elevation data, raw paths, trajectories, histories, event logs, hourly
series and thermal curves are excluded before traversal. Numeric window
duration fields named `hours` remain intact. Repeated landing profiles retain
identity/source metadata; actual run limits and outcomes remain eligible.
These omissions do not establish a safe route, a subsurface feature, material
properties, a successful run or planetary equivalence.

At most 24 entries of an eligible list are inspected, using the caller's order.
Inspection/evidence lists use the last 24 entries with their original indices;
ranked process-window lists use the first three entries. Short scalar lists
remain single values when they fit the 4,096-byte value bound. Larger scalar
lists are represented by indexed fields. No new ranking, rounding, unit
conversion, interpolation or scientific result is calculated by the server.

Additional bounds are 128 object fields per object, depth 14, a 4,096-node scan
allowance per section, 2,048 characters and 4,096 UTF-8 bytes per string,
20,000 serialized factual bytes per section, and 65,536 factual bytes overall.
The complete flattened JSON is bounded to 131,072 UTF-8 bytes. Diagnostic path samples
are removed first if needed to meet that final ceiling; coverage counts and
retained facts remain. Oversized strings, unsafe keys, non-finite/oversized
numbers, invalid Unicode, cycles and non-JSON values are omitted explicitly.
These are projection bounds, not limits on the HTTP parser's input allocation.

`contextProjection` is reserved server transport metadata with version
`provider-context/1`, bounds and section reservations. Each
`contextProjection.sections.<section>` entry contains:

- `supplied`: whether the caller supplied a root owned by this section.
- `eligibleFields`, `retainedFields`, `omittedEligibleFields`: exact counts for
  fields found in the inspected, eligible portion. Uninspected descendants and
  excluded raw arrays are not counted as eligible fields.
- `budgetOmissionReason`: field limit, section byte limit or global byte limit
  when an eligible suffix could not be retained.
- `omittedFieldPaths`: up to four original paths from that eligible suffix;
  `omittedFieldPathsComplete` states whether the list accounts for every omitted
  eligible field. Budget counts remain exact when the sample is incomplete.
- `omissionCounts`: counts of encountered omission events by reason. A whole
  excluded subtree is one event, not an invented count of all its leaves.
- `examples`: up to 12 path/reason records, including original and inspected
  list lengths and starting index where applicable; `examplesComplete` states
  whether every omission event has an example.
- `complete`: true only when every eligible field was retained and no omission
  event occurred. This describes representation coverage, not data validity or
  scientific completeness. An absent section has `supplied: false`.

List examples describe **inspected** entries. Later field/byte budgeting can
still omit some of their fields, as shown by `omittedEligibleFields`. A missing
scientific value is never changed to zero; no numerical conclusion should be
drawn from transport limits. Original full snapshots and exports remain the
source for evidence outside this bounded projection. The server does not
invent provenance, resolution, timestamps or module states absent from a caller.

## Regression evidence

`server/tests/provider_context_fixture.mjs` reads published scenarios, DEMs,
archived weather and the 72-hour forecast without rewriting them. It runs the
real candidate/M2, M3, dossier, compact landing and Earth expedition pure models.
It reconstructs the compact Mission Control shape from the published Jezero
run, including confirmed preparation and target-first landing evidence.

`server/tests/test_context_projection.py` captures the actual mocked HTTP
provider request for **both endpoints** for a full lava-tube dossier, a
destination run and an Earth expedition. It checks identities, decision
results, source/date/resolution, calibration gaps, M3 windows, JSON nulls,
citation filtering, exclusion canaries and parity with the projection used for
the provider request. Further checks cover list selection, simultaneous section pressure,
deterministic order, honest field coverage and malformed/large inputs. Tests use
fake keys and a mocked `.invalid` provider, with external sockets blocked by the
backend test fixture. No real provider response quality is asserted.

Run with the existing Python test environment and Node.js available:

```sh
python -m pytest server/tests/test_context_projection.py
python -m pytest server/tests
npm run check
```

Provider URL/model/fallback/key configuration, retry/error behavior, response
schemas and conversation history forwarding are preserved. There is no local
estimated-token rejection; the bounded context projection still applies. This
repair does not establish browser/session isolation: callers still own correct
active-session selection and the provenance they supply.
