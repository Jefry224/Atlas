# Automatic surface, rock and cavity evidence

Terrain 3D / Earth expeditions and destination missions share an automatic, location-scoped surface assessment in **Flight Director → Surface, rocks & cavities**. Terrain 3D also has a direct analysis toolbar beside the expedition. The previous empty **Rock envelope** form and manual Marius loading action are superseded.

The active location supplies the values automatically. Changing location, body, source DEM or expedition/mission session replaces the assessment. No values are carried from Marius into an Earth or Mars location.

## What is populated

| Evidence | Automatic values | Meaning |
| --- | --- | --- |
| Regional terrain | P95–P5 relief, P90 slope, published TRI when available, otherwise mean adjacent-node relief | Regional DEM geometry; not individual rock dimensions |
| Source scale | Native DEM resolution, node spacing and their coarser effective scale | Display imagery and interpolation do not improve elevation detail |
| Terrain profile | Central east–west row, distance and elevation in metres | Actual DEM samples, with labeled axes; not a decorative rock model |
| Lunar Marius pit | Inner opening 55 × 49 m and depth 40 m | Published stereo estimate from the [LROC Pit Atlas](https://lroc.im-ldi.com/atlases/pits/1), not a DEM detection |
| Marius derived geometry | Elliptical opening area, cylindrical pit envelope and ideal gravity-only drop time in exports/context | Geometric models; not connected cave volume, usable shelter capacity or a descent design |
| La Corona | Documentary tube context and the existing local source link | Surface approach DEM, without invented interior dimensions or roof geometry |
| Other cavities | Explicit absence of supplied measured geometry | Does not establish presence or absence of underground voids |

Individual rock dimensions, density and mass are not supplied by the published regional DEMs. They remain unknown. The UI explains the required stereo/lidar and material survey instead of presenting an empty calculator or deriving a fictitious boulder from grid spacing. Regional roughness is not rock size; radar backscatter is not used as a dimension or density estimate.

Published metrics are retained when present. Otherwise regional slopes use finite differences, relief uses interpolated elevation quantiles, and adjacent-node relief is the mean absolute elevation change across horizontal/vertical neighbours. The latter is labeled separately from published TRI. The active grid must match the selected site and body. Missing or foreign grids produce no borrowed terrain values.

## Reports and Flight Director

Standalone JSON and Markdown exports carry location, body, session, source, actual regional values, local cavity provenance and unresolved properties. `surface-assessment/1` keeps its existing rock/cavity fields and adds `automatic` with the new regional evidence and interpretation. Historical explicit-hypothesis reports remain readable by the existing pure calculation and Markdown functions.

Earth field reports include the matching surface snapshot and freeze it at closure. Mission JSON adds it as `surfaceAssessment`; the fixed M2 spreadsheet contract is unchanged. The active Earth audit is separately exported as `earthAnalysis` in mission JSON.

The automatic `surfaceAssessment` provider DTO excludes raster/profile arrays and fits the existing 55-field reservation. Flight Director receives the active Earth M2 reference and process summary when applicable. Local rules explain the same captured regional evidence. Location/session/reference changes invalidate pending conversation results. Neither AI nor local rules infer individual boulders, buried rock volume, cave connectivity, roof stability or safe access.

## Implementation and checks

- `surface-evidence.mjs`: pure source/identity checks and automatic regional evidence.
- `surface-assessment.mjs`: compatible geometric calculations, compact transport, Markdown and local answers.
- `surface-assessment-ui.mjs`: automatic cards, measured profile and actual export controls.
- `earth-analysis*.mjs/css`: independent Earth M2 workspace and active-site process context; see [Earth analysis](earth-analysis.md).
- Pure tests cover all published catalogue DEMs, exact synthetic gradients, identity rejection, Marius-only geometry and bounded context.
- `scripts/qa-earth-analysis.py`: real browser controls and export Blobs, using explicit local weather/provider transport fixtures. Earlier `surface-assessment` and `surface-reference-access` evidence describes the superseded manual interface, not the current controls.
