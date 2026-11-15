// Presentation-only projections. Scientific values come from the M2 calibration and target JSON.
export const NASA_MODEL_IDS = ['scarecrow', 'perseverance', 'moon', 'mars', 'lro', 'block-island', 'apollo-11'];
export const BENCH_MODES = ['offload', 'equivalent'];
export const FACTOR_EXPLANATIONS = {
  gravity: 'Wheels and load: weight changes with g. The support offloads vertically; reducing mass also changes inertia. Earth ground keeps its gravity.',
  atmosphere: 'Earth gas and wind with geographic direction. The provider’s speed does not determine the target’s density, drag or flow.',
  pressure: 'Absolute-pressure enclosures, normal vectors on a logarithmic scale and difference in Pa. Ideal lunar vacuum and Martian 636 Pa are references, not site measurements.',
  temperature: 'Equipment, gas and radiative surroundings are distinct temperatures, separate from the target surface range. Columns in K, no force vectors.',
  'heat-transfer': 'Convection and thermal radiation channels: direction by sign and length proportional to W. No conduction or full thermal equilibrium.',
  radiation: 'Solar irradiance and ionizing dose in separate channels. No shielding or dose is inferred from W/m².',
  regolith: 'Wheel–soil contact: the plane is a schematic. It contains no regolith mechanical properties, cohesion, grain size or sinkage.',
  geometry: 'Comparison of real DEMs with shared scales and explicit vertical exaggeration. Regional geometry does not characterize wheel contact.',
  scale: 'Native pixel, grid spacing and extent are distinct quantities. The NASA mesh keeps its normalized visual scale, with no test dimensions.',
};
const finite = v => typeof v === 'number' && Number.isFinite(v);
export function benchState(calibration, mode = 'offload') {
  if (!BENCH_MODES.includes(mode)) throw new Error('Unknown test mode.');
  const c = calibration;
  const known = c && finite(c.inputs?.massKg) && finite(c.inputs?.earthGravityMs2) && finite(c.inputs?.targetGravityMs2)
    && finite(c.gravity?.earthWeightN) && finite(c.gravity?.targetWeightN) && finite(c.gravity?.offloadForceN) && finite(c.gravity?.equivalentEarthMassKg);
  return {
    mode, known: Boolean(known), equipment: c?.equipment || 'rover', body: c?.targetBody || null,
    originalMassKg: finite(c?.inputs?.massKg) ? c.inputs.massKg : null,
    testMassKg: known ? mode === 'equivalent' ? c.gravity.equivalentEarthMassKg : c.inputs.massKg : null,
    originalEarthWeightN: known ? c.gravity.earthWeightN : null,
    targetWeightN: known ? c.gravity.targetWeightN : null,
    testEarthWeightN: known ? mode === 'equivalent' ? c.gravity.targetWeightN : c.gravity.earthWeightN : null,
    supportN: known ? mode === 'equivalent' ? 0 : c.gravity.offloadForceN : null,
    contactLoadN: known ? c.gravity.targetWeightN : null,
    inertiaPreserved: mode === 'offload',
  };
}
export function latLonVector(lat, lon, radius = 1) {
  if (![lat, lon, radius].every(finite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || radius <= 0) throw new Error('Invalid geographic coordinates.');
  const phi = lat * Math.PI / 180, theta = lon * Math.PI / 180;
  // Three SphereGeometry: image u=(lon+180)/360, v=(lat+90)/180; +X=0°E, +Z=90°W.
  return [radius * Math.cos(phi) * Math.cos(theta), radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(theta)];
}
export function targetFromGrid(scenario, grid) {
  if (!scenario || grid?.id !== scenario.targetId || grid.body !== scenario.body || !Array.isArray(grid.center)) return null;
  const [lat, lon] = grid.center;
  try { latLonVector(lat, lon); } catch { return null; }
  return { scenarioId: scenario.id, targetId: grid.id, body: grid.body, name: grid.name || grid.id, lat, lon };
}
export function validateNasaManifest(manifest) {
  const errors = [];
  if (manifest?.schema !== 'NasaVisualAssets' || manifest?.version !== '1.0.0' || !Array.isArray(manifest?.assets)) return { valid: false, errors: ['Manifest NASA incompatible.'] };
  const ids = new Set();
  for (const a of manifest.assets) {
    if (!a || typeof a.id !== 'string' || ids.has(a.id)) { errors.push('Invalid or duplicate resource ID.'); continue; }
    ids.add(a.id);
    if (typeof a.localPath !== 'string' || !/^assets\/(models|textures)\/nasa\/[a-zA-Z0-9_./-]+$/.test(a.localPath) || a.localPath.split('/').includes('..')) errors.push(`${a.id}: invalid local path.`);
    for (const key of ['label', 'body', 'role', 'format', 'sourceUrl', 'downloadUrl', 'credit', 'licenseUrl']) if (typeof a[key] !== 'string' || !a[key]) errors.push(`${a.id}: ${key} missing.`);
    for (const key of ['sourceUrl', 'downloadUrl', 'licenseUrl']) { try { if (new URL(a[key]).protocol !== 'https:') throw 0; } catch { errors.push(`${a.id}: invalid ${key} link.`); } }
    if (!Array.isArray(a.notes) || a.notes.some(n => typeof n !== 'string') || typeof a.available !== 'boolean') errors.push(`${a.id}: invalid metadata.`);
    if (NASA_MODEL_IDS.includes(a.id) && (String(a.format).toUpperCase() !== 'GLB' || !String(a.localPath).endsWith('.glb'))) errors.push(`${a.id}: local GLB required.`);
    if (a.available && (!Number.isSafeInteger(a.bytes) || a.bytes <= 0 || !/^[a-f0-9]{64}$/i.test(a.sha256))) errors.push(`${a.id}: integrity not published.`);
  }
  for (const id of NASA_MODEL_IDS) if (!ids.has(id)) errors.push(`${id}: asset missing.`);
  return { valid: errors.length === 0, errors };
}
// Refuse external buffers/textures before GLTFLoader can issue any additional requests.
export function assertEmbeddedGlb(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('Invalid GLB.');
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || length + 20 > buffer.byteLength) throw new Error('GLB without valid JSON.');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
  for (const item of [...(json.buffers || []), ...(json.images || [])]) if (item.uri && !item.uri.startsWith('data:')) throw new Error('The model requires external resources; it will not be loaded.');
  return json;
}
