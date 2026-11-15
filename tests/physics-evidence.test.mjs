import test from 'node:test';
import assert from 'node:assert/strict';
import { regionalTiltSummary, thermalPairSummary } from '../src/mission/physics-evidence.mjs';
import { thermalStatus } from '../src/shared/sim-physics.mjs';

for (const value of [undefined, null, NaN, Infinity, -Infinity, '0', false]) {
  test(`missing/non-finite tilt (${typeof value}:${String(value)}) remains unavailable rather than a flat zero`, () => {
    const result = regionalTiltSummary({ pitch: value, roll: value });
    assert.equal(result.level, 'unknown'); assert.equal(result.maxTiltDeg, null);
    assert.equal(result.pitchDeg, null); assert.equal(result.rollDeg, null); assert.equal(result.tone, '');
    assert.match(result.title, /unavailable/); assert.doesNotMatch(result.title, /0[.,]0|flat|low/i);
    assert.match(result.detail, /not a local stability certification/);
  });
}
test('partial pitch or roll retains the available component but cannot establish a combined tilt', () => {
  for (const input of [{ pitch: 3, roll: null }, { pitch: null, roll: -8 }, { pitch: 0 }, { roll: 0 }]) {
    const result = regionalTiltSummary(input);
    assert.equal(result.maxTiltDeg, null); assert.equal(result.level, 'unknown'); assert.match(result.detail, /Both components are required/);
    assert.match(result.detail, /unavailable/); assert.equal(result.pitchDeg, Number.isFinite(input.pitch) ? input.pitch : null);
    assert.equal(result.rollDeg, Number.isFinite(input.roll) ? input.roll : null);
  }
});
test('known tilt uses both signed readings and illustrative boundaries without a safety conclusion', () => {
  for (const [input, expected, level] of [[{ pitch: 0, roll: 0 }, 0, 'low'], [{ pitch: -5, roll: 2 }, 5, 'low'], [{ pitch: 2, roll: -6 }, 6, 'moderate'], [{ pitch: -12, roll: 4 }, 12, 'elevated']]) {
    const result = regionalTiltSummary(input);
    assert.equal(result.maxTiltDeg, expected); assert.equal(result.level, level); assert.match(result.detail, /not a local stability certification/);
    assert.doesNotMatch(result.title + result.detail, /no rollover risk|safe zone|Sin riesgo|certified safe/i); assert.notEqual(result.tone, 'good');
  }
});
const states = { nominal: thermalStatus({ ambientK: 293 }), caution: thermalStatus({ ambientK: 240 }), critical: thermalStatus({ ambientK: 40 }), unknown: thermalStatus({}) };
for (const [earthLevel, earthThermal] of Object.entries(states)) for (const [targetLevel, targetThermal] of Object.entries(states)) {
  test(`thermal summary respects Earth ${earthLevel} and target ${targetLevel}`, () => {
    const result = thermalPairSummary({ earthThermal, targetThermal });
    assert.match(result.title, new RegExp(`Earth ${earthLevel}.*Target ${targetLevel}`));
    assert.equal(result.complete, earthLevel !== 'unknown' && targetLevel !== 'unknown');
    assert.equal(result.earth.level, earthLevel); assert.equal(result.target.level, targetLevel);
    assert.match(result.detail, /Earth:/); assert.match(result.detail, /Target:/);
    assert.match(result.detail, /different source domains/); assert.match(result.detail, /not measured rover hardware temperature/);
    const bothNominal = earthLevel === 'nominal' && targetLevel === 'nominal';
    assert.equal(result.detail.includes('within the illustrative model thresholds'), bothNominal);
    assert.equal(result.tone === 'good', bothNominal);
    if ([earthLevel, targetLevel].includes('critical')) { assert.equal(result.level, 'critical'); assert.match(result.detail, /outside the illustrative operating range/); }
    if ([earthLevel, targetLevel].includes('unknown')) assert.match(result.detail, /thermal state unavailable/);
    if (!bothNominal) assert.doesNotMatch(result.detail, /within.*range|within the illustrative model thresholds|Dentro del rango/i);
  });
}
test('absent, partial, unsupported or inconsistent thermal outputs cannot silently become nominal', () => {
  for (const missing of [undefined, null, {}, { level: 'nominal' }, { level: 'nominal', marginK: null }, { level: 'nominal', marginK: -1 }, { level: 'caution', marginK: 25 }, { level: 'critical', marginK: 3 }, { level: 'nominal', marginK: NaN }, { level: 'future', marginK: 30 }]) {
    const result = thermalPairSummary({ earthThermal: missing, targetThermal: states.nominal });
    assert.equal(result.earth.level, 'unknown'); assert.equal(result.earth.marginK, null); assert.equal(result.complete, false); assert.equal(result.tone, '');
    assert.doesNotMatch(result.detail, /within/);
  }
  assert.equal(thermalPairSummary().level, 'unknown');
});
