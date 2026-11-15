import { compareTerrain } from './similarity.mjs';
import { createDiscoveryScene } from './discovery-scene.mjs';
import {
  relativeCenterProfiles,
  bestCandidateByRegion,
  pairedBarMax,
  thermalBands,
  profilePath,
} from './discovery-math.mjs';
import { gridExtent, validGrid } from './mission-math.mjs';

const TARGETS = [
  { id: 'marius-hills', label: 'Marius Hills', body: 'Moon' },
  { id: 'shackleton', label: 'Shackleton', body: 'Moon' },
  { id: 'jezero', label: 'Jezero', body: 'Mars' },
  { id: 'valles-marineris', label: 'Valles Marineris', body: 'Mars' },
];

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = matchMedia('(max-width: 760px)');

const status = $('discovery-status');
const candidateList = $('candidate-list');
const targetButtons = $('target-buttons');
const compareIndex = $('compare-index');
const compareMetrics = $('compare-metrics');
const profileSvg = $('profile-svg');
const thermalChart = $('thermal-chart');
const sourcesList = $('sources-list');
const viewport = $('scene-viewport');
const canvas = $('discovery-scene');
const sceneFallback = $('scene-fallback');

const componentNames = {
  slopeP50Deg: 'Median slope (p50)',
  slopeP90Deg: 'Slope (p90)',
  reliefP95P5M: 'Relief (p95–p5)',
  triMeanM: 'Mean terrain ruggedness (TRI)',
  roughness: 'Radar roughness',
  thermalAmplitudeK: 'Daily thermal amplitude',
};

const state = {
  targetId: TARGETS[0].id,
  discovery: null,
  target: null,
  regions: null,
  selectedId: null,
  comparisons: new Map(),
  view: 'split',
  splitPane: 'earth',
  motion: !reducedMotion.matches,
};

function englishCaveat(text) {
  const exact = new Map([
    ['Índice de similitud geométrica, no planetaria: la geometría del relieve no reproduce gravedad, regolito, iluminación ni química.', 'Geometric similarity index, not planetary: terrain shape alone does not reproduce gravity, regolith, lighting, or chemistry.'],
    ['Índice de selección geométrico; el índice mostrado lo recomputa similarity.mjs.', 'Geometric selection score; the displayed index is recalculated by similarity.mjs.'],
    ['Rugosidad radar no disponible en ambos sitios: no entra en el índice.', 'Radar roughness is not available for both sites and is excluded from the index.'],
    ['Pesos editoriales del prototipo, no calibrados frente a misiones reales.', 'Prototype weighting is editorial and has not been calibrated against real missions.'],
    ['Aridez: contexto terrestre (precipitación anual ERA5), no puntúa contra el objetivo; la Luna y Marte no tienen una aridez comparable.', 'Aridity is Earth-side context from annual ERA5 precipitation; it is not scored against the target because Moon and Mars do not have comparable aridity.'],
    ['Candidato descubierto por escaneo en rejilla; no es un sitio de ensayo publicado.', 'Candidate discovered by grid scan; this is not a published field-test site.'],
    ['Amplitud térmica: compara la oscilación diurna (Tierra: aire 2 m, climatología ERA5; objetivo: temperatura de superficie Diviner/MCD). Premia a los sitios terrestres de mayor oscilación; las magnitudes no coinciden (gravedad, atmósfera, superficie vs aire), no afirma equivalencia física.', 'Thermal amplitude compares diurnal variation (Earth: 2 m air temperature from ERA5 climatology; target: Diviner/MCD surface temperature). Higher-amplitude Earth sites score better; measurements differ in gravity, atmosphere, and surface-versus-air context, so this is not a claim of physical equivalence.'],
    ['Amplitud térmica: oscilación diurna Tierra (aire 2 m, ERA5) vs objetivo (superficie, Diviner/MCD). Premia sitios de mayor oscilación; las magnitudes no coinciden (gravedad, atmósfera, superficie vs aire), no afirma equivalencia física.', 'Thermal amplitude compares Earth diurnal air temperature (2 m, ERA5) with target surface temperature (Diviner/MCD). Higher-amplitude sites score better; measurements differ in gravity, atmosphere, and surface-versus-air context, so this is not a claim of physical equivalence.'],
  ]);
  if (exact.has(text)) return exact.get(text);
  if (text.startsWith('Mejor empate geométrico a escala ')) {
    const scale = text.match(/escala ([\d.]+ m)/)?.[1];
    return `Best geometric match${scale ? ` at ${scale} scale` : ''}; thermal and aridity context from ERA5 climatology.`;
  }
  if (text.startsWith('No comparable a escala:')) return 'Scale comparability is limited: native resolution is coarser than the comparison grid, so the index is indicative only.';
  if (text.startsWith('Rugosidad excluida:')) return 'Radar roughness is excluded because the units differ; Earth radar backscatter and lunar Mini-RF CPR are not directly comparable.';
  if (text.startsWith('Índice no calculado:')) return 'Index not calculated because required metrics are missing.';
  if (text.startsWith('Faltan métricas del análogo terrestre')) return 'Earth analogue metrics are missing.';
  if (text.startsWith('Faltan métricas del objetivo')) return 'Target metrics are missing.';
  if (text.startsWith('Amplitud térmica:')) return 'Thermal amplitude compares Earth diurnal air temperature (2 m, ERA5) with target surface temperature (Diviner/MCD); the measurements are not physically equivalent.';
  return text;
}

function englishRegion(name) {
  const slugs = {
    'andes-altiplano': 'Andean Altiplano',
    'sw-north-america': 'Southwestern North America',
    'arabia-levant': 'Arabian Peninsula and Levant',
    'east-africa-rift': 'East African Rift',
    'central-asia': 'Central Asia',
    'australia-outback': 'Australian Outback',
  };
  return String(name || '')
    .replace(/^Prefiltro\s+/i, '')
    .replace(/^Arco volcánico centroamericano/, 'Central American Volcanic Arc')
    .replace(/^Altiplano andino/, 'Andean Altiplano')
    .replace(/^Cuenca de Asia Central/, 'Central Asian Basin')
    .replace(/^([a-z-]+)(?=\s+·)/i, (slug) => slugs[slug] || slug.replaceAll('-', ' '))
    .replace(/candidato\s+(\d+)/i, 'candidate $1');
}

function translateProvenance(label) {
  return label
    .replace('Preselección automática A.R.E.S. Twin (prefiltro global grueso, GLO-90)', 'A.R.E.S. Twin automatic preselection (coarse global GLO-90 prefilter)')
    .replace('Copernicus DEM GLO-30 · tesela ', 'Copernicus DEM GLO-30 · tile ')
    .replace(' (Planetary Computer)', ' (Planetary Computer)')
    .replace('Región de búsqueda definida para A.R.E.S. Twin; bbox exploratoria', 'Exploratory search region defined for A.R.E.S. Twin');
}

function addText(parent, tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  parent.append(el);
  return el;
}

function selectedCandidate() {
  return state.discovery?.candidates?.find((c) => c.id === state.selectedId) || null;
}

function comparisonFor(candidate) {
  if (!candidate) return null;
  return state.comparisons.get(candidate.id) || compareTerrain(candidate, state.target);
}

function initTargetButtons() {
  targetButtons.replaceChildren();
  for (const target of TARGETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.targetId = target.id;
    button.setAttribute('aria-pressed', String(target.id === state.targetId));
    button.textContent = target.label;
    const small = document.createElement('small');
    small.textContent = target.body.toUpperCase();
    button.append(small);
    button.addEventListener('click', () => {
      if (state.targetId === target.id) return;
      state.targetId = target.id;
      for (const node of targetButtons.querySelectorAll('button')) {
        node.setAttribute('aria-pressed', String(node.dataset.targetId === state.targetId));
      }
      loadDiscovery(state.targetId);
    });
    targetButtons.append(button);
  }
}

function renderCandidateList() {
  candidateList.replaceChildren();
  if (!state.discovery) return;
  for (const candidate of state.discovery.candidates) {
    const comparison = comparisonFor(candidate);
    const index = comparison?.index;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'candidate-row';
    row.role = 'option';
    row.id = `candidate-${candidate.id}`;
    row.setAttribute('aria-selected', String(candidate.id === state.selectedId));
    if (candidate.id === state.selectedId) row.setAttribute('aria-current', 'true');
    row.addEventListener('click', () => selectCandidate(candidate.id));
    addText(row, 'span', 'candidate-rank', `#${candidate.rank}`);
    const main = document.createElement('div');
    main.className = 'candidate-row-main';
    addText(main, 'strong', '', englishRegion(candidate.name || candidate.id));
    const meta = `${candidate.scaleMeters || state.discovery.window?.extentMeters || 2400} m · ${englishRegion(candidate.region?.name || '')}`;
    addText(main, 'span', 'candidate-row-meta', meta);
    const track = document.createElement('div');
    track.className = 'candidate-row-track';
    const fill = document.createElement('div');
    fill.className = 'candidate-row-fill';
    fill.style.width = `${Math.max(0, Math.min(100, index ?? 0))}%`;
    track.append(fill);
    main.append(track);
  const badges = document.createElement('div');
    badges.className = 'candidate-row-badges';
    if (candidate.aridity?.class) {
      const aridity = ({ árido: 'Arid', semiárido: 'Semi-arid', húmedo: 'Humid' })[candidate.aridity.class] || candidate.aridity.class;
      const pill = addText(badges, 'span', 'candidate-pill arid', aridity);
      pill.title = `Aridity context (not scored): ${candidate.aridity.annualPrecipMm} mm/year`;
    }
    main.append(badges);
    row.append(main);
    addText(row, 'span', 'candidate-row-score', index == null ? '—' : `${index}`);
    candidateList.append(row);
  }
}

function gridFromCandidate(candidate) {
  return {
    elevation: candidate.elevation,
    gridSize: candidate.gridSize,
    spacingMeters: candidate.spacingMeters,
    extentMeters: candidate.extentMeters,
  };
}

function gridFromTarget(target) {
  return {
    elevation: target.elevation,
    gridSize: target.gridSize,
    spacingMeters: target.spacingMeters,
    extentMeters: target.extentMeters,
  };
}

function renderComparePanel() {
  const candidate = selectedCandidate();
  const comparison = comparisonFor(candidate);
  if (!candidate || !comparison) {
    compareIndex.textContent = '—';
    compareMetrics.replaceChildren();
    profileSvg.replaceChildren();
    thermalChart.replaceChildren();
    return;
  }
  compareIndex.textContent = comparison.index == null ? '—' : `${comparison.index}`;
  compareMetrics.replaceChildren();
  for (const component of comparison.components) {
    const block = document.createElement('div');
    block.className = 'metric-pair';
    const header = document.createElement('header');
    addText(header, 'span', '', componentNames[component.key] || component.label);
    const weight = `${Math.round((component.weight || 0) * 100)}% weight`;
    addText(header, 'span', '', weight);
    block.append(header);
    const values = document.createElement('div');
    values.className = 'metric-values';
    const unit = component.unit ? ` ${component.unit}` : '';
    addText(values, 'span', '', `Earth ${component.earth?.toLocaleString('en', { maximumFractionDigits: 2 })}${unit}`);
    addText(values, 'span', '', `Target ${component.target?.toLocaleString('en', { maximumFractionDigits: 2 })}${unit}`);
    block.append(values);
    const bars = document.createElement('div');
    bars.className = 'metric-bars';
    const max = pairedBarMax(component.earth, component.target);
    for (const [side, value, cls] of [
      ['earth', component.earth, 'metric-bar-earth'],
      ['target', component.target, 'metric-bar-target'],
    ]) {
      const wrap = document.createElement('div');
      wrap.className = `metric-bar-track ${cls}`;
      const fill = document.createElement('div');
      fill.className = 'metric-bar-fill';
      fill.style.width = `${Math.min(100, (Math.abs(value) / max) * 100)}%`;
      wrap.append(fill);
      bars.append(wrap);
      void side;
    }
    block.append(bars);
    const foot = document.createElement('footer');
    addText(foot, 'span', '', `Score ${component.score}`);
    block.append(foot);
    compareMetrics.append(block);
  }
  renderProfile(candidate, state.target);
  renderThermal(candidate, state.target);
}

function renderProfile(candidate, target) {
  profileSvg.replaceChildren();
  const earthGrid = gridFromCandidate(candidate);
  const targetGrid = gridFromTarget(target);
  if (!validGrid(earthGrid) || !validGrid(targetGrid)) return;
  const profiles = relativeCenterProfiles(earthGrid, targetGrid);
  const w = 320;
  const h = 120;
  const sharedMax = profiles.maxRelief;
  const earthPath = profilePath(profiles.earth, gridExtent(earthGrid), sharedMax, w, h);
  const targetPath = profilePath(profiles.target, gridExtent(targetGrid), sharedMax, w, h);
  if (earthPath) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'earth');
    path.setAttribute('d', earthPath);
    profileSvg.append(path);
  }
  if (targetPath) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'target');
    path.setAttribute('d', targetPath);
    profileSvg.append(path);
  }
}

function renderThermal(candidate, target) {
  thermalChart.replaceChildren();
  const bands = thermalBands(candidate.thermal, target.thermal);
  const rows = [
    { label: 'Earth', band: bands.earth, cls: 'earth' },
    { label: 'Target', band: bands.target, cls: 'target' },
  ];
  for (const row of rows) {
    const el = document.createElement('div');
    el.className = 'thermal-row';
    addText(el, 'span', '', row.label);
    const track = document.createElement('div');
    track.className = 'thermal-track';
    if (row.band && (row.band.min !== null || row.band.max !== null)) {
      const min = row.band.min ?? bands.minK;
      const max = row.band.max ?? bands.maxK;
      const left = ((min - bands.minK) / bands.span) * 100;
      const width = ((max - min) / bands.span) * 100;
      const band = document.createElement('div');
      band.className = `thermal-band ${row.cls}`;
      band.style.left = `${left}%`;
      band.style.width = `${Math.max(width, 2)}%`;
      track.append(band);
      el.append(track);
      addText(el, 'span', '', `${min?.toFixed(0) ?? '—'}–${max?.toFixed(0) ?? '—'} K`);
    } else {
      addText(track, 'span', '', '—');
      el.append(track);
      addText(el, 'span', '', 'no data');
    }
    thermalChart.append(el);
  }
}

function renderSources(candidate, comparison) {
  sourcesList.replaceChildren();
  const items = new Set();
  for (const item of state.discovery?.caveats || []) items.add(englishCaveat(item));
  for (const item of comparison?.caveats || []) items.add(englishCaveat(item));
  for (const text of items) addText(sourcesList, 'li', '', text);
  for (const source of candidate?.provenance || []) {
    const li = document.createElement('li');
    addText(li, 'span', '', `${translateProvenance(source.label)} · `);
    const a = document.createElement('a');
    a.href = source.url;
    a.textContent = 'source';
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    li.append(a);
    sourcesList.append(li);
  }
  for (const source of state.target?.provenance || []) {
    const li = document.createElement('li');
    addText(li, 'span', '', `Target · ${source.label} · `);
    if (source.url) {
      const a = document.createElement('a');
      a.href = source.url;
      a.textContent = 'source';
      a.rel = 'noopener noreferrer';
      a.target = '_blank';
      li.append(a);
    }
    sourcesList.append(li);
  }
}

function updateSplitLabels() {
  const candidate = selectedCandidate();
  const target = state.target;
  if (!candidate || !target) return;
  $('split-earth-name').textContent = `#${candidate.rank} · ${englishRegion(candidate.name || candidate.id)}`;
  $('split-target-name').textContent = target.name || target.id;
  $('split-target-kind').textContent = `${(target.body || 'target').toUpperCase()} / TARGET`;
  $('split-earth-note').textContent = `${candidate.scaleMeters || candidate.extentMeters} m window · Copernicus GLO-30 · hillshade only`;
  $('split-target-note').textContent = `${target.extentMeters} m window · ${target.dataset || 'planetary DEM'}`;
  const imagery = target.imagery;
  const credit = $('imagery-credit');
  if ($('target-imagery').checked && imagery?.credit) {
    credit.hidden = false;
    credit.textContent = imagery.credit;
  } else {
    credit.hidden = true;
    credit.textContent = '';
  }
}

function activeRegionIds() {
  return new Set((state.discovery?.candidates || []).map((c) => c.region?.id).filter(Boolean));
}

function updateSceneMarkers() {
  if (!scene?.webgl || !state.discovery) return;
  scene.setGlobeMarkers({
    regions: state.regions?.regions || [],
    candidates: state.discovery.candidates,
    activeRegionIds: activeRegionIds(),
    selectedCandidateId: state.selectedId,
  });
}

async function selectCandidate(id) {
  const candidate = state.discovery?.candidates?.find((c) => c.id === id);
  if (!candidate) return;
  state.selectedId = id;
  renderCandidateList();
  const comparison = comparisonFor(candidate);
  renderComparePanel();
  renderSources(candidate, comparison);
  updateSplitLabels();
  updateSceneMarkers();
  if (scene?.webgl) {
    scene.setTargetImagery($('target-imagery').checked);
    await scene.setPair(candidate, state.target);
    scene.focusCandidate(candidate.center[0], candidate.center[1]);
  }
  const row = document.getElementById(`candidate-${id}`);
  row?.scrollIntoView({ block: 'nearest' });
}

function setView(view) {
  state.view = view;
  viewport.dataset.view = view;
  $('view-split').classList.toggle('view-tab-active', view === 'split');
  $('view-globe').classList.toggle('view-tab-active', view === 'globe');
  $('view-split').setAttribute('aria-pressed', String(view === 'split'));
  $('view-globe').setAttribute('aria-pressed', String(view === 'globe'));
  const splitOverlay = $('split-overlay');
  splitOverlay.hidden = view !== 'split';
  scene?.setView(view);
  if (view === 'globe') updateSceneMarkers();
}

function setSplitPane(pane) {
  state.splitPane = pane;
  viewport.querySelector('.split-overlay')?.setAttribute('data-pane', pane);
  $('split-tab-earth').setAttribute('aria-pressed', String(pane === 'earth'));
  $('split-tab-target').setAttribute('aria-pressed', String(pane === 'target'));
  scene?.setSplitPane(pane);
}

let scene = null;

function initScene() {
  scene = createDiscoveryScene(canvas, {
    reducedMotion,
    onPick: (hit) => {
      if (hit.candidateId) selectCandidate(hit.candidateId);
      else if (hit.regionId) {
        const match = bestCandidateByRegion(state.discovery?.candidates || []).get(hit.regionId);
        if (match) selectCandidate(match.id);
      }
    },
  });
  if (!scene.webgl) {
    canvas.hidden = true;
    sceneFallback.hidden = false;
    $('scene-hint').hidden = true;
    document.querySelector('.discovery-scene-tools')?.setAttribute('hidden', '');
    return;
  }
  scene.start();
  const resize = () => {
    const rect = viewport.getBoundingClientRect();
    scene.resize(Math.round(rect.width), Math.round(rect.height));
  };
  new ResizeObserver(resize).observe(viewport);
  resize();
  $('scene-center').addEventListener('click', () => scene.centerCamera());
  $('scene-zoom-in').addEventListener('click', () => scene.zoomIn());
  $('scene-zoom-out').addEventListener('click', () => scene.zoomOut());
  $('scene-motion').addEventListener('click', () => {
    state.motion = !state.motion;
    scene.setMotion(state.motion);
    const button = $('scene-motion');
    button.setAttribute('aria-pressed', String(!state.motion));
    button.textContent = state.motion ? 'Ⅱ' : '▷';
  });
  reducedMotion.addEventListener?.('change', (event) => {
    if (event.matches) {
      state.motion = false;
      scene.setMotion(false);
    }
  });
}

async function loadDiscovery(targetId) {
  state.discovery = null;
  state.target = null;
  state.regions = null;
  state.selectedId = null;
  state.comparisons.clear();
  candidateList.replaceChildren();
  status.textContent = 'Loading candidate ranking…';
  try {
    const [discoveryResponse, regionsResponse] = await Promise.all([
      fetch(`assets/data/discovery/${encodeURIComponent(targetId)}.json`),
      fetch(`assets/data/discovery/regions-${encodeURIComponent(targetId)}.json`),
    ]);
    if (!discoveryResponse.ok) throw new Error('No scan is available for this target yet.');
    const discovery = await discoveryResponse.json();
    const targetResponse = await fetch(discovery.target);
    if (!targetResponse.ok) throw new Error('Could not load the target terrain data.');
    const target = await targetResponse.json();
    state.discovery = discovery;
    state.target = target;
    if (regionsResponse.ok) state.regions = await regionsResponse.json();
    for (const candidate of discovery.candidates) {
      state.comparisons.set(candidate.id, compareTerrain(candidate, target));
    }
    const regionNames = (discovery.regions || []).map((r) => englishRegion(r.name)).join(' · ');
    status.textContent = `${regionNames || targetId} · ${discovery.scannedCells} cells scanned · ${discovery.validCells ?? discovery.candidates.length} valid · ${discovery.candidates.length} shown`;
    if (discovery.candidates[0]) await selectCandidate(discovery.candidates[0].id);
    else renderComparePanel();
  } catch (error) {
    status.textContent = error.message;
    compareIndex.textContent = '—';
    sourcesList.replaceChildren();
  }
}

candidateList.addEventListener('keydown', (event) => {
  const rows = [...candidateList.querySelectorAll('.candidate-row')];
  const index = rows.findIndex((row) => row.id === `candidate-${state.selectedId}`);
  if (event.key === 'ArrowDown' && index < rows.length - 1) {
    event.preventDefault();
    rows[index + 1].click();
    rows[index + 1].focus();
  } else if (event.key === 'ArrowUp' && index > 0) {
    event.preventDefault();
    rows[index - 1].click();
    rows[index - 1].focus();
  }
});

$('view-split').addEventListener('click', () => setView('split'));
$('view-globe').addEventListener('click', () => setView('globe'));
$('split-tab-earth').addEventListener('click', () => setSplitPane('earth'));
$('split-tab-target').addEventListener('click', () => setSplitPane('target'));
$('target-imagery').addEventListener('change', (event) => {
  scene?.setTargetImagery(event.target.checked);
  updateSplitLabels();
  if (state.discovery && state.selectedId) {
    const candidate = selectedCandidate();
    if (candidate) scene?.setPair(candidate, state.target);
  }
});
mobileQuery.addEventListener?.('change', () => setSplitPane(state.splitPane));

initTargetButtons();
initScene();
setView('split');
loadDiscovery(state.targetId);