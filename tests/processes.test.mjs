import test from 'node:test';
import assert from 'node:assert/strict';
import {
  frictionVelocity, windThreshold, saltationState, solarHour, makeCurve, thermalScores, freezeEvents,
  findWindows, analyzeProcesses, summarizeProcesses, SALTATION_DEFAULTS,
} from '../processes.mjs';

const hourAt = (i, extra = {}) => ({ time: new Date(Date.UTC(2026, 10, 15, 0) + i * 3600e3).toISOString().replace('.000', ''), ...extra });

test('u* por perfil logarítmico y umbral de viento coherente', () => {
  const u = frictionVelocity(10);
  assert.ok(Math.abs(u - 0.4 * 10 / Math.log(10 / 5e-4)) < 1e-12);
  assert.equal(frictionVelocity(null), null);
  assert.equal(frictionVelocity(-1), null);
  const w = windThreshold();
  assert.ok(Math.abs(frictionVelocity(w) - SALTATION_DEFAULTS.uStarThreshold) < 1e-9);
  assert.ok(w > 5 && w < 6, `umbral ~5,4 m/s, fue ${w}`);
});

test('saltación: sostenida, intermitente, inhibida por humedad, nula y desconocida', () => {
  assert.equal(saltationState({ windMs: 8, gustMs: 12, rhPct: 20 }).level, 'sustained');
  assert.equal(saltationState({ windMs: 3, gustMs: 9, rhPct: 20 }).level, 'intermittent');
  assert.equal(saltationState({ windMs: 8, gustMs: 12, rhPct: 80 }).level, 'suppressed');
  assert.equal(saltationState({ windMs: 8, gustMs: 12, precipMm: 1 }).level, 'suppressed');
  assert.equal(saltationState({ windMs: 8 }, { recentPrecipMm: 5 }).level, 'suppressed');
  assert.equal(saltationState({ windMs: 2, gustMs: 3 }).level, 'none');
  assert.equal(saltationState({}).level, 'unknown');
});

test('hora solar por longitud', () => {
  assert.equal(solarHour('2026-11-15T12:00:00Z', 0), 12);
  assert.equal(solarHour('2026-11-15T12:00:00Z', -90), 6);
  assert.equal(solarHour('2026-11-15T23:00:00Z', 45), 2);
  assert.equal(solarHour('nope', 0), null);
});

test('curva cíclica: interpola, normaliza y envuelve medianoche', () => {
  const pts = Array.from({ length: 24 }, (_, h) => ({ hourLocal: h, tempK: 200 + 100 * Math.max(0, Math.sin((h - 6) / 12 * Math.PI)) }));
  const c = makeCurve(pts);
  assert.equal(c.min, 200); assert.equal(c.max, 300);
  assert.ok(Math.abs(c.norm(12) - 1) < 1e-9);
  assert.ok(c.rate(9) > 0 && c.rate(15) < 0, 'calienta de mañana y enfría de tarde');
  assert.ok(Number.isFinite(c.at(23.5)));
  assert.equal(makeCurve([{ hourLocal: 0, tempK: 1 }]), null);
  assert.equal(makeCurve(null), null);
});

test('ventana térmica: una Tierra con la misma forma que el objetivo puntúa alto y en fase', () => {
  const shape = (h) => Math.max(0, Math.sin((h - 6) / 12 * Math.PI));
  const curve = makeCurve(Array.from({ length: 24 }, (_, h) => ({ hourLocal: h, tempK: 150 + 240 * shape(h) })));
  const hours = Array.from({ length: 48 }, (_, i) => hourAt(i, { groundTempC: 5 + 30 * shape(i % 24) }));
  const s = thermalScores(hours, curve, 0);
  const mid = s.slice(13, 36).filter(Boolean);
  assert.ok(mid.length > 10);
  assert.ok(mid.every((x) => x.score >= 75), `scores ${mid.map((x) => x.score)}`);
  const shifted = Array.from({ length: 48 }, (_, i) => hourAt(i, { groundTempC: 5 + 30 * shape((i + 12) % 24) }));
  const bad = thermalScores(shifted, curve, 0).slice(13, 36).filter(Boolean);
  assert.ok(bad.reduce((a, x) => a + x.score, 0) / bad.length < 50, 'desfasada 12 h puntúa bajo');
});

test('sin ciclo diurno o sin curva no hay puntuación', () => {
  const curve = makeCurve(Array.from({ length: 24 }, (_, h) => ({ hourLocal: h, tempK: 200 + h })));
  const flat = Array.from({ length: 30 }, (_, i) => hourAt(i, { groundTempC: 10 }));
  assert.ok(thermalScores(flat, curve, 0).every((x) => x === null));
  assert.ok(thermalScores(flat, null, 0).every((x) => x === null));
});

test('congelamiento: cruces de 0 °C, rapidez y ciclos', () => {
  const temps = [4, 2, 0.5, -1, -3, -4, -2, 1, 3, 1, -0.5];
  const hours = temps.map((t, i) => hourAt(i, { groundTempC: t, radiationWm2: 0 }));
  const { events, cycles } = freezeEvents(hours);
  assert.deepEqual(events.map((e) => e.kind), ['freeze', 'thaw', 'freeze']);
  assert.equal(events[0].index, 3);
  assert.equal(events[0].rapid, true, `tasa ${events[0].rateCph}`);
  assert.equal(cycles, 1);
});

test('findWindows agrupa horas consecutivas con duración mínima', () => {
  const hours = [0, 1, 1, 1, 0, 1, 0, 1, 1].map((v, i) => hourAt(i, { v }));
  const w = findWindows(hours, (h) => h.v === 1, { minHours: 2 });
  assert.deepEqual(w.map((x) => [x.startIndex, x.endIndex]), [[1, 3], [7, 8]]);
});

test('analyzeProcesses: Marte prioriza ventana térmica; resumen para el copiloto', () => {
  const shape = (h) => Math.max(0, Math.sin((h - 6) / 12 * Math.PI));
  const target = { body: 'mars', thermal: { kind: 'model', source: 'MCD', minK: 190, maxK: 290,
    curve: Array.from({ length: 24 }, (_, h) => ({ hourLocal: h, tempK: 190 + 100 * shape(h) })) } };
  const hours = Array.from({ length: 72 }, (_, i) => hourAt(i, { groundTempC: 5 + 30 * shape(i % 24), tempC: 10, windMs: i % 24 === 15 || i % 24 === 16 ? 9 : 2, gustMs: 4, rhPct: 20, precipMm: 0, radiationWm2: 0 }));
  const forecast = { lon: 0, provider: 'open-meteo', live: true, hours, timezone: 'GMT', utcOffsetSeconds: 0, source: { label: 'x', url: 'https://x' } };
  const a = analyzeProcesses(forecast, target, { nowMs: Date.parse(hours[0].time) });
  assert.equal(a.body, 'mars');
  assert.ok(a.windows.thermal.length >= 1);
  assert.equal(a.best.kind, 'thermal');
  assert.ok(a.windows.aeolian.length >= 1 && a.windows.aeolian[0].sustainedHours === 2);
  assert.ok(a.caveats.some((c) => /tormentas de polvo/.test(c)));
  const s = summarizeProcesses(a);
  assert.equal(s.best.kind, 'thermal');
  assert.equal(s.live, true);
});

test('analyzeProcesses: objetivo sin curva (Shackleton) y pronóstico vacío no lanzan', () => {
  const temps = [3, 1, -1, -3, -5, -2, 1, 2];
  const hours = temps.map((t, i) => hourAt(i, { groundTempC: t, radiationWm2: 0, windMs: 1, gustMs: 2 }));
  const a = analyzeProcesses({ lon: 160, hours }, { body: 'moon', thermal: { kind: 'diviner', curve: null } });
  assert.equal(a.targetCurve.available, false);
  assert.equal(a.best?.kind, 'freeze');
  assert.ok(a.caveats.some((c) => /no tiene curva diurna/.test(c)));
  const empty = analyzeProcesses(null, null);
  assert.equal(empty.hours.length, 0);
  assert.equal(empty.best, null);
  assert.equal(summarizeProcesses(null), null);
});

test('copiloto local: intención «ventana» usa el resumen de procesos', async () => {
  const { answerLocally, detectIntents } = await import('../copilot-rules.mjs');
  assert.ok(detectIntents('¿Cuándo conviene probar el rover en las próximas 72 h?').includes('window'));
  const ctx = { scenario: { title: 'X' }, processes: { provider: 'open-meteo', live: true, timezone: 'GMT', utcOffsetSeconds: 0,
    best: { kind: 'thermal', start: '2026-11-15T10:00:00Z', end: '2026-11-15T13:00:00Z', hours: 4, score: 91, phase: 'calentamiento' },
    thermalWindows: [], aeolianWindows: [], freezeEvents: 0, freezeThawCycles: 0, currentSaltation: 'intermittent', caveats: ['a', 'b'] } };
  const out = answerLocally('¿Cuál es la ventana de pruebas?', ctx);
  assert.match(out.answer, /dom 15 10:00 → dom 15 13:00/);
  assert.match(out.answer, /91\/100/);
  assert.ok(out.grounded.includes('processes'));
  const none = answerLocally('¿Cuál es la ventana de pruebas?', {});
  assert.match(none.answer, /Sin pronóstico de 72 h/);
});

test('objetivo lunar sin curva y sin cruces de 0 °C propone la ventana fría', () => {
  const temps = [-12, -14, -18, -22, -24, -25, -23, -19, -15, -12, -11, -12];
  const hours = temps.map((t, i) => hourAt(i, { groundTempC: t, radiationWm2: i >= 9 ? 300 : 0 }));
  const a = analyzeProcesses({ lon: 160, hours }, { body: 'moon', thermal: { kind: 'diviner', curve: null } });
  assert.equal(a.windows.freeze.length, 0);
  assert.equal(a.best.kind, 'cold');
  assert.equal(a.best.minC, -25);
});
