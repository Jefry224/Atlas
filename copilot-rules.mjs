// A.R.E.S. Twin · copiloto local por reglas (sin IA), fallback de POST /api/copilot.
// Módulo ES puro. Devuelve la misma forma que el backend (docs/contracts.md §3) con
// provider "rules". Solo usa números presentes en el contexto (§5); si falta algo, lo dice.
import { BODY_ENV, solarPowerW } from './sim-physics.mjs';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const fmt = (v, d = 1) => (finite(v) ? Number(v.toFixed(d)).toLocaleString('es-ES') : '—');
const kToC = (k) => k - 273.15;
const BODY_LABEL = { earth: 'Tierra', moon: 'Luna', mars: 'Marte' };

export const DISCLAIMER = 'Respuesta generada por reglas locales (sin IA), solo con los datos del contexto. Umbrales ilustrativos del prototipo; no sustituye un análisis de ingeniería ni de seguridad.';

const INTENTS = {
  thermal: /termic|temperatur|calor|frio|congel|helad|thermal|temperature|heat|cold|freez/,
  energy: /energ|bateri|battery|solar|power|potencia|carga|charg|panel|irradian/,
  terrain: /pendient|vuelco|volc|inclin|navega|ruta|terreno|slope|tip|rollover|pitch|roll|navigat|route|terrain|cabece|alabeo/,
  wind: /viento|polvo|rafaga|tormenta|wind|dust|gust|storm/,
  similarity: /similit|similar|compar|analog|parec|indice|index|match/,
  summary: /resumen|estado|general|summary|status|overview|go\s*\/?\s*no|despliegue|deploy|riesgo|risk/,
};

const normalize = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function detectIntents(question) {
  const q = normalize(question);
  const found = Object.keys(INTENTS).filter((k) => k !== 'summary' && INTENTS[k].test(q));
  return found.length ? found : ['summary'];
}

function telemetryProvenance(t) {
  if (!t) return 'sin telemetría';
  if (t.live === true) return `en vivo · ${t.provider || 'proveedor desconocido'}${t.cached ? `, caché ${fmt(t.ageSeconds, 0)} s` : ''}`;
  if (t.provider === 'snapshot') return `snapshot guardado${t.observedAt ? ` del ${t.observedAt}` : ''}, no en vivo`;
  return `no en vivo · ${t.provider || 'origen desconocido'}`;
}
const THERMAL_KIND = { live: 'en vivo', diviner: 'LRO Diviner', literature: 'literatura', model: 'modelo' };
const thermalProvenance = (th) => (th ? `${THERMAL_KIND[th.kind] || th.kind || 'origen sin etiquetar'}${th.source ? ` · ${th.source}` : ''}` : 'sin dato');

function makeReport(ctx) {
  const grounded = new Set();
  const missing = new Set();
  const use = (path) => { const v = get(ctx, path); if (v === undefined || v === null) { missing.add(path); return undefined; } grounded.add(path); return v; };
  const num = (path) => { const v = get(ctx, path); if (finite(v)) { grounded.add(path); return v; } missing.add(path); return undefined; };
  return { grounded, missing, use, num };
}

function thermalSection(ctx, r, flags) {
  const lines = [];
  const level = r.use('rover.thermal.level');
  const margin = r.num('rover.thermal.marginK');
  if (level) {
    lines.push(`Rover: estado térmico ${level.toUpperCase()}${finite(margin) ? `, margen ${fmt(margin, 0)} K` : ''}${ctx.rover?.thermal?.text ? ` — ${ctx.rover.thermal.text.replace(/\.$/, '')}` : ''}.`);
    if (level === 'critical') flags.nogo.push('térmico fuera de rango');
    else if (level === 'caution') flags.caution.push('margen térmico reducido');
  }
  const tC = r.num('earth.telemetry.values.temperatureC');
  if (finite(tC)) lines.push(`Análogo terrestre: ${fmt(tC)} °C (${telemetryProvenance(ctx.earth?.telemetry)}).`);
  const et = ctx.earth?.thermal;
  if (et && finite(et.minK) && finite(et.maxK)) { r.use('earth.thermal'); lines.push(`Análogo terrestre, rango de referencia: ${fmt(kToC(et.minK), 0)} a ${fmt(kToC(et.maxK), 0)} °C (${thermalProvenance(et)}).`); }
  const tt = ctx.target?.thermal;
  if (tt && finite(tt.minK) && finite(tt.maxK)) {
    r.use('target.thermal');
    lines.push(`Objetivo ${ctx.target?.name || ''}: ${fmt(tt.minK, 0)}–${fmt(tt.maxK, 0)} K (${fmt(kToC(tt.minK), 0)} a ${fmt(kToC(tt.maxK), 0)} °C; ${thermalProvenance(tt)}).`.replace('  ', ' '));
    if (tt.minK < 233) lines.push('En el objetivo, el mínimo cae bajo −40 °C: un rover con esta ventana operativa necesitaría calefacción o hibernación; el análogo terrestre no reproduce ese frío.');
  } else r.missing.add('target.thermal');
  if (!lines.length) lines.push('Sin datos térmicos en el contexto: no se puede evaluar el riesgo térmico.');
  return { title: 'Riesgo térmico', lines };
}

function energySection(ctx, r, flags) {
  const lines = [];
  const bat = r.num('rover.batteryPct');
  const solar = r.num('rover.solarW');
  if (finite(bat)) {
    lines.push(`Batería del rover: ${fmt(bat, 0)} %${finite(solar) ? `; generación solar simulada ${fmt(solar, 0)} W` : ''}.`);
    if (bat < 15) flags.nogo.push('batería < 15 %'); else if (bat < 30) flags.caution.push('batería < 30 %');
  } else if (finite(solar)) lines.push(`Generación solar simulada: ${fmt(solar, 0)} W.`);
  const irr = r.num('earth.telemetry.values.solarRadiationWm2');
  if (finite(irr)) {
    const cloud = get(ctx, 'earth.telemetry.values.cloudCoverPct');
    if (finite(cloud)) r.use('earth.telemetry.values.cloudCoverPct');
    lines.push(`Radiación en el análogo: ${fmt(irr, 0)} W/m²${finite(cloud) ? `, nubosidad ${fmt(cloud, 0)} %` : ''} (${telemetryProvenance(ctx.earth?.telemetry)}). Con 2 m² al 28 %: ≈ ${fmt(solarPowerW({ irradianceWm2: irr }), 0)} W.`);
  }
  const body = ctx.target?.body;
  const sc = finite(ctx.target?.environment?.solarConstantWm2) ? (r.use('target.environment.solarConstantWm2'), ctx.target.environment.solarConstantWm2) : BODY_ENV[body]?.solarConstantWm2;
  if (finite(sc)) {
    lines.push(`Objetivo (${BODY_LABEL[body] || body}): constante solar ${fmt(sc, 0)} W/m² ⇒ cota superior ≈ ${fmt(solarPowerW({ irradianceWm2: sc }), 0)} W con el mismo panel a incidencia normal (sin atmósfera, polvo ni ángulo solar real).`);
    if (body === 'moon' && /shackleton|polar|sur/i.test(`${ctx.target?.id} ${ctx.target?.name}`)) lines.push('En el polo sur lunar el Sol es rasante y hay sombra permanente: la potencia real puede ser muy inferior o nula.');
  }
  if (!lines.length) lines.push('Sin datos de batería ni de radiación en el contexto: no se puede evaluar el balance energético.');
  return { title: 'Energía', lines };
}

function terrainSection(ctx, r, flags) {
  const lines = [];
  const pitch = r.num('rover.pitchDeg'), roll = r.num('rover.rollDeg'), slope = r.num('rover.slopeDeg');
  if (finite(pitch) || finite(roll)) lines.push(`Actitud: cabeceo ${fmt(pitch)}°, alabeo ${fmt(roll)}°${finite(slope) ? `, pendiente local ${fmt(slope)}°` : ''}.`);
  else if (finite(slope)) lines.push(`Pendiente local: ${fmt(slope)}°.`);
  const tilt = Math.max(Math.abs(finite(pitch) ? pitch : 0), Math.abs(finite(roll) ? roll : 0), finite(slope) ? slope : 0);
  if (tilt >= 25) { flags.nogo.push('inclinación ≥ 25°'); lines.push('Inclinación ≥ 25° (umbral ilustrativo): riesgo de vuelco; recomendar retroceder y replanificar la ruta.'); }
  else if (tilt >= 12) { flags.caution.push('inclinación ≥ 12°'); lines.push('Inclinación ≥ 12° (umbral ilustrativo): reducir velocidad y evitar travesías en ladera.'); }
  else if (finite(pitch) || finite(roll) || finite(slope)) lines.push('Inclinación por debajo de 12°: regional baja, pero el DEM de ~30 m no ve rocas ni bloques.');
  const e90 = r.num('earth.metrics.slopeP90Deg'), t90 = r.num('target.metrics.slopeP90Deg');
  if (finite(e90) || finite(t90)) lines.push(`Pendiente p90 de la ventana: Tierra ${fmt(e90)}° vs objetivo ${fmt(t90)}°.`);
  if (!lines.length) lines.push('Sin actitud del rover ni métricas de pendiente en el contexto.');
  return { title: 'Pendiente y navegación', lines };
}

function windSection(ctx, r, flags) {
  const lines = [];
  const w = r.num('earth.telemetry.values.windSpeedMs');
  const g = get(ctx, 'earth.telemetry.values.windGustMs');
  if (finite(g)) r.use('earth.telemetry.values.windGustMs');
  if (finite(w) || finite(g)) {
    lines.push(`Viento en el análogo: ${fmt(w)} m/s${finite(g) ? `, ráfagas ${fmt(g)} m/s` : ''} (${telemetryProvenance(ctx.earth?.telemetry)}).`);
    const peak = Math.max(finite(w) ? w : 0, finite(g) ? g : 0);
    if (peak >= 15) { flags.caution.push('ráfagas ≥ 15 m/s'); lines.push('Ráfagas ≥ 15 m/s (umbral ilustrativo): polvo en suspensión, riesgo para óptica y paneles.'); }
  } else lines.push('Sin datos de viento del análogo en el contexto.');
  const body = ctx.target?.body;
  if (body === 'moon') lines.push('Objetivo lunar: sin viento; el riesgo de polvo es el regolito adherido electrostáticamente, que el análogo no reproduce.');
  if (body === 'mars') lines.push('Objetivo marciano: atmósfera tenue (≈ 0.6 kPa); el viento empuja poco pero transporta polvo fino. No hay viento en vivo del objetivo en este contexto.');
  return { title: 'Viento y polvo', lines };
}

function similaritySection(ctx, r) {
  const lines = [];
  const s = ctx.similarity;
  if (s && typeof s === 'object') {
    r.use('similarity');
    lines.push(finite(s.index) ? `Índice de similitud geométrica: ${fmt(s.index, 0)}/100${s.comparable === false ? ' (no comparable a escala, orientativo)' : ''}.` : 'Índice de similitud geométrica no disponible (faltan métricas).');
    for (const c of (s.components || []).slice(0, 5)) lines.push(`· ${c.label}: Tierra ${fmt(c.earth, 2)}${c.unit && c.unit !== '°' ? ' ' : ''}${c.unit || ''} vs objetivo ${fmt(c.target, 2)}${c.unit && c.unit !== '°' ? ' ' : ''}${c.unit || ''} → ${fmt(c.score, 0)}/100 (peso ${fmt(c.weight * 100, 0)} %).`);
    if (Array.isArray(s.caveats) && s.caveats.length) lines.push(`Advertencia: ${s.caveats[0]}`);
  } else {
    r.missing.add('similarity');
    lines.push('Sin cálculo de similitud en el contexto. Recordatorio: sería solo geométrica, nunca planetaria.');
  }
  return { title: 'Similitud geométrica', lines };
}

/**
 * answerLocally(question, context) → { answer, provider:"rules", model:"rules-v1", grounded, generatedAt, disclaimer }.
 * Nunca lanza: con contexto vacío responde qué datos faltan.
 */
export function answerLocally(question, context) {
  const ctx = context && typeof context === 'object' ? context : {};
  const r = makeReport(ctx);
  const flags = { nogo: [], caution: [] };
  const intents = detectIntents(question);
  const all = intents.includes('summary') ? ['thermal', 'energy', 'terrain', 'wind', 'similarity'] : intents;
  const builders = { thermal: thermalSection, energy: energySection, terrain: terrainSection, wind: windSection, similarity: similaritySection };
  let sections;
  try {
    sections = all.map((k) => builders[k](ctx, r, flags));
  } catch {
    sections = [{ title: 'Estado', lines: ['Contexto con formato inesperado: no se pudo generar el informe.'] }];
  }

  const scen = ctx.scenario || {};
  const header = `FLIGHT DIRECTOR · ${scen.title || 'Escenario sin identificar'}`
    + (ctx.earth?.name || ctx.target?.name ? ` (${ctx.earth?.name || '¿Tierra?'} ↔ ${ctx.target?.name || '¿objetivo?'})` : '');
  if (scen.title) r.use('scenario.title');
  const body = sections.map((s) => `${s.title.toUpperCase()}\n${s.lines.map((l) => (l.startsWith('·') ? `  ${l}` : `- ${l}`)).join('\n')}`).join('\n\n');

  let verdict;
  if (flags.nogo.length) verdict = `NO-GO (ilustrativo): ${flags.nogo.join('; ')}.`;
  else if (flags.caution.length) verdict = `GO con precauciones (ilustrativo): ${flags.caution.join('; ')}.`;
  else if (r.grounded.size) verdict = 'GO (ilustrativo) con los datos disponibles; sin alertas en los umbrales del prototipo.';
  else verdict = 'Sin datos suficientes para recomendar GO/NO-GO.';

  const missingTop = [...r.missing].filter((p) => !r.grounded.has(p));
  const gaps = missingTop.length ? `\n\nDatos no disponibles en el contexto: ${missingTop.slice(0, 8).join(', ')}${missingTop.length > 8 ? '…' : ''}.` : '';

  return {
    answer: `${header}\n\n${body}\n\nRECOMENDACIÓN\n- ${verdict}${gaps}`,
    provider: 'rules',
    model: 'rules-v1',
    grounded: [...r.grounded],
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
  };
}
