import { centerProfile, elevationRange, validGrid } from './mission-math.mjs';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export const ANALOGY_STRONG_MIN = 75;
export const ANALOGY_WEAK_MAX = 40;

const shortMetricName = {
  slopeP50Deg: 'median slope',
  slopeP90Deg: 'slope (p90)',
  reliefP95P5M: 'relief',
  triMeanM: 'TRI',
  roughness: 'radar roughness',
  thermalAmplitudeK: 'daily thermal amplitude',
};

/** Classify comparison components into strong (≥75) and weak (<40) matches by score. */
export function analogySummary(components, { strongMin = ANALOGY_STRONG_MIN, weakMax = ANALOGY_WEAK_MAX } = {}) {
  const strong = [];
  const weak = [];
  for (const c of components || []) {
    if (!finite(c.score)) continue;
    const label = shortMetricName[c.key] || (c.label || c.key || '').toLowerCase();
    if (c.score >= strongMin) strong.push(label);
    else if (c.score < weakMax) weak.push(label);
  }
  return { strong, weak };
}

export function formatCoordinates(lat, lon) {
  if (!finite(lat) || !finite(lon)) return '—';
  const latH = lat >= 0 ? 'N' : 'S';
  const lonH = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latH}, ${Math.abs(lon).toFixed(2)}°${lonH}`;
}

/** FeatureCollection for the Top-5 with index and region metadata (no elevation grids). */
export function toGeoJSON(discovery, comparisons) {
  const features = (discovery?.candidates || []).map((candidate) => {
    const [lat, lon] = candidate.center || [];
    const comparison = comparisons?.get?.(candidate.id);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        id: candidate.id,
        rank: candidate.rank,
        targetId: discovery?.targetId,
        geometricIndex: comparison?.index ?? null,
        scaleMeters: candidate.scaleMeters,
        regionId: candidate.region?.id ?? null,
        regionName: candidate.region?.name ?? null,
        placeName: candidate.place?.name ?? null,
        dataset: candidate.dataset ?? null,
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

export function scoreBand(score) {
  if (!finite(score)) return 'mid';
  if (score >= ANALOGY_STRONG_MIN) return 'strong';
  if (score < ANALOGY_WEAK_MAX) return 'weak';
  return 'mid';
}

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