// Automatic evidence at the scale of the active DEM; no inferred individual boulders.
import { validGrid } from './mission-math.mjs';
import { assessSurface, MARIUS_REFERENCE } from './surface-assessment.mjs';

const finite = Number.isFinite;
const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

export function terrainEvidence(grid, siteId, body) {
  const identity = grid?.id || grid?.site;
  if (!validGrid(grid) || identity !== siteId || (grid.body && grid.body !== body) || typeof grid.source !== 'string' || !grid.source) return null;
  const n = grid.gridSize, spacing = grid.spacingMeters;
  const heights = [...grid.elevation].sort((a, b) => a - b);
  const slopes = [], differences = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const left = Math.max(0, c - 1), right = Math.min(n - 1, c + 1), top = Math.max(0, r - 1), bottom = Math.min(n - 1, r + 1);
    const dx = (grid.elevation[r * n + right] - grid.elevation[r * n + left]) / ((right - left) * spacing);
    const dz = (grid.elevation[bottom * n + c] - grid.elevation[top * n + c]) / ((bottom - top) * spacing);
    const slope = Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
    if (finite(slope)) slopes.push(slope);
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const a = grid.elevation[r * n + c], b = r + dr < n && c + dc < n ? grid.elevation[(r + dr) * n + c + dc] : null;
      if (finite(a) && finite(b)) differences.push(Math.abs(a - b));
    }
  }
  slopes.sort((a, b) => a - b);
  const m = grid.metrics, measured = (key, fallback) => finite(m?.[key]) ? m[key] : fallback;
  const native = finite(grid.nativeResolutionMeters) && grid.nativeResolutionMeters > 0 ? grid.nativeResolutionMeters : null;
  return {
    kind: 'dem-derived', source: grid.source || null, dataset: grid.dataset || null, fetchedAtUTC: grid.fetchedAt || null,
    nativeResolutionM: native, gridSpacingM: spacing, effectiveScaleM: native === null ? null : Math.max(native, spacing),
    extentM: (n - 1) * spacing, elevationMinM: heights[0] ?? null, elevationMaxM: heights.at(-1) ?? null,
    reliefP95P5M: measured('reliefP95P5M', quantile(heights, .95) - quantile(heights, .05)),
    slopeP50Deg: measured('slopeP50Deg', quantile(slopes, .5)), slopeP90Deg: measured('slopeP90Deg', quantile(slopes, .9)),
    triMeanM: finite(m?.triMeanM) ? m.triMeanM : null,
    meanNeighbourReliefM: differences.length ? differences.reduce((a, b) => a + b, 0) / differences.length : null,
    profile: grid.elevation.slice(Math.floor(n / 2) * n, (Math.floor(n / 2) + 1) * n).map((heightM, i) => ({ distanceM: i * spacing, heightM })),
    method: 'Published DEM metrics when supplied; otherwise sampled regional slopes and interpolated elevation quantiles. Neighbour relief is the mean absolute height difference between adjacent rows/columns. The profile is the central east–west row, without vertical exaggeration.',
    limitation: 'Regional relief and roughness are not rock dimensions, obstacle clearance or subsurface geometry. Interpolation and sharper display imagery do not improve DEM resolution.',
  };
}

export function automaticSurface(context, grid) {
  const terrain = terrainEvidence(grid, context.siteId, context.body);
  const published = context.body === 'moon' && context.siteId === MARIUS_REFERENCE.siteId;
  const cavity = published ? { lengthM: MARIUS_REFERENCE.lengthM, widthM: MARIUS_REFERENCE.widthM, depthM: MARIUS_REFERENCE.depthM, uncertaintyPct: null } : {};
  const report = assessSurface(context, {}, cavity, published ? MARIUS_REFERENCE.id : 'operator-hypothesis');
  const tube = context.body === 'earth' && context.siteId === 'la-corona' && terrain
    ? grid.provenance?.find(p => p.url?.startsWith('https://cactlanzarote.com/')) : null;
  report.rock.kind = 'unresolved-from-regional-dem';
  report.automatic = {
    mode: 'active-location-evidence', terrain,
    rockStatus: 'Individual rock dimensions, density and mass are not measured by the available regional DEM. Use regional relief and roughness to prioritize a stereo/lidar survey.',
    cavityStatus: published ? 'Published Marius inner-pit dimensions loaded automatically for this lunar location. Derived area and volume are geometric models.'
      : tube ? 'La Corona lava tube is documented by the site source. The surface DEM does not measure its interior, cross-section or roof.'
        : 'No measured cavity geometry is supplied for this location. The DEM cannot establish the presence or absence of underground voids.',
    cavityContextSource: published ? MARIUS_REFERENCE.source : tube?.url || null,
    cavityGeometryKind: published ? 'published-stereo-estimate' : tube ? 'documented-context-no-geometry' : 'unresolved',
  };
  return report;
}
