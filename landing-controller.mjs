// Mission lifecycle; SI physics lives exclusively in landing-physics.mjs.
import { getLandingProfile } from './landing-profiles.mjs';
import { evaluateLandingZones, createDescent, stepDescent, summarizeDescent, abortDescent } from './landing-physics.mjs';
import { sampleHeight, validGrid } from './mission-math.mjs';
export const FLIGHT_RATE = 4; // Legacy export; each configured session defaults to 1×.
const defaultOptions = () => ({ timeScale: 1, deploymentMode: 'manual' });
const terminal = new Set(['contact', 'hard-contact', 'aborted', 'unavailable']);
const clone = value => structuredClone(value);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
// Rows are immutable. This live, bounded array is readable without copying its past.
const readonlyHistory = history => new Proxy(history, {
  set() { throw new TypeError('Render history is read-only'); },
  deleteProperty() { throw new TypeError('Render history is read-only'); },
  defineProperty() { throw new TypeError('Render history is read-only'); },
  setPrototypeOf() { throw new TypeError('Render history is read-only'); },
  preventExtensions() { throw new TypeError('Render history is read-only'); },
});
export function createLandingController({ publish = () => {}, event = () => {}, deploy = () => {}, clock = () => new Date().toISOString() } = {}) {
  let config = null, profiles = null, plans = null, states = null, phase = 'ready', running = false;
  let payload = null, delay = 0, sampleClock = 0, deployed = false;
  let options = freeze(defaultOptions()), missionMode = 'target-first', primarySide = 'target';
  let earthOrigin = null;
  let revision = 0, planRevision = 0, historyRevision = 0, renderCache = null;
  let renderPlans = Object.freeze({});
  let historyView = readonlyHistory([]), summarySources = null, summaryCache = null, originSources = null, originCache = null;
  let projectionCache = null, scalarPoseCache = null, pathPoseCache = null;
  const summaryByState = new WeakMap();
  const touch = () => { revision++; renderCache = null; };
  const sides = () => missionMode === 'paired-legacy' ? ['earth', 'target'] : ['target'];
  function summary(state) {
    if (!state) return null;
    if (!summaryByState.has(state)) summaryByState.set(state, freeze(summarizeDescent(state)));
    return summaryByState.get(state);
  }
  function summaries() {
    if (summarySources !== states) {
      summarySources = states;
      summaryCache = null;
    }
    const earth = summary(states?.earth), target = summary(states?.target);
    if (!summaryCache || summaryCache.earth !== earth || summaryCache.target !== target) summaryCache = Object.freeze({ earth, target });
    return summaryCache;
  }
  function covered(grid, x, z) {
    if (!grid || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    const half = (grid.gridSize - 1) * grid.spacingMeters / 2;
    return Number.isFinite(half) && half > 0 && Math.abs(x) <= half && Math.abs(z) <= half;
  }
  function surfaceOrigin() {
    const grid = config?.earthGrid;
    if (!validGrid(grid) || grid.body !== 'earth' || typeof grid.id !== 'string' || !grid.id
      || grid.elevation.some(h => Math.abs(h) > 1e6)
      || Number.isFinite(grid.extentMeters) && Math.abs(grid.extentMeters - (grid.gridSize - 1) * grid.spacingMeters) > 0.01) return null;
    const elevationM = sampleHeight(grid, 0, 0);
    if (!Number.isFinite(elevationM)) return null;
    return { x: 0, z: 0, elevationM, gridId: grid.id, georeference: null, role: 'analogue-test-origin', kind: 'local-dem-center',
      reason: 'Centro del DEM terrestre sobre superficie: referencia local automática para el ensayo de conducción, sin homología científica automática ni aterrizaje terrestre. Georreferencia no disponible sin función de proyección compartida.' };
  }
  function contactOrigin(run, role) {
    if (run?.phase !== 'contact') return null;
    return { x: run.x, z: run.z, elevationM: run.groundElevationM, gridId: run.grid?.id ?? null, georeference: clone(run.georeference), role,
      kind: 'engine-contact', reason: 'Origen obtenido del contacto nominal real del motor SI.' };
  }
  function origins(runs = summaries()) {
    if (!originSources || originSources.runs !== runs || originSources.earth !== earthOrigin || originSources.mode !== missionMode) {
      originSources = { runs, earth: earthOrigin, mode: missionMode };
      originCache = freeze({ earth: missionMode === 'paired-legacy' ? contactOrigin(runs.earth, 'analogue-test-origin') : earthOrigin, target: contactOrigin(runs.target, 'target-contact') });
    }
    return originCache;
  }
  function mirrorAvailable(points = origins()) {
    return Boolean(points.earth && points.target && covered(config?.targetGrid, points.target.x, points.target.z));
  }
  const targetLabel = () => config?.body === 'mars' ? 'Marte' : config?.body === 'moon' ? 'Luna' : 'objetivo';
  const primaryLabel = () => primarySide === 'earth' ? 'Tierra' : targetLabel();
  function emit(type, detail) {
    // Observers may synchronously read renderState during a lifecycle transition.
    touch();
    const item = { utc: clock(), simSeconds: Math.max(...Object.values(summaries()).map(r => r?.simSeconds || 0)), type, detail };
    if (payload) { payload.events.push(item); if (payload.events.length > 300) payload.events.shift(); }
    event(type, detail);
  }
  function record(sample = false) {
    if (!payload) return;
    payload.phase = phase; payload.runs = summaries(); payload.timeScale = options.timeScale; payload.options = clone(options);
    payload.explorationOrigins = origins(payload.runs); payload.mirrorAvailable = mirrorAvailable(payload.explorationOrigins);
    if (sample) { payload.history.push(freeze({ utc: clock(), simSeconds: Math.max(payload.runs.earth?.simSeconds || 0, payload.runs.target?.simSeconds || 0), ...clone(payload.runs) })); if (payload.history.length > 1200) payload.history.shift(); historyRevision++; }
    touch();
    publish(clone(payload));
  }
  function configure(next) {
    missionMode = next.missionMode === 'paired-legacy' ? 'paired-legacy' : 'target-first';
    primarySide = missionMode === 'paired-legacy' ? 'earth' : 'target';
    config = next; profiles = freeze({ earth: getLandingProfile('earth'), target: getLandingProfile(next.body) });
    plans = freeze(Object.fromEntries(['earth', 'target'].map(key => [key, evaluateLandingZones(next[`${key}Grid`], { profile: profiles[key], sciencePoint: { x: 0, z: 0 } })])));
    renderPlans = Object.freeze(Object.fromEntries(Object.entries(plans).map(([key, plan]) => [key, plan.gridId ? plan : null])));
    earthOrigin = surfaceOrigin();
    states = null; payload = null; phase = 'ready'; running = false; deployed = false; delay = 0; sampleClock = 0;
    options = freeze(defaultOptions()); historyView = readonlyHistory([]); projectionCache = scalarPoseCache = pathPoseCache = null;
    planRevision++; historyRevision++; touch();
  }
  function setOptions(next) {
    if (!next || typeof next !== 'object' || Array.isArray(next) || Object.keys(next).some(key => !['timeScale', 'deploymentMode'].includes(key))) return false;
    if (Object.hasOwn(next, 'timeScale') && ![0.5, 1, 2, 4].includes(next.timeScale)) return false;
    if (Object.hasOwn(next, 'deploymentMode') && !['manual', 'automatic'].includes(next.deploymentMode)) return false;
    if (payload && Object.hasOwn(next, 'deploymentMode') && next.deploymentMode !== options.deploymentMode) return false;
    if ((!Object.hasOwn(next, 'timeScale') || next.timeScale === options.timeScale)
      && (!Object.hasOwn(next, 'deploymentMode') || next.deploymentMode === options.deploymentMode)) return true;
    const before = options.timeScale;
    options = freeze({ ...options, ...next }); touch();
    if (payload && before !== options.timeScale) {
      emit('time-scale-change', `Tiempo de descenso: ×${before} → ×${options.timeScale}; estado SI conservado.`);
      record();
    }
    return true;
  }
  function choose(key, id) {
    if (!plans || payload || !sides().includes(key)) return false;
    const zone = plans[key].zones.find(z => z.id === id);
    if (!zone || zone.status === 'unevaluable' || zone.eligible === false) return false;
    if (plans[key].selectedId === id) return true;
    plans = freeze({ ...plans, [key]: { ...plans[key], selectedId: id } }); planRevision++; touch();
    renderPlans = Object.freeze(Object.fromEntries(Object.entries(plans).map(([key, plan]) => [key, plan.gridId ? plan : null])));
    if (key === 'target') earthOrigin = surfaceOrigin();
    return true;
  }
  function start(missionId, { initial = null } = {}) {
    if (!config || !missionId) return false;
    const pairedInitial = initial && (Object.hasOwn(initial, 'earth') || Object.hasOwn(initial, 'target'));
    states = { earth: null, target: null };
    for (const key of sides()) states[key] = createDescent({ profile: profiles[key], grid: config[`${key}Grid`], zone: plans[key].zones.find(z => z.id === plans[key].selectedId) || null,
      ...(initial ? { initial: pairedInitial ? initial[key] || {} : initial } : {}) });
    phase = 'preparation'; running = true; deployed = false; delay = 0; sampleClock = 0;
    payload = { schema: 'LandingRunPayload', version: '1.0.0', missionId, landingId: `${missionId}-landing`, scenarioId: config.scenarioId, startedAtUTC: clock(), endedAtUTC: null,
      missionMode, primarySide, explorationOrigins: origins(), mirrorAvailable: mirrorAvailable(), phase, timeScale: options.timeScale, options: clone(options), profiles: clone(profiles),
      plans: Object.fromEntries(Object.entries(plans).map(([key,plan])=>[key,plan.gridId ? clone(plan) : null])), runs: summaries(), history: [], events: [],
      limitations: [...new Set([...Object.values(profiles).flatMap(p => p.limitations || []), ...Object.values(plans).flatMap(p => p.limitations || []),
        'Evaluación regional: DEM de 37,5 m no resuelve patas, rocas ni la geometría del pozo.',
        missionMode === 'target-first' ? 'Tierra es origen de ensayo de conducción sobre superficie; su perfil y plan son referencias de análisis, sin vuelo ni aterrizaje terrestre. El espejo relativo no implica homología científica automática.' : 'Tierra es una comparación virtual, no un ensayo físico; navegación idealizada sin TRN ni visión implementada.',
        'Relieve visual ×2; dinámica SI y altitud AGL sin exageración.'])] };
    historyView = readonlyHistory(payload.history); historyRevision++; projectionCache = scalarPoseCache = pathPoseCache = null; touch();
    if (initial) emit('initial-conditions', JSON.stringify(initial));
    emit('preparation', missionMode === 'target-first' ? `Preparación de descenso en ${targetLabel()}; análogo terrestre como referencia local de ensayo de conducción.` : 'Reconocimiento regional de ambos DEM; punto científico distinto del contacto propuesto.');
    record(true); return true;
  }
  function pause(value = !running, reason = 'operador') {
    if (!payload || running === value || !['preparation', 'descent', 'contact', 'deployment'].includes(phase) || phase === 'contact' && options.deploymentMode === 'manual') return false;
    running = value; emit(value ? 'resume' : 'pause', reason); record();
    return true;
  }
  function requestDeployment() {
    const runs = summaries();
    if (phase !== 'contact' || runs[primarySide]?.phase !== 'contact' || !sides().every(key => terminal.has(runs[key]?.phase)) || deployed) return false;
    phase = 'deployment'; running = true; delay = 0;
    emit('deployment-authorized', `Operador autoriza desplegar el rover desde el contacto nominal en ${primaryLabel()}.`); record();
    return true;
  }
  function abort(reason = 'Interrupción solicitada: ensayo detenido; no maniobra de escape.') {
    if (!states || ['exploration', 'aborted', 'hard-contact', 'unavailable'].includes(phase)) return;
    for (const key of sides()) if (!terminal.has(summary(states[key]).phase)) states[key] = abortDescent(states[key], reason);
    phase = 'aborted'; running = false; payload.endedAtUTC = clock(); emit('abort', reason); record(true);
  }
  function step(realDt) {
    if (!payload || !running || phase === 'exploration' || !Number.isFinite(realDt) || realDt <= 0) return;
    // Account for slow GPU frames; the common engine still integrates at <=0.05 SI s.
    const dt = Math.min(realDt, 1); sampleClock += dt;
    touch();
    if (phase === 'preparation') {
      delay += dt;
      if (delay >= 1.6) { phase = 'descent'; delay = 0; emit('descent-start', `Descenso propulsado final idealizado en ${primaryLabel()} · tiempo ×${options.timeScale}.`); }
    } else if (phase === 'descent') {
      for (const key of sides()) {
        const before = summary(states[key]);
        if (!terminal.has(before.phase)) { states[key] = stepDescent(states[key], dt * options.timeScale, { running: true }); touch(); }
        const after = summary(states[key]);
        if (after.phase !== before.phase && terminal.has(after.phase)) emit(`${key}-${after.phase}`, `${key === 'target' ? targetLabel() : 'Tierra'}: ${after.outcome?.label || after.outcome?.code || after.phase}`);
      }
      const runs = summaries();
      if (sides().every(key => terminal.has(runs[key]?.phase))) {
        if (runs[primarySide].phase === 'contact') {
          phase = 'contact'; delay = 0; emit('contact', `Contacto en ${primaryLabel()} dentro de tolerancias del modelo.`);
          if (options.deploymentMode === 'manual') {
            running = false; emit('deployment-waiting', `Rover en ${primaryLabel()} retenido a la espera de autorización del operador.`);
          }
          record(true); return;
        }
        else { phase = runs[primarySide].phase; running = false; payload.endedAtUTC = clock(); emit('rover-held', `Rover bloqueado: el descenso en ${primaryLabel()} no obtuvo contacto nominal.`); record(true); }
      }
    } else if (phase === 'contact' || phase === 'deployment') {
      if (phase === 'contact' && options.deploymentMode === 'manual') return;
      if (phase === 'deployment' && delay === 0) emit('deployment', `Desplegando rover de 350 kg desde contacto en ${primaryLabel()}; nave y rover tienen perfiles separados.`);
      delay += dt;
      if (phase === 'contact' && delay >= 0.8) { phase = 'deployment'; delay = 0; }
      if (phase === 'deployment' && delay >= 1.2) {
        phase = 'exploration'; payload.endedAtUTC = clock();
        if (!deployed) { deployed = true; touch(); deploy(clone(summaries())); emit('exploration', `Rover liberado en ${primaryLabel()}. El ensayo terrestre se refleja por desplazamiento relativo solo con ambos orígenes disponibles.`); record(true); }
      }
    }
    if (sampleClock >= 0.25) { sampleClock %= 0.25; record(phase !== 'exploration'); }
  }
  function projection(rover, includePath, pathRevision) {
    const points = origins();
    if (!deployed || !mirrorAvailable(points) || !rover || !Number.isFinite(rover.x) || !Number.isFinite(rover.z)) return null;
    const dx = points.target.x - points.earth.x, dz = points.target.z - points.earth.z;
    const x = rover.x + dx, z = rover.z + dz;
    if (!covered(config.targetGrid, x, z) || rover.path !== undefined && !Array.isArray(rover.path)) return null;
    if (!includePath) return { x, z };
    const source = rover.path;
    let cached = projectionCache;
    const sameSource = cached && cached.source === source && cached.dx === dx && cached.dz === dz;
    const versioned = pathRevision !== undefined;
    // A supplied revision is a caller contract: change it for every path mutation.
    // Without one, check coordinates, including in-place edits and capped shifts.
    let unchanged = sameSource && cached.versioned === versioned && (!versioned || Object.is(cached.pathRevision, pathRevision));
    if (!versioned && unchanged) {
      unchanged = cached.coordinates.length === (source?.length || 0);
      for (let i = 0; unchanged && i < (source?.length || 0); i++) {
        const point = source[i], previous = cached.coordinates[i];
        unchanged = Array.isArray(point) && point[0] === previous[0] && point[1] === previous[1];
      }
    }
    if (!unchanged) {
      const coordinates = [], path = [];
      for (const point of source || []) {
        if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
        const px = point[0] + dx, pz = point[1] + dz;
        if (!covered(config.targetGrid, px, pz)) return null;
        coordinates.push([point[0], point[1]]); path.push(Object.freeze([px, pz]));
      }
      cached = projectionCache = { source, dx, dz, coordinates, path: Object.freeze(path), versioned, pathRevision };
    }
    return { x, z, path: cached.path };
  }
  // Persistent public API: independent nested extras and path on every call.
  function targetPose(rover) {
    const pose = projection(rover, true);
    if (!pose) return null;
    const { path, ...rest } = rover;
    return { ...clone(rest), ...pose, path: pose.path.map(point => [...point]) };
  }
  // Scalar render pose never inspects route entries or copies arbitrary nested data.
  // includePath opts into the validated readonly route; pathRevision avoids rescans.
  function renderTargetPose(rover, { includePath = false, pathRevision } = {}) {
    const pose = projection(rover, includePath, pathRevision);
    if (!pose) return null;
    const scalars = {};
    for (const key of Object.keys(rover)) {
      if (key !== 'path' && (rover[key] === null || typeof rover[key] !== 'object')) scalars[key] = rover[key];
    }
    const next = { ...scalars, ...pose }, cached = includePath ? pathPoseCache : scalarPoseCache;
    const keys = Object.keys(next);
    if (cached && keys.length === Object.keys(cached).length && keys.every(key => Object.hasOwn(cached, key) && Object.is(next[key], cached[key]))) return cached;
    const result = Object.freeze(next);
    if (includePath) pathPoseCache = result; else scalarPoseCache = result;
    return result;
  }
  // Immutable frame values with a live readonly history. Export with snapshot/inspect.
  // Cache construction is independent of history length; revisions are monotonic.
  function renderState() {
    if (!renderCache) {
      const runs = summaries(), explorationOrigins = origins(runs);
      renderCache = Object.freeze({ phase, running, deployed, missionMode, primarySide, explorationOrigins,
        mirrorAvailable: mirrorAvailable(explorationOrigins), options, profiles,
        plans: renderPlans,
        runs, history: historyView, active: Boolean(payload), revision, planRevision, historyRevision });
    }
    return renderCache;
  }
  function inspect() {
    const runs = summaries(), explorationOrigins = origins(runs);
    return clone({ phase, running, deployed, missionMode, primarySide, explorationOrigins, mirrorAvailable: mirrorAvailable(explorationOrigins), options, profiles,
      plans: Object.fromEntries(Object.entries(plans || {}).map(([key,plan])=>[key,plan.gridId ? plan : null])), runs, history: payload?.history || [], active: Boolean(payload) });
  }
  return { configure, setOptions, choose, start, pause, requestDeployment, abort, step, targetPose, renderTargetPose, renderState, record,
    view: inspect, inspect, snapshot: () => clone(payload),
    get mirrorAvailable() { return mirrorAvailable(); }, get options() { return options; },
    get roverAllowed() { return deployed; }, get active() { return Boolean(payload); }, get phase() { return phase; }, get running() { return running; },
  };
}
