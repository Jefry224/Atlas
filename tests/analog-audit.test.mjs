import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCandidateAnalogPayload, validateCandidateAnalogPayload, calibrateEngineering, auditAnalog,
  createDossier, dossierMarkdown, referencePressure, CONTRACT_VERSION } from '../analog-audit.mjs';
import { compareTerrain } from '../similarity.mjs';
import { answerLocally } from '../copilot-rules.mjs';
const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url)));
const scenarios = read('assets/data/scenarios.json').scenarios;
const snapshot = read('assets/data/telemetry-snapshot.json');
const fixtures = scenarios.map(scenario => ({ scenario, earthGrid: read(scenario.earth), targetGrid: read(scenario.target), telemetry: snapshot[scenario.earthId] }));
const payload = (i = 0) => buildCandidateAnalogPayload(fixtures[i]);
const near = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
const calc = (g, more = {}) => calibrateEngineering({ massKg: 100, earthGravityMs2: 9.81, targetGravityMs2: g, ...more });

test('Luna: masa constante, fuerza en N, razón y descarga vertical correctas', () => {
  const c = calc(1.62);
  assert.equal(c.valid, true); assert.equal(c.inputs.massKg, 100);
  near(c.gravity.earthWeightN, 981); near(c.gravity.targetWeightN, 162);
  near(c.gravity.offloadForceN, 819); near(c.gravity.targetToEarthRatio, 1.62 / 9.81);
  near(c.gravity.equivalentEarthMassKg * 9.81, 162);
  assert.match(c.limitations.join(' '), /inertia.*dynamics.*terramechanics/);
});

test('Marte y Tierra: cargas correctas, descargas cero y negativas conservan signo', () => {
  near(calc(3.71).gravity.targetWeightN, 371); near(calc(3.71).gravity.offloadForceN, 610);
  near(calc(9.81).gravity.offloadForceN, 0);
  assert.ok(calc(12).gravity.offloadForceN < 0);
  for (const equipment of ['rover', 'wheel', 'drill']) assert.equal(calc(3.71, { equipment }).equipment, equipment);
});

test('presión: vacío cero no se divide; referencia Marte explícita y presión terrestre nunca supuesta', () => {
  const zero = calc(1.62, { earthPressurePa: 90000, targetPressurePa: 0 });
  assert.equal(zero.pressure.targetToEarthRatio, 0); assert.equal(zero.pressure.earthToTargetRatio, null);
  assert.equal(zero.pressure.differencePa, 90000);
  const mars = calc(3.71, { earthPressurePa: 90000, targetPressurePa: 636 });
  near(mars.pressure.targetToEarthRatio, 636 / 90000); near(mars.pressure.earthToTargetRatio, 90000 / 636);
  assert.deepEqual(calc(1.62).pressure, { targetToEarthRatio: null, earthToTargetRatio: null, differencePa: null });
  const bothZero = calc(1.62, { earthPressurePa: 0, targetPressurePa: 0 });
  assert.deepEqual(bothZero.pressure, { targetToEarthRatio: null, earthToTargetRatio: null, differencePa: 0 });
  assert.equal(referencePressure('moon').kind, 'idealization'); assert.equal(referencePressure('mars').value, 636);
  assert.equal(referencePressure('earth').value, null);
  const tiny = calc(1.62, { earthPressurePa: Number.MIN_VALUE, targetPressurePa: 636 });
  assert.equal(tiny.valid, false); assert.equal(tiny.pressure.targetToEarthRatio, null);
  assert.ok(!JSON.stringify(tiny).includes('Infinity'));
});

test('térmica explícita: convección, Stefan–Boltzmann, signo y valores independientes de presión', () => {
  const input = { areaM2: 2, surfaceK: 300, airK: 280, hWm2K: 10, emissivity: 0.8, surroundingsK: 250 };
  const c = calc(1.62, input);
  near(c.thermal.convectionW, 400);
  // Resultado numérico independiente calculado con sigma de NIST.
  near(c.thermal.radiationW, 380.4821235149, 0.00001);
  assert.equal(c.thermal.universalCorrectionFactor, null);
  assert.deepEqual(calc(1.62, { ...input, earthPressurePa: 10, targetPressurePa: 0 }).thermal, c.thermal);
  assert.equal(calc(1.62, { ...input, hWm2K: 0 }).thermal.convectionW, 0);
  assert.ok(calc(1.62, { ...input, airK: 310, surroundingsK: 310 }).thermal.radiationW < 0);
  assert.ok(calc(1.62, { ...input, airK: 310 }).thermal.convectionW < 0);
  assert.equal(calc(1.62, { ...input, emissivity: 0 }).thermal.radiationW, 0);
});

test('nulos térmicos no son ceros y cada fórmula requiere sus propios parámetros', () => {
  assert.deepEqual(calc(1.62).thermal, { convectionW: null, radiationW: null, universalCorrectionFactor: null });
  assert.equal(calc(1.62, { areaM2: 1, surfaceK: 300, surroundingsK: 250, emissivity: 1 }).thermal.convectionW, null);
  assert.equal(calc(1.62, { areaM2: 1, surfaceK: 300, airK: 290, hWm2K: 5 }).thermal.radiationW, null);
});

test('validación numérica estricta: no strings, booleanos, NaN, infinitos, negativos, cero Kelvin ni emisividad >1', () => {
  for (const bad of [-1, 0, NaN, Infinity, '350', true, 1e8]) {
    const c = calc(1.62, { massKg: bad });
    assert.equal(c.valid, false); assert.equal(c.gravity.offloadForceN, null);
    assert.equal(c.errors[0].field, 'massKg');
  }
  for (const [key, value] of Object.entries({ earthGravityMs2: 0, targetGravityMs2: -1, earthPressurePa: -1, targetPressurePa: Infinity,
    areaM2: 0, surfaceK: 0, airK: -30, surroundingsK: 6000, hWm2K: -1, emissivity: 1.1, equipment: 'crane', targetBody: 'venus' })) {
    assert.equal(calc(1.62, { [key]: value }).valid, false, key);
  }
  for (const invalid of [null, '350', true, []]) assert.equal(calibrateEngineering(invalid).valid, false);
  assert.equal(calibrateEngineering().valid, true);
  assert.equal(calibrateEngineering().gravity.earthWeightN, null);
});

test('los cuatro escenarios reales se adaptan sin mutación y conservan evidencia y archivo', () => {
  for (const f of fixtures) {
    const before = structuredClone(f);
    const p = buildCandidateAnalogPayload(f);
    assert.equal(p.version, CONTRACT_VERSION); assert.equal(validateCandidateAnalogPayload(p).valid, true);
    assert.deepEqual(p.earth.metrics, f.earthGrid.metrics);
    assert.equal(p.earth.pressure.value, null);
    assert.equal(p.earth.airTemperature.kind, 'archive'); near(p.earth.airTemperature.value, f.telemetry.values.temperatureC + 273.15);
    assert.equal(p.earth.surfaceTemperature.meanK, null); assert.equal(p.target.airTemperature.value, null);
    assert.equal(p.target.surfaceTemperature.kind, f.targetGrid.thermal.kind);
    assert.deepEqual(p.earth.provenance, f.earthGrid.provenance);
    const a = auditAnalog(p, { massKg: 350 });
    assert.equal(a.valid, true); assert.equal(a.matrix.length, 9);
    assert.equal(a.matrix.find(r => r.id === 'pressure').status, 'unknown');
    assert.equal(a.matrix.find(r => r.id === 'gravity').status, 'breakdown');
    assert.equal(a.matrix.find(r => r.id === 'scale').status, 'valid');
    assert.equal(a.matrix.find(r => r.id === 'geometry').status, 'partial');
    assert.deepEqual(a.geometry, compareTerrain(f.earthGrid, f.targetGrid));
    assert.deepEqual(f, before);
  }
  const shackleton = payload(1); assert.equal(shackleton.target.surfaceTemperature.minK, null);
});

test('sin rejillas/telemetría: desconocidos explícitos, sin relleno físico ni presión al nivel del mar', () => {
  const p = buildCandidateAnalogPayload({ scenario: scenarios[0] });
  const a = auditAnalog(p);
  assert.equal(a.valid, true); assert.equal(a.matrix.find(r => r.id === 'scale').status, 'unknown');
  assert.equal(a.geometry.index, null); assert.equal(p.earth.airTemperature.value, null);
  const f = structuredClone(fixtures[0]); f.telemetry.values.temperatureC = null; f.telemetry.values.pressureMslPa = 101325;
  const q = buildCandidateAnalogPayload(f); assert.equal(q.earth.pressure.value, null); assert.equal(q.earth.airTemperature.value, null);
  f.telemetry.values.surfacePressurePa = 85000;
  assert.equal(buildCandidateAnalogPayload(f).earth.pressure.value, 85000);
  f.telemetry.site = 'other'; const other = buildCandidateAnalogPayload(f);
  assert.equal(other.earth.pressure.value, null); assert.equal(other.earth.telemetry, null);
  assert.match(other.adaptationWarnings[0], /discarded/);
});

test('contrato rechaza versión, identidad, unidades, rango, presión no finita y rejillas cruzadas', () => {
  for (const mutate of [p => p.version = '2.0.0', p => p.earth.id = 'wrong', p => p.target.body = 'earth',
    p => p.earth.gravity.unit = 'kg', p => p.target.pressure.value = NaN, p => p.earth.pressure.value = -1,
    p => p.target.surfaceTemperature.minK = -1, p => p.earth.metrics.slopeP50Deg = -1, p => p.earth.grid.spacingMeters = 0, p => p.adaptationWarnings = [23], p => p.earth.provenance = null, p => p.target.notes = 'wrong']) {
    const p = payload(); mutate(p); assert.equal(validateCandidateAnalogPayload(p).valid, false);
    assert.equal(auditAnalog(p).valid, false);
  }
  assert.equal(auditAnalog(null).valid, false);
  assert.equal(auditAnalog(buildCandidateAnalogPayload(null)).valid, false);
  assert.equal(auditAnalog(payload(), null).calibration.valid, false);
  const crossed = buildCandidateAnalogPayload({ ...fixtures[0], targetGrid: fixtures[2].targetGrid });
  assert.equal(auditAnalog(crossed).valid, false);
});

test('escala incompatible o interpolada es parcial, sin transformar índice en similitud física', () => {
  const p = payload(); p.target.grid.spacingMeters = 75;
  assert.equal(auditAnalog(p).matrix.find(r => r.id === 'scale').status, 'partial');
  const q = payload(); q.target.metrics.comparable = false;
  assert.equal(auditAnalog(q).matrix.find(r => r.id === 'scale').status, 'partial');
  assert.equal(auditAnalog(q).geometry.comparable, false);
});

test('exportación JSON/Markdown contiene contrato, parámetros, evidencia, nulos y fuentes sin modificar el estado', () => {
  const p = payload(1), a = auditAnalog(p, { massKg: 100, targetPressurePa: 0 });
  const d = createDossier(p, a, '2026-11-14T18:00:00Z');
  const roundtrip = JSON.parse(JSON.stringify(d)); assert.deepEqual(roundtrip, d);
  const text = dossierMarkdown(d);
  for (const expected of ['Strength vs. Breakdown', 'gravity', '819', '1.0.0', 'References']) {
    assert.ok(text.includes(expected), expected);
  }
  assert.match(text, /minK.*null/); assert.match(text, /nasa.gov/); assert.match(text, /does not certify/);
  d.candidate.earth.name = 'changed'; assert.notEqual(p.earth.name, 'changed');
  assert.throws(() => createDossier(p, auditAnalog(p, { massKg: -1 })), /Invalid/);
  assert.throws(() => createDossier(p, auditAnalog(payload(0))), /Invalid/);
  assert.throws(() => createDossier(p, a, 'bad date'), /date/);
});

test('copiloto local consume la auditoría y las hipótesis sin prometer equivalencia dinámica ni GO', () => {
  const p = payload(), a = auditAnalog(p, { massKg: 100 });
  const ctx = { analogyAudit: { version: a.version, matrix: a.matrix, calibration: { ...a.calibration, massKg: 100 }, limitation: a.limitations[1] } };
  const r = answerLocally('gravedad y peso', ctx);
  assert.ok(r.grounded.includes('analogyAudit.calibration'));
  assert.match(r.answer, /819 N/); assert.match(r.answer, /hypotheses/); assert.match(r.answer, /does not reproduce/);
  assert.match(r.answer, /does not authorize GO\/NO-GO/);
});
