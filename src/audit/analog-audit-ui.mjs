// Vista accesible del módulo 2. El motor y la exportación no dependen de este archivo.
import { compactLanding, landingMarkdown } from '../landing/landing-report.mjs';
import { createNasaBench } from './nasa-bench.mjs';
import { automaticEngineering, createMissionRecorder, weatherState, RECORD_POLICY, missionDesignEngineering } from './mission-audit.mjs';
import { missionWorkbook } from './xlsx-report.mjs';
import { loadNasaManifest } from './nasa-stage.mjs';
import { BODY_ENV } from '../shared/sim-physics.mjs';
import { buildCandidateAnalogPayload, auditAnalog, referencePressure, createDossier, dossierMarkdown } from './analog-audit.mjs';
const LABEL = { valid: 'Valid within this scope', partial: 'Partial', breakdown: 'Breakdown', unknown: 'Unknown' };
const BODY = { earth: 'Earth', moon: 'Moon', mars: 'Mars' };
const fmt = (v, digits = 2) => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: digits }) : 'unknown';
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
  const beginSession = (scenario, reason) => { const session = recorder.begin(scenario, reason); liveStatus.textContent = `Mission: ${scenario.title} · session ${session.id} · preparing automatic data`; liveValues.textContent = ''; root.dataset.sessionId = session.id; root.dataset.roverSamples = '0'; root.dataset.weatherSamples = '0'; };
  const atomicSnapshot = () => {
    const session = recorder.snapshot();
    return { cutoffUTC: new Date().toISOString(), candidate: structuredClone(candidate), audit: structuredClone(automatic.audit), session, landing: structuredClone(session?.landing ?? null), baseProfile: structuredClone(automatic.baseDesign.profile), visualPresentation: bench.presentation() };
  };
  xlsxButton.addEventListener('click', async () => {
    if (!automatic?.audit.valid || !recorder.current) return;
    const snapshot = atomicSnapshot(); xlsxButton.disabled = true;
    try { snapshot.manifest = await loadNasaManifest(); const bytes = missionWorkbook(snapshot);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = node('a'); link.href = url; link.download = `Atlas-M2-${snapshot.candidate.scenario.id}-${snapshot.cutoffUTC.replace(/[:.]/g,'-')}.xlsx`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (recorder.current?.id === snapshot.session.id) recorder.event('export-xlsx', `Corte UTC ${snapshot.cutoffUTC}`);
    } catch (error) { errorsBox.hidden = false; errorsBox.textContent = `Could not generate Excel: ${error.message}`; }
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
  }, id => {
    manualDetails.open = true;
    const input = field(({ gravity: 'massKg', regolith: 'massKg', pressure: 'earthPressurePa', temperature: 'surfaceK', 'heat-transfer': 'areaM2' })[id]);
    input?.scrollIntoView({ block: 'center' }); input?.focus({ preventScroll: true });
  });
  const dossierWithPresentation = () => {
    if (!automatic?.audit.valid) return null;
    const d = createDossier(candidate, automatic.audit);
    const session = recorder.snapshot();
    return { ...d, landing: structuredClone(session?.landing ?? null), disclaimer: 'Automatic mission audit; references/models/configuration with explicit gaps. No GO/NO-GO.', mission: session, baseProfile: structuredClone(automatic.baseDesign.profile), visualPresentation: bench.presentation() };
  };
  const resetBody = () => {
    const body = field('targetBody').value;
    const p = referencePressure(body);
    field('targetPressurePa').value = p.value ?? '';
    root.querySelector('[data-pressure-reference]').textContent = body === 'moon'
      ? 'Test target: 0 Pa = ideal vacuum, not a measurement of the lunar exosphere.'
      : body === 'mars' ? 'Test target: 636 Pa = reference at Mars mean radius; not Jezero/Coprates pressure.'
        : 'Earth: enter the absolute test pressure; sea level is not assumed.';
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
      const tr = node('tr'); for (const value of [key, q.value === null && automatic.baseDesign.profile.thermal[key] ? `Proposed baseline: ${fmt(automatic.baseDesign.profile.thermal[key].value)}; actual pending` : fmt(q.value), q.unit, q.value === null ? 'missing / separate baseline if applicable' : q.kind, q.value === null && automatic.baseDesign.profile.thermal[key] ? `Baseline: ${automatic.baseDesign.profile.thermal[key].source}; actual has no source/configuration` : q.source || 'No source', q.observedAt || 'Design baseline: no observation date']) tr.append(node('td', value)); sourcesBox.append(tr);
    }
    const base = automatic.baseDesign;
    toolsBox.dataset.profileScenario = base.profile.scenarioId;
    toolsBox.replaceChildren();
    toolsBox.append(node('p', `Baseline profile: ${base.profile.title} · v${base.profile.version} · revision ${base.profile.revisionDate}. Design proposal, no connected equipment; values per unit. Included components are part of the 350 kg; kits and test equipment are kept separate.`));
    for (const tool of base.profile.tools) {
      const details = node('details'); details.dataset.baseTool = tool.id;
      details.append(node('summary', `${tool.name} · ×${tool.quantity} · ${tool.massScope}`));
      details.append(node('p', tool.purpose));
      const list = node('dl', '', 'audit-results');
      for (const p of tool.parameters) list.append(node('dt', p.label), node('dd', `${typeof p.value === 'number' ? (p.value !== 0 && Math.abs(p.value) < 0.0001 ? p.value.toExponential(3) : fmt(p.value, 4)) : p.value} ${p.unit} · ${p.kind} · ${p.rationale} Source: ${p.source}. Actual: ${tool.id === 'rover' && p.key === 'massKg' ? `${fmt(automatic.inputs.massKg)} kg, prototype-config` : 'not measured; proposed instrument, not connected'}.`));
      details.append(list); toolsBox.append(details);
    }
    toolsBox.append(node('p', `Baseline thermal bench: area ${fmt(base.calibration.inputs.areaM2)} m², Ts ${fmt(base.calibration.inputs.surfaceK)} K, surroundings and gas ${fmt(base.calibration.inputs.surroundingsK)} K, h ${fmt(base.calibration.inputs.hWm2K)} W/m²/K, ε ${fmt(base.calibration.inputs.emissivity)}. Q convection ${fmt(base.calibration.thermal.convectionW)} W and Q radiation ${fmt(base.calibration.thermal.radiationW)} W. ${base.scope} The actual thermal state stays incomplete until its inputs are configured or measured.`));

    const c = audit.calibration;
    const errors = [...(audit.errors || []).map(message => ({ message })), ...(c?.errors || [])];
    for (const key of NUMERIC) field(key).setAttribute('aria-invalid', String(errors.some(e => e.field === key)));
    errorsBox.textContent = errors.map(e => e.message).join(' ');
    errorsBox.hidden = !errors.length;
    for (const button of downloads) button.disabled = !automatic.audit.valid;
    summary.textContent = audit.valid
      ? `${candidate.earth.name} ↔ ${candidate.target.name} · ${Object.entries(audit.counts).map(([s, n]) => `${n} ${LABEL[s].toLowerCase()}`).join(' · ')}. Validity limited to the scope of each row; there is no global physical score.`
      : `Audit unavailable: ${errors.map(e => e.message).join(' ')}`;
    table.replaceChildren();
    for (const r of audit.matrix) {
      const tr = node('tr');
      const th = node('th'); th.scope = 'row';
      const factor = node('button', r.label, 'audit-factor-button'); factor.type = 'button'; factor.dataset.auditFactor = r.id;
      factor.setAttribute('aria-label', `Inspect ${r.label} on the 3D bench`); factor.setAttribute('aria-pressed', String(selectedFactor === r.id));
      factor.addEventListener('click', () => { bench.selectFactor(r.id); root.querySelector('[data-nasa-bench]').scrollIntoView({ block: 'start' }); root.querySelector('#bench-factor').focus({ preventScroll: true }); }); th.append(factor);
      tr.classList.toggle('audit-factor-selected', selectedFactor === r.id);
      const status = node('td'); status.append(node('span', LABEL[r.status], `audit-status audit-${r.status}`));
      const strength = node('td', r.strength), breakdown = node('td', r.breakdown), action = node('td', r.action);
      const details = node('details'); details.append(node('summary', `Evidence (${r.evidence.length})`));
      details.append(node('pre', r.evidence.length ? JSON.stringify(r.evidence, null, 2) : 'No measurements available.'));
      breakdown.append(details); tr.append(th, status, strength, breakdown, action); table.append(tr);
    }
    bench.update(c, candidate, resetVisual, { manual, baseCalibration: base.calibration, grids: { earth: current.earthGrid, target: current.targetGrid } }); resetVisual = false;
    outputs.replaceChildren();
    if (!c) return;
    const title = node('p', `Test calculation: ${BODY[c.targetBody]} · ${manual ? 'HYPOTHETICAL LAB: isolated from the report and log' : 'automatic mission configuration / references'}. The matrix always refers to ${BODY[candidate.target.body]}.`, 'audit-calculation-note');
    const dl = node('dl', '', 'audit-results');
    const add = (label, value, unit = '', digits = 2) => { dl.append(node('dt', label), node('dd', `${fmt(value, digits)}${value === null ? '' : ` ${unit}`}`)); };
    add('Equipment mass / supported mass', c.inputs.massKg, 'kg');
    add('Earth gravity / reference', c.inputs.earthGravityMs2, 'm/s²');
    add('Target test gravity', c.inputs.targetGravityMs2, 'm/s²');
    add('Earth weight · m·g', c.gravity.earthWeightN, 'N');
    add('Weight at target · m·g', c.gravity.targetWeightN, 'N');
    add('Ratio g_target / g_Earth', c.gravity.targetToEarthRatio, '', 5);
    add('Vertical offload (positive upward)', c.gravity.offloadForceN, 'N');
    add('Equivalent Earth mass (static load only)', c.gravity.equivalentEarthMassKg, 'kg');
    add('Difference p_Earth − p_target', c.pressure.differencePa, 'Pa');
    add('Ratio p_target / p_Earth', c.pressure.targetToEarthRatio, '', 6);
    add('Ratio p_Earth / p_target (p_target > 0)', c.pressure.earthToTargetRatio, '', 3);
    add('Test Q convection', c.thermal.convectionW, 'W');
    add('Test Q thermal radiation', c.thermal.radiationW, 'W');
    outputs.append(title, dl);
    root.querySelector('[data-audit-calculation-status]').textContent = errors.length ? 'Lab: review the hypotheses; the report keeps the automatic mission configuration.'
      : `Calculation updated for ${BODY[c.targetBody]}. Target weight ${fmt(c.gravity.targetWeightN)} N, vertical offload ${fmt(c.gravity.offloadForceN)} N. Static load only.`;
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

## 3D bench presentation

Mode: ${dossier.visualPresentation.mode === 'equivalent' ? 'equivalent Earth mass (different inertia)' : 'same mass with vertical support'}. Factor: ${dossier.visualPresentation.factor}. Gravity method applicable to the factor: ${dossier.visualPresentation.methodRelevant ? 'yes' : 'no'}. Inspector source: ${dossier.visualPresentation.inspectionSource === 'design' ? 'proposed baseline design, unmeasured' : dossier.visualPresentation.inspectionSource === 'manual' ? 'manual hypotheses isolated from the report' : 'mission configuration and sources'}. Visual reference: ${dossier.visualPresentation.roverReference}. Normalized NASA meshes; they are not a scientific source or a global physical equivalence. Exploring the inspector does not modify this automatic audit.
`;
    const blob = new Blob([markdown ? dossierMarkdown(dossier) + landingMarkdown(dossier.landing) + visualMarkdown : JSON.stringify(dossier, null, 2)], { type: markdown ? 'text/markdown;charset=utf-8' : 'application/json' });
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
    landing(payload) { return recorder.landing(payload); },
    tick(rover, extra = {}, sync = {}) {
      if (!current?.scenario || !automatic) return;
      recorder.sample(rover, extra);
      const session = recorder.current, t = current.telemetry, state = weatherState(t);
      const age = t?.observedAt ? Math.max(0, (Date.now() - Date.parse(t.observedAt))/1000) : null;
      liveStatus.textContent = `Mission: ${current.scenario.title} · ${current.scenario.body} · session ${session.id} · last sync UTC ${new Date().toISOString()} · Earth weather ${state} · observation ${t?.observedAt || 'undated'}${Number.isFinite(age) ? ` (age ${Math.round(age/60)} min)` : ''} · ${sync.busy ? 'querying weather' : sync.nextAt ? `next query ${new Date(sync.nextAt).toISOString()}` : 'awaiting query'} · ${session.rover.length} rover samples / ${session.weather.length} weather observations.`;
      liveValues.textContent = `Earth rover · simulated test/control · SIM accelerated ×20: ${fmt(rover.elapsed, 1)} s · position ${fmt(rover.x)} / ${fmt(rover.z)} m · heading ${fmt(rover.heading)}° · speed ${fmt(rover.speed)} m/s · distance ${fmt(rover.distance)} m · battery ${fmt(rover.battery)}% · slope ${fmt(extra.slopeDeg)}° · load ${fmt(extra.loadW)} W. UTC and SIM time are separate clocks.`;
      root.dataset.sessionId = session.id; root.dataset.roverSamples = session.rover.length; root.dataset.weatherSamples = session.weather.length;
    },
    snapshot: atomicSnapshot,
    dossier: dossierWithPresentation,
    dispose() { bench.dispose(); },
    context() {
      if (!automatic?.audit.valid) return null;
      const c = automatic.audit.calibration;
      return { version: automatic.audit.version, scenarioId: automatic.audit.scenarioId, counts: automatic.audit.counts,
        landing: compactLanding(recorder.current?.landing),
        roverBody: 'earth', targetBody: current?.scenario.body,
        roles: { earth: 'analogue-test-origin', target: 'target-contact', weather: 'earth-provider-model', instruments: 'proposed-design-no-hardware' },
        matrix: automatic.audit.matrix.map(({ id, status, breakdown }) => ({ id, status, breakdown })),
        calibration: c?.valid ? { kind: c.kind, equipment: c.equipment, targetBody: c.targetBody, massKg: c.inputs.massKg,
          gravity: c.gravity, pressure: c.pressure, thermal: c.thermal } : null,
        limitation: 'Static load only; no dynamic, thermal or radiation equivalence. Does not certify GO/NO-GO.' };
    },
  };
}
