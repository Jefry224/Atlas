import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, createExpedition, evaluatePlan, confirmExpedition, startExpedition, pauseExpedition,
  stepExpedition, advanceExpedition, setExpeditionMode, inspectStop, finishExpedition, expeditionReport, expeditionMarkdown, expeditionContext,
  benchmarkEvidence, demIdentity, answerExpedition } from '../earth-expedition.mjs';
import { sampleHeight, sampleSlope } from '../mission-math.mjs';
const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));
const grid = { gridSize: 9, spacingMeters: 100, elevation: Array(81).fill(120), center: [20, 30], dataset: 'Test DEM', nativeResolutionMeters: 90, source: 'https://example.org/dem', fetchedAt: '2026-01-01T00:00:00Z' };
const site = { id: 'earth-test', name: 'Earth test', lat: 19.9, lon: 29.9, sources: [{ label: 'Test source', url: 'https://example.org/site' }] };
const stops = [{ name: 'Baseline', x: 0, z: 0 }, { name: 'Contrast', x: 100, z: 0 }];
const create = (extra = {}) => createExpedition({ site, grid, stops, ...extra });
function ready(extra) { const s = create(extra); assert.equal(confirmExpedition(s, true), true); return s; }
function startTraverse(s) { assert.equal(startExpedition(s), true); assert.equal(s.phase, 'running'); assert.equal(s.inspections.length, 1); assert.equal(s.inspections[0].recordingMethod, 'departure-baseline'); }
function arrive(s) { for (let i = 0; i < 1000 && s.phase === 'running'; i++) stepExpedition(s, .1); assert.equal(s.phase, 'inspection'); }
function complete(s) { startTraverse(s); for (let i = 0; i < 1000 && s.phase === 'running'; i++) stepExpedition(s, .1); assert.equal(s.phase, 'inspection'); assert.equal(inspectStop(s), true); assert.equal(finishExpedition(s), true); return s; }

test('missing, malformed and non-finite DEMs block preparation without synthetic terrain', () => {
  for (const missing of [null, {}, { ...grid, elevation: [null] }, { ...grid, elevation: Array(81).fill(NaN) }]) {
    assert.equal(evaluatePlan(missing, DEFAULT_CONFIG, stops).valid, false);
    const s = create({ grid: missing }); assert.equal(confirmExpedition(s, true), false); assert.equal(startExpedition(s), false);
    assert.equal(expeditionReport(s).dem, null);
  }
});
test('all numerical inputs, objectives, stop count and out-of-window positions are validated', () => {
  for (const [key, value] of [['payloadKg', NaN], ['payloadKg', -1], ['payloadKg', 81], ['slopeLimitDeg', Infinity], ['slopeLimitDeg', 0], ['energyBudgetPct', '20'], ['objective', 'invented']]) assert.equal(evaluatePlan(grid, { ...DEFAULT_CONFIG, [key]: value }, stops).valid, false, key);
  for (const invalid of [[], [stops[0]], [...stops, { x: 381, z: 0 }], [...stops, { x: null, z: 0 }], [...stops, { x: 50, z: 0 }], [...stops, { x: NaN, z: 0 }]]) assert.equal(evaluatePlan(grid, DEFAULT_CONFIG, invalid).valid, false);
});
test('route validation samples the interior of a leg, rejecting a hidden regional ridge', () => {
  const ridge = { ...grid, elevation: Array.from({ length: 81 }, (_, i) => i % 9 === 4 ? 400 : 0) };
  const p = evaluatePlan(ridge, { ...DEFAULT_CONFIG, slopeLimitDeg: 5 }, [{ x: -300, z: 0 }, { x: 300, z: 0 }]);
  assert.equal(p.valid, false); assert.ok(p.maxSlopeDeg > 5); assert.match(p.errors.join(' '), /no permitted direct route/);
});
test('payload and instrument choice change drive estimates and low allowance blocks a long traverse', () => {
  const p = evaluatePlan(grid, DEFAULT_CONFIG, stops), loaded = evaluatePlan(grid, { ...DEFAULT_CONFIG, objective: 'sampling', payloadKg: 80 }, stops);
  assert.ok(loaded.energyEstimatePct > p.energyEstimatePct);
  assert.equal(evaluatePlan(grid, { ...DEFAULT_CONFIG, energyBudgetPct: 1 }, [{ x: -370, z: -370 }, { x: 370, z: 370 }]).valid, false);
});
test('confirmation is explicit and places the rover at the chosen first stop without starting time', () => {
  const s = create({ stops: [{ x: -100, z: 100, name: 'Selected start' }, { x: 100, z: 100, name: 'Next' }] });
  assert.equal(confirmExpedition(s, false), false); assert.equal(startExpedition(s), false);
  assert.equal(confirmExpedition(s, true, '2026-01-02T00:00:00Z'), true);
  assert.equal(s.phase, 'ready'); assert.equal(s.rover.elapsed, 0); assert.equal(s.rover.x, -100); assert.equal(s.rover.z, 100);
  assert.equal(s.startedAtUTC, null); assert.equal(s.confirmedAtUTC, '2026-01-02T00:00:00Z');
  assert.equal(s.inspections.length, 0);
});
test('one Start records the sourced departure baseline and moves toward stop 2 without inspect or resume', () => {
  const s = ready(), now = '2026-01-02T10:00:00Z';
  s.latestTelemetry = { site: site.id, provider: 'snapshot', values: { temperatureC: 8 } };
  assert.equal(startExpedition(s, now), true);
  assert.equal(s.phase, 'running'); assert.equal(s.nextStop, 1); assert.equal(s.startedAtUTC, now);
  const baseline = s.inspections[0];
  assert.equal(baseline.recordingMethod, 'departure-baseline'); assert.equal(baseline.atUTC, now); assert.equal(baseline.simSeconds, 0);
  assert.equal(baseline.terrain.demId, s.demId); assert.equal(baseline.environment.values.temperatureC, 8); assert.equal(baseline.materialMeasurement, null);
  assert.equal(inspectStop(s), false); stepExpedition(s, .1); assert.ok(s.rover.distance > 0);
  pauseExpedition(s); assert.equal(startExpedition(s), true); assert.equal(s.inspections.length, 1);
  assert.equal(s.events.filter(e => e.type === 'departure-baseline').length, 1);
  assert.match(expeditionMarkdown(expeditionReport(s)), /Departure DEM baseline recorded on Start/);
  assert.equal(expeditionContext(s).inspections[0].recordingMethod, 'departure-baseline');
});
test('site, DEM and plan identities are immutable snapshots; later input edits cannot contaminate them', () => {
  const input = structuredClone(grid), config = { ...DEFAULT_CONFIG }, s = ready({ grid: input, config });
  input.elevation[0] = 99999; config.payloadKg = 99;
  assert.equal(s.grid.elevation[0], 120); assert.equal(s.config.payloadKg, 12); assert.ok(Object.isFrozen(s.grid.elevation));
  assert.throws(() => { s.grid.elevation[0] = 100; });
  s.config.payloadKg = 40; assert.equal(startExpedition(s), false);
  const other = ready(); other.stops[1].x = 200; assert.equal(startExpedition(other), false);
  const changedDEM = ready(); changedDEM.grid = { ...grid, center: [0, 0] }; assert.equal(startExpedition(changedDEM), false);
});
test('automatic rover follows the actual planned stops and requires inspection at each arrival', () => {
  const s = ready(); startTraverse(s);
  for (let i = 0; i < 100 && s.phase === 'running'; i++) stepExpedition(s, .1);
  assert.equal(s.phase, 'inspection'); assert.ok(Math.abs(s.rover.x - 100) <= 5); assert.ok(Math.abs(s.rover.z) < .001);
  const distance = s.rover.distance; stepExpedition(s, .1); assert.equal(s.rover.distance, distance);
  assert.equal(startExpedition(s), false); assert.equal(inspectStop(s), true); assert.equal(s.phase, 'review'); assert.equal(startExpedition(s), false);
});
test('pause and resume preserve all simulation observations without time or energy drift', () => {
  const s = ready(); startTraverse(s); stepExpedition(s, .1); pauseExpedition(s);
  const before = JSON.stringify({ rover: s.rover, observations: s.observations });
  for (let i = 0; i < 100; i++) stepExpedition(s, .1);
  assert.equal(JSON.stringify({ rover: s.rover, observations: s.observations }), before);
  assert.equal(startExpedition(s), true); stepExpedition(s, .1); assert.ok(s.rover.elapsed > 2);
});
test('manual steering uses the existing rover motion and cannot inspect an unreached planned stop', () => {
  const s = ready(); startTraverse(s); const z = s.rover.z;
  stepExpedition(s, .1, { mode: 'manual', throttle: 1, turn: 1 }); assert.notEqual(s.rover.z, z); assert.equal(s.activeMode, 'manual'); assert.equal(inspectStop(s), false);
  pauseExpedition(s); assert.equal(inspectStop(s), false);
});
test('runtime budget exhaustion stops with partial evidence and a reviewable decision', () => {
  const s = ready({ config: { ...DEFAULT_CONFIG, energyBudgetPct: 1 } }); startTraverse(s);
  for (let i = 0; i < 2000 && s.phase === 'running'; i++) stepExpedition(s, .1, { mode: 'manual', throttle: 0 });
  assert.equal(s.phase, 'blocked'); assert.match(s.blockedReason, /allowance exhausted/); assert.equal(s.rover.distance, 0);
  assert.equal(finishExpedition(s), true); const report = expeditionReport(s); assert.equal(report.inspections.length, 1); assert.equal(report.decision.status, 'Revise the reconnaissance plan'); assert.match(report.decision.rationale, /incomplete/);
});
test('manual terrain exceeding the confirmed ceiling stops before adding unsupported observations', () => {
  const h = { ...grid, elevation: Array.from({ length: 81 }, (_, i) => i % 9 < 6 ? 0 : 900) };
  const s = ready({ grid: h, stops: [{ x: -200, z: 0 }, { x: -100, z: 0 }], config: { ...DEFAULT_CONFIG, slopeLimitDeg: 5 } });
  startTraverse(s); s.rover.x = 200;
  stepExpedition(s, .1, { mode: 'manual', throttle: 1 }); assert.equal(s.phase, 'blocked'); assert.match(s.blockedReason, /slope/); assert.equal(s.inspections.length, 1);
});
test('inspections sample the actual Earth location, georeference from DEM centre and retain UTC/source domains', () => {
  const s = ready(); startTraverse(s); arrive(s);
  const telemetry = { site: site.id, lat: 20, lon: 30, live: false, provider: 'snapshot', observedAt: '2025-12-31T09:00:00Z', values: { temperatureC: 8, windSpeedMs: null }, source: { url: 'https://example.org/weather' } };
  assert.equal(inspectStop(s, { telemetry, note: 'Needs field lidar', now: '2026-01-02T10:00:00Z' }), true);
  const stop = s.inspections[1]; assert.equal(stop.recordingMethod, 'operator-inspection'); assert.equal(stop.terrain.elevationM, sampleHeight(grid, s.rover.x, s.rover.z)); assert.equal(stop.terrain.slopeDeg, sampleSlope(grid, s.rover.x, s.rover.z));
  assert.equal(stop.position.lat, 20); assert.ok(stop.position.lon > 30); assert.equal(stop.atUTC, '2026-01-02T10:00:00Z'); assert.ok(stop.simSeconds > 0); assert.equal(stop.environment.timestampUTC, telemetry.observedAt); assert.equal(stop.materialMeasurement, null); assert.equal(stop.environment.values.windSpeedMs, null); assert.equal(stop.note, 'Needs field lidar');
});
test('cross-site weather is rejected and absent data remain null rather than synthetic measurements', () => {
  const s = ready(); s.latestTelemetry = { site: 'another-site', values: { temperatureC: 100 } }; startExpedition(s);
  assert.equal(s.inspections[0].environment, null); arrive(s); assert.equal(inspectStop(s, { telemetry: s.latestTelemetry }), true);
  assert.equal(s.inspections[1].environment, null); assert.equal(expeditionReport(s).environmentalContext, null);
});
test('completed JSON and Markdown contain one consistent identity, plan, evidence, limits and next actions', () => {
  const s = complete(ready()), report = expeditionReport(s, '2026-01-03T00:00:00Z'), decoded = JSON.parse(JSON.stringify(report));
  assert.equal(decoded.domain, 'earth-field-expedition'); assert.equal(decoded.body, 'earth'); assert.equal(decoded.dem.identity, decoded.preparation.demId); assert.equal(decoded.site.lat, grid.center[0]); assert.equal(decoded.site.catalogueReference.lat, site.lat);
  assert.equal(decoded.inspections.length, 2); assert.equal(decoded.decision.status, 'Advance to targeted validation'); assert.ok(decoded.path.length > 1);
  assert.ok(decoded.startedAtUTC); assert.ok(decoded.finishedAtUTC); assert.equal(finishExpedition(s), false); assert.equal(startExpedition(s), false);
  const md = expeditionMarkdown(report); for (const text of [s.sessionId, 'Confirmed plan', 'Inspected stops', 'Sources and limitations', 'Next validation actions', 'DEM centre', 'SIM', grid.source]) assert.ok(md.includes(text), text);
  assert.equal('landing' in decoded, false); assert.equal('analogyAudit' in decoded, false);
});
test('finish before completion preserves uninspected stops; reset replacement has a distinct session', () => {
  const s = ready(); startExpedition(s); assert.equal(finishExpedition(s), true); const report = expeditionReport(s);
  assert.equal(report.inspections.length, 1); assert.equal(report.inspections[0].recordingMethod, 'departure-baseline'); assert.equal(report.preparation.stops.length, 2); assert.match(report.decision.status, /Revise/);
  const fresh = create(); assert.notEqual(fresh.sessionId, s.sessionId); assert.equal(fresh.phase, 'draft'); assert.equal(fresh.inspections.length, 0);
});
test('all four published paired Earth grids use the existing geometry engine without thermal or radar claims', () => {
  for (const scenario of json('assets/data/scenarios.json').scenarios) {
    const earth = json(scenario.earth), target = json(scenario.target), b = benchmarkEvidence(earth, scenario, target);
    assert.ok(b.comparison.components.length >= 4); assert.ok(b.comparison.components.every(c => !['roughness', 'thermalAmplitudeK'].includes(c.key)));
    assert.equal(b.targetDEM.source, target.source); assert.equal(b.scenario.targetId, scenario.targetId); assert.equal(demIdentity(earth), demIdentity(structuredClone(earth)));
    const s = create({ grid: earth, scenario, targetGrid: target, stops: undefined }); assert.ok(s.demId); assert.equal(s.benchmark.scenario.id, scenario.id);
  }
});
test('missing target DEM or published metrics leaves the Earth expedition usable with benchmark unavailable', () => {
  const scenario = { id: 'paired-reference', targetId: 'jezero', body: 'mars' }, s = ready({ scenario, targetGrid: null });
  assert.equal(s.benchmark.comparison.index, null); assert.match(s.benchmark.reason, /missing/); complete(s); assert.equal(expeditionReport(s).decision.status, 'Advance to targeted validation');
  assert.equal(benchmarkEvidence(grid, null, null).comparison, null); assert.equal(benchmarkEvidence(grid, scenario, grid).comparison.index, null);
});
test('bounded copilot context contains run evidence and decisions without destination or raw grid contamination', () => {
  const s = complete(ready()), context = expeditionContext(s), answer = answerExpedition('What should we validate next?', context);
  assert.equal(context.sessionId, s.sessionId); assert.equal(context.inspections.length, 2); assert.equal(context.inspections[1].sourceDEM, s.demId); assert.equal('path' in context, false); assert.equal('events' in context, false); assert.equal('landing' in context, false);
  assert.match(answer.answer, /Advance to targeted validation/); assert.equal(answer.provider, 'rules'); assert.match(answerExpedition('weather?', context).answer, /No sourced environmental/);
  const leaves = value => value && typeof value === 'object' ? Object.values(value).reduce((sum, v) => sum + leaves(v), 0) : 1;
  assert.ok(leaves(context) < 300, leaves(context));
});
test('invalid drive inputs and changed confirmed configuration stop the run without poisoning numeric state', () => {
  for (const invalid of [NaN, -1, Infinity]) { const s = ready(); startTraverse(s); stepExpedition(s, invalid); assert.equal(s.phase, 'blocked'); assert.equal(s.rover.elapsed, 0); }
  const s = ready(); startTraverse(s); s.config.payloadKg = 99; stepExpedition(s, .1); assert.equal(s.phase, 'blocked'); assert.match(s.blockedReason, /Preparation or DEM changed/);
});

test('slow-frame integration matches ten small kinematic steps and never moves through an arrival or pause', () => {
  const slow=ready(), fine=ready();startTraverse(slow);startTraverse(fine);
  advanceExpedition(slow,1);for(let i=0;i<10;i++)stepExpedition(fine,.1);
  assert.ok(Math.abs(slow.rover.distance-fine.rover.distance)<1e-8);assert.ok(Math.abs(slow.rover.elapsed-20)<1e-8);
  pauseExpedition(slow);const previous=slow.rover.elapsed;advanceExpedition(slow,10);assert.equal(slow.rover.elapsed,previous);
  startExpedition(slow);for(let i=0;i<20&&slow.phase==='running';i++)advanceExpedition(slow,1);
  assert.equal(slow.phase,'inspection');assert.ok(Math.abs(slow.rover.x-100)<=5);assert.ok(slow.rover.x<=100);
});

test('all fourteen published catalogue DEMs retain honest plan validation and their own source identities',()=>{
  const sandbox={};runInNewContext(readFileSync(new URL('../data.js',import.meta.url),'utf8'),sandbox);
  assert.equal(sandbox.ANALOG_SITES.length,14);
  for(const site of sandbox.ANALOG_SITES){
    const earth=json(`assets/data/${site.id}.json`),s=createExpedition({site,grid:earth});
    assert.equal(s.site.id,site.id);assert.equal(s.grid.source,earth.source);assert.equal(s.demId,demIdentity(earth));
    const plan=evaluatePlan(s.grid,s.config,s.stops);assert.equal(typeof plan.valid,'boolean');
    assert.equal(confirmExpedition(s,true),plan.valid);if(!plan.valid)assert.ok(plan.errors.length);
  }
});
test('maximum six-stop context remains bounded and retains target resolution metadata and the final evidence cutoff',()=>{
  const scenario=json('assets/data/scenarios.json').scenarios.find(s=>s.id==='hyperarid-salt');
  const earth=json(scenario.earth),target=json(scenario.target);
  const six=Array.from({length:6},(_,i)=>({name:`Stop ${i+1}`,x:-150+i*75,z:0}));
  const s=ready({grid:earth,stops:six,scenario,targetGrid:target});
  startExpedition(s);
  while(['running','paused'].includes(s.phase)){
    if(s.phase==='paused')startExpedition(s);for(let i=0;i<200&&s.phase==='running';i++)advanceExpedition(s,1);
    assert.equal(s.phase,'inspection');inspectStop(s);
  }
  finishExpedition(s);const context=expeditionContext(s);
  const leaves=value=>value&&typeof value==='object'?Object.values(value).reduce((sum,v)=>sum+leaves(v),0):1;
  assert.ok(leaves(context)<390,leaves(context));assert.equal(context.inspections.length,6);
  assert.equal(context.benchmark.targetDEM.nativeResolutionMeters,target.nativeResolutionMeters);
  assert.equal(context.cutoffAtUTC,s.finishedAtUTC);assert.equal(context.finishedAtUTC,s.finishedAtUTC);
});

test('pilot selection belongs to its Earth session, is reported before movement and cannot rewrite a finished report',()=>{
  const s=ready();assert.equal(setExpeditionMode(s,'manual'),true);assert.equal(expeditionReport(s).rover.mode,'manual');
  assert.equal(s.rover.elapsed,0);assert.equal(s.events.at(-1).type,'pilot-mode');assert.equal(setExpeditionMode(s,'invalid'),false);
  startExpedition(s);finishExpedition(s);assert.equal(setExpeditionMode(s,'auto'),false);assert.equal(s.activeMode,'manual');
  assert.equal(create().activeMode,'auto');
});

test('a paired Earth window outside the catalogue never fabricates a catalogue reference',()=>{
  const s=create({site:{...site,coordinateSource:'paired-dem'}});assert.equal(expeditionReport(s).site.catalogueReference,null);
  assert.equal(expeditionReport(s).site.lat,grid.center[0]);
});
