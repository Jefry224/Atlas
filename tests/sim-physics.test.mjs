import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_ENV, attitude, solarPowerW, batteryStep, driveLoadW, thermalStatus } from '../sim-physics.mjs';

const N = 65, SP = 37.5;
const grid = (fn) => ({ gridSize: N, spacingMeters: SP, elevation: Array.from({ length: N * N }, (_, i) => fn(Math.floor(i / N), i % N)) });
// Plano que sube hacia el ESTE (columna creciente) con 10°.
const eastRamp = grid((r, c) => Math.tan(10 * Math.PI / 180) * c * SP);
const near = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

test('BODY_ENV cubre earth, moon y mars con el contrato', () => {
  for (const b of ['earth', 'moon', 'mars']) {
    for (const k of ['gravityMs2', 'solarConstantWm2', 'dayLengthHours', 'atmosphere']) assert.ok(k in BODY_ENV[b], `${b}.${k}`);
  }
  assert.ok(BODY_ENV.moon.gravityMs2 < BODY_ENV.mars.gravityMs2 && BODY_ENV.mars.gravityMs2 < BODY_ENV.earth.gravityMs2);
});

test('terreno plano → pitch y roll 0 en cualquier rumbo', () => {
  const flat = grid(() => 120);
  for (const h of [0, 45, 90, 200, 359]) {
    const a = attitude(flat, 100, -300, h);
    assert.equal(a.pitchDeg, 0); assert.equal(a.rollDeg, 0);
  }
});

test('plano de 10°: de frente pitch ≈ 10, de lado roll ≈ 10 con signo correcto', () => {
  near(attitude(eastRamp, 0, 0, 90).pitchDeg, 10);   // mirando al este: sube → morro arriba
  near(attitude(eastRamp, 0, 0, 90).rollDeg, 0);
  near(attitude(eastRamp, 0, 0, 270).pitchDeg, -10); // mirando al oeste: baja
  // Mirando al sur, la derecha es el oeste (más bajo) → inclinado a la derecha (+).
  near(attitude(eastRamp, 0, 0, 180).rollDeg, 10);
  near(attitude(eastRamp, 0, 0, 180).pitchDeg, 0);
  near(attitude(eastRamp, 0, 0, 0).rollDeg, -10);
});

test('plano norte-sur respeta z = sur', () => {
  const northUp = grid((r) => Math.tan(10 * Math.PI / 180) * (N - 1 - r) * SP); // sube hacia el norte
  near(attitude(northUp, 0, 0, 0).pitchDeg, 10);
});

test('rejilla inválida → actitud null, sin lanzar', () => {
  assert.deepEqual(attitude(null, 0, 0, 0), { pitchDeg: null, rollDeg: null });
  assert.deepEqual(attitude({ gridSize: 3, spacingMeters: 1, elevation: [1] }, 0, 0, 0), { pitchDeg: null, rollDeg: null });
});

test('solarPowerW: fórmula, irradiancia 0, inclinación ≥ 90°', () => {
  assert.equal(solarPowerW({ irradianceWm2: 0 }), 0);
  assert.equal(solarPowerW({ irradianceWm2: -5 }), 0);
  assert.equal(solarPowerW({ irradianceWm2: NaN }), 0);
  near(solarPowerW({ irradianceWm2: 1000 }), 560, 1e-9);
  near(solarPowerW({ irradianceWm2: 1000, tiltDeg: 60 }), 280, 1e-9);
  near(solarPowerW({ irradianceWm2: 1000, tiltDeg: 90 }), 0, 1e-9);
  near(solarPowerW({ irradianceWm2: 1000, tiltDeg: 120 }), 0, 1e-9);
});

test('batteryStep integra Wh y acota a [0, 100]', () => {
  near(batteryStep({ batteryPct: 50, capacityWh: 1000, solarW: 0, loadW: 100, dtSeconds: 3600 }), 40, 1e-9);
  near(batteryStep({ batteryPct: 50, capacityWh: 1000, solarW: 200, loadW: 100, dtSeconds: 3600 }), 60, 1e-9);
  assert.equal(batteryStep({ batteryPct: 99, solarW: 5000, loadW: 0, dtSeconds: 3600 }), 100);
  assert.equal(batteryStep({ batteryPct: 1, solarW: 0, loadW: 5000, dtSeconds: 3600 }), 0);
  assert.equal(batteryStep({ batteryPct: 70, solarW: 0, loadW: 100, dtSeconds: 0 }), 70);
});

test('driveLoadW: parado = aviónica, cuesta arriba > llano > cuesta abajo, Luna < Tierra', () => {
  assert.equal(driveLoadW({ speedMs: 0, slopeDeg: 20, gravityMs2: 9.81 }), 40);
  const flat = driveLoadW({ speedMs: 0.5, slopeDeg: 0, gravityMs2: 9.81 });
  near(flat, 350 * 9.81 * 0.15 * 0.5 / 0.6 + 40, 1e-9);
  assert.ok(driveLoadW({ speedMs: 0.5, slopeDeg: 10, gravityMs2: 9.81 }) > flat);
  assert.ok(driveLoadW({ speedMs: 0.5, slopeDeg: -10, gravityMs2: 9.81 }) < flat);
  assert.ok(driveLoadW({ speedMs: 0.5, slopeDeg: -30, gravityMs2: 9.81 }) >= 40); // sin regeneración
  assert.ok(driveLoadW({ speedMs: 0.5, slopeDeg: 0, gravityMs2: BODY_ENV.moon.gravityMs2 }) < flat);
});

test('thermalStatus: niveles y margen', () => {
  assert.equal(thermalStatus({ ambientK: 293 }).level, 'nominal');
  assert.equal(thermalStatus({ ambientK: 293 }).marginK, 30);
  assert.equal(thermalStatus({ ambientK: 240 }).level, 'caution');
  assert.equal(thermalStatus({ ambientK: 315 }).level, 'caution');
  const cold = thermalStatus({ ambientK: 40 });
  assert.equal(cold.level, 'critical'); assert.equal(cold.marginK, -193); assert.match(cold.text, /cold/);
  assert.match(thermalStatus({ ambientK: 400 }).text, /heat/);
  assert.equal(thermalStatus({}).level, 'unknown');
  assert.equal(thermalStatus({}).marginK, null);
});
