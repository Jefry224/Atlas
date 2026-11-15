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
  landing: /aterriz|descens|landing|combustible|propelente|fuel|zona.{0,12}contacto|contacto/,
  breakdown: /ruptura|gravedad|peso|calibra|descarga|presion|vacio|ionizante|breakdown|offload|gravity|vacuum/,
  thermal: /termic|temperatur|calor|frio|congel|helad|thermal|temperature|heat|cold|freez/,
  energy: /energ|bateri|battery|solar|power|potencia|carga|charg|panel|irradian/,
  terrain: /pendient|vuelco|volc|inclin|navega|ruta|terreno|slope|tip|rollover|pitch|roll|navigat|route|terrain|cabece|alabeo/,
  wind: /viento|polvo|rafaga|tormenta|wind|dust|gust|storm/,
  similarity: /similit|similar|compar|analog|parec|indice|index|match/,
  window: /ventana|cuando|pronostic|72 ?h|probar|saltacion|proceso|forecast|window|when/,
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

const WINDOW_KIND = { thermal: 'térmica (forma de la curva diurna)', aeolian: 'eólica (saltación)', freeze: 'congelamiento', cold: 'fría (mínimo térmico con la menor radiación)' };
function localTime(iso, offset) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms + (finite(offset) ? offset : 0) * 1000);
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return `${days[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
}
function windowSection(ctx, r) {
  const lines = [];
  const p = ctx.processes;
  if (!p || typeof p !== 'object') {
    r.missing.add('processes');
    lines.push('Sin pronóstico de 72 h en el contexto: no se puede indicar una ventana de pruebas.');
    return { title: 'Ventana de pruebas (72 h)', lines };
  }
  r.use('processes');
  const off = p.utcOffsetSeconds;
  lines.push(`Pronóstico: ${p.live ? `en vivo · ${p.provider || 'proveedor'}` : `archivado (${p.provider || 'snapshot'}), las horas pueden haber pasado`}. Horas locales del análogo${p.timezone ? ` (${p.timezone})` : ''}.`);
  if (p.best) {
    const w = p.best;
    lines.push(`Ventana recomendada: ${WINDOW_KIND[w.kind] || w.kind}, ${localTime(w.start, off)} → ${localTime(w.end, off)} (${fmt(w.hours, 0)} h)${finite(w.score) ? `, coincidencia ${fmt(w.score, 0)}/100` : ''}${w.phase ? `, fase de ${w.phase}` : ''}.`);
  } else lines.push('No hay ventana que cumpla los umbrales en las próximas 72 h.');
  const others = [...(p.thermalWindows || []), ...(p.aeolianWindows || [])].filter((w) => w && (!p.best || w.start !== p.best.start)).slice(0, 2);
  for (const w of others) lines.push(`· Alternativa ${WINDOW_KIND[w.kind] || w.kind}: ${localTime(w.start, off)} → ${localTime(w.end, off)} (${fmt(w.hours, 0)} h).`);
  if (p.currentSaltation) lines.push(`Saltación ahora: ${({ sustained: 'sostenida', intermittent: 'intermitente (ráfagas)', suppressed: 'inhibida por humedad', none: 'no activa', unknown: 'sin dato' })[p.currentSaltation] || p.currentSaltation}.`);
  if (finite(p.freezeEvents)) lines.push(`Cruces de 0 °C en superficie en 72 h: ${fmt(p.freezeEvents, 0)}${finite(p.freezeThawCycles) ? ` (ciclos hielo-deshielo: ${fmt(p.freezeThawCycles, 0)})` : ''}.`);
  if (Array.isArray(p.caveats) && p.caveats[1]) lines.push(`Advertencia: ${p.caveats[1]}`);
  return { title: 'Ventana de pruebas (72 h)', lines };
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

function breakdownSection(ctx, r) {
  const a = ctx.analogyAudit;
  if (!a) { r.missing.add('analogyAudit'); return { title: 'Ruptura de analogía', lines: ['Sin auditoría del módulo 2 en el contexto.'] }; }
  r.use('analogyAudit');
  const lines = ['Auditoría local: estados por parámetro, sin índice físico global.'];
  for (const row of (a.matrix || []).filter(row => row.status === 'breakdown' || row.status === 'unknown').slice(0, 9)) lines.push(`${row.id}: ${row.status} — ${row.breakdown}`);
  const c = a.calibration;
  if (c) {
    r.use('analogyAudit.calibration');
    lines.push(`Equipo de ensayo: ${c.equipment}; cuerpo del cálculo ${BODY_LABEL[c.targetBody] || c.targetBody}; ${c.kind === 'mission-config' ? 'configuración de misión (prototype-config) y referencias con ausencias explícitas' : 'parámetros como hipótesis del usuario'}.`);
    if (finite(c.massKg)) lines.push(`Masa ${fmt(c.massKg, 2)} kg; no cambia con la gravedad.`);
    if (finite(c.gravity?.targetWeightN)) lines.push(`Peso objetivo ${fmt(c.gravity.targetWeightN, 2)} N; descarga vertical ${fmt(c.gravity.offloadForceN, 2)} N; razón g_obj/g_Tierra ${fmt(c.gravity.targetToEarthRatio, 5)}.`);
    else lines.push('Carga estática sin datos suficientes.');
  } else lines.push('Calibración sin parámetros válidos; corregir las entradas.');
  lines.push(a.limitation || 'La descarga solo iguala carga estática; no reproduce dinámica, terramecánica, vacío ni radiación.');
  return { title: 'Ruptura de analogía', lines };
}


function landingSection(ctx,r) {
  const root=ctx.landing ? 'landing' : 'analogyAudit.landing';
  const l=r.use(root),lines=[];
  if (!l) return {title:'Descenso final',lines:['Sin ensayo de descenso en la sesión actual: faltan perfiles, plan regional y estados simulados. No se infiere contacto ni combustible disponible.']};
  lines.push(`Fase de misión: ${r.use(root+'.phase')}; UTC inicio ${r.use(root+'.startedAtUTC') || 'no aportado'}. UTC y SIM descenso son independientes del SIM rover ×20.`);
  const targetFirst=l.missionMode==='target-first';
  if (targetFirst) {
    r.use(root+'.missionMode'); r.use(root+'.primarySide');
    const origins=r.use(root+'.explorationOrigins'),mirror=r.use(root+'.mirrorAvailable');
    lines.push('Elegimos el destino lunar/marciano porque allí desciende la nave y su contacto nominal gobierna despliegue y exploración. El usuario elige zona y combustible del objetivo; Tierra prepara y ensaya el control del rover sin elegir un segundo aterrizaje.');
    lines.push(origins?.earth ? `Origen de ensayo Tierra: x ${fmt(origins.earth.x)} m, z ${fmt(origins.earth.z)} m; DEM ${origins.earth.gridId}, rol ${origins.earth.role}. Referencia en superficie, sin contacto de nave.` : 'Sin origen de ensayo Tierra válido: el descenso objetivo es independiente; el espejo queda limitado.');
    lines.push(origins?.target ? `Origen del objetivo: contacto propio x ${fmt(origins.target.x)} m, z ${fmt(origins.target.z)} m; DEM ${origins.target.gridId}, rol ${origins.target.role}.` : 'Sin contacto nominal objetivo: no se habilita despliegue ni exploración.');
    lines.push(`Espejo ${mirror?'disponible':'limitado: requiere ambos orígenes y contacto objetivo'}; posición objetivo = contactoTarget + (roverEarth − origenEarth). Cada cuerpo mantiene su georreferencia; no hay homología geográfica.`);
  }
  for (const side of targetFirst?['target','earth']:['earth','target']) {
    if (targetFirst && side==='earth') {
      lines.push('Tierra análogo/referencia: No aplica: sin descenso terrestre. El perfil/plan terrestre es referencia; el rover de ensayo conserva cuerpo y coordenadas terrestres. Clima terrestre e instrumentos propuestos no son lecturas del planeta; no hay telemetría de hardware real.');
      continue;
    }
    const run=r.use(`${root}.runs.${side}`), profile=r.use(`${root}.profiles.${side}`), plan=r.use(`${root}.plans.${side}`);
    const label=side==='earth'?'Tierra virtual':'Objetivo';
    if (!run) {lines.push(`${label}: sin estado de nave; revisar disponibilidad del DEM/perfil. No se infiere un resultado.`);continue;}
    lines.push(`${label}: fase ${run.phase || 'no aportada'}, SIM ${fmt(run.simSeconds)} s; AGL ${fmt(run.altitudeM)} m; velocidad vertical ${fmt(run.verticalSpeedMs)} m/s y horizontal ${fmt(run.horizontalSpeedMs)} m/s. Propelente ${fmt(run.propellantKg)} kg; empuje ${fmt(run.thrustN)} N.`);
    if (run.outcome) lines.push(`Resultado del modelo ${label}: ${typeof run.outcome==='object'?JSON.stringify(run.outcome):run.outcome}.`);
    if (run.contact) lines.push(`Chequeo de contacto propuesto ${label}: ${run.contact.withinTolerances===true?'dentro de las tolerancias del modelo':run.contact.withinTolerances===false?'fuera de las tolerancias del modelo':'resultado de tolerancias no aportado'}. No certifica terreno.`);
    if (profile) {
      lines.push(`Perfil nave ${profile.id}: masa seca ${fmt(profile.dryMassKg)} kg, propelente inicial ${fmt(profile.propellantKg)} kg, Isp ${fmt(profile.ispSeconds)} s, empuje máximo ${fmt(profile.thrustMaxN)} N. Propuesta separada del rover de 350 kg.`);
      lines.push(`Tolerancias propuestas: contacto vertical ${fmt(profile.touchdownVerticalSpeedMs)} m/s, horizontal ${fmt(profile.touchdownHorizontalSpeedMs)} m/s, inclinación ${fmt(profile.touchdownTiltDeg)}°. No son límites certificados.`);
      const sources=profile.sources || profile.source;
      if (sources) lines.push(`Fuentes de perfil ${label}: ${typeof sources==='object'?JSON.stringify(sources):sources}.`);
    } else lines.push(`${label}: perfil no aportado; no se pueden contrastar rangos ni capacidad de combustible.`);
    if (plan) lines.push(`Plan ${label}: DEM ${plan.gridId || 'sin ID'}, selección ${plan.selectedId || 'ninguna; candidatos no evaluables/no elegidos'}. Tierra y objetivo conservan puntos propios; no se presume homología geográfica.`);
    else lines.push(`${label}: sin plan regional; no se determina zona de contacto.`);
    for (const key of ['altitudeM','verticalSpeedMs','horizontalSpeedMs','propellantKg','thrustN']) if (!finite(run[key])) r.missing.add(`${root}.runs.${side}.${key}`);
  }
  lines.push('El análogo sirve para preparar operaciones y comparar geometría regional; gravedad, atmósfera/vacío y radiación requieren ensayos específicos. DEM de paso 37.5 m no resuelve patas, rocas ni cavidades. Navegación idealizada inspirada en referencias; sin TRN/visión NASA implementados. Marte solo tramo propulsado final, sin entrada ni paracaídas; Luna sin atmósfera.');
  for (const limit of (l.limitations || []).slice(0,5)) if (typeof limit==='string') lines.push(limit);
  return {title:'Descenso final simulado',lines};
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
  const all = intents.includes('summary') ? ['thermal', 'energy', 'terrain', 'wind', 'similarity', ...(ctx.analogyAudit ? ['breakdown'] : []), ...(ctx.landing || ctx.analogyAudit?.landing ? ['landing'] : []), ...(ctx.processes ? ['window'] : [])] : intents;
  const builders = { landing: landingSection, breakdown: breakdownSection, thermal: thermalSection, energy: energySection, terrain: terrainSection, wind: windSection, similarity: similaritySection, window: windowSection };
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
  if (all.includes('landing')) verdict = 'Misión y ensayo simulado exploratorios; el estado de vuelo y sus tolerancias no autorizan operaciones ni certifican un aterrizaje.';
  else if (all.includes('breakdown') && !flags.nogo.length && !flags.caution.length) verdict = 'Ensayo pendiente de validación específica; la auditoría no autoriza GO/NO-GO.';
  else if (flags.nogo.length) verdict = `NO-GO (ilustrativo): ${flags.nogo.join('; ')}.`;
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
