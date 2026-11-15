const CAVE_SOURCE = 'https://cactlanzarote.com/en/cact/cueva-de-los-verdes/';
const MARIUS_ATLAS = 'https://lroc.im-ldi.com/atlases/pits/1';
const MARIUS_DTM = 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_MARIUSPIT01';
const CORONA_PAPER = 'https://doi.org/10.1029/2022JB024056';
const MARIUS_POINT = [14.0917, -56.7701]; // Latitude, signed east-positive longitude (303.2299° E).
const MOON_RADIUS_M = 1737400;
const ellipseArea = ([diameterA, diameterB]) => Math.PI * diameterA * diameterB / 4;

function lunarDistanceMeters(a, b) {
  if (!Array.isArray(a) || a.length !== 2 || !a.every(Number.isFinite)) return null;
  const rad = Math.PI / 180;
  const [lat1, lon1] = a.map(value => value * rad);
  const [lat2, lon2] = b.map(value => value * rad);
  const h = Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 2 * MOON_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Literature locations are context markers, never inferred geometry or traversable space.
export function assessSubsurface(scenarioId, earthGrid, targetGrid, caveSections = null) {
  const base = {
    kind: 'literature-context',
    geometry: null,
    geometryResolutionMeters: null,
    tubeGeometry: null,
    interiorSurvey: null,
    detector: null,
    detectorValidation: null,
  };
  if (scenarioId !== 'lava-tube' || earthGrid?.id !== 'la-corona' || targetGrid?.id !== 'marius-hills') {
    return { status: 'unavailable', sites: [], caveat: 'No site-specific cave geometry or subsurface evidence is attached to this scenario.' };
  }
  const earthSource = earthGrid.provenance?.find(item => item.url === CAVE_SOURCE);
  const earthLocationSource = earthGrid.provenance?.find(item => item.url?.startsWith('https://www.openstreetmap.org/'));
  const sites = [];
  if (earthSource) sites.push({ ...base, body: 'earth', label: 'La Corona lava tube / Cueva de los Verdes',
    location: earthGrid.anchor?.center || null, locationRole: earthGrid.anchor?.center ? 'OpenStreetMap cave reference point' : 'unknown',
    locationSource: earthLocationSource || null,
    interiorSurvey: caveSections?.status === 'ok' ? {
      kind: 'digitized-literature-cross-sections', sectionCount: caveSections.summary.count,
      source: caveSections.source, stationCoordinates: null, roofDepthBySectionM: null,
    } : null,
    depthContext: {
      kind: 'literature-ert-inference', ceilingDepthRangeMeters: [14, 29],
      appliesTo: 'Secondary channels sampled by ERT, not every part of the La Corona tube',
      source: CORONA_PAPER,
    },
    source: { label: earthSource.label, url: earthSource.url },
    caveat: caveSections?.status === 'ok'
      ? 'The 74 digitized interior sections have metric shape but no georeferenced stations, co-registered roof depths, or validated interior route. The Earth DEM shows only the lava-field surface.'
      : 'The DEM shows the lava field surface. No georeferenced tube outline, section-specific roof depth, or interior route is attached.' });
  sites.push({ ...base, body: 'moon', label: 'Marius Hills pit',
    kind: 'published-surface-pit',
    location: [...MARIUS_POINT], locationRole: 'LROC published surface pit point',
    coordinateReference: 'IAU Moon 2000; planetocentric latitude, signed east-positive longitude',
    locationSource: { label: 'LROC Pits Atlas · Marius Hills Pit', url: MARIUS_ATLAS },
    geometry: { type: 'Point', coordinates: [MARIUS_POINT[1], MARIUS_POINT[0]] },
    pit: {
      depthMeters: 40, depthMethod: 'stereo modeling',
      depthUncertaintyMeters: null,
      funnelDiametersMeters: [79, 92], innerOpeningDiametersMeters: [49, 55],
      azimuthDeg: 65, kind: 'published-measurement', source: MARIUS_ATLAS,
    },
    planform: {
      funnelAreaM2: ellipseArea([79, 92]),
      innerOpeningAreaM2: ellipseArea([49, 55]),
      kind: 'derived-geometric-approximation',
      assumption: 'The two published plan-view diameters of each rim are treated as perpendicular ellipse axes.',
      source: MARIUS_ATLAS,
    },
    surfaceDtm: { product: 'NAC_DTM_MARIUSPIT01', nativeResolutionMeters: 4,
      source: MARIUS_DTM, kind: 'published-surface-dtm' },
    targetGridCenterOffsetMeters: lunarDistanceMeters(targetGrid.center, MARIUS_POINT),
    source: { label: 'LROC Pits Atlas · Marius Hills Pit', url: MARIUS_ATLAS,
      credit: 'NASA/GSFC/Arizona State University' },
    caveat: 'The 40 m value is the published surface pit depth, not underground tube depth. The Kaguya grid does not resolve the pit; the LROC 4 m DTM is a separate product. An accessible lava tube or interior route is unconfirmed.' });
  return { status: sites.length ? 'context-only' : 'unavailable', sites,
    caveat: 'Documented surface context does not verify subterranean extent, roof stability, or navigability.' };
}
