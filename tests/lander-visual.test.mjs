import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from '../assets/vendor/three.module.min.js';
import { validateNasaManifest, assertEmbeddedGlb } from '../nasa-visual-math.mjs';
import { createSchematicLanderFallback, fitLunarModule, isFoilColor, LM_REAL_HEIGHT_M, CONCEPT_RAMP_DEG } from '../lander-visual.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const manifest = JSON.parse(readFileSync(new URL('../assets/data/nasa-assets.json', import.meta.url)));

function assertShape(lander) {
  assert.ok(lander.group?.isObject3D); assert.equal(lander.ready, true); assert.equal(typeof lander.dispose, 'function');
  for (const key of ['nozzleLocal', 'nozzleAxisLocal']) assert.ok(lander[key]?.isVector3, key);
  close(lander.nozzleAxisLocal.length(), 1); assert.ok(lander.nozzleAxisLocal.y < 0, 'exhaust points down');
  assert.equal(lander.footContactsLocal.length, 4);
  for (const foot of lander.footContactsLocal) { assert.ok(foot.isVector3); close(foot.y, 0); }
  assert.ok(lander.rampLocal.start.isVector3 && lander.rampLocal.end.isVector3);
  close(lander.rampLocal.end.y, 0); close(lander.rampLocal.start.y, lander.deckHeightLocal);
  const run = Math.hypot(lander.rampLocal.end.x - lander.rampLocal.start.x, lander.rampLocal.end.z - lander.rampLocal.start.z);
  close(Math.atan2(lander.deckHeightLocal, run) * 180 / Math.PI, CONCEPT_RAMP_DEG);
  assert.ok(lander.rampLocal.end.z < 0, 'conceptual ramp leaves towards the forward (−Z) side');
  assert.ok(lander.heightLocal > lander.deckHeightLocal && lander.deckHeightLocal > lander.nozzleLocal.y && lander.nozzleLocal.y >= 0);
  const box = new THREE.Box3().setFromObject(lander.group); close(box.min.y, 0, 0.03); close(box.max.y, lander.heightLocal, 1e-3); // schematic leg ends dip ~2 cm
}

test('Apollo LM manifest entry is valid, embedded, Draco-free and matches the file', () => {
  assert.deepEqual(validateNasaManifest(manifest), { valid: true, errors: [] });
  const asset = manifest.assets.find(a => a.id === 'apollo-lunar-module');
  assert.ok(asset); assert.equal(asset.role, 'lander-visual'); assert.equal(asset.body, 'moon'); assert.equal(asset.format, 'glb');
  assert.equal(asset.credit, 'NASA/Michael D. Carbajal'); assert.equal(asset.licenseUrl, manifest.assets.find(a => a.id === 'lro').licenseUrl);
  assert.ok(asset.notes.some(n => /conceptual/.test(n)), 'notes state the ramp deployment is conceptual');
  const bytes = readFileSync(new URL(`../${asset.localPath}`, import.meta.url));
  assert.equal(bytes.length, asset.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  const json = assertEmbeddedGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.ok(!json.extensionsRequired?.includes('KHR_draco_mesh_compression'));
  assert.ok(json.nodes.some(n => n.name === 'group13 pC'), 'descent engine bell node present');
  const original = readFileSync(new URL(`../${asset.originalPath}`, import.meta.url));
  assert.equal(original.length, asset.originalBytes); assert.equal(createHash('sha256').update(original).digest('hex'), asset.originalSha256);
});

test('schematic fallback keeps the landing contract and default 6 × U scale', () => {
  const lander = createSchematicLanderFallback(THREE);
  assertShape(lander); assert.equal(lander.kind, 'schematic');
  close(lander.footContactsLocal[0].length(), 3 * 0.6); close(lander.nozzleLocal.y, 0.3 * 0.6);
  const doubled = createSchematicLanderFallback(THREE, { visualScale: 12 }); close(doubled.heightLocal, 2 * lander.heightLocal);
  let meshes = 0; lander.group.traverse(o => { if (o.isMesh) { meshes++; assert.ok(o.castShadow && o.receiveShadow); } }); assert.ok(meshes > 10);
  const parent = new THREE.Group(); parent.add(lander.group); lander.dispose(); assert.equal(parent.children.length, 0);
});

test('fitLunarModule scales to 7 m, grounds the pads, finds the bell and faces −Z', () => {
  // Stub with the NASA file's layout: pads on ±X/±Z at y≈0.1, bell node "group13 pC", hatch on +Z.
  const model = new THREE.Group(), std = color => new THREE.MeshStandardMaterial({ color });
  const add = (parent, name, geo, color, x, y, z) => { const m = new THREE.Mesh(geo, std(color)); m.name = name; m.position.set(x, y, z); parent.add(m); return m; };
  for (const [x, z] of [[2.9, 0], [-2.9, 0], [0, 2.9], [0, -2.9]]) add(model, 'group31_19', new THREE.BoxGeometry(.6, .16, .6), 0xc4870f, x, .18, z);
  add(model, 'group31_17', new THREE.BoxGeometry(4.1, 1.4, 4.1), 0xc4870f, 0, 1.62, 0);
  const bell = new THREE.Group(); bell.name = 'group13_pC'; add(bell, 'group13_pC_1', new THREE.ConeGeometry(.5, .7, 12), 0x444444, 0, .757, 0); model.add(bell);
  add(model, 'hatch', new THREE.BoxGeometry(.6, .6, .2), 0xbfbfbf, 0, 3, 1.3);
  add(model, 'top', new THREE.BoxGeometry(1, 1, 1), 0xbfbfbf, 0, 4.6, 0);
  const lander = fitLunarModule(THREE, model);
  assertShape(lander); assert.equal(lander.kind, 'nasa-glb');
  const s = 0.6; close(lander.heightLocal, LM_REAL_HEIGHT_M * s);
  close(lander.nozzleLocal.x, 0); close(lander.nozzleLocal.z, 0); assert.ok(lander.nozzleLocal.y > 0 && lander.nozzleLocal.y < 0.1 * lander.heightLocal);
  close(lander.deckHeightLocal, (2.32 - .1) * LM_REAL_HEIGHT_M / 5 * s, 1e-3);
  const hatch = model.getObjectByName('hatch'); lander.group.updateMatrixWorld(true);
  assert.ok(hatch.getWorldPosition(new THREE.Vector3()).z < 0, 'hatch (+Z in file) faces −Z');
  assert.equal(model.getObjectByName('group31_17').material.metalness, 0.9, 'foil is metallic');
  assert.equal(hatch.material.roughness, 0.6, 'grey paint stays matte');
  assert.ok(isFoilColor(new THREE.Color(0.77, 0.53, 0.06)) && !isFoilColor(new THREE.Color(0.75, 0.75, 0.75)));
});

test('lander hardware scale matches the exploration rover scale (×14) and the schematic scales with it', () => {
  const stage = readFileSync(new URL('../landing-stage.mjs', import.meta.url), 'utf8');
  const mission = readFileSync(new URL('../mission.js', import.meta.url), 'utf8');
  const landerScale = Number(stage.match(/export const LANDER_VISUAL_SCALE = (\d+(?:\.\d+)?)/)?.[1]);
  const roverScale = Number(mission.match(/const ROVER_SCALE = (\d+(?:\.\d+)?)/)?.[1]);
  assert.equal(landerScale, 14);
  assert.equal(landerScale, roverScale, 'the delivered rover must never be bigger than the vehicle that brought it');
  const base = createSchematicLanderFallback(THREE, { unitsPerMeter: 0.1, visualScale: 6 });
  const big = createSchematicLanderFallback(THREE, { unitsPerMeter: 0.1, visualScale: landerScale });
  close(big.heightLocal, base.heightLocal * landerScale / 6);
  close(big.deckHeightLocal, base.deckHeightLocal * landerScale / 6);
});
