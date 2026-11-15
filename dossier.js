import { buildDossierContext } from './dossier-context.mjs';
import { buildCandidateAnalogPayload } from './analog-audit.mjs';
import { automaticEngineering } from './mission-audit.mjs';
import { analyzeProcesses, summarizeProcesses } from './processes.mjs';

const $ = (id) => document.getElementById(id);
const state = { scenarios: [], scenario: null, context: null, dossier: null, busy: false };
const SCENARIO_LABELS = {
  'lava-tube': 'Volcanic lava tube',
  'polar-shadow': 'Permanently shadowed polar crater',
  'hyperarid-salt': 'Hyperarid salt plain',
  'wind-canyon': 'Aeolian erosion canyon',
};
const DISCOVERY_TARGETS = ['marius-hills', 'shackleton', 'jezero', 'valles-marineris'];
// The provider can use a primary model and one fallback (up to 30 s each).
// Keep the browser request alive long enough for that documented server flow.
const DOSSIER_TIMEOUT_MS = 120_000;
let generationTimer = null;

function setGenerating(active, message = 'Preparing the request…') {
  const loader = $('generation-loader');
  const documentPanel = loader.closest('.dossier-document');
  clearInterval(generationTimer); generationTimer = null;
  loader.hidden = !active; documentPanel.setAttribute('aria-busy', String(active));
  if (!active) return;
  const startedAt = Date.now();
  $('generation-message').textContent = message;
  const updateElapsed = () => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    $('generation-elapsed').textContent = `Elapsed: ${seconds} s`;
    if (seconds >= 3 && seconds < 60) $('generation-message').textContent = 'Waiting for the AI provider response…';
    if (seconds >= 60) $('generation-message').textContent = 'The provider is still working. This request can take up to two minutes…';
  };
  updateElapsed(); generationTimer = setInterval(updateElapsed, 1_000);
}

async function fetchJSON(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 20_000);
  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET', cache: options.cache ?? 'no-store', signal: controller.signal,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status; error.code = payload?.error || null; throw error;
    }
    return response.json();
  } finally { clearTimeout(timer); }
}

function setStatus(message, tone = '') {
  const node = $('dossier-status'); node.textContent = message; node.dataset.tone = tone;
}

function renderContext() {
  const c = state.context;
  const summary = $('context-summary');
  summary.replaceChildren();
  const items = [
    ['Earth analogue', c?.earth?.name || 'Unavailable'],
    ['Planetary target', c?.target?.name || 'Unavailable'],
    ['Weather context', c?.telemetry?.live === true ? 'Current weather-model data' : c?.telemetry ? 'Archived or modelled weather data' : 'Unavailable'],
    ['Module 2 audit', c?.analogyAudit?.valid ? 'Automatic analogy audit included' : 'Unavailable'],
    ['Module 3 processes', c?.processes ? 'Processed 72-hour test-window analysis included' : 'Unavailable'],
    ['Module 4 hazards', 'Unavailable: no validated subsurface or hazard product'],
  ];
  for (const [label, value] of items) {
    const row = document.createElement('li');
    const strong = document.createElement('strong'); strong.textContent = label;
    row.append(strong, document.createTextNode(value)); summary.append(row);
  }
}

function discoveryGrid(candidate, generatedAt) {
  const place = candidate?.place || {};
  const location = [place.name, place.admin, place.country].filter(Boolean).join(', ');
  return {
    id: candidate.id,
    name: location ? `${candidate.name} · ${location}` : candidate.name,
    body: 'earth', center: candidate.center, elevation: candidate.elevation,
    gridSize: candidate.gridSize, spacingMeters: candidate.spacingMeters, extentMeters: candidate.extentMeters,
    nativeResolutionMeters: candidate.nativeResolutionMeters, dataset: candidate.dataset,
    source: candidate.provenance?.[0]?.url || null, fetchedAt: generatedAt || null,
    metrics: candidate.metrics, thermal: candidate.thermal || null, provenance: candidate.provenance || [],
    notes: [...(candidate.notes || []), 'Exploratory discovery candidate; not a published field-test site.'],
  };
}

async function loadDiscoveryScenarios() {
  const collections = await Promise.all(DISCOVERY_TARGETS.map((targetId) => fetchJSON(`assets/data/discovery/${targetId}.json`).catch(() => null)));
  return collections.flatMap((collection) => {
    const candidate = collection?.candidates?.[0];
    if (!candidate || !collection?.targetId || !collection?.target) return [];
    return [{
      id: `discovery-${collection.targetId}-${candidate.rank}`,
      title: `Discovery candidate · ${candidate.name}`,
      earthId: candidate.id, targetId: collection.targetId, body: collection.body,
      focus: `Exploratory geometric candidate for ${collection.targetId}; verify field suitability before use.`,
      target: collection.target, discovery: { candidate, generatedAt: collection.generatedAt },
    }];
  });
}

async function loadScenario(id) {
  state.scenario = state.scenarios.find((item) => item.id === id) || state.scenarios[0] || null;
  if (!state.scenario) { setStatus('No scenarios are available.', 'error'); return; }
  $('scenario-select').value = state.scenario.id;
  setStatus('Loading factual scenario context…');
  try {
    const [rawEarthGrid, targetGrid] = await Promise.all([
      state.scenario.discovery ? Promise.resolve(discoveryGrid(state.scenario.discovery.candidate, state.scenario.discovery.generatedAt)) : fetchJSON(state.scenario.earth),
      fetchJSON(state.scenario.target),
    ]);
    const earthGrid = rawEarthGrid;
    const [lat, lon] = Array.isArray(earthGrid.center) ? earthGrid.center : [];
    const query = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&site=${encodeURIComponent(state.scenario.earthId)}`;
    const [telemetry, forecast] = await Promise.all([
      fetchJSON(`/api/telemetry?${query}`).catch(() => null),
      fetchJSON(`/api/processes/forecast?${query}`).catch(() => null),
    ]);
    const scenario = { ...state.scenario, title: SCENARIO_LABELS[state.scenario.id] || state.scenario.title };
    const candidate = buildCandidateAnalogPayload({ scenario, earthGrid, targetGrid, telemetry });
    const analogyAudit = automaticEngineering(candidate).audit;
    const processes = forecast ? summarizeProcesses(analyzeProcesses(forecast, targetGrid)) : null;
    state.context = buildDossierContext({ scenario, earthGrid, targetGrid, telemetry, forecast, analogyAudit, processes });
    renderContext(); setStatus('Scenario context is ready. Module 2 and Module 3 analyses are included; Module 4 remains unavailable.', 'ready');
  } catch {
    state.context = buildDossierContext({ scenario: state.scenario }); renderContext();
    setStatus('Terrain context could not be loaded. The dossier cannot be generated safely.', 'error');
  }
}

function renderDossier() {
  $('dossier-output').textContent = state.dossier?.markdown || 'Generate a dossier to review it here.';
  $('download-markdown').disabled = !state.dossier;
  $('print-dossier').disabled = !state.dossier;
  $('dossier-meta').textContent = state.dossier
    ? `Generated ${new Date(state.dossier.generatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC · ${state.dossier.provider}${state.dossier.model ? ` · ${state.dossier.model}` : ''}` : '';
}

async function generate() {
  if (!state.context || state.busy) return;
  state.busy = true; $('generate-dossier').disabled = true;
  setStatus('Generating the AI dossier from supplied context…'); setGenerating(true, 'Sending supplied evidence to the AI provider…');
  try {
    state.dossier = await fetchJSON('/api/dossier', { method: 'POST', body: { context: state.context }, timeout: DOSSIER_TIMEOUT_MS });
    renderDossier(); setStatus(state.dossier.disclaimer, 'ready');
  } catch (error) {
    const messages = { 404: 'The server does not include the dossier endpoint. Restart the backend from this project and reload the page.', 413: 'The supplied context is too large to generate a dossier.', 429: 'Dossier generation is rate-limited. Please wait one minute.', 503: 'The AI provider could not be reached. Check the server logs and provider configuration.' };
    const isTimeout = error.name === 'AbortError';
    setStatus(isTimeout ? 'The AI provider did not respond within two minutes. Please try again.' : (messages[error.status] || `The dossier could not be generated (${error.code || error.message}).`), 'error');
  } finally { setGenerating(false); state.busy = false; $('generate-dossier').disabled = false; }
}

function downloadMarkdown() {
  if (!state.dossier) return;
  const blob = new Blob([state.dossier.markdown], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
  link.download = `selene-ops-mission-dossier-${state.scenario.id}.md`; link.click(); URL.revokeObjectURL(link.href);
}

async function initialize() {
  try {
    const data = await fetchJSON('assets/data/scenarios.json');
    const published = Array.isArray(data.scenarios) ? data.scenarios : [];
    const discovery = await loadDiscoveryScenarios();
    state.scenarios = [...published, ...discovery];
    const select = $('scenario-select');
    for (const scenario of state.scenarios) {
      const option = document.createElement('option'); option.value = scenario.id;
      option.textContent = SCENARIO_LABELS[scenario.id] || scenario.title;
      if (scenario.discovery) option.dataset.kind = 'discovery';
      select.append(option);
    }
    await loadScenario(new URLSearchParams(location.search).get('scenario') || state.scenarios[0]?.id);
  } catch { setStatus('Scenario catalogue is unavailable.', 'error'); }
  $('scenario-select').addEventListener('change', (event) => { state.dossier = null; renderDossier(); loadScenario(event.target.value); });
  $('generate-dossier').addEventListener('click', generate);
  $('download-markdown').addEventListener('click', downloadMarkdown);
  $('print-dossier').addEventListener('click', () => window.print());
  renderDossier();
}

initialize();
