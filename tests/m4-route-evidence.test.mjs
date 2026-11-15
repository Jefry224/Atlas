import test from 'node:test';
import assert from 'node:assert/strict';
import { planRoute } from '../src/hazards/route-math.mjs';
import { routeCellCoordinates, routeEvidenceGeoJSON } from '../src/hazards/m4-route-evidence.mjs';

const grid = {
  id: 'cand-marius-hills-01', body: 'earth', center: [38.35, -114.43],
  gridSize: 5, spacingMeters: 37.5, nativeResolutionMeters: 30,
  dataset: 'Published DEM', elevation: Array(25).fill(100),
  provenance: [{ label: 'DEM source', url: 'https://example.org/dem' }],
};

test('route nodes export in GeoJSON longitude-latitude order with exact grid cells retained', () => {
  assert.deepEqual(routeCellCoordinates(grid, { row: 2, col: 2 }), [-114.43, 38.35]);
  const routes = [1, 5].map(slopeWeight => ({ slopeWeight,
    result: planRoute(grid, { row: 1, col: 1 }, { row: 3, col: 3 }, { slopeWeight }) }));
  const output = routeEvidenceGeoJSON({ grid, targetId: 'marius-hills', routes,
    maxSlopeDeg: 15, reliefLimitM: 10, inputDataVersion: 2,
    generatedAt: '2026-11-15T16:00:00Z' });
  assert.equal(output.schema, 'M4RouteEvidenceGeoJSON');
  assert.equal(output.features.length, 2);
  assert.equal(output.features[0].geometry.type, 'LineString');
  assert.deepEqual(output.features[0].properties.gridPath, [[1, 1], [2, 2], [3, 3]]);
  assert.deepEqual(output.features[0].geometry.coordinates[1], [-114.43, 38.35]);
  assert.equal(output.features[0].properties.settings.maxLocalReliefM, 10);
  assert.equal(output.features[0].properties.maxLocalReliefM, 0);
  assert.equal(output.features[0].properties.meanTriM, 0);
  assert.equal(output.features[0].properties.unknownTerrainCellsInWindow, 16);
  assert.equal(output.features[0].properties.dem.inputDataVersion, 2);
  assert.deepEqual(output.features[0].properties.dem.sourceUrls, ['https://example.org/dem']);
  assert.equal(output.features[0].properties.radarContext, null);
});

test('invalid or absent routes cannot be exported as a georeferenced corridor', () => {
  assert.equal(routeCellCoordinates(grid, { row: -1, col: 0 }), null);
  assert.equal(routeEvidenceGeoJSON({ grid, targetId: 'marius-hills', routes: [], maxSlopeDeg: 15 }), null);
  assert.equal(routeEvidenceGeoJSON({ grid: { ...grid, center: null }, targetId: 'marius-hills', routes: [], maxSlopeDeg: 15 }), null);
});
