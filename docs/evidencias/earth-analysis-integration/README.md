# Earth workspace integration with the modular repository

Integration base: team main `2a3f9f8` (Discovery chat, reorganized docs and `src/<module>/`). Local work was saved first as `9017da7` (field departure/design) and `d3b1e82` (automatic surface and Earth M2/M3 workspace) on `feature/earth-analysis-workspace`.

The three content conflicts were entry-page resources, Mission Control imports and the surface provider fixture. Their combined resolutions keep the team paths and the local features. New field analysis files move into `src/expedition/`, automatic terrain evidence into `src/mission/`, and the ID helper into `src/shared/`. Module guide links follow the new `docs/modules/` location. A duplicate, unreachable Discovery dispatch branch was removed without changing the context policy.

Validation on 2026-11-15:

- `npm run check`: **404 JavaScript tests passed**, including source syntax and a new recursive public-page dependency/style-asset check.
- Backend: **170 tests passed**, including Discovery and automatic surface context projection.
- `browser.json`: **22 desktop/mobile checks passed** on actual Mission Control controls, actual export Blobs, automatic surface values, independent Earth/destination M2 sessions, active-site processes, Marius-only pit geometry, report closure and a delayed provider-response race. WebGL was active; no uncaught browser errors or unhandled rejections occurred.
- `public-pages.json`: **8 additional checks passed** for Discovery chat transport and target reset, the linked M4 route form and Dossier loading/provider fallback.
- `preservation.json`: all 51 local work files are present at their appropriate paths. Feature logic is preserved; module imports and integration points adapt to the new layout.
- `provider-projection.json`: actual captured Earth and Discovery contexts remain bounded; automatic surface evidence is retained completely.

External AI/weather services were replaced with explicit local transport fixtures for browser QA. The checks do not certify external AI response quality or weather accuracy. Historical evidence folders retain their original interface/source cutoffs. No published scientific data or source assets were regenerated.

`source-sha256.json` records the integrated production-source cutoff. The screenshots and JSON/Markdown reports are actual browser outputs. README/docs-only publication notes do not change that production-source cutoff.
