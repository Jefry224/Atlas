import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessSubsurface } from '../m4-subsurface.mjs';
import { assessCaveSections } from '../m4-cave-geometry.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('La Corona and Marius Hills retain separately sourced surface and subsurface evidence', () => {
  const result = assessSubsurface('lava-tube', read('../assets/data/scenarios/earth/la-corona.json'),
    read('../assets/data/scenarios/targets/marius-hills.json'));
  assert.equal(result.status, 'context-only');
  assert.equal(result.sites.length, 2);
  for (const site of result.sites) {
    assert.match(site.source.url, /^https:\/\//);
    assert.equal(site.tubeGeometry, null);
    assert.equal(site.interiorSurvey, null);
    assert.equal(site.detectorValidation, null);
  }
  const [earth, moon] = result.sites;
  assert.equal(earth.geometry, null);
  assert.equal(earth.pit, undefined);
  assert.deepEqual(moon.location, [14.0917, -56.7701]);
  assert.deepEqual(moon.geometry, { type: 'Point', coordinates: [-56.7701, 14.0917] });
  assert.equal(moon.locationRole, 'LROC published surface pit point');
  assert.equal(moon.pit.depthMeters, 40);
  assert.equal(moon.pit.depthMethod, 'stereo modeling');
  assert.equal(moon.pit.depthUncertaintyMeters, null);
  assert.deepEqual(moon.pit.funnelDiametersMeters, [79, 92]);
  assert.deepEqual(moon.pit.innerOpeningDiametersMeters, [49, 55]);
  assert.equal(moon.pit.azimuthDeg, 65);
  assert.equal(moon.planform.kind, 'derived-geometric-approximation');
  assert.ok(Math.abs(moon.planform.funnelAreaM2 - Math.PI * 79 * 92 / 4) < 1e-10);
  assert.ok(Math.abs(moon.planform.innerOpeningAreaM2 - Math.PI * 49 * 55 / 4) < 1e-10);
  assert.equal(moon.surfaceDtm.nativeResolutionMeters, 4);
  assert.match(moon.surfaceDtm.source, /NAC_DTM_MARIUSPIT01$/);
  assert.ok(moon.targetGridCenterOffsetMeters > 200 && moon.targetGridCenterOffsetMeters < 210);
  assert.match(moon.caveat, /not underground tube depth/);
});

test('other scenarios and mismatched grids do not inherit lava tube evidence', () => {
  const earth = read('../assets/data/scenarios/earth/la-corona.json');
  const moon = read('../assets/data/scenarios/targets/marius-hills.json');
  assert.equal(assessSubsurface('polar-shadow', earth, moon).status, 'unavailable');
  assert.equal(assessSubsurface('lava-tube', { ...earth, id: 'atacama' }, moon).sites.length, 0);
});

test('published pit point stays independent of the target DEM center', () => {
  const earth = read('../assets/data/scenarios/earth/la-corona.json');
  const moon = read('../assets/data/scenarios/targets/marius-hills.json');
  const site = assessSubsurface('lava-tube', earth, { ...moon, center: null }).sites[1];
  assert.deepEqual(site.location, [14.0917, -56.7701]);
  assert.equal(site.targetGridCenterOffsetMeters, null);
  assert.equal(site.coordinateReference.startsWith('IAU Moon 2000'), true);
});

test('La Corona sections and ERT depth context remain distinct from a mapped tube or route', () => {
  const cave = assessCaveSections(read('../assets/data/m4/la-corona-cave-sections.json'));
  const earth = read('../assets/data/scenarios/earth/la-corona.json');
  const moon = read('../assets/data/scenarios/targets/marius-hills.json');
  const site = assessSubsurface('lava-tube', earth, moon, cave).sites[0];
  assert.equal(site.interiorSurvey.sectionCount, 74);
  assert.equal(site.interiorSurvey.stationCoordinates, null);
  assert.equal(site.interiorSurvey.roofDepthBySectionM, null);
  assert.equal(site.geometry, null);
  assert.equal(site.tubeGeometry, null);
  assert.deepEqual(site.depthContext.ceilingDepthRangeMeters, [14, 29]);
  assert.equal(site.depthContext.kind, 'literature-ert-inference');
});
