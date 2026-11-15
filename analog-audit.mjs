// Módulo 2: motor puro, sin DOM/red. SI; referencias y límites en docs/modulo-2.md.
import { BODY_ENV } from './sim-physics.mjs';
import { compareTerrain } from './similarity.mjs';

export const CONTRACT_VERSION = '1.0.0';
export const AUDIT_VERSION = '1.0.0';
export const SIGMA = 5.670374419e-8; // W m⁻² K⁻⁴, NIST CODATA (redondeado)
export const SOURCES = Object.freeze({
  gravity: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
  moon: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
  mars: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
  weight: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/weight-equation-2/',
  thermal: 'https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/',
  sigma: 'https://physics.nist.gov/cgi-bin/cuu/Value?sigma',
  radiation: 'https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/',
});
export const LIMITS = Object.freeze([
  'La masa (kg) no cambia con el cuerpo; el peso es una fuerza (N).',
  'La descarga vertical iguala solo la carga estática sobre suelo horizontal; no reproduce inercia, dinámica, cohesión, confinamiento del suelo, tracción ni terramecánica.',
  'En rueda, la masa es la soportada por esa rueda; no se supone reparto uniforme. En taladro, no se calcula fuerza de corte, par ni empuje activo.',
  'Vacío, convección, radiación ionizante, química y polvo no se compensan con un factor universal. Se requieren ensayos específicos.',
  'Temperatura del aire, temperatura superficial y sumidero radiativo son magnitudes distintas. Ninguna se sustituye automáticamente por otra.',
  'No se evalúan Froude, velocidad, tiempo, dosis ni autorización GO/NO-GO; tampoco se certifica un sitio o instrumento.',
]);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clone = (v) => structuredClone(v);
const quantity = (value, unit, kind, source, observedAt = null) => ({ value: finite(value) ? value : null, unit, kind: finite(value) ? kind : 'unknown', source: source || null, observedAt });
const pressureRef = (body) => body === 'moon'
  ? quantity(0, 'Pa', 'idealization', SOURCES.moon) // vacío ideal; NO presión medida de la exosfera
  : body === 'mars' ? quantity(636, 'Pa', 'reference', SOURCES.mars) : quantity(null, 'Pa', 'unknown', null);
export function referencePressure(body) { return pressureRef(body); }

function adaptSite(grid, body, id, telemetry = null) {
  const env = BODY_ENV[body];
  const gravity = finite(grid?.environment?.gravityMs2) ? grid.environment.gravityMs2 : env?.gravityMs2;
  const source = body === 'moon' ? SOURCES.moon : body === 'mars' ? SOURCES.mars : SOURCES.gravity;
  const surface = grid?.thermal;
  const weather = telemetry && telemetry.site === id ? telemetry : null;
  const kind = weather?.provider === 'snapshot' || weather?.live !== true ? 'archive' : 'weather-model';
  // Solo presión de superficie explícita; nunca pressureMslPa ni texto "101 kPa".
  const localPressure = weather?.values?.surfacePressurePa;
  return {
    id: id || null, name: grid?.name || id || null, body,
    center: clone(grid?.center || null), environment: clone(grid?.environment || null),
    grid: grid ? { gridSize: grid.gridSize ?? null, spacingMeters: grid.spacingMeters ?? null,
      extentMeters: grid.extentMeters ?? null, nativeResolutionMeters: grid.nativeResolutionMeters ?? null,
      dataset: grid.dataset || null, source: grid.source || null, fetchedAt: grid.fetchedAt || null,
      license: grid.license || null, credit: grid.demCredit || null } : null,
    metrics: clone(grid?.metrics || null),
    gravity: quantity(gravity, 'm/s²', 'reference', source),
    pressure: body === 'earth' ? quantity(localPressure, 'Pa', kind, weather?.source?.url, weather?.observedAt) : pressureRef(body),
    airTemperature: quantity(body === 'earth' && finite(weather?.values?.temperatureC) ? weather.values.temperatureC + 273.15 : null,
      'K', kind, weather?.source?.url, weather?.observedAt),
    surfaceTemperature: { minK: surface?.minK ?? null, maxK: surface?.maxK ?? null, meanK: surface?.meanK ?? null,
      kind: surface?.kind || 'unknown', source: surface?.source || null },
    ionizingDoseRate: quantity(null, 'Sv/s', 'unknown', null),
    telemetry: clone(weather),
    provenance: clone(grid?.provenance || []), notes: clone(grid?.notes || []),
  };
}

/** Adaptador de los escenarios/rejillas reales de Atlas; no modifica sus entradas. */
export function buildCandidateAnalogPayload(input = {}) {
  const { scenario, earthGrid = null, targetGrid = null, telemetry = null } = input || {};
  return {
    schema: 'CandidateAnalogPayload', version: CONTRACT_VERSION,
    scenario: scenario ? { id: scenario.id, title: scenario.title, earthId: scenario.earthId, targetId: scenario.targetId, body: scenario.body, focus: scenario.focus || null } : null,
    earth: adaptSite(earthGrid, 'earth', scenario?.earthId, telemetry),
    target: adaptSite(targetGrid, scenario?.body, scenario?.targetId),
    adaptationWarnings: [
      ...(earthGrid && earthGrid.id !== scenario?.earthId ? ['La rejilla terrestre no corresponde al escenario.'] : []),
      ...(targetGrid && (targetGrid.id !== scenario?.targetId || targetGrid.body !== scenario?.body) ? ['La rejilla objetivo no corresponde al escenario.'] : []),
      ...(telemetry && telemetry.site !== scenario?.earthId ? ['Telemetría de otro sitio descartada.'] : []),
    ],
  };
}

/** Validación explícita en la frontera pública. Los desconocidos se representan por null. */
export function validateCandidateAnalogPayload(p) {
  const errors = [];
  if (p?.schema !== 'CandidateAnalogPayload' || p?.version !== CONTRACT_VERSION) errors.push('Contrato o versión no compatible.');
  if (!['id', 'title', 'earthId', 'targetId'].every(k => typeof p?.scenario?.[k] === 'string' && p.scenario[k].length > 0) || !['moon', 'mars'].includes(p.scenario.body)) errors.push('Escenario incompleto o cuerpo no compatible.');
  for (const side of ['earth', 'target']) {
    const s = p?.[side];
    if (!s || s.id !== p?.scenario?.[side === 'earth' ? 'earthId' : 'targetId'] || s.body !== (side === 'earth' ? 'earth' : p?.scenario?.body)) errors.push(`${side}: identidad incoherente.`);
    for (const [key, unit, min, max] of [['gravity', 'm/s²', 0.001, 100], ['pressure', 'Pa', 0, 1e9], ['airTemperature', 'K', 0.001, 5000], ['ionizingDoseRate', 'Sv/s', 0, 1e9]]) {
      const q = s?.[key];
      if (!q || q.unit !== unit || (q.value !== null && (!finite(q.value) || q.value < min || q.value > max)) || (q.value !== null && (typeof q.source !== 'string' || !q.source || q.kind === 'unknown')) || (q && !['reference', 'idealization', 'weather-model', 'archive', 'unknown'].includes(q.kind))) errors.push(`${side}.${key}: cantidad SI o procedencia inválida.`);
    }
    if (!Array.isArray(s?.provenance) || s.provenance.some(v => typeof v?.label !== 'string' || typeof v?.url !== 'string')) errors.push(`${side}.provenance: lista de fuentes inválida.`);
    if (!Array.isArray(s?.notes) || s.notes.some(v => typeof v !== 'string')) errors.push(`${side}.notes: lista de notas inválida.`);
    const th = s?.surfaceTemperature;
    if (!th || ['minK', 'maxK', 'meanK'].some(k => th[k] !== null && (!finite(th[k]) || th[k] <= 0 || th[k] > 5000))
      || (finite(th?.minK) && finite(th?.maxK) && th.minK > th.maxK)) errors.push(`${side}.surfaceTemperature: rango inválido.`);
    if (s?.grid && (!finite(s.grid.spacingMeters) || s.grid.spacingMeters <= 0 || !Number.isInteger(s.grid.gridSize) || s.grid.gridSize < 2
      || !finite(s.grid.extentMeters) || s.grid.extentMeters <= 0)) errors.push(`${side}.grid: escala inválida.`);
    if (s?.metrics) {
      for (const key of ['slopeP50Deg', 'slopeP90Deg', 'reliefP95P5M', 'triMeanM']) {
        const v = s.metrics[key];
        if (v != null && (!finite(v) || v < 0 || (key.startsWith('slope') && v > 90))) errors.push(`${side}.metrics.${key}: métrica inválida.`);
      }
    }
  }
  if (!Array.isArray(p?.adaptationWarnings) || p.adaptationWarnings.some(v => typeof v !== 'string')) errors.push('adaptationWarnings: lista inválida.');
  else errors.push(...p.adaptationWarnings.filter(v => v.startsWith('La rejilla')));
  return { valid: errors.length === 0, errors };
}

/** Calculadora independiente: todos los parámetros son hipótesis del usuario en SI. */
export function calibrateEngineering(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...calibrateEngineering(), valid: false, errors: [{ field: 'input', message: 'Parámetros de ingeniería deben ser un objeto.' }] };
  const values = {}, errors = [];
  const ranges = {
    massKg: [0, 1e7, true], earthGravityMs2: [0.001, 100], targetGravityMs2: [0.001, 100],
    earthPressurePa: [0, 1e9], targetPressurePa: [0, 1e9], areaM2: [0, 1e6, true],
    surfaceK: [0, 5000, true], airK: [0, 5000, true], surroundingsK: [0, 5000, true],
    hWm2K: [0, 1e5], emissivity: [0, 1],
  };
  for (const [key, [min, max, exclusive]] of Object.entries(ranges)) {
    const v = input[key];
    values[key] = v == null ? null : v;
    if (v != null && (!finite(v) || v < min || v > max || (exclusive && v === min))) {
      errors.push({ field: key, message: `${key}: debe ser un número ${exclusive ? 'mayor que' : 'desde'} ${min} hasta ${max} en SI.` });
      values[key] = null;
    }
  }
  const targetBody = input.targetBody ?? null;
  if (targetBody !== null && !['earth', 'moon', 'mars'].includes(targetBody)) errors.push({ field: 'targetBody', message: 'Cuerpo de cálculo no compatible.' });
  const equipment = input.equipment ?? 'rover';
  if (!['rover', 'wheel', 'drill'].includes(equipment)) errors.push({ field: 'equipment', message: 'Equipo no compatible.' });
  const v = values;
  const has = (...keys) => keys.every(k => finite(v[k]));
  const gravity = { earthWeightN: null, targetWeightN: null, targetToEarthRatio: null, offloadForceN: null, equivalentEarthMassKg: null };
  if (has('massKg', 'earthGravityMs2')) gravity.earthWeightN = v.massKg * v.earthGravityMs2;
  if (has('massKg', 'targetGravityMs2')) gravity.targetWeightN = v.massKg * v.targetGravityMs2;
  if (has('earthGravityMs2', 'targetGravityMs2')) gravity.targetToEarthRatio = v.targetGravityMs2 / v.earthGravityMs2;
  if (has('massKg', 'earthGravityMs2', 'targetGravityMs2')) {
    gravity.offloadForceN = v.massKg * (v.earthGravityMs2 - v.targetGravityMs2);
    gravity.equivalentEarthMassKg = v.massKg * gravity.targetToEarthRatio;
  }
  const pressure = { targetToEarthRatio: null, earthToTargetRatio: null, differencePa: null };
  if (has('earthPressurePa', 'targetPressurePa')) {
    pressure.differencePa = v.earthPressurePa - v.targetPressurePa;
    if (v.earthPressurePa > 0) pressure.targetToEarthRatio = v.targetPressurePa / v.earthPressurePa;
    if (v.targetPressurePa > 0) pressure.earthToTargetRatio = v.earthPressurePa / v.targetPressurePa;
    for (const key of ['targetToEarthRatio', 'earthToTargetRatio']) {
      if (pressure[key] !== null && !finite(pressure[key])) {
        pressure[key] = null;
        errors.push({ field: 'earthPressurePa', message: 'Razón de presión fuera del rango numérico representable; revisar ambas presiones.' });
      }
    }
  }
  const thermal = {
    convectionW: has('hWm2K', 'areaM2', 'surfaceK', 'airK') ? v.hWm2K * v.areaM2 * (v.surfaceK - v.airK) : null,
    radiationW: has('emissivity', 'areaM2', 'surfaceK', 'surroundingsK') ? v.emissivity * SIGMA * v.areaM2 * (v.surfaceK ** 4 - v.surroundingsK ** 4) : null,
    universalCorrectionFactor: null,
  };
  return { version: AUDIT_VERSION, valid: errors.length === 0, errors, equipment, targetBody, inputs: values, kind: 'user-assumption', gravity, pressure, thermal,
    formulas: ['W = m·g', 'r_g = g_obj/g_Tierra', 'F_descarga = m·(g_Tierra − g_obj)', 'm_equiv = m·r_g (solo carga estática)',
      'r_p = p_obj/p_Tierra (p_Tierra > 0)', 'Q_conv = h·A·(T_superficie − T_aire)', 'Q_rad = ε·σ·A·(T_superficie⁴ − T_entorno⁴)'],
    assumptions: ['Suelo horizontal, misma masa, soporte vertical cuasiestático; F_descarga positiva hacia arriba y negativa exige carga adicional.',
      'Q positiva = pérdida de calor. Superficie gris isotérmica en recinto negro grande, factor de vista 1; h explícito para el gas/ensayo, no derivado de presión.',
      'No es balance térmico completo: excluye conducción, Sol, albedo, disipación interna y transitorios. Vacío ideal externo: Q_conv = 0; Marte requiere h propio.'],
    limitations: [...LIMITS], sources: clone(SOURCES) };
}

const evidence = (path, data) => ({ path, data: clone(data ?? null) });
function row(id, label, status, strength, breakdown, action, evidences) {
  return { id, label, status, strength, breakdown, action, evidence: evidences };
}
export function auditAnalog(candidate, engineeringInputs = {}) {
  const validation = validateCandidateAnalogPayload(candidate);
  if (!validation.valid) return { schema: 'AnalogAuditResult', version: AUDIT_VERSION, valid: false, errors: validation.errors, matrix: [], calibration: null };
  const e = candidate.earth, t = candidate.target;
  const geometry = compareTerrain(e, t);
  const scaleKnown = !!e.grid && !!t.grid;
  const sameScale = scaleKnown && e.grid.gridSize === t.grid.gridSize && e.grid.spacingMeters === t.grid.spacingMeters && e.grid.extentMeters === t.grid.extentMeters;
  const nativeOK = [e, t].every(s => s.grid && finite(s.grid.nativeResolutionMeters) && s.grid.nativeResolutionMeters <= 2 * s.grid.spacingMeters && s.metrics?.comparable !== false);
  const gravityKnown = finite(e.gravity.value) && finite(t.gravity.value);
  const pressureKnown = finite(e.pressure.value) && finite(t.pressure.value);
  const matrix = [
    row('scale', 'Escala regional', !scaleKnown ? 'unknown' : sameScale && nativeOK ? 'valid' : 'partial',
      sameScale ? 'Misma ventana y muestreo: comparación regional reproducible.' : 'Las rejillas conservan su escala documentada.',
      'La rejilla no resuelve contactos rueda/suelo, rocas ni cavidades; resolución nativa e interpolación limitan el ensayo.',
      'Medir a la escala del instrumento antes de diseñar el ensayo.', [evidence('earth.grid', e.grid), evidence('target.grid', t.grid)]),
    row('geometry', 'Relieve · Strength vs. Breakdown', geometry.index === null ? 'unknown' : 'partial',
      geometry.index === null ? 'Sin métricas suficientes.' : `Índice geométrico ${geometry.index}/100; pendientes, desnivel y TRI documentados.`,
      'El índice no mide similitud física; rugosidad radar dB y CPR no son intercambiables.',
      'Usar componentes y advertencias para elegir tareas, sin umbral universal de validez.', [evidence('geometry', geometry)]),
    row('gravity', 'Gravedad y carga estática', !gravityKnown ? 'unknown' : e.gravity.value === t.gravity.value ? 'valid' : 'breakdown',
      'Se puede ajustar la carga estática con un soporte vertical para una masa explícita.',
      'La gravedad reducida no se reproduce en campo terrestre; descargar peso conserva la masa y su inercia.',
      'Calcular F=m·g y descarga; validar dinámica y terramecánica por separado.', [evidence('earth.gravity', e.gravity), evidence('target.gravity', t.gravity)]),
    row('atmosphere', 'Atmósfera y vacío', 'breakdown', 'El terreno permite ensayar geometría y procedimientos al aire libre.',
      t.body === 'moon' ? 'La atmósfera terrestre no reproduce el vacío lunar (exosfera). Cero Pa es una idealización de cálculo.' : 'La atmósfera terrestre no reproduce el gas CO₂ tenue de Marte. La referencia de presión no es una medición del sitio.',
      'Ensayar en cámara con composición/presión controladas; ningún escalar convierte aire terrestre en el objetivo.', [evidence('target.pressure', t.pressure), evidence('reference.atmosphere', t.body === 'moon' ? SOURCES.moon : SOURCES.mars)]),
    row('pressure', 'Presión local cuantitativa', pressureKnown ? 'partial' : 'unknown',
      pressureKnown ? 'Presiones explícitas permiten calcular diferencia y cocientes con denominador positivo.' : 'Sin presión absoluta local terrestre: diferencia y cociente desconocidos.',
      'No se transforma presión a nivel del mar en presión local ni se divide por cero lunar.',
      'Conservar presión absoluta local y su fecha; sin dato no se calcula diferencia. No implica equivalencia aerodinámica.', [evidence('earth.pressure', e.pressure), evidence('target.pressure', t.pressure)]),
    row('temperature', 'Temperatura aire / superficie', 'unknown', 'Se conserva el producto térmico del objetivo y la procedencia del clima terrestre.',
      'El aire terrestre no es temperatura superficial; no hay par superficial terrestre comparable ni serie sincronizada.',
      'Medir superficie, aire y sumidero radiativo por separado; conservar nulos (incluido mínimo de Shackleton).', [evidence('earth.airTemperature', e.airTemperature), evidence('earth.surfaceTemperature', e.surfaceTemperature), evidence('target.surfaceTemperature', t.surfaceTemperature)]),
    row('heat-transfer', 'Convección y radiación térmica', 'breakdown', 'Q_conv y Q_rad se pueden explorar con parámetros explícitos del ensayo.',
      'Vacío ideal: sin convección externa. Marte: coeficiente h desconocido. No hay factor térmico universal.',
      'Cámara térmica y modelo con geometría/materiales, conducción y fuentes de calor propias.', [evidence('reference.thermal', SOURCES.thermal)]),
    row('radiation', 'Radiación ionizante', 'breakdown', 'Se pueden ensayar operaciones y geometría de blindajes.',
      'Atmósfera y campo magnético terrestres alteran el entorno; irradiancia solar W/m² no es dosis ionizante. No hay dosimetría local.',
      'Caracterizar espectro, dosis y blindaje con ensayos específicos; sin corrección escalar ni dosis inventada.', [evidence('earth.ionizingDoseRate', e.ionizingDoseRate), evidence('target.ionizingDoseRate', t.ionizingDoseRate), evidence('reference.radiation', SOURCES.radiation)]),
    row('regolith', 'Regolito, polvo y subsuelo', 'unknown', 'El escenario aporta contexto regional para movilidad o perforación.',
      'No hay granulometría, cohesión, humedad de contacto ni resistencia mecánica de muestras; un DEM no las determina.',
      'Obtener muestras y ensayos mecánicos; no deducir hielo o blindaje a partir de relieve o CPR.', []),
  ];
  return { schema: 'AnalogAuditResult', version: AUDIT_VERSION, candidateVersion: candidate.version, scenarioId: candidate.scenario.id,
    valid: true, errors: [], geometry, matrix, counts: Object.fromEntries(['valid', 'partial', 'breakdown', 'unknown'].map(status => [status, matrix.filter(r => r.status === status).length])),
    calibration: calibrateEngineering(engineeringInputs && typeof engineeringInputs === 'object' && !Array.isArray(engineeringInputs)
      ? { earthGravityMs2: e.gravity.value, targetGravityMs2: t.gravity.value, targetBody: t.body, ...engineeringInputs } : engineeringInputs),
    limitations: [...LIMITS], sources: clone(SOURCES) };
}

export function createDossier(candidate, audit, exportedAt = new Date().toISOString()) {
  if (!validateCandidateAnalogPayload(candidate).valid || !audit?.valid || !audit.calibration?.valid || audit.scenarioId !== candidate.scenario.id) throw new TypeError('Dossier inválido o con parámetros sin corregir.');
  if (!Number.isFinite(Date.parse(exportedAt))) throw new TypeError('Fecha de exportación inválida.');
  return clone({ schema: 'AnalogAuditDossier', version: AUDIT_VERSION, exportedAt, candidate, audit,
    disclaimer: 'Auditoría exploratoria local; no certifica similitud física, seguridad ni aptitud de misión. Parámetros de calculadora son hipótesis del usuario.' });
}
const md = (v) => String(v ?? 'desconocido').replace(/[\\`*_[\]<>#|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
export function dossierMarkdown(dossier) {
  const { candidate: c, audit: a } = dossier;
  const lines = [`# Dossier local · ${md(c.scenario.title)}`, '', `Contrato ${md(c.version)} · Auditor ${md(a.version)} · ${md(dossier.exportedAt)}`, '',
    `${md(c.earth.name)} ↔ ${md(c.target.name)}`, '', md(dossier.disclaimer), '', '## Strength vs. Breakdown', '',
    '| Parámetro | Estado | Fortaleza | Ruptura | Acción |', '| --- | --- | --- | --- | --- |'];
  for (const r of a.matrix) lines.push(`| ${md(r.label)} | ${md(r.status)} | ${md(r.strength)} | ${md(r.breakdown)} | ${md(r.action)} |`);
  lines.push('', '## Cálculo de ensayo (SI; procedencia indicada en kind/origins)', '', '```json', JSON.stringify(a.calibration, null, 2), '```', '', '## Evidencia y procedencia', '');
  for (const r of a.matrix) for (const ev of r.evidence) lines.push(`- ${md(r.id)} / ${md(ev.path)}: ${md(JSON.stringify(ev.data))}`);
  for (const side of ['earth', 'target']) {
    lines.push('', `### ${side}`, '', `Telemetría: ${md(c[side].telemetry ? JSON.stringify(c[side].telemetry) : null)}`);
    for (const p of c[side].provenance) lines.push(`- ${md(p.label)}: ${md(p.url)}`);
    for (const n of c[side].notes) lines.push(`- ${md(n)}`);
  }
  lines.push('', '## Supuestos y límites', '', ...a.limitations.map(l => `- ${md(l)}`), '', '## Referencias', '', ...Object.entries(a.sources).map(([label, url]) => `- ${label}: ${url}`));
  return lines.join('\n') + '\n';
}
