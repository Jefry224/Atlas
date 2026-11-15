// Earth-only expedition model. Coordinates are metres east (x) and south (z) of the DEM centre.
import { validGrid, gridExtent, roverLimit, sampleHeight, sampleSlope, elevationRange, newRover, advanceRover, localCoordinates } from './mission-math.mjs';
import { compareTerrain } from './similarity.mjs';

export const EXPEDITION_VERSION = 'earth-expedition/1';
export const OBJECTIVES = Object.freeze({
  mobility: { title: 'Traverse reconnaissance', task: 'Prepare a Moon or Mars rover route reconnaissance method by comparing regional slopes and relief at two or more stops.', equipment: 'Navigation camera', supports: 'Regional terrain variation and a repeatable remote reconnaissance workflow.', unresolved: 'Wheel traction, bearing capacity, small obstacles and autonomous perception require field measurements.', next: 'Acquire rover-scale stereo or lidar and measure traction before choosing a field traverse.' },
  sampling: { title: 'Sampling campaign design', task: 'Prepare a Mars sampling campaign by documenting terrain context and access between candidate inspection stops.', equipment: 'Context camera + sample handling mock-up', supports: 'Terrain context and the order of candidate sampling inspections.', unresolved: 'Mineralogy, biosignatures, contamination, drillability and soil chemistry have not been measured.', next: 'Validate access in the field, collect permitted samples and run mineralogy and contamination controls.' },
  shelter: { title: 'Lunar shelter reconnaissance', task: 'Prepare a lunar base shelter survey by documenting surface approach slopes and relief around a candidate sector.', equipment: 'Survey camera + lidar mock-up', supports: 'Surface approach geometry at DEM scale and survey planning.', unresolved: 'Cave presence, roof stability, radiation shielding, ice and subsurface access are unresolved.', next: 'Obtain a subsurface survey, structural assessment and illumination data before selecting a shelter candidate.' },
});
export const LIMITATIONS = Object.freeze([
  'An Earth remote reconnaissance simulation, not a field visit or mission certification.',
  'DEM elevations and slopes describe regional terrain; interpolation adds no detail. No sub-DEM rocks, safe zones or soil measurements are inferred.',
  'Comparable topography is not planetary similarity or field feasibility. Earth gravity, atmosphere, radiation, water and biology differ from Moon and Mars conditions.',
  'Rover motion, payload activity and battery use are illustrative SIM models; no spacecraft descent or target telemetry is generated.',
  'Stop arrival tolerance (5 m) is a simulated position threshold, not DEM accuracy or an instrument footprint.',
]);
export const DEFAULT_CONFIG = Object.freeze({ objective: 'mobility', payloadKg: 12, slopeLimitDeg: 15, energyBudgetPct: 20 });
const finite = Number.isFinite;
const clone = value => JSON.parse(JSON.stringify(value));
const utc = () => new Date().toISOString();
const demIds = new WeakMap();
function frozenCopy(value) {
  if (!value || typeof value !== 'object') return value;
  const copy = clone(value);
  const freeze = node => { if (node && typeof node === 'object') { Object.values(node).forEach(freeze); Object.freeze(node); } return node; };
  return freeze(copy);
}
const id = () => `earth-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
export const arrivalDistanceM = 5;
export function demIdentity(grid) {
  if (grid && Object.isFrozen(grid) && demIds.has(grid)) return demIds.get(grid);
  if (!validGrid(grid)) return null;
  let hash = 2166136261;
  const identity = JSON.stringify([grid.dataset, grid.source, grid.fetchedAt, grid.center, grid.gridSize, grid.spacingMeters, grid.elevation]);
  for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619);
  const result = `dem-${(hash >>> 0).toString(16)}`;
  if (Object.isFrozen(grid)) demIds.set(grid, result);
  return result;
}
export function demEvidence(grid) {
  if (!validGrid(grid)) return null;
  return { identity: demIdentity(grid), dataset: grid.dataset || null, source: grid.source || null,
    fetchedAtUTC: grid.fetchedAt || null, center: grid.center || null, bbox: grid.bbox || null,
    gridSize: grid.gridSize, spacingMeters: grid.spacingMeters, nativeResolutionMeters: grid.nativeResolutionMeters || null,
    extentMeters: gridExtent(grid), elevationRangeM: elevationRange(grid), metrics: grid.metrics || null,
    imagery: grid.imagery ? { source: grid.imagery.source || null, acquiredUTC: grid.imagery.acquired || null, credit: grid.imagery.credit || null } : null,
    provenance: grid.provenance || [], notes: grid.notes || [] };
}
// Existing comparison engine, restricted to topography: no thermal or radar term mixed into the index.
export function benchmarkEvidence(grid, scenario, targetGrid) {
  if (!scenario) return { scenario: null, comparison: null, targetDEM: null, reason: 'No paired planetary benchmark is published for this catalogue site. Select a documented reference before making a quantitative comparison.' };
  const geometry = value => ({ name: value?.name, metrics: value?.metrics ? { ...value.metrics, roughness: null } : null });
  const result = compareTerrain(geometry(grid), geometry(targetGrid));
  return { scenario: { id: scenario.id, body: scenario.body, targetId: scenario.targetId, targetName: targetGrid?.name || scenario.targetLabel || scenario.targetId },
    targetDEM: demEvidence(targetGrid), comparison: { index: result.index, comparable: result.comparable,
      components: result.components.map(({ key, unit, earth, target, score, weight }) => ({ key, unit, earth, target, score, weight })),
      scope: 'Regional topography only; editorial weights, not calibrated against missions. Radar and thermal terms excluded.' },
    reason: !validGrid(targetGrid) ? 'Paired target DEM is missing. No quantitative benchmark is available.' : result.index === null ? 'Required published terrain metrics are missing. No index is calculated.' : !result.comparable ? 'Native resolution is too coarse for scale comparability; the index is indicative only.' : 'Published DEM metrics support a regional topography comparison only.' };
}
function energyRate(config, slope = 0, moving = true) {
  // Same 20x kinematic rover, with an explicit editorial payload/grade multiplier. No calibrated physics.
  return (moving ? .0018 : .0004) * (1 + config.payloadKg / 100) * (1 + Math.max(0, slope) / 30)
    + (config.objective === 'mobility' ? .0001 : .0003);
}
export function evaluatePlan(grid, config, stops) {
  const errors = [];
  if (!validGrid(grid)) errors.push('A valid Earth DEM is required. Choose another site or retry the published DEM.');
  if (!OBJECTIVES[config?.objective]) errors.push('Choose a supported operational objective.');
  for (const [key, min, max, label] of [['payloadKg', 0, 80, 'Payload (0–80 kg)'], ['slopeLimitDeg', 1, 30, 'Regional slope ceiling (1–30°)'], ['energyBudgetPct', 1, 80, 'SIM energy allowance (1–80%)']]) {
    if (!finite(config?.[key]) || config[key] < min || config[key] > max) errors.push(`${label} must be a finite number in range.`);
  }
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 6) errors.push('Plan 2–6 distinct inspection stops.');
  const limit = roverLimit(grid);
  for (const [i, stop] of (Array.isArray(stops) ? stops : []).entries()) {
    if (!stop || !finite(stop.x) || !finite(stop.z) || Math.abs(stop.x) > limit || Math.abs(stop.z) > limit) errors.push(`Stop ${i + 1} is invalid or outside the supported rover window (±${limit.toFixed(0)} m).`);
    if (stop && stops.slice(0, i).some(p => p && Math.hypot(p.x - stop.x, p.z - stop.z) < Math.max(10, grid?.spacingMeters || 10))) errors.push(`Stop ${i + 1} is too close to another stop; separate stops by at least one grid spacing (minimum 10 m).`);
  }
  if (errors.length) return { valid: false, errors, distanceM: null, maxSlopeDeg: null, energyEstimatePct: null, simSeconds: null, legs: [] };
  const legs = []; let distanceM = 0, maxSlopeDeg = 0, energyEstimatePct = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i], distance = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(distance / Math.min(grid.spacingMeters / 2, 30)));
    let maximum = 0;
    for (let j = 0; j <= steps; j++) maximum = Math.max(maximum, sampleSlope(grid, a.x + (b.x - a.x) * j / steps, a.z + (b.z - a.z) * j / steps));
    if (maximum > config.slopeLimitDeg) errors.push(`Leg ${i} exceeds the ${config.slopeLimitDeg}° regional slope ceiling (${maximum.toFixed(1)}°). Edit the traverse or constraints; no permitted direct route is available.`);
    distanceM += distance; maxSlopeDeg = Math.max(maxSlopeDeg, maximum);
    const energy = distance / .8 * energyRate(config, maximum);
    energyEstimatePct += energy;
    legs.push({ from: i - 1, to: i, distanceM: distance, maxSlopeDeg: maximum, simSeconds: distance / .8, energyEstimatePct: energy });
  }
  if (energyEstimatePct > config.energyBudgetPct) errors.push(`The modeled drive allowance is exceeded (${energyEstimatePct.toFixed(2)}% > ${config.energyBudgetPct}%). Shorten the traverse or revise the load/allowance.`);
  return { valid: errors.length === 0, errors, distanceM, maxSlopeDeg, energyEstimatePct, simSeconds: distanceM / .8, legs };
}
export function defaultStops(grid) {
  const d = validGrid(grid) ? Math.min(roverLimit(grid), Math.max(grid.spacingMeters, 120)) : 300;
  return [{ name: 'Baseline context', x: 0, z: 0 }, { name: 'Terrain contrast', x: d, z: -d }];
}
export function createExpedition({ site, grid, scenario = null, targetGrid = null, config = DEFAULT_CONFIG, stops = defaultStops(grid), now = utc() }) {
  grid = frozenCopy(grid);
  return { schema: EXPEDITION_VERSION, sessionId: id(), site: { id: site.id, name: site.name, lat: grid?.center?.[0] ?? site.lat, lon: grid?.center?.[1] ?? site.lon, coordinateRole: 'DEM window centre; catalogue reference retained separately', catalogueReference: site.coordinateSource==='paired-dem'?null:{ lat: site.lat, lon: site.lon }, sources: clone(site.sources || []) },
    grid, demId: demIdentity(grid), benchmark: benchmarkEvidence(grid, scenario, targetGrid), config: { ...config }, stops: clone(stops),
    phase: 'draft', createdAtUTC: now, confirmedAtUTC: null, startedAtUTC: null, finishedAtUTC: null,
    plan: null, nextStop: 0, inspections: [], observations: { maxSlopeDeg: null, elevationMinM: null, elevationMaxM: null, energyUsedPct: 0 },
    rover: newRover(), events: [], blockedReason: null, activeMode: 'auto' };
}
function event(session, type, detail, now = utc()) {
  session.events.push({ atUTC: now, simSeconds: session.rover.elapsed, type, detail });
  if (session.events.length > 100) session.events.shift();
}
export function confirmExpedition(session, reviewed, now = utc()) {
  if (session.phase !== 'draft' || !reviewed || demIdentity(session.grid) !== session.demId) return false;
  const plan = evaluatePlan(session.grid, session.config, session.stops);
  if (!plan.valid) return false;
  session.plan = clone({ config: session.config, stops: session.stops, evaluation: plan, demId: session.demId });
  session.confirmedAtUTC = now; session.phase = 'ready';
  Object.assign(session.rover, { x: session.stops[0].x, z: session.stops[0].z, path: [[session.stops[0].x, session.stops[0].z]] });
  event(session, 'preparation-confirmed', 'Objective, load, DEM and traverse explicitly reviewed.', now);
  return true;
}
function preparationCurrent(session) {
  return session.plan && session.demId === demIdentity(session.grid) && session.plan.demId === session.demId
    && JSON.stringify(session.plan.config) === JSON.stringify(session.config) && JSON.stringify(session.plan.stops) === JSON.stringify(session.stops);
}
export function startExpedition(session, now = utc()) {
  if (!['ready', 'paused'].includes(session.phase) || !preparationCurrent(session)) return false;
  session.startedAtUTC ||= now; session.blockedReason = null;
  session.phase = Math.hypot(session.rover.x - session.stops[session.nextStop].x, session.rover.z - session.stops[session.nextStop].z) <= arrivalDistanceM ? 'inspection' : 'running';
  event(session, 'resume', session.phase === 'inspection' ? 'At planned stop; inspect before continuing.' : 'Following the confirmed Earth traverse.', now);
  return true;
}
export function pauseExpedition(session, reason = 'Operator pause', now = utc()) {
  if (session.phase === 'running') { session.phase = 'paused'; session.rover.speed = 0; event(session, 'pause', reason, now); }
}
function stopBlocked(session, reason) {
  session.phase = 'blocked'; session.blockedReason = reason; session.rover.speed = 0; event(session, 'blocked', reason);
}
export function setExpeditionMode(session, mode, now = utc()) {
  if (!session || session.phase === 'finished' || !['auto', 'manual'].includes(mode)) return false;
  if (session.activeMode !== mode) { session.activeMode = mode; event(session, 'pilot-mode', mode, now); }
  return true;
}
export function stepExpedition(session, dt, { mode = 'auto', throttle = 0, turn = 0, now = utc() } = {}) {
  const r = session.rover;
  if (session.phase !== 'running') { r.speed = 0; return session; }
  if (!preparationCurrent(session)) { stopBlocked(session, 'Preparation or DEM changed. Reset, review and confirm a new expedition.'); return session; }
  if (!finite(dt) || dt < 0 || !['auto', 'manual'].includes(mode) || !finite(throttle) || !finite(turn)) { stopBlocked(session, 'Invalid drive input. Reset and prepare again.'); return session; }
  setExpeditionMode(session, mode, now);
  const stop = session.stops[session.nextStop], remaining = Math.hypot(stop.x - r.x, stop.z - r.z);
  if (remaining <= arrivalDistanceM) { session.phase = 'inspection'; r.speed = 0; event(session, 'arrived', `Stop ${session.nextStop + 1}`, now); return session; }
  if (mode === 'auto') { r.heading = (Math.atan2(stop.x - r.x, -(stop.z - r.z)) * 180 / Math.PI + 360) % 360; throttle = Math.min(1, remaining / Math.max(.001, .8 * Math.min(dt, .1) * 20)); turn = 0; }
  const candidate = { ...r, path: [] };
  advanceRover(candidate, dt, { running: true, mode: 'manual', throttle, turn, grid: session.grid });
  const slope = sampleSlope(session.grid, candidate.x, candidate.z), height = sampleHeight(session.grid, candidate.x, candidate.z);
  if (slope > session.config.slopeLimitDeg) { stopBlocked(session, `Regional slope ${slope.toFixed(1)}° exceeds the confirmed ${session.config.slopeLimitDeg}° ceiling. Finish with partial evidence or reset to revise.`); return session; }
  const seconds = candidate.elapsed - r.elapsed;
  const used = seconds * energyRate(session.config, slope, candidate.distance > r.distance);
  if (session.observations.energyUsedPct + used > session.config.energyBudgetPct || r.battery - used <= 0) { stopBlocked(session, 'SIM energy allowance exhausted. Finish with partial evidence or reset to revise.'); return session; }
  const priorPath = r.path;
  Object.assign(r, candidate); r.path = priorPath; r.battery = 100 - (session.observations.energyUsedPct += used);
  if (!r.path.length || Math.hypot(r.x - r.path.at(-1)[0], r.z - r.path.at(-1)[1]) >= 8) { r.path.push([r.x, r.z]); if (r.path.length > 1500) r.path.shift(); }
  session.observations.maxSlopeDeg = Math.max(session.observations.maxSlopeDeg ?? 0, slope);
  session.observations.elevationMinM = Math.min(session.observations.elevationMinM ?? height, height);
  session.observations.elevationMaxM = Math.max(session.observations.elevationMaxM ?? height, height);
  if (Math.hypot(stop.x - r.x, stop.z - r.z) <= arrivalDistanceM) { session.phase = 'inspection'; r.speed = 0; event(session, 'arrived', `Stop ${session.nextStop + 1}`, now); }
  return session;
}
// Keep SIM progress independent of a slow rendered frame while preserving the rover's small steps.
export function advanceExpedition(session, wallSeconds, options = {}) {
  if (!finite(wallSeconds) || wallSeconds < 0) return stepExpedition(session, NaN, options);
  let remaining = Math.min(wallSeconds, 1);
  while (remaining > 1e-9 && session.phase === 'running') {
    const dt = Math.min(.1, remaining); stepExpedition(session, dt, options); remaining -= dt;
  }
  return session;
}
function environmentalEvidence(telemetry) {
  if (!telemetry || typeof telemetry.values !== 'object' || !telemetry.values) return null;
  const fields = ['temperatureC', 'windSpeedMs', 'windGustMs', 'solarRadiationWm2', 'relativeHumidityPct', 'pressureHpa'];
  return { kind: telemetry.kind || (telemetry.live === true ? 'current-weather-model' : 'archived-weather-model'), siteId: telemetry.site || null, location: { lat: finite(telemetry.lat) ? telemetry.lat : null, lon: finite(telemetry.lon) ? telemetry.lon : null }, provider: telemetry.provider || null, live: telemetry.live === true,
    source: telemetry.source || null, timestampUTC: telemetry.timestamp || telemetry.observedAt || telemetry.fetchedAt || null,
    provenance: telemetry.provenance || null, values: Object.fromEntries(fields.map(key => [key, finite(telemetry.values[key]) ? telemetry.values[key] : null])),
    scope: 'Site/window environmental context, not a stop measurement; acquisition time is independent of SIM elapsed time.' };
}
export function inspectStop(session, { telemetry = null, note = '', now = utc() } = {}) {
  const stop = session.stops[session.nextStop];
  if (!['running', 'paused', 'inspection'].includes(session.phase) || !stop || !preparationCurrent(session)
    || Math.hypot(stop.x - session.rover.x, stop.z - session.rover.z) > arrivalDistanceM) return false;
  const r = session.rover, center = session.grid.center;
  const position = center?.length === 2 ? localCoordinates({ lat: center[0], lon: center[1] }, r.x, r.z) : { lat: null, lon: null };
  const slope = sampleSlope(session.grid, r.x, r.z), height = sampleHeight(session.grid, r.x, r.z);
  session.inspections.push({ stopIndex: session.nextStop, name: stop.name, atUTC: now, simSeconds: r.elapsed,
    position: { x: r.x, z: r.z, ...position, coordinateKind: 'Approximate local tangent plane from DEM centre' },
    terrain: { elevationM: height, slopeDeg: slope, kind: 'DEM-derived, bilinear interpolation', demId: session.demId,
      spacingMeters: session.grid.spacingMeters, nativeResolutionMeters: session.grid.nativeResolutionMeters || null },
    environment: environmentalEvidence(telemetry?.site && telemetry.site !== session.site.id ? null : telemetry), batteryPct: r.battery, equipment: OBJECTIVES[session.config.objective].equipment,
    materialMeasurement: null, note: String(note).slice(0, 500), finding: `${slope.toFixed(1)}° regional slope, ${height.toFixed(1)} m DEM elevation. ${OBJECTIVES[session.config.objective].supports}` });
  session.observations.maxSlopeDeg = Math.max(session.observations.maxSlopeDeg ?? 0, slope);
  session.observations.elevationMinM = Math.min(session.observations.elevationMinM ?? height, height);
  session.observations.elevationMaxM = Math.max(session.observations.elevationMaxM ?? height, height);
  event(session, 'inspection', `Stop ${session.nextStop + 1}: DEM evidence recorded; no material measurement.`, now);
  session.nextStop++; session.phase = session.nextStop >= session.stops.length ? 'review' : 'paused'; r.speed = 0;
  return true;
}
export function finishExpedition(session, now = utc()) {
  if (!session.startedAtUTC || session.phase === 'finished') return false;
  session.phase = 'finished'; session.finishedAtUTC = now; session.rover.speed = 0; event(session, 'finished', 'Evidence closed for decision review.', now); return true;
}
export function expeditionDecision(session) {
  const objective = OBJECTIVES[session.config.objective] || OBJECTIVES.mobility;
  const complete = session.inspections.length === session.stops.length;
  return { status: complete ? 'Advance to targeted validation' : 'Revise the reconnaissance plan',
    rationale: complete ? `${session.inspections.length}/${session.stops.length} planned stops inspected in SIM. ${objective.supports}` : `${session.inspections.length}/${session.stops.length} planned stops inspected; coverage is incomplete. ${session.blockedReason || 'Complete or revise the traverse before advancing.'}`,
    strengths: [objective.supports, session.grid ? 'Source-linked regional DEM and traceable stop coordinates.' : 'Documentary site context only; terrain evidence is missing.'],
    breakdowns: [objective.unresolved, ...LIMITATIONS.slice(1, 4)],
    nextSteps: [complete ? objective.next : 'Review the uninspected legs, revise constraints or acquire missing terrain data, then repeat the campaign.', 'Choose an independently documented planetary reference and audit scale, geology and environmental differences.', 'Confirm permits, access, field safety and instrument calibration with local specialists.'] };
}
export function expeditionReport(session, now = utc()) {
  return { schema: session.schema, sessionId: session.sessionId, domain: 'earth-field-expedition', body: 'earth',
    exportedAtUTC: now, cutoffAtUTC: session.finishedAtUTC || now, createdAtUTC: session.createdAtUTC, confirmedAtUTC: session.confirmedAtUTC,
    startedAtUTC: session.startedAtUTC, finishedAtUTC: session.finishedAtUTC, status: session.phase,
    site: clone(session.site), dem: demEvidence(session.grid), benchmark: clone(session.benchmark),
    objective: { id: session.config.objective, ...OBJECTIVES[session.config.objective] },
    preparation: session.plan ? clone(session.plan) : { config: clone(session.config), stops: clone(session.stops), confirmed: false },
    rover: { x: session.rover.x, z: session.rover.z, headingDeg: session.rover.heading, distanceM: session.rover.distance,
      simSeconds: session.rover.elapsed, batteryPct: session.rover.battery, mode: session.activeMode, role: 'earth-expedition-rover', timeScale: 20 },
    path: clone(session.rover.path), inspections: clone(session.inspections), observations: clone(session.observations),
    environmentalContext: environmentalEvidence(session.latestTelemetry?.site && session.latestTelemetry.site !== session.site.id ? null : session.latestTelemetry), events: clone(session.events),
    decision: expeditionDecision(session), limitations: [...LIMITATIONS], model: { speedMs: .8, payloadKg: session.config.payloadKg,
      trace: 'The trace retains the latest 1500 positions sampled about every 8 m and the latest 100 session events; total SIM distance and elapsed time cover the full run. Trace sampling is not DEM resolution.',
      energy: 'Percent-per-SIM-second: (moving ? 0.0018 : 0.0004) × (1 + payloadKg/100) × (1 + slopeDeg/30) + (mobility ? 0.0001 : 0.0003). No solar recharge; uncalibrated editorial model. Drive-only estimate excludes operator dwell and instrument analysis.' } };
}
export function expeditionMarkdown(report) {
  const n = (x, d = 1) => finite(x) ? x.toFixed(d) : 'unavailable';
  const safe = x => String(x ?? 'unavailable').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
  const lines = ['# Earth analogue expedition', '', `${report.site.name} · ${report.sessionId}`, '',
    `Status: ${report.status}. Evidence cutoff: ${report.cutoffAtUTC} (UTC). Exported: ${report.exportedAtUTC} (UTC).`,
    `Created: ${report.createdAtUTC}; confirmed: ${report.confirmedAtUTC || 'unconfirmed'}; started: ${report.startedAtUTC || 'not started'}; finished: ${report.finishedAtUTC || 'open'}.`, '',
    '## Operational objective', '', report.objective.task, `Equipment concept: ${report.objective.equipment}. Payload: ${report.preparation.config.payloadKg} kg (SIM).`,
    `Constraints: regional slope ≤ ${report.preparation.config.slopeLimitDeg}°; SIM energy allowance ${report.preparation.config.energyBudgetPct}%.`, '',
    '## DEM evidence', '', report.dem ? `${report.dem.dataset} · ${report.dem.gridSize}×${report.dem.gridSize} nodes · ${report.dem.spacingMeters} m spacing · ${report.dem.nativeResolutionMeters || 'unknown'} m native resolution · ${report.dem.extentMeters} m window.` : 'Earth DEM unavailable.',
    `Source: ${report.dem?.source || 'unavailable'}. Acquired/fetched: ${report.dem?.fetchedAtUTC || 'unavailable'}. DEM identity: ${report.dem?.identity || 'none'}.`,
    `DEM centre: ${JSON.stringify(report.dem?.center || null)}. Bounding box: ${JSON.stringify(report.dem?.bbox || null)}.`, '',
    '## Confirmed plan', '', '| Stop | East x (m) | South z (m) |', '| --- | ---: | ---: |',
    ...report.preparation.stops.map((s, i) => `| ${i + 1}. ${safe(s.name)} | ${n(s.x)} | ${n(s.z)} |`), '',
    `Drive estimate: ${n(report.preparation.evaluation?.distanceM)} m; ${n(report.preparation.evaluation?.energyEstimatePct, 2)}% energy; max regional slope ${n(report.preparation.evaluation?.maxSlopeDeg)}°.`, '',
    '## Inspected stops', '', '| Stop | UTC | SIM s | Approx. latitude, longitude | DEM elevation (m) | DEM slope (°) | Battery (%) |', '| --- | --- | ---: | --- | ---: | ---: | ---: |',
    ...report.inspections.map(s => `| ${s.stopIndex + 1}. ${safe(s.name)} | ${s.atUTC} | ${n(s.simSeconds)} | ${n(s.position.lat, 6)}, ${n(s.position.lon, 6)} | ${n(s.terrain.elevationM)} | ${n(s.terrain.slopeDeg)} | ${n(s.batteryPct)} |`), '',
    ...report.inspections.flatMap(s => [`Stop ${s.stopIndex + 1}: ${s.finding}`, `Operator note: ${safe(s.note || 'none')}.`, `Environment (site/window context): ${JSON.stringify(s.environment)}.`, '']),
    '## Run observations (SIM)', '', `${n(report.rover.distanceM)} m travelled; ${n(report.rover.simSeconds)} SIM s at ×20; ${n(report.observations.energyUsedPct, 2)}% modeled energy used; observed max regional slope ${n(report.observations.maxSlopeDeg)}°.`,
    `Run elevation range: ${n(report.observations.elevationMinM)}–${n(report.observations.elevationMaxM)} m.`, '',
    '## Planetary reference', '', report.benchmark.scenario ? `${report.benchmark.scenario.targetName} (${report.benchmark.scenario.body}) · ${report.benchmark.scenario.id}.` : 'No paired benchmark.',
    report.benchmark.reason, `Topography index: ${report.benchmark.comparison?.index ?? 'unavailable'}/100; scale comparable: ${report.benchmark.comparison?.comparable ?? false}.`,
    `Target DEM source: ${report.benchmark.targetDEM?.source || 'unavailable'}; spacing ${report.benchmark.targetDEM?.spacingMeters || 'unavailable'} m; native resolution ${report.benchmark.targetDEM?.nativeResolutionMeters || 'unavailable'} m.`,
    `Comparison components: ${JSON.stringify(report.benchmark.comparison?.components || [])}.`,
    `Published Earth metrics: ${JSON.stringify(report.dem?.metrics || null)}.`, '',
    '## Decision', '', report.decision.status, report.decision.rationale, '', 'Strengths:', ...report.decision.strengths.map(s => `- ${s}`), '', 'Breakdowns:', ...report.decision.breakdowns.map(s => `- ${s}`), '', 'Next validation actions:', ...report.decision.nextSteps.map(s => `- ${s}`), '',
    '## Sources and limitations', '', ...report.site.sources.map(s => `- ${safe(s.label)}: ${s.url}`), ...report.limitations.map(s => `- ${s}`), '', report.model.energy, report.model.trace,
    '', `Site/window environmental context: ${JSON.stringify(report.environmentalContext)}.`, '', 'DEM notes (inherited source language):', ...((report.dem?.notes || []).map(s => `- ${s}`)), '', 'DEM provenance:', ...((report.dem?.provenance || []).map(s => `- ${safe(s.label)}: ${s.url}`)), '', '## Session events (UTC and SIM)', '', ...report.events.map(e => `- ${e.atUTC} · SIM ${n(e.simSeconds)} s · ${e.type}: ${e.detail}`), ''];
  return lines.join('\n');
}
export function expeditionContext(session) {
  const report = expeditionReport(session);
  // Bounded, source-linked summary; never includes destination flight, M2 tracking, raw DEM or path.
  return { domain: report.domain, sessionId: report.sessionId, status: report.status, cutoffAtUTC:report.cutoffAtUTC,confirmedAtUTC:report.confirmedAtUTC,startedAtUTC:report.startedAtUTC,finishedAtUTC:report.finishedAtUTC,site: report.site,
    objective: report.objective, preparation: report.preparation, dem: report.dem ? { identity: report.dem.identity, dataset: report.dem.dataset, source: report.dem.source, spacingMeters: report.dem.spacingMeters, nativeResolutionMeters: report.dem.nativeResolutionMeters, fetchedAtUTC: report.dem.fetchedAtUTC, metrics: report.dem.metrics } : null,
    benchmark: { targetDEM:report.benchmark.targetDEM?{dataset:report.benchmark.targetDEM.dataset,source:report.benchmark.targetDEM.source,spacingMeters:report.benchmark.targetDEM.spacingMeters,nativeResolutionMeters:report.benchmark.targetDEM.nativeResolutionMeters,extentMeters:report.benchmark.targetDEM.extentMeters}:null, scenario: report.benchmark.scenario, comparison: report.benchmark.comparison, reason: report.benchmark.reason },
    rover: report.rover, observations: report.observations, inspections: report.inspections.map(s => ({ stopIndex:s.stopIndex, atUTC:s.atUTC, simSeconds:s.simSeconds, x:s.position.x, z:s.position.z, lat:s.position.lat, lon:s.position.lon, elevationM:s.terrain.elevationM, slopeDeg:s.terrain.slopeDeg, sourceDEM:s.terrain.demId, batteryPct:s.batteryPct, finding:s.finding, note:s.note, materialMeasurement:null, environmentKind:s.environment?.kind||null, environmentTimestampUTC:s.environment?.timestampUTC||null })),
    environment: report.environmentalContext, decision: report.decision, limitations: report.limitations };
}
export function answerExpedition(question, context) {
  const c = context, q = String(question).toLowerCase();
  let answer;
  if (/weather|wind|temperature|environment|clima/.test(q)) answer = c.environment ? `Site/window environmental context: ${JSON.stringify(c.environment)}. These values are independent of SIM time and are not stop measurements.` : 'No sourced environmental telemetry is available for this Earth window. No weather or target values can be inferred.';
  else if (/batter|energy|payload|load|energ/.test(q)) answer = `SIM battery ${c.rover.batteryPct.toFixed(2)}%; modeled allowance used ${c.observations.energyUsedPct.toFixed(2)}% of ${c.preparation.config.energyBudgetPct}%. Payload ${c.preparation.config.payloadKg} kg. This illustrative model is not an engineering energy prediction.`;
  else if (/compar|benchmark|planet|analog/.test(q)) answer = `${c.benchmark.scenario ? `Reference: ${c.benchmark.scenario.targetName}. ` : ''}${c.benchmark.reason} Regional topography index: ${c.benchmark.comparison?.index ?? 'unavailable'}/100. ${c.decision.breakdowns.join(' ')}`;
  else answer = `${c.objective.task} ${c.inspections.length}/${c.preparation.stops.length} stops inspected. ${c.decision.status}: ${c.decision.rationale} Next: ${c.decision.nextSteps[0]}`;
  return { answer, provider: 'rules', model: 'earth-expedition-v1', generatedAt: utc(), grounded: ['earthExpedition.sessionId', 'earthExpedition.objective', 'earthExpedition.inspections', 'earthExpedition.decision'], disclaimer: 'Local expedition rules; only this Earth session is used. No destination landing or M2 tracking evidence is included.' };
}
