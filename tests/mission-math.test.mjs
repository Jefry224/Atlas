import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_EXTENT, validGrid, gridExtent, roverLimit, waypoints, waypointsFor, sampleHeight, sampleSlope,
  elevationRange, centerProfile, slopeAlert, newRover, advanceRover, localCoordinates,
} from '../src/shared/mission-math.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const flat = (n, spacing, h = 100) => ({ gridSize: n, spacingMeters: spacing, elevation: Array(n * n).fill(h) });
const ramp = (n, spacing, rise) => ({ gridSize: n, spacingMeters: spacing,
  elevation: Array.from({ length: n * n }, (_, i) => (i % n) * spacing * rise) });

test('grid validation and extent', () => {
  assert.equal(validGrid(null), false);
  assert.equal(validGrid({ gridSize: 3, spacingMeters: 1, elevation: [1, 2] }), false);
  assert.equal(validGrid({ gridSize: 2, spacingMeters: 1, elevation: [1, 2, NaN, 3] }), false);
  assert.equal(gridExtent(flat(9, 300)), 2400);
  assert.equal(gridExtent(flat(65, 37.5)), 2400);
  assert.equal(gridExtent(flat(5, 100)), 400);
  assert.equal(gridExtent(null), DEFAULT_EXTENT);
});

test('backwards compatibility: 2400 m keeps the V1 ±1140 m bounds and loop', () => {
  assert.equal(roverLimit(), 1140);
  assert.equal(roverLimit(flat(9, 300)), 1140);
  assert.deepEqual(waypoints, [[550,-500],[700,350],[-500,650],[-650,-450],[0,0]]);
  assert.deepEqual(waypointsFor(flat(65, 37.5)), waypoints);
  const rover = newRover();
  rover.heading = 90;
  for (let i = 0; i < 2000; i++) advanceRover(rover, 0.1, { running: true, mode: 'manual', throttle: 1 });
  assert.equal(rover.x, 1140);
});

test('bounds and waypoints scale with the grid extent', () => {
  const small = flat(5, 100); // 400 m
  assert.equal(roverLimit(small), 190);
  const [wx, wz] = waypointsFor(small)[0];
  assert.ok(Math.abs(wx - 550 / 6) < 1e-9 && Math.abs(wz + 500 / 6) < 1e-9);
  const rover = newRover();
  rover.heading = 180;
  for (let i = 0; i < 2000; i++) advanceRover(rover, 0.1, { running: true, mode: 'manual', throttle: 1, grid: small });
  assert.equal(rover.z, 190);
  const viaExtent = newRover();
  viaExtent.heading = 270;
  for (let i = 0; i < 2000; i++) advanceRover(viaExtent, 0.1, { running: true, mode: 'manual', throttle: 1, extent: 400 });
  assert.equal(viaExtent.x, -190);
});

test('autonomous mode stays inside the scaled loop and visits waypoints', () => {
  const grid = flat(9, 50); // 400 m
  const rover = newRover();
  const limit = roverLimit(grid);
  for (let i = 0; i < 5000; i++) {
    advanceRover(rover, 0.1, { running: true, mode: 'auto', grid });
    assert.ok(Math.abs(rover.x) <= limit && Math.abs(rover.z) <= limit);
  }
  assert.ok(rover.waypoint > 0 || rover.distance > 300);
  assert.ok(rover.path.length > 10);
});

test('paused or empty battery does not move the rover', () => {
  const rover = newRover();
  advanceRover(rover, 0.1, { running: false, mode: 'auto' });
  assert.equal(rover.distance, 0);
  rover.battery = 0;
  advanceRover(rover, 0.1, { running: true, mode: 'auto' });
  assert.equal(rover.distance, 0);
  assert.equal(rover.speed, 0);
});

test('bilinear height and slope on 9×9 and 65×65 grids', () => {
  for (const [n, s] of [[9, 300], [65, 37.5]]) {
    const g = ramp(n, s, 0.1); // 10 % rise to the east ≈ 5.71°
    assert.ok(Math.abs(sampleHeight(g, 0, 0) - 120) < 1e-9);
    assert.ok(Math.abs(sampleHeight(g, -1200, 500) - 0) < 1e-9);
    assert.ok(Math.abs(sampleHeight(g, 5000, 0) - 240) < 1e-9, 'clamped outside the window');
    assert.ok(Math.abs(sampleSlope(g, 0, 0) - Math.atan(0.1) * 180 / Math.PI) < 1e-6);
  }
  assert.equal(sampleHeight(null, 0, 0), null);
  assert.equal(sampleSlope(null, 0, 0), null);
});

test('elevation range, central profile and slope alerts', () => {
  const g = ramp(5, 100, 0.5);
  assert.deepEqual(elevationRange(g), { min: 0, max: 200, relief: 200 });
  const profile = centerProfile(g);
  assert.equal(profile.length, 5);
  assert.deepEqual(profile.map(p => p.x), [-200, -100, 0, 100, 200]);
  assert.deepEqual(profile.map(p => p.elevation), [0, 50, 100, 150, 200]);
  assert.equal(elevationRange(null), null);
  assert.deepEqual(centerProfile(null), []);
  assert.equal(slopeAlert(null).level, 'unknown');
  assert.equal(slopeAlert(NaN).level, 'unknown');
  assert.equal(slopeAlert(3).level, 'nominal');
  assert.equal(slopeAlert(7).level, 'caution');
  assert.equal(slopeAlert(15).level, 'warning');
});

test('local coordinates move north for negative z and east for positive x', () => {
  const p = localCoordinates({ lat: 10, lon: 20 }, 1000, -1000);
  assert.ok(p.lat > 10 && p.lon > 20);
});

test('every shipped site DEM is a valid 2400 m grid', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/terrain-manifest.json'), 'utf8'));
  assert.equal(Object.keys(manifest).length, 14);
  for (const id of Object.keys(manifest)) {
    const grid = JSON.parse(fs.readFileSync(path.join(root, `assets/data/${id}.json`), 'utf8'));
    assert.ok(validGrid(grid), id);
    assert.equal(gridExtent(grid), 2400, id);
    assert.ok(fs.existsSync(path.join(root, grid.imagery.path)), id);
  }
});
