import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRegionalIrregularity, classifyTerrainRelief, classifyTerrainSlope, modelTerrainShadow } from '../src/hazards/m4-hazards.mjs';

const grid = (n, elevation = Array(n * n).fill(0)) =>
  ({ gridSize: n, spacingMeters: 10, elevation, dataset: 'test DEM', nativeResolutionMeters: 10 });

test('flat DEM keeps interior slopes within limit and border unknown', () => {
  const result = classifyTerrainSlope(grid(5), 15);
  assert.deepEqual(result.counts, { 'within-limit': 9, 'above-limit': 0, unknown: 16 });
  assert.equal(result.kind, 'model');
});

test('slope layer distinguishes a steep planar DEM from unknown cells', () => {
  const z = Array.from({ length: 25 }, (_, i) => (i % 5) * 10);
  const result = classifyTerrainSlope(grid(5, z), 15);
  assert.deepEqual(result.counts, { 'within-limit': 0, 'above-limit': 9, unknown: 16 });
});

test('low sun illuminates flat DEM and is blocked by an elevated ridge', () => {
  const z = Array(25).fill(0);
  for (let row = 0; row < 5; row++) z[row * 5 + 3] = 20;
  const result = modelTerrainShadow(grid(5, z), { elevationDeg: 10, azimuthDeg: 90 });
  assert.equal(result.status, 'ok');
  assert.equal(result.cells[2 * 5 + 1], 'shadowed');
  assert.equal(result.cells[2 * 5 + 4], 'lit');
});

test('missing DEM samples make potential shadow unknown', () => {
  const z = Array(25).fill(0); z[2 * 5 + 3] = null;
  const result = modelTerrainShadow(grid(5, z), { elevationDeg: 10, azimuthDeg: 90 });
  assert.equal(result.cells[2 * 5 + 1], 'unknown');
});

test('sun below horizon is modeled dark and invalid geometry is rejected', () => {
  const result = modelTerrainShadow(grid(3), { elevationDeg: -1, azimuthDeg: 90 });
  assert.equal(result.counts.shadowed, 9);
  assert.equal(modelTerrainShadow(grid(3), { elevationDeg: 10 }).status, 'invalid');
});

test('regional irregularity is zero on a flat DEM and unknown at borders', () => {
  const result = analyzeRegionalIrregularity(grid(5));
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.counts, { measured: 9, unknown: 16 });
  assert.equal(result.localReliefM[2 * 5 + 2], 0);
  assert.equal(result.triM[2 * 5 + 2], 0);
  assert.equal(result.triM[0], null);
  assert.equal(result.spacingMeters, 10);
  assert.equal(result.nativeResolutionMeters, 10);
  assert.equal(result.source, 'test DEM');
});

test('TRI matches the eight-neighbor mean and relief captures a single spike', () => {
  const z = Array(25).fill(0); z[2 * 5 + 2] = 8;
  const result = analyzeRegionalIrregularity(grid(5, z));
  assert.equal(result.localReliefM[2 * 5 + 2], 8);
  assert.equal(result.triM[2 * 5 + 2], 8);
  assert.equal(result.triM[2 * 5 + 1], 1);
  const classified = classifyTerrainRelief(grid(5, z), 4);
  assert.equal(classified.cells[2 * 5 + 2], 'above-limit');
  assert.equal(classified.counts['above-limit'], 9);
  assert.equal(classified.kind, 'scenario-classification');
});

test('regional relief detects a planar gradient without treating it as a rock', () => {
  const z = Array.from({ length: 25 }, (_, index) => index % 5 * 2);
  const result = analyzeRegionalIrregularity(grid(5, z));
  assert.equal(result.localReliefM[2 * 5 + 2], 4);
  assert.equal(result.triM[2 * 5 + 2], 1.5);
  assert.equal(classifyTerrainRelief(grid(5, z), 4).counts['above-limit'], 0);
  assert.equal(classifyTerrainRelief(grid(5, z), 3).counts['above-limit'], 9);
});

test('nodata neighborhoods and invalid thresholds remain unknown or invalid', () => {
  const z = Array(25).fill(0); z[2 * 5 + 2] = null;
  const result = analyzeRegionalIrregularity(grid(5, z));
  assert.deepEqual(result.counts, { measured: 0, unknown: 25 });
  assert.equal(result.triM[2 * 5 + 1], null);
  assert.deepEqual(classifyTerrainRelief(grid(5, z), 0).counts,
    { 'within-limit': 0, 'above-limit': 0, unknown: 25 });
  assert.equal(classifyTerrainRelief(grid(5), -1).status, 'invalid');
  assert.equal(classifyTerrainRelief(grid(5), undefined).status, 'invalid');
  assert.equal(analyzeRegionalIrregularity(grid(2)).status, 'invalid');
});
