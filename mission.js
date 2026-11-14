// Analog Atlas Mission Control · A.R.E.S. Twin — 3D globe, terrain, rover HUD and scenario comparison.
// Honesty rules: nothing is labelled «en vivo» unless the backend says live:true; the geometric index is never
// called «similitud planetaria»; external data is always rendered as text (textContent), never as HTML.
import * as THREE from './assets/vendor/three.module.min.js';
import {
  clamp, validGrid, gridExtent, waypointsFor, sampleHeight, sampleSlope, elevationRange, centerProfile,
  slopeAlert, newRover, advanceRover, localCoordinates,
} from './mission-math.mjs';

const $ = (id) => document.getElementById(id);
function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}
const ENGINE = globalThis.ATLAS_ENGINE;
const SITES = globalThis.ANALOG_SITES || [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = matchMedia('(max-width: 760px)');
const num = (v, digits = 1) => Number.isFinite(v) ? v.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const PENDING = 'sin dato';
const U = 0.1;            // scene units per metre
const EXAG = 2;           // vertical exaggeration, labelled in the HUD
const ROVER_SCALE = 14;   // rover drawn ×14 so it is visible on a 2.4 km window
const BODY_LABEL = { earth: 'TIERRA', moon: 'LUNA', mars: 'MARTE' };
const KIND_LABEL = { live: 'EN VIVO', diviner: 'LRO DIVINER · ARCHIVO', literature: 'LITERATURA', model: 'MODELO' };
const PROVIDER_LABEL = { gemini: 'GEMINI', anthropic: 'ANTHROPIC CLAUDE', rules: 'REGLAS LOCALES' };

async function fetchJSON(url, { timeout = 8000, cache = 'default', method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      cache, method, signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) { const error = new Error(`HTTP ${response.status}`); error.status = response.status; throw error; }
    return await response.json();
  } finally { clearTimeout(timer); }
}

// ---------------------------------------------------------------- state
const S = {
  profile: null, ranking: [], siteId: null, view: 'globe',
  grids: new Map(), grid: null, gridError: null,
  rover: newRover(), running: false, started: false, mode: 'auto', keys: new Set(), pad: new Set(),
  motion: !reducedMotion.matches, speedHistory: [], lastSlopeLevel: null, batteryWarned: false,
  backend: undefined, snapshot: undefined,
  scenarios: [], scenario: null, sc: null, splitPane: 'earth',
  physics: null, similarity: null, rules: null, physicsBroken: false,
  logEntries: [], copilotBusy: false, siteTelemetry: {},
};

// ---------------------------------------------------------------- announcements, clock and log
function announce(message) {
  const region = $('announcement');
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}
function tickClock() { $('utc-clock').textContent = `${new Date().toISOString().slice(11, 19)} UTC`; }
tickClock();
setInterval(tickClock, 1000);

const LOG_CLASS = { SIM: 'sim', WARN: 'warn', ALERTA: 'warn' };
function log(type, message) {
  const at = new Date();
  S.logEntries.push({ at: at.toISOString(), type, message });
  if (S.logEntries.length > 300) S.logEntries.shift();
  const item = el('li');
  const time = el('time', '', at.toISOString().slice(11, 19));
  time.dateTime = at.toISOString();
  item.append(time, el('span', `log-type ${LOG_CLASS[type] || ''}`.trim(), type), el('span', 'log-message', message));
  const list = $('operation-log');
  list.prepend(item);
  while (list.children.length > 60) list.lastElementChild.remove();
}

// ---------------------------------------------------------------- optional modules (front 5)
async function loadOptional(path, required, bust = false) {
  try {
    const mod = await import(bust ? `${path}?r=${Date.now()}` : path);
    return required.every((name) => typeof mod[name] === 'function') ? mod : null;
  } catch { return null; }
}
async function loadOptionalModules(bust = false) {
  if (!S.physics) S.physics = await loadOptional('./sim-physics.mjs', ['attitude', 'solarPowerW', 'batteryStep', 'driveLoadW', 'thermalStatus'], bust);
  if (!S.similarity) S.similarity = await loadOptional('./similarity.mjs', ['compareTerrain'], bust);
  if (!S.rules) S.rules = await loadOptional('./copilot-rules.mjs', ['answerLocally'], bust);
  if (!S.processes) S.processes = await loadOptional('./processes.mjs', ['analyzeProcesses', 'summarizeProcesses', 'saltationState', 'freezeEvents', 'frictionVelocity'], bust);
  renderResourceStatus();
}

// ---------------------------------------------------------------- profiles, list, search
const PROFILE_UI = { 'mars-dunes': ['Marte', 'Dunas', '≋'], 'moon-traverse': ['Luna', 'Roca', '△'], 'mars-drilling': ['Marte', 'Muestreo', '⊙'] };
const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const siteById = (id) => SITES.find((s) => s.id === id);

function renderProfiles() {
  const box = $('mission-profiles');
  box.replaceChildren();
  for (const profile of ENGINE.profiles) {
    const [body, label, symbol] = PROFILE_UI[profile.id] || ['', profile.name, '◇'];
    const button = el('button', 'mission-profile');
    button.type = 'button';
    button.dataset.profile = profile.id;
    button.setAttribute('aria-label', profile.name);
    button.setAttribute('aria-pressed', 'false');
    const icon = el('span', '', symbol);
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon, el('small', '', body), el('strong', '', label));
    button.addEventListener('click', () => { if (S.profile !== profile) selectProfile(profile, true); });
    box.append(button);
  }
}
function selectProfile(profile, user = false) {
  S.profile = profile;
  S.ranking = ENGINE.createRanking(profile, SITES);
  for (const b of $('mission-profiles').children) b.setAttribute('aria-pressed', String(b.dataset.profile === profile.id));
  const purpose = $('mission-purpose');
  const reference = el('a', '', `${profile.reference} ↗`);
  reference.href = profile.url; reference.target = '_blank'; reference.rel = 'noopener noreferrer';
  purpose.replaceChildren(document.createTextNode(`${profile.summary} `), reference);
  renderSiteList();
  if (user) {
    const top = S.ranking[0];
    log('SIS', `Perfil ${profile.name}: ${top.site.name} encabeza con ${top.score} pts documentales.`);
    announce(`Perfil ${profile.name}. Primer lugar: ${top.site.name}, ${top.score} puntos documentales.`);
    if (S.view === 'globe') selectSite(top.site.id, { quiet: true });
  }
}
function renderSiteList() {
  const list = $('mission-sites');
  list.replaceChildren();
  for (const [index, entry] of S.ranking.entries()) {
    const { site, score, evidence } = entry;
    const button = el('button', 'site-row');
    button.type = 'button';
    button.dataset.site = site.id;
    button.setAttribute('aria-pressed', String(S.view !== 'split' && site.id === S.siteId));
    button.setAttribute('aria-label', `${index + 1}. ${site.name}, ${site.country}. ${score} puntos documentales.`);
    const name = el('span');
    name.append(el('strong', '', site.name), el('small', '', `${site.country} · ${evidence ? 'Antecedente documentado' : 'Candidato'}`));
    button.append(el('span', 'site-number', String(index + 1).padStart(2, '0')), name, el('span', 'site-points', String(score)));
    button.addEventListener('click', () => selectSite(site.id));
    const item = el('li');
    item.dataset.search = normalize(`${site.name} ${site.country} ${site.terrain}`);
    item.append(button);
    list.append(item);
  }
  applySearch();
}
function applySearch() {
  const query = normalize($('site-search').value.trim());
  let visible = 0;
  for (const item of $('mission-sites').children) {
    const show = !query || item.dataset.search.includes(query);
    item.hidden = !show;
    if (show) visible++;
  }
  $('empty-search').hidden = visible > 0;
}
$('site-search').addEventListener('input', applySearch);
$('site-search').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.target.value = ''; applySearch(); }
  if (event.key === 'Enter') {
    const first = [...$('mission-sites').children].find((li) => !li.hidden);
    if (first) first.querySelector('button').click();
  }
});

// ---------------------------------------------------------------- site selection
function renderTargetSummary() {
  if (S.view === 'split' && S.scenario && S.sc) {
    $('target-country').textContent = `ESCENARIO A.R.E.S. / ${BODY_LABEL[S.scenario.body] || 'OBJETIVO'}`;
    $('target-name').textContent = `${S.sc.earthName} ↔ ${S.sc.targetName}`;
    $('target-terrain').textContent = S.scenario.focus;
    $('launch-mission').lastChild.textContent = ' Iniciar en el análogo';
    return;
  }
  const site = siteById(S.siteId);
  if (!site) return;
  const entry = S.ranking.find((r) => r.site.id === site.id);
  $('target-name').textContent = site.name;
  $('target-country').textContent = `${site.country.toUpperCase()} / ANÁLOGO TERRESTRE`;
  $('target-terrain').textContent = `${site.terrain}. ${ENGINE.terrainType(site).name}${entry ? ` · ${entry.score} pts documentales` : ''}.`;
  $('launch-mission').lastChild.textContent = ' Iniciar misión';
  $('scene-coordinate').textContent = `${Math.abs(site.lat).toFixed(3)}°${site.lat >= 0 ? 'N' : 'S'} · ${Math.abs(site.lon).toFixed(3)}°${site.lon >= 0 ? 'E' : 'O'} / WGS84 APROX.`;
}
function markSiteRows() {
  const scenarioMode = S.view === 'split';
  for (const b of $('mission-sites').querySelectorAll('.site-row')) b.setAttribute('aria-pressed', String(!scenarioMode && b.dataset.site === S.siteId));
}
function selectSite(id, { quiet = false } = {}) {
  const site = siteById(id);
  if (!site) return;
  const changed = S.siteId !== id;
  S.siteId = id;
  markSiteRows();
  $('orbital-name').textContent = site.name;
  renderTargetSummary();
  const d = 0.6;
  $('worldview-link').href = `https://worldview.earthdata.nasa.gov/?v=${(site.lon - d).toFixed(3)},${(site.lat - d).toFixed(3)},${(site.lon + d).toFixed(3)},${(site.lat + d).toFixed(3)}`;
  globe.highlight(id);
  if (S.view === 'globe') globe.focus(site);
  if (changed) {
    if (!quiet) { log('SIS', `Objetivo seleccionado: ${site.name} (${site.country}).`); announce(`Seleccionado: ${site.name}, ${site.country}.`); }
    S.grid = null;
    loadSiteGrid(id).then(() => {
      if (S.view === 'terrain') activateAtlasTerrain();
      if (S.view !== 'split') { drawElevation(); renderSources(); }
    });
    if (!(id in S.siteTelemetry)) {
      S.siteTelemetry[id] = null;
      getTelemetry(id, [site.lat, site.lon]).then((result) => {
        S.siteTelemetry[id] = result.data;
        if (S.siteId === id && S.view !== 'split') renderSources();
      });
    }
    if (S.view === 'split') setView('terrain');
  }
  renderResourceStatus();
}

async function loadSiteGrid(id, { reload = false } = {}) {
  if (!reload && S.grids.has(id)) { if (S.siteId === id) S.grid = S.grids.get(id); return S.grids.get(id); }
  try {
    const grid = await fetchJSON(`assets/data/${id}.json`, { cache: reload ? 'reload' : 'default' });
    if (!validGrid(grid)) throw new Error('rejilla inválida');
    S.grids.set(id, grid);
    if (S.siteId === id) { S.grid = grid; S.gridError = null; }
    return grid;
  } catch (error) {
    if (S.siteId === id) { S.grid = null; S.gridError = error.message; }
    log('WARN', `DEM de ${id} no disponible (${error.message}).`);
    return null;
  }
}

// ---------------------------------------------------------------- WebGL setup
const canvas = $('atlas-scene');
const viewport = $('scene-viewport');
let renderer = null;
try {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('sin WebGL');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} catch {
  renderer = null;
  canvas.hidden = true;
  $('scene-fallback').hidden = false;
  $('globe-hint').hidden = true;
}
const textureLoader = new THREE.TextureLoader();
function loadTexture(path) {
  return new Promise((resolve) => {
    textureLoader.load(path, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      if (renderer) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      resolve(texture);
    }, undefined, () => resolve(null));
  });
}
function disposeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of materials) { if (m) { m.map?.dispose(); m.dispose(); } }
  });
}

// ---------------------------------------------------------------- globe
function latLonToVector(lat, lon, radius = 1) {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * radius, Math.sin(a) * radius, -Math.cos(a) * Math.sin(b) * radius);
}
const globe = (() => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const group = new THREE.Group();
  const state = { dist: 3.4, rotX: 0.35, rotY: -1.6, goal: null };
  const markers = new Map();
  const hits = [];
  scene.add(group, new THREE.AmbientLight(0xbfd4ff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-3, 2, 4);
  scene.add(sun);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ color: 0x2e5a9a, roughness: 0.9, metalness: 0 }));
  group.add(earth);
  loadTexture('assets/earth/blue-marble.jpg').then((map) => { if (map) { earth.material.map = map; earth.material.color.set(0xffffff); earth.material.needsUpdate = true; } });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 32), new THREE.MeshBasicMaterial({ color: 0x2e96f5, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }));
  scene.add(atmosphere);
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20);
    starPositions.set([v.x, v.y, v.z], i * 3);
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xb4c8e6, size: 0.08, sizeAttenuation: true })));
  const markerGeometry = new THREE.SphereGeometry(0.016, 16, 12);
  const hitGeometry = new THREE.SphereGeometry(0.05, 8, 6);
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  for (const site of SITES) {
    const marker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: 0x2e96f5 }));
    marker.position.copy(latLonToVector(site.lat, site.lon, 1.008));
    const hit = new THREE.Mesh(hitGeometry, hitMaterial);
    hit.position.copy(marker.position);
    hit.userData.siteId = site.id;
    group.add(marker, hit);
    markers.set(site.id, marker);
    hits.push(hit);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.04, 40), new THREE.MeshBasicMaterial({ color: 0xeafe07, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  group.add(ring);
  const raycaster = new THREE.Raycaster();

  function highlight(id) {
    for (const [siteId, marker] of markers) {
      const selected = siteId === id;
      marker.material.color.set(selected ? 0xeafe07 : 0x2e96f5);
      marker.scale.setScalar(selected ? 1.6 : 1);
    }
    const site = siteById(id);
    if (site) {
      const position = latLonToVector(site.lat, site.lon, 1.012);
      ring.position.copy(position);
      ring.lookAt(position.clone().multiplyScalar(2));
    }
  }
  function focus(site) {
    const targetY = -Math.PI / 2 - site.lon * Math.PI / 180;
    let delta = (targetY - state.rotY) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    state.goal = { x: clamp(site.lat * Math.PI / 180, -1.2, 1.2), y: state.rotY + delta };
    if (reducedMotion.matches) { state.rotX = state.goal.x; state.rotY = state.goal.y; state.goal = null; }
  }
  function update(dt) {
    if (state.goal) {
      const k = 1 - Math.exp(-dt * 4);
      state.rotX += (state.goal.x - state.rotX) * k;
      state.rotY += (state.goal.y - state.rotY) * k;
      if (Math.abs(state.goal.x - state.rotX) + Math.abs(state.goal.y - state.rotY) < 0.002) state.goal = null;
    } else if (S.motion && !pointer.dragging) state.rotY += dt * 0.05;
    group.rotation.set(state.rotX, state.rotY, 0, 'XYZ');
    camera.position.set(0, 0, state.dist * Math.max(1, 1.1 / camera.aspect));
    camera.lookAt(0, 0, 0);
    ring.material.opacity = S.motion ? 0.6 + 0.35 * Math.sin(performance.now() / 300) : 0.9;
  }
  function pick(ndc) {
    raycaster.setFromCamera(ndc, camera);
    const [first] = raycaster.intersectObjects([earth, ...hits], false);
    if (!first || first.object === earth) {
      // tolerance: nearest visible marker in screen space within 22 px
      return null;
    }
    return first.object.userData.siteId;
  }
  function nearestOnScreen(px, py, width, height) {
    let best = null, bestDistance = 22;
    const camDir = camera.position.clone().normalize();
    for (const [id, marker] of markers) {
      const world = marker.getWorldPosition(new THREE.Vector3());
      if (world.clone().normalize().dot(camDir) < 0.15) continue;
      const p = world.project(camera);
      const sx = (p.x + 1) / 2 * width, sy = (1 - p.y) / 2 * height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestDistance) { bestDistance = d; best = id; }
    }
    return best;
  }
  return {
    scene, camera, state, highlight, focus, update, pick, nearestOnScreen,
    rotate(dx, dy) { state.goal = null; state.rotY += dx * 0.006; state.rotX = clamp(state.rotX + dy * 0.006, -1.3, 1.3); },
    zoom(factor) { state.dist = clamp(state.dist * factor, 1.45, 6); },
  };
})();

// ---------------------------------------------------------------- terrain scenes
function makeRoverModel(ghost = false) {
  const group = new THREE.Group();
  const s = ROVER_SCALE * U; // metres → units, enlarged
  const material = (color) => ghost
    ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8 * s, 0.5 * s, 2.8 * s), material(ghost ? 0xff9b54 : 0xe8eef8));
  body.position.y = 0.85 * s;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3 * s, 0.08 * s, 1.6 * s), material(ghost ? 0xff9b54 : 0x0960e1));
  deck.position.set(0, 1.2 * s, 0.4 * s);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 1.3 * s, 8), material(0xb4c8e6));
  mast.position.set(0, 1.7 * s, -1.0 * s);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.3 * s, 0.35 * s), material(ghost ? 0xff9b54 : 0xeafe07));
  head.position.set(0, 2.4 * s, -1.0 * s);
  group.add(body, deck, mast, head);
  const wheelGeometry = new THREE.CylinderGeometry(0.35 * s, 0.35 * s, 0.3 * s, 14);
  wheelGeometry.rotateZ(Math.PI / 2);
  for (const x of [-1.05, 1.05]) for (const z of [-1.1, 0, 1.1]) {
    const wheel = new THREE.Mesh(wheelGeometry, material(0x1a2a4a));
    wheel.position.set(x * s, 0.35 * s, z * s);
    wheel.userData.wheel = { radius: 0.35 * s, sign: -1 }; // placeholder faces −z
    group.add(wheel);
  }
  // beacon so the rover can be located from far away
  const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.5 * s, 1.2 * s, 4), new THREE.MeshBasicMaterial({ color: ghost ? 0xff9b54 : 0xeafe07 }));
  beacon.rotation.x = Math.PI;
  beacon.position.y = 4.2 * s;
  beacon.name = 'beacon';
  group.add(beacon);
  return group;
}
const BODY_RAMP = {
  earth: [0x6b5a43, 0xc9b28a], moon: [0x3c3c40, 0xbdbdc2], mars: [0x5a2a16, 0xd08850],
};
const BODY_BG = { earth: null, moon: 0x05070d, mars: 0x1d0f0a };

function createTerrainScene({ ghost = false } = {}) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x1a1408, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-120, 160, 80);
  scene.add(sun);
  const root = new THREE.Group();
  scene.add(root);
  const rover = makeRoverModel(ghost);
  rover.visible = false;
  const wheels = [];
  rover.traverse((node) => { if (node.userData.wheel) wheels.push(node); });
  scene.add(rover);
  const pathGeometry = new THREE.BufferGeometry();
  pathGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(1500 * 3), 3));
  pathGeometry.setDrawRange(0, 0);
  const path = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: ghost ? 0xff9b54 : 0xeafe07 }));
  path.frustumCulled = false;
  scene.add(path);
  const waypointGroup = new THREE.Group();
  scene.add(waypointGroup);
  return { scene, root, rover, path, waypointGroup, wheels, lastPos: null, grid: null, base: 0, mesh: null, token: 0 };
}
const terrainA = createTerrainScene();
const terrainB = createTerrainScene({ ghost: true });

// NASA/JPL-Caltech Perseverance glTF (11.7 MB), loaded lazily the first time a
// terrain is shown. Until it arrives (or if it fails) the procedural rover stays.
const PERSEVERANCE_URL = 'assets/models/perseverance.glb';
const PERSEVERANCE_LENGTH_M = 3.0; // real rover ≈ 3 m long; drawn ×ROVER_SCALE like the placeholder
const PERSEVERANCE_YAW = Math.PI;  // model faces +z; the simulation's forward is −z (north)
let perseveranceState = 'idle';
function adoptModel(T, template, ghost) {
  const model = template.clone(true);
  if (ghost) {
    const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0xff9b54, transparent: true, opacity: 0.55, depthWrite: false });
    model.traverse((node) => { if (node.isMesh) node.material = ghostMaterial; });
  }
  for (const child of [...T.rover.children]) if (child.name !== 'beacon') child.visible = false;
  model.name = 'perseverance';
  T.rover.add(model);
  model.updateMatrixWorld(true);
  T.wheels = [];
  model.traverse((node) => {
    if (!node.userData.wheel) return;
    // radius in scene units: local radius × accumulated scale of the wrapper
    const scale = new THREE.Vector3(); node.getWorldScale(scale);
    const rel = T.rover.getWorldScale(new THREE.Vector3());
    node.userData.wheel = { ...node.userData.wheel, radius: node.userData.wheel.localRadius * scale.x / rel.x };
    T.wheels.push(node);
  });
}
// The NASA model ships its six wheels as one mesh ('Wheels_objs'). Split it into one pivot per wheel
// (left/right × front/middle/rear) so each can roll around its own axle (model x axis).
function splitWheels(root) {
  const source = root.getObjectByName('Wheels_objs');
  if (!source) return 0;
  const parts = [];
  source.traverse((node) => { if (node.isMesh) parts.push({ mesh: node, geo: node.geometry.index ? node.geometry.toNonIndexed() : node.geometry }); });
  if (!parts.length) return 0;
  // shared buckets for all material primitives, so tyre, rim and hub of one wheel share one axle
  const box = new THREE.Box3();
  for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
  const third = (box.max.z - box.min.z) / 3, midX = (box.min.x + box.max.x) / 2;
  const wheelBoxes = Array.from({ length: 6 }, () => new THREE.Box3());
  for (const p of parts) {
    const pos = p.geo.attributes.position;
    p.buckets = Array.from({ length: 6 }, () => []);
    for (let t = 0; t < pos.count; t += 3) {
      const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
      const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
      const k = (cx < midX ? 0 : 3) + Math.min(2, Math.floor((cz - box.min.z) / third));
      p.buckets[k].push(t);
      for (let v = 0; v < 3; v++) wheelBoxes[k].expandByPoint(new THREE.Vector3(pos.getX(t + v), pos.getY(t + v), pos.getZ(t + v)));
    }
  }
  let made = 0;
  for (let k = 0; k < 6; k++) {
    if (wheelBoxes[k].isEmpty()) continue;
    const center = wheelBoxes[k].getCenter(new THREE.Vector3()), size = wheelBoxes[k].getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(center);
    pivot.userData.wheel = { localRadius: Math.max(size.y, size.z) / 2, sign: 1 }; // model faces +z
    for (const p of parts) {
      const tris = p.buckets[k];
      if (!tris.length) continue;
      const geom = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(p.geo.attributes)) {
        const n = attr.itemSize, out = new Float32Array(tris.length * 3 * n);
        tris.forEach((t, i) => { for (let v = 0; v < 3; v++) for (let c = 0; c < n; c++) out[(i * 3 + v) * n + c] = attr.getComponent(t + v, c); });
        geom.setAttribute(name, new THREE.BufferAttribute(out, n));
      }
      geom.translate(-center.x, -center.y, -center.z);
      pivot.add(new THREE.Mesh(geom, p.mesh.material));
    }
    source.add(pivot);
    made++;
  }
  for (const p of parts) p.mesh.geometry = new THREE.BufferGeometry();
  return made;
}
function requestPerseverance() {
  if (perseveranceState !== 'idle') return;
  perseveranceState = 'loading';
  import('./assets/vendor/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(PERSEVERANCE_URL))
    .then((gltf) => {
      const template = new THREE.Group();
      const model = gltf.scene;
      const wheelCount = splitWheels(model);
      model.rotation.y = PERSEVERANCE_YAW;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const scale = (PERSEVERANCE_LENGTH_M * ROVER_SCALE * U) / Math.max(size.x, size.z);
      const wrapper = new THREE.Group();
      wrapper.add(model);
      wrapper.scale.setScalar(scale);
      const center = box.getCenter(new THREE.Vector3());
      wrapper.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      template.add(wrapper);
      adoptModel(terrainA, template, false);
      adoptModel(terrainB, template, true);
      perseveranceState = 'ready';
      log('DATA', `Modelo 3D Perseverance cargado · NASA/JPL-Caltech (glTF oficial) · ${wheelCount} ruedas animadas.`);
    })
    .catch((error) => {
      perseveranceState = 'failed';
      console.warn('Perseverance model unavailable; keeping placeholder rover.', error);
    });
}

function displayHeight(T, x, z) {
  const h = sampleHeight(T.grid, x, z);
  return h === null ? 0 : (h - T.base) * EXAG * U;
}
async function buildTerrain(T, grid, { imageryPath = null, body = 'earth' } = {}) {
  const token = ++T.token;
  disposeObject(T.root);
  T.root.clear();
  disposeObject(T.waypointGroup);
  T.waypointGroup.clear();
  T.grid = validGrid(grid) ? grid : null;
  T.mesh = null;
  T.body = body;
  T.scene.background = BODY_BG[body] !== null && BODY_BG[body] !== undefined ? new THREE.Color(BODY_BG[body]) : null;
  applyAtmosphere(T);
  if (!T.grid) { T.rover.visible = false; T.path.visible = false; return; }
  const range = elevationRange(grid);
  T.base = range.min;
  const extent = gridExtent(grid);
  const size = extent * U;
  const segments = Math.min(128, Math.max(grid.gridSize - 1, 96));
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const [low, high] = (BODY_RAMP[body] || BODY_RAMP.earth).map((c) => new THREE.Color(c));
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / U, z = position.getZ(i) / U;
    const h = sampleHeight(grid, x, z);
    position.setY(i, (h - T.base) * EXAG * U);
    color.copy(low).lerp(high, range.relief > 0 ? (h - range.min) / range.relief : 0.5);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  T.root.add(mesh);
  T.mesh = mesh;
  // skirt: closes the block so the window reads as a sample, not an infinite surface
  const skirtPositions = [];
  const floor = -6;
  const edge = (fx, fz) => { const x = fx * extent / 2, z = fz * extent / 2; return [x * U, displayHeight(T, x, z), z * U]; };
  const sides = [[(t) => edge(t, -1)], [(t) => edge(1, t)], [(t) => edge(-t, 1)], [(t) => edge(-1, -t)]];
  for (const [fn] of sides) {
    for (let i = 0; i < 48; i++) {
      const a = fn(-1 + 2 * i / 48), b = fn(-1 + 2 * (i + 1) / 48);
      skirtPositions.push(...a, ...b, b[0], floor, b[2], ...a, b[0], floor, b[2], a[0], floor, a[2]);
    }
  }
  const skirtGeometry = new THREE.BufferGeometry();
  skirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(skirtPositions, 3));
  T.root.add(new THREE.Mesh(skirtGeometry, new THREE.MeshBasicMaterial({ color: 0x0b2152, side: THREE.DoubleSide })));
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size, 0.01, size)), new THREE.LineBasicMaterial({ color: 0x2b4371 }));
  frame.position.y = floor;
  T.root.add(frame);
  // waypoints of the autonomous loop
  for (const [x, z] of waypointsFor(grid)) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 6), new THREE.MeshBasicMaterial({ color: 0x2e96f5 }));
    post.position.set(x * U, displayHeight(T, x, z) + 3, z * U);
    T.waypointGroup.add(post);
  }
  T.rover.visible = true;
  T.path.visible = true;
  if (imageryPath) {
    const map = await loadTexture(imageryPath);
    if (token !== T.token) { map?.dispose(); return; }
    if (map) { material.map = map; material.vertexColors = false; material.needsUpdate = true; }
  }
}
function placeRover(T, rover) {
  if (!T.grid) return;
  requestPerseverance();
  const x = clamp(rover.x, -gridExtent(T.grid) / 2, gridExtent(T.grid) / 2);
  const z = clamp(rover.z, -gridExtent(T.grid) / 2, gridExtent(T.grid) / 2);
  const y = displayHeight(T, x, z);
  T.rover.position.set(x * U, y, z * U);
  if (T.lastPos) {
    const h = rover.heading * Math.PI / 180;
    const travel = (x - T.lastPos.x) * Math.sin(h) - (z - T.lastPos.z) * Math.cos(h); // signed metres along heading
    if (Math.abs(travel) < 50) for (const w of T.wheels) w.rotation.x += w.userData.wheel.sign * travel * U / w.userData.wheel.radius;
  }
  T.lastPos = { x, z };
  const d = Math.max(T.grid.spacingMeters, 10);
  const normal = new THREE.Vector3(
    displayHeight(T, x - d, z) - displayHeight(T, x + d, z), 2 * d * U,
    displayHeight(T, x, z - d) - displayHeight(T, x, z + d)).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rover.heading * Math.PI / 180);
  T.rover.quaternion.copy(tilt.multiply(yaw));
  const beacon = T.rover.getObjectByName('beacon');
  if (beacon) beacon.visible = !STREAM.on;
  if (beacon) beacon.position.y = ROVER_SCALE * U * (4.2 + (S.motion ? 0.4 * Math.sin(performance.now() / 250) : 0));
  const positions = T.path.geometry.attributes.position;
  const count = Math.min(rover.path.length, 1500);
  for (let i = 0; i < count; i++) {
    const [px, pz] = rover.path[rover.path.length - count + i];
    positions.setXYZ(i, px * U, displayHeight(T, px, pz) + 0.4, pz * U);
  }
  positions.needsUpdate = true;
  T.path.geometry.setDrawRange(0, count);
  T.waypointGroup.visible = S.mode === 'auto' && !(STREAM.on && STREAM.cam !== 'orbit');
}

// shared terrain camera: the split view renders both scenes with this one camera, so they stay in sync
const tcam = new THREE.PerspectiveCamera(45, 1, 1, 4000);
const orbit = { az: -0.7, el: 0.62, dist: 170, target: new THREE.Vector3(), follow: true };
function updateTerrainCamera(dt) {
  if (STREAM.on && STREAM.cam !== 'orbit' && terrainA.grid) { streamCamera(dt); return; }
  if (tcam.fov !== 45) { tcam.fov = 45; }
  if (S.motion && !pointer.dragging) orbit.az += dt * 0.03;
  const T = terrainA;
  if (orbit.follow && T.grid) {
    const goal = new THREE.Vector3(S.rover.x * U, displayHeight(T, S.rover.x, S.rover.z), S.rover.z * U);
    orbit.target.lerp(goal, reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 3));
  }
  const { az, el: elevation, dist } = orbit;
  tcam.position.set(
    orbit.target.x + dist * Math.cos(elevation) * Math.sin(az),
    orbit.target.y + dist * Math.sin(elevation),
    orbit.target.z + dist * Math.cos(elevation) * Math.cos(az));
  tcam.lookAt(orbit.target);
}

// ---------------------------------------------------------------- pointer, wheel, resize
const pointer = { dragging: false, moved: 0, x: 0, y: 0, active: new Map(), pinch: 0 };
canvas.addEventListener('pointerdown', (event) => {
  pointer.active.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.setPointerCapture(event.pointerId);
  pointer.dragging = true; pointer.moved = 0; pointer.x = event.clientX; pointer.y = event.clientY;
  if (pointer.active.size === 2) {
    const [a, b] = [...pointer.active.values()];
    pointer.pinch = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointer.active.has(event.pointerId)) {
    if (S.view === 'globe' && renderer) {
      const rect = canvas.getBoundingClientRect();
      canvas.style.cursor = globe.nearestOnScreen(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height) ? 'pointer' : 'grab';
    }
    return;
  }
  pointer.active.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointer.active.size === 2) {
    const [a, b] = [...pointer.active.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (pointer.pinch > 0) zoom(pointer.pinch / distance);
    pointer.pinch = distance;
    pointer.moved += 10;
    return;
  }
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
  pointer.x = event.clientX; pointer.y = event.clientY;
  pointer.moved += Math.abs(dx) + Math.abs(dy);
  if (S.view === 'globe') globe.rotate(dx, dy);
  else if (STREAM.on && STREAM.cam !== 'orbit') { STREAM.yawOff -= dx * 0.006; STREAM.pitchOff = clamp(STREAM.pitchOff + dy * 0.004, -0.6, 0.6); }
  else { orbit.az -= dx * 0.006; orbit.el = clamp(orbit.el + dy * 0.004, 0.12, 1.45); }
});
function endPointer(event) {
  if (!pointer.active.has(event.pointerId)) return;
  pointer.active.delete(event.pointerId);
  if (pointer.active.size) return;
  pointer.dragging = false;
  if (pointer.moved < 6 && S.view === 'globe' && renderer && event.type === 'pointerup') {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    const ndc = new THREE.Vector2(px / rect.width * 2 - 1, -(py / rect.height) * 2 + 1);
    const id = globe.pick(ndc) || globe.nearestOnScreen(px, py, rect.width, rect.height);
    if (id) selectSite(id);
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (event) => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
function zoom(factor) {
  if (S.view === 'globe') globe.zoom(factor);
  else if (STREAM.on && STREAM.cam !== 'orbit') STREAM.chaseDist = clamp(STREAM.chaseDist * factor, 0.45, 3);
  else orbit.dist = clamp(orbit.dist * factor, 25, 700);
}
$('scene-zoom-in').addEventListener('click', () => zoom(0.8));
$('scene-zoom-out').addEventListener('click', () => zoom(1.25));
$('scene-center').addEventListener('click', () => {
  if (S.view === 'globe') { const site = siteById(S.siteId); if (site) globe.focus(site); globe.state.dist = 3.4; }
  else { orbit.follow = true; orbit.dist = 170; orbit.el = 0.62; }
  announce(S.view === 'globe' ? 'Globo centrado en el sitio seleccionado.' : 'Cámara centrada en el rover.');
});
function setMotion(on) {
  S.motion = on;
  const button = $('scene-motion');
  button.setAttribute('aria-pressed', String(!on));
  button.textContent = on ? 'Ⅱ' : '▷';
  const label = on ? 'Pausar movimiento ambiental' : 'Reanudar movimiento ambiental';
  button.title = label; button.setAttribute('aria-label', label);
}
$('scene-motion').addEventListener('click', () => { setMotion(!S.motion); announce(S.motion ? 'Movimiento ambiental activado.' : 'Movimiento ambiental en pausa.'); });
reducedMotion.addEventListener?.('change', (event) => { if (event.matches) setMotion(false); });
setMotion(S.motion);

let viewportSize = { w: 0, h: 0 };
function resize() {
  const rect = viewport.getBoundingClientRect();
  viewportSize = { w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)) };
  if (renderer) renderer.setSize(viewportSize.w, viewportSize.h, false);
}
new ResizeObserver(resize).observe(viewport);
resize();

// ---------------------------------------------------------------- views
const VIEW_COPY = {
  globe: { heading: 'Vista orbital', scale: 'EARTH / ORBITAL VIEW', aria: 'Globo 3D interactivo. Arrastrá para girar; usá la lista para seleccionar un lugar.' },
  terrain: { heading: 'Terreno 3D', scale: '2.4 × 2.4 KM · RELIEVE ×2', aria: 'Terreno 3D del sitio con el rover simulado. Arrastrá para orbitar; en modo manual usá las flechas.' },
  split: { heading: 'Tierra | Objetivo', scale: 'MISMA CÁMARA · RELIEVE ×2', aria: 'Vista dividida: análogo terrestre y objetivo planetario con la misma cámara relativa.' },
};
function setView(view) {
  if (view === 'split' && !S.scenario) { if (S.scenarios[0]) selectScenario(S.scenarios[0]); return; }
  const previous = S.view;
  S.view = view;
  viewport.dataset.view = view;
  for (const [id, v] of [['view-globe', 'globe'], ['view-terrain', 'terrain'], ['view-split', 'split']]) $(id).setAttribute('aria-pressed', String(v === view));
  const copy = VIEW_COPY[view];
  $('viewport-heading').replaceChildren(el('span', 'status-dot'), document.createTextNode(` ${copy.heading}`));
  $('scene-scale').textContent = copy.scale;
  canvas.setAttribute('aria-label', copy.aria);
  $('globe-hint').hidden = view !== 'globe' || !renderer;
  $('terrain-hud').hidden = view === 'globe';
  $('mission-controls').hidden = view === 'globe';
  $('split-overlay').hidden = view !== 'split';
  $('ares-grid').hidden = view !== 'split';
  $('processes-panel').hidden = view !== 'split';
  document.querySelector('.control-room').dataset.mode = view === 'split' ? 'scenario' : 'site';
  $('sites-mode-note').hidden = view !== 'split';
  for (const b of $('scenario-list').querySelectorAll('.scenario-button')) b.setAttribute('aria-pressed', String(view === 'split' && b.dataset.scenario === S.scenario?.id));
  markSiteRows();
  renderSources();
  renderSimilarity();
  canvas.style.cursor = view === 'globe' ? 'grab' : 'move';
  renderAttribution();
  renderTargetSummary();
  if (view === 'globe') { const site = siteById(S.siteId); if (site) globe.focus(site); }
  if (view === 'terrain' && previous !== 'terrain') activateAtlasTerrain();
  if (view === 'split' && previous !== 'split') activateScenarioTerrain();
  if (!renderer) {
    $('scene-fallback').querySelector('p').textContent = view === 'globe'
      ? 'Tu navegador no habilitó WebGL. Podés seleccionar sitios y usar la navegación 2D del radar.'
      : 'Sin WebGL no se dibuja el terreno 3D. La simulación sigue en el radar, la telemetría y el perfil de elevación.';
  }
  updateMissionState();
}
$('view-globe').addEventListener('click', () => setView('globe'));
$('view-terrain').addEventListener('click', () => setView('terrain'));
$('view-split').addEventListener('click', () => setView('split'));

function resetRover() {
  S.rover = newRover();
  S.speedHistory = [];
  S.lastSlopeLevel = null;
  S.batteryWarned = false;
  orbit.follow = true;
}
async function activateAtlasTerrain() {
  const site = siteById(S.siteId);
  if (!site) return;
  const grid = S.grid || await loadSiteGrid(site.id);
  if (S.view !== 'terrain' || S.siteId !== site.id) return;
  resetRover();
  await buildTerrain(terrainA, grid, { imageryPath: grid?.imagery?.path, body: 'earth' });
  orbit.target.set(0, 0, 0);
  if (!grid) $('terrain-alert').textContent = 'DEM no disponible para este sitio. Probá «Consultar DEM» en Datos y recursos.';
  log('DATA', grid ? `DEM ${grid.dataset} cargado: ${grid.gridSize}×${grid.gridSize} a ${grid.spacingMeters} m (${site.name}).` : `Sin DEM para ${site.name}.`);
  drawElevation();
}
function activeGrid() { return S.view === 'split' ? S.sc?.earthGrid || null : S.grid; }

function renderAttribution() {
  const box = $('scene-attribution');
  const tag = el('span');
  const link = el('a');
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  if (S.view === 'globe') {
    tag.textContent = 'IMAGEN REAL / ARCHIVO';
    link.href = 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/';
    link.textContent = 'NASA Blue Marble · 2004 ↗';
  } else {
    const grid = activeGrid();
    tag.textContent = grid ? 'DEM REAL / IMAGEN ARCHIVADA' : 'DEM ' + PENDING.toUpperCase();
    link.href = grid?.imagery?.source || grid?.source || 'https://open-meteo.com/en/docs/elevation-api';
    link.textContent = grid ? `${grid.dataset || 'DEM'} · ${grid.imagery?.credit || 'sin imagen'} ↗` : 'Fuente pendiente ↗';
  }
  box.replaceChildren(tag, link);
  const target = S.view === 'split' ? S.sc?.targetGrid : null;
  if (target) {
    const second = el('a', '', `Objetivo: ${target.dataset || target.name} ↗`);
    second.href = target.imagery?.source || target.source || '#';
    second.target = '_blank'; second.rel = 'noopener noreferrer';
    box.append(second);
  }
}

// ---------------------------------------------------------------- mission controls
function updateMissionState() {
  const play = $('mission-play');
  play.textContent = !S.started ? 'Iniciar' : S.running ? 'Pausar' : 'Reanudar';
  let state = 'EN ESPERA';
  if (S.started) state = S.rover.battery <= 0 ? 'BATERÍA AGOTADA' : S.running ? `EN CURSO · ${S.mode === 'auto' ? 'AUTÓNOMO' : 'MANUAL'}` : 'EN PAUSA';
  $('mission-state').textContent = state;
}
function startMission() {
  S.started = true; S.running = true;
  updateMissionState();
  const where = S.view === 'split' ? S.sc?.earthName : siteById(S.siteId)?.name;
  log('SIM', `Misión iniciada en ${where || 'sitio'} · modo ${S.mode === 'auto' ? 'autónomo' : 'manual'}.`);
  announce(`Misión simulada iniciada en ${where || 'el sitio'}.`);
}
$('launch-mission').addEventListener('click', () => {
  if (S.view === 'globe') setView('terrain');
  resetRover();
  startMission();
});
$('mission-play').addEventListener('click', () => {
  if (!S.started) { startMission(); return; }
  S.running = !S.running;
  updateMissionState();
  log('SIM', S.running ? 'Recorrido reanudado.' : 'Recorrido en pausa.');
  announce(S.running ? 'Recorrido reanudado.' : 'Recorrido en pausa.');
});
$('mission-reset').addEventListener('click', () => {
  resetRover();
  updateMissionState();
  log('SIM', 'Rover reiniciado en el centro de la ventana.');
  announce('Rover reiniciado.');
});
function setPilot(mode) {
  S.mode = mode;
  $('pilot-auto').setAttribute('aria-pressed', String(mode === 'auto'));
  $('pilot-manual').setAttribute('aria-pressed', String(mode === 'manual'));
  $('drive-pad').hidden = mode !== 'manual';
  $('drive-help').hidden = mode !== 'manual';
  S.keys.clear(); S.pad.clear();
  updateMissionState();
  log('SIM', mode === 'auto' ? 'Modo autónomo: recorrido por puntos de paso.' : 'Modo manual: WASD, flechas o controles táctiles.');
  announce(mode === 'auto' ? 'Modo autónomo.' : 'Modo manual. Usá W A S D o las flechas con la vista 3D enfocada.');
}
$('pilot-auto').addEventListener('click', () => setPilot('auto'));
$('pilot-manual').addEventListener('click', () => setPilot('manual'));
for (const button of $('drive-pad').querySelectorAll('[data-drive]')) {
  const dir = button.dataset.drive;
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); S.pad.add(dir); if (!S.started) startMission(); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => S.pad.delete(dir));
  button.addEventListener('click', (event) => {
    if (event.detail !== 0) return; // keyboard activation: short pulse
    if (!S.started) startMission();
    S.pad.add(dir);
    setTimeout(() => S.pad.delete(dir), 450);
  });
}
const KEYMAP = { ArrowUp: 'forward', ArrowDown: 'backward', ArrowLeft: 'left', ArrowRight: 'right', w: 'forward', s: 'backward', a: 'left', d: 'right' };
const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
window.addEventListener('keydown', (event) => {
  if (event.key === '/' && !isTyping(event.target) && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    $('site-search').focus();
    return;
  }
  if (S.view === 'globe' || S.mode !== 'manual' || isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const dir = KEYMAP[key];
  if (!dir) return;
  if (key.startsWith('Arrow') && document.activeElement !== canvas) return;
  event.preventDefault();
  if (!S.started) startMission();
  S.keys.add(dir);
});
window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (KEYMAP[key]) S.keys.delete(KEYMAP[key]);
});
window.addEventListener('blur', () => { S.keys.clear(); S.pad.clear(); });

// ---------------------------------------------------------------- export and resources
$('export-mission').addEventListener('click', () => {
  const site = siteById(S.siteId);
  const grid = activeGrid();
  const payload = {
    app: 'Analog Atlas Mission Control · A.R.E.S. Twin',
    exportedAt: new Date().toISOString(),
    disclaimer: 'Simulación cinemática exploratoria. Trayecto, velocidad y batería simulados; DEM real archivado. No es navegación de campo.',
    view: S.view,
    profile: S.profile ? { id: S.profile.id, name: S.profile.name } : null,
    site: site ? { id: site.id, name: site.name, country: site.country, lat: site.lat, lon: site.lon } : null,
    scenario: S.view === 'split' && S.scenario ? { id: S.scenario.id, title: S.scenario.title, earthId: S.scenario.earthId, targetId: S.scenario.targetId, similarity: S.sc?.similarity || null } : null,
    dem: grid ? { dataset: grid.dataset, source: grid.source, fetchedAt: grid.fetchedAt, gridSize: grid.gridSize, spacingMeters: grid.spacingMeters, verticalExaggeration: EXAG } : null,
    rover: { x: S.rover.x, z: S.rover.z, headingDeg: S.rover.heading, distanceM: S.rover.distance, simSeconds: S.rover.elapsed, batteryPct: S.rover.battery, mode: S.mode },
    path: S.rover.path.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]),
    log: S.logEntries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = `atlas-mision-${(S.view === 'split' ? S.scenario?.id : site?.id) || 'sesion'}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  log('SIS', 'Registro de misión exportado como JSON.');
  announce('Misión exportada como archivo JSON.');
});

const dialog = $('resources-dialog');
for (const button of document.querySelectorAll('[data-open-resources]')) {
  button.addEventListener('click', () => {
    renderResourceStatus();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  });
}
$('close-resources').addEventListener('click', () => dialog.close?.() ?? dialog.removeAttribute('open'));
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
$('refresh-dem').addEventListener('click', async () => {
  const site = siteById(S.siteId);
  if (!site) return;
  const status = $('refresh-status');
  status.textContent = `Releyendo assets/data/${site.id}.json…`;
  const grid = await loadSiteGrid(site.id, { reload: true });
  if (grid) {
    status.textContent = `DEM de ${site.name} releído: ${grid.gridSize}×${grid.gridSize} nodos, consultado ${grid.fetchedAt?.slice(0, 10) || 'sin fecha'}. Archivo local, no consulta en vivo.`;
    if (S.view === 'terrain') activateAtlasTerrain(); else drawElevation();
  } else status.textContent = 'No se pudo releer el DEM local.';
  renderResourceStatus();
});
function renderResourceStatus() {
  const box = $('resource-status');
  const site = siteById(S.siteId);
  const grid = S.grid;
  const lines = [
    `SITIO: ${site ? site.name : '—'}`,
    grid ? `DEM: ${grid.dataset} · ${grid.gridSize}×${grid.gridSize} a ${grid.spacingMeters} m · consultado ${grid.fetchedAt?.slice(0, 10) || '—'}` : `DEM: ${S.gridError ? 'no disponible' : 'cargando…'}`,
    S.backend === undefined ? 'BACKEND: detectando…' : S.backend
      ? `BACKEND: activo v${S.backend.version || '?'} · clima ${S.backend.providers?.weather || '?'} · IA ${S.backend.providers?.ai || 'none'}`
      : 'BACKEND: no detectado · telemetría desde ARCHIVO, copiloto con reglas locales',
    `MÓDULOS: física ${S.physics ? 'OK' : 'pendiente'} · similitud ${S.similarity ? 'OK' : 'pendiente'} · reglas ${S.rules ? 'OK' : 'pendiente'}`,
  ];
  box.replaceChildren(...lines.map((line) => el('div', '', line)));
}

// ---------------------------------------------------------------- HUD drawing
function setupCanvas2d(target) {
  const rect = target.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
  if (target.width !== w * dpr || target.height !== h * dpr) { target.width = w * dpr; target.height = h * dpr; }
  const ctx = target.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
function drawRadar() {
  const { ctx, w, h } = setupCanvas2d($('nav-radar'));
  const grid = activeGrid();
  const extent = gridExtent(grid);
  const size = Math.min(w, h) - 30;
  if (!(size > 0)) return; // canvas not laid out yet (or collapsed)
  const ox = w / 2, oy = h / 2 + 2;
  const k = size / extent;
  ctx.fillStyle = '#071b4a';
  ctx.fillRect(ox - size / 2, oy - size / 2, size, size);
  const range = elevationRange(grid);
  if (grid && range) {
    const n = grid.gridSize, cell = size / (n - 1);
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const v = range.relief > 0 ? (grid.elevation[r * n + c] - range.min) / range.relief : 0.5;
      ctx.fillStyle = `rgba(46,150,245,${0.08 + v * 0.38})`;
      ctx.fillRect(ox - size / 2 + c * cell, oy - size / 2 + r * cell, cell + 0.5, cell + 0.5);
    }
  }
  ctx.strokeStyle = '#2b4371'; ctx.lineWidth = 1;
  ctx.strokeRect(ox - size / 2, oy - size / 2, size, size);
  for (const f of [0.25, 0.5]) { ctx.beginPath(); ctx.arc(ox, oy, size * f, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(ox - size / 2, oy); ctx.lineTo(ox + size / 2, oy); ctx.moveTo(ox, oy - size / 2); ctx.lineTo(ox, oy + size / 2); ctx.stroke();
  if (S.mode === 'auto') {
    ctx.fillStyle = '#2e96f5';
    for (const [x, z] of waypointsFor(extent)) { ctx.beginPath(); ctx.arc(ox + x * k, oy + z * k, 2.2, 0, Math.PI * 2); ctx.fill(); }
  }
  const path = S.rover.path;
  if (path.length > 1) {
    ctx.strokeStyle = 'rgba(234,254,7,.75)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    path.forEach(([x, z], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, ox + x * k, oy + z * k));
    ctx.lineTo(ox + S.rover.x * k, oy + S.rover.z * k);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(ox + S.rover.x * k, oy + S.rover.z * k);
  ctx.rotate(S.rover.heading * Math.PI / 180);
  ctx.fillStyle = '#eafe07';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  $('nav-radar').closest('.radar-wrap').querySelector('.radar-label').textContent = `${num(extent / 1000, 1)} × ${num(extent / 1000, 1)} KM`;
}
function drawElevation() {
  const target = $('elevation-chart');
  const { ctx, w, h } = setupCanvas2d(target);
  const grid = activeGrid();
  const profile = centerProfile(grid);
  const footer = target.closest('.elevation-panel').querySelector('.chart-footer span:last-child');
  footer.textContent = `TRANSECTO E–O / ${num(gridExtent(grid) / 1000, 1)} KM`;
  if (!profile.length) { $('elevation-range').textContent = S.view === 'split' ? `DEM ${PENDING}` : 'Cargando muestras…'; return; }
  let min = Infinity, max = -Infinity;
  for (const p of profile) { min = Math.min(min, p.elevation); max = Math.max(max, p.elevation); }
  const pad = Math.max(2, (max - min) * 0.15);
  const lo = min - pad, hi = max + pad;
  const left = 34, right = w - 6, top = 6, bottom = h - 14;
  const X = (x) => left + (x - profile[0].x) / (profile.at(-1).x - profile[0].x) * (right - left);
  const Y = (e) => bottom - (e - lo) / (hi - lo) * (bottom - top);
  ctx.font = '8px monospace'; ctx.fillStyle = '#8da8ce';
  ctx.fillText(`${Math.round(hi)} m`, 0, top + 6);
  ctx.fillText(`${Math.round(lo)} m`, 0, bottom);
  ctx.strokeStyle = '#2b4371'; ctx.lineWidth = 1;
  for (const f of [0, 0.5, 1]) { ctx.beginPath(); ctx.moveTo(left, top + f * (bottom - top)); ctx.lineTo(right, top + f * (bottom - top)); ctx.stroke(); }
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, 'rgba(46,150,245,.45)'); gradient.addColorStop(1, 'rgba(46,150,245,0)');
  ctx.beginPath();
  ctx.moveTo(X(profile[0].x), bottom);
  for (const p of profile) ctx.lineTo(X(p.x), Y(p.elevation));
  ctx.lineTo(X(profile.at(-1).x), bottom);
  ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath();
  profile.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x), Y(p.elevation)));
  ctx.strokeStyle = '#2e96f5'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = '#b4c8e6';
  for (const p of profile.length <= 17 ? profile : []) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.elevation), 1.8, 0, Math.PI * 2); ctx.fill(); }
  if (S.view !== 'globe') {
    const rx = clamp(S.rover.x, profile[0].x, profile.at(-1).x);
    ctx.strokeStyle = '#eafe07'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(rx), top); ctx.lineTo(X(rx), bottom); ctx.stroke();
    ctx.setLineDash([]);
  }
  $('elevation-range').textContent = `${Math.round(min)}–${Math.round(max)} m · Δ ${Math.round(max - min)} m · ${profile.length} muestras`;
}
function updateTelemetry() {
  const r = S.rover;
  const seconds = Math.floor(r.elapsed);
  $('mission-time').textContent = `T+ ${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const unit = (value, u) => { const frag = document.createDocumentFragment(); frag.append(`${value} `, el('small', '', u)); return frag; };
  $('telemetry-speed').replaceChildren(unit(num(r.speed, 2), 'm/s'));
  $('telemetry-battery').replaceChildren(unit(Math.round(r.battery), '%'));
  $('battery-fill').style.width = `${clamp(r.battery, 0, 100)}%`;
  $('telemetry-distance').replaceChildren(unit(r.distance >= 1000 ? num(r.distance / 1000, 2) : Math.round(r.distance), r.distance >= 1000 ? 'km' : 'm'));
  $('telemetry-heading').replaceChildren(unit(String(Math.round(r.heading) % 360).padStart(3, '0'), '°'));
  S.speedHistory.push(r.speed);
  if (S.speedHistory.length > 60) S.speedHistory.shift();
  const pts = S.speedHistory.map((v, i) => `${(i / 59 * 120).toFixed(1)} ${(22 - v / 1 * 20).toFixed(1)}`);
  $('speed-spark').setAttribute('d', pts.length > 1 ? `M${pts.join('L')}` : 'M0 22H120');
  const grid = S.view === 'globe' ? S.grid : activeGrid();
  const x = S.view === 'globe' ? 0 : r.x, z = S.view === 'globe' ? 0 : r.z;
  const elevation = sampleHeight(grid, x, z);
  const slope = sampleSlope(grid, x, z);
  $('telemetry-elevation').textContent = elevation === null ? '—' : `${num(elevation, 0)} m`;
  $('telemetry-slope').textContent = slope === null ? '—' : `${num(slope, 1)}°`;
  const alert = slopeAlert(slope);
  const alertBox = $('terrain-alert');
  alertBox.textContent = alert.text;
  alertBox.dataset.level = alert.level;
  if (S.running && alert.level !== S.lastSlopeLevel && (alert.level === 'warning' || alert.level === 'caution')) {
    log(alert.level === 'warning' ? 'ALERTA' : 'SIM', `${alert.text} (${num(slope, 1)}°)`);
    if (alert.level === 'warning') announce('Alerta de pendiente regional.');
  }
  if (S.running) S.lastSlopeLevel = alert.level;
  if (r.battery <= 0 && S.started && !S.batteryWarned) {
    S.batteryWarned = true;
    log('WARN', 'Batería simulada agotada: el rover se detuvo.');
    announce('Batería simulada agotada.');
  }
  const readings = document.querySelector('.terrain-readings p');
  if (grid) readings.replaceChildren(`Elevación real · ${grid.dataset || 'DEM'}`, el('br'), 'Trayecto, velocidad y batería simulados.');
  updateMissionState();
}

// ---------------------------------------------------------------- A.R.E.S. scenarios
async function loadScenarios() {
  const list = $('scenario-list');
  try {
    const data = await fetchJSON('assets/data/scenarios.json');
    S.scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];
  } catch {
    S.scenarios = [];
  }
  list.replaceChildren();
  if (!S.scenarios.length) {
    list.append(el('li', 'panel-pending', `Escenarios: ${PENDING}.`));
    $('view-split').disabled = true;
    return;
  }
  for (const scenario of S.scenarios) {
    const button = el('button', 'scenario-button');
    button.type = 'button';
    button.dataset.scenario = scenario.id;
    button.setAttribute('aria-pressed', 'false');
    button.append(el('span', 'scenario-body', BODY_LABEL[scenario.body] || scenario.body.toUpperCase()), el('strong', '', scenario.title),
      el('small', '', `${siteById(scenario.earthId)?.name || scenario.earthId} ↔ ${scenario.targetId}`));
    button.addEventListener('click', () => selectScenario(scenario));
    const item = el('li');
    item.append(button);
    list.append(item);
  }
}
async function loadGrid(path) {
  try {
    const grid = await fetchJSON(path);
    return validGrid(grid) ? grid : null;
  } catch { return null; }
}
async function selectScenario(scenario) {
  S.scenario = scenario;
  const token = Symbol(scenario.id);
  S.scToken = token;
  for (const b of $('scenario-list').querySelectorAll('.scenario-button')) b.setAttribute('aria-pressed', String(b.dataset.scenario === scenario.id));
  $('scenario-focus').textContent = scenario.focus;
  S.sc = { earthGrid: null, targetGrid: null, earthName: siteById(scenario.earthId)?.name || scenario.earthId, targetName: scenario.targetId, telemetry: null, telemetryOrigin: null, similarity: null, earthNote: '', targetNote: '' };
  log('SIS', `Escenario A.R.E.S.: ${scenario.title} (${scenario.earthId} ↔ ${scenario.targetId}).`);
  announce(`Escenario ${scenario.title}. Cargando terrenos.`);
  if (!S.physics || !S.similarity || !S.rules) await loadOptionalModules(true);
  if (S.view !== 'split') setView('split'); else activateScenarioTerrain();
  const [earthGrid, targetGrid] = await Promise.all([
    loadGrid(scenario.earth || `assets/data/scenarios/earth/${scenario.earthId}.json`),
    loadGrid(scenario.target || `assets/data/scenarios/targets/${scenario.targetId}.json`),
  ]);
  if (S.scToken !== token) return;
  let earth = earthGrid;
  if (!earth) {
    earth = await loadGrid(`assets/data/${scenario.earthId}.json`); // V1 9×9 grid as provisional fallback
    S.sc.earthNote = earth ? 'Rejilla 65×65 pendiente: se muestra el DEM V1 9×9 (GLO-90) como provisional.' : `Terreno terrestre: ${PENDING}.`;
  }
  S.sc.earthGrid = earth;
  S.sc.targetGrid = targetGrid;
  S.sc.targetNote = targetGrid ? '' : `Terreno del objetivo: ${PENDING}. La rejilla aún no se publicó.`;
  if (earth?.name) S.sc.earthName = earth.name;
  if (targetGrid?.name) S.sc.targetName = targetGrid.name;
  renderTargetSummary();
  log('DATA', earth ? `Tierra: ${S.sc.earthName} · ${earth.gridSize}×${earth.gridSize} a ${earth.spacingMeters} m.` : `Tierra: rejilla ${PENDING}.`);
  log('DATA', targetGrid ? `Objetivo: ${S.sc.targetName} · ${targetGrid.gridSize}×${targetGrid.gridSize} a ${targetGrid.spacingMeters} m (${targetGrid.dataset || 'dataset s/d'}).` : `Objetivo ${scenario.targetId}: rejilla ${PENDING}.`);
  computeSimilarity();
  if (S.view === 'split') activateScenarioTerrain();
  renderCompare();
  const site = siteById(scenario.earthId);
  const center = earth?.center || (site ? [site.lat, site.lon] : null);
  getTelemetry(scenario.earthId, center).then((result) => {
    if (S.scToken !== token) return;
    S.sc.telemetry = result.data;
    S.sc.telemetryOrigin = result.origin;
    renderCompare();
    log('DATA', result.data ? `Telemetría Tierra: ${telemetryLabel(result.data)} · ${result.data.provider}.` : `Telemetría Tierra: ${PENDING}.`);
  });
  loadProcesses(token, scenario, center, targetGrid);
}
async function activateScenarioTerrain() {
  const sc = S.sc, scenario = S.scenario;
  if (!sc || !scenario) return;
  resetRover();
  $('split-earth-kind').textContent = 'TIERRA / ANÁLOGO';
  $('split-earth-name').textContent = sc.earthName;
  const center = sc.earthGrid?.center;
  if (center) $('scene-coordinate').textContent = `${Math.abs(center[0]).toFixed(3)}°${center[0] >= 0 ? 'N' : 'S'} · ${Math.abs(center[1]).toFixed(3)}°${center[1] >= 0 ? 'E' : 'O'} / TIERRA`;
  $('split-target-kind').textContent = `${BODY_LABEL[scenario.body] || 'OBJETIVO'} / OBJETIVO`;
  $('split-target-name').textContent = sc.targetName;
  const earthNote = $('split-earth-note'), targetNote = $('split-target-note');
  earthNote.textContent = sc.earthGrid || sc.earthNote ? sc.earthNote : 'Cargando terreno…';
  earthNote.hidden = !earthNote.textContent;
  targetNote.textContent = sc.targetGrid ? '' : sc.targetNote || 'Cargando terreno…';
  targetNote.hidden = !targetNote.textContent;
  await Promise.all([
    buildTerrain(terrainA, sc.earthGrid, { imageryPath: sc.earthGrid?.imagery?.path, body: 'earth' }),
    buildTerrain(terrainB, sc.targetGrid, { imageryPath: sc.targetGrid?.imagery?.path, body: scenario.body }),
  ]);
  orbit.target.set(0, 0, 0);
  renderAttribution();
  drawElevation();
}
function setSplitPane(pane) {
  S.splitPane = pane;
  $('split-overlay').dataset.pane = pane;
  $('split-tab-earth').setAttribute('aria-pressed', String(pane === 'earth'));
  $('split-tab-target').setAttribute('aria-pressed', String(pane === 'target'));
  announce(pane === 'earth' ? 'Mostrando el análogo terrestre.' : 'Mostrando el objetivo.');
}
$('split-tab-earth').addEventListener('click', () => setSplitPane('earth'));
$('split-tab-target').addEventListener('click', () => setSplitPane('target'));

async function detectBackend() {
  if (S.backend !== undefined) return S.backend;
  if (!S.backendProbe) S.backendProbe = probeBackend();
  return S.backendProbe;
}
async function probeBackend() {
  try {
    const health = await fetchJSON('/api/health', { timeout: 2500, cache: 'no-store' });
    S.backend = health && health.status === 'ok' ? health : null;
  } catch { S.backend = null; }
  log('SIS', S.backend ? `Backend detectado v${S.backend.version || '?'} (IA: ${S.backend.providers?.ai || 'none'}).` : 'Sin backend: telemetría desde archivo y copiloto con reglas locales.');
  renderResourceStatus();
  return S.backend;
}
async function getTelemetry(siteId, center) {
  const backend = await detectBackend();
  if (backend && center) {
    try {
      const data = await fetchJSON(`/api/telemetry?lat=${center[0]}&lon=${center[1]}&site=${encodeURIComponent(siteId)}`, { timeout: 25000, cache: 'no-store' }); // Meteomatics ~6 s
      if (data && data.values) return { data, origin: 'api' };
    } catch { /* fall through to the archived snapshot */ }
  }
  if (S.snapshot === undefined) {
    try { S.snapshot = await fetchJSON('assets/data/telemetry-snapshot.json'); } catch { S.snapshot = null; }
  }
  const data = S.snapshot?.[siteId] || null;
  return { data: data ? { ...data, live: false } : null, origin: data ? 'snapshot' : null };
}
function telemetryLabel(t) {
  if (!t) return 'SIN DATO';
  if (t.live === true && t.provider !== 'snapshot') return t.cached ? 'EN VIVO · CACHÉ' : 'EN VIVO';
  return t.cached ? 'ARCHIVO · CACHÉ' : 'ARCHIVO';
}
function computeSimilarity() {
  const sc = S.sc;
  sc.similarity = null;
  if (!S.similarity || !sc.earthGrid || !sc.targetGrid) return;
  try { sc.similarity = S.similarity.compareTerrain(sc.earthGrid, sc.targetGrid); } catch (error) { sc.similarity = null; log('WARN', `Índice geométrico no disponible (${error.message}).`); }
}
// cell helpers: value+unit aligned in monospace, text cells, or an explicit «Sin dato» with a useful hint
const cv = (v, u, note = '', digits = 1) => finite(v) ? { v: num(v, digits), u, note } : null;
const ct = (text, note = '') => text ? { text, note } : null;
function renderCell(td, cell, hint) {
  td.replaceChildren();
  if (!cell) { td.append(el('span', 'cell-empty', hint || 'no publicado para esta capa')); return; }
  if (cell.text !== undefined) td.append(el('span', 'cell-text', cell.text));
  else {
    const line = el('span', 'cell-value');
    line.append(el('b', '', cell.v), el('i', '', cell.u || ''));
    td.append(line);
  }
  if (cell.note) td.append(el('span', 'cell-note', cell.note));
}
function setBadge(node, kind, text) {
  node.className = 'data-badge';
  node.dataset.kind = kind;
  node.textContent = text;
}
function telemetryKind(t) {
  if (!t) return 'none';
  return telemetryLabel(t).startsWith('EN VIVO') ? 'live' : 'archive';
}
const THERMAL_BADGE = { live: ['live', 'EN VIVO'], diviner: ['real', 'REAL · DIVINER'], literature: ['literature', 'LITERATURA'], model: ['model', 'MODELO'] };
function renderCompare() {
  const sc = S.sc, scenario = S.scenario;
  if (!sc) return;
  const t = sc.telemetry, v = t?.values || {};
  const earthEnv = sc.earthGrid?.environment || S.physics?.BODY_ENV?.earth || null;
  const target = sc.targetGrid;
  const targetEnv = target?.environment || S.physics?.BODY_ENV?.[scenario.body] || null;
  const thermal = target?.thermal || null;
  const label = telemetryLabel(t);
  setBadge($('compare-earth-badge'), telemetryKind(t), t ? `TIERRA ${label}` : 'TELEMETRÍA SIN DATO');
  $('compare-earth-kind').textContent = t ? label : 'SIN DATO';
  $('compare-target-kind').textContent = thermal ? (THERMAL_BADGE[thermal.kind]?.[1] || String(thermal.kind).toUpperCase()) : target ? 'REJILLA' : 'SIN DATO';
  const em = sc.earthGrid?.metrics || {}, tm = target?.metrics || {};
  const kelvin = (k) => finite(k) ? `${num(k, 0)} K` : '—';
  const noWeather = 'el objetivo no tiene estación meteorológica';
  const rows = [
    ['Temperatura', cv(v.temperatureC, '°C', finite(v.temperatureC) ? `${kelvin(v.temperatureC + 273.15)} · aire` : ''),
      thermal && finite(thermal.meanK) ? cv(thermal.meanK - 273.15, '°C', `media ${kelvin(thermal.meanK)} · mín ${kelvin(thermal.minK)} · máx ${kelvin(thermal.maxK)}`, 0) : null,
      t ? 'el proveedor no informó temperatura' : 'esperando telemetría', 'sin producto térmico publicado'],
    ['Radiación solar', cv(v.solarRadiationWm2, 'W/m²', 'en superficie', 0), cv(targetEnv?.solarConstantWm2, 'W/m²', 'tope de atmósfera (cota)', 0),
      t ? 'sin radiación (p. ej. noche polar)' : 'esperando telemetría', 'sin constante solar'],
    ['Viento', cv(v.windSpeedMs, 'm/s', finite(v.windGustMs) ? `ráfaga ${num(v.windGustMs, 1)} m/s` : ''), null, 'sin dato de viento', noWeather],
    ['Humedad relativa', cv(v.relativeHumidityPct, '%', '', 0), null, 'sin dato de humedad', noWeather],
    ['Nubosidad', cv(v.cloudCoverPct, '%', '', 0), null, 'sin dato de nubes', noWeather],
    ['Gravedad', cv(earthEnv?.gravityMs2, 'm/s²', '', 2), cv(targetEnv?.gravityMs2, 'm/s²', '', 2)],
    ['Duración del día', cv(earthEnv?.dayLengthHours, 'h'), cv(targetEnv?.dayLengthHours, 'h')],
    ['Atmósfera', ct(earthEnv?.atmosphere), ct(targetEnv?.atmosphere)],
    ['Pendiente p50', cv(em.slopeP50Deg, '°'), cv(tm.slopeP50Deg, '°'), 'métricas no calculadas', 'métricas no calculadas'],
    ['Pendiente p90', cv(em.slopeP90Deg, '°'), cv(tm.slopeP90Deg, '°'), 'métricas no calculadas', 'métricas no calculadas'],
    ['Desnivel p95–p5', cv(em.reliefP95P5M, 'm', '', 0), cv(tm.reliefP95P5M, 'm', '', 0), 'métricas no calculadas', 'métricas no calculadas'],
    ['TRI medio', cv(em.triMeanM, 'm'), cv(tm.triMeanM, 'm'), 'métricas no calculadas', 'métricas no calculadas'],
    ['Rugosidad radar', em.roughness ? cv(em.roughness.value, em.roughness.unit, em.roughness.polarization ? `Sentinel-1 ${em.roughness.polarization}` : '', 2) : null,
      tm.roughness ? cv(tm.roughness.value, tm.roughness.unit, 'Mini-RF', 2) : null, 'sin radar en esta rejilla', 'sin radar equivalente'],
  ];
  const body = $('compare-body');
  body.replaceChildren();
  for (const [name, earthCell, targetCell, earthHint, targetHint] of rows) {
    const row = el('tr');
    const head = el('th', '', name);
    head.scope = 'row';
    const a = el('td'), b = el('td');
    renderCell(a, earthCell, earthHint || (sc.earthGrid ? 'no publicado' : 'rejilla terrestre pendiente'));
    renderCell(b, targetCell, targetHint || (target ? 'no publicado' : 'rejilla del objetivo pendiente'));
    row.append(head, a, b);
    body.append(row);
  }
  const sources = [];
  sources.push(t?.source?.label ? `Tierra: ${t.source.label}${t.observedAt ? ` (${t.observedAt.slice(0, 16).replace('T', ' ')} UTC)` : ''}.` : 'Tierra: esperando telemetría (backend o archivo).');
  if (thermal?.source) sources.push(`Objetivo: ${thermal.source}.`);
  else sources.push(target ? `Objetivo: ${target.dataset || 'rejilla publicada'}; sin producto térmico.` : 'Objetivo: rejilla aún no publicada.');
  $('compare-sources').textContent = `${sources.join(' ')} Detalle completo en «08 · Fuentes de datos».`;
  renderSimilarity();
  renderSources();
}
function renderSimilarity() {
  const result = S.sc?.similarity;
  const bodyBox = $('similarity-body'), pending = $('similarity-pending');
  const chip = $('split-index');
  chip.hidden = !(S.view === 'split' && result && result.index !== null);
  if (!S.similarity) {
    bodyBox.hidden = true; pending.hidden = false;
    pending.textContent = 'El módulo de similitud (similarity.mjs) no está disponible; el índice queda oculto.';
    return;
  }
  if (!result) {
    bodyBox.hidden = true; pending.hidden = false;
    pending.textContent = S.sc && S.sc.earthGrid && !S.sc.targetGrid
      ? 'Sin índice: falta la rejilla del objetivo. Se calcula solo con métricas medidas de ambas rejillas.'
      : 'Cargando métricas de ambas rejillas para calcular el índice…';
    return;
  }
  bodyBox.hidden = false; pending.hidden = true;
  const index = result.index === null ? '—' : String(result.index);
  $('similarity-index').textContent = index;
  $('split-index-value').textContent = index;
  chip.setAttribute('aria-label', `Índice de similitud geométrica ${index} sobre 100. Ver detalle.`);
  const components = $('similarity-components');
  components.replaceChildren();
  for (const c of result.components || []) {
    const item = el('li');
    const unit = c.unit ? ` ${c.unit}` : '';
    const title = el('strong');
    title.append(el('span', 'component-name', c.label), el('span', '', `${c.score === null ? '—' : num(c.score, 0)}/100`));
    item.append(title, document.createTextNode(`Tierra ${num(c.earth, 1)}${unit} · objetivo ${num(c.target, 1)}${unit} · peso ${num((c.weight || 0) * 100, 0)} %`));
    const bar = el('span', 'component-bar');
    const fill = el('i');
    fill.style.width = `${clamp(c.score || 0, 0, 100)}%`;
    bar.append(fill);
    item.append(bar);
    components.append(item);
  }
  $('similarity-caveats').replaceChildren(...(result.caveats || []).map((text) => el('li', '', text)));
}
$('split-index').addEventListener('click', () => {
  const heading = $('similarity-heading');
  heading.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  heading.focus({ preventScroll: true });
});

// ---------------------------------------------------------------- provenance panel (08)
const shortDate = (iso) => typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : null;
const isUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value);
function noteAbout(grid, pattern) {
  return (grid?.notes || []).find((n) => pattern.test(n)) || null;
}
function sourceCell({ kind, badge, title, lines = [], meta = [], links = [], note = null }) {
  const box = el('div', 'source-cell');
  const tag = el('span');
  setBadge(tag, kind, badge);
  box.append(tag);
  if (title) box.append(el('strong', '', title));
  for (const line of lines.filter(Boolean)) box.append(el('span', '', line));
  const metaText = meta.filter(Boolean).join(' · ');
  if (metaText) box.append(el('span', 'source-meta', metaText));
  const linkBox = el('span', 'source-links');
  for (const [label, url] of links) {
    if (!isUrl(url)) continue;
    const a = el('a', '', `${label} ↗`);
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    linkBox.append(a);
  }
  if (linkBox.children.length) box.append(linkBox);
  if (note) box.append(el('span', 'cell-note', note));
  return box;
}
const missingCell = (reason) => ({ kind: 'none', badge: 'SIN DATO', title: 'Sin dato', note: reason || 'No hay una capa equivalente publicada para este lugar.' });
const licenseLink = (license) => isUrl(license) ? ['Licencia', license] : null;
const licenseText = (license) => license && !isUrl(license) ? `Licencia: ${license}` : null;

function demLayer(grid) {
  if (!grid) return missingCell('La rejilla de elevación todavía no está publicada.');
  return {
    kind: 'real', badge: 'REAL', title: grid.dataset || 'DEM',
    lines: [`Rejilla ${grid.gridSize}×${grid.gridSize} a ${num(grid.spacingMeters, 1)} m · resolución nativa ${num(grid.nativeResolutionMeters, grid.nativeResolutionMeters < 10 ? 2 : 0)} m${grid.provider ? ` · vía ${grid.provider}` : ''}`,
      grid.demCredit || null, licenseText(grid.license)],
    meta: [shortDate(grid.fetchedAt) && `consultado ${shortDate(grid.fetchedAt)}`, grid.metrics?.comparable === false ? 'no comparable a escala (interpolado)' : null],
    links: [['Producto', grid.source], licenseLink(grid.license)].filter(Boolean),
  };
}
function imageryLayer(grid) {
  const img = grid?.imagery;
  if (!img) return missingCell(grid ? noteAbout(grid, /imagen|imagery/i) || 'La rejilla no trae imagen de contexto.' : 'Rejilla pendiente.');
  const derived = img.kind === 'hillshade';
  const acquired = shortDate(img.acquired) || (img.year ? String(img.year) : null);
  return {
    kind: derived ? 'model' : 'real', badge: derived ? 'DERIVADO DEL DEM' : 'REAL',
    title: img.product || (img.layer ? `${img.layer} (mosaico anual)` : img.kind === 'orthoimage' ? 'Ortoimagen' : 'Imagen de contexto'),
    lines: [img.credit, licenseText(img.license)],
    meta: [acquired && (img.acquired ? `adquirida ${acquired}` : `mosaico ${acquired}`), finite(img.sceneCloudCoverPct) ? `nubes escena ${num(img.sceneCloudCoverPct, 1)} %` : null],
    links: [['Fuente', img.source], licenseLink(img.license)].filter(Boolean),
    note: derived ? noteAbout(grid, /sombread|hillshade/i) : null,
  };
}
function roughnessLayer(grid, v1 = false) {
  const r = grid?.metrics?.roughness;
  if (!r) return missingCell(v1 ? 'El DEM V1 (9×9, GLO-90) no incluye rugosidad radar; está en los escenarios A.R.E.S.' : noteAbout(grid, /rugosidad|roughness|mini-rf/i) || 'Sin radar equivalente para esta ventana.');
  return {
    kind: 'real', badge: 'REAL',
    title: r.credit || (r.unit === 'CPR' ? 'LRO Mini-RF CPR' : 'Radar'),
    lines: [`${num(r.value, 2)} ${r.unit || ''}${r.polarization ? ` · polarización ${r.polarization}` : ''}`, r.method ? r.method.split('. ')[0] + '.' : null, licenseText(r.license)],
    meta: [shortDate(r.acquired) && `adquirido ${shortDate(r.acquired)}`],
    links: [['Producto', r.source], licenseLink(r.license)].filter(Boolean),
  };
}
function thermalLayer(grid, side) {
  const th = grid?.thermal;
  if (!th) {
    if (side === 'earth') return { kind: 'none', badge: 'SIN DATO', title: 'Sin producto térmico de superficie', note: noteAbout(grid, /thermal|térmic/i) || 'En la Tierra la temperatura del aire llega por telemetría (fila siguiente).' };
    return missingCell(grid ? noteAbout(grid, /térmic|thermal/i) : 'Rejilla del objetivo pendiente.');
  }
  const [kind, badge] = THERMAL_BADGE[th.kind] || ['none', String(th.kind).toUpperCase()];
  const firstSentence = String(th.source || '').split(/(?<=\.)\s/)[0];
  const url = String(th.source || '').match(/https?:\/\/\S+/)?.[0]?.replace(/[.,;)]+$/, '');
  return {
    kind, badge, title: firstSentence || 'Producto térmico',
    lines: [`mín ${finite(th.minK) ? num(th.minK, 0) + ' K' : '—'} · media ${finite(th.meanK) ? num(th.meanK, 0) + ' K' : '—'} · máx ${finite(th.maxK) ? num(th.maxK, 0) + ' K' : '—'}`],
    links: url ? [['Producto', url]] : [],
    note: noteAbout(grid, /térmic|diviner|thermal|climate|MCD/i),
  };
}
function telemetryLayer(t, siteName) {
  if (!t) return missingCell(`Sin telemetría para ${siteName || 'este sitio'}: no hay backend ni instantánea archivada.`);
  const label = telemetryLabel(t);
  const kind = telemetryKind(t);
  return {
    kind, badge: label, title: t.source?.label || t.provider,
    lines: [`Proveedor: ${t.provider}${t.cached ? ' · caché' : ''}${finite(t.ageSeconds) && t.ageSeconds > 0 ? ` · antigüedad ${Math.round(t.ageSeconds / 60)} min` : ''}`],
    meta: [t.observedAt && `observado ${t.observedAt.slice(0, 16).replace('T', ' ')} UTC`],
    links: [['Fuente', t.source?.url]],
    note: kind === 'live' ? 'Valores «current» del proveedor meteorológico (modelo de pronóstico), no una estación en el sitio.' : 'Instantánea guardada: no representa condiciones actuales.',
  };
}
const TARGET_LAYER = { kind: 'none', badge: 'SIN ESCENARIO', title: 'Sin objetivo', note: 'Elegí un escenario A.R.E.S. para ver la procedencia del objetivo lunar o marciano.' };
function renderSources() {
  const scenarioMode = S.view === 'split' && S.scenario && S.sc;
  const body = $('sources-body');
  let earthName, targetName, earthGrid, targetGrid, telemetry, extraEarth = null, extraTarget = null, v1 = false;
  if (scenarioMode) {
    ({ earthGrid, targetGrid, telemetry } = S.sc);
    earthName = S.sc.earthName; targetName = S.sc.targetName;
    v1 = earthGrid && earthGrid.gridSize < 65;
    const prov = (grid) => grid?.provenance?.length
      ? { kind: 'literature', badge: 'PROCEDENCIA', title: `${grid.provenance.length} referencias`, links: grid.provenance.map((p) => [p.label, p.url]) }
      : missingCell('Sin lista de procedencia en el JSON.');
    extraEarth = prov(earthGrid); extraTarget = targetGrid ? prov(targetGrid) : missingCell('Rejilla pendiente.');
  } else {
    const site = siteById(S.siteId);
    earthName = site?.name || '—'; targetName = null;
    earthGrid = S.grid; telemetry = S.siteTelemetry?.[S.siteId] ?? null; v1 = true;
    extraEarth = site ? { kind: 'literature', badge: 'LITERATURA', title: 'Fuentes documentales del catálogo (data.js)', lines: [site.locationNote || 'Coordenadas orientativas, no un polígono medido.'], links: site.sources.map((s) => [s.label, s.url]) } : missingCell();
  }
  $('sources-mode').textContent = scenarioMode ? `ESCENARIO · ${S.scenario.title.toUpperCase()}` : 'MODO SITIO · DEM V1';
  $('sources-earth-head').textContent = `Tierra · ${earthName}`;
  $('sources-target-head').textContent = targetName ? `Objetivo · ${targetName}` : 'Objetivo';
  const rows = [
    ['Elevación (DEM)', demLayer(earthGrid), scenarioMode ? demLayer(targetGrid) : TARGET_LAYER],
    ['Imagen', imageryLayer(earthGrid), scenarioMode ? imageryLayer(targetGrid) : TARGET_LAYER],
    ['Rugosidad radar', roughnessLayer(earthGrid, v1), scenarioMode ? roughnessLayer(targetGrid) : TARGET_LAYER],
    ['Térmica / clima', thermalLayer(earthGrid, 'earth'), scenarioMode ? thermalLayer(targetGrid, 'target') : TARGET_LAYER],
    ['Telemetría en vivo', telemetryLayer(telemetry, earthName), scenarioMode ? missingCell('No hay telemetría en vivo de la superficie lunar o marciana en esta demo.') : TARGET_LAYER],
    [scenarioMode ? 'Procedencia' : 'Referencias del sitio', extraEarth, scenarioMode ? extraTarget : TARGET_LAYER],
  ];
  body.replaceChildren();
  rows.forEach(([name, earth, target], index) => {
    const row = el('tr');
    const head = el('th', '', name);
    head.scope = 'row';
    const a = el('td');
    a.dataset.col = 'TIERRA';
    a.append(sourceCell(earth));
    row.append(head, a);
    if (scenarioMode || index === 0) {
      const b = el('td');
      b.dataset.col = 'OBJETIVO';
      if (!scenarioMode) b.rowSpan = rows.length;
      b.append(sourceCell(target));
      row.append(b);
    }
    body.append(row);
  });
}
function updatePhysics(simDt) {
  const sc = S.sc;
  if (S.view !== 'split' || !sc) return;
  const P = S.physics;
  const readings = $('physics-readings'), pending = $('physics-pending');
  if (!P || S.physicsBroken) {
    readings.hidden = true; pending.hidden = false;
    pending.textContent = S.physicsBroken ? 'El módulo de física falló: indicadores ocultos.' : 'Módulo de física no disponible: indicadores ocultos.';
    sc.rover = null;
    return;
  }
  try {
    const r = S.rover;
    const earthAtt = P.attitude(sc.earthGrid, r.x, r.z, r.heading);
    const targetAtt = P.attitude(sc.targetGrid, r.x, r.z, r.heading);
    const irradiance = sc.telemetry?.values?.solarRadiationWm2;
    const solarW = finite(irradiance) ? P.solarPowerW({ irradianceWm2: irradiance }) : null;
    const slope = sampleSlope(sc.earthGrid, r.x, r.z);
    const gravity = sc.earthGrid?.environment?.gravityMs2 || 9.81;
    const loadW = P.driveLoadW({ speedMs: r.speed, slopeDeg: finite(earthAtt.pitchDeg) ? earthAtt.pitchDeg : 0, gravityMs2: gravity });
    const tempC = sc.telemetry?.values?.temperatureC;
    const earthThermal = P.thermalStatus({ ambientK: finite(tempC) ? tempC + 273.15 : undefined });
    const thermal = sc.targetGrid?.thermal;
    const targetThermal = P.thermalStatus({ ambientK: finite(thermal?.meanK) ? thermal.meanK : undefined });
    const targetEnv = sc.targetGrid?.environment || P.BODY_ENV?.[S.scenario.body];
    const targetSolar = finite(targetEnv?.solarConstantWm2) ? P.solarPowerW({ irradianceWm2: targetEnv.solarConstantWm2 }) : null;
    sc.rover = { pitchDeg: earthAtt.pitchDeg, rollDeg: earthAtt.rollDeg, batteryPct: r.battery, solarW, slopeDeg: slope, thermal: earthThermal, loadW };
    const deg = (v) => finite(v) ? `${v >= 0 ? '+' : ''}${num(v, 1)}°` : '—';
    $('phys-pitch').textContent = deg(earthAtt.pitchDeg);
    $('phys-roll').textContent = deg(earthAtt.rollDeg);
    $('phys-target-pitch').textContent = sc.targetGrid ? deg(targetAtt.pitchDeg) : 'Sin dato';
    $('phys-target-roll').textContent = sc.targetGrid ? deg(targetAtt.rollDeg) : 'Sin dato';
    $('phys-solar').textContent = solarW === null ? 'Sin dato' : `${num(solarW, 0)} W`;
    $('phys-solar-note').textContent = `${solarW === null ? 'Sin irradiancia terrestre.' : `Tierra, ${telemetryLabel(sc.telemetry).toLowerCase()}.`}${targetSolar !== null ? ` Objetivo: ≤ ${num(targetSolar, 0)} W (cota TOA).` : ''}`;
    $('phys-battery').textContent = `${num(r.battery, 1)} %`;
    $('phys-load').textContent = `Consumo ${num(loadW, 0)} W · neto ${solarW === null ? '—' : `${num(solarW - loadW, 0)} W`}`;
    for (const [key, status] of [['earth', earthThermal], ['target', targetThermal]]) {
      const strong = $(`phys-thermal-${key}`);
      strong.textContent = { unknown: 'SIN DATO', nominal: 'NOMINAL', caution: 'PRECAUCIÓN', critical: 'CRÍTICO' }[status.level] || String(status.level).toUpperCase();
      strong.dataset.level = status.level;
      $(`phys-thermal-${key}-text`).textContent = status.text || '';
    }
    readings.hidden = false; pending.hidden = true;
  } catch (error) {
    S.physicsBroken = true;
    log('WARN', `Módulo de física con error (${error.message}); indicadores ocultos.`);
  }
}
function physicsBattery(before, simDt) {
  // In the scenario the battery integrates solar charge and drive load instead of the V1 fixed drain.
  const P = S.physics, sc = S.sc;
  if (S.view !== 'split' || !P || S.physicsBroken || !sc || simDt <= 0) return;
  try {
    const irradiance = sc.telemetry?.values?.solarRadiationWm2;
    const solarW = finite(irradiance) ? P.solarPowerW({ irradianceWm2: irradiance }) : 0;
    const att = P.attitude(sc.earthGrid, S.rover.x, S.rover.z, S.rover.heading);
    const loadW = P.driveLoadW({ speedMs: S.rover.speed, slopeDeg: finite(att.pitchDeg) ? att.pitchDeg : 0, gravityMs2: sc.earthGrid?.environment?.gravityMs2 || 9.81 });
    const next = P.batteryStep({ batteryPct: before, solarW, loadW, dtSeconds: simDt });
    if (finite(next)) S.rover.battery = next;
  } catch { S.physicsBroken = true; }
}

// ---------------------------------------------------------------- Flight Director AI
const SUGGESTIONS = [
  '¿Qué riesgo térmico tiene el rover en este escenario?',
  '¿Alcanza la batería para seguir con esta pendiente?',
  '¿Qué tan comparable es el terreno de la Tierra con el objetivo?',
  '¿Qué datos son en vivo y cuáles de archivo?',
  '¿Cuál es la mejor ventana de pruebas en las próximas 72 h?',
];
function buildCopilotContext() {
  const scenario = S.scenario, sc = S.sc || {};
  return {
    scenario: scenario ? { id: scenario.id, title: scenario.title, focus: scenario.focus } : null,
    earth: { id: scenario?.earthId || null, name: sc.earthName || null, metrics: sc.earthGrid?.metrics || null, telemetry: sc.telemetry || null, thermal: sc.earthGrid?.thermal || null },
    target: { id: scenario?.targetId || null, name: sc.targetName || null, body: scenario?.body || null, metrics: sc.targetGrid?.metrics || null, thermal: sc.targetGrid?.thermal || null, environment: sc.targetGrid?.environment || S.physics?.BODY_ENV?.[scenario?.body] || null },
    rover: sc.rover ? { pitchDeg: sc.rover.pitchDeg, rollDeg: sc.rover.rollDeg, batteryPct: sc.rover.batteryPct, solarW: sc.rover.solarW, slopeDeg: sc.rover.slopeDeg, thermal: sc.rover.thermal }
      : { pitchDeg: null, rollDeg: null, batteryPct: S.rover.battery, solarW: null, slopeDeg: sampleSlope(sc.earthGrid, S.rover.x, S.rover.z), thermal: null },
    similarity: sc.similarity || null,
    processes: sc.processes && S.processes ? S.processes.summarizeProcesses(sc.processes) : null,
  };
}
async function askCopilot(question) {
  const context = buildCopilotContext();
  const backend = await detectBackend();
  if (backend && backend.providers?.ai !== 'none') {
    try {
      const answer = await fetchJSON('/api/copilot', { method: 'POST', body: { question, context }, timeout: 30000, cache: 'no-store' });
      if (answer && typeof answer.answer === 'string') return answer;
    } catch { /* 503 no-ai-provider or network: local rules below */ }
  }
  if (!S.rules) await loadOptionalModules(true);
  if (S.rules) return await S.rules.answerLocally(question, context);
  return { answer: 'El copiloto no está disponible: no hay backend de IA ni módulo de reglas locales todavía.', provider: 'none', grounded: [], disclaimer: '' };
}
function renderCopilotEmpty() {
  const list = $('copilot-log');
  if (list.children.length) return;
  list.append(el('li', 'empty', 'Todavía no hay consultas. Elegí una pregunta sugerida o escribí la tuya: el Flight Director responde con los datos del escenario activo (terreno, telemetría, rover e índice).'));
}
function renderSuggestions() {
  renderCopilotEmpty();
  const box = $('copilot-suggestions');
  box.replaceChildren(...SUGGESTIONS.map((text) => {
    const button = el('button', '', text);
    button.type = 'button';
    button.addEventListener('click', () => submitQuestion(text));
    return button;
  }));
}
async function submitQuestion(raw) {
  const question = String(raw || '').trim().slice(0, 500);
  if (!question || S.copilotBusy) return;
  S.copilotBusy = true;
  const list = $('copilot-log');
  list.querySelector('li.empty')?.remove();
  const user = el('li', 'user', question);
  const pending = el('li', 'assistant pending', 'Flight Director analizando el contexto…');
  list.append(user, pending);
  list.scrollTop = list.scrollHeight;
  $('copilot-form').querySelector('button').disabled = true;
  try {
    const answer = await askCopilot(question);
    const provider = PROVIDER_LABEL[answer.provider] || String(answer.provider || 'desconocido').toUpperCase();
    pending.className = 'assistant';
    pending.replaceChildren(
      el('span', 'copilot-meta', `${provider}${answer.model ? ` · ${answer.model}` : ''} · ${new Date(answer.generatedAt || Date.now()).toISOString().slice(11, 16)} UTC`),
      document.createTextNode(String(answer.answer || '')));
    const foot = [answer.disclaimer, Array.isArray(answer.grounded) && answer.grounded.length ? `Datos usados: ${answer.grounded.join(', ')}` : ''].filter(Boolean).join(' · ');
    if (foot) pending.append(el('span', 'copilot-foot', foot));
    setBadge($('copilot-provider'), answer.provider === 'rules' ? 'model' : answer.provider === 'none' ? 'none' : 'live', provider);
    log('IA', `Flight Director (${provider}) respondió: «${question.slice(0, 60)}${question.length > 60 ? '…' : ''}»`);
  } catch (error) {
    pending.className = 'assistant';
    pending.textContent = `No se pudo obtener respuesta (${error.message}).`;
  } finally {
    S.copilotBusy = false;
    $('copilot-form').querySelector('button').disabled = false;
    list.scrollTop = list.scrollHeight;
  }
}
$('copilot-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('copilot-input');
  submitQuestion(input.value);
  input.value = '';
});

// The target block is shifted vertically so its surface under the rover matches the Earth surface:
// with one shared camera both rovers then sit at the same place on screen (relative camera).
function alignTarget() {
  if (!terrainA.grid || !terrainB.grid) { terrainB.scene.position.y = 0; return; }
  const x = S.rover.x, z = S.rover.z;
  const goal = displayHeight(terrainA, x, z) - displayHeight(terrainB, x, z);
  const current = terrainB.scene.position.y;
  terrainB.scene.position.y = Math.abs(goal - current) > 40 || reducedMotion.matches ? goal : current + (goal - current) * 0.1;
}

// ---------------------------------------------------------------- main loop
let lastFrame = performance.now(), hudTimer = 0, physicsTimer = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (S.view !== 'globe' && activeGrid()) {
    const throttle = (S.keys.has('forward') || S.pad.has('forward') ? 1 : 0) - (S.keys.has('backward') || S.pad.has('backward') ? 1 : 0);
    const turn = (S.keys.has('right') || S.pad.has('right') ? 1 : 0) - (S.keys.has('left') || S.pad.has('left') ? 1 : 0);
    const before = S.rover.battery, elapsed = S.rover.elapsed;
    advanceRover(S.rover, dt, { running: S.running, mode: S.mode, throttle, turn, grid: activeGrid() });
    physicsBattery(before, S.rover.elapsed - elapsed);
    if (S.running && S.rover.battery <= 0) S.running = false;
  }
  if (renderer) {
    const { w, h } = viewportSize;
    if (S.view === 'globe') {
      globe.update(dt);
      globe.camera.aspect = w / h;
      globe.camera.updateProjectionMatrix();
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.render(globe.scene, globe.camera);
    } else {
      updateTerrainCamera(dt);
      placeRover(terrainA, S.rover);
      if (S.view === 'terrain' || (S.view === 'split' && mobileQuery.matches)) {
        const T = S.view === 'split' && S.splitPane === 'target' ? terrainB : terrainA;
        if (T === terrainB) { alignTarget(); placeRover(terrainB, S.rover); }
        tcam.aspect = w / h;
        tcam.updateProjectionMatrix();
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        renderer.render(T.scene, tcam);
      } else {
        alignTarget();
        placeRover(terrainB, S.rover);
        const half = Math.floor(w / 2);
        tcam.aspect = half / h;
        tcam.updateProjectionMatrix();
        renderer.setScissorTest(true);
        renderer.clear();
        for (const [T, x, width] of [[terrainA, 0, half], [terrainB, half, w - half]]) {
          renderer.setViewport(x, 0, width, h);
          renderer.setScissor(x, 0, width, h);
          renderer.render(T.scene, tcam);
        }
        renderer.setScissorTest(false);
      }
    }
  }
  hudTimer += dt; physicsTimer += dt;
  if (hudTimer > 0.12) {
    hudTimer = 0;
    updateTelemetry();
    drawRadar();
    if (STREAM.on) updateStreamHud();
    if (S.view !== 'globe' && S.running) drawElevation();
  }
  if (physicsTimer > 0.25) { physicsTimer = 0; updatePhysics(); }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- Módulo 3 · procesos activos (panel 09)
const PROC_COLORS = { earth: '#2e96f5', target: '#d9762e' }; // validated categorical pair on the dark surface
const SALT_LABEL = { sustained: 'SOSTENIDA', intermittent: 'INTERMITENTE', suppressed: 'INHIBIDA (HUMEDAD)', none: 'NO ACTIVA', unknown: 'SIN DATO' };
const WINDOW_LABEL = { thermal: 'TÉRMICA', aeolian: 'EÓLICA', freeze: 'CONGELAMIENTO', cold: 'FRÍA' };
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, text = '') {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== '') node.textContent = text;
  return node;
}
function localParts(iso, offset) {
  const d = new Date(Date.parse(iso) + (offset || 0) * 1000);
  return { day: DAYS[d.getUTCDay()], date: d.getUTCDate(), hour: d.getUTCHours() };
}
function fmtLocal(iso, offset, withDay = true) {
  if (!iso) return '—';
  const p = localParts(iso, offset);
  return `${withDay ? `${p.day} ${String(p.date).padStart(2, '0')} ` : ''}${String(p.hour).padStart(2, '0')}:00`;
}
async function getForecast(siteId, center) {
  const backend = await detectBackend();
  if (backend && center) {
    try {
      const data = await fetchJSON(`/api/processes/forecast?lat=${center[0]}&lon=${center[1]}&site=${encodeURIComponent(siteId)}`, { timeout: 30000, cache: 'no-store' }); // Meteomatics ~6 s + huso
      if (data && Array.isArray(data.hours)) return data;
    } catch { /* archived forecast below */ }
  }
  if (S.forecastSnapshot === undefined) {
    try { S.forecastSnapshot = await fetchJSON('assets/data/processes-forecast-snapshot.json'); } catch { S.forecastSnapshot = null; }
  }
  const data = S.forecastSnapshot?.[siteId];
  return data ? { ...data, live: false, provider: 'snapshot' } : null;
}
async function loadProcesses(token, scenario, center, targetGrid) {
  const sc = S.sc;
  sc.processes = null; sc.processHistory = undefined;
  renderProcesses();
  if (!S.processes) await loadOptionalModules(true);
  const [forecast, history] = await Promise.all([
    getForecast(scenario.earthId, center),
    fetchJSON(`assets/data/processes/${scenario.earthId}.json`).catch(() => null),
  ]);
  if (S.scToken !== token) return;
  sc.processHistory = history;
  if (forecast && S.processes) {
    try { sc.processes = S.processes.analyzeProcesses(forecast, targetGrid); }
    catch (error) { sc.processes = null; log('WARN', `Módulo 3 no disponible (${error.message}).`); }
  }
  const a = sc.processes;
  log('DATA', a ? `Procesos 72 h: ${a.source.live ? 'pronóstico en vivo' : 'pronóstico archivado'} · ${a.windows.thermal.length} ventanas térmicas, ${a.windows.aeolian.length} eólicas, ${a.windows.freeze.length} cruces de 0 °C.`
    : `Procesos 72 h: ${PENDING}.`);
  renderProcesses();
  if (a) labFromForecast(); else updateLab();
}
const PROCESS_FOCUS = {
  'lava-tube': 'la HUMEDAD. La brisa marina de Lanzarote suele inhibir la saltación y suaviza el ciclo térmico; Marius Hills no tiene atmósfera ni viento. Es el escenario que muestra dónde se rompe la analogía de procesos.',
  'polar-shadow': 'el FRÍO. En noviembre Wright Valley está en día polar: el suelo no cruza 0 °C y no hay ventana térmica (Shackleton no tiene curva diurna). Se propone la ventana fría para pruebas en frío, muy lejos de los 40–100 K lunares.',
  'hyperarid-salt': 'la VENTANA TÉRMICA y la SALTACIÓN. El ciclo diario de Atacama replica la forma del de Jezero (bandas amarillas) y por la tarde las ráfagas superan el umbral: el mismo proceso que mueve el polvo en Marte.',
  'wind-canyon': 'el VIENTO. El gráfico de la derecha compara viento y ráfagas con el umbral de saltación: las bandas son las horas en que el cañón movería arena, el proceso que esculpe Valles Marineris.',
};
function renderProcesses() {
  const a = S.sc?.processes, off = a?.utcOffsetSeconds || 0;
  const focus = $('proc-focus');
  focus.replaceChildren(el('strong', '', 'Qué mirar aquí: '), document.createTextNode(PROCESS_FOCUS[S.scenario?.id] || 'elegí un escenario.'));
  const mm = S.backend?.providers?.weather === 'meteomatics';
  $('proc-api').textContent = !a ? 'Fuente: cargando…'
    : `API: ${a.source.provider === 'snapshot' ? 'sin servidor → pronóstico archivado' : `${a.source.provider} ${a.source.live ? 'en vivo' : '(caché vieja)'}`} · Meteomatics: ${mm ? 'activo' : 'sin credenciales (se activa con METEOMATICS_USERNAME/PASSWORD en .env)'}`;
  const badge = $('proc-badge');
  badge.dataset.kind = !a ? 'none' : a.source.live ? 'live' : 'archive';
  badge.textContent = !a ? 'SIN DATO' : a.source.live ? (a.source.cached ? 'PRONÓSTICO · EN VIVO · CACHÉ' : 'PRONÓSTICO · EN VIVO') : 'PRONÓSTICO ARCHIVADO';
  // tiles
  const best = a?.best;
  $('proc-best').textContent = best ? `${WINDOW_LABEL[best.kind]} · ${fmtLocal(best.start, off)}` : a ? 'Sin ventana' : '—';
  $('proc-best-note').textContent = !a ? (S.sc ? 'Cargando pronóstico…' : 'Elegí un escenario.')
    : best ? `hasta ${fmtLocal(best.end, off, false)} (${best.hours} h)${finite(best.score) ? ` · coincidencia ${best.score}/100` : ''}${best.phase ? ` · ${best.phase}` : ''}${best.maxGustMs ? ` · ráfagas ${num(best.maxGustMs, 1)} m/s` : ''}`
      : 'Ninguna hora cumple los umbrales en 72 h.';
  const salt = a?.current?.saltation;
  const saltEl = $('proc-salt');
  saltEl.textContent = salt ? SALT_LABEL[salt.level] : '—';
  saltEl.dataset.level = salt?.level || '';
  $('proc-salt-note').textContent = salt && salt.level !== 'unknown'
    ? `u* ráfaga ${num(salt.uStarGust ?? salt.uStar, 2)} vs umbral ${num(a.thresholds.uStar, 2)} m/s (≈${num(a.thresholds.windMs, 1)} m/s a 10 m)` : '';
  const freezes = a?.windows.freeze || [];
  const freezeEl = $('proc-freeze');
  freezeEl.textContent = !a ? '—' : freezes.length ? `${freezes.length} CRUCE${freezes.length > 1 ? 'S' : ''} DE 0 °C` : 'SIN CRUCES';
  freezeEl.dataset.level = freezes.some((w) => w.rapid) ? 'rapid' : freezes.length ? 'sustained' : 'none';
  $('proc-freeze-note').textContent = !a ? '' : freezes.length
    ? `primero ${fmtLocal(freezes[0].end, off)}${freezes[0].rapid ? ` · rápido (${num(freezes[0].rateCph, 1)} °C/h)` : ''} · ciclos hielo-deshielo: ${a.freezeThawCycles}`
    : a.earthRangeC ? `suelo entre ${num(a.earthRangeC[0], 1)} y ${num(a.earthRangeC[1], 1)} °C` : '';
  const hist = S.sc?.processHistory;
  const series = Array.isArray(hist?.series) ? hist.series : [];
  const lastFlag = [...series].reverse().find((x) => x.changeFlag);
  $('proc-radar').textContent = !S.sc ? '—' : hist === undefined ? '…' : !series.length ? 'SIN SERIE' : finite(hist.lastPairChangedFraction) ? `${num(hist.lastPairChangedFraction * 100, 1)} % PÍXELES` : `${series.length} ESCENAS`;
  $('proc-radar-note').textContent = !series.length ? (hist?.notes?.[0] || (hist === null ? 'Serie histórica no publicada para este sitio.' : '')) : `cambio > 3 dB entre las 2 últimas escenas${lastFlag ? ` · último cambio marcado ${lastFlag.date}` : ''}`;
  drawThermalChart(a);
  drawWindChart(a);
  drawHistory(hist);
  renderWindowList(a);
  renderProcessTable(a);
  const caveats = $('proc-caveats');
  caveats.replaceChildren(...(a?.caveats || []).map((c) => el('li', '', c)));
  if (hist?.interpretation) caveats.append(el('li', '', `Radar: ${hist.interpretation}`));
  if (hist?.method) caveats.append(el('li', '', `Método radar: ${hist.method}`));
  $('proc-source').textContent = !a ? 'Pronóstico: pendiente.' : `${a.source.label || a.source.provider} · obtenido ${a.source.fetchedAt ? `${fmtLocal(a.source.fetchedAt, off)} (hora local)` : 's/d'} · huso ${a.timezone || 's/d'}${a.source.live ? '' : ' · ARCHIVO: las horas pueden haber pasado'}${a.targetCurve.available ? ` · Objetivo: ${a.targetCurve.source || a.targetCurve.kind}` : ''}${hist?.credit ? ` · ${hist.credit}` : ''}`;
}
function chartFrame(box, height) {
  const width = Math.max(260, Math.round(box.clientWidth || 600));
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height });
  box.replaceChildren(svg);
  return { svg, width, height, l: 34, r: 12, t: 10, b: 22 };
}
function emptyChart(box, message) {
  const f = chartFrame(box, 150);
  f.svg.append(svgEl('text', { x: f.width / 2, y: 75, 'text-anchor': 'middle', class: 'empty' }, message));
}
function timeAxis(f, hours, off, x) {
  hours.forEach((h, i) => {
    const p = localParts(h.time, off);
    if (p.hour === 0 || p.hour === 12) {
      f.svg.append(svgEl('line', { x1: x(i), x2: x(i), y1: f.t, y2: f.height - f.b, class: 'grid', opacity: p.hour === 0 ? 1 : 0.4 }));
      f.svg.append(svgEl('text', { x: x(i) + 3, y: f.height - 6 }, p.hour === 0 ? `${p.day} ${p.date}` : '12 h'));
    }
  });
}
function bands(f, windows, x, step) {
  for (const w of windows) f.svg.append(svgEl('rect', { x: x(w.startIndex) - step / 2, y: f.t, width: Math.max(2, x(w.endIndex) - x(w.startIndex) + step), height: f.height - f.t - f.b, class: 'band' }));
}
function pathFrom(values, x, y) {
  let d = '', pen = false;
  values.forEach((v, i) => { if (!finite(v)) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
  return d;
}
function hoverLayer(f, n, x, step, describe) {
  const cross = svgEl('line', { y1: f.t, y2: f.height - f.b, class: 'cross', visibility: 'hidden' });
  const hit = svgEl('rect', { x: f.l, y: f.t, width: f.width - f.l - f.r, height: f.height - f.t - f.b, class: 'hit' });
  f.svg.append(cross, hit);
  const tip = $('proc-tooltip'), host = tip.parentElement;
  const move = (event) => {
    const rect = f.svg.getBoundingClientRect();
    const px = (event.clientX - rect.left) * (f.width / rect.width);
    const i = clamp(Math.round((px - f.l) / step), 0, n - 1);
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    tip.replaceChildren(...describe(i));
    tip.hidden = false;
    const hostRect = host.getBoundingClientRect();
    const left = clamp(event.clientX - hostRect.left + 14, 0, hostRect.width - tip.offsetWidth);
    tip.style.left = `${left}px`;
    tip.style.top = `${event.clientY - hostRect.top + 14}px`;
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
}
const tipLine = (label, value, color) => { const row = el('div'); if (color) { const dot = el('i'); dot.style.setProperty('--c', color); row.append(dot); } row.append(document.createTextNode(`${label}: `), el('b', '', value)); return row; };
function drawThermalChart(a) {
  const box = $('proc-thermal');
  if (!a || !a.hours.length) { emptyChart(box, a ? 'Pronóstico sin horas.' : 'Pronóstico pendiente.'); return; }
  const hours = a.hours, n = hours.length, off = a.utcOffsetSeconds;
  const temps = hours.map((h) => (finite(h.groundTempC) ? h.groundTempC : h.tempC));
  // Earth display normalisation: same rolling 24 h window as processes.mjs, also when there is no target curve
  const earthNorm = hours.map((h, i) => {
    if (h.thermal) return h.thermal.earthNorm;
    const w = temps.slice(Math.max(0, i - 12), i + 13).filter(finite);
    const lo = Math.min(...w), hi = Math.max(...w);
    return finite(temps[i]) && hi - lo >= 2 ? (temps[i] - lo) / (hi - lo) : null;
  });
  const targetNorm = hours.map((h) => h.thermal?.targetNorm ?? null);
  const f = chartFrame(box, 170);
  const step = (f.width - f.l - f.r) / Math.max(1, n - 1);
  const x = (i) => f.l + i * step, y = (v) => f.t + (1 - v) * (f.height - f.t - f.b);
  for (const v of [0, 0.5, 1]) { f.svg.append(svgEl('line', { x1: f.l, x2: f.width - f.r, y1: y(v), y2: y(v), class: 'grid', opacity: 0.5 })); f.svg.append(svgEl('text', { x: f.l - 6, y: y(v) + 3, 'text-anchor': 'end' }, num(v, v === 0.5 ? 1 : 0))); }
  timeAxis(f, hours, off, x);
  bands(f, a.windows.thermal, x, step);
  if (a.current) f.svg.append(svgEl('line', { x1: x(a.current.index), x2: x(a.current.index), y1: f.t, y2: f.height - f.b, class: 'now' }));
  f.svg.append(svgEl('path', { d: pathFrom(targetNorm, x, y), fill: 'none', stroke: PROC_COLORS.target, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  f.svg.append(svgEl('path', { d: pathFrom(earthNorm, x, y), fill: 'none', stroke: PROC_COLORS.earth, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  for (const w of a.windows.freeze) f.svg.append(svgEl('text', { x: x(w.endIndex), y: f.t + 10, 'text-anchor': 'middle', fill: '#d8ffe9' }, '❄'));
  if (!a.targetCurve.available) f.svg.append(svgEl('text', { x: f.width - f.r, y: f.t + 12, 'text-anchor': 'end' }, 'Objetivo sin curva diurna: solo Tierra'));
  const { curveMinK: kMin, curveMaxK: kMax } = a.targetCurve;
  hoverLayer(f, n, x, step, (i) => {
    const h = hours[i], th = h.thermal;
    const rows = [el('div', '', `${fmtLocal(h.time, off)} · hora solar ${num(h.solarHour, 1)}`),
      tipLine('Suelo Tierra', finite(h.groundTempC) ? `${num(h.groundTempC, 1)} °C` : '—', PROC_COLORS.earth),
      tipLine('Aire Tierra', finite(h.tempC) ? `${num(h.tempC, 1)} °C` : '—')];
    if (th && finite(kMin) && finite(kMax)) rows.push(tipLine('Objetivo en fase', `${num(kMin + th.targetNorm * (kMax - kMin), 0)} K`, PROC_COLORS.target), tipLine('Coincidencia', `${th.score}/100`));
    return rows;
  });
}
function drawWindChart(a) {
  const box = $('proc-wind');
  if (!a || !a.hours.length) { emptyChart(box, a ? 'Pronóstico sin horas.' : 'Pronóstico pendiente.'); return; }
  const hours = a.hours, n = hours.length, off = a.utcOffsetSeconds;
  const wind = hours.map((h) => h.windMs), gust = hours.map((h) => h.gustMs);
  const top = Math.max(a.thresholds.windMs * 1.3, ...wind.filter(finite), ...gust.filter(finite));
  const f = chartFrame(box, 170);
  const step = (f.width - f.l - f.r) / Math.max(1, n - 1);
  const x = (i) => f.l + i * step, y = (v) => f.t + (1 - v / top) * (f.height - f.t - f.b);
  const tickStep = top > 20 ? 10 : 5;
  for (let v = 0; v <= top; v += tickStep) { f.svg.append(svgEl('line', { x1: f.l, x2: f.width - f.r, y1: y(v), y2: y(v), class: 'grid', opacity: 0.5 })); f.svg.append(svgEl('text', { x: f.l - 6, y: y(v) + 3, 'text-anchor': 'end' }, String(v))); }
  timeAxis(f, hours, off, x);
  bands(f, a.windows.aeolian, x, step);
  if (a.current) f.svg.append(svgEl('line', { x1: x(a.current.index), x2: x(a.current.index), y1: f.t, y2: f.height - f.b, class: 'now' }));
  f.svg.append(svgEl('line', { x1: f.l, x2: f.width - f.r, y1: y(a.thresholds.windMs), y2: y(a.thresholds.windMs), class: 'threshold' }));
  f.svg.append(svgEl('text', { x: f.l + 4, y: y(a.thresholds.windMs) - 4 }, `umbral ${num(a.thresholds.windMs, 1)} m/s`));
  f.svg.append(svgEl('path', { d: pathFrom(gust, x, y), fill: 'none', stroke: '#b4c8e6', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
  f.svg.append(svgEl('path', { d: pathFrom(wind, x, y), fill: 'none', stroke: PROC_COLORS.earth, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  hoverLayer(f, n, x, step, (i) => {
    const h = hours[i], st = h.saltation;
    return [el('div', '', fmtLocal(h.time, off)),
      tipLine('Viento', finite(h.windMs) ? `${num(h.windMs, 1)} m/s` : '—', PROC_COLORS.earth),
      tipLine('Ráfaga', finite(h.gustMs) ? `${num(h.gustMs, 1)} m/s` : '—'),
      tipLine('u* ráfaga / umbral', `${num(st.uStarGust ?? st.uStar, 2)} / ${num(st.threshold, 2)} m/s`),
      tipLine('Humedad', finite(h.rhPct) ? `${num(h.rhPct, 0)} %` : '—'),
      tipLine('Saltación', SALT_LABEL[st.level])];
  });
}
function drawHistory(hist) {
  const box = $('proc-history');
  const series = Array.isArray(hist?.series) ? hist.series.filter((p) => finite(p.meanDb)) : [];
  $('proc-history-note').textContent = !hist ? (hist === undefined ? 'Cargando serie…' : 'Serie histórica no publicada para este sitio.')
    : series.length ? `${series.length} escenas ${series[0].date} → ${series.at(-1).date} · ${hist.polarization || ''} · ${series.filter((p) => p.changeFlag).length} cambios marcados (punto amarillo). Método en «supuestos».` : (hist.notes?.[0] || 'Sin escenas.');
  if (series.length < 2) { box.replaceChildren(); return; }
  const f = chartFrame(box, 100);
  f.b = 18;
  const vals = series.map((p) => p.meanDb), lo = Math.min(...vals) - 0.5, hi = Math.max(...vals) + 0.5;
  const step = (f.width - f.l - f.r) / (series.length - 1);
  const x = (i) => f.l + i * step, y = (v) => f.t + (1 - (v - lo) / (hi - lo)) * (f.height - f.t - f.b);
  f.svg.append(svgEl('text', { x: f.l - 6, y: y(hi - 0.5) + 3, 'text-anchor': 'end' }, `${num(hi - 0.5, 1)}`));
  f.svg.append(svgEl('text', { x: f.l - 6, y: y(lo + 0.5) + 3, 'text-anchor': 'end' }, `${num(lo + 0.5, 1)}`));
  f.svg.append(svgEl('text', { x: f.l, y: f.height - 4 }, series[0].date));
  f.svg.append(svgEl('text', { x: f.width - f.r, y: f.height - 4, 'text-anchor': 'end' }, series.at(-1).date));
  f.svg.append(svgEl('path', { d: pathFrom(vals, x, y), fill: 'none', stroke: PROC_COLORS.earth, 'stroke-width': 2 }));
  series.forEach((p, i) => {
    const dot = svgEl('circle', { cx: x(i), cy: y(p.meanDb), r: p.changeFlag ? 5 : 3, fill: p.changeFlag ? '#eafe07' : PROC_COLORS.earth, stroke: '#0b1d4a', 'stroke-width': 2 });
    dot.append(svgEl('title', {}, `${p.date}: ${num(p.meanDb, 2)} dB${finite(p.deltaDb) ? ` (Δ ${num(p.deltaDb, 2)} dB)` : ''}${p.changeFlag ? ' · cambio marcado' : ''}${finite(p.precipMm) ? ` · lluvia ${num(p.precipMm, 1)} mm` : ''}`));
    f.svg.append(dot);
  });
}
function renderWindowList(a) {
  const list = $('proc-windows');
  if (!a) { list.replaceChildren(el('li', 'empty', S.sc ? 'Cargando…' : 'Elegí un escenario.')); return; }
  const off = a.utcOffsetSeconds;
  const others = [...a.windows.thermal.slice(0, 3), ...a.windows.aeolian.slice(0, 2), ...a.windows.freeze.slice(0, 2), ...(a.body === 'moon' && !a.targetCurve.available ? (a.windows.cold || []).slice(0, 2) : [])]
    .filter((w) => w !== a.best).sort((p, q) => p.startIndex - q.startIndex);
  const items = (a.best ? [a.best, ...others] : others).slice(0, 6);
  if (!items.length) { list.replaceChildren(el('li', 'empty', 'Sin ventanas que cumplan los umbrales en 72 h.')); return; }
  list.replaceChildren(...items.map((w) => {
    const li = el('li', w === a.best ? 'best' : '');
    const why = w.kind === 'thermal' ? `Forma térmica en fase de ${w.phase}; compara la curva normalizada, no la temperatura absoluta.`
      : w.kind === 'aeolian' ? `Saltación ${w.sustainedHours ? `sostenida ${w.sustainedHours} h` : 'por ráfagas'}${w.maxGustMs ? ` · ráfagas hasta ${num(w.maxGustMs, 1)} m/s` : ''}: el proceso que alimenta las tormentas de polvo marcianas.`
        : w.kind === 'cold' ? `Mínimo térmico con la menor radiación del período (suelo hasta ${num(w.minC, 1)} °C): pruebas en frío; no reproduce la sombra permanente lunar.`
        : `Cruce de 0 °C en superficie${w.rapid ? ` con enfriamiento rápido (${num(w.rateCph, 1)} °C/h)` : ''}${w.night ? ', nocturno' : ''}.`;
    li.append(el('span', 'kind', `${w === a.best ? '★ ' : ''}${WINDOW_LABEL[w.kind]}`),
      el('span', 'when', `${fmtLocal(w.start, off)} → ${fmtLocal(w.end, off, false)} · ${w.hours} h`),
      el('span', 'score', finite(w.score) ? `${w.score}/100` : ''), el('span', 'why', why));
    return li;
  }));
}
function renderProcessTable(a) {
  const body = $('proc-table');
  if (!a) { body.replaceChildren(); return; }
  const inWindow = new Set();
  for (const w of [...a.windows.thermal, ...a.windows.aeolian]) for (let i = w.startIndex; i <= w.endIndex; i++) inWindow.add(i);
  body.replaceChildren(...a.hours.map((h, i) => {
    const tr = el('tr', inWindow.has(i) ? 'inwin' : '');
    for (const text of [fmtLocal(h.time, a.utcOffsetSeconds), num(h.groundTempC, 1), num(h.tempC, 1), `${num(h.windMs, 1)} / ${num(h.gustMs, 1)}`, num(h.rhPct, 0), SALT_LABEL[h.saltation.level], h.thermal ? `${h.thermal.score}/100` : '—']) tr.append(el('td', '', text));
    return tr;
  }));
}
// Laboratorio: the same processes.mjs functions, driven by sliders, so the rules can be tested by hand
const LAB_IDS = ['wind', 'gust', 'rh', 'rain', 'temp', 'rate'];
const LAB_PRESETS = {
  dust: { wind: 12, gust: 20, rh: 15, rain: 0, temp: 30, rate: 1 },
  calm: { wind: 1, gust: 2, rh: 30, rain: 0, temp: 20, rate: -0.5 },
  rain: { wind: 9, gust: 15, rh: 92, rain: 4, temp: 12, rate: -0.5 },
  frost: { wind: 2, gust: 4, rh: 50, rain: 0, temp: 1.5, rate: -2.5 },
};
const MARS_USTAR = 1.0;
function labValues() { return Object.fromEntries(LAB_IDS.map((k) => [k, Number($(`lab-${k}`).value)])); }
function setLab(values) {
  for (const k of LAB_IDS) if (finite(values[k])) $(`lab-${k}`).value = String(values[k]);
  updateLab();
}
function labFromForecast() {
  const a = S.sc?.processes;
  if (!a?.current) { announce('Elegí un escenario con pronóstico para cargar la hora actual.'); return; }
  const i = a.current.index, h = a.hours[i];
  const t = (x) => (finite(x?.groundTempC) ? x.groundTempC : x?.tempC);
  const back = a.hours[Math.max(0, i - 3)];
  const rain = a.hours.slice(Math.max(0, i - 24), i).reduce((s2, x) => s2 + (finite(x.precipMm) ? x.precipMm : 0), 0);
  setLab({ wind: h.windMs, gust: h.gustMs, rh: h.rhPct, rain, temp: t(h), rate: finite(t(back)) && i > 0 ? (t(h) - t(back)) / Math.min(i, 3) : 0 });
}
function updateLab() {
  const v = labValues(), P = S.processes;
  $('lab-wind-v').textContent = `${num(v.wind, 1)} m/s`;
  $('lab-gust-v').textContent = `${num(v.gust, 1)} m/s`;
  $('lab-rh-v').textContent = `${num(v.rh, 0)} %`;
  $('lab-rain-v').textContent = `${num(v.rain, 1)} mm`;
  $('lab-temp-v').textContent = `${num(v.temp, 1)} °C`;
  $('lab-rate-v').textContent = `${v.rate > 0 ? '+' : ''}${num(v.rate, 1)} °C/h`;
  if (!P) { $('lab-salt').textContent = 'Módulo no cargado'; return; }
  const st = P.saltationState({ windMs: v.wind, gustMs: v.gust, rhPct: v.rh, precipMm: 0 }, { recentPrecipMm: v.rain });
  const scale = 1.2; // meter range in m/s of u*
  const uGust = st.uStarGust ?? 0;
  $('lab-ustar-fill').style.width = `${clamp(uGust / scale, 0, 1) * 100}%`;
  $('lab-ustar-mark').style.left = `${(st.threshold / scale) * 100}%`;
  $('lab-ustar-text').textContent = `ráfaga ${num(uGust, 2)} m/s · medio ${num(st.uStar, 2)} m/s · umbral Tierra ${num(st.threshold, 2)} m/s (marca amarilla)`;
  const salt = $('lab-salt');
  salt.textContent = SALT_LABEL[st.level];
  salt.dataset.on = String(st.level === 'sustained' || st.level === 'intermittent');
  $('lab-salt-why').textContent = {
    sustained: 'El viento medio supera el umbral: la arena salta de forma continua.',
    intermittent: 'Solo las ráfagas superan el umbral: saltación a golpes.',
    suppressed: v.rain >= 1 ? 'Superaría el umbral, pero la lluvia reciente cohesiona la arena.' : 'Superaría el umbral, pero la humedad (≥ 65 %) cohesiona la arena.',
    none: 'Ni el viento medio ni las ráfagas alcanzan el umbral.',
    unknown: 'Sin datos de viento.',
  }[st.level];
  // freeze: linear series from 3 h ago to the next hour at the chosen cooling rate
  const series = [-3, -2, -1, 0, 1].map((k, i) => ({ time: new Date(Date.UTC(2026, 0, 1, i)).toISOString(), groundTempC: v.temp + v.rate * k, radiationWm2: 0 }));
  const { events } = P.freezeEvents(series);
  const freeze = events.find((e) => e.kind === 'freeze');
  const fz = $('lab-freeze');
  if (freeze && freeze.index === 4) { fz.textContent = freeze.rapid ? 'CONGELA RÁPIDO EN 1 H' : 'CONGELA EN 1 H'; fz.dataset.on = 'true'; }
  else if (freeze) { fz.textContent = freeze.rapid ? 'CONGELÓ RÁPIDO' : 'CONGELÓ'; fz.dataset.on = 'true'; }
  else { fz.textContent = v.temp <= 0 ? 'YA BAJO 0 °C' : 'NO CONGELA'; fz.dataset.on = 'false'; }
  $('lab-freeze-why').textContent = freeze
    ? `Cruza 0 °C ${freeze.rapid ? `enfriando ${num(freeze.rateCph, 1)} °C/h (≤ −1,5 °C/h: congelamiento rápido)` : `a ${num(freeze.rateCph, 1)} °C/h (lento)`}.`
    : v.temp <= 0 ? (v.rate > 0 ? 'Está calentando: en la próxima hora podría deshelar.' : 'Sigue bajo cero, sin cruce en la ventana.') : `En 1 h llegaría a ${num(v.temp + v.rate, 1)} °C.`;
  const uMars = P.frictionVelocity(v.gust);
  const windMars = MARS_USTAR * Math.log(10 / 5e-4) / 0.4;
  const mars = $('lab-mars');
  mars.textContent = uMars !== null && uMars >= MARS_USTAR ? 'LEVANTARÍA ARENA' : 'NO ALCANZA';
  mars.dataset.on = String(uMars !== null && uMars >= MARS_USTAR);
  $('lab-mars-why').textContent = `En Marte el aire es ~100 veces menos denso: el umbral sube a u* ≈ ${num(MARS_USTAR, 1)}–1,5 m/s (≈${num(windMars, 0)} m/s a 10 m). Misma física, otra escala.`;
}
for (const k of LAB_IDS) $(`lab-${k}`).addEventListener('input', updateLab);
for (const b of document.querySelectorAll('.proc-presets [data-preset]')) b.addEventListener('click', () => (b.dataset.preset === 'now' ? labFromForecast() : setLab(LAB_PRESETS[b.dataset.preset])));
let procWidth = 0;
new ResizeObserver(() => {
  const w = $('proc-thermal').clientWidth;
  if (Math.abs(w - procWidth) > 4 && S.sc?.processes) { procWidth = w; drawThermalChart(S.sc.processes); drawWindChart(S.sc.processes); drawHistory(S.sc.processHistory); }
}).observe($('processes-panel'));

// ---------------------------------------------------------------- rover stream mode (fullscreen)
// A «live feed» look for demos. It is labelled TRANSMISIÓN SIMULADA: no real rover or satellite link exists.
const STREAM = { on: false, cam: 'chase', chaseDist: 1, yawOff: 0, pitchOff: 0, snap: true };
const STREAM_CAMS = { chase: 'CAM 01 · PERSECUCIÓN', mast: 'CAM 02 · MÁSTIL (NAV)', orbit: 'CAM 03 · ORBITAL' };
const STREAM_SKY = { earth: 0x9fb4c9, mars: 0xc79a72, moon: 0x000000 };
const camGoal = new THREE.Vector3(), lookGoal = new THREE.Vector3(), camLook = new THREE.Vector3();
function applyAtmosphere(T) {
  const body = T.body || 'earth';
  if (STREAM.on) {
    T.scene.background = new THREE.Color(STREAM_SKY[body] ?? 0x000000);
    T.scene.fog = body === 'moon' ? null : new THREE.Fog(STREAM_SKY[body], 70, body === 'mars' ? 230 : 300);
  } else {
    T.scene.background = BODY_BG[body] !== null && BODY_BG[body] !== undefined ? new THREE.Color(BODY_BG[body]) : null;
    T.scene.fog = null;
  }
}
function streamCamera(dt) {
  const T = terrainA, r = S.rover;
  const h = r.heading * Math.PI / 180 + STREAM.yawOff;
  const fx = Math.sin(h), fz = -Math.cos(h); // forward in metres (x east, z south)
  const ground = (x, z) => displayHeight(T, x, z);
  if (STREAM.cam === 'mast') {
    // eye just above the (×14) mast, looking a few hundred metres ahead
    const ex = r.x + fx * 6, ez = r.z + fz * 6;
    camGoal.set(ex * U, ground(r.x, r.z) + 34 * U, ez * U);
    const lx = r.x + fx * 260, lz = r.z + fz * 260;
    lookGoal.set(lx * U, ground(lx, lz) + (6 - STREAM.pitchOff * 260) * U, lz * U);
    tcam.fov = 68;
  } else {
    const d = 95 * STREAM.chaseDist, up = 38 * STREAM.chaseDist;
    const cx = r.x - fx * d, cz = r.z - fz * d;
    const clearance = Math.max(ground(cx, cz), ground(r.x, r.z)) + (up + STREAM.pitchOff * 60) * U;
    camGoal.set(cx * U, Math.max(clearance, ground(cx, cz) + 8 * U), cz * U);
    const lx = r.x + fx * 40, lz = r.z + fz * 40;
    lookGoal.set(lx * U, ground(lx, lz) + 12 * U, lz * U);
    tcam.fov = 55;
  }
  const k = STREAM.snap || reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 4);
  tcam.position.lerp(camGoal, k);
  camLook.lerp(lookGoal, k);
  if (STREAM.snap) { tcam.position.copy(camGoal); camLook.copy(lookGoal); STREAM.snap = false; }
  tcam.lookAt(camLook);
}
function buildTape() {
  const strip = $('sh-tape-strip');
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
  for (let deg = 0; deg < 1080; deg += 15) {
    const d = deg % 360;
    strip.append(el('span', names[d] ? 'card' : '', names[d] || String(d)));
  }
}
function setStreamCam(cam) {
  STREAM.cam = cam; STREAM.yawOff = 0; STREAM.pitchOff = 0; STREAM.snap = true;
  for (const b of document.querySelectorAll('#stream-hud [data-cam]')) b.setAttribute('aria-pressed', String(b.dataset.cam === cam));
  $('sh-cam-name').textContent = STREAM_CAMS[cam];
  if (cam === 'orbit') { orbit.follow = true; orbit.dist = 120; orbit.el = 0.5; }
  if (STREAM.on) announce(`Cámara: ${STREAM_CAMS[cam]}.`);
}
function setStream(on) {
  STREAM.on = on;
  viewport.classList.toggle('is-stream', on);
  document.documentElement.classList.toggle('stream-lock', on && viewport.classList.contains('is-pseudo-fs'));
  $('stream-hud').hidden = !on;
  if (on) {
    if (S.view === 'globe') setView(S.scenario && S.sc ? 'split' : 'terrain');
    setStreamCam('chase');
    if (!S.started) startMission();
    canvas.focus({ preventScroll: true });
    log('SIM', 'Modo transmisión: pantalla completa con cámara del rover (simulada).');
  }
  for (const T of [terrainA, terrainB]) applyAtmosphere(T);
  resize();
  updateStreamHud();
  announce(on ? 'Pantalla completa: transmisión simulada del rover. C cambia la cámara, Escape sale.' : 'Saliste de la transmisión.');
}
async function enterStream() {
  if (viewport.requestFullscreen) {
    try { await viewport.requestFullscreen({ navigationUI: 'hide' }); return; } catch { /* fall back to CSS fullscreen */ }
  }
  viewport.classList.add('is-pseudo-fs');
  setStream(true);
}
function exitStream() {
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  viewport.classList.remove('is-pseudo-fs');
  setStream(false);
}
document.addEventListener('fullscreenchange', () => {
  const on = document.fullscreenElement === viewport;
  if (!on) viewport.classList.remove('is-pseudo-fs');
  if (on !== STREAM.on) setStream(on);
});
$('scene-fullscreen').addEventListener('click', () => (STREAM.on ? exitStream() : enterStream()));
$('sh-exit').addEventListener('click', exitStream);
for (const b of document.querySelectorAll('#stream-hud [data-cam]')) b.addEventListener('click', () => setStreamCam(b.dataset.cam));
$('sh-play').addEventListener('click', () => $('mission-play').click());
$('sh-pilot').addEventListener('click', () => { setPilot(S.mode === 'auto' ? 'manual' : 'auto'); canvas.focus({ preventScroll: true }); updateStreamHud(); });
window.addEventListener('keydown', (event) => {
  if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'f' && S.view !== 'globe') { event.preventDefault(); STREAM.on ? exitStream() : enterStream(); }
  else if (key === 'escape' && STREAM.on && !document.fullscreenElement) exitStream();
  else if (key === 'c' && STREAM.on) { const order = ['chase', 'mast', 'orbit']; setStreamCam(order[(order.indexOf(STREAM.cam) + 1) % order.length]); }
});
const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
const DELAY = { moon: 'LUZ TIERRA→LUNA ≈ 1,3 s', mars: 'LUZ TIERRA→MARTE 3–22 min' };
function updateStreamHud() {
  if (!STREAM.on) return;
  const r = S.rover, grid = activeGrid();
  const t = r.elapsed;
  $('sh-met').textContent = `T+ ${pad2(t / 3600)}:${pad2((t % 3600) / 60)}:${pad2(t % 60)}`;
  $('sh-utc').textContent = `${new Date().toISOString().slice(11, 19)} UTC · SIM ×20`;
  const heading = ((r.heading % 360) + 360) % 360;
  $('sh-heading').textContent = `${String(Math.round(heading) % 360).padStart(3, '0')}°`;
  $('sh-tape-strip').style.transform = `translateX(${-(heading + 360) * 4 - 30}px)`;
  const split = S.view === 'split' && S.sc;
  const body = split ? S.scenario?.body : null;
  $('sh-site').textContent = split ? `${S.sc.earthName || 'Tierra'} ↔ ${S.sc.targetName || 'objetivo'}` : (siteById(S.siteId)?.name || '—');
  $('sh-delay').textContent = body ? `${DELAY[body] || ''} · referencia` : 'ANÁLOGO TERRESTRE · ENLACE LOCAL';
  $('sh-split').hidden = !(split && !mobileQuery.matches);
  if (split) { $('sh-split-a').textContent = `TIERRA · ${S.sc.earthName || ''}`; $('sh-split-b').textContent = `${BODY_LABEL[body] || 'OBJETIVO'} · ${S.sc.targetName || ''}`; }
  $('sh-speed').textContent = `${num(r.speed, 2)} m/s`;
  $('sh-distance').textContent = r.distance >= 1000 ? `${num(r.distance / 1000, 2)} km` : `${num(r.distance, 0)} m`;
  $('sh-battery').textContent = `${num(r.battery, 0)} %`;
  const fill = $('sh-battery-fill');
  fill.style.width = `${clamp(r.battery, 0, 100)}%`;
  fill.classList.toggle('low', r.battery < 20);
  const slope = grid ? sampleSlope(grid, r.x, r.z) : null;
  $('sh-slope').textContent = finite(slope) ? `${num(slope, 1)}°` : '—';
  const center = grid?.center;
  if (Array.isArray(center)) {
    const pos = localCoordinates({ lat: center[0], lon: center[1] }, r.x, r.z);
    $('sh-lat').textContent = `${num(Math.abs(pos.lat), 5)}° ${pos.lat >= 0 ? 'N' : 'S'}`;
    $('sh-lon').textContent = `${num(Math.abs(pos.lon), 5)}° ${pos.lon >= 0 ? 'E' : 'O'}`;
  } else { $('sh-lat').textContent = '—'; $('sh-lon').textContent = '—'; }
  const elev = grid ? sampleHeight(grid, r.x, r.z) : null;
  $('sh-elev').textContent = finite(elev) ? `${num(elev, 0)} m` : '—';
  let pitch = null, roll = null;
  if (S.physics?.attitude && grid) { try { ({ pitchDeg: pitch, rollDeg: roll } = S.physics.attitude(grid, r.x, r.z, r.heading)); } catch { /* optional */ } }
  $('sh-att').textContent = finite(pitch) && finite(roll) ? `${num(pitch, 1)}° / ${num(roll, 1)}°` : '—';
  $('sh-horizon').style.transform = `translateY(${clamp(finite(pitch) ? pitch * 6 : 0, -120, 120)}px) rotate(${finite(roll) ? -roll : 0}deg)`;
  const alert = $('sh-alert');
  const level = finite(slope) ? slopeAlert(slope).level : 'unknown';
  let message = '', danger = false;
  if (r.battery <= 0) { message = 'BATERÍA AGOTADA · RECORRIDO DETENIDO'; danger = true; }
  else if (r.battery < 20) { message = `BATERÍA BAJA · ${num(r.battery, 0)} %`; danger = true; }
  else if (level === 'warning') message = 'PRECAUCIÓN · PENDIENTE REGIONAL ≥ 12°';
  else if (!S.running && S.started) message = 'EN PAUSA';
  alert.textContent = message; alert.hidden = !message; alert.classList.toggle('danger', danger);
  $('sh-play').textContent = !S.started ? 'Iniciar' : S.running ? 'Pausar' : 'Reanudar';
  $('sh-pilot').textContent = S.mode === 'auto' ? 'Manual' : 'Autónomo';
}
buildTape();

// ---------------------------------------------------------------- boot
function boot() {
  if (!ENGINE || !SITES.length) {
    $('mission-purpose').textContent = 'No se pudo cargar el catálogo (app.js / data.js).';
    log('WARN', 'Catálogo no disponible: revisá app.js y data.js.');
    return;
  }
  renderProfiles();
  selectProfile(ENGINE.profiles[0]);
  selectSite(S.ranking[0].site.id, { quiet: true });
  if (!renderer) log('WARN', 'WebGL no disponible: se muestran el mapa estático, el radar y la telemetría.');
  setView('globe');
  renderSuggestions();
  log('SIS', `Consola iniciada · ${SITES.length} análogos terrestres · catálogo documental.`);
  loadScenarios();
  loadOptionalModules();
  detectBackend();
  requestAnimationFrame((t) => { lastFrame = t; requestAnimationFrame(frame); });
}
boot();
