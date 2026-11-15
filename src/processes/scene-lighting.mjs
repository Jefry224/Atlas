// S.E.L.E.N.E. Ops · base lighting (docs/qa/plan-visual-refactor.md, phase 3a).
//
// Renderer colour pipeline (ACES Filmic tone mapping, sRGB output), per-body exposure and a cheap
// "focus" shadow: one 1024² map on the scene-fx sun, with a tight orthographic camera that follows the
// rover or lander so only small objects cast sharp shadows on the terrain.
//
// `exposureFor` is pure (no DOM, no Three.js) and tested in tests/terrain-shader.test.mjs.
// The exposure values are an artistic display choice (how bright the frame looks on a laptop screen),
// not a photometric model: they never feed telemetry or energy numbers.
//
// Imagery colour space: every colour texture (orthoimagery, Blue Marble, context imagery) must be tagged
// `texture.colorSpace = THREE.SRGBColorSpace` right after it loads, otherwise Three.js treats the JPEG as
// linear data and the frame looks washed out once tone mapping is on. mission.js `loadTexture()` and
// scene-fx.mjs already do this; any new loader must too. Data textures (heights, masks) stay linear.

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const normBody = (b) => (b === 'mars' || b === 'moon' ? b : 'earth');

/**
 * Exposure anchors per body (display choice, see header).
 * - moon: airless, harsh sun on bright regolith → lower day exposure so highlights are not blown out.
 * - mars: dimmer, dust-scattered butterscotch light → slightly higher exposure brings out the warm ochre.
 * - night: lifted on every body so the scene stays readable (the night lights in scene-fx are already
 *   brighter than physical on purpose). The Moon night is lifted the most: it is lit only by earthshine
 *   (real, but far dimmer than shown), so a polar site such as Shackleton still reads as cool, soft night.
 */
export const EXPOSURE = Object.freeze({
  earth: Object.freeze({ day: 1.15, night: 1.65 }),
  moon: Object.freeze({ day: 0.8, night: 1.95 }),
  mars: Object.freeze({ day: 1.25, night: 1.7 }),
  min: 0.55,
  max: 2.2,
});

/**
 * Tone-mapping exposure for a body, sun elevation and optional WeatherState (docs/modules/m3-processes.md).
 * Pure. Missing/invalid inputs fall back to a clear sky with the sun at 45°.
 * @param {'earth'|'moon'|'mars'|string} body
 * @param {number} [sunElevationDeg]
 * @param {{ solarFactor?: number, dustTau?: number, cloudPct?: number, sunElevationDeg?: number } | null} [weather]
 * @returns {number} exposure in [EXPOSURE.min, EXPOSURE.max], 3 decimals
 */
export function exposureFor(body, sunElevationDeg, weather = null) {
  const b = normBody(body);
  const anchors = EXPOSURE[b];
  const el = finite(sunElevationDeg) ? sunElevationDeg : finite(weather?.sunElevationDeg) ? weather.sunElevationDeg : 45;
  // twilight blend: full night below −8°, full day above +10°; the airless Moon has no twilight, so its
  // blend is narrower (−4°…+8°): a polar sun just below the horizon (Shackleton, ±1.6°) is already night
  const day = b === 'moon' ? smooth(-4, 8, el) : smooth(-8, 10, el);
  let e = lerp(anchors.night, anchors.day, day);
  // low sun (long shadows, grazing light) reads darker: small lift, only in daylight
  e *= 1 + 0.12 * (1 - smooth(5, 30, el)) * day;
  if (b !== 'moon' && weather) {
    // dust or cloud dims the direct beam; open the exposure partially, like an eye or camera adapting,
    // so a storm still looks darker than a clear day but stays legible
    let dim = finite(weather.solarFactor) ? clamp(weather.solarFactor, 0.05, 1) : null;
    if (dim === null) {
      const tau = finite(weather.dustTau) ? Math.max(0, weather.dustTau) : 0;
      const cloud = finite(weather.cloudPct) ? clamp(weather.cloudPct / 100, 0, 1) : 0;
      dim = Math.exp(-tau * 0.35) * (1 - 0.7 * cloud ** 1.5);
    }
    e *= 1 + 0.45 * (1 - dim) * day;
  }
  return Math.round(clamp(e, EXPOSURE.min, EXPOSURE.max) * 1000) / 1000;
}

/**
 * Colour pipeline and shadow map. Call once after `new THREE.WebGLRenderer(...)`.
 * Shadows are enabled globally but nothing casts until a light has `castShadow = true`
 * (createFocusShadow does that for the sun) and objects opt in with `castShadow` / `receiveShadow`.
 */
export function configureRenderer(renderer, THREE, { exposure = 1 } = {}) {
  if (!renderer) return renderer;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = finite(exposure) ? exposure : 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/**
 * Smoothly move `renderer.toneMappingExposure` toward `target` (frame-rate independent).
 * With one renderer and two scenes (split view) call `renderer.toneMappingExposure = value` right before
 * each `renderer.render(scene, camera)` instead, so each side gets its own body's exposure.
 */
export function easeExposure(current, target, dt, rate = 2.5) {
  if (!finite(target)) return current;
  if (!finite(current)) return target;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt || 0) * rate));
}

/**
 * Tight shadow camera around a focus point (rover or lander) on a scene-fx sun light.
 * The light direction is kept exactly as scene-fx set it (position − target); only both points are
 * translated to the focus, snapped to whole shadow texels so the shadow does not shimmer while moving.
 * Call `update(focus)` every frame after `fx.update()` / `fx.setSun()` and before `renderer.render()`.
 *
 * @param {object} THREE
 * @param {import('three').DirectionalLight} sunLight `fx.lights.sun`
 * @param {{ sizeM?: number, unitsPerMeter?: number, mapSize?: number, depthM?: number }} [options]
 *   sizeM: side of the shadow box in metres (default 300 m: covers a ×14 rover and its long shadow at a
 *   low sun). depthM: depth of the box along the light (default 3000 m), centred on the focus.
 * @returns {{ update(focus: {x:number,y:number,z:number}|null): void, setEnabled(on: boolean): void, dispose(): void, camera: import('three').OrthographicCamera }}
 */
export function createFocusShadow(THREE, sunLight, { sizeM = 300, unitsPerMeter = 0.1, mapSize = 1024, depthM = 3000 } = {}) {
  const shadow = sunLight.shadow;
  const half = (sizeM * unitsPerMeter) / 2;
  const depth = depthM * unitsPerMeter;
  shadow.mapSize.set(mapSize, mapSize);
  const cam = shadow.camera;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  cam.near = 0.5; cam.far = depth;
  cam.updateProjectionMatrix();
  // biases tuned for a 30-unit box on a 1024 map (≈0.03 units per texel) on the exaggerated DEM
  shadow.bias = -0.0004;
  shadow.normalBias = 0.04;
  sunLight.castShadow = true;

  const texel = (2 * half) / mapSize;
  const dir = new THREE.Vector3(), ux = new THREE.Vector3(), uy = new THREE.Vector3(), ref = new THREE.Vector3();
  const snapped = new THREE.Vector3();
  let enabled = true;

  return {
    camera: cam,
    update(focus) {
      if (!enabled || !focus || !finite(focus.x) || !finite(focus.y) || !finite(focus.z)) return;
      dir.subVectors(sunLight.position, sunLight.target.position);
      if (dir.lengthSq() < 1e-12) return;
      dir.normalize();
      // light-space basis matching the shadow camera's lookAt (x = up × z, y = z × x)
      ref.set(0, 1, 0);
      if (Math.abs(dir.y) > 0.999) ref.set(0, 0, 1);
      ux.crossVectors(ref, dir).normalize();
      uy.crossVectors(dir, ux);
      const a = focus.x * ux.x + focus.y * ux.y + focus.z * ux.z;
      const b = focus.x * uy.x + focus.y * uy.y + focus.z * uy.z;
      const c = focus.x * dir.x + focus.y * dir.y + focus.z * dir.z;
      snapped.copy(ux).multiplyScalar(Math.round(a / texel) * texel)
        .addScaledVector(uy, Math.round(b / texel) * texel)
        .addScaledVector(dir, c);
      sunLight.target.position.copy(snapped);
      sunLight.position.copy(snapped).addScaledVector(dir, depth / 2);
      sunLight.target.updateMatrixWorld();
      sunLight.updateMatrixWorld();
    },
    setEnabled(on) {
      enabled = Boolean(on);
      sunLight.castShadow = enabled;
    },
    dispose() {
      sunLight.castShadow = false;
      shadow.map?.dispose?.();
      shadow.map = null;
    },
  };
}

/**
 * Opt an object tree into shadows. `castShadow` / `receiveShadow` are per mesh in Three.js (not
 * inherited), so groups such as the rover, the lazily loaded Perseverance glTF or a lander must be
 * traversed; call it again after a model is added to the group.
 */
export function setShadowFlags(object, { cast = false, receive = false } = {}) {
  object?.traverse?.((node) => {
    if (!node.isMesh) return;
    node.castShadow = Boolean(cast);
    node.receiveShadow = Boolean(receive);
  });
  return object;
}
