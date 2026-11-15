import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessRadarEvidence, assessRadarPair, assessSarEvidence, assessSpatialSar } from '../src/hazards/m4-sar.mjs';

const data = path => JSON.parse(readFileSync(new URL(`../assets/data/scenarios/${path}.json`, import.meta.url)));
const history = site => JSON.parse(readFileSync(new URL(`../assets/data/processes/${site}.json`, import.meta.url)));
const spatial = site => JSON.parse(readFileSync(new URL(`../assets/data/m4/${site}-sar.json`, import.meta.url)));
const candidate = target => JSON.parse(readFileSync(new URL(`../assets/data/discovery/${target}.json`, import.meta.url))).candidates[0];

test('single Sentinel-1 summary is evidence, not a temporal or spatial layer', () => {
  const result = assessRadarEvidence(data('earth/la-corona'));
  assert.equal(result.sceneCount, 1);
  assert.equal(result.scenes[0].unit, 'dB');
  assert.match(result.scenes[0].source, /sentinel-1-rtc/);
  assert.equal(result.spatialLayer, null);
  assert.equal(result.temporalChange, null);
  assert.equal(result.detectorValidation, null);
});

test('missing radar stays absent', () => {
  const result = assessRadarEvidence(data('targets/marius-hills'));
  assert.equal(result.sceneCount, 0);
  assert.equal(result.scenes.length, 0);
  assert.equal(result.temporalChange, null);
});

test('Sentinel-1 dB and Mini-RF CPR cannot be compared directly', () => {
  const result = assessRadarPair(data('earth/wright-valley'), data('targets/shackleton'));
  assert.equal(result.comparable, false);
  assert.equal(result.comparison, null);
  assert.equal(result.earth.scenes[0].unit, 'dB');
  assert.equal(result.target.scenes[0].unit, 'CPR');
});

test('published temporal history stays an aggregate series with no spatial or subsurface claims', () => {
  const result = assessSarEvidence({ earth: data('earth/la-corona'), target: data('targets/marius-hills'), history: history('la-corona') });
  const earth = result.earth;
  assert.equal(earth.temporalStatus, 'aggregate-series');
  assert.equal(earth.temporalHistory.count, 25);
  assert.equal(earth.temporalHistory.firstDate, '2025-11-18');
  assert.equal(earth.temporalHistory.lastDate, '2026-11-08');
  assert.ok(earth.temporalHistory.comparableAdjacentPairs > 0);
  assert.ok(earth.temporalHistory.comparableAdjacentPairs < earth.temporalHistory.count - 1);
  assert.equal(earth.spatialLayer, null);
  assert.equal(earth.temporalChange, null);
  assert.equal(earth.detectorValidation, null);
  assert.equal(result.comparison, null);
});

test('history from another site, center, window or polarization is rejected', () => {
  const earth = data('earth/la-corona');
  for (const changed of [
    { site: 'atacama' }, { center: [0, 0] }, { windowMeters: 1200 }, { polarization: 'HH' },
  ]) {
    const result = assessRadarEvidence(earth, { ...history('la-corona'), ...changed });
    assert.equal(result.temporalHistory, null);
    assert.equal(result.temporalStatus, 'mismatched-history');
  }
});

test('malformed chronology or orbit metadata cannot become a temporal result', () => {
  const earth = data('earth/la-corona');
  const source = history('la-corona');
  for (const changed of [
    { date: '2026-13-99' }, { relativeOrbit: 999 }, { validFraction: 0.1 }, { item: 'not-an-rtc-item' },
  ]) {
    const series = source.series.map((row, index) => index === 1 ? { ...row, ...changed } : row);
    const result = assessRadarEvidence(earth, { ...source, series });
    assert.equal(result.temporalStatus, 'invalid-history');
    assert.equal(result.temporalHistory, null);
  }
});

test('four published spatial SAR pairs are attached only to matching Earth reference windows', () => {
  for (const site of ['la-corona', 'wright-valley', 'atacama', 'wadi-rum']) {
    const grid = data(`earth/${site}`), map = spatial(site);
    const result = assessSpatialSar(grid, map);
    assert.equal(result.status, 'spatial-surface-context');
    assert.equal(result.data.siteId, site);
    assert.equal(result.data.gridSize, 120);
    assert.equal(result.data.sourcePixelSpacingMeters, 10);
    assert.deepEqual(result.data.nominalRadarResolutionMeters, { range: 20, azimuth: 22 });
    assert.equal(result.data.instrumentMode, 'IW');
    assert.equal(result.data.latestDb.length, 14400);
    assert.equal(result.data.deltaDb.length, 14400);
    assert.ok(result.data.comparableFraction >= 0.9);
    assert.equal(assessRadarEvidence(grid, history(site), map).spatialLayer, map);
  }
});

test('spatial SAR is rejected for a different site, center, polarization or malformed pixels', () => {
  const grid = data('earth/la-corona'), map = spatial('la-corona');
  for (const changed of [
    { siteId: 'atacama' }, { center: [0, 0] }, { polarization: 'HH' },
    { deltaDb: map.deltaDb.slice(1) }, { latestDb: [...map.latestDb.slice(0, -1), Infinity] },
    { oldScene: { ...map.oldScene, validFraction: 0.2 } },
    { nominalRadarResolutionMeters: { range: null, azimuth: 22 } },
  ]) {
    const result = assessSpatialSar(grid, { ...map, ...changed });
    assert.equal(result.status, 'invalid-spatial-pair');
    assert.equal(result.data, null);
  }
  assert.equal(assessSpatialSar(data('earth/atacama'), map).data, null);
});

test('a discovery candidate accepts its own SAR pair without inheriting a reference scene', () => {
  const grid = candidate('marius-hills');
  const map = spatial(grid.id);
  const result = assessSarEvidence({ earth: grid, target: data('targets/marius-hills'), spatial: map });
  assert.equal(result.earth.spatialStatus, 'spatial-surface-context');
  assert.equal(result.earth.spatialLayer.siteId, grid.id);
  assert.equal(result.earth.spatialLayer.siteRole, 'discovery-candidate');
  assert.equal(result.earth.sceneCount, 0);
  assert.equal(result.earth.temporalHistory, null);
  assert.equal(result.comparison, null);
  assert.equal(assessSpatialSar(grid, spatial('la-corona')).data, null);
  assert.equal(assessSpatialSar(grid, { ...map, targetId: 'jezero' }).data, null);
});

test('all 19 published discovery candidates have distinct, correctly attached spatial SAR maps', () => {
  let count = 0;
  for (const target of ['marius-hills', 'shackleton', 'jezero', 'valles-marineris']) {
    const discovery = JSON.parse(readFileSync(new URL(`../assets/data/discovery/${target}.json`, import.meta.url)));
    for (const grid of discovery.candidates) {
      const map = spatial(grid.id);
      assert.equal(map.siteRole, 'discovery-candidate');
      assert.equal(map.targetId, target);
      assert.equal(assessSpatialSar(grid, map).status, 'spatial-surface-context');
      assert.ok(map.latestDb.some(Number.isFinite));
      assert.ok(map.deltaDb.some(Number.isFinite));
      count++;
    }
  }
  assert.equal(count, 19);
});
