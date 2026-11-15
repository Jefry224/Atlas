import { benchState, FACTOR_EXPLANATIONS } from './nasa-visual-math.mjs';
import { NasaStage, THREE, mesh, schematic, disposeObject, loadNasaManifest } from './nasa-stage.mjs';
const BODY = { earth: 'Tierra', moon: 'Luna', mars: 'Marte' };
const value = (n, unit = '') => Number.isFinite(n) ? `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}` : 'desconocido';
export function createNasaBench(root, onFactor) {
  root.innerHTML = `<div class="nasa-section-head"><div><p class="eyebrow">M2 / VIRTUAL TEST FACILITY</p><h3>Un mismo peso. Dos ensayos distintos.</h3><p data-bench-context>Elegí un escenario para preparar el ensayo.</p></div><span class="outline-tag">SOLO CARGA ESTÁTICA</span></div>
    <div class="nasa-bench-layout"><div class="nasa-bench-setup">
      <label for="bench-mode">Método del banco<select id="bench-mode"><option value="offload">01 · Misma masa + soporte vertical</option><option value="equivalent">02 · Masa terrestre equivalente</option></select></label>
      <p data-bench-method></p><label for="bench-model">Referencia visual del rover<select id="bench-model"><option value="perseverance">Perseverance · modelo NASA</option><option value="scarecrow">Scarecrow · rover aligerado</option></select></label>
      <p class="nasa-history">Scarecrow ilustra el antecedente de un rover aligerado para ensayos de Curiosity. Su malla no define la masa del prototipo ni valida su configuración.</p>
      <label for="bench-factor">Factor que querés inspeccionar<select id="bench-factor" aria-describedby="bench-factor-note"><option value="gravity">Gravedad / carga</option><option value="atmosphere">Atmósfera</option><option value="pressure">Presión</option><option value="temperature">Temperatura</option><option value="heat-transfer">Transferencia térmica</option><option value="radiation">Radiación</option><option value="regolith">Regolito</option><option value="geometry">Geometría</option><option value="scale">Escala</option></select></label>
      <p id="bench-factor-note" data-bench-factor-note class="nasa-factor-note"></p><a href="#audit-heading" class="nasa-edit-link">Configuración automática y procedencia de misión ↑</a>
    </div><div class="nasa-bench-scene"><div class="nasa-stage" data-bench-stage><div class="nasa-stage-label"><span>BANCO TERRESTRE / SUELO A g TIERRA</span><strong data-bench-equipment>ROVER</strong></div><div class="nasa-static-icon" aria-hidden="true">↓ &nbsp; ▰ &nbsp; ↑<small>Esquema de carga</small></div></div>
      <div class="nasa-stage-toolbar"><button type="button" data-bench-center>Centrar cámara</button><button type="button" data-bench-motion aria-pressed="false">Rotación ambiental</button><button type="button" data-bench-retry>Reintentar recurso</button></div>
      <p class="nasa-load-status" data-bench-load role="status">Representación esquemática; modelo NASA bajo demanda.</p><p class="nasa-credit" data-bench-credit></p>
    </div></div>
    <div class="nasa-force-grid" data-bench-values aria-live="polite"></div><p class="nasa-bench-balance" data-bench-balance></p>
    <p class="nasa-boundary">La carga de contacto puede igualarse; la gravedad del suelo, la dinámica granular y la distribución interna de esfuerzos siguen siendo terrestres. La masa reducida cambia la inercia. El soporte ideal conserva masa, pero introduce restricciones. Sin equivalencia física global.</p>`;
  const q = s => root.querySelector(s);
  const mode = q('#bench-mode'), modelSelect = q('#bench-model'), factorSelect = q('#bench-factor'), host = q('[data-bench-stage]'), status = q('[data-bench-load]');
  let calibration = null, candidate = null, selectedEquipment = null, selectedModel = null, generation = 0, destroyed = false;
  const stage = new NasaStage(host, status, () => refreshModel());
  const floor = mesh(new THREE.BoxGeometry(7, .1, 4.5), 0x142d48); floor.position.y = -.92; stage.world.add(floor);
  const grid = new THREE.GridHelper(7, 14, 0x3b6982, 0x19364e); grid.position.y = -.85; stage.world.add(grid);
  let indicators;
  function redrawIndicators(state) {
    disposeObject(indicators); indicators = new THREE.Group(); stage.world.add(indicators);
    const factor = factorSelect.value;
    const accent = ['temperature', 'heat-transfer'].includes(factor) ? 0xffa557 : ['gravity', 'regolith'].includes(factor) ? 0x63ecd3 : 0x91aaff;
    if (['gravity', 'regolith'].includes(factor)) {
      for (const x of calibration?.equipment === 'rover' ? [-.9, 0, .9] : [0]) for (const z of calibration?.equipment === 'rover' ? [-.6, .6] : [0]) {
        const ring = mesh(new THREE.TorusGeometry(.28, .035, 8, 32), accent, { emissive: accent, emissiveIntensity: .5 }); ring.rotation.x = -Math.PI / 2; ring.position.set(x, -.78, z); indicators.add(ring);
      }
    } else {
      const cover = mesh(new THREE.BoxGeometry(3.1, ['temperature', 'heat-transfer'].includes(factor) ? .13 : 2.5, 2.2), accent, { wireframe: !['temperature', 'heat-transfer'].includes(factor), transparent: true, opacity: .22, depthWrite: false });
      cover.position.y = ['temperature', 'heat-transfer'].includes(factor) ? 1.05 : .5; indicators.add(cover);
    }
    if (mode.value === 'offload') {
      for (const x of [-2.45, 2.45]) { const post = mesh(new THREE.BoxGeometry(.06, 4, .06), 0x526b83); post.position.set(x, 1.1, -.65); indicators.add(post); }
      const beam = mesh(new THREE.BoxGeometry(4.95, .08, .08), 0x526b83); beam.position.set(0, 3.1, -.65); indicators.add(beam);
      const cable = mesh(new THREE.CylinderGeometry(.018, .018, 1.5, 8), 0x66caff); cable.position.set(0, 2.3, 0); cable.visible = state.known && state.supportN !== 0; indicators.add(cable);
    }
    stage.setLabels(state.known ? [
      { text: `↓ Tierra ${value(state.testEarthWeightN, 'N')}`, position: [-2, .35, 1], color: '#ffa7b8' },
      { text: `↓ Objetivo ${value(state.targetWeightN, 'N')}`, position: [2, 1.15, 1], color: '#ffd275' },
      { text: `↑ Soporte ${value(state.supportN, 'N')}`, position: [.5, 2.65, .8], color: '#69cfff' },
    ] : []);
    if (state.known) {
      const maximum = Math.max(Math.abs(state.testEarthWeightN), Math.abs(state.targetWeightN), Math.abs(state.supportN), 1);
      const arrow = (force, x, z, color, up = false) => {
        if (!force) return;
        const length = 1.65 * Math.abs(force) / maximum;
        indicators.add(new THREE.ArrowHelper(new THREE.Vector3(0, (up ? 1 : -1) * Math.sign(force), 0), new THREE.Vector3(x, up ? 1.35 : 1, z), length, color, Math.min(.22, length * .4), Math.min(.12, length * .25)));
      };
      arrow(state.testEarthWeightN, -1.85, 1, 0xffa7b8); arrow(state.targetWeightN, 1.85, 1, 0xffd275); arrow(state.supportN, 0, .8, 0x69cfff, true);
    }
    stage.invalidate();
  }
  function factorNote() {
    let text = FACTOR_EXPLANATIONS[factorSelect.value];
    if (['temperature', 'heat-transfer'].includes(factorSelect.value)) text += ` Ensayo actual: área ${value(calibration?.inputs?.areaM2, 'm²')}; Q_conv ${value(calibration?.thermal?.convectionW, 'W')}; Q_rad ${value(calibration?.thermal?.radiationW, 'W')}. Los parámetros sin fuente permanecen desconocidos.`;
    if (['pressure', 'atmosphere'].includes(factorSelect.value)) text += ` Presión Tierra ${value(calibration?.inputs?.earthPressurePa, 'Pa')}; referencia del ensayo ${value(calibration?.inputs?.targetPressurePa, 'Pa')}. No se deriva de la malla.`;
    q('[data-bench-factor-note]').textContent = text;
  }
  function setFactor(id, notify = true) {
    factorSelect.value = FACTOR_EXPLANATIONS[id] ? id : 'gravity';
    factorNote();
    root.dataset.factor = factorSelect.value; redrawIndicators(benchState(calibration, mode.value));
    if (notify) onFactor?.(factorSelect.value);
  }
  async function refreshModel(force = false) {
    if (!stage.renderer || destroyed) return;
    const equipment = calibration?.equipment || 'rover', id = modelSelect.value;
    if (!force && selectedEquipment === equipment && selectedModel === id) return;
    const token = ++generation; selectedEquipment = equipment; selectedModel = id;
    stage.cancelLoad(); stage.setObject(schematic(equipment)); stage.object.position.y = -.8 - new THREE.Box3().setFromObject(stage.object).min.y; host.dataset.asset = ''; host.dataset.load = 'schematic';
    q('[data-bench-credit]').textContent = '';
    modelSelect.disabled = equipment !== 'rover';
    if (equipment !== 'rover') { status.textContent = `${equipment === 'wheel' ? 'Rueda / masa soportada' : 'Taladro / masa descargada'}: esquema original de Atlas. No es un modelo NASA; sin corte, par ni empuje activo.`; return; }
    status.textContent = 'Consultando manifest NASA local…';
    try {
      const manifest = await loadNasaManifest(force);
      if (token !== generation || destroyed) return;
      const asset = manifest.assets.find(a => a.id === id);
      if (asset) {
        const credit = q('[data-bench-credit]'); credit.textContent = `${asset.credit} · `;
        const link = document.createElement('a'); link.textContent = 'Fuente y términos ↗'; link.href = asset.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; credit.append(link);
      }
      await stage.load(asset, object => { object.position.y = -.8 - new THREE.Box3().setFromObject(object).min.y; stage.invalidate(); });
    } catch (error) { if (token === generation) { status.textContent = `Modelo NASA no disponible: ${error.message} Se muestra un rover esquemático de Atlas.`; host.dataset.load = 'fallback'; } }
  }
  function updateValues() {
    const state = benchState(calibration, mode.value); root.dataset.mode = state.mode; root.dataset.known = String(state.known);
    q('[data-bench-context]').textContent = candidate ? `${candidate.scenario.title} · ${candidate.earth.name} ↔ ${candidate.target.name}. Ensayo: ${BODY[state.body] || 'desconocido'}${state.body !== candidate.target.body ? ' (hipótesis distinta del escenario)' : ''}.` : 'Escenario desconocido.';
    q('[data-bench-equipment]').textContent = { rover: 'ROVER', wheel: 'RUEDA · ESQUEMA', drill: 'TALADRO · ESQUEMA' }[state.equipment];
    q('[data-bench-method]').textContent = state.mode === 'offload' ? 'La masa original permanece. Un soporte vertical aplica F = m·(g_Tierra − g_obj). La carga residual sobre el suelo es m·g_obj.' : 'Se ensaya otra masa: m_equiv = m_original·g_obj/g_Tierra. Su peso terrestre iguala el objetivo, con soporte de descarga cero. Su inercia cambia.';
    const facts = [
      ['Masa original / referencia', state.originalMassKg, 'kg', 'neutral'], ['Masa del ensayo terrestre', state.testMassKg, 'kg', 'neutral'],
      ['↓ Peso terrestre del ensayo', state.testEarthWeightN, 'N', 'earth'], ['↓ Peso objetivo / referencia', state.targetWeightN, 'N', 'target'],
      ['↑ Soporte vertical (signo positivo)', state.supportN, 'N', 'support'], ['Carga de contacto resultante', state.contactLoadN, 'N', 'neutral'],
    ];
    const values = q('[data-bench-values]'); values.replaceChildren();
    for (const [label, n, unit, color] of facts) { const item = document.createElement('div'); item.className = `nasa-force nasa-force-${color}`; const name = document.createElement('span'), number = document.createElement('strong'); name.textContent = label; number.textContent = value(n, unit); item.append(name, number); values.append(item); }
    q('[data-bench-balance]').textContent = state.known ? `Referencia de la masa original en Tierra: ${value(state.originalEarthWeightN, 'N')}. Equilibrio terrestre: ${value(state.testEarthWeightN, 'N')} − ${value(state.supportN, 'N')} = ${value(state.contactLoadN, 'N')}. Flechas a una escala común, sin dimensiones métricas del equipo.` : 'Carga desconocida: esperando configuración de misión y referencias válidas. Se retiran todas las flechas y resultados de carga anteriores.';
    factorNote(); redrawIndicators(state); refreshModel();
  }
  mode.addEventListener('change', () => { modelSelect.value = mode.value === 'equivalent' ? 'scarecrow' : 'perseverance'; updateValues(); });
  modelSelect.addEventListener('change', () => refreshModel());
  factorSelect.addEventListener('change', () => setFactor(factorSelect.value));
  q('[data-bench-center]').addEventListener('click', () => stage.reset());
  q('[data-bench-motion]').addEventListener('click', e => { stage.moving = !stage.moving && !stage.motion.matches; e.target.setAttribute('aria-pressed', String(stage.moving)); stage.invalidate(); });
  q('[data-bench-retry]').addEventListener('click', () => refreshModel(true));
  const syncMotion = () => { const button = q('[data-bench-motion]'); button.disabled = stage.motion.matches; button.title = stage.motion.matches ? 'Rotación desactivada por tu preferencia de movimiento reducido.' : 'Rotación opcional de la escena.'; button.setAttribute('aria-pressed', String(stage.moving)); };
  stage.motion.addEventListener('change', syncMotion, { signal: stage.events.signal }); syncMotion();
  setFactor('gravity', false); updateValues();
  return { update(c, data, reset = false) { calibration = c; candidate = data; if (reset) { mode.value = 'offload'; modelSelect.value = 'perseverance'; setFactor('gravity'); } updateValues(); },
    selectFactor: setFactor, presentation() { return { schema: 'AnalogVisualPresentation', version: '1.0.0', mode: mode.value, factor: factorSelect.value, roverReference: modelSelect.value, normalizedScale: true, scientificSource: false }; },
    dispose() { destroyed = true; generation++; stage.dispose(); } };
}
