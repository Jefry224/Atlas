import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_ENV } from '../src/shared/sim-physics.mjs';
import { ROVER_CONFIG } from '../src/shared/rover-config.mjs';
import { getLandingProfile, validateLandingProfile, LANDING_PROFILE_VERSION } from '../src/landing/landing-profiles.mjs';

for (const body of ['earth','moon','mars']) {
  test(`${body}: versioned isolated proposed lander budget and BODY_ENV gravity`, () => {
    const p = getLandingProfile(body);
    assert.deepEqual(validateLandingProfile(p), { valid: true, errors: [] });
    assert.equal(p.version, LANDING_PROFILE_VERSION);
    assert.equal(p.gravityMs2, BODY_ENV[body].gravityMs2);
    assert.equal(p.payloadKg, ROVER_CONFIG.massKg);
    assert.equal(p.dryMassKg,p.payloadKg+p.landerDryMassKg);
    assert.ok(p.dryMassKg > ROVER_CONFIG.massKg);
    assert.ok(p.thrustMaxN > (p.dryMassKg+p.propellantKg)*p.gravityMs2);
    assert.equal(p.kind,'proposed-design');
    assert.equal(p.g0Ms2,9.80665);
    assert.ok(p.limitations.some(s=>s.includes('does not certify')));
    p.limitations.push('edited'); p.assumptions.propulsion='edited'; p.propellantKg=0;
    const fresh=getLandingProfile(body);
    assert.notEqual(fresh.propellantKg,0);
    assert.ok(!fresh.limitations.includes('edited'));
    assert.notEqual(fresh.assumptions.propulsion,'edited');
  });
}

test('unknown body/profile IDs and mismatched reference gravity are explicitly rejected', () => {
  for (const id of ['jupiter','Moon','__proto__',null,undefined]) assert.throws(()=>getLandingProfile(id),RangeError);
  assert.equal(validateLandingProfile({...getLandingProfile('moon'),id:'unknown-v1'}).valid,false);
  assert.equal(validateLandingProfile({...getLandingProfile('moon'),body:'mars'}).valid,false);
  assert.equal(validateLandingProfile({...getLandingProfile('moon'),gravityMs2:9.81}).valid,false);
  assert.equal(validateLandingProfile({...getLandingProfile('moon'),version:'2.0.0'}).valid,false);
});

test('profile SI ranges, missing values and mass accounting reject coercion; failure budgets remain testable', () => {
  for (const value of [null,undefined,[],false]) assert.equal(validateLandingProfile(value).valid,false);
  for (const [key,value] of [['dryMassKg',350],['propellantKg',-1],['ispSeconds',null],['thrustMaxN',NaN],['tiltMaxDeg',90],['startAltitudeM',0],['regionalRadiusCells',2],['regionalRadiusCells',3.5],['maxNativeResolutionRatio',99],['touchdownVerticalSpeedMs','1']]) {
    assert.equal(validateLandingProfile({...getLandingProfile('earth'),[key]:value}).valid,false,`${key}=${value}`);
  }
  assert.equal(validateLandingProfile({...getLandingProfile('moon'),thrustMaxN:0,propellantKg:0}).valid,true);
  assert.ok(getLandingProfile('mars').limitations.some(s=>s.includes('atmosphere')));
  assert.ok(getLandingProfile('earth').limitations.some(s=>s.includes('not a physical Earth test')));
});
