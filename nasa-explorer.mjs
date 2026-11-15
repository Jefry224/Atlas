import { NASA_MODEL_IDS, latLonVector, targetFromGrid } from './nasa-visual-math.mjs';
import { NasaStage, THREE, schematic, mesh, loadNasaManifest } from './nasa-stage.mjs';
const LABELS = { scarecrow: 'Scarecrow', perseverance: 'Perseverance', moon: 'Luna', mars: 'Marte', lro: 'LRO', 'block-island': 'Block Island', 'apollo-11': 'Apollo 11' };
const USES = { scarecrow: 'Ensayo de masa reducida', perseverance: 'Rover de referencia', moon: 'Globo educativo', mars: 'Globo educativo', lro: 'Origen de datos lunares', 'block-island': 'Obstáculo / muestreo sintético', 'apollo-11': 'Terreno educativo Z×60' };
const NOTES = {
  scarecrow: 'Ensayo por masa reducida: antecedente histórico del rover aligerado para Curiosity. La calculadora usa tu masa, nunca una masa deducida del modelo.',
  perseverance: 'Referencia visual del rover en el banco. El rover de la simulación conserva su modelo, nombres de ruedas, orientación y dimensiones originales.',
  moon: 'Modelo global educativo. Para seleccionar objetivos se usa el globo cartográfico propio con coordenadas del JSON de Atlas, separado de la orientación de esta malla.',
  mars: 'Modelo global educativo. Jezero y Coprates se seleccionan desde el globo cartográfico; su textura nunca modifica el DEM ni la física.',
  lro: 'Lunar Reconnaissance Orbiter: LOLA aporta altimetría y Diviner radiometría térmica. Atlas conserva las fuentes y limitaciones de cada producto; este modelo no es un enlace ni una medición orbital.',
  'block-island': 'Escena sintética de obstáculos y muestreo: Block Island es una roca observada por Opportunity en Meridiani Planum. Este ejemplo no representa Jezero, el análogo terrestre ni un obstáculo detectado por nuestros DEM.',
  'apollo-11': 'Terreno educativo Apollo 11 con exageración vertical Z×60 incorporada por la fuente. Está excluido de pendientes, navegación, cálculos DEM e índice geométrico de Atlas.',
};
export function createNasaExplorer(root, onScenario) {
  root.innerHTML = `<header class="panel-heading"><h2><span>NASA</span> Objetos reales. Ensayos con límites.</h2><span class="data-badge" data-kind="archive">7 MODELOS / ARCHIVO LOCAL</span></header>
    <details class="nasa-explorer-details"><summary>Explorar modelos y objetivos de la Luna y Marte <span aria-hidden="true">＋</span></summary><div class="nasa-explorer-content">
    <p class="nasa-intro">Una colección para entender el ensayo, su escala y el origen de los datos. Elegí un recurso: se carga solo ese archivo. Geometría visual y ciencia conservan fuentes separadas.</p>
    <div class="nasa-explorer-tabs" role="group" aria-label="Explorador NASA"><button type="button" data-nasa-tab="gallery" aria-pressed="true">01 · Galería NASA</button><button type="button" data-nasa-tab="moon" aria-pressed="false">02 · Objetivos Luna</button><button type="button" data-nasa-tab="mars" aria-pressed="false">03 · Objetivos Marte</button></div>
    <div class="nasa-explorer-layout"><div class="nasa-explorer-sidebar"><div data-nasa-gallery><div class="nasa-model-list" role="group" aria-label="Siete modelos NASA">${NASA_MODEL_IDS.map((id, index) => `<button type="button" data-nasa-model="${id}" aria-pressed="${index === 0}"><span>${String(index + 1).padStart(2, '0')}</span>${LABELS[id]}</button>`).join('')}</div></div>
    <div data-nasa-targets hidden><h3 data-nasa-body-title>Objetivos</h3><p>Coordenadas de los centros reales usados por Atlas; no polígonos de ensayo.</p><div data-nasa-target-list class="nasa-target-list"></div><p class="nasa-map-heading">Referencia equirectangular · norte arriba</p><div class="nasa-coordinate-map" aria-label="Mapa de referencia para comprobar el registro de los marcadores"><img data-nasa-map-image alt="Textura oficial equirectangular de referencia" hidden><div data-nasa-map-markers></div></div><div class="nasa-map-scale" aria-hidden="true"><span>180°O</span><span>0°E</span><span>180°E</span></div></div></div>
    <div><div class="nasa-stage nasa-gallery-stage" data-nasa-stage><div class="nasa-stage-label"><span data-nasa-stage-kind>RECURSO VISUAL / NO ES UN DEM DE ENSAYO</span><strong data-nasa-stage-title>Scarecrow</strong></div><div class="nasa-static-icon" aria-hidden="true">◌<small>Vista estática · ficha accesible</small></div></div><div class="nasa-stage-toolbar"><button type="button" data-nasa-center>Centrar cámara</button><button type="button" data-nasa-motion aria-pressed="false">Rotación ambiental</button><button type="button" data-nasa-retry>Reintentar recurso</button></div><p data-nasa-load class="nasa-load-status" role="status">Abrí un recurso para cargarlo.</p></div></div>
    <article class="nasa-resource-card" aria-labelledby="nasa-resource-title"><div><p class="eyebrow" data-nasa-card-kind>NASA / VISUAL REFERENCE</p><h3 id="nasa-resource-title">Scarecrow</h3><p data-nasa-note></p><p data-nasa-registration hidden></p><p data-nasa-credit class="nasa-credit"></p></div><div><dl class="nasa-resource-meta" data-nasa-meta></dl><a href="docs/nasa-assets.md" target="_blank" rel="noopener noreferrer">Preparación, créditos y límites ↗</a></div></article>
    <p class="nasa-boundary">Archivos locales NASA normalizados por bounding box, sin escala física del ensayo. La escena Block Island y el terreno Apollo 11 son ejemplos educativos independientes de los cuatro escenarios.</p>
    </div></details>`;
  const q = s => root.querySelector(s), details = q('details'), host = q('[data-nasa-stage]'), status = q('[data-nasa-load]');
  let stage, tab = 'gallery', selected = 'scarecrow', manifest, scenarios = [], targets = [], targetsPromise, generation = 0, activeScenario = null, disposed = false;
  async function getManifest(refresh = false) { manifest = await loadNasaManifest(refresh); return manifest; }
  function setCredit(asset) {
    const credit = q('[data-nasa-credit]'); credit.replaceChildren();
    if (!asset) { credit.textContent = 'Crédito pendiente del manifest local.'; return; }
    credit.append(document.createTextNode(`${asset.credit} · `));
    for (const [key, text] of [['sourceUrl', 'Fuente NASA ↗'], ['licenseUrl', 'Términos ↗']]) { const a = document.createElement('a'); a.href = asset[key]; a.textContent = text; a.target = '_blank'; a.rel = 'noopener noreferrer'; credit.append(a, document.createTextNode(' · ')); }
  }
  function card(id, asset) {
    q('#nasa-resource-title').textContent = LABELS[id]; q('[data-nasa-stage-title]').textContent = LABELS[id];
    q('[data-nasa-note]').textContent = NOTES[id]; q('[data-nasa-card-kind]').textContent = id === 'apollo-11' ? 'TERRENO EDUCATIVO / Z×60' : id === 'block-island' ? 'ESCENA SINTÉTICA / NO GEOLOCALIZADA' : 'NASA / REFERENCIA VISUAL';
    q('[data-nasa-meta]').replaceChildren();
    if (asset) for (const [label, text] of [['Archivo', asset.available ? `${asset.format.toUpperCase()} · ${(asset.bytes / 1e6).toFixed(2)} MB` : 'Preparación pendiente'], ['Uso', USES[id]], ['Integridad', asset.sha256 ? `SHA-256 ${asset.sha256.slice(0, 12)}…` : 'Pendiente']]) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = text; q('[data-nasa-meta]').append(dt, dd); }
    setCredit(asset);
  }
  function ensureStage() {
    if (stage || disposed) return;
    stage = new NasaStage(host, status, () => render());
    host.addEventListener('pointerdown', e => { stage.markerStart = [e.clientX, e.clientY]; }, { signal: stage.events.signal });
    host.addEventListener('pointerup', e => {
      if (tab === 'gallery' || !stage.object || !stage.markerStart || Math.hypot(e.clientX - stage.markerStart[0], e.clientY - stage.markerStart[1]) > 6) return;
      const rect = stage.canvas.getBoundingClientRect(), pointer = new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), ray = new THREE.Raycaster(); ray.setFromCamera(pointer, stage.camera);
      const hit = ray.intersectObject(stage.object, true)[0]; if (hit?.object.userData.target) chooseTarget(hit.object.userData.target);
    }, { signal: stage.events.signal });
    const syncMotion = () => { const button = q('[data-nasa-motion]'); button.disabled = stage.motion.matches; button.title = stage.motion.matches ? 'Rotación desactivada por tu preferencia de movimiento reducido.' : 'Rotación opcional de la escena.'; button.setAttribute('aria-pressed', String(stage.moving)); };
    stage.motion.addEventListener('change', syncMotion, { signal: stage.events.signal }); syncMotion();
  }
  async function getTargets() {
    if (!targetsPromise) targetsPromise = Promise.all(scenarios.map(async s => {
      try { const r = await fetch(s.target); if (!r.ok) return null; return targetFromGrid(s, await r.json()); } catch { return null; }
    })).then(items => { targets = items.filter(Boolean); return targets; });
    return targetsPromise;
  }
  function chooseTarget(target) {
    activeScenario = target.scenarioId;
    const vector = latLonVector(target.lat, target.lon); stage.yaw = Math.atan2(vector[0], vector[2]); stage.pitch = Math.asin(vector[1]); stage.invalidate();
    showTargetButtons(); const scenario = scenarios.find(s => s.id === target.scenarioId); if (scenario) onScenario(scenario);
  }
  function showTargetButtons() {
    const list = q('[data-nasa-target-list]'); list.replaceChildren();
    const map = q('[data-nasa-map-markers]'); map.replaceChildren();
    for (const target of targets.filter(t => t.body === tab)) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.nasaTarget = target.targetId; button.setAttribute('aria-pressed', String(activeScenario === target.scenarioId));
      const title = document.createElement('strong'), coordinates = document.createElement('span'); title.textContent = target.name; coordinates.textContent = `${target.lat.toFixed(4)}° lat · ${target.lon.toFixed(4)}° E → abrir escenario`;
      button.append(title, coordinates); button.addEventListener('click', () => chooseTarget(target)); list.append(button);
      const dot = document.createElement('button'); dot.type = 'button'; dot.className = 'nasa-map-marker'; dot.dataset.nasaMapMarker = target.targetId;
      dot.setAttribute('aria-label', `${target.name}: ${target.lat}° latitud, ${target.lon}° E. Abrir escenario.`); dot.setAttribute('aria-pressed', String(activeScenario === target.scenarioId));
      dot.style.left = `${(target.lon + 180) / 360 * 100}%`; dot.style.top = `${(90 - target.lat) / 180 * 100}%`;
      dot.addEventListener('click', () => chooseTarget(target)); map.append(dot);
    }
    if (!list.children.length) list.textContent = 'Coordenadas pendientes: no se inventan ubicaciones.';
  }
  async function render(refresh = false) {
    if (!details.open || disposed) return;
    ensureStage(); const token = ++generation; stage.cancelLoad();
    host.dataset.asset = ''; host.dataset.load = 'loading';
    stage.setObject(tab === 'gallery' ? schematic(selected === 'scarecrow' || selected === 'perseverance' ? 'rover' : 'wheel') : null);
    q('[data-nasa-registration]').hidden = tab === 'gallery';
    q('[data-nasa-stage-kind]').textContent = tab === 'gallery' ? 'REFERENCIA VISUAL / ESCALA NORMALIZADA' : 'GLOBO CARTOGRÁFICO / CENTROS ATLAS';
    card(tab === 'gallery' ? selected : tab, null);
    try { await getManifest(refresh); } catch (error) { if (token === generation) status.textContent = `Manifest no disponible: ${error.message} Fichas accesibles activas.`; return; }
    if (token !== generation || disposed) return;
    if (tab === 'gallery') {
      const asset = manifest.assets.find(a => a.id === selected); card(selected, asset);
      if (!stage.renderer) return;
      const success = await stage.load(asset, object => {
        if (selected === 'block-island') {
          // Explicit synthetic sampling pad, not an environment from an Atlas scenario.
          const pad = mesh(new THREE.BoxGeometry(4, .08, 3.3), 0x5b4737); pad.scale.setScalar(1 / object.scale.x); pad.position.y = (new THREE.Box3().setFromObject(object).min.y - .05) / object.scale.y; object.add(pad);
        }
        stage.target.set(0, 0, 0); stage.invalidate();
      });
      if (success && token === generation && selected === 'apollo-11') status.textContent += ' Z×60 de la fuente; excluido de pendientes.';
      return;
    }
    await getTargets(); if (token !== generation || disposed) return; showTargetButtons();
    q('[data-nasa-body-title]').textContent = `Objetivos de ${tab === 'moon' ? 'la Luna' : 'Marte'}`;
    q('[data-nasa-note]').textContent = 'Seleccioná un marcador o su botón para abrir el escenario Tierra–objetivo existente. Los centros proceden de los JSON de terreno de Atlas; una textura global solo aporta contexto visual.';
    const registration = q('[data-nasa-registration]'); registration.textContent = 'Esfera propia equirectangular: norte arriba, centro de imagen 0°E, borde ±180°. +X = 0°E; +Z = 90°O. Marcadores por latitud/longitud, sin inferir orientación del GLB NASA.';
    const group = new THREE.Group(), globe = mesh(new THREE.SphereGeometry(1.9, 64, 48), tab === 'moon' ? 0x8893a2 : 0x975b41); group.add(globe);
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.905, 24, 12)), new THREE.LineBasicMaterial({ color: 0x9dbbd9, transparent: true, opacity: .13 })); group.add(wire);
    for (const t of targets.filter(t => t.body === tab)) { const marker = mesh(new THREE.SphereGeometry(.065, 14, 10), t.scenarioId === activeScenario ? 0x8affde : 0xffbf63, { emissive: 0xff9f40, emissiveIntensity: .55 }); marker.position.fromArray(latLonVector(t.lat, t.lon, 1.96)); marker.userData.target = t; group.add(marker); }
    stage.setObject(group); stage.target.set(0, 0, 0); stage.distance = 7; stage.pitch = .15;
    const bodyTarget = targets.find(t => t.body === tab && t.scenarioId === activeScenario) || targets.find(t => t.body === tab);
    if (bodyTarget) { const v = latLonVector(bodyTarget.lat, bodyTarget.lon); stage.yaw = Math.atan2(v[0], v[2]); stage.pitch = Math.asin(v[1]); }
    const textureAsset = manifest.assets.find(a => a.id === `${tab}-color`);
    const mapImage = q('[data-nasa-map-image]'); mapImage.hidden = !textureAsset?.available;
    if (textureAsset?.available) { mapImage.src = textureAsset.localPath; mapImage.alt = `Mapa oficial ${tab === 'moon' ? 'lunar' : 'marciano'}, norte arriba y meridiano 0° central.`; }
    setCredit(textureAsset); host.dataset.load = 'ready'; host.dataset.asset = `${tab}-coordinates`; stage.invalidate();
    status.textContent = 'Globo de coordenadas activo. Textura oficial pendiente; los marcadores conservan sus coordenadas registradas.';
    if (textureAsset?.available) {
      try {
        const texture = await new THREE.TextureLoader().loadAsync(textureAsset.localPath);
        if (token !== generation || disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace; globe.material.map = texture; globe.material.color.set(0xffffff); globe.material.needsUpdate = true; stage.invalidate();
        status.textContent = `${tab === 'moon' ? 'Luna' : 'Marte'} · textura oficial equirectangular local; marcadores de Atlas seleccionables. Sin topografía física.`;
      } catch (error) { if (token === generation) status.textContent = `Textura no disponible: ${error.message} Globo de coordenadas activo, sin imagen cartográfica.`; }
    }
  }
  details.addEventListener('toggle', () => { if (details.open) render(); else if (stage) { generation++; stage.cancelLoad(); stage.stopFrame(); } });
  for (const button of root.querySelectorAll('[data-nasa-model]')) button.addEventListener('click', () => {
    selected = button.dataset.nasaModel; root.querySelectorAll('[data-nasa-model]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); render();
  });
  for (const button of root.querySelectorAll('[data-nasa-tab]')) button.addEventListener('click', () => {
    tab = button.dataset.nasaTab; root.querySelectorAll('[data-nasa-tab]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    q('[data-nasa-gallery]').hidden = tab !== 'gallery'; q('[data-nasa-targets]').hidden = tab === 'gallery'; stage?.reset(); render();
  });
  q('[data-nasa-center]').addEventListener('click', () => stage?.reset());
  q('[data-nasa-motion]').addEventListener('click', e => { if (!stage) return; stage.moving = !stage.moving && !stage.motion.matches; e.target.setAttribute('aria-pressed', String(stage.moving)); stage.invalidate(); });
  q('[data-nasa-retry]').addEventListener('click', () => render(true)); card(selected, null);
  return {
    setScenarios(items) { scenarios = items; targetsPromise = null; },
    selectScenario(scenario) { activeScenario = scenario.id; if (details.open && tab !== 'gallery') render(); },
    dispose() { disposed = true; generation++; stage?.dispose(); },
  };
}
