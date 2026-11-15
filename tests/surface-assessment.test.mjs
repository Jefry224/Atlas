import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateRock, estimateCavity, assessSurface, compactSurface, surfaceMarkdown, answerSurface, MARIUS_REFERENCE } from '../src/mission/surface-assessment.mjs';
const context = { key: 'earth:atacama:session:dem', siteId: 'atacama', body: 'earth', name: 'Atacama', sessionId: 'earth-test', grid: { nativeResolutionMeters: 30, spacingMeters: 37.5 } };
const rock = { lengthM: 1, widthM: .8, heightM: .5, densityMinKgM3: 2600, densityMaxKgM3: 3200, clearanceM: .3 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test('ellipsoid units, conditional mass and body weight follow the declared inputs', () => {
  const r = estimateRock(rock, context);
  close(r.volumeM3.nominal, Math.PI / 6 * .4);
  close(r.massKg.min, Math.PI / 6 * .4 * 2600);
  close(r.massKg.max, Math.PI / 6 * .4 * 3200);
  close(r.weightN.min, r.massKg.min * r.gravityMs2);
  close(r.heightToClearance, .5 / .3);
  assert.equal(r.material, null); assert.equal(r.detection, null);
  const moon = estimateRock(rock, { ...context, body: 'moon' });
  close(moon.massKg.min, r.massKg.min); assert.ok(moon.weightN.min < r.weightN.min);
});
test('unknown dimensional uncertainty stays unknown while an assumed envelope propagates all axes', () => {
  const unknown = estimateRock(rock, context), assumed = estimateRock({ ...rock, uncertaintyPct: 20 }, context);
  assert.equal(unknown.volumeM3.min, null); assert.equal(unknown.volumeM3.max, null);
  close(assumed.volumeM3.min, unknown.volumeM3.nominal * .8 ** 3);
  close(assumed.volumeM3.max, unknown.volumeM3.nominal * 1.2 ** 3);
  close(assumed.massKg.min, assumed.volumeM3.min * 2600);
  assert.ok(assumed.massKg.max > unknown.massKg.max);
});
test('missing and partial geometry/density produce partial unknowns rather than a fabricated zero', () => {
  const empty = estimateRock({}, context); assert.equal(empty.volumeM3.nominal, null); assert.equal(empty.massKg.min, null);
  const partial = estimateRock({ ...rock, densityMaxKgM3: null }, context);
  assert.ok(partial.volumeM3.nominal > 0); assert.equal(partial.massKg.max, null);
  const pit = estimateCavity({ lengthM: 10, widthM: 6 }, context);
  close(pit.openingAreaM2.nominal, Math.PI * 15); assert.equal(pit.pitEnvelopeM3.nominal, null); assert.equal(pit.idealDropSeconds, null);
});
test('invalid finite/range inputs are rejected without producing plausible geometry', () => {
  for (const value of [0, -1, NaN, Infinity, '1', false, 100001]) {
    const r = estimateRock({ ...rock, lengthM: value }, context); assert.equal(r.valid, false); assert.equal(r.volumeM3.nominal, null);
    const v = estimateCavity({ lengthM: 10, widthM: 6, depthM: value }, context); assert.equal(v.valid, false); assert.equal(v.pitEnvelopeM3.nominal, null);
  }
  assert.equal(estimateRock({ ...rock, densityMinKgM3: 4000 }, context).valid, false);
  for (const value of [-1, 100, Infinity, '20']) assert.equal(estimateRock({ ...rock, uncertaintyPct: value }, context).valid, false);
});
test('sample-count and survey-target use the coarser scale and do not imply detection', () => {
  const r = estimateRock(rock, context); close(r.scale.samplesAcross, .8 / 37.5); close(r.scale.requestedSurveySpacingM, .8 / 3);
  assert.equal(estimateRock(rock).scale.samplesAcross, null);
  assert.equal(estimateRock(rock, { grid: { spacingMeters: 1 } }).scale.samplesAcross, null);
  assert.match(r.scale.meaning, /not a detection/);
});
test('pit area, depth envelope and gravity-only time are separate from connected cave geometry', () => {
  const v = estimateCavity({ lengthM: 10, widthM: 6, depthM: 4, uncertaintyPct: 20 }, context);
  close(v.openingAreaM2.nominal, Math.PI * 15); close(v.pitEnvelopeM3.nominal, Math.PI * 60);
  close(v.openingAreaM2.min, Math.PI * 15 * .8 ** 2); close(v.pitEnvelopeM3.max, Math.PI * 60 * 1.2 ** 3);
  close(v.idealDropSeconds, Math.sqrt(8 / v.gravityMs2));
  for (const key of ['connectedCaveVolumeM3', 'roofThicknessM', 'stability', 'detection']) assert.equal(v[key], null);
});
test('published Marius dimensions require the exact site, body, values and unknown uncertainty', () => {
  const input = { lengthM: 55, widthM: 49, depthM: 40, uncertaintyPct: null };
  const ctx = { ...context, body: 'moon', siteId: 'marius-hills', basis: MARIUS_REFERENCE.id };
  const r = estimateCavity(input, ctx); assert.equal(r.kind, 'published-stereo-estimate'); assert.equal(r.source.source, MARIUS_REFERENCE.source);
  assert.equal(r.pitEnvelopeM3.min, null);
  for (const altered of [{ ...ctx, body: 'earth' }, { ...ctx, siteId: 'jezero' }]) assert.equal(estimateCavity(input, altered).kind, 'operator-hypothesis');
  for (const altered of [{ ...input, depthM: 41 }, { ...input, uncertaintyPct: 20 }]) assert.equal(estimateCavity(altered, ctx).source, null);
});
test('snapshots and compact provider context preserve identity, nulls, basis and source limits', () => {
  const c = structuredClone(context), r = assessSurface(c, rock, { lengthM: 10, widthM: 6, depthM: 4 });
  c.siteId = 'different'; assert.equal(r.context.siteId, 'atacama');
  const compact = compactSurface(r, 3); assert.equal(compact.revision, 3); assert.equal(compact.siteId, 'atacama');
  assert.equal(compact.cavity.stability, null); assert.equal(compact.rock.uncertaintyPct, null);
  const leaves = x => x && typeof x === 'object' ? Object.values(x).reduce((n, v) => n + leaves(v), 0) : 1;
  assert.ok(leaves(compact) <= 55); assert.match(compact.scope, /unknown, not zero/);
  close(compact.rock.weightBoundsN[0],r.rock.weightN.min);assert.equal(compact.reference.source,MARIUS_REFERENCE.source);
});
test('local Flight Director uses a captured estimate and does not claim detection or stability', () => {
  const r = assessSurface(context, rock, { lengthM: 10, widthM: 6, depthM: 4 });
  const answer = answerSurface('Evalúa rocas y cavidades', r);
  assert.match(answer.answer, /operator hypothesis/); assert.match(answer.answer, /No cavity has been detected/); assert.match(answer.answer, /roof stability are unavailable/);
  assert.equal(answer.provider, 'rules'); assert.ok(answer.grounded.includes('surfaceAssessment.rock.volumeM3'));
  assert.equal(answerSurface('What is the weather?', r), null);
});
test('standalone Markdown carries the assumptions, formulas, sources and unknowns', () => {
  const md = surfaceMarkdown(assessSurface(context, rock, { lengthM: 10, widthM: 6, depthM: 4 }));
  for (const text of ['Atacama', 'earth-test', 'ellipsoid', 'unavailable', 'operator hypothesis', MARIUS_REFERENCE.source, 'cylindrical', 'Conditional mass']) assert.match(md.toLowerCase(), new RegExp(text.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
