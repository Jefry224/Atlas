import test from 'node:test';
import assert from 'node:assert/strict';
import { preparationIdentity, confirmPreparation, preparationMatches } from '../src/mission/mission-preparation.mjs';

const input = () => ({ scenarioId: 'lava-tube', generation: 1, body: 'moon', fuelPercent: 80,
  profile: { id: 'moon', dryMassKg: 850, propellantKg: 180 },
  plan: { gridId: 'target-dem', grid: { id: 'target-dem' }, selectedId: 'z1', zones: [
    { id: 'z1', x: 12, z: 18, status: 'candidate', slopeDeg: 2, reliefM: 5 },
    { id: 'z2', x: 42, z: 48, status: 'caution', slopeDeg: 4, reliefM: 8 },
  ] } });
const reviewed = { zoneReviewed: true, loadReviewed: true };

test('launch requires an explicit review of both preparation stages', () => {
  const identity = preparationIdentity(input());
  assert.equal(preparationMatches(null, identity), false);
  assert.equal(confirmPreparation(identity), null);
  assert.equal(confirmPreparation(identity, { zoneReviewed: true }), null);
  assert.equal(confirmPreparation(identity, { loadReviewed: true }), null);
  assert.equal(preparationMatches(confirmPreparation(identity, reviewed), identity), true);
});

test('confirmation matches exact scenario, generation, target zone, profile, and initial fuel', () => {
  const initial = input(), confirmation = confirmPreparation(preparationIdentity(initial), reviewed);
  for (const change of [{ scenarioId: 'polar-shadow' }, { generation: 2 }, { body: 'mars' }, { fuelPercent: 0 },
    { plan: { ...initial.plan, selectedId: 'z2' } }, { profile: { ...initial.profile, propellantKg: 260 } },
    { plan: { ...initial.plan, gridId: 'reloaded-dem' } }]) {
    assert.equal(preparationMatches(confirmation, preparationIdentity({ ...input(), ...change })), false);
  }
  assert.equal(preparationMatches(confirmation, preparationIdentity({ ...input(), camera: 'lower', timeScale: 4, comparison: true })), true);
  assert.equal(confirmation.propellantKg, 144);
  assert.equal(confirmation.initialMassKg, 994);
});

test('missing DEM, invalid selection, ineligible zones and invalid fuel cannot be confirmed', () => {
  const initial = input();
  for (const change of [{ plan: null }, { plan: { ...initial.plan, grid: null } }, { plan: { ...initial.plan, selectedId: 'absent' } },
    { plan: { ...initial.plan, zones: [{ ...initial.plan.zones[0], eligible: false }] } },
    { plan: { ...initial.plan, zones: [{ ...initial.plan.zones[0], status: 'unevaluable' }] } },
    ...[-1, 101, NaN, Infinity].map(fuelPercent => ({ fuelPercent }))]) {
    assert.equal(confirmPreparation(preparationIdentity({ ...input(), ...change }), reviewed), null);
  }
});

test('explicit zero fuel remains a valid deliberate failure experiment; identities cannot be mutated', () => {
  const identity = preparationIdentity({ ...input(), fuelPercent: 0 });
  const confirmation = confirmPreparation(identity, reviewed);
  assert.equal(confirmation.propellantKg, 0);
  assert.equal(confirmation.initialMassKg, 850);
  assert.equal(preparationMatches(confirmation, identity), true);
  assert.throws(() => { confirmation.fuelPercent = 100; }, TypeError);
  assert.throws(() => { identity.zoneId = 'z2'; }, TypeError);
});
