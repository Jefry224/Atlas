import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessLocalTerrain, countLocalBreaks, localTerrainBreaks } from '../src/hazards/m4-local-terrain.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const local = read('../assets/data/m4/cand-valles-marineris-05-local-dem.json');
const candidate = read('../assets/data/discovery/valles-marineris.json').candidates.find(c => c.id === local.siteId);

test('the USGS local crop is site-matched, one-meter, and remains a screening layer', () => {
  const result = assessLocalTerrain(local, candidate);
  assert.equal(result.status, 'ok');
  assert.equal(result.grid.gridSize, 401);
  assert.equal(result.validCells, 401 * 401);
  assert.equal(local.verticalAccuracyMeters, null);
  assert.match(local.sourceSha256, /^[a-f0-9]{64}$/);
  const screen = countLocalBreaks(result, 0.5);
  assert.equal(screen.kind, 'exploratory-dem-terrain-break-screen');
  assert.equal(screen.measured, 399 * 399);
  assert.ok(screen.above > 2000 && screen.above < 3000);
  assert.equal(screen.unknown, 401 * 401 - 399 * 399);
  assert.ok(result.slopeDeg.some(value => value > 45));
  assert.ok(result.localReliefM.some(value => value > 2));
});

test('the local residual removes a planar grade but responds to a sharp feature', () => {
  const n = 5;
  const elevation = Array.from({ length: n * n }, (_, i) => 2 * Math.floor(i / n) + 3 * (i % n));
  const grid = { gridSize: n, elevation };
  const plane = localTerrainBreaks(grid);
  assert.equal(plane[2 * n + 2], 0);
  assert.equal(plane[0], null);
  elevation[2 * n + 2] += 1;
  assert.equal(localTerrainBreaks(grid)[2 * n + 2], 1);
  elevation[2 * n + 1] = null;
  assert.equal(localTerrainBreaks(grid)[2 * n + 2], null);
});

test('foreign or malformed terrain cannot be attached to this candidate', () => {
  assert.equal(assessLocalTerrain({ ...local, siteId: 'another-site' }, candidate).status, 'invalid');
  assert.equal(assessLocalTerrain({ ...local, candidateCenter: [0, 0] }, candidate).status, 'invalid');
  assert.equal(assessLocalTerrain({ ...local, verticalAccuracyMeters: 0.1 }, candidate).status, 'invalid');
  assert.equal(countLocalBreaks(assessLocalTerrain(local, candidate), -1).status, 'invalid');
});
