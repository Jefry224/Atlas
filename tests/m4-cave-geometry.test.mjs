import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessCaveSections } from '../src/hazards/m4-cave-geometry.mjs';

const data = JSON.parse(readFileSync(new URL('../assets/data/m4/la-corona-cave-sections.json', import.meta.url), 'utf8'));

test('La Corona catalog sections retain metric geometry and explicit depth limits', () => {
  const assessment = assessCaveSections(data);
  assert.equal(assessment.status, 'ok');
  assert.equal(assessment.summary.count, 74);
  assert.ok(assessment.summary.widthM.min < assessment.summary.widthM.median);
  assert.ok(assessment.summary.widthM.median < assessment.summary.widthM.max);
  assert.ok(assessment.summary.heightM.min < assessment.summary.heightM.max);
  assert.equal(data.stationCoordinates, null);
  assert.equal(data.roofDepthBySectionM, null);
  assert.match(data.sourceArchiveSha256, /^[a-f0-9]{64}$/);
  for (const section of assessment.sections) {
    const points = section.outlineM;
    const area = Math.abs(points.reduce((sum, [x, y], index) => {
      const [nextX, nextY] = points[(index + 1) % points.length];
      return sum + x * nextY - nextX * y;
    }, 0)) / 2;
    assert.ok(Math.abs(area - section.areaM2) < 0.05);
  }
});

test('a foreign or malformed cave catalog cannot be attached to La Corona', () => {
  assert.equal(assessCaveSections({ ...data, siteId: 'another-site' }).status, 'invalid');
  assert.equal(assessCaveSections({ ...data, roofDepthBySectionM: [15] }).status, 'invalid');
  const sections = data.sections.slice();
  sections[0] = { ...sections[0], outlineM: [[0, 0], [999, 0], [0, 1]] };
  assert.equal(assessCaveSections({ ...data, sections }).status, 'invalid');
});
