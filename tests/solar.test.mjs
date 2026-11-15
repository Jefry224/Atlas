import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sunPosition, horizontalFromHourAngle, refractionDeg, marsSunElevation, marsDeclinationDeg,
  moonSunElevation, earthFromMoon, directionFromAngles,
} from '../src/processes/solar.mjs';

const near = (actual, expected, tol, label = '') =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label} expected ${expected} ± ${tol}, got ${actual}`);
const angleNear = (actual, expected, tol, label = '') => {
  const d = ((actual - expected + 540) % 360) - 180;
  assert.ok(Math.abs(d) <= tol, `${label} expected ${expected} ± ${tol}, got ${actual}`);
};

test('equinox: sun near the zenith at solar noon on the equator', () => {
  // March equinox 2024-03-20 03:06 UTC; equation of time ≈ −7.5 min → solar noon at lon 0 ≈ 12:07:30 UTC
  const p = sunPosition(Date.UTC(2024, 2, 20, 12, 7, 30), 0, 0, { refraction: false });
  assert.ok(p.elevationDeg > 89, `elevation ${p.elevationDeg}`);
  near(p.declinationDeg, 0.4, 0.3, 'declination');
});

test('equinox: sunrise due east, sunset due west on the equator', () => {
  const rise = sunPosition(Date.UTC(2024, 2, 20, 6, 7, 30), 0, 0, { refraction: false });
  near(rise.elevationDeg, 0, 1, 'sunrise elevation');
  angleNear(rise.azimuthDeg, 90, 1, 'sunrise azimuth');
  const set = sunPosition(Date.UTC(2024, 2, 20, 18, 7, 30), 0, 0, { refraction: false });
  near(set.elevationDeg, 0, 1, 'sunset elevation');
  angleNear(set.azimuthDeg, 270, 1, 'sunset azimuth');
});

test('June solstice: midnight sun at the North Pole, polar night at the South Pole', () => {
  for (const hour of [0, 6, 12, 18]) {
    const t = Date.UTC(2024, 5, 20, hour, 51);
    near(sunPosition(t, 90, 0, { refraction: false }).elevationDeg, 23.44, 0.3, `north pole ${hour}h`);
    near(sunPosition(t, -90, 0, { refraction: false }).elevationDeg, -23.44, 0.3, `south pole ${hour}h`);
  }
});

test('Greenwich summer noon: elevation 90 − φ + δ, sun due south', () => {
  const p = sunPosition(Date.UTC(2024, 5, 21, 12, 2), 51.4769, 0);
  near(p.elevationDeg, 90 - 51.4769 + 23.43, 0.3, 'elevation');
  angleNear(p.azimuthDeg, 180, 1.5, 'azimuth');
});

test('night: Madrid at local midnight in January is far below the horizon', () => {
  const p = sunPosition(Date.UTC(2024, 0, 1, 0, 15), 40.4, -3.7);
  assert.ok(p.elevationDeg < -60, `elevation ${p.elevationDeg}`);
  angleNear(p.azimuthDeg, 0, 10, 'azimuth near north');
});

test('Atacama afternoon: low sun in the west-south-west on a November evening', () => {
  // 2026-11-14 21:00 UTC = 18:00 local (UTC−3); sun low in the west-south-west at −24°
  const p = sunPosition(Date.UTC(2026, 10, 14, 21, 0), -24.102, -70.138);
  assert.ok(p.elevationDeg > 5 && p.elevationDeg < 30, `elevation ${p.elevationDeg}`);
  assert.ok(p.azimuthDeg > 230 && p.azimuthDeg < 270, `azimuth ${p.azimuthDeg}`);
});

test('refraction is ~0.5° at the horizon and negligible high up', () => {
  near(refractionDeg(0), 0.48, 0.1, 'horizon');
  assert.ok(refractionDeg(60) < 0.02);
});

test('horizontalFromHourAngle: morning sun is east, afternoon west', () => {
  angleNear(horizontalFromHourAngle(-45, 30, 0).azimuthDeg, 112, 15);
  angleNear(horizontalFromHourAngle(45, 30, 0).azimuthDeg, 248, 15);
});

test('Mars: declination from Ls and noon elevation at Jezero', () => {
  near(marsDeclinationDeg(0), 0, 1e-9);
  near(marsDeclinationDeg(90), 25.19, 1e-6);
  near(marsDeclinationDeg(270), -25.19, 1e-6);
  near(marsSunElevation(12, 0, 0).elevationDeg, 90, 1e-6, 'equator equinox noon');
  near(marsSunElevation(12, 18.4447, 90).elevationDeg, 90 - (25.19 - 18.4447), 1e-6, 'Jezero northern summer');
  assert.ok(marsSunElevation(0, 18.4447, 90).elevationDeg < -40, 'midnight');
  angleNear(marsSunElevation(6, 0, 0).azimuthDeg, 90, 1e-6, 'sunrise east');
});

test('Moon: grazing sun at Shackleton, high sun at Marius Hills', () => {
  for (let h = 0; h < 24; h += 1.5) {
    const p = moonSunElevation(h, -89.78, 1.54);
    assert.ok(Math.abs(p.elevationDeg) <= 1.8, `Shackleton ${h}h elevation ${p.elevationDeg}`);
  }
  near(moonSunElevation(12, 14, 0).elevationDeg, 76, 1e-6);
  near(moonSunElevation(12, 0, 5).declinationDeg, 1.54, 1e-9, 'clamped subsolar latitude');
});

test('Earth seen from the Moon', () => {
  near(earthFromMoon(0, 0).elevationDeg, 90, 1e-6, 'sub-Earth point');
  const marius = earthFromMoon(14, -56.7);
  near(marius.elevationDeg, 32.2, 0.3, 'Marius Hills elevation');
  angleNear(marius.azimuthDeg, 99, 2, 'Marius Hills azimuth (east)');
  assert.ok(Math.abs(earthFromMoon(-89.78, -155.74).elevationDeg) < 1, 'Shackleton: on the horizon');
  assert.ok(earthFromMoon(0, 180).elevationDeg < -80, 'far side');
});

test('directionFromAngles uses x = east, y = up, z = south', () => {
  const [ex, ey, ez] = directionFromAngles(0, 90);
  near(ex, 1, 1e-9); near(ey, 0, 1e-9); near(ez, 0, 1e-9);
  const [nx, , nz] = directionFromAngles(0, 0);
  near(nx, 0, 1e-9); near(nz, -1, 1e-9);
  near(directionFromAngles(90, 123)[1], 1, 1e-9);
});
