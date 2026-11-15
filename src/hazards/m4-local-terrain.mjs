import { analyzeTerrain } from './route-math.mjs';
import { analyzeRegionalIrregularity } from './m4-hazards.mjs';

/** Flag a cell's departure from four opposite-neighbor averages at DEM scale. */
export function localTerrainBreaks(grid) {
  const n = grid?.gridSize;
  if (!Number.isInteger(n) || n < 3 || !Array.isArray(grid.elevation) ||
      grid.elevation.length !== n * n) return [];
  const values = Array(n * n).fill(null);
  for (let row = 1; row < n - 1; row++) for (let col = 1; col < n - 1; col++) {
    const i = row * n + col;
    const pairs = [[i - 1, i + 1], [i - n, i + n],
      [i - n - 1, i + n + 1], [i - n + 1, i + n - 1]];
    if (!Number.isFinite(grid.elevation[i]) ||
        !pairs.every(pair => pair.every(index => Number.isFinite(grid.elevation[index])))) continue;
    values[i] = Math.max(...pairs.map(([a, b]) =>
      Math.abs(grid.elevation[i] - (grid.elevation[a] + grid.elevation[b]) / 2)));
  }
  return values;
}

/** Interpret one published local USGS DEM without implying a rover-safe route. */
export function assessLocalTerrain(data, candidate) {
  const n = data?.gridSize;
  if (data?.schema !== 'M4LocalDemCrop' || data.version !== 1 ||
      data.kind !== 'published-bare-earth-dem-crop' ||
      data.siteId !== candidate?.id || data.targetId !== 'valles-marineris' ||
      !Array.isArray(candidate?.center) || candidate.center.length !== 2 ||
      !Array.isArray(data.candidateCenter) || data.candidateCenter.length !== 2 ||
      candidate.center.some((value, index) => Math.abs(value - data.candidateCenter[index]) > 0.000001) ||
      n !== 401 || data.spacingMeters !== 1 || data.nativeResolutionMeters !== 1 ||
      data.extentMeters !== 400 || data.elevationUnit !== 'centimetres' ||
      data.verticalAccuracyMeters !== null ||
      !Array.isArray(data.elevationCm) || data.elevationCm.length !== n * n ||
      !data.elevationCm.every(value => value === null || Number.isInteger(value)) ||
      data.nodataCount !== data.elevationCm.filter(value => value === null).length ||
      typeof data.source !== 'string' || !data.source.startsWith('https://prd-tnm.s3.amazonaws.com/') ||
      typeof data.sourceRecord !== 'string' || !data.sourceRecord.startsWith('https://www.sciencebase.gov/') ||
      data.license !== 'USGS public domain') {
    return { status: 'invalid', grid: null, slopeDeg: [], localReliefM: [], breakM: [] };
  }
  const grid = { gridSize: n, spacingMeters: 1,
    nativeResolutionMeters: 1, elevation: data.elevationCm.map(value => value === null ? null : value / 100),
    source: data.source };
  const terrain = analyzeTerrain(grid);
  const irregularity = analyzeRegionalIrregularity(grid);
  if (terrain.status !== 'ok' || irregularity.status !== 'ok') {
    return { status: 'invalid', grid: null, slopeDeg: [], localReliefM: [], breakM: [] };
  }
  const breakM = localTerrainBreaks(grid);
  return { status: 'ok', grid, slopeDeg: terrain.slopeDeg,
    localReliefM: irregularity.localReliefM, breakM,
    validCells: grid.elevation.length - data.nodataCount,
    source: data.source, sourceRecord: data.sourceRecord, license: data.license,
    credit: data.credit, caveats: data.caveats, projection: data.projection };
}

export function countLocalBreaks(assessment, thresholdM) {
  if (assessment?.status !== 'ok' || !Number.isFinite(thresholdM) || thresholdM < 0) {
    return { status: 'invalid', above: 0, measured: 0, unknown: 0 };
  }
  const measured = assessment.breakM.filter(Number.isFinite);
  return { status: 'ok', thresholdM, above: measured.filter(value => value > thresholdM).length,
    measured: measured.length, unknown: assessment.breakM.length - measured.length,
    kind: 'exploratory-dem-terrain-break-screen' };
}
