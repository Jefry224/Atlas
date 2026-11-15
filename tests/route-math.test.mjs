import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeTerrain, planRoute } from '../src/hazards/route-math.mjs';

const grid = (n, elevation = Array(n * n).fill(0)) =>
  ({ gridSize: n, spacingMeters: 10, elevation });

test('flat terrain yields a direct diagonal corridor', () => {
  const result = planRoute(grid(7), { row: 1, col: 1 }, { row: 5, col: 5 });
  assert.equal(result.status, 'ok');
  assert.equal(result.path.length, 5);
  assert.equal(result.distanceM, 4 * Math.SQRT2 * 10);
  assert.equal(result.maxSlopeDeg, 0);
  assert.equal(result.ascentM, 0);
});

test('steep barrier with a gap forces a detour', () => {
  const elevations = Array(9 * 9).fill(0);
  for (let row = 1; row < 8; row++) elevations[row * 9 + 4] = 100;
  for (let row = 5; row < 9; row++) elevations[row * 9 + 4] = 0;
  const result = planRoute(grid(9, elevations), { row: 2, col: 2 }, { row: 2, col: 6 });
  assert.equal(result.status, 'ok');
  assert.ok(result.distanceM > 40);
  assert.ok(result.path.some(point => point.row >= 5));
});

test('nodata and border slopes remain unknown', () => {
  const elevations = Array(25).fill(0);
  elevations[12] = null;
  const terrain = analyzeTerrain(grid(5, elevations));
  assert.equal(terrain.valid[12], false);
  assert.equal(terrain.slopeDeg[6], null);
  assert.equal(terrain.slopeDeg[0], null);
});

test('invalid endpoints are rejected', () => {
  assert.equal(planRoute(grid(5), { row: 0, col: 0 }, { row: 3, col: 3 }).status, 'invalid');
  assert.equal(planRoute(grid(5), { row: 1.5, col: 1 }, { row: 3, col: 3 }).status, 'invalid');
});

test('complete steep barrier yields no route', () => {
  const elevations = Array(9 * 9).fill(0);
  for (let row = 0; row < 9; row++) elevations[row * 9 + 4] = 100;
  assert.equal(planRoute(grid(9, elevations), { row: 4, col: 1 }, { row: 4, col: 7 }).status, 'no-route');
});

test('optional blocked-cell scenario diverts a flat-ground corridor', () => {
  const n = 7, blockedCells = Array(n * n).fill(false);
  blockedCells[3 * n + 3] = true;
  const result = planRoute(grid(n), { row: 3, col: 2 }, { row: 3, col: 4 }, { blockedCells });
  assert.equal(result.status, 'ok');
  assert.ok(result.distanceM > 20);
  assert.ok(result.path.every(point => !blockedCells[point.row * n + point.col]));
  assert.ok(result.caveats.some(text => text.includes('regional terrain constraints')));
});

test('blocked endpoints, complete barriers, and malformed masks are rejected', () => {
  const n = 7, blockedCells = Array(n * n).fill(false);
  for (let row = 1; row < n - 1; row++) blockedCells[row * n + 3] = true;
  assert.equal(planRoute(grid(n), { row: 3, col: 2 }, { row: 3, col: 4 }, { blockedCells }).status, 'no-route');
  blockedCells[3 * n + 2] = true;
  assert.equal(planRoute(grid(n), { row: 3, col: 2 }, { row: 3, col: 4 }, { blockedCells }).status, 'invalid');
  assert.equal(planRoute(grid(n), { row: 3, col: 2 }, { row: 3, col: 4 }, { blockedCells: [false] }).status, 'invalid');
  assert.equal(planRoute(grid(n), { row: 3, col: 2 }, { row: 3, col: 4 }, { blockedCells: Array(n * n).fill(0) }).status, 'invalid');
});

test('checkerboard elevations cannot hide steep edge grades behind smoothed slopes', () => {
  const n = 7;
  const elevations = Array.from({ length: n * n }, (_, i) =>
    (Math.floor(i / n) + i % n) % 2 === 0 ? 0 : 100);
  const terrain = analyzeTerrain(grid(n, elevations));
  assert.equal(terrain.slopeDeg[3 * n + 3], 0);
  const result = planRoute(grid(n, elevations), { row: 3, col: 3 }, { row: 3, col: 4 });
  assert.equal(result.status, 'no-route');
});

test('real discovery candidate grid is accepted', () => {
  const data = JSON.parse(readFileSync(new URL('../assets/data/discovery/shackleton.json', import.meta.url)));
  const candidate = data.candidates[0];
  const terrain = analyzeTerrain(candidate);
  assert.equal(terrain.status, 'ok');
  assert.equal(terrain.gridSize, 65);
  assert.equal(terrain.spacingMeters, 37.5);
  assert.ok(terrain.slopeDeg.some(Number.isFinite));
});
