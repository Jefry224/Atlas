// Vista accesible del módulo 2. El motor y la exportación no dependen de este archivo.
import { createNasaBench } from './nasa-bench.mjs';
import { automaticEngineering, createMissionRecorder, weatherState, RECORD_POLICY, missionDesignEngineering } from './mission-audit.mjs';
import { missionWorkbook } from './xlsx-report.mjs';
import { loadNasaManifest } from './nasa-stage.mjs';
import { BODY_ENV } from './sim-physics.mjs';
import { buildCandidateAnalogPayload, auditAnalog, referencePressure, createDossier, dossierMarkdown } from './analog-audit.mjs';
const LABEL = { valid: 'Válido en este alcance', partial: 'Parcial', breakdown: 'Ruptura', unknown: 'Desconocido' };
const BODY = { earth: 'Tierra', moon: 'Luna', mars: 'Marte' };
const fmt = (v, digits = 2) => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('es-ES', { maximumFractionDigits: digits }) : 'desconocido';
const node = (tag, text = '', cls = '') => {
  const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n;
};
const NUMERIC = ['massKg', 'earthPressurePa', 'targetPressurePa', 'areaM2', 'surfaceK', 'airK', 'surroundingsK', 'hWm2K', 'emissivity'];

export function createAuditPanel(root) {
  const form = root.querySelector('form');
  const field = (key) => form.elements.namedItem(key);
  let current = null, candidate = null, audit = null, automatic = null, manual = false;
  const recorder = createMissionRecorder();
  const liveStatus = root.querySelector('[data-m2-status]');
  const liveValues = root.querySelector('[data-m2-live-values]');
  const sourcesBox = root.querySelector('[data-m2-origins]');
  const originalToolsBox = root.querySelector('[data-m2-tools]');
  const toolsBox = node('div'); toolsBox.dataset.m2Tools = ''; originalToolsBox.replaceWith(toolsBox);
  const manualDetails = root.querySelector('[data-m2-manual]');
  const xlsxButton = root.querySelector('[data-m2-xlsx]');
  manualDetails.addEventListener('toggle', () => { manual = manualDetails.open; recompute(); });
  const beginSession = (scenario, reason) => { const session = recorder.begin(scenario, reason); liveStatus.textContent = `Misión: ${scenario.title} · sesión ${session.id} · preparando datos automáticos`; liveValues.textContent = ''; root.dataset.sessionId = session.id; root.dataset.roverSamples = '0'; root.dataset.weatherSamples = '0'; };
  const atomicSnapshot = () => ({ cutoffUTC: new Date().toISOString(), candidate: structuredClone(candidate), audit: structuredClone(automatic.audit), session: recorder.snapshot(), baseProfile: structuredClone(automatic.baseDesign.profile), visualPresentation: bench.presentation() });
  xlsxButton.addEventListener('click', async () => {
    if (!automatic?.audit.valid || !recorder.current) return;
    const snapshot = atomicSnapshot(); xlsxButton.disabled = true;
    try { snapshot.manifest = await loadNasaManifest(); const bytes = missionWorkbook(snapshot);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = node('a'); link.href = url; link.download = `Atlas-M2-${snapshot.candidate.scenario.id}-${snapshot.cutoffUTC.replace(/[:.]/g,'-')}.xlsx`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      recorder.event('export-xlsx', `Corte UTC ${snapshot.cutoffUTC}`);
    } catch (error) { errorsBox.hidden = false; errorsBox.textContent = `No se pudo generar Excel: ${error.message}`; }
    finally { xlsxButton.disabled = false; }
  });
  const summary = root.querySelector('[data-audit-summary]');
  const errorsBox = root.querySelector('[data-audit-errors]');
  const table = root.querySelector('.audit-table tbody');
  const outputs = root.querySelector('[data-audit-calculations]');
  const downloads = [...root.querySelectorAll('[data-audit-export]')];
  let selectedFactor = 'gravity', resetVisual = false;
  const bench = createNasaBench(root.querySelector('[data-nasa-bench]'), id => {
    selectedFactor = id;
    for (const button of table.querySelectorAll('[data-audit-factor]')) {
      const selected = button.dataset.auditFactor === id;
      button.setAttribute('aria-pressed', String(selected));
      button.closest('tr').classList.toggle('audit-factor-selected', selected);
    }
  });
  const dossierWithPresentation = () => {
    if (!automatic?.audit.valid) return null;
    const d = createDossier(candidate, automatic.audit);
    return { ...d, disclaimer: 'Auditoría automática de misión; referencias/modelos/configuración con ausencias explícitas. Sin GO/NO-GO.', mission: recorder.snapshot(), baseProfile: structuredClone(automatic.baseDesign.profile), visualPresentation: bench.presentation() };
  };
  const resetBody = () => {
    const body = field('targetBody').value;
    const p = referencePressure(body);
    field('targetPressurePa').value = p.value ?? '';
    root.querySelector('[data-pressure-reference]').textContent = body === 'moon'
      ? 'Objetivo de ensayo: 0 Pa = vacío ideal, no medición de la exosfera lunar.'
      : body === 'mars' ? 'Objetivo de ensayo: 636 Pa = referencia al radio medio de Marte; no presión de Jezero/Coprates.'
        : 'Tierra: introducí la presión absoluta del ensayo; no se supone nivel del mar.';
  };
  function recompute() {
    if (!current?.scenario) return;
    const input = { equipment: field('equipment').value, targetBody: field('targetBody').value };
    for (const key of NUMERIC) {
      const f = field(key);
      input[key] = f.validity.badInput ? NaN : f.value.trim() === '' ? null : Number(f.value);
    }
    input.earthGravityMs2 = candidate.earth.gravity.value;
    input.targetGravityMs2 = input.targetBody === candidate.target.body ? candidate.target.gravity.value : BODY_ENV[input.targetBody]?.gravityMs2;
    automatic = automaticEngineering(candidate);
    automatic.baseDesign = missionDesignEngineering(candidate);
    audit = manual ? auditAnalog(candidate, input) : automatic.audit;
    xlsxButton.disabled = !automatic.audit.valid;
    sourcesBox.replaceChildren();
    for (const [key, q] of Object.entries(automatic.origins)) {
      const tr = node('tr'); for (const value of [key, q.value === null && automatic.baseDesign.profile.thermal[key] ? `Base propuesta: ${fmt(automatic.baseDesign.profile.thermal[key].value)}; actual pendiente` : fmt(q.value), q.unit, q.value === null ? 'missing / base separada si aplica' : q.kind, q.value === null && automatic.baseDesign.profile.thermal[key] ? `Base: ${automatic.baseDesign.profile.thermal[key].source}; actual sin fuente/configuración` : q.source || 'Sin fuente', q.observedAt || 'Base de diseño: sin fecha de observación']) tr.append(node('td', value)); sourcesBox.append(tr);
    }
    const base = automatic.baseDesign;
    toolsBox.dataset.profileScenario = base.profile.scenarioId;
    toolsBox.replaceChildren();
    toolsBox.append(node('p', `Perfil base: ${base.profile.title} · v${base.profile.version} · revisión ${base.profile.revisionDate}. Propuesta de diseño, sin equipos conectados; valores por unidad. Los componentes incluidos forman parte de los 350 kg; kits y equipo de ensayo se mantienen separados.`));
    for (const tool of base.profile.tools) {
      const details = node('details'); details.dataset.baseTool = tool.id;
      details.append(node('summary', `${tool.name} · ×${tool.quantity} · ${tool.massScope}`));
      details.append(node('p', tool.purpose));
      const list = node('dl', '', 'audit-results');
      for (const p of tool.parameters) list.append(node('dt', p.label), node('dd', `${typeof p.value === 'number' ? (p.value !== 0 && Math.abs(p.value) < 0.0001 ? p.value.toExponential(3) : fmt(p.value, 4)) : p.value} ${p.unit} · ${p.kind} · ${p.rationale} Fuente: ${p.source}. Actual: ${tool.id === 'rover' && p.key === 'massKg' ? `${fmt(automatic.inputs.massKg)} kg, prototype-config` : 'no medido; instrumento propuesto sin conexión'}.`));
      details.append(list); toolsBox.append(details);
    }
    toolsBox.append(node('p', `Banco térmico base: área ${fmt(base.calibration.inputs.areaM2)} m², Ts ${fmt(base.calibration.inputs.surfaceK)} K, entorno y gas ${fmt(base.calibration.inputs.surroundingsK)} K, h ${fmt(base.calibration.inputs.hWm2K)} W/m²/K, ε ${fmt(base.calibration.inputs.emissivity)}. Q convección ${fmt(base.calibration.thermal.convectionW)} W y Q radiación ${fmt(base.calibration.thermal.radiationW)} W. ${base.scope} La térmica actual sigue incompleta hasta configurar o medir sus entradas.`));

    const c = audit.calibration;
    const errors = [...(audit.errors || []).map(message => ({ message })), ...(c?.errors || [])];
    for (const key of NUMERIC) field(key).setAttribute('aria-invalid', String(errors.some(e => e.field === key)));
    errorsBox.textContent = errors.map(e => e.message).join(' ');
    errorsBox.hidden = !errors.length;
    for (const button of downloads) button.disabled = !automatic.audit.valid;
    summary.textContent = audit.valid
      ? `${candidate.earth.name} ↔ ${candidate.target.name} · ${Object.entries(audit.counts).map(([s, n]) => `${n} ${LABEL[s].toLowerCase()}`).join(' · ')}. Validez limitada al alcance de cada fila; no hay nota física global.`
      : `Auditoría no disponible: ${errors.map(e => e.message).join(' ')}`;
    table.replaceChildren();
    for (const r of audit.matrix) {
      const tr = node('tr');
      const th = node('th'); th.scope = 'row';
      const factor = node('button', r.label, 'audit-factor-button'); factor.type = 'button'; factor.dataset.auditFactor = r.id;
      factor.setAttribute('aria-label', `Inspeccionar ${r.label} en banco 3D`); factor.setAttribute('aria-pressed', String(selectedFactor === r.id));
      factor.addEventListener('click', () => { bench.selectFactor(r.id); root.querySelector('[data-nasa-bench]').scrollIntoView({ block: 'start' }); root.querySelector('#bench-factor').focus({ preventScroll: true }); }); th.append(factor);
      tr.classList.toggle('audit-factor-selected', selectedFactor === r.id);
      const status = node('td'); status.append(node('span', LABEL[r.status], `audit-status audit-${r.status}`));
      const strength = node('td', r.strength), breakdown = node('td', r.breakdown), action = node('td', r.action);
      const details = node('details'); details.append(node('summary', `Evidencia (${r.evidence.length})`));
      details.append(node('pre', r.evidence.length ? JSON.stringify(r.evidence, null, 2) : 'Sin mediciones disponibles.'));
      breakdown.append(details); tr.append(th, status, strength, breakdown, action); table.append(tr);
    }
    bench.update(c, candidate, resetVisual); resetVisual = false;
    outputs.replaceChildren();
    if (!c) return;
    const title = node('p', `Cálculo de ensayo: ${BODY[c.targetBody]} · ${manual ? 'LABORATORIO HIPOTÉTICO: aislado del reporte y registro' : 'configuración de misión automática / referencias'}. La matriz corresponde siempre a ${BODY[candidate.target.body]}.`, 'audit-calculation-note');
    const dl = node('dl', '', 'audit-results');
    const add = (label, value, unit = '', digits = 2) => { dl.append(node('dt', label), node('dd', `${fmt(value, digits)}${value === null ? '' : ` ${unit}`}`)); };
    add('Masa del equipo / masa soportada', c.inputs.massKg, 'kg');
    add('Gravedad Tierra / referencia', c.inputs.earthGravityMs2, 'm/s²');
    add('Gravedad del ensayo objetivo', c.inputs.targetGravityMs2, 'm/s²');
    add('Peso terrestre · m·g', c.gravity.earthWeightN, 'N');
    add('Peso en el objetivo · m·g', c.gravity.targetWeightN, 'N');
    add('Razón g_obj / g_Tierra', c.gravity.targetToEarthRatio, '', 5);
    add('Descarga vertical (positiva hacia arriba)', c.gravity.offloadForceN, 'N');
    add('Masa equivalente en Tierra (solo carga estática)', c.gravity.equivalentEarthMassKg, 'kg');
    add('Diferencia p_Tierra − p_obj', c.pressure.differencePa, 'Pa');
    add('Razón p_obj / p_Tierra', c.pressure.targetToEarthRatio, '', 6);
    add('Razón p_Tierra / p_obj (p_obj > 0)', c.pressure.earthToTargetRatio, '', 3);
    add('Q convección del ensayo', c.thermal.convectionW, 'W');
    add('Q radiación térmica del ensayo', c.thermal.radiationW, 'W');
    outputs.append(title, dl);
    root.querySelector('[data-audit-calculation-status]').textContent = errors.length ? 'Laboratorio: revisá las hipótesis; el reporte conserva la configuración automática de misión.'
      : `Cálculo actualizado para ${BODY[c.targetBody]}. Peso objetivo ${fmt(c.gravity.targetWeightN)} N, descarga vertical ${fmt(c.gravity.offloadForceN)} N. Solo carga estática.`;
    const limits = node('ul', '', 'audit-limits');
    for (const text of [...c.assumptions, ...c.limitations]) limits.append(node('li', text));
    outputs.append(limits);
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', recompute);
  field('targetBody').addEventListener('change', () => { resetBody(); recompute(); });
  root.querySelector('[data-audit-reset]').addEventListener('click', () => {
    resetVisual = true; form.reset(); field('targetBody').value = current.scenario.body; resetBody(); recompute();
  });
  for (const button of downloads) button.addEventListener('click', () => {
    if (!automatic?.audit.valid) return;
    const dossier = dossierWithPresentation();
    const markdown = button.dataset.auditExport === 'md';
    const visualMarkdown = `

## Presentación del banco 3D

Modo: ${dossier.visualPresentation.mode === 'equivalent' ? 'masa terrestre equivalente (inercia distinta)' : 'misma masa con soporte vertical'}. Factor: ${dossier.visualPresentation.factor}. Referencia visual: ${dossier.visualPresentation.roverReference}. Mallas normalizadas; no son fuente científica ni equivalencia física global.
`;
    const blob = new Blob([markdown ? dossierMarkdown(dossier) + visualMarkdown : JSON.stringify(dossier, null, 2)], { type: markdown ? 'text/markdown;charset=utf-8' : 'application/json' });
    const url = URL.createObjectURL(blob), link = node('a');
    link.href = url; link.download = `selene-modulo2-${candidate.scenario.id}.${markdown ? 'md' : 'json'}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  return {
    update(data) {
      const changed = current?.scenario?.id !== data.scenario?.id;
      current = data;
      candidate = buildCandidateAnalogPayload(data);
      if (changed || !recorder.current) { beginSession(data.scenario); manualDetails.open = false; manual = false; resetVisual = true; form.reset(); field('targetBody').value = data.scenario.body; resetBody(); }
      recorder.weather(data.telemetry);
      recompute();
    },
    restart(reason = 'mission-reset') { if (current?.scenario) { beginSession(current.scenario, reason); recorder.weather(current.telemetry); } },
    event(type, detail) { recorder.event(type, detail); },
    tick(rover, extra = {}, sync = {}) {
      if (!current?.scenario || !automatic) return;
      recorder.sample(rover, extra);
      const session = recorder.current, t = current.telemetry, state = weatherState(t);
      const age = t?.observedAt ? Math.max(0, (Date.now() - Date.parse(t.observedAt))/1000) : null;
      liveStatus.textContent = `Misión: ${current.scenario.title} · ${current.scenario.body} · sesión ${session.id} · última sincronización UTC ${new Date().toISOString()} · clima ${state} · observación ${t?.observedAt || 'sin fecha'}${Number.isFinite(age) ? ` (antigüedad ${Math.round(age/60)} min)` : ''} · ${sync.busy ? 'consultando clima' : sync.nextAt ? `próxima consulta ${new Date(sync.nextAt).toISOString()}` : 'esperando consulta'} · ${session.rover.length} muestras rover / ${session.weather.length} observaciones clima.`;
      liveValues.textContent = `SIM acelerado ×20: ${fmt(rover.elapsed, 1)} s · posición ${fmt(rover.x)} / ${fmt(rover.z)} m · rumbo ${fmt(rover.heading)}° · velocidad ${fmt(rover.speed)} m/s · distancia ${fmt(rover.distance)} m · batería ${fmt(rover.battery)}% · pendiente ${fmt(extra.slopeDeg)}° · consumo ${fmt(extra.loadW)} W. UTC y tiempo SIM son relojes separados.`;
      root.dataset.sessionId = session.id; root.dataset.roverSamples = session.rover.length; root.dataset.weatherSamples = session.weather.length;
    },
    snapshot: atomicSnapshot,
    dossier: dossierWithPresentation,
    dispose() { bench.dispose(); },
    context() {
      if (!audit?.valid) return null;
      const c = automatic.audit.calibration;
      return { version: audit.version, scenarioId: audit.scenarioId, counts: audit.counts,
        matrix: audit.matrix.map(({ id, status, breakdown }) => ({ id, status, breakdown })),
        calibration: c?.valid ? { kind: c.kind, equipment: c.equipment, targetBody: c.targetBody, massKg: c.inputs.massKg,
          gravity: c.gravity, pressure: c.pressure, thermal: c.thermal } : null,
        limitation: 'Carga estática solamente; sin equivalencia dinámica, térmica ni de radiación. No certifica GO/NO-GO.' };
    },
  };
}
