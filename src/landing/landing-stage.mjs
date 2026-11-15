// Landing stage (M5): swaps the schematic lander for the real visual per body and drives the
// cinematic camera and effects from the existing landing run state. Physics is untouched.
// - Moon: NASA Apollo Lunar Module GLB (lander-visual.mjs); rover deployment by ramp is conceptual.
// - Mars: Mars 2020 sky crane (skycrane-visual.mjs), loaded lazily; schematic fallback until ready.
import * as THREE from '../../assets/vendor/three.module.min.js';
import { GLTFLoader } from '../../assets/vendor/GLTFLoader.js';
import { createLunarLander, createSchematicLanderFallback } from './lander-visual.mjs';
import { createLandingFx, createCameraRig, createPhaseClock, directShot, legCompression } from './landing-cinematic.mjs';
import { createSkyCrane, STOW_HEIGHT_M, BRIDLE_MAX_M } from './skycrane-visual.mjs';

const CONTACT_PHASES = new Set(['contact', 'hard-contact']);
/**
 * Hardware drawing scale for landers, the sky crane and the rover it carries. It matches mission.js
 * ROVER_SCALE (the exploration rover is drawn ×14 so it reads on a 2.4 km window), so the delivered rover
 * is never bigger than the vehicle that brought it. Altitudes and physics stay at 1×.
 */
export const LANDER_VISUAL_SCALE = 14;
const VISUAL_SCALE = LANDER_VISUAL_SCALE;
// Camera distance factor for directShot's 1× metres: 0.6 × the hardware scale, so the drawn vehicle fills
// the same share of the frame as before. Distances are capped so wide shots stay inside the DEM window.
const FRAME_SCALE = 0.6 * VISUAL_SCALE;
const MAX_FRAME_DISTANCE_M = 800;
// Descent stage top above its frame bottom (tanks), real metres (skycrane-visual.mjs geometry).
const STAGE_TOP_M = 1.3;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Cheap reflection environment so metallic foil reads gold instead of dark brown (no PMREM scene needed:
// Three.js converts an equirectangular envMap for standard materials internally).
const ENV_COLORS = { moon: [[0.02, 0.02, 0.03], [0.35, 0.35, 0.36], [0.16, 0.15, 0.14]],
  mars: [[0.55, 0.38, 0.24], [0.78, 0.6, 0.42], [0.32, 0.18, 0.1]],
  earth: [[0.35, 0.52, 0.78], [0.8, 0.82, 0.84], [0.3, 0.26, 0.2]] };
function makeEnvMap(body) {
  const [top, horizon, ground] = ENV_COLORS[body] || ENV_COLORS.earth;
  const w = 64, h = 32, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1); // 0 = top
    const c = t < 0.5 ? top.map((v, i) => v + (horizon[i] - v) * (t / 0.5)) : horizon.map((v, i) => v + (ground[i] - v) * ((t - 0.5) / 0.5));
    for (let x = 0; x < w; x++) data.set([...c.map((v) => Math.round(Math.min(1, v) * 255)), 255], (y * w + x) * 4);
  }
  const tex = new THREE.DataTexture(data, w, h);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const ROVER_URL = 'assets/models/nasa/perseverance.glb';
const ROVER_LENGTH_M = 3.0;
const ROVER_HEIGHT_M = 2.2; // Perseverance mast-top height, used to frame the rover after the sky crane leaves
const SKY_CRANE_CUT_HOLD_S = 2.0;
// Perseverance hung under the sky crane: same NASA GLB as the exploration rover, origin at the wheel contacts.
async function loadSkyCraneRover(U) {
  const gltf = await new GLTFLoader().loadAsync(ROVER_URL);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const scale = (ROVER_LENGTH_M * VISUAL_SCALE * U) / Math.max(size.x, size.z);
  const wrapper = new THREE.Group();
  model.position.set(-center.x, -box.min.y, -center.z);
  wrapper.add(model);
  wrapper.scale.setScalar(scale);
  wrapper.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return wrapper;
}

function clearChildren(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse?.((o) => { o.geometry?.dispose?.(); });
  }
}

/**
 * @param layer landing-view layer ({ lander, shadow, terrain, ground, U })
 * @param options { body: 'moon'|'mars'|'earth' }
 */
export function createLandingStage(layer, { body }) {
  const U = layer.U;
  const holder = layer.lander;
  const env = makeEnvMap(body);
  const fx = createLandingFx(THREE, layer.terrain.scene, { body, U, reducedMotion: reducedMotion.matches, visualScale: VISUAL_SCALE });
  const rig = createCameraRig(THREE, { U, aimHeightM: 0 }); // the aim point is computed here (vehicle centre)
  const clock = createPhaseClock();
  const state = { body, model: null, kind: 'schematic', disposed: false, lastT: null, contactAt: null, contactSpeed: 0,
    lastPhase: null, shot: null, skycrane: null, focus: new THREE.Vector3(), focusReady: false, camT: null, anchorVy: 0, lastAnchorY: 0,
    user: { azDeg: 0, elevation: 0, zoom: 1 } };
  const anchor = new THREE.Vector3(), aim = new THREE.Vector3(), stageWorld = new THREE.Vector3();

  function useModel(model) {
    clearChildren(holder);
    holder.add(model.group);
    model.group.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m && 'envMap' in m && (m.metalness ?? 0) > 0.4) { m.envMap = env; m.envMapIntensity = 0.9; m.needsUpdate = true; }
      }
    });
    state.model = model;
    state.kind = model.kind || 'schematic';
    // Plume sizes follow the drawn hardware (×VISUAL_SCALE); the jet is still clipped at the ground.
    const engines = model.enginesLocal ? model.enginesLocal.map((e) => ({ position: e.position, axis: e.axis, nozzleRadiusM: 0.25 * VISUAL_SCALE / 6, lengthM: 6 * VISUAL_SCALE / 6 }))
      : [{ position: model.nozzleLocal, axis: model.nozzleAxisLocal, nozzleRadiusM: 0.7 * VISUAL_SCALE / 6, lengthM: 9 * VISUAL_SCALE / 6 }];
    fx.setEngines(engines, holder);
  }

  useModel(createSchematicLanderFallback(THREE, { unitsPerMeter: U, visualScale: VISUAL_SCALE }));
  if (body === 'moon') {
    createLunarLander(THREE, { loader: new GLTFLoader(), unitsPerMeter: U, visualScale: VISUAL_SCALE })
      .then((model) => { if (!state.disposed) useModel(model); })
      .catch((error) => console.warn('Apollo LM model unavailable; schematic lander kept.', error));
  } else if (body === 'mars') {
    // Mars 2020 delivery: powered descent stage lowers Perseverance on bridles, cuts them and flies away.
    const sky = createSkyCrane(THREE, { unitsPerMeter: U, visualScale: VISUAL_SCALE });
    state.skycrane = sky;
    useModel({ group: sky.group, kind: 'skycrane', enginesLocal: [] }); // the stage carries its own plumes
    loadSkyCraneRover(U).then((rover) => { if (!state.disposed) sky.attachRover(rover); })
      .catch((error) => console.warn('Perseverance model unavailable for the sky crane.', error));
  }

  /** Per-frame visual update; call after landing-view positions the lander. */
  function update(view, run, profile, wind = { x: 0, z: 0 }) {
    const now = performance.now() / 1000;
    const dt = state.lastT === null ? 0 : Math.min(0.1, now - state.lastT);
    state.lastT = now;
    const phase = view.phase;
    if (CONTACT_PHASES.has(phase) && !CONTACT_PHASES.has(state.lastPhase)) {
      state.contactAt = now;
      state.contactSpeed = Math.abs(run?.contact?.verticalSpeedMs ?? run?.vyMs ?? 1);
    }
    if (!CONTACT_PHASES.has(phase) && phase !== 'deployment' && phase !== 'exploration') state.contactAt = null;
    if ((phase === 'ready' || phase === 'preparation') && state.lastPhase !== phase) state.user = { azDeg: 0, elevation: 0, zoom: 1 };
    state.lastPhase = phase;
    const throttle = phase === 'descent' && run ? Math.min(1, Math.max(0, (run.thrustN || 0) / (profile?.thrustMaxN || 1))) : 0;
    const timeScale = state.shot?.timeScale ?? 1;
    if (run && Number.isFinite(run.x) && Number.isFinite(run.z)) {
      const groundY = layer.ground(run.x, run.z);
      let sourcePos;
      if (state.skycrane) {
        // The sky crane tilts only its stage; the rover hangs plumb and lands at the physics touchdown point.
        holder.rotation.set(0, 0, 0);
        state.skycrane.update(dt * timeScale, { altitudeM: run.altitudeM, vyMs: run.vyMs, thrustN: run.thrustN, throttle, phase,
          touchdown: state.contactAt !== null, reducedMotion: reducedMotion.matches, pitchDeg: run.pitchDeg, rollDeg: run.rollDeg });
        // once the exploration rover takes over, hide the delivered copy so there is never two
        state.skycrane.roverMount.visible = phase !== 'deployment' && phase !== 'exploration';
        holder.updateMatrixWorld(true);
        sourcePos = state.skycrane.stage.getWorldPosition(stageWorld); // engines ride on the stage, above the display lift
      }
      // Camera target: the drawn vehicle origin (sky crane: rover plus display lift) before the touchdown bounce,
      // low-pass filtered so physics steps never reach the frame.
      anchor.copy(holder.position); if (state.skycrane) anchor.y += state.skycrane.rig.position.y;
      if (!state.focusReady || dt === 0) { state.focus.copy(anchor); state.focusReady = true; state.anchorVy = 0; }
      else {
        // The lowering rig drops several times faster than the 1× altitude (display lift): track its vertical speed
        // so the camera can lead it instead of trailing the rover out of the frame.
        const vy = (anchor.y - state.lastAnchorY) / Math.max(1e-3, dt);
        state.anchorVy += (vy - state.anchorVy) * (1 - Math.exp(-dt / 0.25));
        state.focus.lerp(anchor, 1 - Math.exp(-dt / 0.12));
      }
      state.lastAnchorY = anchor.y;
      if (!state.skycrane && state.contactAt !== null && !reducedMotion.matches) holder.position.y -= legCompression(now - state.contactAt, state.contactSpeed) * U;
      fx.update(dt * timeScale, { throttle, altitudeM: run.altitudeM ?? 0, groundY, landerPos: holder.position, wind, phase, touchdown: false, sourcePos });
    } else fx.update(dt, { throttle: 0, altitudeM: 1e4, groundY: 0, landerPos: holder.position, wind, phase, touchdown: false });
    return { throttle, timeScale };
  }

  /** Vertical extent of the drawn sky crane rig (rover origin → stage top), real metres; 0 when not a sky crane. */
  function rigSpanRealM() {
    const plan = state.skycrane?.plan; if (!plan) return 0;
    if (state.contactAt !== null) {
      // Keep the hang framing through the bridle cut (≈2 s) so the cut and liftoff read; then frame the
      // delivered rover, otherwise the camera aims at the empty midpoint of a rig that has flown away.
      if (performance.now() / 1000 - state.contactAt > SKY_CRANE_CUT_HOLD_S) return ROVER_HEIGHT_M;
      return STOW_HEIGHT_M + BRIDLE_MAX_M + STAGE_TOP_M;
    }
    return plan.stageOffsetM + STAGE_TOP_M;
  }

  /** Cinematic camera; returns false when the director hands control back (free shot). */
  function applyCamera(cam, view, run, sunAzimuthDeg = 0) {
    if (!run || !Number.isFinite(run.x)) return false;
    const now = performance.now() / 1000;
    const spanM = rigSpanRealM() * VISUAL_SCALE; // drawn metres
    const shot = directShot({ phase: view.phase, altitudeM: run.altitudeM ?? 0,
      horizontalSpeedMs: Math.hypot(run.vxMs || 0, run.vzMs || 0), tSincePhase: clock(view.phase, now),
      body: state.body, reducedMotion: reducedMotion.matches, sunAzimuthDeg, rigSpanM: spanM / FRAME_SCALE });
    state.shot = shot;
    // directShot speaks 1× metres; the vehicle is drawn ×VISUAL_SCALE, so distances and camera offsets from the
    // vehicle scale by FRAME_SCALE. Shot heights are «altitude + offset»: only the offset scales, the altitude
    // stays the drawn altitude of the vehicle origin (which includes the sky crane display lift).
    const u = state.user, focus = state.focusReady ? state.focus : holder.position;
    // Sky crane: lead the fast-dropping rig by the camera's smoothing lag (≈ 0.45 s), bounded to a fraction of the rig.
    const lead = state.skycrane && !reducedMotion.matches ? Math.max(-0.2 * spanM * U, Math.min(0.2 * spanM * U, state.anchorVy * 0.45)) : 0;
    const alt = Math.max(0, run.altitudeM ?? 0), drawnAlt = Math.max(0, (focus.y + lead - layer.ground(run.x, run.z)) / U);
    const distanceM = Math.min(MAX_FRAME_DISTANCE_M, shot.distanceM * FRAME_SCALE) * u.zoom;
    const heightM = Math.max(0.6, drawnAlt + (shot.heightM - alt) * FRAME_SCALE * u.zoom + u.elevation * distanceM);
    const framed = { ...shot, distanceM, heightM, lookAheadM: (shot.lookAheadM || 0) * FRAME_SCALE, azimuthDeg: shot.azimuthDeg + u.azDeg };
    // Aim at the middle of the drawn vehicle: the sky crane rig (rover → stage) or the lander body.
    const aimUp = state.skycrane ? spanM * U * 0.5 : (state.model?.heightLocal ?? 0) * 0.45;
    aim.copy(focus); aim.y += aimUp + lead;
    const throttle = view.phase === 'descent' ? Math.min(1, (run.thrustN || 0) / ((view.profiles?.target?.thrustMaxN) || 1)) : 0;
    const dt = state.camT === null ? 0.016 : Math.min(0.1, now - state.camT);
    state.camT = now;
    return rig.apply(cam, framed, { position: aim, throttle, vxMs: run.vxMs || 0, vzMs: run.vzMs || 0 }, layer.ground, dt);
  }

  /** Manual control on top of the director: drag orbits, wheel zooms. */
  function userOrbit(dxPx, dyPx) {
    state.user.azDeg -= dxPx * 0.35;
    state.user.elevation = Math.min(1.2, Math.max(-0.25, state.user.elevation - dyPx * 0.004));
  }
  function userZoom(factor) { state.user.zoom = Math.min(3, Math.max(0.35, state.user.zoom * factor)); }
  function resetUser() { state.user = { azDeg: 0, elevation: 0, zoom: 1 }; }

  function setDaylight(sunElevationDeg) { fx.setDaylight(sunElevationDeg > 0 ? 1 : 0); }

  function dispose() {
    state.disposed = true;
    fx.dispose();
    state.skycrane?.dispose?.();
    env.dispose();
  }

  return { update, applyCamera, userOrbit, userZoom, resetUser, setDaylight, dispose, get kind() { return state.kind; }, get body() { return state.body; }, get timeScale() { return state.shot?.timeScale ?? 1; } };
}
