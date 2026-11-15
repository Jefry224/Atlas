import { analyzeTerrain, planRoute } from './route-math.mjs';
import { analyzeRegionalIrregularity, classifyTerrainRelief, classifyTerrainSlope, modelTerrainShadow } from './m4-hazards.mjs';
import { assessSarEvidence } from './m4-sar.mjs';
import { assessSubsurface } from './m4-subsurface.mjs';
import { assessCaveSections } from './m4-cave-geometry.mjs';
import { assessLocalTerrain, countLocalBreaks } from './m4-local-terrain.mjs';
import { routeCellCoordinates, routeEvidenceGeoJSON } from './m4-route-evidence.mjs';
import { sunPosition } from '../processes/solar.mjs';

const TARGETS = ['marius-hills', 'shackleton', 'jezero', 'valles-marineris'];
const REFERENCES = { 'marius-hills': 'la-corona', shackleton: 'wright-valley', jezero: 'atacama', 'valles-marineris': 'wadi-rum' };
const REFERENCE_NAMES = { 'la-corona': 'La Corona lava field · Lanzarote', 'wright-valley': 'Wright Valley · McMurdo Dry Valleys', atacama: 'Atacama Desert · Yungay', 'wadi-rum': 'Wadi Rum · Jordan' };
const $ = id => document.getElementById(id);
const state = { data: null, candidate: null, reference: null, radarHistory: null, spatialSar: null, validSpatialSar: null, caveSections: null, validCaveSections: null, localTerrain: null, validLocalTerrain: null, pitDtm: null, pitAnalysis: null, pitIrregularity: null, analysis: null, irregularity: null, start: null, end: null, cursor: null, routes: [], routeSettings: null, loadId: 0 };
const canvas = $('terrain-canvas');
const ctx = canvas.getContext('2d');
const hash = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);
const initialTarget = hash.get('target') || query.get('target');
const initialCandidate = hash.get('candidate') || query.get('candidate');

function setText(id, value) { $(id).textContent = value ?? ''; }
function safeTarget(value) { return TARGETS.includes(value) ? value : TARGETS[0]; }
function grid() { return state.candidate; }
function routeUrl() { return `#target=${encodeURIComponent($('target-select').value)}&candidate=${encodeURIComponent($('candidate-select').value)}`; }
function updateLinks() { history.replaceState(null, '', routeUrl()); $('discovery-back').href = `discovery.html#target=${encodeURIComponent($('target-select').value)}&c=${encodeURIComponent(state.candidate?.rank || 1)}`; }
function option(select, value, label) { const el = document.createElement('option'); el.value = value; el.textContent = label; select.append(el); }
for (const id of TARGETS) option($('target-select'), id, id.replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase()));
$('target-select').value = safeTarget(initialTarget);

async function loadTarget(targetId, requestedCandidate) {
  const id = ++state.loadId;
  setText('load-status', 'Loading candidate DEM…');
  state.data = null; resetSelection();
  $('candidate-select').replaceChildren(); $('candidate-select').disabled = true;
  try {
    const response = await fetch(`assets/data/discovery/${safeTarget(targetId)}.json`);
    if (!response.ok) throw new Error(`Dataset request failed (${response.status}).`);
    const data = await response.json();
    if (id !== state.loadId) return;
    if (data.targetId !== targetId || !Array.isArray(data.candidates)) throw new Error('Unexpected discovery dataset.');
    state.data = data;
    const select = $('candidate-select'); select.replaceChildren();
    for (const candidate of data.candidates) option(select, candidate.id, `${candidate.rank ? `#${candidate.rank} · ` : ''}${candidate.place?.name || candidate.name || candidate.id}`);
    option(select, `reference:${REFERENCES[targetId]}`, `Reference site · ${REFERENCES[targetId].replaceAll('-', ' ')}`);
    select.value = data.candidates.some(c => c.id === requestedCandidate) || requestedCandidate === `reference:${REFERENCES[targetId]}` ? requestedCandidate : data.candidates[0]?.id || `reference:${REFERENCES[targetId]}`;
    select.disabled = false;
    await selectCandidate();
  } catch (error) { if (id === state.loadId) setText('load-status', `Could not load candidate data: ${error.message}`); }
}

function resetSelection() {
  state.candidate = state.reference = state.radarHistory = state.spatialSar = state.validSpatialSar = state.caveSections = state.validCaveSections = state.localTerrain = state.validLocalTerrain = state.pitDtm = state.pitAnalysis = state.pitIrregularity = state.analysis = state.irregularity = state.start = state.end = state.cursor = null;
  state.routes = []; state.routeSettings = null;
  for (const field of ['candidate-context', 'dem-source', 'radar-context', 'target-radar-context']) setText(field, '');
  $('provenance-list').replaceChildren(); $('subsurface-list').replaceChildren(); $('sar-history').replaceChildren();
  $('sar-spatial').hidden = true;
  $('cave-context').hidden = true;
  $('local-terrain').hidden = true;
  $('pit-context').hidden = true;
  $('shadow-overlay').checked = false;
  setText('sun-note', 'Sun angles can be entered manually or derived from a UTC Earth scenario.');
  renderResults(); updateReadout(); draw();
  setText('hazard-context', 'Select a DEM window to inspect modeled terrain hazards.');
}

async function selectCandidate() {
  const selected = $('candidate-select').value;
  const targetId = $('target-select').value;
  const id = ++state.loadId;
  resetSelection();
  state.candidate = state.data?.candidates.find(c => c.id === selected) || null;
  if (selected === `reference:${REFERENCES[targetId]}`) {
    setText('load-status', 'Loading reference scenario…');
    try {
      const [earthResponse, targetResponse, historyResponse, spatialResponse, pitResponse, caveResponse] = await Promise.all([
        fetch(`assets/data/scenarios/earth/${REFERENCES[targetId]}.json`),
        fetch(`assets/data/scenarios/targets/${targetId}.json`),
        fetch(`assets/data/processes/${REFERENCES[targetId]}.json`).catch(() => null),
        fetch(`assets/data/m4/${REFERENCES[targetId]}-sar.json`).catch(() => null),
        targetId === 'marius-hills' ? fetch('assets/data/m4/marius-pit-dtm.json').catch(() => null) : null,
        targetId === 'marius-hills' ? fetch('assets/data/m4/la-corona-cave-sections.json').catch(() => null) : null
      ]);
      if (!earthResponse.ok || !targetResponse.ok) throw new Error('Reference scenario request failed.');
      const [earth, target, radarHistory, spatialSar, pitDtm, caveSections] = await Promise.all([earthResponse.json(), targetResponse.json(), historyResponse?.ok ? historyResponse.json().catch(() => null) : null, spatialResponse?.ok ? spatialResponse.json().catch(() => null) : null, pitResponse?.ok ? pitResponse.json().catch(() => null) : null, caveResponse?.ok ? caveResponse.json().catch(() => null) : null]);
      if (id !== state.loadId) return;
      if (earth.id !== REFERENCES[targetId] || target.id !== targetId) throw new Error('Unexpected reference scenario.');
      state.reference = { earth, target };
      state.candidate = earth;
      state.radarHistory = radarHistory;
      state.spatialSar = spatialSar;
      state.caveSections = caveSections;
      state.pitDtm = validPitDtm(pitDtm) ? pitDtm : null;
      state.pitAnalysis = state.pitDtm ? analyzeTerrain(state.pitDtm) : null;
      state.pitIrregularity = state.pitDtm ? analyzeRegionalIrregularity(state.pitDtm) : null;
    } catch (error) { if (id === state.loadId) setText('load-status', `Could not load reference scenario: ${error.message}`); return; }
  } else if (state.candidate) {
    const [spatialResponse, localResponse] = await Promise.all([
      fetch(`assets/data/m4/${encodeURIComponent(selected)}-sar.json`).catch(() => null),
      selected === 'cand-valles-marineris-05' ? fetch('assets/data/m4/cand-valles-marineris-05-local-dem.json').catch(() => null) : null,
    ]);
    if (id !== state.loadId) return;
    state.spatialSar = spatialResponse?.ok ? await spatialResponse.json().catch(() => null) : null;
    state.localTerrain = localResponse?.ok ? await localResponse.json().catch(() => null) : null;
    if (id !== state.loadId) return;
  }
  state.start = state.end = state.cursor = null; state.routes = []; state.routeSettings = null;
  const c = state.candidate;
  state.analysis = c ? analyzeTerrain(grid()) : null;
  state.irregularity = c ? analyzeRegionalIrregularity(grid()) : null;
  const n = c?.gridSize;
  for (const field of ['start-row','start-col','end-row','end-col']) { $(field).max = n ? String(n - 1) : ''; $(field).value = ''; }
  if (c) {
    setText('candidate-context', `${state.reference ? REFERENCE_NAMES[c.id] || c.id : c.place?.name || c.name || c.id}${c.place?.admin ? ` · ${c.place.admin}` : ''}${c.place?.country ? `, ${c.place.country}` : ''} · ${n} × ${n} cells · ${c.spacingMeters} m spacing${state.reference ? ' · documented reference scenario' : ' · discovery candidate'}`);
    setText('load-status', state.analysis?.status === 'ok' ? 'DEM ready. Select two cells to model a route.' : 'DEM unavailable or invalid for route analysis.');
    setText('dem-source', `Elevation source: ${c.dataset || 'unknown'} · Native resolution: ${Number.isFinite(c.nativeResolutionMeters) ? `${c.nativeResolutionMeters} m` : 'unknown'}; display grid spacing: ${c.spacingMeters} m. The window is sampled from a DEM; resolution and coverage cannot establish rover-scale hazards. Kind: published DEM / modeled route analysis.${state.reference ? ' The reference window center is a reproducible terrain match, not a surveyed field route.' : ' This discovery candidate is not a published field-test site.'}`);
    const list = $('provenance-list'); list.replaceChildren();
    for (const source of c.provenance || []) {
      const li = document.createElement('li'); li.textContent = state.reference ? `Source record · ${typeof source.url === 'string' && source.url.startsWith('https://') ? new URL(source.url).hostname : 'published reference'}` : source.label || 'Unlabeled source';
      if (typeof source.url === 'string' && /^https:\/\//.test(source.url)) { const link = document.createElement('a'); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = ' Source record'; li.append(' · ', link); }
      list.append(li);
    }
    renderEvidence();
  } else { setText('candidate-context', 'No candidate is available.'); setText('load-status', 'No DEM to analyze.'); }
  updateLinks(); renderResults(); updateReadout(); draw();
}

function renderEvidence() {
  const c = state.candidate, reference = state.reference;
  renderLocalTerrain(assessLocalTerrain(state.localTerrain, c));
  const sar = assessSarEvidence({ earth: c, target: reference?.target, history: state.radarHistory, spatial: state.spatialSar });
  const scene = sar.earth.scenes[0];
  setText('radar-context', scene ? `Earth SAR: ${scene.value} ${scene.unit} ${scene.polarization || ''} · acquired ${scene.acquiredAt || 'unknown'} · spread ${Number.isFinite(scene.spreadDb) ? `${scene.spreadDb} dB` : 'unknown'}. This is a window aggregate; spatial evidence appears below when a matching repeat-pass pair is available. No SAR hazard or cavity detector is validated.` : sar.earth.spatialLayer ? 'Earth SAR: a candidate-specific Sentinel-1 RTC surface pair is available below. No reference-site radar summary is transferred to this candidate; hazard and cavity detection are unvalidated.' : 'Earth SAR: no matched spatial pair is published for this window. Radar hazard and cavity detection are unavailable.');
  if (scene) appendSourceLink($('radar-context'), scene.source);
  const targetScene = sar.target.scenes[0];
  setText('target-radar-context', targetScene ? `Planetary radar: ${targetScene.value} ${targetScene.unit}. Earth and planetary radar values are not directly comparable.` : 'Planetary radar: no measurement attached to this selection.');
  if (targetScene) appendSourceLink($('target-radar-context'), targetScene.source);
  renderRadarHistory(sar.earth);
  renderSpatialSar(sar.earth.spatialLayer);
  const scenarioId = reference && Object.entries(REFERENCES).find(([targetId, earthId]) => targetId === reference.target.id && earthId === reference.earth.id)?.[0] === 'marius-hills' ? 'lava-tube' : null;
  const caveSections = assessCaveSections(state.caveSections);
  const subsurface = assessSubsurface(scenarioId, reference?.earth, reference?.target, caveSections);
  const list = $('subsurface-list'); list.replaceChildren();
  if (!subsurface.sites?.length) { const li = document.createElement('li'); li.textContent = 'No site-specific cave geometry or subsurface survey is attached to this window.'; list.append(li); }
  for (const site of subsurface.sites || []) {
    const li = document.createElement('li');
    const pit = site.pit;
    const offset = Number.isFinite(site.targetGridCenterOffsetMeters) ? ` Its mapped point is about ${Math.round(site.targetGridCenterOffsetMeters)} m from the center of the regional target DEM.` : '';
    const planform = site.planform;
    const areas = planform ? ` Approximate ellipse plan-view areas: funnel ${Math.round(planform.funnelAreaM2).toLocaleString('en-US')} m², inner opening ${Math.round(planform.innerOpeningAreaM2).toLocaleString('en-US')} m² (geometric assumption, not measured area).` : '';
    const measurements = pit ? ` Published surface pit: ${pit.depthMeters} m deep by stereo modeling (uncertainty not reported in this record); funnel ${pit.funnelDiametersMeters.join(' × ')} m; inner opening ${pit.innerOpeningDiametersMeters.join(' × ')} m; azimuth ${pit.azimuthDeg}°.${offset}${areas}` : '';
    const depth = site.depthContext ? ` Published ERT interpretation describes separate channels with ceiling depths ${site.depthContext.ceilingDepthRangeMeters.join('–')} m; this is not a section-specific roof depth or route measurement.` : '';
    li.textContent = `${site.label} (${site.body}; ${site.locationRole}).${measurements}${depth} ${site.caveat} `;
    const link = document.createElement('a'); link.href = site.source.url; link.textContent = 'Source'; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.append(link); list.append(li);
    if (site.surfaceDtm) appendSourceLink(li, site.surfaceDtm.source, '4 m LROC surface DTM');
    if (site.depthContext) appendSourceLink(li, site.depthContext.source, 'ERT study context');
  }
  renderCaveSections(caveSections);
  renderPitDtm();
}

function renderLocalTerrain(result) {
  state.validLocalTerrain = result.status === 'ok' ? result : null;
  const panel = $('local-terrain'); panel.hidden = !state.validLocalTerrain;
  if (!state.validLocalTerrain) return;
  const { grid } = result;
  setText('local-terrain-summary', `USGS 3DEP original-resolution bare-earth DEM: ${grid.gridSize} × ${grid.gridSize} cells at 1 m, covering a 400 m square around this Discovery candidate. ${grid.gridSize ** 2 - result.validCells} cells are unknown. The dashed square on the regional map shows this local patch; it is only part of the 2,400 m candidate window.`);
  const sources = $('local-terrain-sources'); sources.replaceChildren();
  sources.append(`${result.credit} · ${result.license}. `);
  appendSourceLink(sources, result.sourceRecord, 'USGS source record');
  appendSourceLink(sources, result.source, 'Original DEM GeoTIFF');
  const download = document.createElement('a'); download.href = 'assets/data/m4/cand-valles-marineris-05-local-dem.json';
  download.download = 'cand-valles-marineris-05-local-dem.json'; download.textContent = 'Download local DEM JSON';
  sources.append(' · ', download);
  drawLocalTerrain();
}

function drawLocalTerrain() {
  const data = state.validLocalTerrain;
  if (!data) return;
  const canvas = $('local-terrain-canvas'), context = canvas.getContext('2d');
  const n = data.grid.gridSize, layer = $('local-terrain-layer').value;
  const values = layer === 'slope' ? data.slopeDeg : layer === 'relief' ? data.localReliefM :
    layer === 'break' ? data.breakM : data.grid.elevation;
  const threshold = $('local-break-threshold').value.trim() === '' ? NaN : Number($('local-break-threshold').value);
  const screen = countLocalBreaks(data, threshold);
  let min = Infinity, max = -Infinity;
  if (layer === 'elevation') for (const value of values) if (Number.isFinite(value)) {
    min = Math.min(min, value); max = Math.max(max, value);
  }
  const image = context.createImageData(n, n), pixels = image.data;
  for (let i = 0; i < n * n; i++) {
    const value = values[i], start = i * 4;
    if (!Number.isFinite(value)) {
      pixels[start] = 5; pixels[start + 1] = 11; pixels[start + 2] = 25;
    } else if (layer === 'break' && screen.status === 'ok' && value > threshold) {
      pixels[start] = 245; pixels[start + 1] = 89; pixels[start + 2] = 61;
    } else {
      const range = layer === 'elevation' ? Math.max(1, max - min) : layer === 'slope' ? 45 : layer === 'relief' ? 3 : 1;
      const t = Math.max(0, Math.min(1, (value - (layer === 'elevation' ? min : 0)) / range));
      pixels[start] = Math.round(24 + 198 * t);
      pixels[start + 1] = Math.round(92 + 64 * (1 - t));
      pixels[start + 2] = Math.round(160 - 121 * t);
    }
    pixels[start + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  context.strokeStyle = '#f5dd78'; context.lineWidth = 2;
  context.beginPath(); context.arc((n - 1) / 2 + .5, (n - 1) / 2 + .5, 4, 0, Math.PI * 2); context.stroke();
  const scale = layer === 'elevation' ? `Elevation color is relative to this crop (${format(min, 'm')}–${format(max, 'm')}).` :
    layer === 'slope' ? 'Slope color saturates at 45°.' : layer === 'relief' ? '3 × 3 m relief color saturates at 3 m.' :
    'Blue is a smaller local residual; red exceeds the user-set screen.';
  const count = screen.status === 'ok' ? `${screen.above.toLocaleString('en-US')} of ${screen.measured.toLocaleString('en-US')} measured cells exceed ${format(threshold, 'm')} in the terrain-break screen.` : 'Enter a nonnegative terrain-break threshold.';
  setText('local-terrain-caption', `${scale} ${count} The residual is the largest difference between a cell and four opposing-neighbor averages; it removes planar grade but can also highlight cliffs, DEM noise, or interpolation. This is a surface-screening hypothesis, not identified rocks, wheel clearance, or a validated obstacle detector. The 1 m bare-earth DEM may omit smaller objects and vegetation.`);
}
$('local-terrain-layer').addEventListener('change', drawLocalTerrain);
$('local-break-threshold').addEventListener('input', drawLocalTerrain);
$('local-terrain-canvas').addEventListener('pointermove', event => {
  const data = state.validLocalTerrain;
  if (!data) return;
  const rect = event.currentTarget.getBoundingClientRect(), n = data.grid.gridSize;
  const row = Math.min(n - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * n)));
  const col = Math.min(n - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * n)));
  const index = row * n + col;
  setText('local-terrain-readout', `Cell ${row}, ${col} · about ${col - 200} m east / ${200 - row} m north of patch center · elevation ${format(data.grid.elevation[index], 'm', 2)} · slope ${format(data.slopeDeg[index], '°')} · 3 × 3 m relief ${format(data.localReliefM[index], 'm')} · terrain-break residual ${format(data.breakM[index], 'm', 2)}.`);
});

function renderCaveSections(result) {
  state.validCaveSections = result.status === 'ok' ? result : null;
  const panel = $('cave-context'); panel.hidden = !state.validCaveSections;
  if (!state.validCaveSections) return;
  const { summary } = result;
  setText('cave-summary', `${summary.count} digitized metric cross-sections from the La Corona lava-tube system. Width ${format(summary.widthM.min, 'm')}–${format(summary.widthM.max, 'm')} (median ${format(summary.widthM.median, 'm')}); height ${format(summary.heightM.min, 'm')}–${format(summary.heightM.max, 'm')} (median ${format(summary.heightM.median, 'm')}). These are relative 2-D interiors without station coordinates, roof depth, or a traversable tube polygon.`);
  const select = $('cave-section-select'); select.replaceChildren();
  for (const section of result.sections) option(select, String(section.number), `Section ${section.number}`);
  select.value = '1';
  drawCaveSection();
  const sources = $('cave-sources'); sources.replaceChildren();
  sources.append(`${result.credit} · ${result.license}. `);
  appendSourceLink(sources, result.source, 'Open catalog and license');
  appendSourceLink(sources, result.originalSurveyPaper, 'Original survey study');
  const download = document.createElement('a'); download.href = 'assets/data/m4/la-corona-cave-sections.json';
  download.download = 'la-corona-cave-sections.json'; download.textContent = 'Download section geometry JSON';
  sources.append(' · ', download);
}

function drawCaveSection() {
  const result = state.validCaveSections;
  if (!result) return;
  const section = result.sections[Number($('cave-section-select').value) - 1];
  if (!section) return;
  const canvas = $('cave-section-canvas'), context = canvas.getContext('2d');
  const scale = Math.min((canvas.width - 80) / section.widthM, (canvas.height - 70) / section.heightM);
  const left = (canvas.width - section.widthM * scale) / 2;
  const bottom = (canvas.height + section.heightM * scale) / 2;
  context.fillStyle = '#050e27'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#1a4164'; context.lineWidth = 1;
  for (let meter = 0; meter <= section.widthM; meter += 5) {
    const x = left + meter * scale; context.beginPath(); context.moveTo(x, bottom - section.heightM * scale); context.lineTo(x, bottom); context.stroke();
  }
  for (let meter = 0; meter <= section.heightM; meter += 5) {
    const y = bottom - meter * scale; context.beginPath(); context.moveTo(left, y); context.lineTo(left + section.widthM * scale, y); context.stroke();
  }
  context.beginPath();
  section.outlineM.forEach(([x, y], index) => {
    const px = left + x * scale, py = bottom - y * scale;
    if (index) context.lineTo(px, py); else context.moveTo(px, py);
  });
  context.closePath(); context.fillStyle = 'rgba(79, 145, 170, .24)'; context.fill();
  context.strokeStyle = '#8ed0d9'; context.lineWidth = 2; context.stroke();
  setText('cave-section-caption', `Catalog section ${section.number}: width ${format(section.widthM, 'm')}, height ${format(section.heightM, 'm')}, digitized polygon area ${format(section.areaM2, 'm²')}. The outline is drawn at metric scale in a local 2-D frame. Its position along the cave, ceiling-to-surface depth, floor obstacles, and structural stability are unknown.`);
}
$('cave-section-select').addEventListener('change', drawCaveSection);

function validPitDtm(data) {
  return data?.schema === 'M4SurfaceDtmCrop' && data.product === 'NAC_DTM_MARIUSPIT01' &&
    data.gridSize === 101 && data.spacingMeters === 4 &&
    Array.isArray(data.elevation) && data.elevation.length === 10201 &&
    data.elevation.some(Number.isFinite) && data.elevation.every(value => value === null || Number.isFinite(value)) &&
    Number.isFinite(data.pitCell?.row) && Number.isFinite(data.pitCell?.col) &&
    data.pitCell.row >= 0 && data.pitCell.row < 101 && data.pitCell.col >= 0 && data.pitCell.col < 101 &&
    typeof data.productPage === 'string' && data.productPage.startsWith('https://') &&
    typeof data.pitAtlas === 'string' && data.pitAtlas.startsWith('https://');
}

function renderSpatialSar(data) {
  state.validSpatialSar = data;
  const panel = $('sar-spatial'); panel.hidden = !data;
  if (!data) return;
  const values = data.latestDb.filter(Number.isFinite).sort((a, b) => a - b);
  const low = values[Math.floor(values.length * 0.05)], high = values[Math.floor(values.length * 0.95)];
  const drawLayer = (canvasId, layer, color) => {
    const canvas = $(canvasId), context = canvas.getContext('2d');
    const size = canvas.width / data.gridSize;
    for (let row = 0; row < data.gridSize; row++) for (let col = 0; col < data.gridSize; col++) {
      const value = layer[row * data.gridSize + col];
      context.fillStyle = Number.isFinite(value) ? color(value) : '#050b18';
      context.fillRect(col * size, row * size, Math.ceil(size), Math.ceil(size));
    }
  };
  drawLayer('sar-latest-canvas', data.latestDb, value => {
    const t = Math.max(0, Math.min(1, (value - low) / Math.max(0.1, high - low)));
    return `hsl(${215 - 170 * t} 60% ${22 + 48 * t}%)`;
  });
  drawLayer('sar-delta-canvas', data.deltaDb, value => {
    const strength = Math.min(1, Math.abs(value) / 3);
    return `hsl(${value < 0 ? 213 : 7} ${12 + strength * 75}% ${38 + strength * 12}%)`;
  });
  setText('sar-latest-scale', `Scene-relative color stretch: ${format(low, 'dB')} to ${format(high, 'dB')} (5th–95th percentile). North is up; dark pixels have no data.`);
  setText('sar-spatial-caption', `${data.polarization} RTC gamma0 · ${data.oldScene.date} → ${data.newScene.date} · ${data.platform.toUpperCase()} · relative orbit ${data.relativeOrbit} ${data.orbitState} · ${data.instrumentMode} mode. Source pixel spacing ${data.sourcePixelSpacingMeters} m; nominal radar resolution ${data.nominalRadarResolutionMeters.range} m range × ${data.nominalRadarResolutionMeters.azimuth} m azimuth; output grid ${data.gridSize} × ${data.gridSize} at about ${data.sampleSpacingMetersApprox} m spacing over ${data.windowMeters} m. ${Math.round(data.comparableFraction * 100)}% of cells have a paired difference. The difference uses a 5 × 5 linear-power mean (about 100 m) to reduce speckle; ${Math.round(data.aboveThresholdFraction * 1000) / 10}% exceed the exploratory 3 dB screen. Color differences may reflect moisture, roughness, incidence geometry, or processing. This is not a validated hazard or cave detector.`);
  const sources = $('sar-spatial-sources'); sources.replaceChildren();
  sources.append(`${data.credit} · ${data.license}. `);
  appendSourceLink(sources, data.oldScene.source, 'Earlier STAC scene');
  appendSourceLink(sources, data.newScene.source, 'Later STAC scene');
  appendSourceLink(sources, data.source, 'Collection and terms');
  const download = document.createElement('a'); download.href = `assets/data/m4/${encodeURIComponent(data.siteId)}-sar.json`;
  download.download = `${data.siteId}-sar.json`; download.textContent = 'Download georeferenced SAR JSON';
  sources.append(' · ', download);
  setText('sar-cell-readout', 'Move across a radar map to inspect cell values.');
}

for (const id of ['sar-latest-canvas', 'sar-delta-canvas']) $(id).addEventListener('pointermove', event => {
  const data = state.validSpatialSar;
  if (!data) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const row = Math.min(data.gridSize - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * data.gridSize)));
  const col = Math.min(data.gridSize - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * data.gridSize)));
  const index = row * data.gridSize + col, [west, south, east, north] = data.bboxWgs84;
  const lat = north - (row + 0.5) / data.gridSize * (north - south);
  const lon = west + (col + 0.5) / data.gridSize * (east - west);
  setText('sar-cell-readout', `Cell ${row}, ${col} · approx. ${lat.toFixed(5)}°, ${lon.toFixed(5)}° · later paired scene ${format(data.latestDb[index], 'dB')} · paired difference ${format(data.deltaDb[index], 'dB')}.`);
});

function renderPitDtm() {
  const data = state.pitDtm, panel = $('pit-context');
  panel.hidden = !data;
  if (!data) return;
  const canvas = $('pit-dtm-canvas'), context = canvas.getContext('2d');
  const n = data.gridSize, size = canvas.width / n;
  const valid = data.elevation.filter(Number.isFinite);
  const low = Math.min(...valid), span = Math.max(0.1, Math.max(...valid) - low);
  const layer = $('pit-layer').value;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const index = row * n + col;
    const value = layer === 'slope' ? state.pitAnalysis.slopeDeg[index] :
      layer === 'relief' ? state.pitIrregularity.localReliefM[index] : data.elevation[index];
    const t = !Number.isFinite(value) ? 0 : layer === 'slope' ? Math.min(1, value / 30) :
      layer === 'relief' ? Math.min(1, value / 3) : (value - low) / span;
    context.fillStyle = Number.isFinite(value) ? `hsl(${215 - 170 * t} ${layer === 'elevation' ? 32 : 68}% ${20 + 50 * t}%)` : '#030711';
    context.fillRect(col * size, row * size, Math.ceil(size), Math.ceil(size));
  }
  context.beginPath(); context.arc((data.pitCell.col + .5) * size, (data.pitCell.row + .5) * size, 7, 0, Math.PI * 2);
  context.strokeStyle = '#f5d970'; context.lineWidth = 2; context.stroke();
  const scale = layer === 'slope' ? 'Slope display saturates at 30°.' : layer === 'relief' ? 'Relief display saturates at 3 m.' : 'Elevation color is relative to this crop.';
  setText('pit-dtm-caption', `LROC surface DTM: ${n} × ${n} cells at ${data.spacingMeters} m, ${data.extentMeters} m across; ${data.nodataCount} cells without elevation. ${scale} Slope and relief need full neighborhoods, so additional cells are unknown. Ring marks the published pit point, not an underground outline. The atlas reports 40 m pit depth from stereo modeling; this crop does not independently measure it or resolve an underground tube.`);
  const sources = $('pit-dtm-sources'); sources.replaceChildren(); sources.append(`${data.credit}. `); appendSourceLink(sources, data.productPage, 'LROC DTM product'); appendSourceLink(sources, data.pitAtlas, 'LROC pit atlas');
  const download = document.createElement('a'); download.href = 'assets/data/m4/marius-pit-dtm.json';
  download.download = 'marius-pit-dtm.json'; download.textContent = 'Download georeferenced surface DTM JSON';
  sources.append(' · ', download);
}
$('pit-layer').addEventListener('change', renderPitDtm);
$('pit-dtm-canvas').addEventListener('pointermove', event => {
  const data = state.pitDtm;
  if (!data) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const row = Math.min(data.gridSize - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * data.gridSize)));
  const col = Math.min(data.gridSize - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * data.gridSize)));
  const index = row * data.gridSize + col;
  setText('pit-readout', `Cell ${row}, ${col} · surface elevation ${format(data.elevation[index], 'm', 2)} · Horn slope ${format(state.pitAnalysis.slopeDeg[index], '°')} · 3×3 local relief ${format(state.pitIrregularity.localReliefM[index], 'm')}.`);
});

function renderRadarHistory(radar) {
  const root = $('sar-history'); root.replaceChildren();
  const series = radar.temporalHistory;
  if (!series) { const p = document.createElement('p'); p.textContent = 'Temporal SAR: no validated window-mean series is attached to this selection.'; root.append(p); return; }
  const heading = document.createElement('h3'); heading.textContent = 'Sentinel-1 temporal context'; root.append(heading);
  const summary = document.createElement('p');
  summary.textContent = `${series.count} window-mean observations, ${series.firstDate} to ${series.lastDate} · ${series.polarization}, relative orbit ${series.relativeOrbit} ${series.orbitState}. ${series.comparableAdjacentPairs} adjacent pairs use the same platform; largest mean difference among those pairs: ${format(series.largestComparableMeanDeltaDb, 'dB')}. These are surface backscatter summaries, not a spatial change or cave-depth map.`;
  root.append(summary); appendSourceLink(root, series.source);
  const points = series.points.filter(point => Number.isFinite(point.meanDb));
  if (points.length < 2) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 560 120'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Window mean Sentinel-1 backscatter from ${series.firstDate} to ${series.lastDate}; values in dB, not a spatial SAR map.`);
  const times = points.map(point => Date.parse(`${point.date}T00:00:00Z`));
  const values = points.map(point => point.meanDb);
  const minTime = Math.min(...times), timeSpan = Math.max(1, Math.max(...times) - minTime);
  const minValue = Math.min(...values), valueSpan = Math.max(0.1, Math.max(...values) - minValue);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', points.map((_, i) => `${24 + (times[i] - minTime) / timeSpan * 510},${100 - (values[i] - minValue) / valueSpan * 78}`).join(' '));
  line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#f2d46b'); line.setAttribute('stroke-width', '2');
  svg.append(line); root.append(svg);
  const note = document.createElement('p'); note.textContent = `Each point is one ${series.windowMeters} m window aggregate. Source acquisition IDs and coverage are retained in the published process-history JSON. Same-orbit summaries do not establish a validated physical change.`; root.append(note);
}

function appendSourceLink(parent, url, label = 'Source record') {
  if (typeof url !== 'string' || !url.startsWith('https://')) return;
  const link = document.createElement('a'); link.href = url; link.textContent = label; link.target = '_blank'; link.rel = 'noopener noreferrer'; parent.append(' · ', link);
}

function cellAt(event) {
  const n = state.candidate?.gridSize; if (!n) return null;
  const rect = canvas.getBoundingClientRect();
  return { row: Math.min(n - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * n))), col: Math.min(n - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * n))) };
}
function selectCell(cell) {
  if (!cell) return;
  state.cursor = cell;
  if (!state.start || state.end) { state.start = cell; state.end = null; state.routes = []; state.routeSettings = null; }
  else state.end = cell;
  $('start-row').value = state.start.row; $('start-col').value = state.start.col;
  $('end-row').value = state.end?.row ?? ''; $('end-col').value = state.end?.col ?? '';
  if (state.end) calculate(); else { renderResults(); updateReadout(); draw(); }
}
canvas.addEventListener('click', event => selectCell(cellAt(event)));
canvas.addEventListener('keydown', event => {
  const n = state.candidate?.gridSize;
  if (!n) return;
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCell(state.cursor || { row: Math.floor(n / 2), col: Math.floor(n / 2) }); return; }
  const movement = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
  if (!movement) return;
  event.preventDefault();
  const current = state.cursor || { row: Math.floor(n / 2), col: Math.floor(n / 2) };
  state.cursor = { row: Math.min(n - 1, Math.max(0, current.row + movement[0])), col: Math.min(n - 1, Math.max(0, current.col + movement[1])) };
  updateReadout(); draw();
});

function updateReadout() {
  const cell = state.cursor, c = state.candidate, a = state.analysis;
  if (!cell || !c) { setText('cell-readout', 'Focus the grid and use arrow keys to inspect cells; press Enter to select a start or end cell.'); return; }
  const index = cell.row * c.gridSize + cell.col, elevation = c.elevation?.[index], slope = a?.slopeDeg?.[index];
  const relief = state.irregularity?.localReliefM?.[index], tri = state.irregularity?.triM?.[index];
  const position = routeCellCoordinates(c, cell);
  setText('cell-readout', `Row ${cell.row}, column ${cell.col}${position ? ` · approx. ${position[1].toFixed(5)}°, ${position[0].toFixed(5)}°` : ''} · elevation ${format(elevation, 'm')} · Horn slope ${format(slope, '°')} · 3×3 local relief ${format(relief, 'm')} · TRI ${format(tri, 'm')}`);
}

function readCell(prefix, n) {
  if ($(`${prefix}-row`).value.trim() === '' || $(`${prefix}-col`).value.trim() === '') return null;
  const row = Number($(`${prefix}-row`).value), col = Number($(`${prefix}-col`).value);
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= n || col >= n) return null;
  return { row, col };
}
function calculate() {
  const n = state.candidate?.gridSize;
  if (!Number.isInteger(n) || state.analysis?.status !== 'ok') { state.routes = []; state.routeSettings = null; $('route-download').disabled = true; setText('route-results', 'Load a valid candidate DEM before calculating routes.'); return; }
  state.start = readCell('start', n); state.end = readCell('end', n);
  if (!state.start || !state.end) { state.routes = []; state.routeSettings = null; $('route-download').disabled = true; setText('route-results', `Enter row and column values from 0 to ${n - 1}.`); draw(); return; }
  const maxSlopeDeg = $('max-slope').value.trim() === '' ? NaN : Number($('max-slope').value);
  if (!Number.isFinite(maxSlopeDeg) || maxSlopeDeg < 0 || maxSlopeDeg > 89) { state.routes = []; state.routeSettings = null; $('route-download').disabled = true; setText('route-results', 'Maximum slope must be between 0° and 89°.'); draw(); return; }
  const reliefLimit = $('max-relief').value.trim() === '' ? NaN : Number($('max-relief').value);
  const relief = $('relief-overlay').checked ? classifyTerrainRelief(grid(), reliefLimit) : null;
  if (relief && relief.status !== 'ok') { state.routes = []; state.routeSettings = null; $('route-download').disabled = true; setText('route-results', 'Local relief limit must be a nonnegative number of meters.'); draw(); return; }
  const blockedCells = relief?.cells.map(cell => cell !== 'within-limit');
  state.routes = [1, 5].map(slopeWeight => ({ slopeWeight, result: planRoute(grid(), state.start, state.end, { maxSlopeDeg, slopeWeight, blockedCells }) }));
  state.routeSettings = { maxSlopeDeg, reliefLimitM: relief ? reliefLimit : null };
  renderResults(); draw();
}
$('route-form').addEventListener('submit', event => { event.preventDefault(); calculate(); });
$('route-download').addEventListener('click', () => {
  const exportData = routeEvidenceGeoJSON({
    grid: state.candidate, targetId: $('target-select').value, routes: state.routes,
    maxSlopeDeg: state.routeSettings?.maxSlopeDeg,
    reliefLimitM: state.routeSettings?.reliefLimitM,
    spatialSar: state.validSpatialSar, inputDataVersion: state.reference ? null : (state.data?.version ?? null),
    generatedAt: new Date().toISOString(),
  });
  if (!exportData) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/geo+json' }));
  const link = document.createElement('a'); link.href = url; link.download = `selene-m4-${state.candidate.id}-routes.geojson`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('max-slope').addEventListener('change', () => { if (state.start && state.end) calculate(); else draw(); });
$('slope-overlay').addEventListener('change', draw);
$('relief-overlay').addEventListener('change', () => { if (state.start && state.end) calculate(); else draw(); });
$('max-relief').addEventListener('change', () => { if (state.start && state.end && $('relief-overlay').checked) calculate(); else draw(); });
$('shadow-overlay').addEventListener('change', draw);
$('sun-elevation').addEventListener('change', draw);
$('sun-azimuth').addEventListener('change', draw);
$('sun-utc').value = new Date().toISOString().slice(0, 16);
$('set-sun-from-utc').addEventListener('click', () => {
  const center = state.candidate?.center;
  const instant = Date.parse(`${$('sun-utc').value}Z`);
  if (!Array.isArray(center) || !center.every(Number.isFinite) || !Number.isFinite(instant)) { setText('sun-note', 'Select an Earth window and a valid UTC time.'); return; }
  const sun = sunPosition(instant, center[0], center[1], { refraction: false });
  $('sun-elevation').value = sun.elevationDeg.toFixed(2);
  $('sun-azimuth').value = sun.azimuthDeg.toFixed(2);
  $('shadow-overlay').checked = true;
  setText('sun-note', `Modeled Earth sun position for ${new Date(instant).toISOString()}: elevation ${sun.elevationDeg.toFixed(2)}°, azimuth ${sun.azimuthDeg.toFixed(2)}° (NOAA approximation).`);
  draw();
});
$('candidate-select').addEventListener('change', () => { void selectCandidate(); });
$('target-select').addEventListener('change', () => loadTarget($('target-select').value));
window.addEventListener('hashchange', () => {
  const params = new URLSearchParams(location.hash.slice(1));
  const target = safeTarget(params.get('target'));
  $('target-select').value = target;
  void loadTarget(target, params.get('candidate'));
});

function metric(dl, label, value) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; dl.append(dt, dd); }
function format(value, unit, digits = 1) { return Number.isFinite(value) ? `${value.toFixed(digits)} ${unit}` : 'unknown'; }
function renderResults() {
  const root = $('route-results'); root.replaceChildren();
  $('route-download').disabled = !state.routes.some(entry => entry.result?.status === 'ok');
  if (!state.routes.length) { const p = document.createElement('p'); p.textContent = 'Choose start and end cells to compare routes.'; root.append(p); return; }
  for (const { slopeWeight, result } of state.routes) {
    const block = document.createElement('section'); block.className = 'route-result';
    const title = document.createElement('h3'); title.textContent = slopeWeight === 1 ? 'Alternative A · distance emphasis' : 'Alternative B · slope emphasis'; block.append(title);
    if (result.status === 'ok') {
      const dl = document.createElement('dl');
      metric(dl, 'Distance', format(result.distanceM, 'm', 0)); metric(dl, 'Ascent / descent', `${format(result.ascentM, 'm', 0)} / ${format(result.descentM, 'm', 0)}`);
      metric(dl, 'Maximum / mean slope', `${format(result.maxSlopeDeg, '°')} / ${format(result.meanSlopeDeg, '°')}`);
      const values = result.path.map(point => point.row * state.candidate.gridSize + point.col);
      const reliefs = values.map(index => state.irregularity?.localReliefM?.[index]).filter(Number.isFinite);
      const tris = values.map(index => state.irregularity?.triM?.[index]).filter(Number.isFinite);
      metric(dl, 'Maximum 3×3 local relief along path', reliefs.length ? format(Math.max(...reliefs), 'm') : 'unknown');
      metric(dl, 'Mean TRI along path', tris.length ? format(tris.reduce((sum, value) => sum + value, 0) / tris.length, 'm') : 'unknown');
      metric(dl, 'Unknown terrain cells in window', String(state.irregularity?.counts?.unknown ?? 'unknown'));
      block.append(dl);
    } else { const p = document.createElement('p'); p.textContent = result.status === 'no-route' ? 'No route under this slope limit within the DEM grid.' : 'Route input or DEM is invalid.'; block.append(p); }
    const caveat = document.createElement('p'); caveat.textContent = [result.caveats, 'The local-relief constraint is a user scenario, not vehicle clearance. TRI is descriptive. Outside this DEM window and unmeasured hazards remain unknown.'].flat().filter(Boolean).join(' '); block.append(caveat); root.append(block);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const c = state.candidate, a = state.analysis;
  if (!c || !a || a.status !== 'ok') return;
  const n = c.gridSize, size = canvas.width / n;
  const slopeLimit = $('max-slope').value.trim() === '' ? NaN : Number($('max-slope').value);
  const slopeLayer = classifyTerrainSlope(grid(), slopeLimit);
  const reliefLimit = $('max-relief').value.trim() === '' ? NaN : Number($('max-relief').value);
  const reliefLayer = classifyTerrainRelief(grid(), reliefLimit);
  const sunElevation = $('sun-elevation').value.trim() === '' ? NaN : Number($('sun-elevation').value);
  const sunAzimuth = $('sun-azimuth').value.trim() === '' ? NaN : Number($('sun-azimuth').value);
  const shadowLayer = $('shadow-overlay').checked ? modelTerrainShadow(grid(), { elevationDeg: sunElevation, azimuthDeg: sunAzimuth }) : null;
  setText('hazard-context', `Slope grid: ${slopeLayer.status === 'ok' ? `${slopeLayer.counts['above-limit']} above limit, ${slopeLayer.counts.unknown} unknown` : 'invalid threshold'}. Local relief: ${reliefLayer.status === 'ok' ? `${reliefLayer.counts['above-limit']} above scenario limit, ${reliefLayer.counts.unknown} unknown` : 'enter a valid scenario limit'}. Sun-angle shadow: ${shadowLayer?.status === 'ok' ? `${shadowLayer.counts.shadowed} modeled shadowed, ${shadowLayer.counts.unknown} unknown` : shadowLayer ? 'enter valid sun angles' : 'off'}. Slope and selected relief limits constrain routes; shadow does not. No rock or cave detector is available at this regional resolution.`);
  const valid = c.elevation.filter(Number.isFinite), low = Math.min(...valid), high = Math.max(...valid), span = Math.max(1, high - low);
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const index = row * n + col, z = c.elevation[index], t = Number.isFinite(z) ? (z - low) / span : 0;
    ctx.fillStyle = Number.isFinite(z) ? `hsl(${210 - t * 165} ${35 + t * 25}% ${20 + t * 42}%)` : '#151b2a';
    ctx.fillRect(col * size, row * size, Math.ceil(size), Math.ceil(size));
    const slope = a.slopeDeg?.[index];
    if ($('slope-overlay').checked && Number.isFinite(slope) && slope > slopeLimit) { ctx.fillStyle = 'rgba(245,71,61,.58)'; ctx.fillRect(col * size, row * size, Math.ceil(size), Math.ceil(size)); }
    if ($('slope-overlay').checked && !Number.isFinite(slope)) { ctx.fillStyle = 'rgba(5,10,22,.33)'; ctx.fillRect(col * size, row * size, Math.ceil(size), Math.ceil(size)); }
    if ($('relief-overlay').checked && reliefLayer.status === 'ok' && reliefLayer.cells[index] === 'above-limit') { ctx.fillStyle = 'rgba(255,152,61,.54)'; ctx.fillRect(col * size, row * size, Math.ceil(size), Math.ceil(size)); }
    if (shadowLayer?.status === 'ok' && shadowLayer.cells[index] === 'shadowed') { ctx.fillStyle = 'rgba(30,25,70,.58)'; ctx.fillRect(col * size, row * size, Math.ceil(size), Math.ceil(size)); }
  }
  if (state.validLocalTerrain) {
    const box = canvas.width * (state.validLocalTerrain.grid.gridSize - 1) * state.validLocalTerrain.grid.spacingMeters / (c.extentMeters || (n - 1) * c.spacingMeters);
    ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#8ed0d9'; ctx.lineWidth = 2;
    ctx.strokeRect((canvas.width - box) / 2, (canvas.height - box) / 2, box, box); ctx.restore();
  }
  for (const [index, entry] of state.routes.entries()) {
    if (entry.result.status !== 'ok' || !entry.result.path?.length) continue;
    ctx.beginPath(); entry.result.path.forEach((point, i) => { const x = (point.col + .5) * size, y = (point.row + .5) * size; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = index ? '#f9e48a' : '#77e8f3'; ctx.lineWidth = Math.max(2, size * .38); ctx.lineJoin = 'round'; ctx.stroke();
  }
  for (const [cell, color] of [[state.start, '#77e8f3'], [state.end, '#ffe16a']]) if (cell) { ctx.beginPath(); ctx.arc((cell.col + .5) * size, (cell.row + .5) * size, Math.max(5, size * .65), 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#06102a'; ctx.lineWidth = 2; ctx.stroke(); }
  if (state.cursor) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(state.cursor.col * size + 1, state.cursor.row * size + 1, size - 2, size - 2); }
}

loadTarget($('target-select').value, initialCandidate);
