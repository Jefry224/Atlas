import { centerProfile, elevationRange, validGrid } from './mission-math.mjs';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** West–east center transects with elevation relative to each grid minimum (for overlay charts). */
export function relativeCenterProfiles(earthGrid, targetGrid) {
  if (!validGrid(earthGrid) || !validGrid(targetGrid)) return { earth: [], target: [], maxRelief: 0 };
  const er = elevationRange(earthGrid);
  const tr = elevationRange(targetGrid);
  if (!er || !tr) return { earth: [], target: [], maxRelief: 0 };
  const earth = centerProfile(earthGrid).map((p) => ({ x: p.x, rel: p.elevation - er.min }));
  const target = centerProfile(targetGrid).map((p) => ({ x: p.x, rel: p.elevation - tr.min }));
  const maxRelief = Math.max(1, ...earth.map((p) => p.rel), ...target.map((p) => p.rel));
  return { earth, target, maxRelief };
}

/** Lowest rank (best) candidate per `region.id`. */
export function bestCandidateByRegion(candidates) {
  const map = new Map();
  for (const candidate of candidates || []) {
    const id = candidate.region?.id;
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || candidate.rank < prev.rank) map.set(id, candidate);
  }
  return map;
}

/** Shared positive scale for paired value bars (Earth vs target). */
export function pairedBarMax(earth, target) {
  const values = [earth, target].filter(finite).map(Math.abs);
  return values.length ? Math.max(...values, 1e-9) : 1;
}

/** Kelvin axis for thermal range comparison; null min/max when data is missing. */
export function thermalBands(earthThermal, targetThermal) {
  const band = (t) => {
    if (!t || typeof t !== 'object') return null;
    const min = finite(t.minK) ? t.minK : null;
    const max = finite(t.maxK) ? t.maxK : null;
    if (min === null && max === null) return null;
    return { min, max };
  };
  const earth = band(earthThermal);
  const target = band(targetThermal);
  const lows = [earth?.min, target?.min].filter(finite);
  const highs = [earth?.max, target?.max].filter(finite);
  const minK = lows.length ? Math.min(...lows) : 0;
  const maxK = highs.length ? Math.max(...highs) : 1;
  const span = Math.max(maxK - minK, 1);
  return { minK, maxK, span, earth, target };
}

/** SVG path for a normalized polyline (points with x in [-1,1] metaphor via extent, y 0..1). */
export function profilePath(points, extentMeters, maxRelief, width, height, pad = 4) {
  if (!points.length || !finite(extentMeters) || extentMeters <= 0) return '';
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const half = extentMeters / 2;
  const coords = points.map((p) => {
    const px = pad + ((p.x + half) / extentMeters) * innerW;
    const py = pad + innerH - (p.rel / maxRelief) * innerH;
    return `${px.toFixed(2)},${py.toFixed(2)}`;
  });
  return `M${coords.join('L')}`;
}