import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { benchState, latLonVector, targetFromGrid, validateNasaManifest, assertEmbeddedGlb, NASA_MODEL_IDS } from '../src/audit/nasa-visual-math.mjs';
import { calibrateEngineering, buildCandidateAnalogPayload, auditAnalog, createDossier } from '../src/audit/analog-audit.mjs';
const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));
const c = (body = 'moon', massKg = 100, targetGravityMs2 = body === 'moon' ? 1.62 : body === 'mars' ? 3.71 : 9.81) => calibrateEngineering({ targetBody: body, equipment: 'rover', massKg, earthGravityMs2: 9.81, targetGravityMs2 });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('dos ensayos igualan contacto, pero solo soporte conserva masa e inercia; sin mutar calibración', () => {
  for (const body of ['moon', 'mars', 'earth']) {
    const calibration = c(body), original = structuredClone(calibration);
    const offload = benchState(calibration), equivalent = benchState(calibration, 'equivalent');
    assert.equal(offload.testMassKg, 100); assert.equal(offload.inertiaPreserved, true); assert.equal(equivalent.inertiaPreserved, false);
    close(offload.testEarthWeightN - offload.supportN, offload.targetWeightN);
    close(equivalent.testMassKg * 9.81, equivalent.targetWeightN); assert.equal(equivalent.supportN, 0);
    assert.equal(offload.contactLoadN, equivalent.contactLoadN); assert.deepEqual(calibration, original);
  }
  close(benchState(c()).supportN, 819); close(benchState(c('mars')).supportN, 610);
});

test('carga negativa conserva signo; masa vacía/inválida elimina todo resultado y flecha de carga', () => {
  close(benchState(c('moon', 100, 12)).supportN, -219);
  for (const mass of [null, -1, NaN, Infinity, '', true]) for (const mode of ['offload', 'equivalent']) {
    const state = benchState(c('moon', mass), mode); assert.equal(state.known, false);
    for (const key of ['testMassKg', 'originalEarthWeightN', 'targetWeightN', 'testEarthWeightN', 'supportN', 'contactLoadN']) assert.equal(state[key], null);
  }
  assert.equal(benchState(null).body, null); assert.throws(() => benchState(c(), 'dynamic'));
});

test('coordenadas de los cuatro objetivos proceden de rejillas reales, rechazan cruce de escenario', () => {
  const scenarios = read('assets/data/scenarios.json').scenarios;
  assert.equal(scenarios.length, 4);
  for (const scenario of scenarios) {
    const grid = read(scenario.target), target = targetFromGrid(scenario, grid);
    assert.deepEqual([target.lat, target.lon], grid.center); assert.equal(target.targetId, scenario.targetId);
    const vector = latLonVector(target.lat, target.lon, 1.96); close(Math.hypot(...vector), 1.96);
    assert.equal(targetFromGrid(scenario, { ...grid, id: 'wrong-site' }), null);
    assert.equal(targetFromGrid(scenario, { ...grid, center: [91, 0] }), null);
  }
  const [x0,y0,z0] = latLonVector(0,0); close(x0,1); close(y0,0); close(z0,0);
  close(latLonVector(0,90)[2],-1); close(latLonVector(0,-90)[2],1); close(latLonVector(90,0)[1],1);
});

test('dossier científico no depende del modo ni del modelo visual; payload conserva fuente', () => {
  const scenario = read('assets/data/scenarios.json').scenarios[2];
  const candidate = buildCandidateAnalogPayload({ scenario, earthGrid: read(scenario.earth), targetGrid: read(scenario.target) });
  const audit = auditAnalog(candidate, { equipment: 'rover', targetBody: 'mars', massKg: 100, earthGravityMs2: 9.81, targetGravityMs2: 3.71 });
  const dossier = createDossier(candidate, audit, '2026-11-14T00:00:00Z');
  const copy = structuredClone(dossier); benchState(audit.calibration, 'equivalent');
  assert.deepEqual(dossier, copy); assert.deepEqual(candidate.target.center, read(scenario.target).center);
  assert.equal(dossier.audit.calibration.inputs.massKg, 100); assert.equal(dossier.candidate.earth.pressure.value, null);
});

test('manifest local: siete GLB completos, íntegros y embebidos, dos texturas oficiales', () => {
  const manifest = read('assets/data/nasa-assets.json'); assert.deepEqual(validateNasaManifest(manifest), { valid:true, errors:[] });
  for (const asset of manifest.assets) {
    assert.equal(asset.available, true, `${asset.id} pendiente`);
    const bytes = readFileSync(new URL(`../${asset.localPath}`, import.meta.url)); assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    if (NASA_MODEL_IDS.includes(asset.id)) {
      const json = assertEmbeddedGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      assert.ok(json.meshes?.length); assert.ok(!json.extensionsRequired?.includes('KHR_draco_mesh_compression'));
    }
  }
  for (const id of ['moon-color', 'mars-color']) assert.ok(manifest.assets.find(a => a.id === id));
});

test('manifest rechaza rutas externas/traversal, IDs duplicados, falta de integridad y versiones ajenas', () => {
  const manifest = read('assets/data/nasa-assets.json');
  for (const path of ['https://example.com/file.glb', '../secret.glb', 'assets/models/nasa/../secret.glb']) {
    const bad = structuredClone(manifest); bad.assets[0].localPath = path; assert.equal(validateNasaManifest(bad).valid, false);
  }
  for (const modify of [m => m.version = '2', m => m.assets.push(m.assets[0]), m => m.assets[0].sha256 = '', m => m.assets.shift(), m => m.assets[0].sourceUrl = 'javascript:alert(1)']) {
    const bad = structuredClone(manifest); modify(bad); assert.equal(validateNasaManifest(bad).valid, false);
  }
});

test('loader rechaza GLB corrupto y referencias externas antes de emitir peticiones de texturas/buffers', () => {
  assert.throws(() => assertEmbeddedGlb(new ArrayBuffer(8)), /Invalid GLB/);
  const json = new TextEncoder().encode(JSON.stringify({ asset:{version:'2.0'}, images:[{uri:'https://example.com/x.png'}] }));
  const buffer = new ArrayBuffer(20 + json.length), view = new DataView(buffer);
  view.setUint32(0,0x46546c67,true); view.setUint32(4,2,true); view.setUint32(8,buffer.byteLength,true); view.setUint32(12,json.length,true); view.setUint32(16,0x4e4f534a,true); new Uint8Array(buffer,20).set(json);
  assert.throws(() => assertEmbeddedGlb(buffer), /external resources/);
});
