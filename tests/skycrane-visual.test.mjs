import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three.module.min.js';
import {
  skyCranePlan, createSkyCrane, SKY_CRANE_START_M, BRIDLE_MAX_M, SKY_CRANE_DESCENT_MS, SPOOL_TIME_S,
  LOWER_RATIO, BRIDLE_FULL_ALT_M, TOUCHDOWN_CONFIRM_S, CUT_HOLD_S, FLYAWAY_DURATION_S, FLYAWAY_PITCH_DEG,
  FLYAWAY_DISTANCE_M, FLYAWAY_MIN_DISTANCE_M, STOW_HEIGHT_M, SKY_CRANE_TOTAL_S, SKY_CRANE_PHASES, skyCraneDisplayLiftM,
} from '../skycrane-visual.mjs';

const near = (a, b, tol = 1e-9, label = '') => assert.ok(Math.abs(a - b) <= tol, `${label} expected ${b} ± ${tol}, got ${a}`);
const after = t => skyCranePlan({ altitudeM: 0, touchdown: true, tSinceTouchdown: t });

test('real timeline constants match the cited NASA/JPL figures', () => {
  assert.equal(SKY_CRANE_START_M, 20);
  assert.equal(BRIDLE_MAX_M, 7.6);
  assert.equal(SKY_CRANE_DESCENT_MS, 0.75);
  assert.equal(FLYAWAY_PITCH_DEG, 45);
  assert.ok(FLYAWAY_DISTANCE_M >= FLYAWAY_MIN_DISTANCE_M && FLYAWAY_MIN_DISTANCE_M === 150);
  near(CUT_HOLD_S, 0.187);
  assert.ok(FLYAWAY_DURATION_S >= 4 && FLYAWAY_DURATION_S <= 6);
});

test('powered above the sky crane start altitude: rover stowed, no bridle', () => {
  for (const altitudeM of [180, 60, 20.001]) {
    const p = skyCranePlan({ altitudeM });
    assert.equal(p.phase, 'powered');
    assert.equal(p.bridleLengthM, 0);
    assert.equal(p.roverOffsetM, STOW_HEIGHT_M);
    assert.equal(p.stageOffsetM, STOW_HEIGHT_M);
    assert.equal(p.wheelDeploy, 0);
    assert.equal(p.attached, true);
  }
});

test('missing altitude is treated as powered and stowed, never NaN', () => {
  for (const altitudeM of [null, undefined, NaN]) {
    const p = skyCranePlan({ altitudeM });
    assert.equal(p.phase, 'powered');
    assert.equal(p.bridleLengthM, 0);
  }
});

test('lowering starts at 20 m and pays out at the spool/descent ratio', () => {
  assert.equal(skyCranePlan({ altitudeM: 20 }).phase, 'lowering');
  const ratio = (BRIDLE_MAX_M / SPOOL_TIME_S) / (BRIDLE_MAX_M / SPOOL_TIME_S + SKY_CRANE_DESCENT_MS);
  near(LOWER_RATIO, ratio);
  const a = skyCranePlan({ altitudeM: 18 }), b = skyCranePlan({ altitudeM: 15 });
  near((b.bridleLengthM - a.bridleLengthM) / 3, LOWER_RATIO, 1e-12, 'bridle per metre of altitude');
  // While spooling, the stage itself descends at 0.75 m/s when the rover descends at spool + 0.75 m/s.
  const roverRate = BRIDLE_MAX_M / SPOOL_TIME_S + SKY_CRANE_DESCENT_MS, dt = 1;
  const p0 = skyCranePlan({ altitudeM: 19 }), p1 = skyCranePlan({ altitudeM: 19 - roverRate * dt });
  const stageAlt0 = 19 + p0.stageOffsetM, stageAlt1 = 19 - roverRate * dt + p1.stageOffsetM;
  near((stageAlt0 - stageAlt1) / dt, SKY_CRANE_DESCENT_MS, 1e-9, 'stage descent rate');
  near(b.roverOffsetM, STOW_HEIGHT_M + b.bridleLengthM);
});

test('bridle length is clamped to the 7.6 m full extension', () => {
  near(BRIDLE_FULL_ALT_M, SKY_CRANE_START_M - BRIDLE_MAX_M / LOWER_RATIO);
  assert.ok(BRIDLE_FULL_ALT_M > 5 && BRIDLE_FULL_ALT_M < 9, `full at ${BRIDLE_FULL_ALT_M}`);
  for (const altitudeM of [BRIDLE_FULL_ALT_M, 5, 1, 0, -3]) {
    const p = skyCranePlan({ altitudeM });
    near(p.bridleLengthM, BRIDLE_MAX_M);
    assert.equal(p.phase, 'lowering');
    assert.equal(p.wheelDeploy, 1);
  }
  let prev = -1;
  for (let alt = 25; alt >= 0; alt -= 0.25) { const L = skyCranePlan({ altitudeM: alt }).bridleLengthM; assert.ok(L >= prev && L <= BRIDLE_MAX_M); prev = L; }
});

test('wheels unfold progressively during lowering', () => {
  const mid = skyCranePlan({ altitudeM: (SKY_CRANE_START_M + BRIDLE_FULL_ALT_M) / 2 }).wheelDeploy;
  assert.ok(mid > 0.2 && mid < 0.8, `mid deploy ${mid}`);
});

test('post-touchdown phase sequence: touchdown → cut → flyaway → complete', () => {
  assert.equal(after(0).phase, 'touchdown');
  assert.equal(after(TOUCHDOWN_CONFIRM_S - 0.01).phase, 'touchdown');
  assert.equal(after(TOUCHDOWN_CONFIRM_S + 0.01).phase, 'cut');
  assert.equal(after(TOUCHDOWN_CONFIRM_S + CUT_HOLD_S + 0.01).phase, 'flyaway');
  near(SKY_CRANE_TOTAL_S, TOUCHDOWN_CONFIRM_S + CUT_HOLD_S + FLYAWAY_DURATION_S);
  assert.equal(after(SKY_CRANE_TOTAL_S).phase, 'complete');
  assert.equal(after(SKY_CRANE_TOTAL_S + 100).phase, 'complete');
  const seen = new Set();
  for (let t = 0; t <= SKY_CRANE_TOTAL_S + 1; t += 0.05) seen.add(after(t).phase);
  assert.deepEqual([...seen], SKY_CRANE_PHASES.slice(2));
});

test('touchdown keeps the stage hovering at full extension; cut fires the pyro flash and the stage holds', () => {
  const td = after(0.5);
  near(td.stageOffsetM, STOW_HEIGHT_M + BRIDLE_MAX_M);
  assert.equal(td.attached, true); assert.equal(td.pyro, 0);
  const cut = after(TOUCHDOWN_CONFIRM_S + 0.01);
  assert.equal(cut.attached, false); assert.ok(cut.pyro > 0.9);
  near(cut.stageOffsetM, STOW_HEIGHT_M + BRIDLE_MAX_M, 1e-9, 'holds altitude during the 187 ms');
  assert.equal(cut.stagePitchDeg, 0);
  assert.ok(after(TOUCHDOWN_CONFIRM_S + 0.6).bridleLengthM < 1e-9, 'cut cords rewound');
  assert.equal(after(TOUCHDOWN_CONFIRM_S + 0.6).pyro, 0);
});

test('flyaway climbs first, pitches to 45°, then dives to a crash ≥ 150 m away and hides', () => {
  const start = TOUCHDOWN_CONFIRM_S + CUT_HOLD_S;
  const early = after(start + 0.3);
  assert.ok(early.stageOffsetM > STOW_HEIGHT_M + BRIDLE_MAX_M, 'climbs');
  assert.ok(early.stagePitchDeg < 5, 'vertical rise before pitching');
  assert.equal(early.throttle, 1);
  near(after(start + 2).stagePitchDeg, FLYAWAY_PITCH_DEG);
  let maxPitch = 0, prevForward = -1;
  for (let t = start; t < SKY_CRANE_TOTAL_S; t += 0.05) {
    const p = after(t); maxPitch = Math.max(maxPitch, p.stagePitchDeg);
    assert.ok(p.stageForwardM >= prevForward); prevForward = p.stageForwardM;
    assert.ok(p.stageOffsetM >= 0); assert.equal(p.stageVisible, true);
  }
  near(maxPitch, FLYAWAY_PITCH_DEG);
  const end = after(SKY_CRANE_TOTAL_S);
  assert.equal(end.stageVisible, false); assert.equal(end.stageOffsetM, 0);
  assert.ok(end.stageForwardM >= FLYAWAY_MIN_DISTANCE_M);
  assert.equal(after(SKY_CRANE_TOTAL_S - 0.1).throttle, 0, 'fixed-time burn ends before impact');
});

test('createSkyCrane builds the expected shape with real Three.js', () => {
  const sc = createSkyCrane(THREE, { unitsPerMeter: 0.1, visualScale: 6 });
  assert.ok(sc.group.isGroup && sc.stage.isGroup && sc.bridles.isGroup);
  assert.equal(sc.enginesLocal.length, 8);
  for (const e of sc.enginesLocal) {
    assert.ok(e.position.isVector3 && e.axis.isVector3);
    near(e.axis.length(), 1, 1e-9);
    assert.ok(e.axis.y < -0.8, 'engines point down');
    const radial = new THREE.Vector3(e.position.x, 0, e.position.z).normalize();
    assert.ok(radial.dot(new THREE.Vector3(e.axis.x, 0, e.axis.z)) > 0.2, 'canted outward');
  }
  assert.equal(sc.bridles.children.length, 4, 'three bridles + umbilical');
  let meshes = 0, shadows = 0;
  sc.stage.traverse(o => { if (o.isMesh && o.material.type !== 'MeshBasicMaterial') { meshes++; if (o.castShadow) shadows++; } });
  assert.ok(meshes > 40); assert.equal(shadows, meshes);
  const size = new THREE.Box3().setFromObject(sc.stage).getSize(new THREE.Vector3());
  assert.ok(size.x / 0.6 > 2.5 && size.x / 0.6 < 4, `stage width ${size.x / 0.6} m`);
  assert.equal(sc.phase, 'powered');
  sc.dispose();
});

test('update drives the timeline, keeps the rover at the origin and reports a crash point', () => {
  const rover = new THREE.Group();
  const wheel = new THREE.Group(); wheel.position.set(1, 0.35, 0); wheel.userData.wheel = { radius: 0.35 }; rover.add(wheel);
  const sc = createSkyCrane(THREE, { roverObject: rover });
  const s = 0.6;
  sc.update(0.1, { altitudeM: 60, phase: 'descent', throttle: 0.5, touchdown: false });
  assert.equal(sc.phase, 'powered');
  near(sc.stage.position.y, STOW_HEIGHT_M * s, 1e-9);
  assert.ok(wheel.position.y > 0.35, 'wheel stowed (lifted)');
  sc.update(0.1, { altitudeM: 2, phase: 'descent', throttle: 0.4, touchdown: false });
  assert.equal(sc.phase, 'lowering');
  near(sc.stage.position.y, (STOW_HEIGHT_M + BRIDLE_MAX_M) * s, 1e-9);
  near(wheel.position.y, 0.35, 1e-9, 'wheel deployed');
  assert.equal(rover.parent, sc.roverMount);
  near(rover.getWorldPosition(new THREE.Vector3()).length(), 0);
  let state;
  for (let t = 0; t < SKY_CRANE_TOTAL_S + 0.5; t += 0.1) state = sc.update(0.1, { altitudeM: 0, phase: 'contact', touchdown: true });
  assert.equal(sc.phase, 'complete');
  assert.equal(sc.stage.visible, false);
  assert.ok(state.crashPoint && Math.hypot(state.crashPoint.x, state.crashPoint.z) >= FLYAWAY_MIN_DISTANCE_M * s);
  sc.reset();
  assert.equal(sc.phase, 'powered'); assert.equal(sc.crashPoint, null); assert.equal(sc.stage.visible, true);
  sc.dispose();
});

test('reduced motion skips the flyaway animation straight to complete', () => {
  const sc = createSkyCrane(THREE, {});
  sc.update(0.016, { altitudeM: 0, touchdown: true, reducedMotion: true });
  assert.equal(sc.phase, 'complete');
  assert.ok(sc.crashPoint);
  sc.dispose();
});

test('aborted run without altitude holds the last pose', () => {
  const sc = createSkyCrane(THREE, {});
  sc.update(0.1, { altitudeM: 10, phase: 'descent', touchdown: false });
  const y = sc.stage.position.y;
  sc.update(0.1, { altitudeM: null, phase: 'aborted', touchdown: false });
  assert.equal(sc.phase, 'lowering'); near(sc.stage.position.y, y);
  sc.dispose();
});

test('display lift keeps rover and stage descending monotonically on screen and vanishes at touchdown', () => {
  const U = 0.1;
  for (const visualScale of [1, 6, 14]) {
    assert.equal(skyCraneDisplayLiftM(0, visualScale), 0);
    assert.equal(skyCraneDisplayLiftM(BRIDLE_FULL_ALT_M, visualScale), 0);
    assert.equal(skyCraneDisplayLiftM(null, visualScale), 0);
    let prevRover = -Infinity, prevStage = -Infinity;
    for (let a = 0; a <= 300; a += 0.05) {
      const lift = skyCraneDisplayLiftM(a, visualScale);
      assert.ok(lift >= 0);
      const rover = (a + lift) * U, stage = rover + skyCranePlan({ altitudeM: a }).stageOffsetM * U * visualScale;
      assert.ok(rover >= prevRover - 1e-9, `rover not monotone at ${a} m (scale ${visualScale})`);
      assert.ok(stage >= prevStage - 1e-9, `stage climbs at ${a} m (scale ${visualScale})`);
      prevRover = rover; prevStage = stage;
    }
    assert.equal(skyCraneDisplayLiftM(300, visualScale), 0, 'no lift far above the sky crane band');
  }
  assert.equal(skyCraneDisplayLiftM(50, 1), 0, 'no lift needed at 1:1 scale');
});

test('sky crane at the rover scale (×14): nozzle halos follow the throttle', () => {
  const sc = createSkyCrane(THREE, { unitsPerMeter: 0.1, visualScale: 14 });
  near(sc.scenePerMeter, 1.4, 1e-9);
  assert.equal(sc.halos.length, 8);
  sc.update(0.016, { altitudeM: 60, throttle: 0, phase: 'descent' });
  assert.ok(sc.halos.every((h) => !h.visible), 'no halo without thrust');
  sc.update(0.016, { altitudeM: 60, throttle: 0.4, phase: 'descent' });
  const low = sc.halos[0].scale.x, lowOpacity = sc.halos[0].material.opacity;
  sc.update(0.016, { altitudeM: 60, throttle: 1, phase: 'descent' });
  assert.ok(sc.halos.every((h) => h.visible));
  assert.ok(sc.halos[0].scale.x > low && sc.halos[0].material.opacity > lowOpacity, 'halo grows with throttle');
  sc.dispose();
});
