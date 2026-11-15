// A.R.E.S. Twin · índice de similitud GEOMÉTRICA entre dos rejillas (docs/contracts.md §4).
// Módulo ES puro. Compara solo métricas medidas con scripts/terrain_metrics.py sobre la
// ventana estándar (2400 m, 65×65, 37.5 m). Nunca es «similitud planetaria».
//
// Puntuación por componente (simétrica y acotada a [0, 100]):
//   score = 100 · exp(−|ln(a′ / b′)|) = 100 · min(a′, b′) / max(a′, b′)
//   con a′ = max(a, floor), b′ = max(b, floor). El suelo `floor` evita divisiones por cero y
//   hace que dos valores casi nulos (terreno llano) puntúen alto en lugar de dispararse.
// Rugosidad en dB (escala logarítmica, puede ser negativa): score = 100 · exp(−|a − b| / 5 dB).
// Índice = Σ wᵢ·scoreᵢ / Σ wᵢ sobre los componentes disponibles (pesos renormalizados a 1).

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Pesos editoriales del prototipo (suman 1 con rugosidad; se renormalizan si falta). */
export const SIMILARITY_COMPONENTS = Object.freeze([
  { key: 'slopeP50Deg', label: 'Pendiente mediana (p50)', unit: '°', weight: 0.30, floor: 0.1 },
  { key: 'slopeP90Deg', label: 'Pendiente p90', unit: '°', weight: 0.25, floor: 0.1 },
  { key: 'reliefP95P5M', label: 'Desnivel p95–p5', unit: 'm', weight: 0.20, floor: 1 },
  { key: 'triMeanM', label: 'TRI medio', unit: 'm', weight: 0.15, floor: 0.05 },
]);
export const ROUGHNESS_WEIGHT = 0.10;
export const THERMAL_WEIGHT = 0.15;
const THERMAL_FLOOR = 1;
const DB_SCALE = 5;

export const GEOMETRY_CAVEAT = 'Índice de similitud geométrica, no planetaria: la geometría del relieve no reproduce gravedad, regolito, iluminación ni química.';
export const THERMAL_CAVEAT = 'Amplitud térmica: compara la oscilación diurna (Tierra: aire 2 m, climatología ERA5; objetivo: temperatura de superficie Diviner/MCD). Premia a los sitios terrestres de mayor oscilación; las magnitudes no coinciden (gravedad, atmósfera, superficie vs aire), no afirma equivalencia física.';

/** Amplitud térmica diaria en K de una rejilla/contexto (§2/§5), o null. */
export function thermalAmplitudeK(o) {
  const t = o && typeof o === 'object' ? o.thermal : null;
  if (!t || typeof t !== 'object') return null;
  if (finite(t.amplitudeK)) return Math.abs(t.amplitudeK);
  if (finite(t.maxK) && finite(t.minK)) return Math.abs(t.maxK - t.minK);
  return null;
}

/** Puntuación relativa simétrica 0–100. */
export function ratioScore(a, b, floor = 0) {
  if (!finite(a) || !finite(b)) return null;
  const x = Math.max(Math.abs(a), floor), y = Math.max(Math.abs(b), floor);
  if (x === 0 && y === 0) return 100;
  if (x === 0 || y === 0) return 0;
  return 100 * Math.exp(-Math.abs(Math.log(x / y)));
}

const metricsOf = (o) => {
  if (!o || typeof o !== 'object') return null;
  if (o.metrics && typeof o.metrics === 'object') return o.metrics;
  return 'slopeP50Deg' in o ? o : null;
};
const nameOf = (o, fallback) => (o && (o.name || o.id)) || fallback;

/**
 * compareTerrain(earth, target) → { index, comparable, components, caveats }.
 * Acepta la rejilla completa (§2), el objeto de contexto (§5) o directamente `metrics`.
 */
export function compareTerrain(earth, target) {
  const me = metricsOf(earth), mt = metricsOf(target);
  const caveats = [GEOMETRY_CAVEAT];
  const components = [];
  const missing = [];

  if (!me || !mt) {
    if (!me) caveats.push(`Faltan métricas del análogo terrestre (${nameOf(earth, 'Tierra')}).`);
    if (!mt) caveats.push(`Faltan métricas del objetivo (${nameOf(target, 'objetivo')}).`);
    return { index: null, comparable: false, components, caveats };
  }

  for (const c of SIMILARITY_COMPONENTS) {
    const a = me[c.key], b = mt[c.key];
    if (!finite(a) || !finite(b)) { missing.push(c.label); continue; }
    components.push({ key: c.key, label: c.label, unit: c.unit, earth: a, target: b, score: ratioScore(a, b, c.floor), weight: c.weight });
  }

  const re = me.roughness, rt = mt.roughness;
  if (re && rt && finite(re.value) && finite(rt.value)) {
    if (re.unit && re.unit === rt.unit) {
      const isDb = /^db$/i.test(String(re.unit).trim());
      const score = isDb ? 100 * Math.exp(-Math.abs(re.value - rt.value) / DB_SCALE) : ratioScore(re.value, rt.value, 0);
      components.push({ key: 'roughness', label: `Rugosidad (${re.unit})`, unit: re.unit, earth: re.value, target: rt.value, score, weight: ROUGHNESS_WEIGHT });
    } else {
      caveats.push(`Rugosidad excluida: unidades distintas (${re.unit || 'sin unidad'} vs ${rt.unit || 'sin unidad'}); radar terrestre y Mini-RF no son directamente comparables.`);
    }
  } else {
    caveats.push('Rugosidad radar no disponible en ambos sitios: no entra en el índice.');
  }

  const ae = thermalAmplitudeK(earth), at = thermalAmplitudeK(target);
  if (finite(ae) && finite(at)) {
    components.push({ key: 'thermalAmplitudeK', label: 'Amplitud térmica diaria', unit: 'K', earth: ae, target: at, score: ratioScore(ae, at, THERMAL_FLOOR), weight: THERMAL_WEIGHT });
    caveats.push(THERMAL_CAVEAT);
  }

  // Renormaliza pesos entre los componentes disponibles para que sumen 1.
  const total = components.reduce((s, c) => s + c.weight, 0);
  for (const c of components) {
    c.weight = total > 0 ? c.weight / total : 0;
    c.score = c.score === null ? null : Math.round(c.score * 10) / 10;
  }

  let index = null;
  if (missing.length) {
    caveats.push(`Índice no calculado: faltan métricas (${missing.join(', ')}).`);
  } else if (components.length) {
    index = Math.round(components.reduce((s, c) => s + c.weight * c.score, 0));
  }

  const comparable = me.comparable !== false && mt.comparable !== false;
  if (!comparable) {
    const which = [me.comparable === false && nameOf(earth, 'Tierra'), mt.comparable === false && nameOf(target, 'objetivo')].filter(Boolean).join(' y ');
    caveats.push(`No comparable a escala: la resolución nativa de ${which} es más gruesa que 2× la rejilla (dato interpolado); el índice es solo orientativo.`);
  }
  caveats.push('Pesos editoriales del prototipo, no calibrados frente a misiones reales.');

  return { index, comparable, components, caveats };
}
