import { FACTOR_EXPLANATIONS } from './nasa-visual-math.mjs';
import { prefixElementIds } from './scoped-ids.mjs';
import { buildBenchInspection, BENCH_COLORS, inspectionValue as value } from './bench-inspection.mjs';
import { inspectionVisual } from './bench-visuals.mjs';
import { NasaStage, THREE, mesh, schematic, disposeObject, loadNasaManifest } from './nasa-stage.mjs';
const BODY = { earth: 'Earth', moon: 'Moon', mars: 'Mars' };
export function createNasaBench(root, onFactor, onConfigure, { idPrefix = '' } = {}) {
  root.innerHTML = `<div class="nasa-section-head"><div><p class="eyebrow">M2 / TEST INSPECTOR</p><h3>Understand the difference. Prepare the test.</h3><p data-bench-context>Choose a scenario to prepare the test.</p></div><span class="outline-tag">9 FACTORS · VISIBLE EVIDENCE</span></div>
    <div class="nasa-bench-layout"><div class="nasa-bench-setup">
      <label for="bench-factor">01 · What do you want to inspect?<select id="bench-factor" aria-describedby="bench-factor-note"><option value="gravity">Gravity / load</option><option value="atmosphere">Atmosphere and wind</option><option value="pressure">Absolute pressure</option><option value="temperature">Temperatures</option><option value="heat-transfer">Heat flows</option><option value="radiation">Solar and ionizing radiation</option><option value="regolith">Regolith contact</option><option value="geometry">Relief of both sites</option><option value="scale">Resolution and scale</option></select></label>
      <label for="bench-mode">Bench method<select id="bench-mode"><option value="offload">01 · Same mass + vertical support</option><option value="equivalent">02 · Equivalent Earth mass</option></select></label>
      <p data-bench-method></p>
      <label for="bench-source" data-bench-source-control hidden>Chart thermal data<select id="bench-source"><option value="mission">Current mission configuration</option><option value="design">Explore proposed baseline design</option></select></label>
      <p data-bench-source-note></p>
      <details class="nasa-model-control"><summary>Visual reference model</summary><label for="bench-model">NASA rover<select id="bench-model"><option value="perseverance">Perseverance · NASA model</option><option value="scarecrow">Scarecrow · lightened rover</option></select></label><p class="nasa-history">Normalized mesh for context. It does not define prototype mass, dimensions or properties. Scarecrow illustrates a precedent of lightened-rover testing.</p></details>
      <p class="nasa-inspection-question" data-bench-question></p><a href="#audit-heading" class="nasa-edit-link">View mission configuration and provenance ↑</a>
    </div><div class="nasa-bench-scene"><div class="nasa-view-heading"><h4 data-bench-title></h4><span data-bench-scope></span></div><div class="nasa-stage" data-bench-stage><div class="nasa-stage-label"><span data-bench-scene-label>FORCES / EARTH TEST</span><strong data-bench-equipment>ROVER</strong></div><div class="nasa-static-icon" aria-hidden="true">◫<small>3D view unavailable.<br>See the legend and values below.</small></div></div>
      <ul class="nasa-inspection-legend" data-bench-legend aria-label="Chart legend and values"></ul>
      <div class="nasa-stage-toolbar"><button type="button" data-bench-center>Center camera</button><button type="button" data-bench-motion aria-pressed="false">Ambient rotation</button><button type="button" data-bench-retry>Retry resource</button></div>
      <p class="nasa-load-status" data-bench-load role="status">Schematic representation; NASA model on demand.</p><p class="nasa-credit" data-bench-credit></p>
    </div></div>
    <div class="nasa-inspection-guide" aria-live="polite"><div><span>HOW TO READ THE CHART</span><p id="bench-factor-note" data-bench-factor-note></p></div><div><span>HOW IT HELPS</span><p data-bench-benefit></p></div><div><span>NEXT STEP</span><p data-bench-next></p><button type="button" data-bench-configure hidden>Configure manual lab ↓</button></div></div>
    <div class="nasa-force-grid" data-bench-values></div><p class="nasa-bench-balance" data-bench-balance></p>
    <p class="nasa-boundary" data-bench-provenance></p>`;
  if(idPrefix){prefixElementIds(root,idPrefix);root.querySelector('a[href="#audit-heading"]').setAttribute('href','#'+idPrefix+'audit-heading');}
  const q = s => root.querySelector(s.replace(/#([\w-]+)/g,(_,id)=>'#'+idPrefix+id));
  const mode = q('#bench-mode'), modelSelect = q('#bench-model'), factorSelect = q('#bench-factor'), sourceSelect = q('#bench-source'), host = q('[data-bench-stage]'), status = q('[data-bench-load]');
  let calibration = null, candidate = null, context = {}, inspection = null, selectedEquipment = null, selectedModel = null, generation = 0, destroyed = false;
  const stage = new NasaStage(host, status, () => refreshModel());
  stage.frameAspect = 1.15; // Mantener ambos sitios dentro del encuadre en pantallas estrechas.
  const floor = mesh(new THREE.BoxGeometry(7, .1, 4.5), 0x142d48); floor.position.y = -.92; stage.world.add(floor);
  const grid = new THREE.GridHelper(7, 14, 0x3b6982, 0x19364e); grid.position.y = -.85; stage.world.add(grid);
  let indicators;
  function setFactor(id, notify = true) {
    factorSelect.value = FACTOR_EXPLANATIONS[id] ? id : 'gravity';
    updateValues();
    if (notify) onFactor?.(factorSelect.value);
  }
  async function refreshModel(force = false) {
    if (!stage.renderer || destroyed || !inspection?.modelVisible) return;
    const equipment = inspection?.state.equipment || 'rover', id = modelSelect.value;
    if (!force && selectedEquipment === equipment && selectedModel === id) return;
    const token = ++generation; selectedEquipment = equipment; selectedModel = id;
    stage.cancelLoad(); stage.setObject(schematic(equipment)); stage.object.position.y = -.8 - new THREE.Box3().setFromObject(stage.object).min.y; stage.object.visible = inspection?.modelVisible ?? true; host.dataset.asset = ''; host.dataset.load = 'schematic';
    q('[data-bench-credit]').textContent = '';
    modelSelect.disabled = equipment !== 'rover';
    if (equipment !== 'rover') { status.textContent = `${equipment === 'wheel' ? 'Wheel / supported mass' : 'Drill / unloaded mass'}: original Atlas schematic. Not a NASA model; no cutting, torque or active thrust.`; return; }
    status.textContent = 'Consultando manifest NASA local…';
    try {
      const manifest = await loadNasaManifest(force);
      if (token !== generation || destroyed) return;
      const asset = manifest.assets.find(a => a.id === id);
      if (asset) {
        const credit = q('[data-bench-credit]'); credit.textContent = `${asset.credit} · `;
        const link = document.createElement('a'); link.textContent = 'Source and terms ↗'; link.href = asset.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; credit.append(link);
      }
      await stage.load(asset, object => { object.position.y = -.8 - new THREE.Box3().setFromObject(object).min.y; object.visible = inspection?.modelVisible ?? true; stage.invalidate(); });
    } catch (error) { if (token === generation) { status.textContent = `NASA model unavailable: ${error.message} Showing a schematic Atlas rover.`; host.dataset.load = 'fallback'; } }
  }
  function updateValues() {
    const thermal = ['temperature', 'heat-transfer'].includes(factorSelect.value);
    const source = context.manual ? 'manual' : thermal && sourceSelect.value === 'design' && context.baseCalibration ? 'design' : 'mission';
    const activeCalibration = source === 'design' ? context.baseCalibration : calibration;
    inspection = buildBenchInspection({ calibration: activeCalibration, candidate, mode: mode.value, factor: factorSelect.value, source, grids: context.grids });
    const state = inspection.state; root.dataset.mode = state.mode; root.dataset.known = String(state.known); root.dataset.factor = inspection.factor; root.dataset.source = source;
    q('[data-bench-context]').textContent = candidate ? `${candidate.scenario.title} · ${candidate.earth.name} ↔ ${candidate.target.name}. Test: ${BODY[state.body] || 'unknown'}${state.body !== candidate.target.body ? ' (hypothesis differs from the scenario)' : ''}.` : 'Unknown scenario.';
    q('[data-bench-equipment]').textContent = inspection.modelVisible ? { rover: 'ROVER · VISUAL REFERENCE', wheel: 'WHEEL · SCHEMATIC', drill: 'DRILL · SCHEMATIC' }[state.equipment] : 'EARTH ↔ TARGET';
    q('[data-bench-scene-label]').textContent = inspection.title.toUpperCase();
    q('[data-bench-title]').textContent = inspection.title;
    q('[data-bench-scope]').textContent = ['geometry', 'scale'].includes(inspection.factor) ? 'DEM + SITE METADATA' : ['radiation', 'atmosphere'].includes(inspection.factor) ? 'SCENARIO ENVIRONMENTAL SOURCES' : inspection.scope;
    q('[data-bench-question]').textContent = inspection.question;
    mode.disabled = !inspection.methodRelevant;
    q('[data-bench-method]').textContent = !inspection.methodRelevant ? 'Vertical offload and equivalent mass only change the mechanical load. This factor needs its own test parameters.' : state.mode === 'offload' ? 'The original mass is kept. F = m·(g_Earth − g_target) offloads the equipment; N = m·g_target. The ground stays at 1 g Earth.' : 'Different mass: m_equiv = m_original·g_target/g_Earth. F = 0; N matches the target load. The equipment inertia changes.';
    q('[data-bench-source-control]').hidden = !thermal;
    sourceSelect.disabled = context.manual || !context.baseCalibration;
    sourceSelect.options[0].textContent = context.manual ? 'Manual lab hypotheses' : 'Current mission configuration';
    q('[data-bench-source-note]').textContent = thermal ? source === 'design' ? 'Proposed baseline profile for the scenario. Gas and surroundings at the same bench setpoint. These are not measurements; this view does not alter the automatic report.' : context.manual ? 'Hypotheses edited in the manual lab, isolated from the mission report.' : 'Missing current inputs remain pending. You can explore the proposed baseline design with the selector.' : '';
    q('.nasa-model-control').hidden = !inspection.modelVisible;
    q('[data-bench-retry]').hidden = !inspection.modelVisible;
    q('[data-bench-credit]').hidden = !inspection.modelVisible;
    status.hidden = !inspection.modelVisible;
    q('[data-bench-factor-note]').textContent = inspection.read;
    q('[data-bench-benefit]').textContent = inspection.benefit;
    q('[data-bench-next]').textContent = inspection.next;
    q('[data-bench-configure]').hidden = !onConfigure || !['gravity', 'pressure', 'temperature', 'heat-transfer', 'regolith'].includes(inspection.factor);
    const values = q('[data-bench-values]'); values.replaceChildren();
    for (const fact of inspection.facts) {
      const item = document.createElement('div'); item.className = `nasa-force${fact.value.length > 35 ? ' nasa-force-text' : ''}`; const name = document.createElement('span'), number = document.createElement('strong');
      name.textContent = fact.label; number.textContent = fact.value; number.style.color = BENCH_COLORS[fact.color]; item.append(name, number);
      if (fact.note) { const note = document.createElement('small'); note.textContent = fact.note; item.append(note); }
      values.append(item);
    }
    const legend = q('[data-bench-legend]'); legend.replaceChildren();
    for (const fact of inspection.legend) { const item = document.createElement('li'); item.style.setProperty('--legend-color', BENCH_COLORS[fact.color]); item.textContent = `${fact.label}: ${fact.value}`; legend.append(item); }
    q('[data-bench-balance]').textContent = `${inspection.factor === 'gravity' && state.known ? `W − F = N: ${value(state.testEarthWeightN)} − (${value(state.supportN)}) = ${value(state.contactLoadN, 'N')}. Original weight on Earth: ${value(state.originalEarthWeightN, 'N')}. ` : ''}${inspection.scale}`;
    q('[data-bench-provenance]').textContent = inspection.sourceNote || 'Values belong to the selected configuration. The NASA mesh only provides context; calculations and mission sources stay separate from the presentation.';
    disposeObject(indicators); const visual = inspectionVisual(inspection); indicators = visual.group; stage.world.add(indicators); stage.setLabels(visual.labels);
    if (stage.object) stage.object.visible = inspection.modelVisible;
    // El corte del subsuelo queda expuesto; se oculta el plano opaco que lo tapaba.
    floor.visible = inspection.factor !== 'regolith'; grid.visible = !['regolith', 'geometry', 'scale'].includes(inspection.factor);
    stage.target.y = inspection.factor === 'regolith' ? .1 : .7;
    host.dataset.vectors = String(indicators.children.filter(object => object.type === 'ArrowHelper').length);
    stage.invalidate(); if (inspection.modelVisible) refreshModel();
  }
  mode.addEventListener('change', () => { modelSelect.value = mode.value === 'equivalent' ? 'scarecrow' : 'perseverance'; updateValues(); });
  modelSelect.addEventListener('change', () => refreshModel());
  factorSelect.addEventListener('change', () => setFactor(factorSelect.value));
  sourceSelect.addEventListener('change', updateValues);
  q('[data-bench-configure]').addEventListener('click', () => onConfigure?.(factorSelect.value));
  q('[data-bench-center]').addEventListener('click', () => stage.reset());
  q('[data-bench-motion]').addEventListener('click', e => { stage.moving = !stage.moving && !stage.motion.matches; e.target.setAttribute('aria-pressed', String(stage.moving)); stage.invalidate(); });
  q('[data-bench-retry]').addEventListener('click', () => refreshModel(true));
  const syncMotion = () => { const button = q('[data-bench-motion]'); button.disabled = stage.motion.matches; button.title = stage.motion.matches ? 'Rotation disabled by your reduced-motion preference.' : 'Optional scene rotation.'; button.setAttribute('aria-pressed', String(stage.moving)); };
  stage.motion.addEventListener('change', syncMotion, { signal: stage.events.signal }); syncMotion();
  setFactor('gravity', false);
  return { update(c, data, reset = false, details = {}) { calibration = c; candidate = data; context = details; if (reset) { mode.value = 'offload'; modelSelect.value = 'perseverance'; sourceSelect.value = 'mission'; setFactor('gravity'); } else updateValues(); },
    selectFactor: setFactor, presentation() { return { schema: 'AnalogVisualPresentation', version: '1.0.0', mode: mode.value, factor: factorSelect.value, roverReference: modelSelect.value, normalizedScale: true, scientificSource: false, inspectionSource: root.dataset.source, methodRelevant: inspection.methodRelevant }; },
    dispose() { destroyed = true; generation++; stage.dispose(); } };
}
