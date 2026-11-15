import { buildDossierContext } from './dossier-context.mjs';
import { buildCandidateAnalogPayload } from '../audit/analog-audit.mjs';
import { automaticEngineering } from '../audit/mission-audit.mjs';
import { analyzeProcesses, summarizeProcesses } from '../processes/processes.mjs';
import { createDossierSession, dossierModuleAvailability } from './dossier-session.mjs';

const $ = (id) => document.getElementById(id);
const state = { scenarios: [] };
const SCENARIO_LABELS = {
  'lava-tube': 'Volcanic lava tube',
  'polar-shadow': 'Permanently shadowed polar crater',
  'hyperarid-salt': 'Hyperarid salt plain',
  'wind-canyon': 'Aeolian erosion canyon',
};
const DISCOVERY_TARGETS = ['marius-hills', 'shackleton', 'jezero', 'valles-marineris'];
// The primary and fallback models each get one request with a 60 s provider timeout.
const DOSSIER_TIMEOUT_MS = 130_000;
let generationTimer = null;
const session = createDossierSession({
  loadContext: loadScenarioContext,
  generateDossier: (context, { signal, userNotes }) => fetchJSON('/api/dossier', {
    method: 'POST', body: { context, userNotes }, timeout: DOSSIER_TIMEOUT_MS, signal,
  }),
  onChange: renderSession,
});

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
    if (seconds >= 60) $('generation-message').textContent = 'The provider is still working; it may be trying the fallback model…';
  };
  updateElapsed(); generationTimer = setInterval(updateElapsed, 1_000);
}

async function fetchJSON(url, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
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
    return await response.json();
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}

function setStatus(message, tone = '') {
  const node = $('dossier-status'); node.textContent = message; node.dataset.tone = tone;
}

function renderContext(c) {
  const included = dossierModuleAvailability(c);
  const summary = $('context-summary');
  summary.replaceChildren();
  const items = [
    ['Earth analogue', c?.earth?.name || 'Unavailable'],
    ['Planetary target', c?.target?.name || 'Unavailable'],
    ['Weather context', c?.telemetry?.live === true ? 'Current weather-model data' : c?.telemetry ? 'Archived or modelled weather data' : 'Unavailable'],
    ['Module 2 audit', included.audit ? 'Automatic analogy audit included' : 'Unavailable'],
    ['Module 3 processes', included.processes ? 'Processed test-window analysis included' : 'Unavailable'],
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
  const selected = state.scenarios.find((item) => item.id === id) || state.scenarios[0] || null;
  if (selected) $('scenario-select').value = selected.id;
  return session.select(selected);
}

async function loadScenarioContext(selected, { signal }) {
  const scenario = { ...selected, title: SCENARIO_LABELS[selected.id] || selected.title };
  const [earthGrid, targetGrid] = await Promise.all([
    scenario.discovery ? Promise.resolve(discoveryGrid(scenario.discovery.candidate, scenario.discovery.generatedAt)) : fetchJSON(scenario.earth, { signal }),
    fetchJSON(scenario.target, { signal }),
  ]);
  signal.throwIfAborted();
  const [lat, lon] = Array.isArray(earthGrid?.center) ? earthGrid.center : [];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Earth terrain coordinates are unavailable.');
  const query = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&site=${encodeURIComponent(scenario.earthId)}`;
  const [telemetry, forecast] = await Promise.all([
    fetchJSON(`/api/telemetry?${query}`, { signal }).catch(() => null),
    fetchJSON(`/api/processes/forecast?${query}`, { signal }).catch(() => null),
  ]);
  signal.throwIfAborted();
  const candidate = buildCandidateAnalogPayload({ scenario, earthGrid, targetGrid, telemetry });
  const analogyAudit = automaticEngineering(candidate).audit;
  if (!analogyAudit.valid) throw new Error('Terrain evidence is invalid for the selected analogue pair.');
  // Optional process data cannot make an otherwise valid terrain context unavailable.
  let processes = null;
  if (Array.isArray(forecast?.hours) && forecast.hours.some(hour => typeof hour?.time === 'string')) {
    try { processes = summarizeProcesses(analyzeProcesses(forecast, targetGrid)); } catch { /* unavailable optional analysis */ }
  }
  return buildDossierContext({ scenario, earthGrid, targetGrid, telemetry, forecast, analogyAudit, processes });
}

function renderDossier(dossier) {
  $('dossier-output').textContent = dossier?.markdown || 'Generate a dossier to review it here.';
  $('download-markdown').disabled = !dossier;
  $('print-dossier').disabled = !dossier;
  $('dossier-meta').textContent = dossier
    ? `Generated ${new Date(dossier.generatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC · ${dossier.provider}${dossier.model ? ` · ${dossier.model}` : ''}` : '';
}

function renderSession(view) {
  $('generate-dossier').disabled = !view.context || view.loading || view.busy;
  renderContext(view.context); renderDossier(view.dossier);
  setGenerating(view.busy, 'Sending supplied evidence to the AI provider…');
  if (view.loading) setStatus('Loading factual scenario context…');
  else if (view.busy) setStatus('Generating the AI dossier from supplied context…');
  else if (view.errorStage === 'load') setStatus('Terrain context could not be loaded. The dossier cannot be generated safely.', 'error');
  else if (view.errorStage === 'generate') {
    const error = view.error;
    const messages = { 404: 'The server does not include the dossier endpoint. Restart the backend from this project and reload the page.', 422: 'Check that your additional comments are within the 4,000-character limit.', 429: 'Dossier generation is rate-limited. Please wait one minute.', 503: 'The AI provider could not be reached. Check the server logs and provider configuration.' };
    const isTimeout = error.name === 'AbortError';
    setStatus(isTimeout ? 'The AI provider did not respond in time. Please try again.' : (messages[error.status] || `The dossier could not be generated (${error.code || error.message}).`), 'error');
  } else if (view.dossier) setStatus(view.dossier.disclaimer, 'ready');
  else if (view.context) {
    const included = dossierModuleAvailability(view.context);
    setStatus(`Scenario context is ready. Module 2 audit: ${included.audit ? 'included' : 'unavailable'}. Module 3 processes: ${included.processes ? 'included' : 'unavailable'}. Module 4 remains unavailable.`, 'ready');
  } else if (!view.scenario) setStatus('No scenarios are available.', 'error');
}

function downloadMarkdown() {
  const dossier = session.state.dossier;
  if (!dossier) return;
  const blob = new Blob([dossier.markdown], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
  link.download = `selene-ops-mission-dossier-${dossier.scenarioId}.md`; link.click(); URL.revokeObjectURL(link.href);
}

async function initialize() {
  renderSession(session.state);
  setStatus('Loading scenario catalogue…');
  $('scenario-select').addEventListener('change', (event) => loadScenario(event.target.value));
  $('generate-dossier').addEventListener('click', () => session.generate($('dossier-user-notes').value.trim()));
  $('download-markdown').addEventListener('click', downloadMarkdown);
  $('print-dossier').addEventListener('click', () => window.print());
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
}

initialize();
