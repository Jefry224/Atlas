const VALID_FRACTION_MIN = 0.9;

/** Accept a published spatial pair only for its exact Earth reference window. */
export function assessSpatialSar(grid, spatial) {
  if (spatial == null) return { status: 'not-provided', data: null };
  const center = grid?.center;
  const n = spatial.gridSize;
  const arrays = [spatial.latestDb, spatial.deltaDb];
  const candidateTarget = /^cand-(marius-hills|shackleton|jezero|valles-marineris)-\d{2}$/.exec(grid?.id || '')?.[1];
  const roleMatches = candidateTarget ? spatial.siteRole === 'discovery-candidate' && spatial.targetId === candidateTarget :
    spatial.siteRole == null || spatial.siteRole === 'fixed-reference';
  const sceneMatchesPair = scene => {
    const match = typeof scene?.item === 'string' ? /^S1([A-D])_.*_(\d{8})T\d{6}_.*_rtc$/.exec(scene.item) : null;
    return !!match && `sentinel-1${match[1].toLowerCase()}` === spatial.platform &&
      `${match[2].slice(0, 4)}-${match[2].slice(4, 6)}-${match[2].slice(6, 8)}` === scene.date &&
      scene.source.endsWith(`/${scene.item}`);
  };
  const sameCenter = Array.isArray(center) && center.length === 2 &&
    Array.isArray(spatial.center) && spatial.center.length === 2 &&
    center.every((value, i) => Number.isFinite(value) && Number.isFinite(spatial.center[i]) &&
      Math.abs(value - spatial.center[i]) <= 1e-4);
  const valid = spatial.schema === 'M4SpatialSarPair' && spatial.version === 1 &&
    spatial.siteId === grid?.id && grid?.body === 'earth' && roleMatches && sameCenter &&
    spatial.windowMeters === grid?.extentMeters && spatial.collection === 'sentinel-1-rtc' &&
    ['VV', 'HH'].includes(spatial.polarization) &&
    (!grid?.metrics?.roughness?.polarization || spatial.polarization === grid.metrics.roughness.polarization) &&
    Number.isInteger(n) && n >= 2 && n <= 1000 &&
    arrays.every(values => Array.isArray(values) && values.length === n * n &&
      values.every(value => value === null || Number.isFinite(value))) &&
    Array.isArray(spatial.bboxWgs84) && spatial.bboxWgs84.length === 4 &&
    spatial.bboxWgs84.every(Number.isFinite) &&
    spatial.bboxWgs84[0] < spatial.bboxWgs84[2] && spatial.bboxWgs84[1] < spatial.bboxWgs84[3] &&
    Number.isFinite(spatial.sampleSpacingMetersApprox) && spatial.sampleSpacingMetersApprox > 0 &&
    Number.isFinite(spatial.sourcePixelSpacingMeters) && spatial.sourcePixelSpacingMeters > 0 &&
    Number.isFinite(spatial.nominalRadarResolutionMeters?.range) && spatial.nominalRadarResolutionMeters.range > 0 &&
    Number.isFinite(spatial.nominalRadarResolutionMeters?.azimuth) && spatial.nominalRadarResolutionMeters.azimuth > 0 &&
    ['IW', 'EW', 'SM'].includes(spatial.instrumentMode) &&
    ['right', 'left'].includes(spatial.observationDirection) &&
    ['ascending', 'descending'].includes(spatial.orbitState) &&
    typeof spatial.platform === 'string' && /^sentinel-1[a-z]$/.test(spatial.platform) &&
    Number.isInteger(spatial.relativeOrbit) && spatial.relativeOrbit > 0 &&
    validDate(spatial.oldScene?.date) && validDate(spatial.newScene?.date) &&
    spatial.oldScene.date < spatial.newScene.date &&
    (Date.parse(`${spatial.newScene.date}T00:00:00Z`) - Date.parse(`${spatial.oldScene.date}T00:00:00Z`)) / 86400000 <= 24 &&
    [spatial.oldScene, spatial.newScene].every(scene =>
      typeof scene.item === 'string' && scene.item.endsWith('_rtc') &&
      typeof scene.source === 'string' && scene.source.startsWith('https://') &&
      Number.isFinite(scene.validFraction) && scene.validFraction >= VALID_FRACTION_MIN && scene.validFraction <= 1 &&
      sceneMatchesPair(scene)) &&
    Number.isFinite(spatial.comparableFraction) && spatial.comparableFraction >= VALID_FRACTION_MIN &&
    spatial.comparableFraction <= 1 &&
    typeof spatial.source === 'string' && spatial.source.startsWith('https://');
  return { status: valid ? 'spatial-surface-context' : 'invalid-spatial-pair', data: valid ? spatial : null };
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Read the existing published Sentinel-1 window means, never a spatial raster. */
export function assessRadarHistory(grid, history) {
  if (history == null) return { status: 'not-provided', data: null, caveat: 'No temporal SAR series is attached to this window.' };
  const center = grid?.center;
  if (history.site !== grid?.id || !Array.isArray(center) || !Array.isArray(history.center) ||
      center.length !== 2 || history.center.length !== 2 ||
      !center.every((v, i) => Number.isFinite(v) && Number.isFinite(history.center[i]) && Math.abs(v - history.center[i]) <= 1e-4) ||
      history.windowMeters !== grid?.extentMeters || history.polarization !== grid?.metrics?.roughness?.polarization) {
    return { status: 'mismatched-history', data: null, caveat: 'Temporal SAR history does not match this site, window, or polarization.' };
  }
  if (history.collection !== 'sentinel-1-rtc' || typeof history.source !== 'string' ||
      !history.source.startsWith('https://') || !Array.isArray(history.series)) {
    return { status: 'invalid-history', data: null, caveat: 'Temporal SAR history lacks required collection, source, or series metadata.' };
  }
  const points = history.series;
  const orbit = points[0]?.relativeOrbit, direction = points[0]?.orbitState;
  const valid = Number.isInteger(orbit) && orbit > 0 && ['ascending', 'descending'].includes(direction) &&
    points.every((p, i) => validDate(p.date) && (!i || p.date > points[i - 1].date) &&
      Number.isFinite(p.meanDb) && Number.isFinite(p.stdDb) && p.stdDb >= 0 &&
      Number.isFinite(p.validFraction) && p.validFraction >= VALID_FRACTION_MIN && p.validFraction <= 1 &&
      typeof p.platform === 'string' && /^sentinel-1[a-z]$/.test(p.platform) &&
      p.relativeOrbit === orbit && p.orbitState === direction &&
      typeof p.item === 'string' && p.item.endsWith('_rtc'));
  if (!valid) return { status: 'invalid-history', data: null, caveat: 'Temporal SAR series has missing, inconsistent, or low-coverage acquisitions.' };
  let comparableAdjacentPairs = 0, largestComparableMeanDeltaDb = null;
  for (let i = 1; i < points.length; i++) {
    if (points[i].platform !== points[i - 1].platform) continue;
    comparableAdjacentPairs++;
    const delta = Math.abs(points[i].meanDb - points[i - 1].meanDb);
    largestComparableMeanDeltaDb = Math.max(largestComparableMeanDeltaDb ?? 0, delta);
  }
  return {
    status: points.length >= 2 ? 'aggregate-series' : 'insufficient-acquisitions',
    data: {
      kind: 'published-window-aggregate-series', siteId: history.site,
      source: history.source, collection: history.collection,
      method: history.method || null, fetchedAt: history.fetchedAt || null,
      license: history.license || null, credit: history.credit || null,
      polarization: history.polarization, relativeOrbit: orbit ?? null,
      orbitState: direction ?? null, windowMeters: history.windowMeters,
      count: points.length, firstDate: points[0]?.date || null,
      lastDate: points.at(-1)?.date || null,
      comparableAdjacentPairs, largestComparableMeanDeltaDb,
      points: points.map(p => ({ date: p.date, meanDb: p.meanDb,
        stdDb: p.stdDb, validFraction: p.validFraction, platform: p.platform,
        relativeOrbit: p.relativeOrbit, orbitState: p.orbitState, item: p.item })),
    },
    caveat: 'These are window-mean backscatter values. Even same-platform repeat-pass differences are unvalidated surface indicators, not georeferenced anomalies, displacement, obstacle detections, or cave depths.',
  };
}

/** Summarize published aggregates and an independently georeferenced spatial pair. */
export function assessRadarEvidence(grid, history = null, spatial = null) {
  const roughness = grid?.metrics?.roughness;
  const value = roughness?.value;
  const unit = roughness?.unit;
  const source = roughness?.source;
  const hasObservation = Number.isFinite(value) && typeof unit === 'string' &&
    unit.length > 0 && typeof source === 'string' && source.length > 0;
  const scene = hasObservation ? {
    value, unit, source,
    method: roughness.method || null,
    acquiredAt: roughness.acquired || null,
    polarization: roughness.polarization || null,
    spreadDb: Number.isFinite(roughness.stdDb) ? roughness.stdDb : null,
    kind: 'published-window-summary',
  } : null;
  const temporal = assessRadarHistory(grid, history);
  const spatialAssessment = assessSpatialSar(grid, spatial);
  return {
    siteId: grid?.id || null,
    body: grid?.body || null,
    sceneCount: scene ? 1 : 0,
    scenes: scene ? [scene] : [],
    spatialLayer: spatialAssessment.data,
    spatialStatus: spatialAssessment.status,
    temporalChange: null,
    temporalHistory: temporal.data,
    temporalStatus: temporal.status === 'not-provided' ? 'insufficient-acquisitions' : temporal.status,
    detectorValidation: null,
    caveats: [...(spatialAssessment.data
      ? ['The paired spatial rasters show surface backscatter and an unvalidated repeat-pass difference, not a cave, obstacle, or safety detector.']
      : scene
      ? ['A single-scene window summary cannot establish temporal change or locate obstacles, cavities, or subsurface structure.',
        'A spatial radar layer requires the source raster, georeferencing, masks, and calibration metadata.']
      : ['No radar observation is published for this grid.']), temporal.caveat],
  };
}

/** Prevent comparison of unlike radar products and unsupported temporal claims. */
export function assessRadarPair(earthGrid, targetGrid, history = null, spatial = null) {
  const earth = assessRadarEvidence(earthGrid, history, spatial);
  const target = assessRadarEvidence(targetGrid);
  const sameMeasure = !!earth.scenes[0] && !!target.scenes[0] &&
    earth.scenes[0].unit === target.scenes[0].unit &&
    earth.scenes[0].polarization === target.scenes[0].polarization;
  return {
    earth, target,
    comparable: false,
    comparison: null,
    reason: !earth.scenes.length || !target.scenes.length
      ? 'One or both sites lack a radar observation.'
      : sameMeasure
        ? 'Matched units alone do not establish comparable sensor, wavelength, geometry, and processing.'
        : 'Radar measurements differ in units or polarization; dB backscatter and CPR are not interchangeable.',
  };
}

/** UI-facing summary for a fixed Earth/target scenario pair. */
export function assessSarEvidence({ earth, target, history, spatial } = {}) {
  return assessRadarPair(earth, target, history, spatial);
}
