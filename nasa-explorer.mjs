import { NASA_MODEL_IDS, latLonVector, targetFromGrid } from './nasa-visual-math.mjs';
import { NasaStage, THREE, schematic, mesh, loadNasaManifest } from './nasa-stage.mjs';
const LABELS = { scarecrow: 'Scarecrow', perseverance: 'Perseverance', moon: 'Moon', mars: 'Mars', lro: 'LRO', 'block-island': 'Block Island', 'apollo-11': 'Apollo 11' };
const USES = { scarecrow: 'Reduced-mass testing', perseverance: 'Reference rover', moon: 'Educational globe', mars: 'Educational globe', lro: 'Lunar data source', 'block-island': 'Synthetic obstacle / sampling', 'apollo-11': 'Educational terrain, Z×60' };
const NOTES = {
  scarecrow: 'Reduced-mass testing: historical precedent of the lightened rover for Curiosity. The calculator uses your mass, never a mass derived from the model.',
  perseverance: 'Visual reference of the rover on the bench. The simulation rover keeps its own model, wheel names, orientation and original dimensions.',
  moon: 'Educational global model. Targets are selected on Atlas’s own cartographic globe using coordinates from the Atlas JSON, independent of this mesh’s orientation.',
  mars: 'Educational global model. Jezero and Coprates are selected from the cartographic globe; its texture never modifies the DEM or the physics.',
  lro: 'Lunar Reconnaissance Orbiter: LOLA provides altimetry and Diviner thermal radiometry. Atlas keeps the sources and limitations of each product; this model is not a link or an orbital measurement.',
  'block-island': 'Synthetic obstacle and sampling scene: Block Island is a rock observed by Opportunity at Meridiani Planum. This example does not represent Jezero, the Earth analog or an obstacle detected by our DEMs.',
  'apollo-11': 'Apollo 11 landing-site terrain (Tranquility Base, 30 × 30 km window). The relief carries the source’s built-in ×60 vertical exaggeration, so craters and ridges look far steeper than they are. Low raking light is a visual choice to make the craters readable. Excluded from slopes, navigation, DEM calculations and the Atlas geometric index.',
};
export function createNasaExplorer(root, onScenario) {
  root.innerHTML = `<header class="panel-heading"><h2><span>NASA</span> Real objects. Tests with limits.</h2><span class="data-badge" data-kind="archive">7 MODELS / LOCAL ARCHIVE</span></header>
    <details class="nasa-explorer-details"><summary>Explore models and targets on the Moon and Mars <span aria-hidden="true">＋</span></summary><div class="nasa-explorer-content">
    <p class="nasa-intro">A collection for understanding the test, its scale and the data origin. Choose a resource: only that file is loaded. Visual geometry and science keep separate sources.</p>
    <div class="nasa-explorer-tabs" role="group" aria-label="NASA explorer"><button type="button" data-nasa-tab="gallery" aria-pressed="true">01 · NASA gallery</button><button type="button" data-nasa-tab="moon" aria-pressed="false">02 · Moon targets</button><button type="button" data-nasa-tab="mars" aria-pressed="false">03 · Mars targets</button></div>
    <div class="nasa-explorer-layout"><div class="nasa-explorer-sidebar"><div data-nasa-gallery><div class="nasa-model-list" role="group" aria-label="Seven NASA models">${NASA_MODEL_IDS.map((id, index) => `<button type="button" data-nasa-model="${id}" aria-pressed="${index === 0}"><span>${String(index + 1).padStart(2, '0')}</span>${LABELS[id]}</button>`).join('')}</div></div>
    <div data-nasa-targets hidden><h3 data-nasa-body-title>Targets</h3><p>Coordinates of the real centers used by Atlas; not test polygons.</p><div data-nasa-target-list class="nasa-target-list"></div><p class="nasa-map-heading">Equirectangular reference · north up</p><div class="nasa-coordinate-map" aria-label="Reference map to check marker registration"><img data-nasa-map-image alt="Official equirectangular reference texture" hidden><div data-nasa-map-markers></div></div><div class="nasa-map-scale" aria-hidden="true"><span>180°W</span><span>0°E</span><span>180°E</span></div></div></div>
    <div><div class="nasa-stage nasa-gallery-stage" data-nasa-stage><div class="nasa-stage-label"><span data-nasa-stage-kind>VISUAL RESOURCE / NOT A TEST DEM</span><strong data-nasa-stage-title>Scarecrow</strong></div><div class="nasa-static-icon" aria-hidden="true">◌<small>Static view · accessible card</small></div></div><div class="nasa-stage-toolbar"><button type="button" data-nasa-center>Center camera</button><button type="button" data-nasa-motion aria-pressed="false">Ambient rotation</button><button type="button" data-nasa-retry>Retry resource</button></div><p data-nasa-load class="nasa-load-status" role="status">Open a resource to load it.</p></div></div>
    <article class="nasa-resource-card" aria-labelledby="nasa-resource-title"><div><p class="eyebrow" data-nasa-card-kind>NASA / VISUAL REFERENCE</p><h3 id="nasa-resource-title">Scarecrow</h3><p data-nasa-note></p><p data-nasa-registration hidden></p><p data-nasa-credit class="nasa-credit"></p></div><div><dl class="nasa-resource-meta" data-nasa-meta></dl><a href="docs/nasa-assets.md" target="_blank" rel="noopener noreferrer">Preparation, credits and limits ↗</a></div></article>
    <p class="nasa-boundary">Local NASA files normalized by bounding box, with no physical test scale. The Block Island scene and the Apollo 11 terrain are educational examples independent of the four scenarios.</p>
    </div></details>`;
  const q = s => root.querySelector(s), details = q('details'), host = q('[data-nasa-stage]'), status = q('[data-nasa-load]');
  let stage, tab = 'gallery', selected = 'scarecrow', manifest, scenarios = [], targets = [], targetsPromise, generation = 0, activeScenario = null, disposed = false;
  async function getManifest(refresh = false) { manifest = await loadNasaManifest(refresh); return manifest; }
  function setCredit(asset) {
    const credit = q('[data-nasa-credit]'); credit.replaceChildren();
    if (!asset) { credit.textContent = 'Credit pending from the local manifest.'; return; }
    credit.append(document.createTextNode(`${asset.credit} · `));
    for (const [key, text] of [['sourceUrl', 'NASA source ↗'], ['licenseUrl', 'Terms ↗']]) { const a = document.createElement('a'); a.href = asset[key]; a.textContent = text; a.target = '_blank'; a.rel = 'noopener noreferrer'; credit.append(a, document.createTextNode(' · ')); }
  }
  function card(id, asset) {
    q('#nasa-resource-title').textContent = LABELS[id]; q('[data-nasa-stage-title]').textContent = LABELS[id];
    q('[data-nasa-note]').textContent = NOTES[id]; q('[data-nasa-card-kind]').textContent = id === 'apollo-11' ? 'EDUCATIONAL TERRAIN / Z×60' : id === 'block-island' ? 'SYNTHETIC SCENE / NOT GEOLOCATED' : 'NASA / VISUAL REFERENCE';
    q('[data-nasa-meta]').replaceChildren();
    if (asset) for (const [label, text] of [['File', asset.available ? `${asset.format.toUpperCase()} · ${(asset.bytes / 1e6).toFixed(2)} MB` : 'Preparation pending'], ['Use', USES[id]], ['Integrity', asset.sha256 ? `SHA-256 ${asset.sha256.slice(0, 12)}…` : 'Pending']]) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = text; q('[data-nasa-meta]').append(dt, dd); }
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
    const syncMotion = () => { const button = q('[data-nasa-motion]'); button.disabled = stage.motion.matches; button.title = stage.motion.matches ? 'Rotation disabled by your reduced-motion preference.' : 'Optional scene rotation.'; button.setAttribute('aria-pressed', String(stage.moving)); };
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
      const title = document.createElement('strong'), coordinates = document.createElement('span'); title.textContent = target.name; coordinates.textContent = `${target.lat.toFixed(4)}° lat · ${target.lon.toFixed(4)}° E → open scenario`;
      button.append(title, coordinates); button.addEventListener('click', () => chooseTarget(target)); list.append(button);
      const dot = document.createElement('button'); dot.type = 'button'; dot.className = 'nasa-map-marker'; dot.dataset.nasaMapMarker = target.targetId;
      dot.setAttribute('aria-label', `${target.name}: ${target.lat}° latitude, ${target.lon}° E. Open scenario.`); dot.setAttribute('aria-pressed', String(activeScenario === target.scenarioId));
      dot.style.left = `${(target.lon + 180) / 360 * 100}%`; dot.style.top = `${(90 - target.lat) / 180 * 100}%`;
      dot.addEventListener('click', () => chooseTarget(target)); map.append(dot);
    }
    if (!list.children.length) list.textContent = 'Coordinates pending: no locations are invented.';
  }
  async function render(refresh = false) {
    if (!details.open || disposed) return;
    ensureStage(); const token = ++generation; stage.cancelLoad(); stage.setTerrainLook(false); stage.home = null;
    host.dataset.asset = ''; host.dataset.load = 'loading';
    stage.setObject(tab === 'gallery' ? schematic(selected === 'scarecrow' || selected === 'perseverance' ? 'rover' : 'wheel') : null);
    q('[data-nasa-registration]').hidden = tab === 'gallery';
    q('[data-nasa-stage-kind]').textContent = tab === 'gallery' ? 'VISUAL REFERENCE / NORMALIZED SCALE' : 'CARTOGRAPHIC GLOBE / ATLAS CENTERS';
    card(tab === 'gallery' ? selected : tab, null);
    try { await getManifest(refresh); } catch (error) { if (token === generation) status.textContent = `Manifest unavailable: ${error.message} Accessible cards stay active.`; return; }
    if (token !== generation || disposed) return;
    if (tab === 'gallery') {
      const asset = manifest.assets.find(a => a.id === selected); card(selected, asset);
      if (!stage.renderer) return;
      const success = await stage.load(asset, object => {
        if (selected === 'block-island') {
          // Explicit synthetic sampling pad, not an environment from an Atlas scenario.
          const pad = mesh(new THREE.BoxGeometry(4, .08, 3.3), 0x5b4737); pad.scale.setScalar(1 / object.scale.x); pad.position.y = (new THREE.Box3().setFromObject(object).min.y - .05) / object.scale.y; object.add(pad);
        }
        if (selected === 'apollo-11') {
          // Darker regolith grey (visual only) + closer, lower camera under a raking sun.
          object.traverse(o => { if (o.isMesh) { o.material.color.set(0x85837e); o.material.roughness = .97; o.material.metalness = 0; } });
          object.scale.multiplyScalar(1.5); stage.home = { yaw: .2, pitch: .3, distance: 5.6 }; stage.reset(); stage.setTerrainLook(true);
        }
        stage.target.set(0, 0, 0); stage.invalidate();
      });
      if (success && token === generation && selected === 'apollo-11') status.textContent += ' Source Z×60 exaggeration; excluded from slopes.';
      return;
    }
    await getTargets(); if (token !== generation || disposed) return; showTargetButtons();
    q('[data-nasa-body-title]').textContent = `${tab === 'moon' ? 'Moon' : 'Mars'} targets`;
    q('[data-nasa-note]').textContent = 'Select a marker or its button to open the existing Earth–target scenario. Centers come from the Atlas terrain JSON; a global texture only adds visual context.';
    const registration = q('[data-nasa-registration]'); registration.textContent = 'Own equirectangular sphere: north up, image center 0°E, edge ±180°. +X = 0°E; +Z = 90°W. Markers by latitude/longitude, without inferring orientation from the NASA GLB.';
    const group = new THREE.Group(), globe = mesh(new THREE.SphereGeometry(1.9, 64, 48), tab === 'moon' ? 0x8893a2 : 0x975b41); group.add(globe);
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.905, 24, 12)), new THREE.LineBasicMaterial({ color: 0x9dbbd9, transparent: true, opacity: .13 })); group.add(wire);
    for (const t of targets.filter(t => t.body === tab)) { const marker = mesh(new THREE.SphereGeometry(.065, 14, 10), t.scenarioId === activeScenario ? 0x8affde : 0xffbf63, { emissive: 0xff9f40, emissiveIntensity: .55 }); marker.position.fromArray(latLonVector(t.lat, t.lon, 1.96)); marker.userData.target = t; group.add(marker); }
    stage.setObject(group); stage.target.set(0, 0, 0); stage.distance = 7; stage.pitch = .15;
    const bodyTarget = targets.find(t => t.body === tab && t.scenarioId === activeScenario) || targets.find(t => t.body === tab);
    if (bodyTarget) { const v = latLonVector(bodyTarget.lat, bodyTarget.lon); stage.yaw = Math.atan2(v[0], v[2]); stage.pitch = Math.asin(v[1]); }
    const textureAsset = manifest.assets.find(a => a.id === `${tab}-color`);
    const mapImage = q('[data-nasa-map-image]'); mapImage.hidden = !textureAsset?.available;
    if (textureAsset?.available) { mapImage.src = textureAsset.localPath; mapImage.alt = `Official ${tab === 'moon' ? 'lunar' : 'Martian'} map, north up with the 0° meridian centered.`; }
    setCredit(textureAsset); host.dataset.load = 'ready'; host.dataset.asset = `${tab}-coordinates`; stage.invalidate();
    status.textContent = 'Coordinate globe active. Official texture pending; markers keep their registered coordinates.';
    if (textureAsset?.available) {
      try {
        const texture = await new THREE.TextureLoader().loadAsync(textureAsset.localPath);
        if (token !== generation || disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace; globe.material.map = texture; globe.material.color.set(0xffffff); globe.material.needsUpdate = true; stage.invalidate();
        status.textContent = `${tab === 'moon' ? 'Moon' : 'Mars'} · local official equirectangular texture; selectable Atlas markers. No physical topography.`;
      } catch (error) { if (token === generation) status.textContent = `Texture unavailable: ${error.message} Coordinate globe active, without cartographic imagery.`; }
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
