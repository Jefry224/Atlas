// Read-only integration fixtures built by the real browser-side pure models.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDossierContext } from '../../src/dossier/dossier-context.mjs';
import { buildCandidateAnalogPayload } from '../../src/audit/analog-audit.mjs';
import { automaticEngineering } from '../../src/audit/mission-audit.mjs';
import { analyzeProcesses, summarizeProcesses } from '../../src/processes/processes.mjs';
import { compactLanding } from '../../src/landing/landing-report.mjs';
import { createExpedition, confirmExpedition, startExpedition, stepExpedition, inspectStop, finishExpedition, expeditionContext } from '../../src/expedition/earth-expedition.mjs';

const root = new URL('../../', import.meta.url);
const read = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, root)), 'utf8'));
const scenarios = read('assets/data/scenarios.json').scenarios;
const weather = read('assets/data/telemetry-snapshot.json');
const forecasts = read('assets/data/processes-forecast-snapshot.json');
const scenario = scenarios.find(s => s.id === 'lava-tube');
const earthGrid = read(scenario.earth), targetGrid = read(scenario.target);
const telemetry = weather[scenario.earthId], forecast = forecasts[scenario.earthId];
const candidate = buildCandidateAnalogPayload({ scenario, earthGrid, targetGrid, telemetry });
const { audit } = automaticEngineering(candidate);
const processes = analyzeProcesses(forecast, targetGrid, { nowMs: Date.parse(forecast.fetchedAt) });
const dossier = buildDossierContext({ scenario, earthGrid, targetGrid, telemetry, forecast, analogyAudit: audit, processes });

// Match the published Mission Control run and its compactLanding interface,
// without importing mission.js (which needs DOM, WebGL and asynchronous data).
const saved = read('docs/evidencias/preparacion-rendimiento/nominal-jezero-mission.json');
const a = saved.analogyDossier.audit, c = saved.analogyDossier.candidate, k = a.calibration;
const destinationScenario = scenarios.find(s => s.id === c.scenario.id);
const destinationEarth = read(destinationScenario.earth), destinationTarget = read(destinationScenario.target);
const destination = {
  scenario: c.scenario,
  earth: { id: c.earth.id, name: c.earth.name, metrics: c.earth.metrics, telemetry: c.earth.telemetry, thermal: destinationEarth.thermal },
  target: { id: c.target.id, name: c.target.name, body: c.target.body, metrics: c.target.metrics, thermal: destinationTarget.thermal, environment: destinationTarget.environment },
  preparation: saved.preparation,
  targetRover: saved.targetRover, rover: saved.rover,
  analogyAudit: { version: a.version, scenarioId: c.scenario.id, counts: a.counts,
    landing: compactLanding(saved.landing), roverBody: 'earth', targetBody: c.target.body,
    roles: { earth: 'analogue-test-origin', target: 'target-contact', weather: 'earth-provider-model', instruments: 'proposed-design-no-hardware' },
    matrix: a.matrix.map(({ id, status, breakdown }) => ({ id, status, breakdown })),
    calibration: { kind: k.kind, equipment: k.equipment, targetBody: k.targetBody, massKg: k.inputs.massKg, gravity: k.gravity, pressure: k.pressure, thermal: k.thermal },
    limitation: 'Static loads only; no dynamic, thermal or radiation equivalence. No mission authorization.' },
  processes: summarizeProcesses(analyzeProcesses(forecasts.atacama, read('assets/data/scenarios/targets/jezero.json'), { nowMs: Date.parse(forecasts.atacama.fetchedAt) })),
  hazards: null, unavailableModules: ['Module 4 subsurface and hazard analysis is unavailable.'],
};

const site = { id: scenario.earthId, name: earthGrid.name, lat: earthGrid.center[0], lon: earthGrid.center[1], sources: earthGrid.provenance };
const session = createExpedition({ site, grid: earthGrid, scenario, targetGrid,
  config: { objective: 'shelter', payloadKg: 12, slopeLimitDeg: 30, energyBudgetPct: 80 },
  stops: [{ name: 'Baseline', x: 0, z: 0 }, { name: 'Approach context', x: earthGrid.spacingMeters * 2, z: 0 }], now: '2026-11-15T10:00:00Z' });
session.sessionId = 'provider-fixture-earth-session';
if (!confirmExpedition(session, true, '2026-11-15T10:01:00Z')) throw new Error('Published DEM cannot support fixture plan');
if (!startExpedition(session, '2026-11-15T10:02:00Z')) throw new Error('Fixture expedition did not start');
for (let i = 0; i < 2000 && session.phase !== 'review'; i++) {
  if (session.phase === 'inspection') {
    inspectStop(session, { telemetry, note: 'Review source-linked DEM evidence; material properties are unknown.', now: '2026-11-15T10:03:00Z' });
    if (session.phase === 'paused') startExpedition(session, '2026-11-15T10:03:01Z');
  } else stepExpedition(session, .1, { now: '2026-11-15T10:03:02Z' });
}
if (session.phase !== 'review') throw new Error(`Fixture expedition failed: ${session.phase}`);
finishExpedition(session, '2026-11-15T10:04:00Z');
const expedition = {
  domain: 'earth-field-expedition', earthExpedition: expeditionContext(session),
  hazards: null, unavailableModules: ['Module 4 subsurface analysis and field safety evidence are unavailable.'],
};
process.stdout.write(JSON.stringify({ dossier, destination, expedition }));
