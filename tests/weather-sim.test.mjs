import test from 'node:test';
import assert from 'node:assert/strict';
import {
  weatherFromTelemetry, PRESETS, presetWeather, applyWeatherToRover, describeWeather,
  beerLambertFactor, cloudFactor, estimateDustTau, estimateVisibilityKm, panelDustStep, windForceN, AIR_DENSITY,
} from '../weather-sim.mjs';
import { driveLoadW } from '../sim-physics.mjs';

const STATE_KEYS = ['source', 'label', 'tempC', 'rhPct', 'windMs', 'gustMs', 'windDirDeg', 'cloudPct', 'rainMmH', 'snow', 'dustTau', 'visibilityKm', 'solarFactor'];
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('todos los presets de los tres cuerpos producen un WeatherState válido', () => {
  const expected = {
    earth: ['clear', 'dust-storm', 'rain', 'frost-night', 'snow', 'heat'],
    mars: ['clear', 'regional-storm', 'global-storm', 'dust-devil', 'cold-night'],
    moon: ['day', 'night', 'psr', 'dust-blizzard'],
  };
  for (const [body, ids] of Object.entries(expected)) {
    assert.deepEqual(Object.keys(PRESETS[body]).sort(), [...ids].sort());
    for (const id of ids) {
      const w = presetWeather(id, body);
      for (const k of STATE_KEYS) assert.ok(k in w, `${body}/${id} sin ${k}`);
      assert.equal(w.source, 'simulated');
      assert.equal(w.presetId, id);
      assert.ok(typeof w.label === 'string' && w.label.length > 0);
      assert.ok(typeof w.note === 'string' && w.note.length > 10);
      assert.ok(w.solarFactor >= 0 && w.solarFactor <= 1);
      assert.ok(w.visibilityKm > 0);
      const r = applyWeatherToRover({ weather: w, body, dtSeconds: 600, speedMs: 0.3 });
      for (const k of ['solarW', 'solarFactor', 'panelDustPct', 'loadW', 'windForceN', 'visibilityKm']) assert.ok(Number.isFinite(r[k]), `${body}/${id} ${k}`);
      assert.ok(Array.isArray(r.alerts) && Array.isArray(r.notes));
      assert.ok(r.thermal && typeof r.thermal.level === 'string');
      const s = describeWeather(w, body);
      assert.ok(s.startsWith(w.label), s);
    }
  }
  assert.equal(presetWeather('nope', 'mars'), null);
});

test('valores físicos de los presets', () => {
  const haboob = presetWeather('dust-storm', 'earth');
  assert.ok(haboob.windMs >= 15 && haboob.visibilityKm < 1);
  const clear = presetWeather('clear', 'earth');
  assert.ok(clear.dustTau >= 0.05 && clear.dustTau <= 0.2);
  near(presetWeather('clear', 'mars').dustTau, 0.5);
  const reg = presetWeather('regional-storm', 'mars').dustTau;
  assert.ok(reg >= 2 && reg <= 3);
  const glob = presetWeather('global-storm', 'mars').dustTau;
  assert.ok(glob >= 5 && glob <= 10);
  assert.ok(Math.abs(presetWeather('cold-night', 'mars').tempC + 80) <= 5);
  const psr = presetWeather('psr', 'moon');
  assert.ok(Math.abs(psr.tempC + 273.15 - 40) <= 5);
  for (const id of Object.keys(PRESETS.moon)) {
    const w = presetWeather(id, 'moon');
    assert.equal(w.windMs, 0); assert.equal(w.dustTau, 0);
  }
  assert.equal(presetWeather('night', 'moon').solarFactor, 0);
  assert.equal(presetWeather('snow', 'earth').snow, true);
});

test('la ventisca de polvo lunar no existe: nota explicativa y sin partículas', () => {
  const w = presetWeather('dust-blizzard', 'moon');
  assert.equal(w.impossible, true);
  assert.equal(w.particles, 'none');
  assert.match(w.note, /electrost/);
  assert.match(w.note, /no por viento/);
  const r = applyWeatherToRover({ weather: w, body: 'moon', dtSeconds: 3600 });
  assert.equal(r.windForceN, 0);
  assert.ok(r.notes.some((n) => /electrost/.test(n)));
  assert.match(describeWeather(w, 'moon'), /no hay ventiscas/);
});

test('telemetría completa → WeatherState live', () => {
  const tel = { live: true, provider: 'meteomatics', observedAt: '2026-11-14T12:00:00Z',
    values: { temperatureC: 22, windSpeedMs: 3, windGustMs: 5, relativeHumidityPct: 35, cloudCoverPct: 10, solarRadiationWm2: 850, windDirDeg: 450, precipMm: 0 } };
  const w = weatherFromTelemetry(tel);
  for (const k of STATE_KEYS) assert.ok(k in w, k);
  assert.equal(w.source, 'live');
  assert.equal(w.complete, true);
  assert.deepEqual(w.defaulted, []);
  assert.equal(w.windDirDeg, 90);
  assert.ok(w.dustTau >= 0.05 && w.dustTau <= 0.2, `τ ${w.dustTau}`);
  assert.ok(w.solarFactor > 0.85 && w.solarFactor <= 1);
  assert.ok(w.visibilityKm > 20);
  assert.equal(w.irradianceWm2, 850);
  assert.equal(w.particles, 'none');
  assert.equal(weatherFromTelemetry({ ...tel, live: false }).source, 'snapshot');
});

test('telemetría con campos null usa valores por defecto y lo marca', () => {
  const w = weatherFromTelemetry({ live: false, values: { temperatureC: null, windSpeedMs: 4, windGustMs: null, relativeHumidityPct: null, cloudCoverPct: null, solarRadiationWm2: null } });
  assert.equal(w.source, 'snapshot');
  assert.equal(w.complete, false);
  for (const k of ['tempC', 'gustMs', 'rhPct', 'cloudPct', 'irradianceWm2']) assert.ok(w.defaulted.includes(k), k);
  assert.equal(w.tempC, 15); assert.equal(w.rhPct, 50); assert.equal(w.gustMs, 4); assert.equal(w.cloudPct, 0);
  assert.ok(typeof w.note === 'string');
  const empty = weatherFromTelemetry(null);
  assert.equal(empty.source, 'snapshot');
  assert.ok(STATE_KEYS.every((k) => k in empty));
  assert.ok(Number.isFinite(empty.dustTau) && Number.isFinite(empty.solarFactor));
  const r = applyWeatherToRover({ weather: w, body: 'earth', dtSeconds: 60 });
  assert.ok(r.notes.some((n) => /incompleta/.test(n)));
});

test('telemetría: viento seco fuerte levanta polvo, humedad y lluvia lo inhiben; noche y nieve', () => {
  const dry = weatherFromTelemetry({ live: true, values: { temperatureC: 30, windSpeedMs: 16, windGustMs: 24, relativeHumidityPct: 10, cloudCoverPct: 0, solarRadiationWm2: 600 } });
  assert.ok(dry.dustTau > 1 && dry.dustTau <= 3);
  assert.equal(dry.particles, 'dust');
  const wet = weatherFromTelemetry({ live: true, values: { temperatureC: 10, windSpeedMs: 16, windGustMs: 24, relativeHumidityPct: 90, cloudCoverPct: 100, solarRadiationWm2: 100, precipMm: 3 } });
  assert.ok(wet.dustTau < 0.2);
  assert.equal(wet.particles, 'rain');
  assert.ok(wet.solarFactor < 0.3);
  const night = weatherFromTelemetry({ live: true, values: { temperatureC: 5, windSpeedMs: 1, windGustMs: 2, relativeHumidityPct: 60, cloudCoverPct: 0, solarRadiationWm2: 0 } });
  assert.equal(night.solarFactor, 0);
  const snow = weatherFromTelemetry({ live: true, values: { temperatureC: -2, windSpeedMs: 2, windGustMs: 3, relativeHumidityPct: 90, cloudCoverPct: 100, solarRadiationWm2: 80, precipMm: 1 } });
  assert.equal(snow.snow, true);
  // Heurística: Tierra despejada siempre en 0,05–0,2 con viento flojo, para cualquier humedad
  for (const rh of [0, 20, 50, 80, 95, 100]) {
    const t = estimateDustTau({ rhPct: rh, windMs: 2, gustMs: 4 });
    assert.ok(t >= 0.05 && t <= 0.2, `HR ${rh} → τ ${t}`);
  }
});

test('Beer–Lambert: τ 0 → factor 1; τ alto → solo difusa', () => {
  near(beerLambertFactor({ tau: 0, cosZ: 0.5, fd: 0.4 }).factor, 1);
  const hi = beerLambertFactor({ tau: 30, cosZ: 1, fd: 0.4 });
  assert.ok(hi.direct < 1e-12);
  near(hi.factor, 0.4, 1e-9);
  near(hi.factor, hi.diffuse);
  const abs = beerLambertFactor({ tau: 30, cosZ: 1, fd: 0.4, diffuseAbsTau: 4 });
  near(abs.factor, abs.diffuse);
  assert.ok(abs.factor < 0.01);
  // forma exacta: exp(−τ/μ) + fd(1 − exp(−τ/μ))
  const t = 1.2, mu = 0.6, fd = 0.35, d = Math.exp(-t / mu);
  near(beerLambertFactor({ tau: t, cosZ: mu, fd }).factor, d + fd * (1 - d));
  // monótono en τ y más atenuación con sol bajo
  assert.ok(beerLambertFactor({ tau: 1, cosZ: 1, fd: 0.4 }).factor > beerLambertFactor({ tau: 2, cosZ: 1, fd: 0.4 }).factor);
  assert.ok(beerLambertFactor({ tau: 1, cosZ: 1, fd: 0.4 }).factor > beerLambertFactor({ tau: 1, cosZ: 0.3, fd: 0.4 }).factor);
  near(cloudFactor(0), 1); near(cloudFactor(100), 0.25);
});

test('visibilidad: Luna sin atmósfera al tope; polvo y lluvia la reducen', () => {
  assert.equal(estimateVisibilityKm({ dustTau: 5, body: 'moon' }), 100);
  assert.ok(estimateVisibilityKm({ dustTau: 0.1 }) > estimateVisibilityKm({ dustTau: 0.1, rainMmH: 10 }));
  assert.ok(estimateVisibilityKm({ dustTau: 0.05, rainMmH: 2, snow: true }) < estimateVisibilityKm({ dustTau: 0.05, rainMmH: 2 }));
});

test('polvo en el panel: crece con τ, se satura y se limpia con ráfagas o lluvia', () => {
  const day = 88775;
  const a = panelDustStep({ panelDustPct: 0, dustTau: 0.5, windMs: 0, body: 'mars', dtSeconds: day });
  near(a.panelDustPct, 0.28, 1e-9);
  const b = panelDustStep({ panelDustPct: 0, dustTau: 2.5, windMs: 0, body: 'mars', dtSeconds: day });
  assert.ok(b.panelDustPct > 4 * a.panelDustPct);
  const windy = panelDustStep({ panelDustPct: 0, dustTau: 0.5, windMs: 20, gustMs: 15, body: 'mars', dtSeconds: day });
  assert.ok(windy.panelDustPct > a.panelDustPct);
  let p = 0;
  for (let i = 0; i < 200; i++) p = panelDustStep({ panelDustPct: p, dustTau: 8, windMs: 10, gustMs: 15, body: 'mars', dtSeconds: day }).panelDustPct;
  assert.ok(p > 50 && p <= 100);
  const clean = panelDustStep({ panelDustPct: 40, dustTau: 1, windMs: 8, gustMs: 30, body: 'mars', dtSeconds: day });
  assert.equal(clean.cleaning, 'gust');
  assert.ok(clean.panelDustPct < 40);
  const storm = panelDustStep({ panelDustPct: 40, dustTau: 8, windMs: 10, gustMs: 30, body: 'mars', dtSeconds: day });
  assert.equal(storm.cleaning, null, 'en plena tormenta las ráfagas depositan, no limpian');
  const rain = panelDustStep({ panelDustPct: 40, dustTau: 0.05, rainMmH: 5, body: 'earth', dtSeconds: 3600 });
  assert.equal(rain.cleaning, 'rain');
  assert.ok(rain.panelDustPct < 20);
  assert.equal(panelDustStep({ panelDustPct: 10, dustTau: 0, body: 'moon', dtSeconds: 1e7 }).panelDustPct, 10);
  // El polvo resta energía
  const w = presetWeather('clear', 'mars');
  const r0 = applyWeatherToRover({ weather: w, body: 'mars', panelDustPct: 0 });
  const r50 = applyWeatherToRover({ weather: w, body: 'mars', panelDustPct: 50 });
  near(r50.solarW, r0.solarW / 2, 0.02);
  assert.ok(applyWeatherToRover({ weather: presetWeather('dust-devil', 'mars'), body: 'mars', panelDustPct: 40, dtSeconds: day }).notes.some((n) => /cleaning events/.test(n)));
});

test('fuerza del viento: ½ρv²CdA; la Luna no tiene fuerza de viento', () => {
  near(windForceN({ windMs: 10, body: 'earth', cd: 1, areaM2: 1 }), 0.5 * 1.2 * 100);
  assert.equal(AIR_DENSITY.moon, 0);
  assert.equal(windForceN({ windMs: 50, body: 'moon' }), 0);
  for (const id of Object.keys(PRESETS.moon)) {
    assert.equal(applyWeatherToRover({ weather: presetWeather(id, 'moon'), body: 'moon', dtSeconds: 60 }).windForceN, 0);
  }
  const marsF = windForceN({ windMs: 25, body: 'mars' });
  const earthF = windForceN({ windMs: 25, body: 'earth' });
  near(earthF / marsF, 60, 1e-9);
  const haboob = applyWeatherToRover({ weather: presetWeather('dust-storm', 'earth'), body: 'earth' });
  assert.ok(haboob.alerts.some((a) => a.code === 'gusts' && /mástil/.test(a.text)));
  assert.ok(haboob.alerts.some((a) => a.text === 'visibilidad < 1 km: navegación por cámaras degradada'));
  const reg = applyWeatherToRover({ weather: presetWeather('regional-storm', 'mars'), body: 'mars' });
  assert.ok(!reg.alerts.some((a) => a.code === 'gusts'));
});

test('tormenta global marciana: energía por debajo del consumo de aviónica', () => {
  const avionics = driveLoadW({ speedMs: 0 });
  for (const sunElevationDeg of [20, 45, 90]) {
    const r = applyWeatherToRover({ weather: presetWeather('global-storm', 'mars'), body: 'mars', sunElevationDeg });
    assert.ok(r.solarW < avionics, `elev ${sunElevationDeg}: ${r.solarW} W ≥ ${avionics} W`);
    assert.ok(r.alerts.some((a) => a.text.startsWith('energía crítica: tormenta global')));
  }
  const clear = applyWeatherToRover({ weather: presetWeather('clear', 'mars'), body: 'mars' });
  assert.ok(clear.solarW > avionics);
});

test('térmico, carga y noche', () => {
  const night = applyWeatherToRover({ weather: presetWeather('cold-night', 'mars'), body: 'mars' });
  assert.equal(night.solarW, 0);
  assert.equal(night.thermal.level, 'critical');
  assert.ok(night.loadW > 40, 'calefactores');
  assert.ok(night.alerts.some((a) => a.code === 'thermal'));
  const clear = applyWeatherToRover({ weather: presetWeather('clear', 'earth'), body: 'earth' });
  assert.equal(clear.thermal.level, 'nominal');
  assert.equal(clear.alerts.length, 0);
  const snowy = applyWeatherToRover({ weather: presetWeather('snow', 'earth'), body: 'earth', speedMs: 0.5 });
  const dryLoad = applyWeatherToRover({ weather: { ...presetWeather('snow', 'earth'), snow: false, rainMmH: 0 }, body: 'earth', speedMs: 0.5 });
  assert.ok(snowy.loadW > dryLoad.loadW);
  // Telemetría con radiación medida: se usa la medida
  const live = weatherFromTelemetry({ live: true, values: { temperatureC: 20, windSpeedMs: 2, windGustMs: 3, relativeHumidityPct: 30, cloudCoverPct: 0, solarRadiationWm2: 500 } });
  near(applyWeatherToRover({ weather: live, body: 'earth' }).solarW, 500 * 2 * 0.28, 0.01);
});

test('describeWeather: frase en español con porcentajes', () => {
  const s = describeWeather(presetWeather('regional-storm', 'mars'), 'mars');
  assert.match(s, /^Tormenta de polvo regional: el cielo bloquea ~\d+ % del sol directo; el rover recibe un \d+ % de su energía normal\./);
  assert.match(describeWeather(presetWeather('dust-storm', 'earth'), 'earth'), /visibilidad baja a unos \d+ m/);
  assert.match(describeWeather(presetWeather('night', 'moon'), 'moon'), /noche/);
  assert.match(describeWeather(presetWeather('psr', 'moon'), 'moon'), /nunca llega el sol/);
  assert.match(describeWeather(presetWeather('day', 'moon'), 'moon'), /sin atmósfera/);
  assert.equal(describeWeather(null), 'Sin datos de clima.');
});
