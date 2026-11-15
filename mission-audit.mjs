// Captura por misión en memoria. No red, DOM ni reloj SIM implícito.
import { ROVER_CONFIG } from './rover-config.mjs';
import { auditAnalog } from './analog-audit.mjs';
export const RECORD_POLICY = Object.freeze({ roverIntervalMs: 10000, maxRover: 2160, maxWeather: 256, maxEvents: 500, maxSessions: 6, weatherRefreshMs: 600000,
  retention: 'Memoria: 6 sesiones; 2160 muestras rover (6 h a 10 s), 256 observaciones clima, 500 eventos por sesión. Recargar borra todo; reiniciar/cambiar misión cierra sesión.' });
const missing = 'Sin dato: no hay fuente/configuración de misión';
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
    begin(scenario, reason = 'scenario-selected') { close(reason); current = { id: id(), scenario: structuredClone(scenario), startedAt: new Date(now()).toISOString(), endedAt: null, rover: [], weather: [], events: [], latest: null, policy: RECORD_POLICY }; sessions.push(current); if (sessions.length > RECORD_POLICY.maxSessions) sessions.shift(); weatherKeys = new Set(); lastSample = -Infinity; event('session-start', reason); return current; },
    event, close,
    sample(rover, extra = {}, force = false) { if (!current || current.endedAt) return; const sample = { utc: new Date(now()).toISOString(), ...structuredClone(extra), ...Object.fromEntries(['x','z','heading','speed','distance','battery','elapsed'].map(k => [k, Number.isFinite(rover?.[k]) ? rover[k] : null])), kind: 'sim' }; current.latest = sample;
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
