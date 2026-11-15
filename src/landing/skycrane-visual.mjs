// Mars 2020 «sky crane» visual layer for the landing scene. Browser and node module without DOM; it
// receives THREE from the caller so it shares mission.js's copy (assets/vendor/three.module.min.js).
//
// Honesty: this is a VISUAL layer driven by the generic powered-descent state of landing-physics.mjs.
// It does not change the physics, and the physics is not the real Mars 2020 EDL. NASA publishes no 3D
// model of the descent stage, so the geometry below is a procedural approximation built from public
// imagery and the facts cited here (kind: modelled). Timeline numbers come from these pages
// (accessed 2026-11-15):
//
//  [JPL-EDL]  https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/
//             Mars 2020 landing press kit, EDL: sky crane starts «65 feet (20 meters) over the landing
//             area»; «Nylon cords spool out to lower the rover 25 feet (7.6 meters) below the descent
//             stage»; speed «1.7 mph (2.7 kph)» (≈ 0.75 m/s) at ~20 m; on touchdown «pyrotechnically fired
//             blades sever the cords» and «the descent stage flies a safe distance away before impacting».
//  [JPL-SC]   https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/getting_to_mars/
//             «a kind of jetpack with eight engines»; winches Perseverance down «with nylon cords».
//  [PIA24318] https://www.jpl.nasa.gov/images/pia24318-powered-descent-for-perseverance-illustration/
//             «eight throttleable retrorockets, or Mars landing engines»; caption quotes cables «about
//             21 feet (6.4 meters) long» (the press kit's 7.6 m is rover-below-stage distance; we use 7.6 m).
//  [TPS-MSL]  https://www.planetary.org/articles/07060700-how-curiosity-land-part-3
//             Same sky crane design (Curiosity): constant 0.75 m/s descent; 7.5 m spool unwinds in ~7 s;
//             mobility (legs and wheels) deploys in two steps as the spool plays out; rover confirms
//             touchdown over ~1 s; pyro cutters at the rover end; the stage holds altitude 187 ms, throttles
//             up, climbs, pitches to 45°, fixed-time burn, crashes «at least 150 meters away»; engines are
//             «canted outwards».
//
// Frames: the caller places `group` at the physics run point (x, ground + altitudeM·U, z) and does NOT
// rotate it. The group origin is the rover's wheel-contact point, so the rover ends on the ground exactly
// at the physics touchdown point. The stage hovers above it (visual only). Lengths drawn are real metres ×
// unitsPerMeter × visualScale, so stage, bridles and flyaway keep their true proportions to each other.

// ---- real timeline values (sources above)
export const SKY_CRANE_START_M = 20;          // [JPL-EDL]
export const BRIDLE_MAX_M = 7.6;              // [JPL-EDL] rover 7.6 m below the stage at full extension
export const SKY_CRANE_DESCENT_MS = 0.75;     // [JPL-EDL] 1.7 mph; [TPS-MSL] 0.75 m/s held constant
export const SPOOL_TIME_S = 7;                // [TPS-MSL] spool unwinds in ~7 s (MSL; same design)
export const TOUCHDOWN_CONFIRM_S = 1;         // [TPS-MSL] rover checks the reduced-force signal ~1 s
export const CUT_HOLD_S = 0.187;              // [TPS-MSL] stage holds altitude 187 ms after the cut
export const FLYAWAY_PITCH_DEG = 45;          // [TPS-MSL]
export const FLYAWAY_MIN_DISTANCE_M = 150;    // [TPS-MSL] crash at least 150 m away
// ---- modelled values (no published figure; chosen to read clearly)
export const FLYAWAY_DURATION_S = 5;          // visual compression of the real, longer flyaway
export const FLYAWAY_DISTANCE_M = 180;        // ≥ FLYAWAY_MIN_DISTANCE_M
export const FLYAWAY_PEAK_M = 40;             // shape factor for the climb-then-dive arc
export const STOW_HEIGHT_M = 2.4;             // stage frame bottom above the rover origin while stowed
export const ROVER_DECK_M = 1.1;              // bridle attach height on the rover deck
const SPOOL_RATE_MS = BRIDLE_MAX_M / SPOOL_TIME_S;
/** Bridle metres paid out per metre of rover altitude lost: spool / (spool + stage descent rate). */
export const LOWER_RATIO = SPOOL_RATE_MS / (SPOOL_RATE_MS + SKY_CRANE_DESCENT_MS);
/** Rover altitude at which the bridles reach full length (≈ 7.1 m). */
export const BRIDLE_FULL_ALT_M = SKY_CRANE_START_M - BRIDLE_MAX_M / LOWER_RATIO;
const BRIDLE_RETRACT_S = 0.5, PYRO_FLASH_S = 0.3, BURN_FRACTION = 0.75;
const FLYAWAY_START_S = TOUCHDOWN_CONFIRM_S + CUT_HOLD_S;
export const SKY_CRANE_PHASES = Object.freeze(['powered', 'lowering', 'touchdown', 'cut', 'flyaway', 'complete']);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const finite = Number.isFinite;

/**
 * Pure sky crane timeline. Before touchdown it is a function of rover altitude; after touchdown, of time.
 * Returns metres/degrees/0..1 fractions:
 *  - roverOffsetM: distance from the stage frame bottom down to the rover origin while attached
 *    (STOW_HEIGHT_M + bridleLengthM); after the cut it is the frozen value at the cut.
 *  - bridleLengthM: bridle paid out beyond the stowed position, clamped to [0, BRIDLE_MAX_M]; after the cut
 *    it is the retracting length (the spool spring rewinds the cut cords, [TPS-MSL]).
 *  - stageOffsetM: stage frame bottom height above the rover origin (= ground after touchdown).
 *  - stageForwardM: horizontal flyaway distance along the flyaway heading.
 *  - stagePitchDeg: flyaway tilt toward the heading (0 before the flyaway).
 *  - wheelDeploy, throttle (null = follow the physics), pyro (flash 0..1), stageVisible, attached.
 */
export function skyCranePlan({ altitudeM, touchdown = false, tSinceTouchdown = 0 } = {}) {
  const deployAt = alt => clamp((SKY_CRANE_START_M - alt) * LOWER_RATIO, 0, BRIDLE_MAX_M);
  const wheelsFor = bridle => smooth(0.15, 0.85, bridle / BRIDLE_MAX_M);
  if (!touchdown) {
    const alt = finite(altitudeM) ? Math.max(0, altitudeM) : Infinity;
    const bridle = finite(alt) ? deployAt(alt) : 0;
    return { phase: alt <= SKY_CRANE_START_M ? 'lowering' : 'powered', roverOffsetM: STOW_HEIGHT_M + bridle,
      bridleLengthM: bridle, stageOffsetM: STOW_HEIGHT_M + bridle, stageForwardM: 0, stagePitchDeg: 0,
      wheelDeploy: wheelsFor(bridle), throttle: null, pyro: 0, stageVisible: true, attached: true };
  }
  const t = finite(tSinceTouchdown) ? Math.max(0, tSinceTouchdown) : 0;
  const hang = STOW_HEIGHT_M + BRIDLE_MAX_M; // touchdown always happens at full extension in this layer
  const base = { roverOffsetM: hang, stageForwardM: 0, stagePitchDeg: 0, wheelDeploy: 1, pyro: 0, stageVisible: true };
  if (t < TOUCHDOWN_CONFIRM_S) return { ...base, phase: 'touchdown', bridleLengthM: BRIDLE_MAX_M, stageOffsetM: hang, throttle: null, attached: true };
  const sinceCut = t - TOUCHDOWN_CONFIRM_S;
  const bridle = BRIDLE_MAX_M * (1 - smooth(0, BRIDLE_RETRACT_S, sinceCut));
  const pyro = Math.max(0, 1 - sinceCut / PYRO_FLASH_S);
  if (t < FLYAWAY_START_S) return { ...base, phase: 'cut', bridleLengthM: bridle, stageOffsetM: hang, throttle: null, pyro, attached: false };
  const tf = t - FLYAWAY_START_S, u = clamp(tf / FLYAWAY_DURATION_S, 0, 1);
  if (u >= 1) return { ...base, phase: 'complete', bridleLengthM: 0, stageOffsetM: 0, stageForwardM: FLYAWAY_DISTANCE_M,
    stagePitchDeg: FLYAWAY_PITCH_DEG, throttle: 0, stageVisible: false, attached: false };
  // Climb-then-dive arc reaching the ground (0) at u = 1; horizontal motion accelerates (u²) after the
  // vertical climb; pitch ramps to 45° over ~1 s after a short vertical rise ([TPS-MSL] sequence).
  const height = (1 - u) * (hang + 2.5 * FLYAWAY_PEAK_M * u);
  const forward = FLYAWAY_DISTANCE_M * u * u;
  const pitch = FLYAWAY_PITCH_DEG * smooth(0.5, 1.5, tf);
  return { ...base, phase: 'flyaway', bridleLengthM: bridle, stageOffsetM: height, stageForwardM: forward,
    stagePitchDeg: pitch, throttle: u < BURN_FRACTION ? 1 : 0, pyro, attached: false };
}

/** Seconds of visual timeline after touchdown until the stage has crashed. */
export const SKY_CRANE_TOTAL_S = FLYAWAY_START_S + FLYAWAY_DURATION_S;

/**
 * Extra display height (real metres, multiply by unitsPerMeter) added to the whole rig before touchdown.
 * Why: the scene draws altitude at 1× (altitudeM·U) but the hardware at visualScale×. Without this, a
 * 7.6 m × visualScale bridle paying out over 13 m of 1× altitude would make the stage visibly CLIMB while
 * the rover is lowered. Inside the lowering band the rig descends k× faster (k > visualScale·LOWER_RATIO,
 * so the stage keeps descending), and above 20 m the lift tapers out at half rate, so it is 0 at touchdown
 * and far above the sky crane altitude. Visual only (kind: modelled); the physics state is untouched.
 */
export function skyCraneDisplayLiftM(altitudeM, visualScale = 6) {
  if (!finite(altitudeM) || altitudeM <= BRIDLE_FULL_ALT_M) return 0;
  const k = Math.max(1, visualScale * LOWER_RATIO * 1.15);
  const band = SKY_CRANE_START_M - BRIDLE_FULL_ALT_M, offset = (k - 1) * band;
  if (altitudeM <= SKY_CRANE_START_M) return (k - 1) * (altitudeM - BRIDLE_FULL_ALT_M);
  return Math.max(0, offset - 0.5 * (altitudeM - SKY_CRANE_START_M));
}

/**
 * Procedural Mars 2020 descent stage + bridles + rover mount.
 * update(dt, input) with input = { altitudeM, vyMs, thrustN, throttle, phase, touchdown, reducedMotion,
 * pitchDeg?, rollDeg? } (pitch/roll tilt only the stage while attached, like landing-view's lander).
 */
export function createSkyCrane(THREE, { unitsPerMeter = 0.1, visualScale = 6, roverObject = null, flyawayHeadingRad = 0 } = {}) {
  const s = unitsPerMeter * visualScale; // scene units per real metre, as drawn
  const owned = new Set(); // geometries/materials to dispose (never the rover's)
  const own = x => (owned.add(x), x);
  const std = (color, roughness, metalness, extra = {}) => own(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
  // Metalness is kept moderate: the landing scenes have no environment map, and fully metallic PBR
  // surfaces render black without one.
  const M = {
    frame: std(0x55595f, 0.6, 0.35),
    frameLight: std(0x80858c, 0.55, 0.4),
    gold: std(0xd9a441, 0.38, 0.55, { emissive: 0x3a2400, emissiveIntensity: 0.35 }),
    white: std(0xeceae4, 0.85, 0.0),
    bell: std(0xa3a7ad, 0.35, 0.6),
    bellInner: std(0x2a2b2e, 0.7, 0.3, { side: THREE.DoubleSide }),
    tank: own(new THREE.MeshPhysicalMaterial({ color: 0xd2d5da, roughness: 0.3, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15 })),
    radar: std(0xdedcd5, 0.6, 0.1),
    bridle: std(0xf2efe6, 0.9, 0.0),
    umbilical: std(0x2c2e31, 0.7, 0.2),
  };
  const box = (w, h, d) => own(new THREE.BoxGeometry(w, h, d));
  const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const beam = (parent, a, b, r, material) => { // cylinder between two points (metres, stage-local)
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const m = mesh(own(new THREE.CylinderGeometry(r, r, d.length(), 6)), material, parent);
    m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
  };

  const group = new THREE.Group(); group.name = 'skycrane';
  const rig = new THREE.Group(); rig.name = 'skycrane-rig'; group.add(rig); // carries the display lift
  const stage = new THREE.Group(); stage.name = 'descent-stage'; stage.scale.setScalar(s); // children in metres
  rig.add(stage);

  // Main structure: a ~2.8 m octagonal ring truss (modelled from imagery) with a central deck.
  const R = 1.35, H = 0.55;
  const ring = [];
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4; ring.push([Math.cos(a) * R, Math.sin(a) * R]); }
  for (let i = 0; i < 8; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % 8];
    beam(stage, [x0, 0.05, z0], [x1, 0.05, z1], 0.06, M.frame);
    beam(stage, [x0, H, z0], [x1, H, z1], 0.05, M.frame);
    beam(stage, [x0, 0.05, z0], [x0, H, z0], 0.045, M.frameLight);
    beam(stage, [x0, 0.05, z0], [x1, H, z1], 0.03, M.frameLight); // diagonal bracing
  }
  // Gold blanket side panels on alternate frame bays (illustrative; the real stage is wrapped in gold and
  // white multilayer insulation in a more irregular pattern).
  for (let i = 1; i < 8; i += 2) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % 8], w = Math.hypot(x1 - x0, z1 - z0);
    const panel = mesh(box(w * 0.92, H * 0.8, 0.04), M.gold, stage, (x0 + x1) / 2 * 0.97, H / 2 + 0.03, (z0 + z1) / 2 * 0.97);
    panel.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  }
  for (let i = 0; i < 4; i++) { const [x, z] = ring[i]; beam(stage, [x, 0.1, z], [-x, 0.1, -z], 0.05, M.frame); }
  const deck = mesh(own(new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.08, 8)), M.white, stage, 0, H * 0.55, 0); deck.rotation.y = Math.PI / 8;
  // Gold thermal blanket wedges on the deck (illustrative layout).
  for (let i = 0; i < 4; i++) {
    const p = mesh(box(0.9, 0.06, 0.55), M.gold, stage, Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.75, H * 0.55 + 0.07, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.75);
    p.rotation.y = -(i * Math.PI / 2 + Math.PI / 4);
  }
  // Three spherical propellant tanks and two smaller pressurant spheres (approximate, from imagery).
  for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3 + Math.PI / 6; mesh(own(new THREE.SphereGeometry(0.42, 24, 16)), M.tank, stage, Math.cos(a) * 0.7, H + 0.32, Math.sin(a) * 0.7); }
  for (const a of [Math.PI / 2 + 0.9, -Math.PI / 2 - 0.9]) mesh(own(new THREE.SphereGeometry(0.24, 18, 12)), M.tank, stage, Math.cos(a) * 1.0, H + 0.18, Math.sin(a) * 1.0);
  // Electronics boxes wrapped in white blanket.
  mesh(box(0.55, 0.3, 0.4), M.white, stage, 0, H + 0.2, 0);
  // Eight Mars Landing Engines in four corner pairs on outriggers, canted outward ([PIA24318], [TPS-MSL]).
  const CANT = 20 * Math.PI / 180; // modelled; the real cant angle is not given in the cited pages
  const bellGeom = own(new THREE.CylinderGeometry(0.07, 0.17, 0.42, 18, 1, true)), bellInnerGeom = own(new THREE.CylinderGeometry(0.065, 0.16, 0.4, 18, 1, true));
  const chamberGeom = own(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 12));
  const plumeGeom = own(new THREE.ConeGeometry(0.15, 1, 16, 1, true)); plumeGeom.translate(0, -0.5, 0);
  const plumeMat = own(new THREE.MeshBasicMaterial({ color: 0xffe2bf, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  // Soft additive halo at each nozzle exit (illustrative glow, scaled by throttle; no post-processing).
  const haloTex = own((() => {
    const n = 64, data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2), i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(Math.pow(clamp(1 - d, 0, 1), 2.4) * 255);
    }
    const tex = new THREE.DataTexture(data, n, n); tex.needsUpdate = true; return tex;
  })());
  const haloMat = own(new THREE.SpriteMaterial({ map: haloTex, color: 0xffd2a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const engines = [], plumes = [], halos = [], enginesLocal = [];
  for (let c = 0; c < 4; c++) {
    const ca = c * Math.PI / 2 + Math.PI / 4;
    beam(stage, [Math.cos(ca) * R * 0.9, 0.08, Math.sin(ca) * R * 0.9], [Math.cos(ca) * (R + 0.35), 0.0, Math.sin(ca) * (R + 0.35)], 0.06, M.frame);
    for (const off of [-0.17, 0.17]) {
      const a = ca + off, r = R + 0.32, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const out = new THREE.Vector3(Math.cos(ca), 0, Math.sin(ca));
      const axis = new THREE.Vector3(0, -1, 0).applyAxisAngle(new THREE.Vector3(-out.z, 0, out.x), CANT).normalize(); // exhaust direction, tilted outward
      const eng = new THREE.Group(); eng.position.set(x, -0.05, z); eng.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis); stage.add(eng);
      mesh(chamberGeom, M.frameLight, eng, 0, 0.0, 0);
      const bell = mesh(bellGeom, M.bell, eng, 0, -0.3, 0); bell.rotation.x = Math.PI; // narrow end up
      const inner = mesh(bellInnerGeom, M.bellInner, eng, 0, -0.3, 0); inner.rotation.x = Math.PI;
      const plume = new THREE.Mesh(plumeGeom, plumeMat); plume.position.y = -0.5; plume.renderOrder = 2; eng.add(plume);
      const halo = new THREE.Sprite(haloMat); halo.position.y = -0.52; halo.renderOrder = 3; halo.visible = false; eng.add(halo);
      engines.push(eng); plumes.push(plume); halos.push(halo);
      enginesLocal.push({ position: new THREE.Vector3(x, -0.05, z).addScaledVector(axis, 0.5).multiplyScalar(s), axis: axis.clone() });
    }
  }
  // Landing radar (Terminal Descent Sensor): six small antennas on a tilted bracket (modelled layout).
  const radar = new THREE.Group(); radar.position.set(0, 0.1, -R - 0.1); radar.rotation.x = -0.45; stage.add(radar);
  mesh(box(0.9, 0.06, 0.4), M.frame, radar, 0, 0, 0);
  for (let i = 0; i < 6; i++) { const d = mesh(own(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16)), M.radar, radar, (i % 3 - 1) * 0.28, -0.05, (Math.floor(i / 3) - 0.5) * 0.2); d.rotation.x = 0; }
  // Bridle Umbilical Device (spool) under the deck centre.
  mesh(own(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 16)), M.frameLight, stage, 0, -0.08, 0).rotation.z = Math.PI / 2;
  const budLocal = new THREE.Vector3(0, -0.2, 0);

  // Rover mount at the group origin (wheel-contact point).
  const roverMount = new THREE.Group(); roverMount.name = 'rover-mount'; rig.add(roverMount);
  // Three bridles + one umbilical, drawn in group units between the BUD and rover deck points.
  const roverPoints = [[0, ROVER_DECK_M, -0.8], [-0.7, ROVER_DECK_M, 0.5], [0.7, ROVER_DECK_M, 0.5]];
  const lineGeom = own(new THREE.CylinderGeometry(1, 1, 1, 5)); lineGeom.translate(0, 0.5, 0);
  const bridles = new THREE.Group(); bridles.name = 'bridles'; rig.add(bridles);
  const lines = [...roverPoints, [0.15, ROVER_DECK_M, 0]].map((p, i) => {
    const m = new THREE.Mesh(lineGeom, i < 3 ? M.bridle : M.umbilical); m.castShadow = true; bridles.add(m);
    return { mesh: m, bottom: new THREE.Vector3(...p).multiplyScalar(s), radius: (i < 3 ? 0.035 : 0.025) * s };
  });
  const flashMat = own(new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const flashGeom = own(new THREE.SphereGeometry(0.3 * s, 12, 8));
  // Pyro cutters sit at the rover end of the bridles ([TPS-MSL]), so the flash is drawn there.
  const flashes = lines.map(l => { const f = new THREE.Mesh(flashGeom, flashMat); f.position.copy(l.bottom); f.visible = false; rig.add(f); return f; });

  const heading = new THREE.Vector3(Math.cos(flyawayHeadingRad), 0, Math.sin(flyawayHeadingRad));
  const pitchAxis = new THREE.Vector3(0, 1, 0).cross(heading).normalize();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const qTilt = new THREE.Quaternion(), qFly = new THREE.Quaternion(), euler = new THREE.Euler();
  let lift = 0, wheels = [], tSinceTouchdown = 0, touched = false, plan = skyCranePlan({}), crashPoint = null, tilt = { p: 0, r: 0 };

  function attachRover(obj) {
    for (const w of wheels) if (w.node.parent) w.node.position.copy(w.base);
    roverMount.clear(); wheels = [];
    if (!obj) return;
    roverMount.add(obj);
    obj.traverse(node => {
      const info = node.userData?.wheel; if (!info) return;
      const radius = info.localRadius ?? info.radius ?? 0;
      wheels.push({ node, base: node.position.clone(), lift: radius * 0.9, tuck: radius * 0.6 * Math.sign(node.position.x || 1) });
    });
  }
  function applyWheels(f) {
    // Stowed wheels are lifted and tucked in; they unfold as the bridles pay out ([TPS-MSL], two-step
    // deployment simplified to one smooth motion). Works on mission.js wheel pivots (userData.wheel).
    for (const w of wheels) w.node.position.set(w.base.x - w.tuck * (1 - f), w.base.y + w.lift * (1 - f), w.base.z);
    roverMount.children[0]?.userData?.setWheelDeploy?.(f);
  }
  function draw(input) {
    stage.visible = plan.stageVisible;
    stage.position.copy(heading).multiplyScalar(plan.stageForwardM * s); stage.position.y = plan.stageOffsetM * s;
    if (plan.attached) {
      const target = input?.reducedMotion ? 1 : 0.15; // damped tilt, like a real attitude loop
      tilt.p += ((finite(input?.pitchDeg) ? input.pitchDeg : 0) - tilt.p) * target; tilt.r += ((finite(input?.rollDeg) ? input.rollDeg : 0) - tilt.r) * target;
    }
    qTilt.setFromEuler(euler.set(tilt.p * Math.PI / 180, 0, tilt.r * Math.PI / 180));
    qFly.setFromAxisAngle(pitchAxis, plan.stagePitchDeg * Math.PI / 180);
    stage.quaternion.copy(qFly).multiply(qTilt);
    stage.updateMatrix();
    const physicsThrottle = input?.phase === 'descent' && finite(input?.throttle) ? clamp(input.throttle, 0, 1) : 0;
    const thr = plan.throttle ?? (plan.phase === 'touchdown' ? Math.min(physicsThrottle, 0.35) || 0.3 : physicsThrottle);
    for (const p of plumes) { p.visible = plan.stageVisible && thr > 0.02; p.scale.set(1, 0.5 + 1.3 * thr, 1); }
    plumeMat.opacity = 0.05 + 0.12 * thr; // hydrazine exhaust is nearly transparent; a faint shimmer only
    for (const h of halos) { h.visible = plan.stageVisible && thr > 0.02; h.scale.setScalar(0.5 + 0.55 * thr); }
    haloMat.opacity = clamp(0.25 + 0.5 * thr, 0, 1) * (thr > 0.02 ? 1 : 0);
    const top = tmpA.copy(budLocal).applyMatrix4(stage.matrix);
    lines.forEach((l, i) => {
      const len = plan.attached ? null : plan.bridleLengthM;
      const bottom = tmpB.copy(l.bottom);
      if (len !== null) bottom.lerpVectors(top, l.bottom, BRIDLE_MAX_M > 0 ? len / BRIDLE_MAX_M : 0); // retracting into the spool
      const d = bottom.clone().sub(top), length = d.length();
      l.mesh.visible = plan.stageVisible && length > 1e-4 && (plan.attached || len > 0.01);
      l.mesh.position.copy(top); l.mesh.scale.set(l.radius, length, l.radius);
      if (length > 1e-6) l.mesh.quaternion.setFromUnitVectors(up, d.normalize());
      flashes[i].visible = i < 3 && plan.pyro > 0 && !input?.reducedMotion;
      flashes[i].scale.setScalar(0.6 + (1 - plan.pyro) * 1.2);
    });
    flashMat.opacity = plan.pyro;
    applyWheels(plan.wheelDeploy);
  }
  function update(dtSeconds, input = {}) {
    const dt = finite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
    if (input.touchdown) {
      if (touched) tSinceTouchdown += dt; else { touched = true; tSinceTouchdown = 0; }
      if (input.reducedMotion && tSinceTouchdown < SKY_CRANE_TOTAL_S) tSinceTouchdown = SKY_CRANE_TOTAL_S; // no flyaway animation
    } else if (touched) { touched = false; tSinceTouchdown = 0; crashPoint = null; }
    const keep = !input.touchdown && !finite(input.altitudeM) && plan; // aborted / no altitude: hold the last pose
    if (!keep) plan = skyCranePlan({ altitudeM: input.altitudeM, touchdown: Boolean(input.touchdown), tSinceTouchdown });
    if (plan.phase === 'complete' && !crashPoint) {
      const p = heading.clone().multiplyScalar(FLYAWAY_DISTANCE_M * s);
      crashPoint = { x: p.x, y: 0, z: p.z, distanceM: FLYAWAY_DISTANCE_M, units: 'group-local scene units; y=0 is the rover ground level, not the DEM' };
    }
    if (!keep) lift = input.touchdown ? 0 : skyCraneDisplayLiftM(input.altitudeM, visualScale);
    rig.position.y = lift * unitsPerMeter;
    draw(input);
    return { ...plan, displayLiftM: lift, tSinceTouchdown, crashPoint };
  }
  function reset() { lift = 0; rig.position.y = 0; touched = false; tSinceTouchdown = 0; crashPoint = null; tilt = { p: 0, r: 0 }; plan = skyCranePlan({}); draw({}); }
  function dispose() {
    attachRover(null); group.removeFromParent();
    for (const x of owned) x.dispose?.();
    owned.clear();
  }
  if (roverObject) attachRover(roverObject);
  reset();
  return {
    group, stage, bridles, enginesLocal, halos, attachRover, update, reset, dispose,
    get phase() { return plan.phase; },
    get crashPoint() { return crashPoint; },
    get plan() { return plan; },
    rig, roverMount, scenePerMeter: s,
  };
}
