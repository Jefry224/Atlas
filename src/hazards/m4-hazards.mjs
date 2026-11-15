import { analyzeTerrain } from './route-math.mjs';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function sampleElevation(grid, row, col) {
  const n = grid.gridSize;
  const r0 = Math.floor(row), c0 = Math.floor(col);
  const r1 = Math.min(n - 1, r0 + 1), c1 = Math.min(n - 1, c0 + 1);
  const a = grid.elevation[r0 * n + c0], b = grid.elevation[r0 * n + c1];
  const c = grid.elevation[r1 * n + c0], d = grid.elevation[r1 * n + c1];
  if (![a, b, c, d].every(Number.isFinite)) return null;
  const fr = row - r0, fc = col - c0;
  return a * (1 - fr) * (1 - fc) + b * (1 - fr) * fc +
    c * fr * (1 - fc) + d * fr * fc;
}

/** A DEM-window-only terrain shadow scenario, not observed illumination. */
export function modelTerrainShadow(grid, { elevationDeg, azimuthDeg } = {}) {
  const terrain = analyzeTerrain(grid);
  if (terrain.status !== 'ok' || !Number.isFinite(elevationDeg) ||
      !Number.isFinite(azimuthDeg) || elevationDeg < -90 || elevationDeg > 90) {
    return { status: 'invalid', cells: [], counts: null, kind: 'model',
      caveats: ['A valid DEM and modeled solar elevation/azimuth are required.'] };
  }
  const n = grid.gridSize, spacing = grid.spacingMeters;
  const east = Math.sin(azimuthDeg * RAD), north = Math.cos(azimuthDeg * RAD);
  const cells = Array(n * n).fill('unknown');
  const counts = { lit: 0, shadowed: 0, unknown: 0 };
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const i = row * n + col;
    if (!terrain.valid[i]) { counts.unknown++; continue; }
    if (elevationDeg <= 0) { cells[i] = 'shadowed'; counts.shadowed++; continue; }
    let maxHorizon = -90, incomplete = false;
    for (let step = 0.5; ; step += 0.5) {
      const r = row - north * step, c = col + east * step;
      if (r < 0 || r > n - 1 || c < 0 || c > n - 1) break;
      const z = sampleElevation(grid, r, c);
      if (z === null) { incomplete = true; break; }
      maxHorizon = Math.max(maxHorizon,
        Math.atan2(z - grid.elevation[i], step * spacing) * DEG);
    }
    cells[i] = incomplete ? 'unknown' : maxHorizon >= elevationDeg ? 'shadowed' : 'lit';
    counts[cells[i]]++;
  }
  return { status: 'ok', cells, counts, kind: 'model', sun: { elevationDeg, azimuthDeg },
    source: grid.dataset || grid.source || null,
    spacingMeters: spacing, nativeResolutionMeters: grid.nativeResolutionMeters ?? null,
    caveats: ['Terrain shadow is modeled for the supplied sun angle within this DEM window only.',
      'The DEM cannot resolve small rocks, crevices, cave interiors, or shadows cast outside the window.',
      'This layer is not observed illumination or a rover safety classification.'] };
}

/** Regional slope classes; no obstacle detector is implied. */
export function classifyTerrainSlope(grid, maxSlopeDeg = 15) {
  const terrain = analyzeTerrain(grid);
  if (terrain.status !== 'ok' || !Number.isFinite(maxSlopeDeg) ||
      maxSlopeDeg < 0 || maxSlopeDeg > 90) {
    return { status: 'invalid', cells: [], counts: null, kind: 'model' };
  }
  const cells = terrain.slopeDeg.map(value => value === null ? 'unknown' :
    value > maxSlopeDeg ? 'above-limit' : 'within-limit');
  const counts = { 'within-limit': 0, 'above-limit': 0, unknown: 0 };
  for (const cell of cells) counts[cell]++;
  return { status: 'ok', cells, counts, kind: 'model', maxSlopeDeg,
    source: grid.dataset || grid.source || null,
    spacingMeters: grid.spacingMeters,
    nativeResolutionMeters: grid.nativeResolutionMeters ?? null,
    caveats: ['Regional DEM slope relative to a scenario threshold, not vehicle clearance.',
      'Unknown border and nodata-adjacent cells are never classified as passable.'] };
}

/** Terrain variation over a 3×3 DEM neighborhood, not individual obstacles. */
export function analyzeRegionalIrregularity(grid) {
  const terrain = analyzeTerrain(grid);
  if (terrain.status !== 'ok') return { status: 'invalid', localReliefM: [], triM: [],
    counts: null, kind: 'derived-dem', caveats: [...terrain.caveats] };
  const n = grid.gridSize;
  const localReliefM = Array(n * n).fill(null);
  const triM = Array(n * n).fill(null);
  let measured = 0;
  for (let row = 1; row < n - 1; row++) for (let col = 1; col < n - 1; col++) {
    const center = row * n + col;
    const neighbors = [center - n - 1, center - n, center - n + 1,
      center - 1, center + 1, center + n - 1, center + n, center + n + 1];
    if (!terrain.valid[center] || !neighbors.every(index => terrain.valid[index])) continue;
    const z = grid.elevation[center];
    let min = z, max = z, totalDifference = 0;
    for (const index of neighbors) {
      const value = grid.elevation[index];
      min = Math.min(min, value); max = Math.max(max, value);
      totalDifference += Math.abs(z - value);
    }
    localReliefM[center] = max - min;
    triM[center] = totalDifference / 8;
    measured++;
  }
  return { status: 'ok', localReliefM, triM,
    counts: { measured, unknown: n * n - measured }, kind: 'derived-dem',
    method: '3×3 neighborhood: local relief = max − min; TRI = mean absolute center-to-neighbor elevation difference',
    source: grid.dataset || grid.source || null,
    spacingMeters: grid.spacingMeters,
    nativeResolutionMeters: grid.nativeResolutionMeters ?? null,
    caveats: ['Local relief and TRI describe terrain variation at the DEM grid scale, not individual rocks or cracks.',
      'Borders and neighborhoods touching missing elevation stay unknown.',
      'Neither metric is a validated vehicle clearance or cavity detector.'] };
}

/** A user-selected regional relief threshold; no passability claim is implied. */
export function classifyTerrainRelief(grid, maxLocalReliefM) {
  const irregularity = analyzeRegionalIrregularity(grid);
  if (irregularity.status !== 'ok' || !Number.isFinite(maxLocalReliefM) || maxLocalReliefM < 0) {
    return { status: 'invalid', cells: [], counts: null, kind: 'scenario-classification',
      caveats: ['A valid DEM and a nonnegative local relief scenario threshold are required.'] };
  }
  const cells = irregularity.localReliefM.map(value => value === null ? 'unknown' :
    value > maxLocalReliefM ? 'above-limit' : 'within-limit');
  const counts = { 'within-limit': 0, 'above-limit': 0, unknown: 0 };
  for (const cell of cells) counts[cell]++;
  return { status: 'ok', cells, counts, kind: 'scenario-classification', maxLocalReliefM,
    source: irregularity.source, spacingMeters: irregularity.spacingMeters,
    nativeResolutionMeters: irregularity.nativeResolutionMeters,
    method: irregularity.method,
    caveats: [...irregularity.caveats,
      'The threshold is a user-controlled scenario assumption, not a certified rover limit.'] };
}
