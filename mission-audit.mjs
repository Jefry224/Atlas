// Captura por misión en memoria. No red, DOM ni reloj SIM implícito.
import { captureLanding } from './landing-report.mjs';
import { ROVER_CONFIG } from './rover-config.mjs';
import { auditAnalog, calibrateEngineering } from './analog-audit.mjs';
import { getMissionBaseProfile } from './mission-profiles.mjs';
export const RECORD_POLICY = Object.freeze({ roverIntervalMs: 10000, maxRover: 2160, maxWeather: 256, maxEvents: 500, maxSessions: 6, weatherRefreshMs: 600000,
  retention: 'Memory: 6 sessions; 2160 rover samples (6 h at 10 s), 256 weather observations, 500 events per session. Reloading clears everything; resetting/changing mission closes the session.' });
const missing = 'No data: no mission source/configuration';
export function automaticEngineering(candidate) {
  const q = (value, unit, kind, source, observedAt = null) => ({ value: Number.isFinite(value) ? value : null, unit, kind: Number.isFinite(value) ? kind : 'missing', source: source || missing, observedAt });
  const e = candidate.earth, t = candidate.target;
  const inputs = { equipment: 'rover', targetBody: t.body, massKg: ROVER_CONFIG.massKg, earthGravityMs2: e.gravity.value, targetGravityMs2: t.gravity.value,
    earthPressurePa: e.pressure.value, targetPressurePa: t.pressure.value, airK: e.airTemperature.value,
    areaM2: null, surfaceK: null, surroundingsK: null, hWm2K: null, emissivity: null };
  const origins = { massKg: q(inputs.massKg, 'kg', 'mission-config', ROVER_CONFIG.source),
    earthGravityMs2: e.gravity, targetGravityMs2: t.gravity, earthPressurePa: e.pressure, targetPressurePa: t.pressure, airK: e.airTemperature };
  for (const [key, unit] of Object.entries({ areaM2: 'm²', surfaceK: 'K', surroundingsK: 'K', hWm2K: 'W/m²/K', emissivity: '1' })) origins[key] = q(null, unit, 'missing', missing);
  const audit = auditAnalog(candidate, inputs);
  if (audit.calibration) Object.assign(audit.calibration, { kind: 'mission-config', origins, configuration: ROVER_CONFIG });
  return { inputs, origins, audit };
}
// Proposed bench model remains separate from automatic observations and recorder.
export function missionDesignEngineering(candidate, profile = getMissionBaseProfile(candidate.scenario)) {
  const thermal = Object.fromEntries(Object.entries(profile.thermal).map(([key, q]) => [key, q.value]));
  const inputs = { equipment: 'rover', targetBody: candidate.target.body, massKg: ROVER_CONFIG.massKg,
    earthGravityMs2: candidate.earth.gravity.value, targetGravityMs2: candidate.target.gravity.value,
    ...thermal, airK: thermal.surroundingsK };
  return { profile, calibration: calibrateEngineering(inputs),
    scope: 'Bench design baseline; gas at T_surroundings as an explicit setpoint. It does not represent the planetary environment or a reading.',
    airSource: 'Test gas setpoint = profile surroundingsK; bench hypothesis, not observed air temperature.' };
}
export function weatherState(t, now = Date.now()) {
  if (!t) return 'unknown';
  const observed = Date.parse(t.observedAt), age = (now - observed) / 1000;
  if (t.provider === 'snapshot') return 'archive';
  if (t.live === true && Number.isFinite(age) && age >= -300 && age <= 1800) return t.cached ? 'model/cache' : 'model/current';
  return t.cached ? 'model/cache-stale' : 'archive/model';
}
export function createMissionRecorder({ now = () => Date.now(), id = () => globalThis.crypto?.randomUUID?.() || `m2-${Date.now()}-${Math.random().toString(16).slice(2)}` } = {}) {
  let current = null; const sessions = []; let weatherKeys = new Set(), lastSample = -Infinity;
  const event = (type, detail) => { if (!current) return; current.events.push({ utc: new Date(now()).toISOString(), elapsedSIM: current.latest?.elapsed ?? 0, type, detail }); if (current.events.length > RECORD_POLICY.maxEvents) current.events.shift(); };
  const close = reason => { if (current && !current.endedAt) { event('session-end', reason); current.endedAt = new Date(now()).toISOString(); } };
  return {
    begin(scenario, reason = 'scenario-selected') { close(reason); current = { id: id(), scenario: structuredClone(scenario), startedAt: new Date(now()).toISOString(), endedAt: null, rover: [], weather: [], events: [], latest: null, landing: null, policy: RECORD_POLICY }; sessions.push(current); if (sessions.length > RECORD_POLICY.maxSessions) sessions.shift(); weatherKeys = new Set(); lastSample = -Infinity; event('session-start', reason); return current; },
    event, close,
    landing(payload) {
      if (!current || current.endedAt) return { valid:false, errors:['No active session for descent'] };
      const result = captureLanding(payload, {missionId:current.id, scenarioId:current.scenario.id, body:current.scenario.body, earthId:current.scenario.earthId, targetId:current.scenario.targetId, startedAt:current.startedAt, previous:current.landing});
      if (result.valid) current.landing = result.value;
      return {valid:result.valid, errors:result.errors};
    },
    sample(rover, extra = {}, force = false) { if (!current || current.endedAt) return; const sample = { utc: new Date(now()).toISOString(), ...structuredClone(extra), ...Object.fromEntries(['x','z','heading','speed','distance','battery','elapsed'].map(k => [k, Number.isFinite(rover?.[k]) ? rover[k] : null])), kind: 'sim', body: 'earth', role: 'analogue-test-rover', gridId: current.scenario.earthId }; current.latest = sample;
      if (force || now() - lastSample >= RECORD_POLICY.roverIntervalMs) { current.rover.push(sample); if (current.rover.length > RECORD_POLICY.maxRover) current.rover.shift(); lastSample = now(); } },
    weather(t) { if (!current || current.endedAt || !t || t.site !== current.scenario.earthId) return false;
      const key = `${t.site}|${t.provider}|${t.observedAt || 'undated'}`;
      const state = weatherState(t, now()); if (current.weatherState !== state) { event('weather-source', state); current.weatherState = state; }
      if (weatherKeys.has(key)) return false; weatherKeys.add(key); current.weather.push({ capturedAt: new Date(now()).toISOString(), state, ...structuredClone(t) });
      if (current.weather.length > RECORD_POLICY.maxWeather) { const old = current.weather.shift(); weatherKeys.delete(`${old.site}|${old.provider}|${old.observedAt || 'undated'}`); } return true;
    },
    snapshot() { return structuredClone(current); }, previous() { return structuredClone(sessions.filter(s => s !== current)); },
    get current() { return current; }
  };
}
