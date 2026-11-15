import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE_PROFILE_VERSION, getMissionBaseProfile, validateMissionBaseProfile } from '../mission-profiles.mjs';
import { ROVER_CONFIG } from '../rover-config.mjs';

const scenarioData = JSON.parse(readFileSync(new URL('../assets/data/scenarios.json', import.meta.url))).scenarios;
const expected = {
  'lava-tube': { samplerMass: 18, thrust: 120, torque: 8, radius: 0.25, cameras: 2, resolution: 0.002, roverPower: 650, includedMass: 64.2, componentPower: 498, thermal: [0.8, 293.15, 283.15, 6, 0.85], pressure: 101325 },
  'polar-shadow': { samplerMass: 24, thrust: 90, torque: 6, radius: 0.27, cameras: 2, resolution: 0.003, roverPower: 1200, includedMass: 89.8, componentPower: 1030, thermal: [1, 273.15, 150, 0, 0.8], pressure: 1 },
  'hyperarid-salt': { samplerMass: 14, thrust: 70, torque: 5, radius: 0.25, cameras: 1, resolution: 0.0001, roverPower: 600, includedMass: 63.6, componentPower: 457, thermal: [0.6, 303.15, 293.15, 8, 0.9], pressure: 101325 },
  'wind-canyon': { samplerMass: 8, thrust: 30, torque: 2, radius: 0.3, cameras: 2, resolution: 0.01, roverPower: 750, includedMass: 62.6, componentPower: 597, thermal: [0.9, 293.15, 283.15, 12, 0.85], pressure: 101325 },
};
const tool = (profile, id) => profile.tools.find(t => t.id === id);
const param = (profile, id, key) => tool(profile, id).parameters.find(p => p.key === key);
const value = (profile, id, key) => param(profile, id, key).value;
const close = (actual, target) => assert.ok(Math.abs(actual - target) < 1e-10, `${actual} != ${target}`);

function walk(value, path = 'profile') {
  assert.notEqual(value, null, path);
  assert.notEqual(value, undefined, path);
  if (typeof value === 'string') { assert.ok(value.trim(), path); assert.notEqual(value.trim().toLowerCase(), 'null', path); }
  if (typeof value === 'number') assert.ok(Number.isFinite(value), path);
  if (typeof value === 'object') for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
}

test('base profiles cover exactly the four real scenario IDs and keep a static version/date', () => {
  assert.equal(BASE_PROFILE_VERSION, '1.0.0');
  assert.deepEqual(scenarioData.map(s => s.id).sort(), Object.keys(expected).sort());
  const configBefore = structuredClone(ROVER_CONFIG);
  for (const scenario of scenarioData) {
    const p = getMissionBaseProfile(scenario);
    assert.deepEqual(p, getMissionBaseProfile(scenario.id));
    assert.deepEqual(validateMissionBaseProfile(p), { valid: true, errors: [] });
    assert.equal(p.schema, 'MissionBaseProfile');
    assert.equal(p.version, '1.0.0');
    assert.equal(p.scenarioId, scenario.id);
    assert.equal(p.revisionDate, '2026-11-14');
    assert.equal(p.kind, 'prototype-design');
    assert.equal(p.source, 'docs/perfiles-base-m2.md');
    assert.ok(p.assumptions.length >= 8);
    assert.equal(p.tools.length, 8);
    assert.ok(!JSON.stringify(p).includes('observedAt'));
    walk(p);
  }
  assert.deepEqual(ROVER_CONFIG, configBefore, 'does not fill unknown shared-config fields');
});

for (const [id, e] of Object.entries(expected)) {
  test(`${id}: task-specific tools have numeric engineering targets and independent actuator loads`, () => {
    const p = getMissionBaseProfile(id);
    assert.equal(value(p, 'sampler', 'massKg'), e.samplerMass);
    assert.equal(value(p, 'sampler', 'thrustN'), e.thrust);
    assert.equal(value(p, 'sampler', 'torqueNm'), e.torque);
    assert.equal(value(p, 'wheels', 'radiusM'), e.radius);
    assert.equal(tool(p, 'cameras').quantity, e.cameras);
    assert.equal(value(p, 'cameras', 'resolutionM'), e.resolution);
    assert.equal(value(p, 'rover', 'powerW'), e.roverPower);
    for (const gravity of [1.62, 3.71, 9.81]) assert.notEqual(e.thrust, e.samplerMass * gravity, 'thrust is not m*g');
    assert.equal(param(p, 'sampler', 'thrustN').kind, 'prototype-design');
    assert.match(param(p, 'sampler', 'thrustN').rationale, /independiente.*no validada/);
    for (const t of p.tools) {
      assert.equal(t.status, 'proposed-design');
      assert.equal(t.connected, false);
      assert.ok(Number.isInteger(t.quantity) && t.quantity > 0);
      assert.ok(t.parameters.length >= 5);
      for (const field of t.parameters) {
        assert.ok(['prototype-design', 'derived-design', 'not-applicable'].includes(field.kind));
        assert.equal(field.source, 'docs/perfiles-base-m2.md');
        assert.ok(field.rationale.trim().length >= 10);
        if (field.kind === 'not-applicable') {
          assert.match(field.value, /^No aplica: .+/);
          assert.equal(field.unit, 'No aplica');
        } else assert.equal(typeof field.value, 'number', field.key);
      }
      assert.ok(value(p, t.id, 'operatingMinK') > 0);
      assert.ok(value(p, t.id, 'operatingMinK') <= value(p, t.id, 'operatingMaxK'));
    }
    assert.equal(param(p, 'sampler', 'massKg').unit, 'kg');
    assert.equal(param(p, 'sampler', 'powerW').unit, 'W');
    assert.equal(param(p, 'sampler', 'diameterM').unit, 'm');
    assert.equal(param(p, 'sampler', 'thrustN').unit, 'N');
    assert.equal(param(p, 'sampler', 'torqueNm').unit, 'N·m');
    assert.equal(param(p, 'cameras', 'fieldOfViewRad').unit, 'rad');
  });

  test(`${id}: mass and power budgets count units once and separate the external installation`, () => {
    const p = getMissionBaseProfile(id);
    assert.equal(ROVER_CONFIG.massKg, 350);
    assert.equal(value(p, 'rover', 'massKg'), ROVER_CONFIG.massKg);
    assert.equal(tool(p, 'rover').massScope, 'rover-total');
    const included = p.tools.filter(t => t.massScope === 'included-in-rover');
    const totalMass = included.reduce((sum, t) => sum + t.quantity * value(p, t.id, 'massKg'), 0);
    const totalPower = included.reduce((sum, t) => sum + t.quantity * value(p, t.id, 'powerW'), 0);
    close(totalMass, e.includedMass);
    close(totalPower, e.componentPower);
    assert.ok(totalMass < ROVER_CONFIG.massKg);
    assert.ok(totalPower < e.roverPower);
    assert.equal(tool(p, 'support-bench').massScope, 'test-equipment');
    assert.equal(tool(p, 'external-kit').massScope, 'external-kit');
    assert.equal(tool(p, 'wheels').quantity, 6);
    assert.equal(value(p, 'wheels', 'supportedMassKg'), ROVER_CONFIG.massKg / 6);
    assert.equal(param(p, 'wheels', 'supportedMassKg').kind, 'derived-design');
    assert.match(param(p, 'wheels', 'supportedMassKg').rationale, /uniforme.*horizontal.*no distribución medida/);
    assert.notEqual(value(p, 'wheels', 'massKg'), value(p, 'wheels', 'supportedMassKg'));
  });

  test(`${id}: thermal is an explicit bench model and dosimeter range is never environmental dose`, () => {
    const p = getMissionBaseProfile(id);
    const fields = ['areaM2', 'surfaceK', 'surroundingsK', 'hWm2K', 'emissivity'];
    const units = ['m²', 'K', 'K', 'W/m²/K', '1'];
    assert.deepEqual(Object.keys(p.thermal), fields);
    fields.forEach((key, i) => {
      assert.equal(p.thermal[key].value, e.thermal[i]);
      assert.equal(p.thermal[key].unit, units[i]);
      assert.equal(p.thermal[key].kind, 'prototype-design');
      assert.equal(p.thermal[key].source, 'docs/perfiles-base-m2.md');
    });
    assert.equal(value(p, 'thermal-control', 'heatSetpointK'), p.thermal.surfaceK.value);
    assert.equal(value(p, 'support-bench', 'pressurePa'), e.pressure);
    assert.match(p.assumptions.join(' '), /no aire meteorológico.*Diviner/);
    assert.ok(value(p, 'dosimeter', 'doseRateMinGyS') < value(p, 'dosimeter', 'doseRateMaxGyS'));
    assert.equal(param(p, 'dosimeter', 'environmentalDoseRateGyS').kind, 'not-applicable');
    assert.match(value(p, 'dosimeter', 'environmentalDoseRateGyS'), /sin medición/);
    assert.equal(param(p, 'dosimeter', 'doseRateMaxGyS').unit, 'Gy/s');
  });
}

test('mission compositions differ in physical task, optics, geometry, pressure and external support', () => {
  const profiles = Object.keys(expected).map(getMissionBaseProfile);
  assert.equal(new Set(profiles.map(p => tool(p, 'sampler').name)).size, 4);
  assert.equal(new Set(profiles.map(p => value(p, 'sampler', 'diameterM'))).size, 4);
  assert.equal(new Set(profiles.map(p => value(p, 'cameras', 'resolutionM'))).size, 4);
  assert.equal(new Set(profiles.map(p => JSON.stringify(p.thermal))).size, 4);
  assert.equal(new Set(profiles.map(p => tool(p, 'support-bench').name)).size, 4);
  const polar = getMissionBaseProfile('polar-shadow');
  assert.equal(polar.thermal.hWm2K.value, 0);
  assert.equal(value(polar, 'support-bench', 'pressurePa'), 1, 'technical vacuum is proposed, never zero physical pressure');
  assert.ok(polar.thermal.surroundingsK.value < value(polar, 'sampler', 'operatingMinK'));
  assert.match(polar.assumptions.join(' '), /gas residual.*conducción/);
  const wind = getMissionBaseProfile('wind-canyon');
  assert.equal(value(wind, 'support-bench', 'windSetpointMs'), 12);
  assert.equal(value(wind, 'support-bench', 'slopeSetpointRad'), 0.17);
  const salts = getMissionBaseProfile('hyperarid-salt');
  assert.equal(param(salts, 'external-kit', 'powerW').kind, 'not-applicable');
  assert.match(value(salts, 'external-kit', 'powerW'), /pasivos/);
});

test('returned profile copies are deeply isolated from callers and other missions', () => {
  const original = getMissionBaseProfile('lava-tube');
  const copy = getMissionBaseProfile('lava-tube');
  copy.tools[0].parameters[0].value = 999;
  copy.tools[1].parameters.push({ key: 'injected' });
  copy.thermal.surfaceK.value = 1;
  copy.assumptions[0] = 'mutated';
  assert.deepEqual(getMissionBaseProfile('lava-tube'), original);
  assert.equal(value(getMissionBaseProfile('polar-shadow'), 'rover', 'massKg'), 350);
  const scenario = { id: 'lava-tube', title: 'caller title' };
  getMissionBaseProfile(scenario).title = 'other';
  assert.deepEqual(scenario, { id: 'lava-tube', title: 'caller title' });
});

test('unsupported IDs fail explicitly, including prototype-property names; no cross-mission fallback', () => {
  for (const input of ['unknown', 'marius-hills', '__proto__', 'toString', '', 'LAVA-TUBE', null, undefined, {}, { scenarioId: 'lava-tube' }, { id: 'unknown' }]) {
    assert.throws(() => getMissionBaseProfile(input), error => error instanceof RangeError && /no soportado/.test(error.message));
  }
});

test('validator rejects corrupt quantities, provenance, labels, dates, scopes and missing tools', () => {
  const corruptions = [
    p => { p.version = '2.0.0'; },
    p => { p.revisionDate = '2026-11-15'; },
    p => { p.scenarioId = 'unknown'; },
    p => { p.thermal.areaM2.value = 0; },
    p => { p.thermal.surfaceK.value = -1; },
    p => { p.thermal.hWm2K.value = -1; },
    p => { p.thermal.emissivity.value = 1.1; },
    p => { p.thermal.emissivity.value = NaN; },
    p => { p.thermal.areaM2.source = ''; },
    p => { p.thermal.areaM2.kind = 'observed'; },
    p => { p.thermal.areaM2.unit = 'ft²'; },
    p => { p.thermal.surfaceK.value = null; },
    p => { tool(p, 'sampler').name = 'null'; },
    p => { tool(p, 'sampler').quantity = 0; },
    p => { tool(p, 'sampler').quantity = 1.5; },
    p => { tool(p, 'sampler').massScope = 'payload-unknown'; },
    p => { tool(p, 'sampler').connected = true; },
    p => { param(p, 'sampler', 'massKg').value = Infinity; },
    p => { param(p, 'sampler', 'massKg').unit = 'g'; },
    p => { param(p, 'sampler', 'massKg').source = 'invented citation'; },
    p => { param(p, 'sampler', 'massKg').rationale = ' '; },
    p => { param(p, 'sampler', 'operatingMinK').value = 400; },
    p => { param(p, 'cameras', 'fieldOfViewRad').value = 7; },
    p => { param(p, 'thermal-control', 'heatSetpointK').value = 300; },
    p => { tool(p, 'dosimeter').parameters = tool(p, 'dosimeter').parameters.filter(q => q.key !== 'doseRateMinGyS'); },
    p => { tool(p, 'sampler').parameters = tool(p, 'sampler').parameters.filter(q => q.key !== 'diameterM'); },
    p => { tool(p, 'sampler').id = '__proto__'; },
    p => { tool(p, 'sampler').parameters.push(structuredClone(param(p, 'sampler', 'massKg'))); },
    p => { p.tools.push(structuredClone(tool(p, 'sampler'))); },
    p => { p.tools = p.tools.filter(t => t.id !== 'dosimeter'); },
    p => { p.assumptions = []; },
    p => { p.additional = { nested: undefined }; },
    p => { p.tools[0].parameters = {}; },
    p => { p.tools[1].parameters[0] = null; },
  ];
  for (const mutate of corruptions) {
    const profile = getMissionBaseProfile('lava-tube');
    mutate(profile);
    const result = validateMissionBaseProfile(profile);
    assert.equal(result.valid, false, mutate.toString());
    assert.ok(result.errors.length, mutate.toString());
  }
});

test('validator rejects double-counted mass, lost wheel derivation, over-budget power and invented dose', () => {
  const corruptions = [
    p => { param(p, 'rover', 'massKg').value = 1025; },
    p => { tool(p, 'rover').massScope = 'included-in-rover'; },
    p => { param(p, 'sampler', 'massKg').value = 350; },
    p => { param(p, 'sampler', 'powerW').value = 2000; },
    p => { tool(p, 'wheels').quantity = 4; },
    p => { param(p, 'wheels', 'supportedMassKg').value = 350; },
    p => { param(p, 'wheels', 'supportedMassKg').kind = 'prototype-design'; },
    p => { const q = param(p, 'dosimeter', 'environmentalDoseRateGyS'); Object.assign(q, { value: 1e-8, unit: 'Gy/s', kind: 'prototype-design' }); },
    p => { param(p, 'dosimeter', 'environmentalDoseRateGyS').value = 'unknown'; },
    p => { param(p, 'dosimeter', 'doseRateMinGyS').value = 1; },
  ];
  for (const mutate of corruptions) {
    const p = getMissionBaseProfile('lava-tube');
    mutate(p);
    assert.equal(validateMissionBaseProfile(p).valid, false, mutate.toString());
  }
});

test('validator reports malformed inputs without throwing and does not mutate inspected profiles', () => {
  for (const input of [undefined, null, false, '', 1, [], {}, { thermal: false, tools: [null, {}] }]) {
    assert.equal(validateMissionBaseProfile(input).valid, false);
  }
  const profile = getMissionBaseProfile('lava-tube');
  const snapshot = structuredClone(profile);
  validateMissionBaseProfile(profile);
  assert.deepEqual(profile, snapshot);
  profile.cycle = profile;
  const result = validateMissionBaseProfile(profile);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /cíclica/.test(e)));
});
