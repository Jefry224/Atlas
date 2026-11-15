# Flight Director, rocks and cavities

Both **Terrain 3D** and **Mission to destination** expose a shared decision workspace in the Flight Director side drawer. Flight Director is visible in both modes; Earth preparation also has a direct jump button. Its location/session badge and suggestions follow the active mode. A configured AI provider receives the captured context; without one, Earth rules and local rock/cavity calculations remain available. No API key is added to the browser.

## Use the estimates

1. Open an Earth expedition or destination mission. Choose **Rock envelope** or **Cavity / vertical pit** in **Rocks & cavities**, available from the Flight Director tab or its estimates link.
2. Enter dimensions or explicitly load the what-if example. Empty fields remain unavailable. Example dimensions, density, clearance and uncertainty are operator assumptions, not detections or instrument readings.
3. Inspect the dimension-scaled schematic, results and next-evidence recommendation. Both object types retain their own inputs within the current context.
4. Ask Flight Director or download JSON/Markdown. Input edits clear conversation scope and reject replies from a superseded revision.
5. Location, DEM or mission-session changes clear working estimates. Earth field reports capture the matching estimate snapshot while open and freeze it on closure. Later planning edits do not rewrite closed reports. Mission JSON adds the current assessment; fixed M2 spreadsheets and destination flight physics keep their contracts.

## Values and meaning

| Output | Method and useful question |
| --- | --- |
| Rock envelope volume | Full-axis ellipsoid, `pi × length × width × height / 6`. Shape and buried volume are unresolved. |
| Conditional rock mass | Envelope volume times the entered density interval. No rock type is inferred; both density bounds are required. |
| Modeled weight | Conditional mass times the active body's existing gravity constant. Mass stays independent of gravity. |
| Height / proposed clearance | A geometry ratio using operator clearance; it does not establish traversability, traction or wheel support. |
| Pit opening area | Ellipse, `pi × length × width / 4`; compares a survey footprint with a documented pit. |
| Vertical pit envelope | Opening area times depth. A cylindrical approximation, not connected cave volume, usable shelter capacity or a mapped chamber. |
| Ideal drop time | `sqrt(2 × depth / gravity)`, from rest without drag. A gravity comparison, not a descent, tether or access design. |
| DEM samples across | Smaller horizontal dimension divided by the coarser of native resolution and grid spacing. Both scales are required; the ratio does not prove detection. |
| Survey spacing target | Smaller dimension divided by three. An editorial planning target, not a validated detection threshold or accuracy. |

An entered axis uncertainty applies to every axis: area bounds scale quadratically and volume bounds cubically. These conditional envelopes are not confidence intervals. Missing uncertainty stays `null`, not zero; nominal estimates can still be computed. Invalid values disable the affected numerical estimate.

## Published cavity comparison

The [LROC Pit Atlas entry for Marius Hills](https://lroc.im-ldi.com/atlases/pits/1), checked 2026-11-15, supplies inner diameters **55 × 49 m** and **40 m** stereo-derived depth. The larger funnel is a different measurement and is not mixed with those inner dimensions. Uncertainty is not provided for this calculation.

The published-reference card is visible above the inputs in both estimate tabs and every location. **Use published Marius pit dimensions** is enabled in the Marius lunar mission, including while Rock envelope is selected; it switches to the cavity calculator and fills the cited dimensions. Elsewhere, **Open Marius mission & load published values** explicitly opens that lunar mission and loads the reference. Measurements are never copied into another site's inputs. That source label requires the exact values, their own lunar site and unavailable uncertainty. Editing an input creates an operator hypothesis. Other Earth or Mars sites can compare opening area with Marius but do not acquire its source attribution or a local cavity. Roof thickness, stability, connected extent, material, ice, shielding and access remain unknown.

## Integration

`surface-assessment.mjs` owns pure calculations, compact provider context, local answers and Markdown. `surface-assessment-ui.mjs` owns the form, schematic, revision and exports. Shared wiring supplies active identity and the existing copilot; styles are isolated in `surface-assessment.css`. No dependencies or published terrain regeneration are required.

Reports use `surface-assessment/1`. The compact provider root `surfaceAssessment` fits its 55-field reservation, including input basis, dimensions, uncertainty, results, nulls and scope. Both AI endpoints share this projection; citation paths recognize the new root. The prompt forbids turning estimates or source scale into detected geology or certified access. Local fallback uses an immutable request snapshot.

Actual rock/cavity detection requires calibrated images, stereo/lidar, radar or other local measurements appropriate to the feature and environment.
