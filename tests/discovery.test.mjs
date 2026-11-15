import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { compareTerrain } from '../similarity.mjs';
import {
  relativeCenterProfiles,
  bestCandidateByRegion,
  pairedBarMax,
  thermalBands,
  profilePath,
} from '../discovery-math.mjs';

const discovery = JSON.parse(await readFile(new URL('./fixtures/discovery-mini.json', import.meta.url), 'utf8'));

function haversineM(a, b) {
  const r = 6371000, rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

test('candidates follow the geometry contract and descending ranking', () => {
  const target = { id: discovery.targetId, metrics: { slopeP50Deg: 2, slopeP90Deg: 4, reliefP95P5M: 10, triMeanM: 1, roughness: null } };
  assert.equal(discovery.version, 2);
  assert.equal(discovery.validCells, discovery.candidates.length);
  const scores = discovery.candidates.map((candidate) => {
    assert.equal(candidate.gridSize, 65);
    assert.ok(Array.isArray(candidate.center) && candidate.center.length === 2);
    assert.ok(candidate.scaleMeters && discovery.scales.includes(candidate.scaleMeters));
    return compareTerrain(candidate, target).index;      // target sin térmica → solo geometría
  });
  assert.deepEqual(scores, [100, 50, 50]);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test('NMS: las candidatas publicadas son lugares distintos (≥ una ventana)', () => {
  const minDist = discovery.scales[0];
  const c = discovery.candidates;
  for (let i = 0; i < c.length; i++)
    for (let j = i + 1; j < c.length; j++)
      assert.ok(haversineM(c[i].center, c[j].center) >= minDist,
        `${c[i].id} y ${c[j].id} están a <${minDist} m`);
});

test('los escaneos publicados comparten la versión 2 y extentMeters entero', async () => {
  const dir = new URL('../assets/data/discovery/', import.meta.url);
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json') && !name.startsWith('regions-'));
  assert.ok(names.includes('jezero.json') && names.includes('marius-hills.json'));
  for (const name of names) {
    const raw = await readFile(new URL(name, dir), 'utf8');
    assert.equal(raw.match(/"version":(\d+)/)?.[1], '2', name);
    assert.equal(raw.match(/"extentMeters":(\d+\.\d+)/)?.[1] ?? null, null, `${name} extentMeters`);
    const discovery = JSON.parse(raw);
    assert.equal(discovery.version, 2);
    assert.equal(discovery.window.extentMeters, 2400);
    assert.ok(Array.isArray(discovery.scales) && discovery.scales.length > 0);
    for (const candidate of discovery.candidates) {
      assert.equal(Number.isInteger(candidate.extentMeters), true, candidate.id);
      assert.equal(discovery.scales.includes(candidate.scaleMeters), true, candidate.id);
    }
  }
});

test('discovery-math: perfiles relativos y utilidades de UI', () => {
  const grid = {
    gridSize: 3,
    spacingMeters: 100,
    elevation: [0, 10, 20, 5, 15, 25, 10, 20, 30],
  };
  const profiles = relativeCenterProfiles(grid, grid);
  assert.ok(profiles.earth.length === 3);
  assert.equal(profiles.maxRelief, 25);
  const path = profilePath(profiles.earth, 200, profiles.maxRelief, 100, 50);
  assert.match(path, /^M/);
  assert.equal(pairedBarMax(4, 8), 8);
  const bands = thermalBands({ minK: 270, maxK: 300 }, { minK: 180, maxK: 280 });
  assert.ok(bands.span > 0);
  const byRegion = bestCandidateByRegion([
    { id: 'a', rank: 2, region: { id: 'r1' } },
    { id: 'b', rank: 1, region: { id: 'r1' } },
  ]);
  assert.equal(byRegion.get('r1').id, 'b');
});

test('la térmica entra en el índice cuando candidata y objetivo la tienen', () => {
  const target = { id: discovery.targetId, metrics: { slopeP50Deg: 2, slopeP90Deg: 4, reliefP95P5M: 10, triMeanM: 1, roughness: null }, thermal: { minK: 100, maxK: 300 } };
  const withThermal = discovery.candidates[0];       // tiene thermal
  const r = compareTerrain(withThermal, target);
  assert.ok(r.components.some((x) => x.key === 'thermalAmplitudeK'));
  const noThermal = discovery.candidates[2];         // thermal: null
  assert.ok(!compareTerrain(noThermal, target).components.some((x) => x.key === 'thermalAmplitudeK'));
});
