// Cinematic landing layer: camera choreography and engine/dust effects driven by the existing
// landing run state (landing-controller.mjs). It never changes the physics: everything here reads
// the run state and only moves the camera or draws effects.
//
// Pure parts (no THREE, no DOM, unit-tested in tests/landing-cinematic.test.mjs):
//   directShot(), legCompression(), requiredCameraY(), createPhaseClock().
// Browser parts (receive THREE so they share mission.js's copy of assets/vendor/three.module.min.js):
//   createCameraRig(THREE), createLandingFx(THREE, scene, { body }).
//
// Scene units follow landing-view.mjs: U scene units per metre (default 0.1), y = up; terrain relief is
// exaggerated by the caller, so ground heights always come from the caller's ground function.
//
// Honesty: the plume, dust and bounce are illustrative visuals, not simulated plume–surface
// interaction. The Moon dust behaviour (radial ballistic sheets, no cloud, no drift) follows what is
// visible in Apollo descent footage; Mars/Earth clouds are a stylised drag + wind drift model.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// ------------------------------------------------------------------ camera director (pure)

/** Shot thresholds in metres above ground and the touchdown window in real seconds. */
export const SHOT_LIMITS = Object.freeze({
  establishingAboveM: 120,
  groundBelowM: 30,
  touchdownWindowS: 1.2,
  slowMotionScale: 0.35,
});

const TERMINAL_HARD = new Set(['hard-contact']);

/**
 * Pick the camera shot for the current run state.
 * @param {object} s
 * @param {string} s.phase controller phase: ready, preparation, descent, contact, deployment,
 *   exploration, hard-contact, aborted (unknown phases → free)
 * @param {number} s.altitudeM lander altitude above ground (m)
 * @param {number} [s.horizontalSpeedMs] horizontal speed (m/s), used for the look-ahead
 * @param {number} [s.tSincePhase] real seconds since the phase started (see createPhaseClock)
 * @param {string} [s.body] earth | moon | mars
 * @param {boolean} [s.reducedMotion] no shake, no slow motion, cuts instead of camera moves
 * @param {number} [s.sunAzimuthDeg] bearing of the sun seen from the lander in the same convention as
 *   azimuthDeg (atan2(sunDir.x, sunDir.z) in degrees). Shot azimuths are offsets from it so the
 *   lander is lit three-quarter / side-on instead of back-lit. Default 0.
 * @param {number} [s.rigSpanM] Mars sky crane only: vertical extent of rover + bridles + descent stage in
 *   framing metres (as drawn, divided by the caller's frame scale). When > 0 on Mars, the final metres,
 *   the touchdown and the bridle cut use close rig shots ('lowering', 'touchdown', 'cut') that fit the
 *   whole rig; the caller aims at the middle of the rig. Default 0 (lander shots).
 * @returns {{shot:string, distanceM:number, heightM:number, azimuthDeg:number, fovDeg:number,
 *   lookAheadM:number, shake:number, timeScale:number, cut:boolean}}
 *   distanceM: horizontal camera–lander distance; heightM: camera height above the ground under the
 *   camera; azimuthDeg: camera bearing around the lander (offset = sin/cos(az)·d on scene x/z);
 *   lookAheadM: aim point pushed ahead along the horizontal velocity; shake: weight the rig multiplies
 *   by throttle (touchdown: a decaying impact jolt independent of throttle); timeScale: multiply the
 *   simulation/effects dt by it (1 except in the touchdown slow-motion window); cut: snap on shot change.
 */
export function directShot({ phase, altitudeM, horizontalSpeedMs = 0, tSincePhase = 0, body = 'earth', reducedMotion = false, sunAzimuthDeg = 0, rigSpanM = 0 } = {}) {
  const alt = Math.max(0, num(altitudeM, 0));
  const t = Math.max(0, num(tSincePhase, 0));
  const vh = Math.max(0, num(horizontalSpeedMs, 0));
  const rm = Boolean(reducedMotion);
  const L = SHOT_LIMITS;
  const sunAz = num(sunAzimuthDeg, 0);
  const out = (shot, p) => ({
    shot, distanceM: p.distanceM, heightM: p.heightM, azimuthDeg: shot === 'free' ? 0 : sunAz + p.azimuthDeg, fovDeg: p.fovDeg,
    lookAheadM: p.lookAheadM ?? 0, shake: rm ? 0 : (p.shake ?? 0), timeScale: rm ? 1 : (p.timeScale ?? 1), cut: rm,
  });
  const free = () => out('free', { distanceM: 0, heightM: 0, azimuthDeg: 0, fovDeg: 45 });

  const establishing = () => out('establishing', {
    // Wide and slightly below the lander so it reads small against the horizon/sky line.
    distanceM: body === 'moon' ? 220 : 200, heightM: Math.max(20, alt * 0.9), azimuthDeg: 35, fovDeg: 30,
    lookAheadM: 0, shake: 0.04,
  });

  // Mars sky crane: frame rover, bridles and descent stage together (the rig is tall and thin).
  const span = Math.max(0, num(rigSpanM, 0));
  const craneShot = (shot, extra = {}) => out(shot, { ...skyCraneFraming(span, alt), azimuthDeg: 62, lookAheadM: 0, ...extra });
  const crane = body === 'mars' && span > 0;

  if (phase === 'preparation') return establishing();
  if (phase === 'descent') {
    if (crane && alt <= SKY_CRANE_SHOT_BELOW_M) return craneShot('lowering', { shake: 0.18 });
    if (alt > L.establishingAboveM) return establishing();
    if (alt > L.groundBelowM) {
      // Low lateral track: dollies in as the lander brakes (fixed framing under reduced motion).
      const k = rm ? 0.5 : clamp((alt - L.groundBelowM) / (L.establishingAboveM - L.groundBelowM), 0, 1);
      return out('tracking', {
        distanceM: lerp(40, 75, k), heightM: Math.max(4, alt - lerp(2, 9, k)), azimuthDeg: 55 + 15 * (1 - k),
        fovDeg: 40, lookAheadM: clamp(vh * 1.5, 0, 25), shake: 0.12,
      });
    }
    return out('ground', {
      // Low ground-level camera looking up at the last metres.
      distanceM: 26 + alt * 0.2, heightM: 1.4, azimuthDeg: 70, fovDeg: 52, lookAheadM: 0, shake: 0.3,
    });
  }
  if (phase === 'contact' || TERMINAL_HARD.has(phase)) {
    if (t < L.touchdownWindowS) {
      const hard = TERMINAL_HARD.has(phase);
      if (crane) return craneShot('touchdown', { shake: (hard ? 1.6 : 1) * Math.exp(-4 * t),
        timeScale: lerp(L.slowMotionScale, 1, smooth(0.85, L.touchdownWindowS, t)) });
      return out('touchdown', {
        distanceM: 22, heightM: 2, azimuthDeg: 70, fovDeg: 46, lookAheadM: 0,
        shake: (hard ? 1.6 : 1) * Math.exp(-4 * t),
        timeScale: lerp(L.slowMotionScale, 1, smooth(0.85, L.touchdownWindowS, t)),
      });
    }
    // Mars: hold the close rig framing through the bridle cut and the start of the flyaway.
    if (crane && t < L.touchdownWindowS + SKY_CRANE_CUT_HOLD_S) return craneShot('cut', { shake: 0 });
    if (phase === 'contact') return deployShot(t - L.touchdownWindowS - (crane ? SKY_CRANE_CUT_HOLD_S : 0), rm, out);
    return free();
  }
  if (phase === 'deployment') return deployShot(t, rm, out);
  return free(); // ready, exploration, aborted, unavailable, unknown
}

/** The rig shot starts at this rover altitude: a little above the 20 m sky crane start (skycrane-visual.mjs)
 * so the camera move has settled when the bridles begin to pay out. */
export const SKY_CRANE_SHOT_BELOW_M = 26;
/** Real seconds the close rig framing is held after the touchdown window (bridle cut + stage liftoff). */
export const SKY_CRANE_CUT_HOLD_S = 1.8;

/**
 * Close framing for a tall rig of vertical extent spanM (framing metres, same units as distanceM):
 * the camera distance just fits the span in the vertical field of view with a small margin, and the
 * camera sits low (≈ 30 % of the span) so the stage reads above the rover. The caller aims at the
 * middle of the span. Pure; exported for tests.
 */
export function skyCraneFraming(spanM, altitudeM = 0) {
  const span = Math.max(0, num(spanM, 0)), alt = Math.max(0, num(altitudeM, 0)), fovDeg = 50, margin = 1.25;
  const fit = (span * 0.5 * margin) / Math.tan((fovDeg / 2) * Math.PI / 180);
  return { distanceM: Math.max(10, fit), heightM: alt + span * 0.3, fovDeg };
}

function deployShot(t, rm, out) {
  // Slow orbit (9°/s) around the lander while the rover rolls off; static framing under reduced motion.
  return out('deploy', { distanceM: 34, heightM: 9, azimuthDeg: 70 - (rm ? 0 : 9 * Math.max(0, t)), fovDeg: 44, lookAheadM: 0, shake: 0 });
}

/**
 * Tracks real time since the last phase change (for directShot's tSincePhase).
 * @returns {(phase:string, nowS:number) => number}
 */
export function createPhaseClock() {
  let last = null, since = 0;
  return (phase, nowS) => {
    if (phase !== last) { last = phase; since = nowS; }
    return Math.max(0, nowS - since);
  };
}

/**
 * Lowest camera Y that keeps the camera and its line of sight above the terrain.
 * @param {object} p
 * @param {number} p.cameraY desired camera Y (scene units)
 * @param {number} p.targetY aim point Y (scene units)
 * @param {number} p.margin clearance (scene units)
 * @param {{t:number, groundY:number}[]} p.groundAlong ground samples at fraction t ∈ [0, 1) of the
 *   camera→target segment (t = 0 is under the camera)
 */
export function requiredCameraY({ cameraY, targetY, margin, groundAlong = [] }) {
  let y = cameraY;
  for (const { t, groundY } of groundAlong) {
    if (!Number.isFinite(groundY) || !Number.isFinite(t) || t < 0 || t >= 1) continue;
    // Line height at t: y + (targetY − y)·t ≥ groundY + margin  →  y ≥ (groundY + margin − targetY·t)/(1 − t)
    y = Math.max(y, (groundY + margin - targetY * t) / (1 - t));
  }
  return y;
}

// ------------------------------------------------------------------ touchdown bounce (pure)

/**
 * Leg-strut compression after touchdown (metres, ≥ 0): an under-damped spring that starts at 0 with
 * the impact speed and settles at a small static compression. Illustrative, not a strut model.
 * @param {number} tSinceTouchdown seconds
 * @param {number} impactSpeedMs vertical impact speed magnitude (m/s)
 */
export function legCompression(tSinceTouchdown, impactSpeedMs) {
  const t = num(tSinceTouchdown, -1), v = Math.abs(num(impactSpeedMs, 0));
  if (t <= 0) return 0;
  const w0 = 2 * Math.PI * 1.6, zeta = 0.35, eq = 0.04;
  const wd = w0 * Math.sqrt(1 - zeta * zeta), decay = Math.exp(-zeta * w0 * t);
  // x(0) = 0, x'(0) = v, x(∞) = eq
  const x = eq + decay * (-eq * Math.cos(wd * t) + ((v - zeta * w0 * eq) / wd) * Math.sin(wd * t));
  return clamp(x, 0, 0.45);
}

// ------------------------------------------------------------------ camera rig (THREE)

/**
 * Smooths shot parameters, keeps terrain clearance and adds a throttle-proportional shake.
 * @param {object} THREE
 * @param {{U?:number, clearanceM?:number, aimHeightM?:number}} [opts]
 * @returns {{apply(camera, shotParams, target, groundFn, dt):boolean, reset():void}}
 *   target: { position:{x,y,z} lander origin in scene units, throttle?:0..1, vxMs?, vzMs? }
 *   groundFn(xM, zM) → ground scene Y (landing-view's layer.ground). apply() returns false for the
 *   free shot (the caller keeps its own camera) and true when it posed the camera.
 */
export function createCameraRig(THREE, { U = 0.1, clearanceM = 1.5, aimHeightM = 2 } = {}) {
  const state = { active: false, shot: null, transition: 0, time: 0, lift: 0,
    distanceM: 0, heightM: 0, azimuthDeg: 0, fovDeg: 45, lookAheadM: 0, dirX: 0, dirZ: 1 };
  const look = new THREE.Vector3(), lookSm = new THREE.Vector3(), pos = new THREE.Vector3(), euler = new THREE.Euler();
  const KEYS = ['distanceM', 'heightM', 'fovDeg', 'lookAheadM'];
  const angleDelta = (a, b) => ((b - a + 540) % 360) - 180;

  function snap(p) { for (const k of KEYS) state[k] = p[k]; state.azimuthDeg = p.azimuthDeg; }
  function fromCamera(camera, tp) {
    // Start a shot from wherever the free camera is, so entering cinematic mode is a move, not a jump.
    const dx = camera.position.x - tp.x, dz = camera.position.z - tp.z;
    state.distanceM = Math.hypot(dx, dz) / U;
    state.azimuthDeg = Math.atan2(dx, dz) * 180 / Math.PI;
    state.heightM = state.heightM || 10;
    state.fovDeg = camera.fov; state.lookAheadM = 0;
  }

  function apply(camera, p, target, groundFn, dt) {
    if (!p || p.shot === 'free' || !target?.position) { state.active = false; state.shot = null; return false; }
    const step = clamp(num(dt, 0), 0, 0.1);
    state.time += step;
    const tp = target.position;
    const changed = p.shot !== state.shot;
    if (!state.active) {
      if (p.cut) snap(p); else { fromCamera(camera, tp); state.transition = 1.6; }
      lookSm.set(tp.x, tp.y + aimHeightM * U, tp.z); state.lift = 0;
    } else if (changed) {
      if (p.cut) { snap(p); lookSm.set(tp.x, tp.y + aimHeightM * U, tp.z); } else state.transition = 1.6;
    }
    state.active = true; state.shot = p.shot;
    state.transition = Math.max(0, state.transition - step);
    const tau = state.transition > 0 ? 0.75 : 0.22;
    const k = p.cut && changed ? 1 : 1 - Math.exp(-step / tau);
    for (const key of KEYS) state[key] = lerp(state[key], p[key], k);
    state.azimuthDeg += angleDelta(state.azimuthDeg, p.azimuthDeg) * k;

    // Look-ahead direction: horizontal velocity, kept when the lander is nearly hovering.
    const vx = num(target.vxMs, 0), vz = num(target.vzMs, 0), vh = Math.hypot(vx, vz);
    if (vh > 0.5) { const kd = 1 - Math.exp(-step / 0.5); state.dirX = lerp(state.dirX, vx / vh, kd); state.dirZ = lerp(state.dirZ, vz / vh, kd); }
    look.set(tp.x + state.dirX * state.lookAheadM * U, tp.y + aimHeightM * U, tp.z + state.dirZ * state.lookAheadM * U);
    const kl = p.cut && changed ? 1 : 1 - Math.exp(-step / (state.transition > 0 ? 0.35 : 0.08));
    lookSm.lerp(look, kl);

    const az = state.azimuthDeg * Math.PI / 180, d = state.distanceM * U;
    pos.set(tp.x + Math.sin(az) * d, 0, tp.z + Math.cos(az) * d);
    const g0 = num(groundFn(pos.x / U, pos.z / U), 0);
    const desiredY = g0 + state.heightM * U;
    const groundAlong = [{ t: 0, groundY: g0 }];
    for (const t of [0.25, 0.5]) {
      const x = lerp(pos.x, lookSm.x, t), z = lerp(pos.z, lookSm.z, t);
      groundAlong.push({ t, groundY: num(groundFn(x / U, z / U), -Infinity) });
    }
    const needed = requiredCameraY({ cameraY: desiredY, targetY: lookSm.y, margin: clearanceM * U, groundAlong }) - desiredY;
    // Smooth both ways (fast up, slow down) so an orbiting camera does not bob; the hard floor below still prevents clipping.
    state.lift = lerp(state.lift, needed, 1 - Math.exp(-step / (needed > state.lift ? 0.18 : 0.9)));
    pos.y = desiredY + state.lift;
    const floor = requiredCameraY({ cameraY: -Infinity, targetY: lookSm.y, margin: clearanceM * U, groundAlong: [{ t: 0, groundY: g0 }] });
    pos.y = Math.max(pos.y, floor);

    camera.position.copy(pos);
    if (Math.abs(camera.fov - state.fovDeg) > 1e-3) { camera.fov = state.fovDeg; camera.updateProjectionMatrix(); }
    camera.lookAt(lookSm);

    // Shake: low-frequency handheld sway (7–17 rad/s, well below the frame rate so it never aliases into
    // frame-to-frame jitter), ∝ throttle; touchdown adds a decaying jolt.
    const level = p.shot === 'touchdown' ? p.shake : p.shake * clamp(num(target.throttle, 0), 0, 1);
    if (level > 1e-4) {
      const a = 0.0035 * level, t = state.time;
      euler.set(a * (Math.sin(t * 7.3) * 0.6 + Math.sin(t * 11.9 + 1.3) * 0.4), a * (Math.sin(t * 9.1 + 0.7) * 0.6 + Math.sin(t * 17.1) * 0.4), a * 0.4 * Math.sin(t * 13.3 + 2.1));
      camera.rotateX(euler.x); camera.rotateY(euler.y); camera.rotateZ(euler.z);
    }
    return true;
  }

  return { apply, reset() { state.active = false; state.shot = null; } };
}

// ------------------------------------------------------------------ effects (THREE)

const BODY_FX = {
  // Plume: colours (sRGB), length/width scale, opacity; dust: colour, blast altitude, behaviour.
  // halo: additive nozzle sprite peak opacity; pool: additive ground light pool peak opacity (both × throttle).
  earth: { core: 0xffdca8, outer: 0xff6a20, len: 1, wid: 1, coreSpread: 1.5, glowSpread: 2.6, opacity: 0.75, diamonds: 1, light: 0xffc48a, lightPeak: 1.1, halo: 0.8, pool: 0.4,
    dust: 0x9a8a72, dustBelowM: 25, ballistic: false, gravity: 9.81, cloudAlpha: 0.07 },
  mars: { core: 0xfff0d8, outer: 0xff9a4a, len: 0.6, wid: 1.2, coreSpread: 2.0, glowSpread: 3.4, opacity: 0.85, diamonds: 0, light: 0xffb070, lightPeak: 1.3, halo: 0.75, pool: 0.38,
    dust: 0xb07448, dustBelowM: 25, ballistic: false, gravity: 3.71, cloudAlpha: 0.08 },
  // Vacuum: the plume expands widely and is almost invisible against a sunlit surface; halo and pool stay faint.
  moon: { core: 0xe8eeff, outer: 0x9fb4ff, len: 1.35, wid: 1.2, coreSpread: 4.0, glowSpread: 7.0, opacity: 0.09, diamonds: 0, light: 0xcfdcff, lightPeak: 0.5, halo: 0.35, pool: 0.2,
    dust: 0x9a9a9e, dustBelowM: 30, ballistic: true, gravity: 1.62, cloudAlpha: 0.55 },
};

const PLUME_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const PLUME_FRAG = /* glsl */`
uniform vec3 uCore; uniform vec3 uOuter; uniform float uIntensity; uniform float uTime;
uniform float uSharp; uniform float uDiamonds; uniform float uFreq; uniform float uFalloff;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  float s = 1.0 - vUv.y;                         // 0 at the nozzle, 1 at the tail
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float core = pow(facing, uSharp);
  float fade = pow(1.0 - s, uFalloff) * smoothstep(0.0, 0.03, s + 0.01);
  float flicker = 0.88 + 0.12 * sin(uTime * 47.0 + s * 23.0) * sin(uTime * 29.0 + 1.7);
  float band = pow(max(0.0, cos(s * uFreq * 6.2831853)), 10.0) * (1.0 - s) * core;
  vec3 col = mix(uOuter, uCore, clamp(core * (1.15 - s) * mix(1.0, 0.6, uDiamonds) + band * uDiamonds, 0.0, 1.0));
  // With shock diamonds (Earth) the gaps between bands are dimmer so the diamonds read.
  float a = uIntensity * fade * (0.15 + 0.85 * core) * flicker * (mix(1.0, 0.25, uDiamonds) + band * uDiamonds * 2.0);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}`;
const DUST_VERT = /* glsl */`
attribute float aAlpha; attribute float aSize; uniform float uHalfH; uniform vec2 uNear; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = aAlpha * smoothstep(uNear.x, uNear.y, -mv.z);   // fade particles that brush the lens
  gl_PointSize = vA > 0.0 ? min(160.0, aSize * projectionMatrix[1][1] * uHalfH / max(0.05, -mv.z)) : 0.0;
}`;
const DUST_FRAG = /* glsl */`
uniform vec3 uColor; varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = vA * smoothstep(0.5, 0.05, d);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const STREAK_VERT = /* glsl */`
attribute float aAlpha; uniform vec2 uNear; varying float vA;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vA = aAlpha * smoothstep(uNear.x, uNear.y, -mv.z); }`;
const STREAK_FRAG = /* glsl */`
uniform vec3 uColor; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(uColor, vA);
  #include <colorspace_fragment>
}`;

const MAX_PARTICLES = 3600; // ≤ 4000 budget (dust blast + touchdown ring share one pool)

/**
 * Engine plume, nozzle halo, engine light, ground light pool and dust blast for one landing scene.
 * No post-processing: the halo and the pool are additive sprites/decals scaled by throttle (illustrative).
 * @param {object} THREE
 * @param {object} scene THREE.Scene (or any Object3D) for the world-space light and dust
 * @param {{body?:string, U?:number, daylight?:boolean, reducedMotion?:boolean, visualScale?:number}} [opts]
 *   visualScale: the hardware drawing scale (landing-stage draws landers ×14); the light and the pool
 *   footprint grow with it so they match the drawn vehicle. Default 1.
 * @returns {{setEngines(engines, parent?):void, update(dt, s):void, setDaylight(b):void, dispose():void, group}}
 *   setEngines([{ position, axis, nozzleRadiusM?, lengthM? }], parent): position/axis in the parent's
 *   local frame (scene units) when parent (e.g. the lander Object3D) is given; otherwise position is an
 *   offset from landerPos and axis is world-aligned. axis points along the exhaust (default 0,−1,0).
 *   update(dt, { throttle 0..1, altitudeM, groundY (scene Y under the lander), landerPos {x,y,z},
 *   wind {x,z} m/s, phase, touchdown (true on the contact frame; phase changes into contact /
 *   hard-contact are also detected), sourcePos? {x,y,z} world position of the engines for the ground light
 *   pool when they are not registered with setEngines (e.g. the sky crane stage) }).
 */
export function createLandingFx(THREE, scene, { body = 'earth', U = 0.1, daylight = true, reducedMotion = false, visualScale = 1 } = {}) {
  const cfg = BODY_FX[body] || BODY_FX.earth;
  const hw = Math.max(1, num(visualScale, 1));
  const group = new THREE.Group(); group.name = 'landing-cinematic-fx';
  scene.add(group);
  let time = 0, lastPhase = null, burstDone = false, dayFactor = daylight ? 1 : 0;

  // --- plumes
  // Unit-length cones (nozzle radius 1 at y = 0, flaring to the body's spread at y = −1).
  const coreGeo = new THREE.CylinderGeometry(1, cfg.coreSpread, 1, 24, 20, true); coreGeo.translate(0, -0.5, 0);
  const glowGeo = new THREE.CylinderGeometry(1.3, cfg.glowSpread, 1, 24, 20, true); glowGeo.translate(0, -0.5, 0);
  const engines = [];
  const plumeMat = (glow) => new THREE.ShaderMaterial({
    uniforms: {
      uCore: { value: new THREE.Color(cfg.core) }, uOuter: { value: new THREE.Color(cfg.outer) },
      uIntensity: { value: 0 }, uTime: { value: 0 }, uSharp: { value: glow ? 0.8 : 2.2 },
      uDiamonds: { value: glow ? 0 : cfg.diamonds }, uFreq: { value: 4.5 }, uFalloff: { value: glow ? 1.6 : 1.1 },
    },
    vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const glowTex = (() => {
    const n = 64, data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2), a = Math.pow(clamp(1 - d, 0, 1), 2.2);
      const i = (y * n + x) * 4; data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
    }
    const tex = new THREE.DataTexture(data, n, n); tex.needsUpdate = true; return tex;
  })();

  function clearEngines() {
    for (const e of engines) { e.root.removeFromParent(); e.core.material.dispose(); e.glow.material.dispose(); e.spark.material.dispose(); }
    engines.length = 0;
  }
  function setEngines(list = [], parent = null) {
    clearEngines();
    for (const spec of list) {
      const root = new THREE.Group();
      const p = spec.position || { x: 0, y: 0, z: 0 };
      root.position.set(num(p.x, 0), num(p.y, 0), num(p.z, 0));
      const ax = new THREE.Vector3(num(spec.axis?.x, 0), num(spec.axis?.y, -1), num(spec.axis?.z, 0));
      if (ax.lengthSq() < 1e-9) ax.set(0, -1, 0);
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), ax.normalize());
      const core = new THREE.Mesh(coreGeo, plumeMat(false)), glow = new THREE.Mesh(glowGeo, plumeMat(true));
      core.frustumCulled = glow.frustumCulled = false; core.renderOrder = glow.renderOrder = 10;
      const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(cfg.core), transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      spark.renderOrder = 11;
      root.add(glow, core, spark);
      (parent || group).add(root);
      engines.push({ root, core, glow, spark, parented: Boolean(parent), offset: root.position.clone(),
        nozzleR: num(spec.nozzleRadiusM, 0.5) * U, lengthM: num(spec.lengthM, 9) });
    }
  }

  // --- engine light
  const light = new THREE.PointLight(cfg.light, 0, 4, 2);
  light.castShadow = false; group.add(light);

  // --- ground light pool: a flat additive decal under the engines (soft radial falloff, no post-processing).
  const poolGeo = new THREE.PlaneGeometry(1, 1); poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(cfg.light), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pool = new THREE.Mesh(poolGeo, poolMat); pool.name = 'engine-light-pool'; pool.renderOrder = 8; pool.visible = false;
  group.add(pool);

  // --- dust pool
  const N = MAX_PARTICLES;
  const posArr = new Float32Array(N * 3), alphaArr = new Float32Array(N), sizeArr = new Float32Array(N);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), maxLife = new Float32Array(N);
  const size0 = new Float32Array(N), grow = new Float32Array(N), peak = new Float32Array(N);
  let cursor = 0, emitAcc = 0, alive = 0;
  const dustGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(alphaArr, 1).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(sizeArr, 1).setUsage(THREE.DynamicDrawUsage);
  dustGeo.setAttribute('position', posAttr); dustGeo.setAttribute('aAlpha', alphaAttr); dustGeo.setAttribute('aSize', sizeAttr);
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(cfg.dust) }, uHalfH: { value: 400 }, uNear: { value: new THREE.Vector2(3 * U, 15 * U) } },
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, fog: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; dust.renderOrder = 9;
  const v2 = new THREE.Vector2();
  dust.onBeforeRender = (renderer) => { renderer.getDrawingBufferSize(v2); dustMat.uniforms.uHalfH.value = v2.y * 0.5; };
  group.add(dust);
  // Moon: each particle is drawn as a short velocity-aligned line (head → tail) so the ejecta reads as
  // straight radial ballistic streaks instead of a cloud.
  let streakGeo = null, streakMat = null, streakPos = null, streakAlpha = null, streakPosAttr = null, streakAlphaAttr = null;
  if (cfg.ballistic) {
    dust.visible = false;
    streakPos = new Float32Array(N * 6); streakAlpha = new Float32Array(N * 2);
    streakGeo = new THREE.BufferGeometry();
    streakPosAttr = new THREE.BufferAttribute(streakPos, 3).setUsage(THREE.DynamicDrawUsage);
    streakAlphaAttr = new THREE.BufferAttribute(streakAlpha, 1).setUsage(THREE.DynamicDrawUsage);
    streakGeo.setAttribute('position', streakPosAttr); streakGeo.setAttribute('aAlpha', streakAlphaAttr);
    streakMat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(cfg.dust).multiplyScalar(1.25) }, uNear: dustMat.uniforms.uNear },
      vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false, fog: false });
    const streaks = new THREE.LineSegments(streakGeo, streakMat); streaks.frustumCulled = false; streaks.renderOrder = 9;
    group.add(streaks);
  }

  function spawn(x, y, z, vx, vy, vz, lifeS, sizeM, growM, alpha) {
    const i = cursor; cursor = (cursor + 1) % N;
    if (life[i] <= 0) alive++;
    posArr[i * 3] = x; posArr[i * 3 + 1] = y; posArr[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i] = maxLife[i] = lifeS; size0[i] = sizeM * U; grow[i] = growM * U; peak[i] = alpha;
  }
  function emitBlast(n, lp, groundY, strength, alt) {
    const footprint = (1.2 + alt * 0.18) * U;
    for (let j = 0; j < n; j++) {
      const a = Math.random() * Math.PI * 2, r = footprint * Math.sqrt(Math.random());
      const cx = Math.sin(a), cz = Math.cos(a);
      if (cfg.ballistic) {
        // Moon: fast, flat radial sheet (1–4° above the surface), pure ballistic flight.
        const sp = (22 + 38 * Math.random()) * (0.5 + 0.5 * strength) * U, up = Math.tan((1 + 3 * Math.random()) * Math.PI / 180) * sp;
        spawn(lp.x + cx * r, groundY + 0.03, lp.z + cz * r, cx * sp, up, cz * sp, 1.2 + Math.random() * 1.0, 0.35 + Math.random() * 0.35, 0, cfg.cloudAlpha * (0.5 + 0.5 * Math.random()));
      } else {
        const sp = (5 + 9 * Math.random()) * (0.5 + 0.5 * strength) * U, up = (0.8 + 3 * Math.random()) * U;
        spawn(lp.x + cx * r, groundY + 0.05, lp.z + cz * r, cx * sp, up, cz * sp, 2.5 + Math.random() * 3, 0.8 + 0.6 * Math.random(), 2.5 + Math.random() * 3, cfg.cloudAlpha * (0.6 + 0.4 * Math.random()));
      }
    }
  }
  function emitRing(lp, groundY) {
    const n = reducedMotion ? 250 : 600, r0 = 2.2 * U;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + Math.random() * 0.05, cx = Math.sin(a), cz = Math.cos(a);
      if (cfg.ballistic) {
        const sp = (12 + 14 * Math.random()) * U;
        spawn(lp.x + cx * r0, groundY + 0.03, lp.z + cz * r0, cx * sp, Math.tan(2 * Math.PI / 180) * sp, cz * sp, 1.4 + Math.random() * 0.6, 0.4, 0, cfg.cloudAlpha);
      } else {
        const sp = (4 + 5 * Math.random()) * U;
        spawn(lp.x + cx * r0, groundY + 0.05, lp.z + cz * r0, cx * sp, (0.4 + Math.random()) * U, cz * sp, 2.5 + Math.random() * 2, 1, 2 + Math.random() * 2, cfg.cloudAlpha * 1.2);
      }
    }
  }

  function stepDust(dt, groundY, wind) {
    if (alive === 0) return;
    const g = cfg.gravity * U, wx = num(wind?.x, 0) * U, wz = num(wind?.z, 0) * U;
    const drag = 1 - Math.exp(-1.3 * dt), settle = -0.25 * U;
    let count = 0;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { alphaArr[i] = 0; if (streakAlpha) streakAlpha[i * 2] = streakAlpha[i * 2 + 1] = 0; continue; }
      count++;
      const i3 = i * 3;
      if (cfg.ballistic) {
        vel[i3 + 1] -= g * dt;
        posArr[i3] += vel[i3] * dt; posArr[i3 + 1] += vel[i3 + 1] * dt; posArr[i3 + 2] += vel[i3 + 2] * dt;
        if (posArr[i3 + 1] < groundY) { life[i] = 0; alphaArr[i] = 0; streakAlpha[i * 2] = streakAlpha[i * 2 + 1] = 0; count--; continue; }
      } else {
        // Billowing cloud: velocity relaxes toward the wind, rises briefly then settles.
        vel[i3] += (wx - vel[i3]) * drag; vel[i3 + 2] += (wz - vel[i3 + 2]) * drag;
        vel[i3 + 1] += (settle - vel[i3 + 1]) * drag * 0.6;
        posArr[i3] += vel[i3] * dt; posArr[i3 + 1] += vel[i3 + 1] * dt; posArr[i3 + 2] += vel[i3 + 2] * dt;
        if (posArr[i3 + 1] < groundY + 0.02) { posArr[i3 + 1] = groundY + 0.02; vel[i3 + 1] = 0; }
      }
      const age = 1 - life[i] / maxLife[i];
      alphaArr[i] = peak[i] * smooth(0, 0.08, age) * (1 - smooth(cfg.ballistic ? 0.6 : 0.45, 1, age));
      sizeArr[i] = size0[i] + grow[i] * Math.sqrt(age);
      if (streakPos) {
        const j = i * 6, tail = 0.06; // streak length = 60 ms of flight
        streakPos[j] = posArr[i3]; streakPos[j + 1] = posArr[i3 + 1]; streakPos[j + 2] = posArr[i3 + 2];
        streakPos[j + 3] = posArr[i3] - vel[i3] * tail; streakPos[j + 4] = Math.max(groundY, posArr[i3 + 1] - vel[i3 + 1] * tail); streakPos[j + 5] = posArr[i3 + 2] - vel[i3 + 2] * tail;
        streakAlpha[i * 2] = alphaArr[i]; streakAlpha[i * 2 + 1] = 0;
      }
    }
    alive = count;
    if (streakPos) streakPosAttr.needsUpdate = streakAlphaAttr.needsUpdate = true;
    else posAttr.needsUpdate = alphaAttr.needsUpdate = sizeAttr.needsUpdate = true;
  }

  const tmp = new THREE.Vector3();
  function update(dt, s = {}) {
    const step = clamp(num(dt, 0), 0, 0.1);
    time += step;
    const throttle = clamp(num(s.throttle, 0), 0, 1), alt = Math.max(0, num(s.altitudeM, 0));
    const lp = s.landerPos || { x: 0, y: 0, z: 0 }, groundY = num(s.groundY, 0);
    const phase = s.phase ?? null;
    const firing = throttle > 0.01 && (phase === null || phase === 'descent' || phase === 'preparation');

    // Plumes
    const on = smooth(0.01, 0.12, firing ? throttle : 0);
    for (const e of engines) {
      if (!e.parented) e.root.position.set(lp.x + e.offset.x, lp.y + e.offset.y, lp.z + e.offset.z);
      e.root.getWorldPosition(tmp);
      let len = e.lengthM * U * cfg.len * (0.35 + 0.65 * throttle);
      const toGround = tmp.y - groundY;
      if (toGround > 0) len = Math.min(len, toGround * 1.05); // the jet splashes on the surface
      len = Math.max(len, 0.01);
      const r = e.nozzleR, spread = cfg.wid;
      const inten = cfg.opacity * on * lerp(1, cfg === BODY_FX.moon ? 2.5 : 1.25, 1 - dayFactor);
      e.core.scale.set(r * spread, len, r * spread);
      e.glow.scale.set(r * spread, len * 1.1, r * spread);
      e.core.material.uniforms.uIntensity.value = inten;
      e.glow.material.uniforms.uIntensity.value = inten * 0.45;
      e.core.material.uniforms.uTime.value = e.glow.material.uniforms.uTime.value = time;
      e.core.visible = e.glow.visible = e.spark.visible = on > 0.001;
      // Nozzle halo: soft additive sprite at the exit plane, grows and brightens with throttle.
      e.spark.position.set(0, -r * 0.4, 0); e.spark.scale.setScalar(r * 5.5 * (0.55 + 0.45 * throttle));
      e.spark.material.opacity = clamp(cfg.halo * on * (0.35 + 0.65 * throttle) * lerp(1, 1.4, 1 - dayFactor), 0, 1);
    }

    // Ground light pool under the engines (or under s.sourcePos, e.g. the sky crane stage).
    let sx = lp.x, sy = lp.y, sz = lp.z;
    if (s.sourcePos) { sx = num(s.sourcePos.x, sx); sy = num(s.sourcePos.y, sy); sz = num(s.sourcePos.z, sz); }
    else if (engines.length) {
      sx = sy = sz = 0;
      for (const e of engines) { e.root.getWorldPosition(tmp); sx += tmp.x; sy += tmp.y; sz += tmp.z; }
      sx /= engines.length; sy /= engines.length; sz /= engines.length;
    }
    const above = Math.max(0, sy - groundY), r0 = 2.2 * hw * U;
    const poolR = clamp(r0 + above * 0.6, r0, r0 * 5);
    const poolFade = 1 / (1 + (above / (10 * hw * U)) ** 2);
    poolMat.opacity = clamp((firing ? throttle : 0) * cfg.pool * poolFade * lerp(1, 1.8, 1 - dayFactor), 0, 1);
    pool.visible = poolMat.opacity > 0.003;
    pool.position.set(sx, groundY + 0.05 * hw * U, sz); pool.scale.set(poolR * 2, 1, poolR * 2);

    // Engine light: peak ground irradiance ∝ throttle, fading with altitude.
    const h = clamp(alt * 0.4, 0.8, 4) * U * hw;
    const fade = 1 / (1 + (alt / 15) ** 2);
    light.position.set(lp.x, groundY + Math.min(h, Math.max(0.01, lp.y - groundY)), lp.z);
    light.intensity = (firing ? throttle : 0) * cfg.lightPeak * fade * h * h * lerp(1, 2, 1 - dayFactor);
    light.distance = Math.max(2, h * 10);
    light.visible = light.intensity > 1e-5;

    // Dust blast
    if (firing && alt < cfg.dustBelowM) {
      const strength = throttle * Math.pow(1 - alt / cfg.dustBelowM, 0.7);
      const rate = (cfg.ballistic ? 1500 : 450) * strength * (reducedMotion ? 0.5 : 1);
      emitAcc += rate * step;
      const n = Math.floor(emitAcc); emitAcc -= n;
      if (n > 0) { emitBlast(n, lp, groundY, strength, alt); alive = Math.min(N, alive); }
    } else emitAcc = 0;

    // Touchdown ring burst (explicit flag or phase change into contact)
    const contactNow = phase === 'contact' || phase === 'hard-contact';
    if ((s.touchdown || (contactNow && lastPhase !== phase && !(lastPhase === 'contact' || lastPhase === 'hard-contact'))) && !burstDone) { emitRing(lp, groundY); burstDone = true; }
    if (phase === 'ready' || phase === 'preparation' || phase === 'descent') burstDone = false;
    lastPhase = phase;

    stepDust(step, groundY, s.wind);
  }

  function dispose() {
    clearEngines(); coreGeo.dispose(); glowGeo.dispose(); glowTex.dispose(); streakGeo?.dispose(); streakMat?.dispose(); poolGeo.dispose(); poolMat.dispose();
    dustGeo.dispose(); dustMat.dispose(); light.dispose?.();
    group.removeFromParent();
  }

  return { group, setEngines, update, dispose, setDaylight(v) { dayFactor = clamp(Number(v), 0, 1); },
    get particleBudget() { return N; }, get aliveParticles() { return alive; } };
}
