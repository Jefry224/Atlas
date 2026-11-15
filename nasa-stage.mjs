import * as THREE from './assets/vendor/three.module.min.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
import { assertEmbeddedGlb, validateNasaManifest } from './nasa-visual-math.mjs';

let manifestPromise;
export function loadNasaManifest(refresh = false) {
  if (!manifestPromise || refresh) manifestPromise = (async () => {
    const response = await fetch('assets/data/nasa-assets.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Manifest NASA: HTTP ${response.status}.`);
    const manifest = await response.json(), validation = validateNasaManifest(manifest);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    return manifest;
  })().catch(error => { manifestPromise = null; throw error; });
  return manifestPromise;
}
export function disposeObject(object) {
  if (!object) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  object.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : child.material ? [child.material] : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  textures.forEach(t => { t.source?.data?.close?.(); t.dispose(); });
  object.removeFromParent();
}
export function normalizeObject(object, size = 3) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object), span = bounds.getSize(new THREE.Vector3());
  const dimension = Math.max(span.x, span.y, span.z);
  if (!Number.isFinite(dimension) || dimension <= 0) throw new Error('Empty mesh or no valid dimensions.');
  const root = new THREE.Group(); root.add(object);
  const center = bounds.getCenter(new THREE.Vector3());
  object.position.sub(center); root.scale.setScalar(size / dimension);
  return root;
}
export async function loadNasaModel(asset, signal) {
  if (!asset?.available) throw new Error('Resource pending local preparation.');
  const response = await fetch(asset.localPath, { signal });
  if (!response.ok) throw new Error(`Modelo local: HTTP ${response.status}.`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== asset.bytes) throw new Error('Resource size differs from the manifest.');
  assertEmbeddedGlb(buffer);
  const loader = new GLTFLoader();
  const result = await loader.parseAsync(buffer, '');
  return result.scene;
}
export function mesh(geometry, color, options = {}) { return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .65, ...options })); }
export function schematic(equipment = 'rover') {
  const g = new THREE.Group();
  const box = (x, y, z, px, py, pz, color) => { const m = mesh(new THREE.BoxGeometry(x, y, z), color); m.position.set(px, py, pz); g.add(m); };
  if (equipment === 'wheel') {
    const wheel = mesh(new THREE.CylinderGeometry(.72, .72, .48, 32), 0x859cb1); wheel.rotation.z = Math.PI / 2; g.add(wheel);
    box(1.8, .12, .12, 0, 0, 0, 0xd4d9df);
  } else if (equipment === 'drill') {
    box(.7, .8, .7, 0, .45, 0, 0xd4d9df);
    const bit = mesh(new THREE.CylinderGeometry(.12, .04, 1.2, 20), 0x8b9fb6); bit.position.y = -.5; g.add(bit);
    for (let i = 0; i < 7; i++) { const ring = mesh(new THREE.TorusGeometry(.13, .035, 6, 20), 0xffbd52); ring.rotation.x = Math.PI / 2; ring.position.y = -.1 - i * .14; g.add(ring); }
  } else {
    box(1.8, .55, 1.35, 0, .4, 0, 0xd6dce0);
    box(.12, .9, .12, .5, 1.1, 0, 0x9eb4cb); box(.5, .25, .35, .5, 1.55, 0, 0xd6dce0);
    for (const x of [-.8, 0, .8]) for (const z of [-.85, .85]) { const w = mesh(new THREE.CylinderGeometry(.32, .32, .25, 20), 0x7e8e9c); w.rotation.x = Math.PI / 2; w.position.set(x, 0, z); g.add(w); }
  }
  return g;
}

// One renderer per mounted stage. Input changes only update scene objects; all drawing is on demand.
export class NasaStage {
  constructor(host, status, onReady) {
    this.host = host; this.status = status; this.onReady = onReady;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x07152a);
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.camera = new THREE.PerspectiveCamera(42, 1, .05, 100);
    this.yaw = .55; this.pitch = .35; this.distance = 8.5; this.target = new THREE.Vector3(0, .5, 0);
    this.visible = false; this.moving = false; this.disposed = false; this.sequence = 0; this.raf = 0;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.events = new AbortController(); const signal = this.events.signal;
    const hemi = new THREE.HemisphereLight(0xe3f0ff, 0x29313c, 2.5); this.scene.add(hemi);
    const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(4, 7, 5); this.scene.add(light);
    const fill = new THREE.DirectionalLight(0x70adff, 1.2); fill.position.set(-4, 1, -3); this.scene.add(fill);
    this.lights = { hemi, light, fill };
    this.canvas = document.createElement('canvas'); this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', '3D scene. Arrow keys to rotate, plus or minus to zoom, Home to center. You can also drag.');
    host.prepend(this.canvas);
    this.canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; this.drag = [e.clientX, e.clientY]; this.canvas.setPointerCapture(e.pointerId); }, { signal });
    this.canvas.addEventListener('pointermove', e => { if (!this.drag) return; this.yaw -= (e.clientX - this.drag[0]) * .008; this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - this.drag[1]) * .006, -1.2, 1.3); this.drag = [e.clientX, e.clientY]; this.invalidate(); }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.canvas.addEventListener(type, () => { this.drag = null; }, { signal });
    this.canvas.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'ArrowLeft') this.yaw += .15; if (e.key === 'ArrowRight') this.yaw -= .15;
      if (e.key === 'ArrowUp') this.pitch = Math.min(1.3, this.pitch + .12); if (e.key === 'ArrowDown') this.pitch = Math.max(-1.2, this.pitch - .12);
      if (e.key === '+' || e.key === '=') this.distance = Math.max(4, this.distance - .5); if (e.key === '-') this.distance = Math.min(15, this.distance + .5);
      if (e.key === 'Home') this.reset(); this.invalidate();
    }, { signal });
    this.visibility = () => { if (document.hidden) this.stopFrame(); else this.invalidate(); };
    document.addEventListener('visibilitychange', this.visibility, { signal });
    this.motion.addEventListener('change', () => { if (this.motion.matches) this.moving = false; this.invalidate(); }, { signal });
    this.resize = new ResizeObserver(() => this.invalidate()); this.resize.observe(host);
    this.intersection = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      if (this.visible) { this.ensureRenderer(); this.invalidate(); } else this.stopFrame();
    }, { rootMargin: '100px' }); this.intersection.observe(host);
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.failed = true; this.stopFrame(); this.status.textContent = 'WebGL interrupted. The schematic and accessible values remain available; reload to recover 3D.'; host.dataset.render = 'fallback'; }, { signal });
  }
  ensureRenderer() {
    if (this.renderer || this.failed || this.disposed) return;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.host.dataset.render = 'webgl'; this.onReady?.();
    } catch { this.failed = true; this.host.dataset.render = 'fallback'; this.status.textContent = 'WebGL unavailable: static mode. See the schematic, values and accessible cards.'; }
  }
  reset() { const h = this.home || {}; this.yaw = h.yaw ?? .55; this.pitch = h.pitch ?? .35; this.distance = h.distance ?? 8.5; this.invalidate(); }
  // Raking-light look for terrain relief (Apollo 11): sun ~12° above the horizon, warm key + cool rim, dim sky fill.
  setTerrainLook(on) {
    const { hemi, light, fill } = this.lights;
    hemi.intensity = on ? .25 : 2.5;
    light.color.set(on ? 0xffe2bf : 0xffffff); light.intensity = on ? 5 : 3;
    if (on) light.position.set(Math.cos(.21) * 8, Math.sin(.21) * 8, 1.5); else light.position.set(4, 7, 5);
    fill.color.set(on ? 0x8fb8ff : 0x70adff); fill.intensity = on ? .9 : 1.2;
    if (on) fill.position.set(-6, 1.6, -4); else fill.position.set(-4, 1, -3);
    this.invalidate();
  }
  stopFrame() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.previousTime = null; }
  invalidate() { if (!this.raf && !this.disposed && this.visible && !document.hidden && this.renderer && !this.failed) this.raf = requestAnimationFrame(time => this.draw(time)); }
  draw(time) {
    this.raf = 0;
    if (this.moving && !this.motion.matches) this.yaw += Math.min((time - (this.previousTime || time)) / 1000, .05) * .18;
    this.previousTime = time;
    const { width, height } = this.host.getBoundingClientRect(); if (!width || !height) return;
    if (this.width !== width || this.height !== height) { this.width = width; this.height = height; this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
    const distance = this.distance * (this.frameAspect ? Math.max(1, this.frameAspect / this.camera.aspect) : 1);
    this.camera.position.set(distance * Math.sin(this.yaw) * Math.cos(this.pitch), this.target.y + distance * Math.sin(this.pitch), distance * Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.lookAt(this.target); this.renderer.render(this.scene, this.camera);
    for (const label of this.labels || []) {
      const point = new THREE.Vector3(...label.position).project(this.camera);
      label.node.hidden = point.z > 1 || point.z < -1;
      label.node.style.left = `${THREE.MathUtils.clamp((point.x + 1) * width / 2, 65, width - 65)}px`;
      label.node.style.top = `${THREE.MathUtils.clamp((1 - point.y) * height / 2, 75, height - 30)}px`;
    }
    if (this.moving && !this.motion.matches) this.invalidate();
  }
  setLabels(labels) {
    for (const label of this.labels || []) label.node.remove();
    this.labels = labels.map(label => {
      const node = document.createElement('span'); node.className = 'nasa-arrow-label'; node.textContent = label.text;
      node.style.color = label.color; node.setAttribute('aria-hidden', 'true'); this.host.append(node);
      return { ...label, node };
    });
    this.invalidate();
  }
  setObject(object) { disposeObject(this.object); this.object = object; if (object) this.world.add(object); this.invalidate(); }
  cancelLoad() { this.sequence++; this.loading?.abort(); this.loading = null; }
  async load(asset, decorate) {
    this.cancelLoad(); const token = this.sequence; this.loading = new AbortController();
    this.status.textContent = `Loading ${asset?.label || 'NASA resource'} from local file…`;
    try {
      const model = await loadNasaModel(asset, this.loading.signal);
      if (token !== this.sequence || this.disposed) { disposeObject(model); return false; }
      let object;
      try { object = normalizeObject(model); } catch (error) { disposeObject(model); throw error; }
      this.setObject(object); decorate?.(object);
      this.status.textContent = `${asset.label} · GLB local · escala visual normalizada.`; this.host.dataset.asset = asset.id; this.host.dataset.load = 'ready';
      return true;
    } catch (error) {
      if (token !== this.sequence || this.disposed) return false;
      this.status.textContent = `${asset?.label || 'Resource'} unavailable: ${error.message} An explicit schematic representation is kept.`;
      this.host.dataset.load = 'fallback'; this.host.dataset.asset = ''; return false;
    }
  }
  dispose() {
    this.disposed = true; this.cancelLoad(); this.stopFrame(); this.events.abort(); this.resize.disconnect(); this.intersection.disconnect();
    this.setLabels([]); disposeObject(this.world); this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.canvas.remove();
  }
}
export { THREE };
