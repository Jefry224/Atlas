# Published Marius reference access

The previous load button was rendered only in the Cavity tab of the Marius lunar mission. It was absent in Earth mode, other destinations and the Rock tab, without explaining how to reach it.

The reference card now appears before the inputs in both tabs at every location. It exposes the LROC source and the published-load action. Outside Marius, the disabled local-load action is explained and an explicit navigation action opens the Marius lunar mission, waits for selection, verifies it is still active and loads the cited dimensions. At Marius, loading from either tab selects Cavity. No lunar geometry or published attribution is copied into Earth/Mars cases.

`browser.json` records seven passing checks on an owned Orca page through actual controls and export Blobs: visibility from Earth/Rock, one-action reference navigation, correct lunar identity and provenance, loading from the Rock tab, Mars isolation, mobile layout and a superseded-navigation race. `published-from-earth.json` and `rapid-navigation.json` are actual exported snapshots; the two screenshots show the card and actions. Weather/provider availability was locally suppressed by the existing QA fixture; no external AI request or terrain/controller override was used.

`npm run check` passed all 346 JavaScript tests and syntax discovery. Backend code and schemas are unchanged; backend checks were not repeated. Unrelated local departure-UX changes were preserved and are outside this fix's commit. The source manifest identifies the three production files changed for this fix.
