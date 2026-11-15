import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTerrain, ratioScore, SIMILARITY_COMPONENTS, ROUGHNESS_WEIGHT, GEOMETRY_CAVEAT,
  THERMAL_CAVEAT, thermalAmplitudeK } from '../src/shared/similarity.mjs';

const M = { slopeP50Deg: 4.2, slopeP90Deg: 11.5, reliefP95P5M: 180, triMeanM: 2.4, comparable: true, roughness: null };
const sumW = (r) => r.components.reduce((s, c) => s + c.weight, 0);

test('pesos editoriales suman 1 con rugosidad', () => {
  const s = SIMILARITY_COMPONENTS.reduce((a, c) => a + c.weight, 0) + ROUGHNESS_WEIGHT;
  assert.ok(Math.abs(s - 1) < 1e-9);
});

test('métricas idénticas → índice 100, comparable, pesos renormalizados', () => {
  const r = compareTerrain({ name: 'A', metrics: M }, { name: 'B', metrics: { ...M } });
  assert.equal(r.index, 100);
  assert.equal(r.comparable, true);
  assert.equal(r.components.length, 4);
  assert.ok(Math.abs(sumW(r) - 1) < 1e-9);
  assert.ok(r.caveats.includes(GEOMETRY_CAVEAT));
  assert.match(GEOMETRY_CAVEAT, /^Geometric, not planetary, similarity index/);
  assert.doesNotMatch(JSON.stringify(r), /similitud|planetaria/i);
});

test('sin métricas → index null y comparable false, sin lanzar', () => {
  for (const [a, b] of [[null, null], [{}, { metrics: M }], [{ metrics: M }, { name: 'X' }], [undefined, undefined]]) {
    const r = compareTerrain(a, b);
    assert.equal(r.index, null); assert.equal(r.comparable, false);
    assert.ok(r.caveats.includes(GEOMETRY_CAVEAT));
  }
});

test('métrica núcleo ausente → index null y caveat', () => {
  const r = compareTerrain({ metrics: { ...M, triMeanM: null } }, { metrics: M });
  assert.equal(r.index, null);
  assert.ok(r.caveats.some((c) => /Mean TRI/.test(c)));
});

test('ratioScore es simétrico, acotado y maneja ceros', () => {
  assert.equal(ratioScore(2, 4), 50);
  assert.equal(ratioScore(4, 2), 50);
  assert.equal(ratioScore(0, 0), 100);
  assert.equal(ratioScore(0, 0, 0.1), 100);
  assert.equal(ratioScore(0, 5), 0);
  assert.ok(ratioScore(0, 0.05, 0.1) === 100);
  assert.equal(ratioScore(null, 1), null);
});

test('índice baja con la diferencia y queda en [0, 100]', () => {
  const r = compareTerrain({ metrics: M }, { metrics: { ...M, slopeP50Deg: 8.4, reliefP95P5M: 900 } });
  assert.ok(r.index > 0 && r.index < 100);
  const far = compareTerrain({ metrics: M }, { metrics: { slopeP50Deg: 40, slopeP90Deg: 80, reliefP95P5M: 1e5, triMeanM: 500 } });
  assert.ok(far.index >= 0 && far.index < r.index);
});

test('comparable=false en cualquiera → comparable false pero calcula índice', () => {
  const r = compareTerrain({ name: 'Wadi Rum', metrics: M }, { name: 'Valles Marineris', metrics: { ...M, comparable: false } });
  assert.equal(r.comparable, false);
  assert.equal(r.index, 100);
  assert.ok(r.caveats.some((c) => /Valles Marineris/.test(c) && /Not comparable/.test(c)));
});

test('rugosidad: solo con la misma unidad; dB por diferencia', () => {
  const rough = (value, unit) => ({ value, unit, method: 'test', source: 'test' });
  const same = compareTerrain({ metrics: { ...M, roughness: rough(-12, 'dB') } }, { metrics: { ...M, roughness: rough(-12, 'dB') } });
  assert.equal(same.components.length, 5); assert.equal(same.index, 100);
  assert.ok(Math.abs(sumW(same) - 1) < 1e-9);
  const diff = compareTerrain({ metrics: { ...M, roughness: rough(-12, 'dB') } }, { metrics: { ...M, roughness: rough(-17, 'dB') } });
  assert.equal(diff.components.at(-1).score, 36.8);
  const mixed = compareTerrain({ metrics: { ...M, roughness: rough(-12, 'dB') } }, { metrics: { ...M, roughness: rough(0.4, 'CPR') } });
  assert.equal(mixed.components.length, 4);
  assert.ok(mixed.caveats.some((c) => /different units/.test(c)));
});

test('acepta metrics directamente (contexto §5)', () => {
  assert.equal(compareTerrain(M, M).index, 100);
});

test('thermalAmplitudeK lee amplitudeK o maxK-minK', () => {
  assert.equal(thermalAmplitudeK({ thermal: { amplitudeK: 14 } }), 14);
  assert.equal(thermalAmplitudeK({ thermal: { minK: 100, maxK: 300 } }), 200);
  assert.equal(thermalAmplitudeK({ thermal: null }), null);
  assert.equal(thermalAmplitudeK(M), null);
});

test('amplitud térmica: entra solo con ambos lados, con caveat y pesos renormalizados', () => {
  const earth = { metrics: M, thermal: { amplitudeK: 20 } };
  const target = { metrics: { ...M }, thermal: { minK: 100, maxK: 300 } };
  const r = compareTerrain(earth, target);
  const thermal = r.components.find((c) => c.key === 'thermalAmplitudeK');
  assert.ok(thermal && thermal.score === 10);                 // 100·20/200
  assert.ok(Math.abs(sumW(r) - 1) < 1e-9);
  assert.ok(r.caveats.includes(THERMAL_CAVEAT));
  assert.ok(r.index > 0 && r.index < 100);                    // la térmica baja; la geometría es idéntica
  // sin térmica en un lado → no hay componente ni caveat térmico
  const noneOnEarth = compareTerrain({ metrics: M }, target);
  assert.ok(!noneOnEarth.components.some((c) => c.key === 'thermalAmplitudeK'));
  assert.ok(!noneOnEarth.caveats.includes(THERMAL_CAVEAT));
});
