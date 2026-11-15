import test from 'node:test';
import assert from 'node:assert/strict';
import { exposureFor, EXPOSURE, easeExposure, configureRenderer, setShadowFlags } from '../src/processes/scene-lighting.mjs';
import { terrainWeatherFromState, patchTerrainMaterial, setTerrainWeather } from '../src/processes/terrain-shader.mjs';

test('exposure: Moon day is darker than Earth day, Mars day is brighter', () => {
  const moon = exposureFor('moon', 45), earth = exposureFor('earth', 45), mars = exposureFor('mars', 45);
  assert.ok(moon < earth, `moon ${moon} < earth ${earth}`);
  assert.ok(mars > earth, `mars ${mars} > earth ${earth}`);
});

test('exposure: nights are lifted on every body and twilight sits between', () => {
  for (const body of ['earth', 'moon', 'mars']) {
    const day = exposureFor(body, 50), dusk = exposureFor(body, 0), night = exposureFor(body, -30);
    assert.ok(night > day, `${body} night ${night} > day ${day}`);
    assert.ok(dusk > day && dusk < night, `${body} dusk ${dusk} between`);
  }
});

test('exposure: the lunar night (earthshine only) is lifted the most and stays in range', () => {
  const moonNight = exposureFor('moon', -30);
  assert.equal(moonNight, EXPOSURE.moon.night);
  assert.ok(moonNight > exposureFor('earth', -30) && moonNight > exposureFor('mars', -30));
  assert.ok(moonNight <= EXPOSURE.max);
  // no twilight on the Moon: the Sun just below a polar horizon (Shackleton, ±1.6°) is already mostly night
  const span = EXPOSURE.moon.night - EXPOSURE.moon.day;
  assert.ok(exposureFor('moon', -1.5) > EXPOSURE.moon.day + 0.8 * span, `moon −1.5° ${exposureFor('moon', -1.5)}`);
});

test('exposure: an Earth haboob (dustTau 4, solarFactor from weather-sim) opens the exposure within range', async () => {
  const { presetWeather } = await import('../src/processes/weather-sim.mjs');
  const storm = presetWeather('dust-storm', 'earth'), clear = presetWeather('clear', 'earth');
  const e = exposureFor('earth', storm.sunElevationDeg, storm);
  assert.ok(e > exposureFor('earth', storm.sunElevationDeg, clear));
  assert.ok(e >= EXPOSURE.min && e <= EXPOSURE.max);
});

test('exposure: dust and cloud open the exposure on Earth and Mars, never on the Moon', () => {
  assert.ok(exposureFor('mars', 45, { dustTau: 4 }) > exposureFor('mars', 45, { dustTau: 0.5 }));
  assert.ok(exposureFor('earth', 45, { solarFactor: 0.3 }) > exposureFor('earth', 45, { solarFactor: 1 }));
  assert.equal(exposureFor('moon', 45, { dustTau: 8 }), exposureFor('moon', 45));
});

test('exposure: fallbacks and clamping', () => {
  assert.equal(exposureFor('pluto', 45), exposureFor('earth', 45));
  assert.equal(exposureFor('earth', undefined, null), exposureFor('earth', 45));
  assert.equal(exposureFor('earth', undefined, { sunElevationDeg: -30 }), exposureFor('earth', -30));
  const extreme = exposureFor('mars', 2, { solarFactor: 0 });
  assert.ok(extreme <= EXPOSURE.max && extreme >= EXPOSURE.min);
  assert.ok(Number.isFinite(exposureFor('earth', NaN, { dustTau: NaN })));
});

test('easeExposure converges toward the target and survives bad input', () => {
  assert.equal(easeExposure(1, 2, 0), 1);
  const mid = easeExposure(1, 2, 0.2);
  assert.ok(mid > 1 && mid < 2);
  assert.ok(Math.abs(easeExposure(1, 2, 100) - 2) < 1e-6);
  assert.equal(easeExposure(NaN, 1.3, 0.1), 1.3);
  assert.equal(easeExposure(1.1, NaN, 0.1), 1.1);
});

test('configureRenderer sets ACES, sRGB output, exposure and soft shadows', () => {
  const THREE = { SRGBColorSpace: 'srgb', ACESFilmicToneMapping: 4, PCFSoftShadowMap: 2 };
  const renderer = { shadowMap: {} };
  configureRenderer(renderer, THREE, { exposure: 0.8 });
  assert.equal(renderer.outputColorSpace, 'srgb');
  assert.equal(renderer.toneMapping, 4);
  assert.equal(renderer.toneMappingExposure, 0.8);
  assert.equal(renderer.shadowMap.enabled, true);
  assert.equal(renderer.shadowMap.type, 2);
  assert.equal(configureRenderer(null, THREE), null);
});

test('setShadowFlags reaches nested meshes only', () => {
  const mesh = { isMesh: true }, group = { isMesh: false };
  const root = { traverse(fn) { fn(group); fn(mesh); } };
  setShadowFlags(root, { cast: true });
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, false);
  assert.equal(group.castShadow, undefined);
});

test('terrain weather: Moon and missing weather give no coat', () => {
  assert.deepEqual(terrainWeatherFromState(null, 'earth'), { frost: 0, dust: 0 });
  assert.deepEqual(terrainWeatherFromState({ tempC: -173, dustTau: 3 }, 'moon'), { frost: 0, dust: 0 });
});

test('terrain weather: Earth snow and frost nights frost the ground, warm days do not', () => {
  const snow = terrainWeatherFromState({ tempC: -3, rhPct: 90, rainMmH: 2, snow: true, dustTau: 0.05 }, 'earth');
  assert.ok(snow.frost >= 0.8 && snow.dust === 0, JSON.stringify(snow));
  const frostNight = terrainWeatherFromState({ tempC: -6, rhPct: 85, rainMmH: 0, snow: false, dustTau: 0.08 }, 'earth');
  assert.ok(frostNight.frost > 0.3, JSON.stringify(frostNight));
  const dryCold = terrainWeatherFromState({ tempC: -6, rhPct: 20, rainMmH: 0, dustTau: 0.08 }, 'earth');
  assert.ok(dryCold.frost < 0.05);
  const clear = terrainWeatherFromState({ tempC: 25, rhPct: 30, rainMmH: 0, dustTau: 0.1 }, 'earth');
  assert.deepEqual(clear, { frost: 0, dust: 0 });
});

test('terrain weather: dust follows optical depth above the body background', () => {
  const haboob = terrainWeatherFromState({ tempC: 38, rhPct: 12, dustTau: 4 }, 'earth');
  assert.ok(haboob.dust > 0.5);
  const rainyDust = terrainWeatherFromState({ tempC: 20, dustTau: 4, rainMmH: 3 }, 'earth');
  assert.ok(rainyDust.dust < haboob.dust);
  const marsNormal = terrainWeatherFromState({ tempC: -25, dustTau: 0.5 }, 'mars');
  assert.equal(marsNormal.dust, 0);
  const globalStorm = terrainWeatherFromState({ tempC: -35, dustTau: 8 }, 'mars');
  assert.ok(globalStorm.dust > 0.8 && globalStorm.dust <= 1);
});

test('terrain weather: Mars frost only on very cold nights, capped', () => {
  assert.equal(terrainWeatherFromState({ tempC: -25, dustTau: 0.5 }, 'mars').frost, 0);
  const cold = terrainWeatherFromState({ tempC: -120, dustTau: 0.5 }, 'mars');
  assert.ok(cold.frost > 0.3 && cold.frost <= 0.4, JSON.stringify(cold));
  // body falls back to weather.body
  assert.equal(terrainWeatherFromState({ body: 'moon', tempC: -200 }).frost, 0);
});

function stubTHREE() {
  class Vec { constructor(...a) { this.a = a; } set(...a) { this.a = a; return this; } }
  return { Vector2: Vec, Vector3: Vec, Vector4: Vec, Color: class { constructor(hex) { this.hex = hex; } } };
}

test('patchTerrainMaterial sets onBeforeCompile and a cache key, and injects the chunks', () => {
  const THREE = stubTHREE();
  const material = { userData: {} };
  patchTerrainMaterial(material, THREE, { body: 'mars', unitsPerMeter: 0.1, exag: 2 });
  assert.equal(typeof material.onBeforeCompile, 'function');
  assert.equal(typeof material.customProgramCacheKey, 'function');
  assert.match(material.customProgramCacheKey(), /selene-terrain/);
  assert.equal(material.needsUpdate, true);
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main(){\n#include <project_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main(){\n#include <color_fragment>\n#include <normal_fragment_maps>\n}',
  };
  material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.uTerrainFrost && shader.uniforms.uTerrainExag.value === 2);
  assert.match(shader.vertexShader, /vTerrainPos = transformed/);
  assert.match(shader.fragmentShader, /tPerturb\(-vViewPosition/);
  assert.match(shader.fragmentShader, /diffuseColor\.rgb = col/);
});

test('patchTerrainMaterial is idempotent and setTerrainWeather clamps', () => {
  const THREE = stubTHREE();
  const material = { userData: {} };
  patchTerrainMaterial(material, THREE, { body: 'earth' });
  const hook = material.onBeforeCompile;
  patchTerrainMaterial(material, THREE, { body: 'moon' });
  assert.equal(material.onBeforeCompile, hook);
  assert.equal(material.userData.terrainBody, 'moon');
  assert.equal(setTerrainWeather(material, { frost: 3, dust: -1 }), true);
  assert.equal(material.userData.terrainUniforms.uTerrainFrost.value, 1);
  assert.equal(material.userData.terrainUniforms.uTerrainDust.value, 0);
  assert.equal(setTerrainWeather({}, { frost: 1 }), false);
});
