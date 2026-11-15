# A.R.E.S. Twin — demo script (3 minutes)

Goal: show the four scenarios, the rover simulation, the geometric similarity index and the copilot, without promising anything that is not on screen.

Items marked **[pending verification]** depend on other workstreams (data, backend, frontend). Rehearse with the final build and, if something fails, jump to the plan B line.

> Spanish version: [demo-script.es.md](demo-script.es.md).

## Before starting (checklist, 5 min before)

- [ ] `npm run check` green.
- [ ] Local server running (`npm start` → `http://localhost:8000`) or deployed URL open **[pending verification: domain / Cloud Run]**.
- [ ] `GET /api/health` responds and shows the weather and AI provider **[pending verification]**. If `ai: "none"`, the copilot uses local rules (that is expected; say so).
- [ ] The 4 scenarios load the Earth + target grid **[pending verification: workstreams 1 and 2]**.
- [ ] Backup tab open with the offline version (see plan B).
- [ ] Copilot questions ready in a notepad to copy and paste.

## Script (≈ 180 s)

| Time | Screen | What to say / do |
| --- | --- | --- |
| 0:00–0:20 | Console, **Hyperarid saline plain** scenario (Atacama ↔ Jezero) | “On the left, Atacama with telemetry [live / snapshot: read the actual label]; on the right, Jezero Crater. The same 2.4 km window for both.” |
| 0:20–0:50 | Similarity panel | Read the index and **one** component. “This is a geometric similarity index: terrain slopes, relief and roughness. It does not measure chemistry or gravity, and the interface says so.” |
| 0:50–1:20 | Rover in Atacama (WASD or auto mode) | Drive toward a slope. Point out pitch/roll, solar power and battery. “Power comes from irradiance × area × efficiency × cosine; consumption from rolling resistance plus slope.” |
| 1:20–1:50 | Copilot | Ask: *“What is the risk of thermal failure if we deploy the rover here today?”*. Read the recommendation and the cited provenance (live / snapshot / literature). |
| 1:50–2:15 | **Shadowed polar crater** scenario (Wright Valley ↔ Shackleton) | “Here the analogue is cold, but Shackleton sits at tens of kelvin according to LRO Diviner [pending verification: workstream 2 data].” Ask the copilot: *“What about solar power?”* → upper bound and grazing-Sun warning. |
| 2:15–2:35 | **Wind-eroded canyon** scenario (Wadi Rum ↔ Valles Marineris) | Show p90 slope and the tilt alert. If Valles Marineris shows as **not comparable** (coarse DEM), show it: “When the resolution isn't enough, we flag it.” |
| 2:35–2:50 | **Volcanic lava tube** scenario (Lanzarote ↔ Marius Hills) | Quick look: basaltic terrain; focus on shielding and thermal stability. Do not claim the tube interior is modelled. |
| 2:50–3:00 | Close | “Four twins, reproducible metrics and a copilot that tells you where every number comes from.” |

## Prepared copilot questions

- “What is the risk of thermal failure if we deploy the rover at this analogue today?”
- “Is the battery enough with today's sun?” / “battery and solar power?”
- “Is there a rollover risk on this slope?”
- “How do wind and dust affect us?”
- “How similar is this terrain to the target?”
- “Give me a GO / NO-GO summary.”

## Offline plan B

1. **No backend or no internet:** the frontend uses `assets/data/telemetry-snapshot.json` **[pending verification: workstream 3]**. Say out loud: “This is a saved snapshot, not live telemetry”; the provenance label shows it.
2. **No AI key or `/api/copilot` → 503:** the copilot answers with `copilot-rules.mjs` (`provider: rules`, `model: rules-v1`). It works offline and only uses numbers from the context. Say: “Now the local rules engine is answering.”
3. **No local server:** serve the folder with `python3 -m http.server 8000` from the laptop; scenarios and grids are static JSON in the repository **[pending verification: that the 8 grid JSON files are in `assets/data/scenarios/`]**.
4. **If 3D fails:** show the similarity panel and the copilot; narrate the simulation with the HUD numbers or a prepared screenshot.
5. **Last resort:** recorded video of the full demo (record it after the final rehearsal).

## What NOT to say

- “% planetary similarity”, “Mars replica”, “validated by NASA”.
- “Live” about a value labelled snapshot, literature or model.
- Figures for integrated ecosystems that are not shown working in the final build.
