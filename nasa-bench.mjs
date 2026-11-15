import { FACTOR_EXPLANATIONS } from './nasa-visual-math.mjs';
import { buildBenchInspection, BENCH_COLORS, inspectionValue as value } from './bench-inspection.mjs';
import { inspectionVisual } from './bench-visuals.mjs';
import { NasaStage, THREE, mesh, schematic, disposeObject, loadNasaManifest } from './nasa-stage.mjs';
const BODY = { earth: 'Tierra', moon: 'Luna', mars: 'Marte' };
export function createNasaBench(root, onFactor, onConfigure) {
  root.innerHTML = `<div class="nasa-section-head"><div><p class="eyebrow">M2 / INSPECTOR DE ENSAYOS</p><h3>Entendé la diferencia. Prepará el ensayo.</h3><p data-bench-context>Elegí un escenario para preparar el ensayo.</p></div><span class="outline-tag">9 FACTORES · EVIDENCIA VISIBLE</span></div>
    <div class="nasa-bench-layout"><div class="nasa-bench-setup">
      <label for="bench-factor">01 · ¿Qué querés inspeccionar?<select id="bench-factor" aria-describedby="bench-factor-note"><option value="gravity">Gravedad / carga</option><option value="atmosphere">Atmósfera y viento</option><option value="pressure">Presión absoluta</option><option value="temperature">Temperaturas</option><option value="heat-transfer">Flujos de calor</option><option value="radiation">Solar y radiación ionizante</option><option value="regolith">Contacto con el regolito</option><option value="geometry">Relieve de los dos sitios</option><option value="scale">Resolución y escala</option></select></label>
      <label for="bench-mode">Método del banco<select id="bench-mode"><option value="offload">01 · Misma masa + soporte vertical</option><option value="equivalent">02 · Masa terrestre equivalente</option></select></label>
      <p data-bench-method></p>
      <label for="bench-source" data-bench-source-control hidden>Datos térmicos del gráfico<select id="bench-source"><option value="mission">Configuración actual de misión</option><option value="design">Explorar diseño base propuesto</option></select></label>
      <p data-bench-source-note></p>
      <details class="nasa-model-control"><summary>Modelo de referencia visual</summary><label for="bench-model">Rover NASA<select id="bench-model"><option value="perseverance">Perseverance · modelo NASA</option><option value="scarecrow">Scarecrow · rover aligerado</option></select></label><p class="nasa-history">Malla normalizada para contexto. No define masa, dimensiones ni propiedades del prototipo. Scarecrow ilustra un antecedente de ensayo aligerado.</p></details>
      <p class="nasa-inspection-question" data-bench-question></p><a href="#audit-heading" class="nasa-edit-link">Ver configuración y procedencia de misión ↑</a>
    </div><div class="nasa-bench-scene"><div class="nasa-view-heading"><h4 data-bench-title></h4><span data-bench-scope></span></div><div class="nasa-stage" data-bench-stage><div class="nasa-stage-label"><span data-bench-scene-label>FUERZAS / ENSAYO TERRESTRE</span><strong data-bench-equipment>ROVER</strong></div><div class="nasa-static-icon" aria-hidden="true">◫<small>Vista 3D no disponible.<br>Consultá la leyenda y los valores debajo.</small></div></div>
      <ul class="nasa-inspection-legend" data-bench-legend aria-label="Leyenda y valores del gráfico"></ul>
      <div class="nasa-stage-toolbar"><button type="button" data-bench-center>Centrar cámara</button><button type="button" data-bench-motion aria-pressed="false">Rotación ambiental</button><button type="button" data-bench-retry>Reintentar recurso</button></div>
      <p class="nasa-load-status" data-bench-load role="status">Representación esquemática; modelo NASA bajo demanda.</p><p class="nasa-credit" data-bench-credit></p>
    </div></div>
    <div class="nasa-inspection-guide" aria-live="polite"><div><span>CÓMO LEER EL GRÁFICO</span><p id="bench-factor-note" data-bench-factor-note></p></div><div><span>EN QUÉ TE AYUDA</span><p data-bench-benefit></p></div><div><span>SIGUIENTE PASO</span><p data-bench-next></p><button type="button" data-bench-configure hidden>Configurar laboratorio manual ↓</button></div></div>
    <div class="nasa-force-grid" data-bench-values></div><p class="nasa-bench-balance" data-bench-balance></p>
    <p class="nasa-boundary" data-bench-provenance></p>`;
  const q = s => root.querySelector(s);
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
      await stage.load(asset, object => { object.position.y = -.8 - new THREE.Box3().setFromObject(object).min.y; object.visible = inspection?.modelVisible ?? true; stage.invalidate(); });
    } catch (error) { if (token === generation) { status.textContent = `Modelo NASA no disponible: ${error.message} Se muestra un rover esquemático de Atlas.`; host.dataset.load = 'fallback'; } }
  }
  function updateValues() {
    const thermal = ['temperature', 'heat-transfer'].includes(factorSelect.value);
    const source = context.manual ? 'manual' : thermal && sourceSelect.value === 'design' && context.baseCalibration ? 'design' : 'mission';
    const activeCalibration = source === 'design' ? context.baseCalibration : calibration;
    inspection = buildBenchInspection({ calibration: activeCalibration, candidate, mode: mode.value, factor: factorSelect.value, source, grids: context.grids });
    const state = inspection.state; root.dataset.mode = state.mode; root.dataset.known = String(state.known); root.dataset.factor = inspection.factor; root.dataset.source = source;
    q('[data-bench-context]').textContent = candidate ? `${candidate.scenario.title} · ${candidate.earth.name} ↔ ${candidate.target.name}. Ensayo: ${BODY[state.body] || 'desconocido'}${state.body !== candidate.target.body ? ' (hipótesis distinta del escenario)' : ''}.` : 'Escenario desconocido.';
    q('[data-bench-equipment]').textContent = inspection.modelVisible ? { rover: 'ROVER · REFERENCIA VISUAL', wheel: 'RUEDA · ESQUEMA', drill: 'TALADRO · ESQUEMA' }[state.equipment] : 'TIERRA ↔ OBJETIVO';
    q('[data-bench-scene-label]').textContent = inspection.title.toUpperCase();
    q('[data-bench-title]').textContent = inspection.title;
    q('[data-bench-scope]').textContent = ['geometry', 'scale'].includes(inspection.factor) ? 'DEM + METADATOS DE LOS SITIOS' : ['radiation', 'atmosphere'].includes(inspection.factor) ? 'FUENTES AMBIENTALES DEL ESCENARIO' : inspection.scope;
    q('[data-bench-question]').textContent = inspection.question;
    mode.disabled = !inspection.methodRelevant;
    q('[data-bench-method]').textContent = !inspection.methodRelevant ? 'La descarga vertical y la masa equivalente solo cambian la carga mecánica. Para este factor se necesitan sus propios parámetros de ensayo.' : state.mode === 'offload' ? 'Se conserva la masa original. F = m·(g_Tierra − g_obj) descarga el equipo; N = m·g_obj. El suelo sigue a 1 g terrestre.' : 'Otra masa: m_equiv = m_original·g_obj/g_Tierra. F = 0; N iguala la carga objetivo. Cambia la inercia del equipo.';
    q('[data-bench-source-control]').hidden = !thermal;
    sourceSelect.disabled = context.manual || !context.baseCalibration;
    sourceSelect.options[0].textContent = context.manual ? 'Hipótesis del laboratorio manual' : 'Configuración actual de misión';
    q('[data-bench-source-note]').textContent = thermal ? source === 'design' ? 'Perfil base propuesto del escenario. Gas y entorno a un mismo setpoint de banco. No son mediciones; esta vista no altera el reporte automático.' : context.manual ? 'Hipótesis editadas en el laboratorio manual, aisladas del reporte de misión.' : 'Las entradas actuales ausentes quedan pendientes. Podés explorar el diseño base propuesto con el selector.' : '';
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
    q('[data-bench-balance]').textContent = `${inspection.factor === 'gravity' && state.known ? `W − F = N: ${value(state.testEarthWeightN)} − (${value(state.supportN)}) = ${value(state.contactLoadN, 'N')}. Peso original en Tierra: ${value(state.originalEarthWeightN, 'N')}. ` : ''}${inspection.scale}`;
    q('[data-bench-provenance]').textContent = inspection.sourceNote || 'Los valores pertenecen a la configuración seleccionada. La malla NASA solo da contexto; los cálculos y las fuentes de misión permanecen separados de la presentación.';
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
  const syncMotion = () => { const button = q('[data-bench-motion]'); button.disabled = stage.motion.matches; button.title = stage.motion.matches ? 'Rotación desactivada por tu preferencia de movimiento reducido.' : 'Rotación opcional de la escena.'; button.setAttribute('aria-pressed', String(stage.moving)); };
  stage.motion.addEventListener('change', syncMotion, { signal: stage.events.signal }); syncMotion();
  setFactor('gravity', false);
  return { update(c, data, reset = false, details = {}) { calibration = c; candidate = data; context = details; if (reset) { mode.value = 'offload'; modelSelect.value = 'perseverance'; sourceSelect.value = 'mission'; setFactor('gravity'); } else updateValues(); },
    selectFactor: setFactor, presentation() { return { schema: 'AnalogVisualPresentation', version: '1.0.0', mode: mode.value, factor: factorSelect.value, roverReference: modelSelect.value, normalizedScale: true, scientificSource: false, inspectionSource: root.dataset.source, methodRelevant: inspection.methodRelevant }; },
    dispose() { destroyed = true; generation++; stage.dispose(); } };
}
