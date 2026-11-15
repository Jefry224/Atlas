// Lunar lander visual for the landing scene: NASA's Apollo Lunar Module GLB, or a schematic fallback.
// No DOM: THREE and a GLTFLoader instance are injected by the caller.
//
// Coordinate contract (shared by both builders):
//   - origin on the ground contact plane (bottom of the foot pads), +Y up;
//   - forward (crew hatch / porch side) is -Z;
//   - size = real metres × unitsPerMeter × visualScale (same convention as the old schematic: 6 × U).
//
// Historical note (data honesty): the Apollo LM never deployed a rover by ramp. The Lunar Roving
// Vehicle (Apollo 15–17) was stowed folded in a descent-stage bay and the astronauts deployed it
// with lanyards and hinges. `rampLocal` exists only for Atlas' conceptual rover deployment, and the
// UI must label that deployment as «conceptual».
import { assertEmbeddedGlb } from '../audit/nasa-visual-math.mjs';

// Apollo LM reference dimensions (NASA Apollo LM documentation, landing gear deployed).
export const LM_REAL_HEIGHT_M = 7.0;
export const LM_REAL_SPAN_M = 9.4;
// Conceptual ramp slope; not an Apollo hardware value.
export const CONCEPT_RAMP_DEG = 25;
// Node names in the NASA GLB (GLTFLoader sanitises spaces to underscores).
const NOZZLE_NODE = /^group13[ _]pC(_\d+)?$/; // descent engine bell (textured cone under the descent stage)
const DESCENT_STAGE_NODE = /^group31[ _]/;    // octagonal descent stage, legs and foot pads

const FOIL_METALNESS = 0.9, FOIL_ROUGHNESS = 0.35, PAINT_ROUGHNESS = 0.6;

function materialsOf(object) {
  const set = new Set();
  object.traverse(child => { for (const m of Array.isArray(child.material) ? child.material : child.material ? [child.material] : []) set.add(m); });
  return [...set];
}
function disposeTree(object) {
  const geometries = new Set(), textures = new Set(), materials = materialsOf(object);
  object.traverse(child => { if (child.geometry) geometries.add(child.geometry); });
  for (const m of materials) for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  textures.forEach(t => { t.source?.data?.close?.(); t.dispose(); });
  object.removeFromParent();
}
function enableShadows(object) {
  object.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
}
// Gold/orange Kapton foil: warm hue with strong red-blue separation. Everything else is paint/metal grey.
export function isFoilColor({ r, g, b }) { return r > g && g > b && r - b > 0.4; }
function polishMaterials(object) {
  for (const m of materialsOf(object)) {
    if (!('metalness' in m)) continue;
    if (!m.map && isFoilColor(m.color)) { m.metalness = FOIL_METALNESS; m.roughness = FOIL_ROUGHNESS; }
    else { m.roughness = PAINT_ROUGHNESS; m.metalness = Math.min(m.metalness ?? 0, 0.2); }
    m.needsUpdate = true;
  }
}
function result(THREE, group, data) {
  enableShadows(group);
  return {
    group, ready: true, kind: data.kind,
    nozzleLocal: data.nozzleLocal, nozzleAxisLocal: new THREE.Vector3(0, -1, 0),
    footContactsLocal: data.footContactsLocal, deckHeightLocal: data.deckHeightLocal,
    rampLocal: data.rampLocal, heightLocal: data.heightLocal, measured: data.measured || null,
    dispose() { disposeTree(group); },
  };
}
// Conceptual ramp: from the deck edge at `radius` along unit `dir`, down to the ground.
function conceptRamp(THREE, dir, radius, deckHeight) {
  const start = dir.clone().multiplyScalar(radius).setY(deckHeight);
  const run = deckHeight / Math.tan(CONCEPT_RAMP_DEG * Math.PI / 180);
  return { start, end: dir.clone().multiplyScalar(radius + run).setY(0) };
}

/**
 * Loads the NASA Apollo LM GLB and fits it to the coordinate contract above.
 * @returns {Promise<{group, ready: true, kind: 'nasa-glb', nozzleLocal, nozzleAxisLocal, footContactsLocal, deckHeightLocal, rampLocal: {start, end}, heightLocal, dispose()}>}
 */
export async function createLunarLander(THREE, { loader, url = 'assets/models/nasa/apollo-lunar-module.glb', unitsPerMeter = 0.1, visualScale = 6, signal } = {}) {
  if (!loader?.parseAsync) throw new Error('createLunarLander needs a GLTFLoader instance.');
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Lander model: HTTP ${response.status}.`);
  const buffer = await response.arrayBuffer();
  signal?.throwIfAborted?.();
  assertEmbeddedGlb(buffer);
  const gltf = await loader.parseAsync(buffer, '');
  if (signal?.aborted) { disposeTree(gltf.scene); signal.throwIfAborted(); }
  try { return fitLunarModule(THREE, gltf.scene, { unitsPerMeter, visualScale }); }
  catch (error) { disposeTree(gltf.scene); throw error; }
}

// Exported for tests: fits any LM-like scene (pads at the bottom, bell on the vertical axis).
export function fitLunarModule(THREE, model, { unitsPerMeter = 0.1, visualScale = 6 } = {}) {
  model.updateMatrixWorld(true); polishMaterials(model);
  const box = new THREE.Box3().setFromObject(model), modelHeight = box.max.y - box.min.y;
  if (!Number.isFinite(modelHeight) || modelHeight <= 0) throw new Error('Lander model has no valid bounds.');
  // File units are unknown: fit the height to 7.0 m. Measured span then follows from the model.
  const metresPerUnit = LM_REAL_HEIGHT_M / modelHeight, k = metresPerUnit * unitsPerMeter * visualScale;
  const s = unitsPerMeter * visualScale;

  // Foot pads: vertices within 4 % of the height above the lowest point, binned by dominant axis
  // (the LM gear sits on the ±X/±Z axes of this file).
  const pads = new Map(), v = new THREE.Vector3(), padTop = box.min.y + 0.04 * modelHeight;
  model.traverse(child => {
    const pos = child.isMesh && child.geometry?.attributes?.position; if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld); if (v.y > padTop) continue;
      const key = Math.abs(v.x) > Math.abs(v.z) ? (v.x > 0 ? '+x' : '-x') : (v.z > 0 ? '+z' : '-z');
      const bin = pads.get(key) || { sum: new THREE.Vector3(), n: 0 }; bin.sum.add(v); bin.n++; pads.set(key, bin);
    }
  });
  if (pads.size !== 4) throw new Error(`Expected 4 foot pads, found ${pads.size}.`);
  const padCentres = ['+x', '-x', '+z', '-z'].map(key => pads.get(key).sum.divideScalar(pads.get(key).n));
  const centre = padCentres.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(4);

  // Descent engine bell: the GLB has a separate node (group13 pC); its lowest ring is the nozzle exit.
  // Measured before re-parenting so every Box3 uses the model's own world matrices.
  let bell = null; model.traverse(child => { if (!bell && NOZZLE_NODE.test(child.name)) bell = child; });
  let nozzleModel;
  if (bell) { const b = new THREE.Box3().setFromObject(bell); nozzleModel = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2); }
  else nozzleModel = new THREE.Vector3(centre.x, box.min.y + 0.06 * modelHeight, centre.z); // estimate: ~0.43 m above pads in the NASA file

  const named = (child, re) => re.test(child.name) || re.test(child.parent?.name || '');
  let deckTop = -Infinity; model.traverse(child => { if (child.isMesh && named(child, DESCENT_STAGE_NODE)) deckTop = Math.max(deckTop, new THREE.Box3().setFromObject(child).max.y); });
  if (!Number.isFinite(deckTop)) deckTop = box.min.y + 0.44 * modelHeight; // estimate: descent stage ≈ 44 % of height
  const deckHeightLocal = (deckTop - box.min.y) * k;

  // Model space → lander space: centre on the pads, ground at y=0, rotate π about Y (hatch +Z → −Z), scale.
  const toLocal = p => new THREE.Vector3(-(p.x - centre.x) * k, (p.y - box.min.y) * k, -(p.z - centre.z) * k);
  const inner = new THREE.Group(); inner.name = 'apollo-lm-fit';
  inner.rotation.y = Math.PI; inner.scale.setScalar(k);
  model.position.set(-centre.x, -box.min.y, -centre.z); inner.add(model);
  const group = new THREE.Group(); group.name = 'apollo-lunar-module'; group.add(inner);

  // Conceptual ramp in the forward-right descent-stage bay, between the forward and side legs (clear of the ladder).
  const stageHalf = Math.max(...padCentres.map(p => Math.hypot(p.x - centre.x, p.z - centre.z))) * 0.71 * k; // ≈ stage face
  const rampLocal = conceptRamp(THREE, new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2), stageHalf, deckHeightLocal);
  return result(THREE, group, {
    kind: 'nasa-glb', nozzleLocal: toLocal(nozzleModel), footContactsLocal: padCentres.map(p => toLocal(p).setY(0)),
    deckHeightLocal, rampLocal, heightLocal: modelHeight * k,
    measured: { metresPerUnit, heightM: LM_REAL_HEIGHT_M, spanM: (box.max.x - box.min.x) * metresPerUnit, scale: s },
  });
}
/**
 * Today's schematic lander from landing-view.mjs, with the same return shape. Never fails.
 * @returns {{group, ready: true, kind: 'schematic', nozzleLocal, nozzleAxisLocal, footContactsLocal, deckHeightLocal, rampLocal: {start, end}, heightLocal, dispose()}}
 */
export function createSchematicLanderFallback(THREE, { unitsPerMeter = 0.1, visualScale = 6 } = {}) {
  const scale = visualScale * unitsPerMeter;
  const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.3 });
  const group = new THREE.Group(); group.name = 'schematic-lander';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6*scale,1.8*scale,1.5*scale,8),mat(0xd4b778)); body.position.y = 2*scale;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3*scale,0.15*scale,2.3*scale),mat(0xe6eef6)); deck.position.y = 2.85*scale;
  const engine = new THREE.Mesh(new THREE.ConeGeometry(0.65*scale,1.2*scale,16,1,true),mat(0x718391)); engine.position.y = 0.9*scale; engine.rotation.x = Math.PI;
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.045*scale,0.045*scale,2.5*scale,6),mat(0xe6eef6)); antenna.position.set(0.8*scale,4*scale,0);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6*scale,12,8,0,Math.PI*2,0,Math.PI/2),mat(0x459ded)); dish.rotation.z = Math.PI/3; dish.position.set(0.8*scale,5.2*scale,0);
  group.add(body,deck,engine,antenna,dish);
  const footGeometry = new THREE.CylinderGeometry(0.45*scale,0.5*scale,0.1*scale,12), footContactsLocal = [];
  for (const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]) {
    const foot = new THREE.Mesh(footGeometry,mat(0x9caebe)); foot.position.set(Math.sin(a)*3*scale,0.05*scale,Math.cos(a)*3*scale); group.add(foot);
    footContactsLocal.push(new THREE.Vector3(foot.position.x, 0, foot.position.z));
    const from = new THREE.Vector3(Math.sin(a)*1.3*scale,2*scale,Math.cos(a)*1.3*scale), delta = foot.position.clone().sub(from);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09*scale,0.09*scale,delta.length(),8),mat(0xe6eef6)); leg.position.copy(from.addScaledVector(delta,0.5)); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); group.add(leg);
  }
  group.updateMatrixWorld(true); // materials kept as in landing-view.mjs (no env map needed)
  const deckHeightLocal = 2.925 * scale; // deck top
  // The schematic legs sit on the diagonals, so its conceptual ramp runs straight forward (−Z).
  return result(THREE, group, {
    kind: 'schematic', nozzleLocal: new THREE.Vector3(0, 0.3 * scale, 0), footContactsLocal, deckHeightLocal,
    rampLocal: conceptRamp(THREE, new THREE.Vector3(0, 0, -1), 1.8 * scale, deckHeightLocal),
    heightLocal: new THREE.Box3().setFromObject(group).max.y,
  });
}
