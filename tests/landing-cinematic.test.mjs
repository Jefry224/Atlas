import test from 'node:test';
import assert from 'node:assert/strict';
import { directShot, legCompression, requiredCameraY, createPhaseClock, SHOT_LIMITS, skyCraneFraming, SKY_CRANE_SHOT_BELOW_M, SKY_CRANE_CUT_HOLD_S } from '../src/landing/landing-cinematic.mjs';

const shot = (o) => directShot({ body: 'moon', horizontalSpeedMs: 2, tSincePhase: 0, ...o });

test('directShot maps phase and altitude to the expected shot', () => {
  assert.equal(shot({ phase: 'preparation', altitudeM: 180 }).shot, 'establishing');
  assert.equal(shot({ phase: 'descent', altitudeM: 180 }).shot, 'establishing');
  assert.equal(shot({ phase: 'descent', altitudeM: 121 }).shot, 'establishing');
  assert.equal(shot({ phase: 'descent', altitudeM: 90 }).shot, 'tracking');
  assert.equal(shot({ phase: 'descent', altitudeM: 31 }).shot, 'tracking');
  assert.equal(shot({ phase: 'descent', altitudeM: 20 }).shot, 'ground');
  assert.equal(shot({ phase: 'descent', altitudeM: 0 }).shot, 'ground');
  assert.equal(shot({ phase: 'contact', altitudeM: 0, tSincePhase: 0.2 }).shot, 'touchdown');
  assert.equal(shot({ phase: 'hard-contact', altitudeM: 0, tSincePhase: 0.2 }).shot, 'touchdown');
  assert.equal(shot({ phase: 'contact', altitudeM: 0, tSincePhase: 2 }).shot, 'deploy');
  assert.equal(shot({ phase: 'deployment', altitudeM: 0, tSincePhase: 0.5 }).shot, 'deploy');
  for (const phase of ['ready', 'exploration', 'aborted', 'unavailable', 'bogus', undefined]) assert.equal(shot({ phase, altitudeM: 50 }).shot, 'free', String(phase));
  assert.equal(shot({ phase: 'hard-contact', altitudeM: 0, tSincePhase: 3 }).shot, 'free');
});

test('directShot returns finite parameters and tolerates missing inputs', () => {
  for (const phase of ['preparation', 'descent', 'contact', 'deployment', 'hard-contact']) {
    for (const altitudeM of [undefined, NaN, -5, 0, 25, 60, 200]) {
      const p = directShot({ phase, altitudeM });
      for (const k of ['distanceM', 'heightM', 'azimuthDeg', 'fovDeg', 'lookAheadM', 'shake', 'timeScale']) assert.ok(Number.isFinite(p[k]), `${phase}/${altitudeM}/${k}`);
      assert.ok(p.fovDeg > 20 && p.fovDeg < 70);
    }
  }
});

test('establishing is wide, ground is low and looks up, tracking sits between', () => {
  const est = shot({ phase: 'descent', altitudeM: 180 });
  const trk = shot({ phase: 'descent', altitudeM: 80 });
  const gnd = shot({ phase: 'descent', altitudeM: 15 });
  assert.ok(est.distanceM > 200 && est.heightM < 180, 'establishing: far and below the lander');
  assert.ok(trk.distanceM < est.distanceM && trk.distanceM > gnd.distanceM * 0.9);
  assert.ok(trk.heightM < 80, 'tracking: camera below the lander');
  assert.ok(gnd.heightM < 3 && gnd.heightM < 15, 'ground: camera near the ground, below the lander');
  assert.ok(gnd.shake > trk.shake && trk.shake > est.shake);
});

test('tracking look-ahead grows with horizontal speed and is capped', () => {
  const slow = directShot({ phase: 'descent', altitudeM: 80, horizontalSpeedMs: 1 });
  const fast = directShot({ phase: 'descent', altitudeM: 80, horizontalSpeedMs: 100 });
  assert.ok(fast.lookAheadM > slow.lookAheadM);
  assert.ok(fast.lookAheadM <= 25);
});

test('touchdown slow-motion window: ~0.35 early, back to 1 at the end of the window', () => {
  const early = shot({ phase: 'contact', altitudeM: 0, tSincePhase: 0.1 });
  assert.ok(Math.abs(early.timeScale - SHOT_LIMITS.slowMotionScale) < 1e-9);
  const mid = shot({ phase: 'contact', altitudeM: 0, tSincePhase: 1.0 });
  assert.ok(mid.timeScale > 0.35 && mid.timeScale < 1);
  const late = shot({ phase: 'contact', altitudeM: 0, tSincePhase: SHOT_LIMITS.touchdownWindowS + 0.01 });
  assert.equal(late.timeScale, 1);
  for (const phase of ['preparation', 'descent', 'deployment', 'exploration']) assert.equal(shot({ phase, altitudeM: 10 }).timeScale, 1);
  // The impact jolt decays and a hard contact jolts more.
  assert.ok(shot({ phase: 'contact', tSincePhase: 0 }).shake > shot({ phase: 'contact', tSincePhase: 0.8 }).shake);
  assert.ok(shot({ phase: 'hard-contact', tSincePhase: 0 }).shake > shot({ phase: 'contact', tSincePhase: 0 }).shake);
});

test('reducedMotion: no shake, no slow motion, cuts, static deploy framing', () => {
  for (const [phase, altitudeM, t] of [['descent', 180, 0], ['descent', 70, 0], ['descent', 10, 0], ['contact', 0, 0.2], ['deployment', 0, 3]]) {
    const p = directShot({ phase, altitudeM, tSincePhase: t, reducedMotion: true });
    assert.equal(p.shake, 0, phase); assert.equal(p.timeScale, 1, phase); assert.equal(p.cut, true, phase);
  }
  assert.equal(directShot({ phase: 'descent', altitudeM: 50 }).cut, false);
  const a = directShot({ phase: 'deployment', tSincePhase: 0, reducedMotion: true }), b = directShot({ phase: 'deployment', tSincePhase: 5, reducedMotion: true });
  assert.equal(a.azimuthDeg, b.azimuthDeg);
  const c = directShot({ phase: 'deployment', tSincePhase: 0 }), d = directShot({ phase: 'deployment', tSincePhase: 5 });
  assert.ok(Math.abs(d.azimuthDeg - c.azimuthDeg) > 30, 'deploy orbits slowly');
  // Tracking framing does not dolly with altitude under reduced motion.
  assert.equal(directShot({ phase: 'descent', altitudeM: 110, reducedMotion: true }).distanceM, directShot({ phase: 'descent', altitudeM: 40, reducedMotion: true }).distanceM);
});

test('createPhaseClock measures time since the last phase change', () => {
  const clock = createPhaseClock();
  assert.equal(clock('descent', 10), 0);
  assert.equal(clock('descent', 12.5), 2.5);
  assert.equal(clock('contact', 13), 0);
  assert.equal(clock('contact', 13.4).toFixed(1), '0.4');
});

test('legCompression: starts at 0, peaks early, settles, scales with impact speed', () => {
  assert.equal(legCompression(0, 2), 0);
  assert.equal(legCompression(-1, 2), 0);
  assert.equal(legCompression(NaN, 2), 0);
  assert.ok(Number.isFinite(legCompression(0.5, NaN)));
  let peak = 0, tPeak = 0;
  for (let t = 0.005; t < 3; t += 0.005) { const x = legCompression(t, 2); assert.ok(x >= 0 && x <= 0.45); if (x > peak) { peak = x; tPeak = t; } }
  assert.ok(peak > 0.08, `peak ${peak}`);
  assert.ok(tPeak < 0.25, `peak time ${tPeak}`);
  const settled = legCompression(5, 2);
  assert.ok(Math.abs(settled - 0.04) < 1e-3, `settled ${settled}`);
  assert.ok(Math.abs(legCompression(5, 2) - legCompression(5.3, 2)) < 1e-3, 'no residual oscillation');
  const peakAt = (v) => { let m = 0; for (let t = 0.005; t < 1; t += 0.005) m = Math.max(m, legCompression(t, v)); return m; };
  assert.ok(peakAt(3) > peakAt(1));
  assert.ok(peakAt(50) <= 0.45, 'clamped to the strut stroke');
  // Damped: the second overshoot above equilibrium is smaller than the first.
  const over = []; let prev = 0, rising = true;
  for (let t = 0.002; t < 3; t += 0.002) { const x = legCompression(t, 2); if (rising && x < prev) { over.push(prev); rising = false; } else if (!rising && x > prev) rising = true; prev = x; }
  assert.ok(over.length >= 2 && over[1] < over[0]);
});

test('requiredCameraY keeps the camera above ground + margin', () => {
  assert.equal(requiredCameraY({ cameraY: 10, targetY: 10, margin: 0.15, groundAlong: [{ t: 0, groundY: 2 }] }), 10);
  assert.equal(requiredCameraY({ cameraY: 1, targetY: 10, margin: 0.15, groundAlong: [{ t: 0, groundY: 2 }] }), 2.15);
});

test('requiredCameraY lifts the camera so a ridge does not block the line of sight', () => {
  // Camera at 1, target at 1, a ridge at 5 halfway: line must pass 5.15 at t = 0.5 → y ≥ 9.3.
  const y = requiredCameraY({ cameraY: 1, targetY: 1, margin: 0.15, groundAlong: [{ t: 0, groundY: 0 }, { t: 0.5, groundY: 5 }] });
  assert.ok(Math.abs(y - 9.3) < 1e-9, `${y}`);
  const lineAtHalf = y + (1 - y) * 0.5;
  assert.ok(lineAtHalf >= 5.15 - 1e-9);
  // Invalid samples (t ≥ 1, non-finite ground) are ignored.
  assert.equal(requiredCameraY({ cameraY: 3, targetY: 1, margin: 0.1, groundAlong: [{ t: 1, groundY: 50 }, { t: 0.5, groundY: NaN }] }), 3);
});

test('shot azimuths are offsets from the sun bearing', () => {
  for (const [phase, altitudeM] of [['descent', 180], ['descent', 70], ['descent', 10], ['deployment', 0]]) {
    const a = directShot({ phase, altitudeM }), b = directShot({ phase, altitudeM, sunAzimuthDeg: 120 });
    assert.equal(b.azimuthDeg - a.azimuthDeg, 120, phase);
  }
  assert.equal(directShot({ phase: 'exploration', sunAzimuthDeg: 120 }).azimuthDeg, 0);
});

test('skyCraneFraming fits the whole rig in the vertical field of view, camera low on the rig', () => {
  for (const span of [10, 18.5, 30]) {
    const f = skyCraneFraming(span, 5);
    const visible = 2 * f.distanceM * Math.tan((f.fovDeg / 2) * Math.PI / 180);
    assert.ok(visible >= span && visible < span * 1.3, `span ${span}: visible ${visible}`);
    assert.ok(f.heightM > 5 && f.heightM < 5 + span * 0.5, 'camera between rover and rig middle');
  }
  assert.equal(skyCraneFraming(0).distanceM, 10, 'minimum distance');
  assert.ok(Number.isFinite(skyCraneFraming(NaN, NaN).distanceM));
});

test('Mars sky crane: close rig shots for the final metres, touchdown and cut, then deploy', () => {
  const mars = (o) => directShot({ body: 'mars', rigSpanM: 18, horizontalSpeedMs: 0, ...o });
  assert.equal(mars({ phase: 'descent', altitudeM: 29 }).shot, 'ground');
  assert.equal(mars({ phase: 'descent', altitudeM: SKY_CRANE_SHOT_BELOW_M }).shot, 'lowering');
  assert.equal(mars({ phase: 'descent', altitudeM: 3 }).shot, 'lowering');
  const td = mars({ phase: 'contact', altitudeM: 0, tSincePhase: 0.2 });
  assert.equal(td.shot, 'touchdown');
  assert.ok(Math.abs(td.timeScale - SHOT_LIMITS.slowMotionScale) < 1e-9, 'touchdown slow motion kept');
  assert.equal(mars({ phase: 'contact', altitudeM: 0, tSincePhase: SHOT_LIMITS.touchdownWindowS + 1 }).shot, 'cut');
  assert.equal(mars({ phase: 'contact', altitudeM: 0, tSincePhase: SHOT_LIMITS.touchdownWindowS + SKY_CRANE_CUT_HOLD_S + 0.1 }).shot, 'deploy');
  // The touchdown shot fits the whole rig with little slack; the lowering shot is closer than the generic ground shot.
  const visible = 2 * td.distanceM * Math.tan((td.fovDeg / 2) * Math.PI / 180);
  assert.ok(visible >= 18 && visible < 18 * 1.3, `visible ${visible}`);
  assert.ok(mars({ phase: 'descent', altitudeM: 10 }).distanceM < directShot({ body: 'mars', phase: 'descent', altitudeM: 10 }).distanceM);
  // Without a rig span (e.g. the Moon or a missing sky crane), the generic shots are used.
  assert.equal(directShot({ body: 'mars', phase: 'descent', altitudeM: 10 }).shot, 'ground');
  assert.equal(directShot({ body: 'moon', rigSpanM: 18, phase: 'descent', altitudeM: 10 }).shot, 'ground');
  assert.equal(mars({ phase: 'contact', altitudeM: 0, tSincePhase: 0.2, reducedMotion: true }).cut, true);
});
