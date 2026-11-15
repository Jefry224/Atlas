import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLandingController } from '../src/landing/landing-controller.mjs';
import { sampleHeight } from '../src/shared/mission-math.mjs';
import { validateLandingPayload, captureLanding } from '../src/landing/landing-report.mjs';

const read = path => JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url)));
const scenarios = read('assets/data/scenarios.json').scenarios;
const configs = scenarios.map(sc => ({ scenarioId: sc.id, body: sc.body, earthGrid: read(sc.earth), targetGrid: read(sc.target) }));
const identity = (index, missionId) => {
  const sc = scenarios[index];
  return { missionId, scenarioId: sc.id, body: sc.body, earthId: sc.earthId, targetId: sc.targetId };
};
function setup(index = 0, override = {}) {
  const outputs = [], deployments = [];
  const c = createLandingController({ publish: p => outputs.push(p), deploy: runs => deployments.push(runs) });
  c.configure({ ...configs[index], ...override });
  return { c, outputs, deployments };
}
function advance(c, expected) {
  for (let frame = 0; frame < 1500 && c.running && c.phase !== expected; frame++) c.step(0.1);
  assert.equal(c.phase, expected);
}
function enterDescent(c) { c.step(1); c.step(1); assert.equal(c.phase, 'descent'); }
function validateOutputs(outputs, id) {
  let previous = null;
  for (const p of outputs) {
    assert.deepEqual(validateLandingPayload(p, { ...id, previous }), { valid: true, errors: [] });
    previous = p;
  }
}
function assertOnlyTarget(p) {
  assert.equal(p.missionMode, 'target-first');
  assert.equal(p.primarySide, 'target');
  assert.equal(p.runs.earth, null);
  assert.ok(p.history.length);
  for (const row of p.history) { assert.equal(row.earth, null); assert.equal(row.simSeconds, row.target.simSeconds); }
}

test('four scenarios land only on target, await one manual authorization, then mirror the terrestrial test rover', () => {
  for (let index = 0; index < scenarios.length; index++) {
    const { c, outputs, deployments } = setup(index), missionId = `target-${index}`;
    assert.equal(c.inspect().missionMode, 'target-first');
    assert.equal(c.view().primarySide, 'target');
    assert.deepEqual(c.view().options, { timeScale: 1, deploymentMode: 'manual' });
    const surface = c.inspect().explorationOrigins.earth;
    assert.deepEqual([surface.x, surface.z], [0, 0]);
    assert.equal(surface.elevationM, sampleHeight(configs[index].earthGrid, 0, 0));
    assert.equal(surface.gridId, scenarios[index].earthId);
    assert.equal(surface.role, 'analogue-test-origin');
    assert.equal(surface.kind, 'local-dem-center');
    assert.match(surface.reason, /local reference.*no automatic scientific homology/);
    assert.equal(surface.georeference, null);
    assert.equal(c.inspect().explorationOrigins.target, null);
    assert.equal(c.inspect().mirrorAvailable, false);
    assert.equal(c.choose('earth', c.inspect().plans.earth.selectedId), false);
    assert.equal(c.start(missionId), true);
    assertOnlyTarget(c.snapshot());
    assert.equal(c.requestDeployment(), false);
    assert.equal(c.targetPose({ x: 0, z: 0, path: [] }), null);
    advance(c, 'contact');
    assert.equal(c.running, false);
    assert.equal(c.roverAllowed, false);
    assert.equal(deployments.length, 0);
    const p = c.snapshot(), target = p.runs.target, origin = p.explorationOrigins.target;
    assertOnlyTarget(p);
    assert.equal(target.phase, 'contact');
    assert.equal(origin.role, 'target-contact');
    assert.deepEqual([origin.x, origin.z, origin.elevationM, origin.gridId], [target.x, target.z, target.groundElevationM, target.grid.id]);
    assert.deepEqual(origin.georeference, target.georeference);
    assert.ok(Math.hypot(origin.x - surface.x, origin.z - surface.z) > 0);
    assert.equal(p.mirrorAvailable, true);
    assert.equal(p.endedAtUTC, null);
    assert.equal(p.events.some(e => e.type.startsWith('earth-')), false);
    assert.equal(p.events.some(e => /contacto Tierra|contacto nominal Tierra/i.test(e.detail)), false);
    const waiting = c.snapshot(), publishCount = outputs.length;
    for (let frame = 0; frame < 20; frame++) { c.step(200); assert.equal(c.pause(true), false); }
    assert.deepEqual(c.snapshot(), waiting);
    assert.equal(outputs.length, publishCount);
    assert.equal(c.requestDeployment(), true);
    assert.equal(c.requestDeployment(), false);
    c.step(1);
    assert.equal(c.pause(false), true);
    const paused = c.snapshot(); c.step(1); assert.deepEqual(c.snapshot(), paused);
    assert.equal(c.pause(true), true);
    advance(c, 'exploration');
    assert.equal(c.roverAllowed, true);
    assert.equal(deployments.length, 1);
    assert.equal(deployments[0].earth, null);
    assert.equal(deployments[0].target.phase, 'contact');
    const rover = { x: surface.x + 5, z: surface.z - 8, heading: 37, path: [[surface.x, surface.z], [surface.x + 5, surface.z - 8]] };
    const mirrored = c.targetPose(rover);
    assert.deepEqual([mirrored.x, mirrored.z, mirrored.heading], [target.x + 5, target.z - 8, 37]);
    assert.deepEqual(mirrored.path, [[target.x, target.z], [target.x + 5, target.z - 8]]);
    assert.deepEqual(rover.path[0], [0, 0]);
    const final = c.snapshot();
    for (let frame = 0; frame < 20; frame++) c.step(1);
    assert.deepEqual(c.snapshot(), final);
    assert.equal(deployments.length, 1);
    assert.equal(final.events.filter(e => e.type === 'deployment-authorized').length, 1);
    validateOutputs(outputs, identity(index, missionId));
    assert.equal(captureLanding(final, identity(index, missionId)).valid, true);
  }
});

test('missing or invalid Earth DEM never delays target contact or deployment and never invents a mirror', () => {
  const invalid = structuredClone(configs[0].earthGrid); invalid.elevation[0] = null;
  for (const earthGrid of [null, invalid]) {
    const { c, outputs, deployments } = setup(0, { earthGrid });
    assert.equal(c.inspect().explorationOrigins.earth, null);
    assert.equal(c.start('earth-unavailable', { initial: { earth: { propellantKg: 0 } } }), true);
    assert.equal(c.snapshot().runs.target.propellantKg, c.inspect().profiles.target.propellantKg);
    advance(c, 'contact');
    assert.equal(c.snapshot().runs.target.phase, 'contact');
    assert.equal(c.snapshot().explorationOrigins.earth, null);
    assert.equal(c.inspect().mirrorAvailable, false);
    assert.equal(c.requestDeployment(), true);
    advance(c, 'exploration');
    assert.equal(c.roverAllowed, true);
    assert.equal(deployments.length, 1);
    assert.equal(c.targetPose({ x: 0, z: 0, path: [] }), null);
    assert.ok(c.snapshot().explorationOrigins.target);
    for (const p of outputs) assertOnlyTarget(p);
    validateOutputs(outputs, identity(0, 'earth-unavailable'));
  }
});

test('terrestrial aerial-zone failure is irrelevant to the valid surface test origin and target flight', () => {
  const earthGrid = structuredClone(configs[0].earthGrid);
  earthGrid.nativeResolutionMeters = 1e6; // Unevaluable aerial zones; raster surface remains valid.
  const { c, outputs } = setup(0, { earthGrid });
  assert.equal(c.inspect().plans.earth.selectedId, null);
  assert.ok(c.inspect().explorationOrigins.earth);
  c.setOptions({ timeScale: 4, deploymentMode: 'automatic' });
  c.start('earth-plan-failed', { initial: { earth: { propellantKg: 0 } } });
  advance(c, 'exploration');
  assert.equal(c.snapshot().runs.target.phase, 'contact');
  assert.equal(c.snapshot().mirrorAvailable, true);
  validateOutputs(outputs, identity(0, 'earth-plan-failed'));
});

test('nominal Earth data cannot rescue target fuel failure or missing target coverage', () => {
  for (const mode of ['no-fuel', 'no-target']) {
    const { c, outputs, deployments } = setup(0, mode === 'no-target' ? { targetGrid: null } : {});
    assert.ok(c.inspect().explorationOrigins.earth);
    c.setOptions({ timeScale: 4, deploymentMode: 'automatic' });
    c.start(mode, { initial: { earth: {}, target: mode === 'no-fuel' ? { propellantKg: 0 } : {} } });
    advance(c, mode === 'no-fuel' ? 'hard-contact' : 'unavailable');
    const p = c.snapshot();
    assertOnlyTarget(p);
    assert.equal(p.explorationOrigins.target, null);
    assert.equal(p.mirrorAvailable, false);
    assert.equal(c.roverAllowed, false);
    assert.equal(c.requestDeployment(), false);
    assert.equal(c.pause(true), false);
    assert.equal(deployments.length, 0);
    assert.ok(p.endedAtUTC);
    c.step(1); assert.deepEqual(c.snapshot(), p);
    validateOutputs(outputs, identity(0, mode));
  }
});

test('target-only stepping respects pause, bounded frames, rates, actual fuel and unchanged SI budgets', () => {
  const { c, outputs } = setup();
  const fuel = c.inspect().profiles.target.propellantKg / 2;
  c.start('target-rates', { initial: { earth: { propellantKg: 0 }, target: { propellantKg: fuel } } });
  assert.equal(c.snapshot().runs.earth, null);
  assert.equal(c.snapshot().runs.target.propellantKg, fuel);
  assert.equal(c.snapshot().runs.target.massKg, c.inspect().profiles.target.dryMassKg + fuel);
  assert.equal(c.snapshot().profiles.target.propellantKg, fuel * 2);
  assert.equal(c.pause(false), true);
  const preparation = c.snapshot(); c.step(1); assert.deepEqual(c.snapshot(), preparation);
  assert.equal(c.pause(true), true); enterDescent(c);
  for (const rate of [0.5, 1, 2, 4]) {
    const before = c.snapshot();
    assert.equal(c.setOptions({ timeScale: rate }), true);
    assert.deepEqual(c.snapshot().runs, before.runs);
    assert.deepEqual(c.snapshot().history, before.history);
    c.step(200);
    assert.ok(Math.abs(c.inspect().runs.target.simSeconds - before.runs.target.simSeconds - rate) < 1e-8);
    assert.equal(c.pause(false), true);
    const paused = c.snapshot();
    for (const dt of [0, -1, NaN, Infinity, '1', null, 200]) c.step(dt);
    assert.deepEqual(c.snapshot(), paused);
    assert.equal(c.setOptions({ timeScale: rate === 4 ? 1 : 4 }), true);
    assert.equal(c.running, false);
    assert.deepEqual(c.snapshot().runs, paused.runs);
    assert.equal(c.pause(true), true);
  }
  c.abort('operador');
  assert.equal(c.phase, 'aborted');
  assert.equal(c.requestDeployment(), false);
  assertOnlyTarget(c.snapshot());
  validateOutputs(outputs, identity(0, 'target-rates'));
  const { c: slow } = setup(), { c: normal } = setup();
  slow.setOptions({ timeScale: 0.5 }); slow.start('slow'); normal.start('normal');
  enterDescent(slow); enterDescent(normal);
  for (let frame = 0; frame < 20; frame++) { slow.step(0.2); normal.step(0.1); }
  assert.deepEqual(slow.inspect().runs, normal.inspect().runs);
});

test('target choice keeps the automatic Earth origin; relative path and position must remain within target coverage', () => {
  const { c } = setup();
  const before = c.inspect(), zone = before.plans.target.zones.find(z => z.eligible && z.id !== before.plans.target.selectedId);
  assert.ok(zone);
  assert.equal(c.choose('target', zone.id), true);
  assert.deepEqual(c.inspect().explorationOrigins.earth, before.explorationOrigins.earth);
  assert.equal(c.inspect().explorationOrigins.target, null);
  c.setOptions({ timeScale: 4, deploymentMode: 'automatic' }); c.start('projection');
  assert.equal(c.snapshot().runs.target.target.id, zone.id);
  advance(c, 'exploration');
  const contact = c.inspect().explorationOrigins.target;
  const half = (configs[0].targetGrid.gridSize - 1) * configs[0].targetGrid.spacingMeters / 2;
  const at = (x, z, path = []) => c.targetPose({ x, z, path });
  assert.deepEqual([at(0, 0).x, at(0, 0).z], [contact.x, contact.z]);
  assert.ok(at(half - contact.x, 0));
  assert.equal(at(half - contact.x + 1e-4, 0), null);
  assert.equal(at(-half - contact.x - 1e-4, 0), null);
  assert.equal(at(0, half - contact.z + 1e-4), null);
  assert.equal(at(0, 0, [[half - contact.x + 1, 0]]), null);
  for (const rover of [null, {}, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: 0, z: 0, path: null }, { x: 0, z: 0, path: [[NaN, 0]] }]) assert.equal(c.targetPose(rover), null);
  const rover = { x: 1, z: 2, path: [[0, 0]], extra: { a: 1 } }, translated = c.targetPose(rover);
  translated.path[0][0] = 999; translated.extra.a = 0;
  assert.deepEqual(rover, { x: 1, z: 2, path: [[0, 0]], extra: { a: 1 } });
});

test('reset and returned snapshots isolate target-first origins, histories and options across legacy sessions', () => {
  const { c } = setup();
  c.setOptions({ timeScale: 4, deploymentMode: 'automatic' }); c.start('old'); advance(c, 'exploration');
  const original = c.snapshot();
  for (const value of [c.view(), c.inspect(), c.snapshot()]) {
    value.explorationOrigins.earth.x = 999;
    value.explorationOrigins.target.x = 999;
    value.profiles.target.dryMassKg = 0;
    value.plans.target.selectedId = 'foreign';
    value.runs.target.x = 999;
    value.history[0].target.x = 999;
    value.options.timeScale = 0;
  }
  assert.deepEqual(c.snapshot(), original);
  c.configure({ ...configs[1], missionMode: 'paired-legacy' });
  assert.equal(c.inspect().primarySide, 'earth');
  assert.equal(c.choose('earth', c.inspect().plans.earth.selectedId), true);
  c.start('legacy'); assert.ok(c.snapshot().runs.earth);
  c.configure(configs[2]);
  const fresh = c.inspect();
  assert.equal(fresh.missionMode, 'target-first'); assert.equal(fresh.primarySide, 'target');
  assert.equal(fresh.active, false); assert.equal(c.roverAllowed, false); assert.equal(c.snapshot(), null);
  assert.deepEqual(fresh.history, []); assert.deepEqual(fresh.runs, { earth: null, target: null });
  assert.deepEqual(fresh.options, { timeScale: 1, deploymentMode: 'manual' });
  assert.equal(fresh.explorationOrigins.earth.gridId, scenarios[2].earthId);
  assert.equal(fresh.explorationOrigins.target, null); assert.equal(fresh.mirrorAvailable, false);
  c.start('fresh');
  assertOnlyTarget(c.snapshot());
  assert.equal(c.snapshot().events.length, 1);
  assert.equal(c.snapshot().history.length, 1);
});
