import { assessSpatialSar } from './m4-sar.mjs';
import { analyzeRegionalIrregularity } from './m4-hazards.mjs';

const EARTH_RADIUS_M = 6371008.8;

/** Approximate WGS84 node coordinates inside a 2.4 km Earth DEM window. */
export function routeCellCoordinates(grid, cell) {
  const center = grid?.center;
  const n = grid?.gridSize, spacing = grid?.spacingMeters;
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite) ||
      !Number.isInteger(n) || n < 2 || !Number.isFinite(spacing) || spacing <= 0 ||
      !Number.isInteger(cell?.row) || !Number.isInteger(cell?.col) ||
      cell.row < 0 || cell.row >= n || cell.col < 0 || cell.col >= n) return null;
  const northM = ((n - 1) / 2 - cell.row) * spacing;
  const eastM = (cell.col - (n - 1) / 2) * spacing;
  const cosLat = Math.cos(center[0] * Math.PI / 180);
  if (Math.abs(cosLat) < 1e-6) return null;
  const lat = center[0] + northM / EARTH_RADIUS_M * 180 / Math.PI;
  const lon = center[1] + eastM / (EARTH_RADIUS_M * cosLat) * 180 / Math.PI;
  return [lon, lat];
}

/** Export only computed corridors, with settings and scientific limits attached. */
export function routeEvidenceGeoJSON({ grid, targetId, routes, maxSlopeDeg, reliefLimitM = null,
  spatialSar = null, inputDataVersion = null, generatedAt = null } = {}) {
  if (grid?.body !== 'earth' || typeof grid.id !== 'string' || !routeCellCoordinates(grid, { row: 0, col: 0 }) ||
      typeof targetId !== 'string' || !Array.isArray(routes) ||
      !Number.isFinite(maxSlopeDeg) || maxSlopeDeg < 0 || maxSlopeDeg > 89 ||
      !(reliefLimitM === null || Number.isFinite(reliefLimitM) && reliefLimitM >= 0) ||
      !(generatedAt === null || typeof generatedAt === 'string' && Number.isFinite(Date.parse(generatedAt)))) return null;
  const sourceUrls = (Array.isArray(grid.provenance) ? grid.provenance : []).map(item => item.url).filter(url => typeof url === 'string' && url.startsWith('https://'));
  if (typeof grid.source === 'string' && grid.source.startsWith('https://')) sourceUrls.push(grid.source);
  const radar = assessSpatialSar(grid, spatialSar).data;
  const irregularity = analyzeRegionalIrregularity(grid);
  const features = [];
  for (const entry of routes) {
    const result = entry?.result;
    if (result?.status !== 'ok' || !Array.isArray(result.path) || result.path.length < 2) continue;
    const coordinates = result.path.map(cell => routeCellCoordinates(grid, cell));
    if (coordinates.some(value => value === null)) continue;
    const indices = result.path.map(cell => cell.row * grid.gridSize + cell.col);
    const reliefs = indices.map(index => irregularity.localReliefM[index]).filter(Number.isFinite);
    const tris = indices.map(index => irregularity.triM[index]).filter(Number.isFinite);
    features.push({
      type: 'Feature', id: `${grid.id}-route-${features.length + 1}`,
      geometry: { type: 'LineString', coordinates: coordinates.map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]) },
      properties: {
        kind: 'modeled-regional-corridor', targetId, earthSiteId: grid.id,
        alternative: entry.slopeWeight === 1 ? 'distance-emphasis' : 'slope-emphasis',
        distanceM: result.distanceM, ascentM: result.ascentM, descentM: result.descentM,
        maxSlopeDeg: result.maxSlopeDeg, meanSlopeDeg: result.meanSlopeDeg,
        maxLocalReliefM: reliefs.length ? Math.max(...reliefs) : null,
        meanTriM: tris.length ? tris.reduce((sum, value) => sum + value, 0) / tris.length : null,
        unknownTerrainCellsInWindow: irregularity.counts?.unknown ?? null,
        gridPath: result.path.map(cell => [cell.row, cell.col]),
        settings: { maxSlopeDeg, slopeWeight: entry.slopeWeight, maxLocalReliefM: reliefLimitM },
        dem: { dataset: grid.dataset || null, nativeResolutionMeters: grid.nativeResolutionMeters ?? null,
          spacingMeters: grid.spacingMeters, center: grid.center, inputDataVersion, sourceUrls },
        radarContext: radar ? { kind: 'surface-context-only', oldItem: radar.oldScene.item,
          newItem: radar.newScene.item, sourceUrls: [radar.oldScene.source, radar.newScene.source] } : null,
        caveats: [...(result.caveats || []),
          'Coordinates are an approximate local spherical conversion from DEM nodes, not surveyed waypoints.',
          'The SAR pair is context only and does not influence route cost or validate a hazard.'],
      },
    });
  }
  if (!features.length) return null;
  return { type: 'FeatureCollection', schema: 'M4RouteEvidenceGeoJSON', version: 1,
    generatedAt, targetId, earthSiteId: grid.id, features };
}
