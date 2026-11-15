// Presentation-only projections. Scientific values come from the M2 calibration and target JSON.
export const NASA_MODEL_IDS = ['scarecrow', 'perseverance', 'moon', 'mars', 'lro', 'block-island', 'apollo-11'];
export const BENCH_MODES = ['offload', 'equivalent'];
export const FACTOR_EXPLANATIONS = {
  gravity: 'Ruedas y carga: el peso cambia con g. El soporte descarga verticalmente; reducir masa también cambia la inercia. El suelo terrestre conserva su gravedad.',
  atmosphere: 'Gas y viento terrestre con dirección geográfica. La velocidad del proveedor no determina densidad, arrastre ni flujo del objetivo.',
  pressure: 'Recintos de presión absoluta, vectores normales en escala logarítmica y diferencia en Pa. Vacío ideal lunar y 636 Pa marcianos son referencias, no mediciones del sitio.',
  temperature: 'Equipo, gas y entorno radiativo son temperaturas distintas, separadas del rango superficial del objetivo. Columnas en K, sin vectores de fuerza.',
  'heat-transfer': 'Canales de convección y radiación térmica: dirección según el signo y largo proporcional a W. Sin conducción ni equilibrio térmico completo.',
  radiation: 'Irradiancia solar y dosis ionizante en canales separados. No se infiere blindaje ni dosis desde W/m².',
  regolith: 'Contacto rueda–suelo: el plano es un esquema. No contiene propiedades mecánicas del regolito, cohesión, granulometría ni hundimiento.',
  geometry: 'Comparación de los DEM reales con escalas compartidas y exageración vertical explícita. La geometría regional no caracteriza el contacto de una rueda.',
  scale: 'Píxel nativo, paso de rejilla y extensión son magnitudes distintas. La malla NASA conserva su escala visual normalizada, sin dimensiones de ensayo.',
};
const finite = v => typeof v === 'number' && Number.isFinite(v);
export function benchState(calibration, mode = 'offload') {
  if (!BENCH_MODES.includes(mode)) throw new Error('Modo de ensayo desconocido.');
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
  if (![lat, lon, radius].every(finite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || radius <= 0) throw new Error('Coordenadas geográficas inválidas.');
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
    if (!a || typeof a.id !== 'string' || ids.has(a.id)) { errors.push('ID de recurso inválido o duplicado.'); continue; }
    ids.add(a.id);
    if (typeof a.localPath !== 'string' || !/^assets\/(models|textures)\/nasa\/[a-zA-Z0-9_./-]+$/.test(a.localPath) || a.localPath.split('/').includes('..')) errors.push(`${a.id}: ruta local inválida.`);
    for (const key of ['label', 'body', 'role', 'format', 'sourceUrl', 'downloadUrl', 'credit', 'licenseUrl']) if (typeof a[key] !== 'string' || !a[key]) errors.push(`${a.id}: ${key} ausente.`);
    for (const key of ['sourceUrl', 'downloadUrl', 'licenseUrl']) { try { if (new URL(a[key]).protocol !== 'https:') throw 0; } catch { errors.push(`${a.id}: enlace ${key} inválido.`); } }
    if (!Array.isArray(a.notes) || a.notes.some(n => typeof n !== 'string') || typeof a.available !== 'boolean') errors.push(`${a.id}: metadatos inválidos.`);
    if (NASA_MODEL_IDS.includes(a.id) && (String(a.format).toUpperCase() !== 'GLB' || !String(a.localPath).endsWith('.glb'))) errors.push(`${a.id}: se exige GLB local.`);
    if (a.available && (!Number.isSafeInteger(a.bytes) || a.bytes <= 0 || !/^[a-f0-9]{64}$/i.test(a.sha256))) errors.push(`${a.id}: integridad no publicada.`);
  }
  for (const id of NASA_MODEL_IDS) if (!ids.has(id)) errors.push(`${id}: recurso ausente.`);
  return { valid: errors.length === 0, errors };
}
// Refuse external buffers/textures before GLTFLoader can issue any additional requests.
export function assertEmbeddedGlb(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('GLB inválido.');
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || length + 20 > buffer.byteLength) throw new Error('GLB sin JSON válido.');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
  for (const item of [...(json.buffers || []), ...(json.images || [])]) if (item.uri && !item.uri.startsWith('data:')) throw new Error('El modelo requiere recursos externos; no se cargará.');
  return json;
}
