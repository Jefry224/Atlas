import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBenchInspection, forceReference, signedFraction, terrainPair, windVector } from '../bench-inspection.mjs';
import { inspectionVisual } from '../bench-visuals.mjs';
import { THREE, disposeObject } from '../nasa-stage.mjs';
import { calibrateEngineering, buildCandidateAnalogPayload } from '../analog-audit.mjs';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const calibration = input => calibrateEngineering({ equipment: 'rover', targetBody: 'moon', massKg: 350, earthGravityMs2: 9.81, targetGravityMs2: 1.62, ...input });
const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const arrows = visual => visual.group.children.filter(object => object instanceof THREE.ArrowHelper);

test('el cambio de método reduce W y elimina F sin reescalar ni cambiar N', () => {
  const c = calibration(), original = structuredClone(c);
  const first = buildBenchInspection({ calibration: c }), second = buildBenchInspection({ calibration: c, mode: 'equivalent' });
  assert.equal(first.data.max, second.data.max); close(forceReference(c), 3433.5);
  const a = inspectionVisual(first), b = inspectionVisual(second);
  assert.equal(arrows(a).length, 3); assert.equal(arrows(b).length, 2);
  close(arrows(b)[0].cone.position.y / arrows(a)[0].cone.position.y, 1.62 / 9.81);
  close(arrows(a)[2].cone.position.y, arrows(b)[1].cone.position.y);
  assert.deepEqual(c, original); disposeObject(a.group); disposeObject(b.group);
});

test('el viento meteorológico desde norte viaja hacia sur; calma y faltantes se distinguen', () => {
  const north = windVector(4, 0), east = windVector(3, 90);
  close(north.toward[0], 0); close(north.toward[2], 1); close(east.toward[0], -1); close(east.toward[2], 0);
  assert.equal(windVector(0, 360).speed, 0);
  for (const args of [[null, 0], [4, null], [-1, 20], [4, 361], ['4', 0], [4, Infinity]]) assert.equal(windVector(...args), null);
});

test('el calor negativo entra y el positivo sale; magnitudes comparten escala, sin vectores para null o cero', () => {
  for (const [surfaceK, expectedSign] of [[300, 1], [260, -1]]) {
    const view = buildBenchInspection({ factor: 'heat-transfer', calibration: calibration({ areaM2: 2, surfaceK, airK: 280, surroundingsK: 280, hWm2K: 10, emissivity: .8 }) });
    const visual = inspectionVisual(view), vectors = arrows(visual);
    assert.equal(vectors.length, 2);
    const gasDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(vectors[0].quaternion);
    const radiationDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(vectors[1].quaternion);
    close(gasDirection.x, -expectedSign); close(radiationDirection.x, expectedSign);
    close(vectors[0].cone.position.y / vectors[1].cone.position.y, Math.abs(view.data.convection / view.data.radiation));
    disposeObject(visual.group);
  }
  for (const inputs of [{}, { areaM2: 2, surfaceK: 280, airK: 280, surroundingsK: 280, hWm2K: 10, emissivity: .8 }]) {
    const visual = inspectionVisual(buildBenchInspection({ factor: 'heat-transfer', calibration: calibration(inputs) }));
    assert.equal(arrows(visual).length, 0); disposeObject(visual.group);
  }
  assert.equal(signedFraction(null, 10), null); close(signedFraction(-50, 100), -.5);
});

test('vacío ideal sin flechas de presión; presión desconocida no se convierte en vacío', () => {
  const view = buildBenchInspection({ factor: 'pressure', calibration: calibration({ earthPressurePa: 97500, targetPressurePa: 0 }) });
  const visual = inspectionVisual(view);
  assert.equal(arrows(visual).length, 5); assert.ok(visual.labels.some(label => label.text.includes('Vacío ideal')));
  assert.equal(view.facts[3].value, '0'); disposeObject(visual.group);
  const missing = inspectionVisual(buildBenchInspection({ factor: 'pressure', calibration: calibration() }));
  assert.equal(arrows(missing).length, 0); assert.ok(missing.labels.some(label => label.text === 'Presión pendiente')); disposeObject(missing.group);
});

test('los cuatro escenarios muestran alturas de sus DEM, origen local y escala compartida', () => {
  for (const scenario of read('assets/data/scenarios.json').scenarios) {
    const earthGrid = read(scenario.earth), targetGrid = read(scenario.target);
    const candidate = buildCandidateAnalogPayload({ scenario, earthGrid, targetGrid });
    const before = JSON.stringify([earthGrid, targetGrid, candidate]);
    const pair = terrainPair(candidate, { earth: earthGrid, target: targetGrid });
    assert.equal(pair.surfaces.length, 2); assert.equal(pair.surfaces[0].count, 33); assert.equal(pair.extent, 2400);
    for (const [j, grid] of [earthGrid, targetGrid].entries()) {
      const surface = pair.surfaces[j]; assert.equal(surface.minimum, Math.min(...grid.elevation));
      close(surface.vertices[0][1], grid.elevation[0] - surface.minimum);
      assert.equal(surface.vertices.at(-1)[0], grid.extentMeters);
    }
    const view = buildBenchInspection({ factor: 'geometry', candidate, grids: { earth: earthGrid, target: targetGrid } });
    assert.ok(view.data.geometry.index !== null); const visual = inspectionVisual(view);
    assert.equal(visual.group.children.filter(o => o.isMesh).length, 2); assert.equal(arrows(visual).length, 0); disposeObject(visual.group);
    assert.equal(JSON.stringify([earthGrid, targetGrid, candidate]), before);
    assert.equal(terrainPair(candidate, { earth: targetGrid, target: earthGrid }).surfaces[0], null);
  }
});

test('una rejilla incompleta o de otro cuerpo nunca genera un terreno sintético', () => {
  const candidate = { earth: { id: 'a', body: 'earth' } }, grid = { id: 'a', body: 'earth', gridSize: 2, extentMeters: 20, elevation: [1, 2, 3, 4] };
  for (const bad of [{ ...grid, body: 'mars' }, { ...grid, elevation: [1] }, { ...grid, elevation: [1, 2, NaN, 4] }, { ...grid, extentMeters: 0 }]) assert.equal(terrainPair(candidate, { earth: bad }).surfaces[0], null);
  assert.equal(terrainPair(null).surfaces[0], null);
});

test('solo carga y contacto usan el método gravitatorio; los otros factores tienen magnitudes propias', () => {
  const c = calibration(), factors = ['gravity', 'atmosphere', 'pressure', 'temperature', 'heat-transfer', 'radiation', 'regolith', 'geometry', 'scale'];
  for (const factor of factors) {
    const view = buildBenchInspection({ factor, calibration: c });
    assert.equal(view.methodRelevant, ['gravity', 'regolith'].includes(factor)); assert.ok(view.benefit); assert.ok(view.next); assert.ok(view.scale);
    if (['temperature', 'radiation', 'geometry', 'scale'].includes(factor)) {
      const visual = inspectionVisual(view); assert.equal(arrows(visual).length, 0); disposeObject(visual.group);
    }
  }
});

test('la fuente propuesta se etiqueta sin transformar datos de misión ni irradiancia en dosis', () => {
  const candidate = { earth: { telemetry: { values: { solarRadiationWm2: 800 } } }, target: { environment: { solarConstantWm2: 590 } } };
  const before = structuredClone(candidate), view = buildBenchInspection({ factor: 'radiation', candidate });
  assert.equal(view.data.solar, 800); assert.equal(view.data.reference, 590); assert.equal(view.data.targetDose, null);
  const proposed = buildBenchInspection({ factor: 'heat-transfer', calibration: calibration(), source: 'design' });
  assert.match(proposed.scope, /PROPUESTA/); assert.equal(proposed.data.convection, null); assert.deepEqual(candidate, before);
});
