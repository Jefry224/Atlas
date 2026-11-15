import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLandingController, FLIGHT_RATE } from '../landing-controller.mjs';
import { captureLanding, validateLandingPayload } from '../landing-report.mjs';

const read = path => JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url)));
const scenarios = read('assets/data/scenarios.json').scenarios;
const configs = scenarios.map(sc => ({ missionMode: 'paired-legacy', scenarioId: sc.id, body: sc.body, earthGrid: read(sc.earth), targetGrid: read(sc.target) }));
const defaults = { timeScale: 1, deploymentMode: 'manual' };
function setup(index = 0) {
  const outputs = [], deployments = [], events = [];
  const c = createLandingController({ publish: p => outputs.push(p), deploy: r => deployments.push(r), event: (type, detail) => events.push({ type, detail }) });
  c.configure(configs[index]);
  return { c, outputs, deployments, events };
}
function advanceUntil(c, phase) {
  for (let frame = 0; frame < 1200 && c.phase !== phase && c.running; frame++) c.step(0.1);
  assert.equal(c.phase, phase);
}
function enterDescent(c) {
  c.step(1); c.step(1);
  assert.equal(c.phase, 'descent');
}
function identity(index, missionId) {
  const sc = scenarios[index];
  return { missionId, scenarioId: sc.id, body: sc.body, earthId: sc.earthId, targetId: sc.targetId };
}

test('four scenarios hold indefinitely at manual contact, publish immediately, and authorize deployment exactly once', () => {
  assert.equal(FLIGHT_RATE, 4);
  for (let index = 0; index < scenarios.length; index++) {
    const { c, outputs, deployments } = setup(index);
    assert.deepEqual(c.view().options, defaults);
    assert.equal(c.requestDeployment(), false);
    c.start(`manual-${index}`);
    assert.equal(c.requestDeployment(), false);
    enterDescent(c);
    assert.equal(c.requestDeployment(), false);
    advanceUntil(c, 'contact');
    assert.equal(c.running, false);
    assert.equal(c.roverAllowed, false);
    assert.equal(deployments.length, 0);
    assert.equal(c.snapshot().runs.earth.phase, 'contact');
    assert.equal(c.snapshot().runs.target.phase, 'contact');
    assert.equal(outputs.at(-1).phase, 'contact');
    assert.equal(c.snapshot().endedAtUTC, null);
    assert.equal(c.snapshot().events.filter(e => e.type === 'deployment-waiting').length, 1);
    const waiting = c.snapshot(), publishCount = outputs.length;
    for (let frame = 0; frame < 500; frame++) {
      c.pause(true); c.pause(false); c.pause(); c.step(200);
    }
    assert.deepEqual(c.snapshot(), waiting);
    assert.equal(outputs.length, publishCount);
    assert.equal(c.running, false);
    assert.equal(c.requestDeployment(), true);
    assert.equal(c.phase, 'deployment');
    assert.equal(c.running, true);
    assert.equal(c.roverAllowed, false);
    assert.equal(outputs.at(-1).phase, 'deployment');
    const authorized = c.snapshot();
    assert.equal(authorized.events.at(-1).type, 'deployment-authorized');
    assert.equal(c.requestDeployment(), false);
    assert.deepEqual(c.snapshot(), authorized);
    c.step(1);
    assert.equal(c.roverAllowed, false);
    assert.equal(c.pause(false), true);
    for (let frame = 0; frame < 20; frame++) c.step(1);
    assert.equal(c.roverAllowed, false);
    assert.equal(c.pause(true), true);
    advanceUntil(c, 'exploration');
    assert.equal(c.roverAllowed, true);
    assert.equal(deployments.length, 1);
    assert.equal(c.snapshot().events.filter(e => e.type === 'deployment-authorized').length, 1);
    assert.equal(c.snapshot().events.filter(e => e.type === 'deployment').length, 1);
    const complete = c.snapshot();
    assert.equal(c.requestDeployment(), false);
    for (let frame = 0; frame < 20; frame++) c.step(1);
    assert.equal(deployments.length, 1);
    assert.deepEqual(c.snapshot(), complete);
    let previous = null;
    for (const p of outputs) {
      assert.deepEqual(p.options, defaults);
      assert.equal(p.timeScale, 1);
      assert.deepEqual(validateLandingPayload(p, { ...identity(index, `manual-${index}`), previous }), { valid: true, errors: [] });
      previous = p;
    }
    const captured = captureLanding(complete, identity(index, `manual-${index}`));
    assert.equal(captured.valid, true);
    assert.deepEqual(captured.value.options, defaults);
    assert.equal(captured.value.events.some(e => e.type === 'deployment-authorized'), true);
  }
});

test('rate changes preserve flight/paused state, publish the actual factor, and cap long frames at every allowed rate', () => {
  const { c, outputs } = setup();
  c.start('rates'); enterDescent(c);
  for (const rate of [0.5, 1, 2, 4]) {
    const before = c.snapshot();
    assert.equal(c.setOptions({ timeScale: rate }), true);
    assert.deepEqual(c.snapshot().runs, before.runs);
    assert.deepEqual(c.snapshot().history, before.history);
    assert.equal(outputs.at(-1).timeScale, rate);
    assert.deepEqual(c.inspect().options, { ...defaults, timeScale: rate });
    c.step(200);
    for (const side of ['earth', 'target']) assert.ok(Math.abs(c.inspect().runs[side].simSeconds - before.runs[side].simSeconds - rate) < 1e-8);
    assert.equal(c.pause(false), true);
    const paused = c.snapshot();
    assert.equal(c.setOptions({ timeScale: rate === 4 ? 1 : 4 }), true);
    assert.equal(c.running, false);
    assert.deepEqual(c.snapshot().runs, paused.runs);
    assert.deepEqual(c.snapshot().history, paused.history);
    const frozen = c.snapshot();
    for (const dt of [0, -1, NaN, Infinity, 200]) c.step(dt);
    assert.deepEqual(c.snapshot(), frozen);
    assert.equal(c.pause(true), true);
  }
  const p = c.snapshot();
  // Re-selecting 4× once in the loop is a no-op and creates no extra event.
  assert.equal(p.events.filter(e => e.type === 'time-scale-change').length, 7);
  assert.equal(p.events.filter(e => e.type === 'time-scale-change').at(-1).simSeconds, Math.max(p.runs.earth.simSeconds, p.runs.target.simSeconds));
  for (const published of outputs) assert.equal(validateLandingPayload(published, identity(0, 'rates')).valid, true);
  const before = c.snapshot();
  assert.equal(c.setOptions({ timeScale: c.view().options.timeScale }), true);
  assert.deepEqual(c.snapshot(), before);
});

test('equal SI elapsed time produces the same physics regardless of rate and invalid dt does not advance', () => {
  const { c: slow } = setup(), { c: normal } = setup();
  slow.setOptions({ timeScale: 0.5 }); slow.start('slow'); normal.start('normal');
  enterDescent(slow); enterDescent(normal);
  for (let frame = 0; frame < 20; frame++) { slow.step(0.2); normal.step(0.1); }
  assert.deepEqual(slow.inspect().runs, normal.inspect().runs);
  const before = normal.snapshot();
  for (const dt of [0, -1, NaN, Infinity, '1', null]) normal.step(dt);
  assert.deepEqual(normal.snapshot(), before);
  assert.match(slow.snapshot().events.find(e => e.type === 'descent-start').detail, /×0\.5/);
});

test('option validation is atomic before and after start, and returned options are isolated', () => {
  const { c, events, outputs } = setup();
  for (const bad of [null, [], '1', { timeScale: 0 }, { timeScale: '2' }, { timeScale: NaN }, { timeScale: Infinity }, { timeScale: undefined }, { deploymentMode: undefined }, { deploymentMode: 'AUTO' }, { timeScale: 2, deploymentMode: 'invalid' }, { timeScale: 4, unknown: true }]) {
    assert.equal(c.setOptions(bad), false);
    assert.deepEqual(c.view().options, defaults);
  }
  const input = { timeScale: 2, deploymentMode: 'automatic' };
  assert.equal(c.setOptions(input), true);
  input.timeScale = 0.5;
  assert.equal(events.length, 0);
  assert.equal(outputs.length, 0);
  c.start('atomic');
  const before = c.snapshot(), eventCount = events.length, publishCount = outputs.length;
  for (const bad of [{ timeScale: 4, deploymentMode: 'manual' }, { timeScale: 4, deploymentMode: null }, { timeScale: 4, unknown: true }]) {
    assert.equal(c.setOptions(bad), false);
    assert.deepEqual(c.snapshot(), before);
    assert.equal(events.length, eventCount);
    assert.equal(outputs.length, publishCount);
  }
  c.view().options.timeScale = 4; c.inspect().options.deploymentMode = 'manual';
  const snap = c.snapshot(); snap.options.timeScale = 4;
  assert.deepEqual(c.view().options, { timeScale: 2, deploymentMode: 'automatic' });
  assert.equal(c.setOptions({ timeScale: 2, deploymentMode: 'automatic' }), true);
  assert.deepEqual(c.snapshot(), before);
});

test('configure resets defaults, payload history, deployment permission and option events for a new session', () => {
  const { c } = setup();
  c.setOptions({ timeScale: 4, deploymentMode: 'automatic' }); c.start('old');
  advanceUntil(c, 'exploration');
  c.setOptions({ timeScale: 2 });
  assert.ok(c.snapshot().history.length);
  c.configure(configs[2]);
  assert.deepEqual(c.inspect().options, defaults);
  assert.equal(c.snapshot(), null);
  assert.equal(c.active, false); assert.equal(c.running, false); assert.equal(c.roverAllowed, false);
  assert.equal(c.requestDeployment(), false);
  assert.deepEqual(c.inspect().history, []);
  c.start('fresh');
  assert.equal(c.snapshot().missionId, 'fresh');
  assert.equal(c.snapshot().scenarioId, scenarios[2].id);
  assert.equal(c.snapshot().history.length, 1);
  assert.equal(c.snapshot().history[0].simSeconds, 0);
  assert.deepEqual(c.snapshot().events.map(e => e.type), ['preparation']);
  assert.equal(c.snapshot().timeScale, 1);
});

test('reduced and zero initial fuel use actual kg and unchanged profile budgets in every scenario', () => {
  for (let index = 0; index < scenarios.length; index++) for (const fraction of [0.5, 0]) {
    const { c, outputs, deployments } = setup(index), profiles = c.inspect().profiles;
    const initial = Object.fromEntries(['earth', 'target'].map(side => [side, { propellantKg: profiles[side].propellantKg * fraction }]));
    c.start(`fuel-${index}-${fraction}`, { initial });
    const started = c.snapshot();
    for (const side of ['earth', 'target']) {
      assert.equal(started.runs[side].propellantKg, initial[side].propellantKg);
      assert.equal(started.runs[side].massKg, profiles[side].dryMassKg + initial[side].propellantKg);
      assert.equal(started.profiles[side].propellantKg, profiles[side].propellantKg);
    }
    assert.equal(started.events[0].type, 'initial-conditions');
    for (let frame = 0; frame < 1200 && c.running; frame++) c.step(0.1);
    assert.equal(c.running, false);
    assert.equal(c.roverAllowed, false);
    assert.equal(deployments.length, 0);
    if (fraction === 0) {
      assert.equal(c.phase, 'hard-contact');
      const before = c.snapshot();
      assert.equal(c.requestDeployment(), false);
      assert.equal(c.pause(true), false);
      c.step(1);
      assert.deepEqual(c.snapshot(), before);
      for (const side of ['earth', 'target']) {
        assert.equal(before.runs[side].propellantKg, 0);
        assert.equal(before.runs[side].outcome.success, false);
        assert.ok(before.runs[side].faultCodes.includes('fuel-exhausted'));
      }
    }
    for (const p of outputs) {
      assert.equal(validateLandingPayload(p, identity(index, `fuel-${index}-${fraction}`)).valid, true);
      for (const side of ['earth', 'target']) assert.ok(p.runs[side].propellantKg <= initial[side].propellantKg);
    }
  }
});

test('abort, unavailable Earth, and contact aborted by operator never authorize a rover', () => {
  for (const mode of ['abort-flight', 'unavailable', 'abort-contact']) {
    const { c, deployments } = setup();
    if (mode === 'unavailable') c.configure({ ...configs[0], earthGrid: null });
    c.start(mode);
    if (mode === 'abort-contact') { advanceUntil(c, 'contact'); c.abort(); }
    else if (mode === 'abort-flight') { enterDescent(c); c.abort(); }
    else advanceUntil(c, 'unavailable');
    const before = c.snapshot();
    assert.equal(c.requestDeployment(), false);
    assert.equal(c.pause(true), false);
    c.step(1);
    assert.deepEqual(c.snapshot(), before);
    assert.equal(deployments.length, 0);
    assert.equal(c.roverAllowed, false);
  }
});

test('failed target remains explicit while nominal Earth still requires operator authorization', () => {
  const { c, deployments } = setup();
  c.start('target-fault', { initial: { earth: {}, target: { propellantKg: 0 } } });
  advanceUntil(c, 'contact');
  assert.equal(c.snapshot().runs.target.phase, 'hard-contact');
  assert.equal(c.roverAllowed, false);
  assert.equal(c.requestDeployment(), true);
  advanceUntil(c, 'exploration');
  assert.equal(deployments.length, 1);
  assert.equal(c.targetPose({ x: 0, z: 0, path: [] }), null);
  assert.equal(c.snapshot().runs.target.outcome.success, false);
});
