import test from 'node:test';
import assert from 'node:assert/strict';
import { answerLocally, detectIntents, DISCLAIMER } from '../copilot-rules.mjs';
import { compareTerrain } from '../similarity.mjs';
import { thermalStatus } from '../sim-physics.mjs';

const M = { slopeP50Deg: 4.2, slopeP90Deg: 11.5, reliefP95P5M: 180, triMeanM: 2.4, comparable: true, roughness: null };
const ctx = {
  scenario: { id: 'hyperarid-salt', title: 'Planicie hiperárida y salina', focus: '…' },
  earth: { id: 'atacama', name: 'Atacama', metrics: M,
    telemetry: { provider: 'open-meteo', live: true, cached: false, ageSeconds: 0,
      values: { solarRadiationWm2: 850, temperatureC: 21.5, windSpeedMs: 6.2, windGustMs: 16.4, relativeHumidityPct: 8, cloudCoverPct: 0 } },
    thermal: null },
  target: { id: 'jezero', name: 'Cráter Jezero', body: 'mars', metrics: { ...M, slopeP90Deg: 9 },
    thermal: { kind: 'literature', minK: 180, maxK: 270, meanK: 215, curve: null, source: 'Mars 2020 MEDA (literatura)' },
    environment: { gravityMs2: 3.71, solarConstantWm2: 586, atmosphere: 'CO₂', dayLengthHours: 24.66 } },
  rover: { pitchDeg: 3.1, rollDeg: -1.2, batteryPct: 82, solarW: 476, slopeDeg: 3.4, thermal: thermalStatus({ ambientK: 294.65 }) },
};
ctx.similarity = compareTerrain(ctx.earth, ctx.target);

const shape = (r) => {
  assert.equal(r.provider, 'rules'); assert.equal(r.model, 'rules-v1');
  assert.equal(typeof r.answer, 'string'); assert.ok(r.answer.length > 20);
  assert.ok(Array.isArray(r.grounded));
  assert.ok(!Number.isNaN(Date.parse(r.generatedAt)));
  assert.equal(r.disclaimer, DISCLAIMER);
};

test('contexto vacío o ausente no lanza y declara qué falta', () => {
  for (const c of [undefined, null, {}, 'basura', { rover: null, earth: { telemetry: {} } }]) {
    for (const q of ['', '¿Riesgo térmico?', undefined, 'resumen']) {
      const r = answerLocally(q, c); shape(r);
      assert.deepEqual(r.grounded, []);
      assert.match(r.answer, /Sin datos suficientes|no disponibles|Sin datos/);
    }
  }
});

test('detección de intenciones en español e inglés (sin acentos)', () => {
  assert.deepEqual(detectIntents('¿Cuál es el riesgo TÉRMICO hoy?'), ['thermal']);
  assert.deepEqual(detectIntents('battery and solar power?'), ['energy']);
  assert.deepEqual(detectIntents('¿Hay riesgo de vuelco en esta pendiente?'), ['terrain']);
  assert.deepEqual(detectIntents('wind and dust storm'), ['wind']);
  assert.deepEqual(detectIntents('¿Qué tan parecido es a Jezero?'), ['similarity']);
  assert.deepEqual(detectIntents('Dame un resumen'), ['summary']);
  assert.deepEqual(detectIntents('hola'), ['summary']);
});

test('térmico: cita números y procedencia live / literature', () => {
  const r = answerLocally('¿Cuál es el riesgo de falla térmica si desplegamos hoy?', ctx); shape(r);
  assert.match(r.answer, /21,5 °C/);
  assert.match(r.answer, /en vivo · open-meteo/);
  assert.match(r.answer, /literatura/);
  assert.match(r.answer, /NOMINAL/);
  assert.ok(r.grounded.includes('earth.telemetry.values.temperatureC'));
  assert.ok(r.grounded.includes('target.thermal'));
});

test('snapshot se etiqueta como no en vivo', () => {
  const c = structuredClone(ctx); c.earth.telemetry.live = false; c.earth.telemetry.provider = 'snapshot';
  assert.match(answerLocally('temperature', c).answer, /snapshot guardado.*no en vivo/);
});

test('energía, viento, pendiente y similitud usan el contexto', () => {
  assert.match(answerLocally('battery', ctx).answer, /82 %/);
  const w = answerLocally('viento', ctx);
  assert.match(w.answer, /16,4 m\/s/); assert.match(w.answer, /GO con precauciones/);
  const s = answerLocally('slope rollover', ctx); assert.match(s.answer, /alabeo -1,2°/);
  const sim = answerLocally('similitud', ctx);
  assert.match(sim.answer, /similitud geométrica/); assert.doesNotMatch(sim.answer, /similitud planetaria:/);
});

test('NO-GO ante térmico crítico o vuelco', () => {
  const c = structuredClone(ctx); c.rover.thermal = thermalStatus({ ambientK: 40 });
  assert.match(answerLocally('estado general', c).answer, /NO-GO/);
  const t = structuredClone(ctx); t.rover.rollDeg = 30;
  assert.match(answerLocally('pendiente', t).answer, /NO-GO.*25°/);
});

test('resumen general cubre todas las secciones', () => {
  const r = answerLocally('resumen', ctx);
  for (const s of ['RIESGO TÉRMICO', 'ENERGÍA', 'PENDIENTE', 'VIENTO', 'SIMILITUD', 'RECOMENDACIÓN']) assert.match(r.answer, new RegExp(s));
});

test('resumen integrado conserva auditoría M2 y ventanas M3 con sus fuentes', () => {
  const context = structuredClone(ctx);
  context.analogyAudit = {
    matrix: [{ id: 'gravity', status: 'breakdown', breakdown: 'Gravedad diferente.' }],
    calibration: null,
  };
  context.processes = {
    live: false, provider: 'snapshot', timezone: 'America/Santiago', utcOffsetSeconds: -10800,
    best: { kind: 'thermal', start: '2026-11-14T20:00:00Z', end: '2026-11-14T23:00:00Z', hours: 3 },
  };
  const response = answerLocally('resumen', context);
  assert.match(response.answer, /RUPTURA DE ANALOGÍA/);
  assert.match(response.answer, /VENTANA DE PRUEBAS \(72 H\)/);
  assert.match(response.answer, /Gravedad diferente/);
  assert.match(response.answer, /archivado \(snapshot\)/);
  assert.ok(response.grounded.includes('analogyAudit'));
  assert.ok(response.grounded.includes('processes'));
});
