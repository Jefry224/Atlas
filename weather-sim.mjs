// A.R.E.S. Twin · «Modo simulación de clima» (docs/contracts.md §8). Módulo ES puro, sin DOM.
//
// Produce WeatherState a partir de la telemetría real (§3) o de presets por cuerpo, y traduce ese estado a
// su efecto sobre el rover (energía, polvo en paneles, viento, térmico, visibilidad).
// Es un modelo DIDÁCTICO de primer orden: los umbrales son ilustrativos y están documentados junto a cada
// constante. No sustituye a un modelo radiativo ni a datos de ingeniería.
//
// WeatherState (§8) + campos extra opcionales que este módulo añade y que los consumidores pueden ignorar:
//   body, presetId, note, particles ('none'|'dust'|'rain'|'snow'|'devil'), sunElevationDeg,
//   irradianceWm2 (medida, solo telemetría), defaulted:[campos], complete, impossible, observedAt, provider.
import { BODY_ENV, solarPowerW, driveLoadW, thermalStatus } from './sim-physics.mjs';
import { saltationState, windThreshold } from './processes.mjs';

const DEG = Math.PI / 180;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d = 2) => (finite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const normBody = (b) => (b === 'mars' || b === 'moon' ? b : 'earth');
const pctEs = (f) => `${Math.round(f * 100)} %`;
const numEs = (v, d = 0) => (finite(v) ? v.toFixed(d).replace('.', ',').replace(/^-0$/, '0') : '—');

/** Densidad del aire en superficie (kg/m³): Tierra ~1,2 (nivel del mar); Marte ~0,015–0,02 (≈0,6 kPa CO₂); Luna 0. */
export const AIR_DENSITY = Object.freeze({ earth: 1.2, mars: 0.02, moon: 0 });

/**
 * Parámetros ópticos por cuerpo.
 * - fd: fracción del haz extinguido que vuelve como luz difusa (Marte 0,3–0,5 según la radiación difusa
 *   medida por Pathfinder/MER; Tierra ~0,5 para aerosol dispersivo; Luna 0, sin atmósfera).
 * - diffuseAbsTau: escala (heurística) con la que el polvo absorbe también la luz difusa (albedo de
 *   dispersión simple < 1): con tau muy alto la difusa cae y la superficie queda en penumbra, como en la
 *   tormenta global de 2018 (Opportunity pasó de ~600 Wh/sol a ~20 Wh/sol).
 * - transmittanceClean: transmitancia del cielo limpio sin polvo (gases + Rayleigh); Tierra ~0,75.
 * - aerosolScaleKm / liftedScaleKm: altura de escala del aerosol de fondo y del polvo levantado por el viento
 *   (concentrado cerca del suelo), para pasar de tau a extinción σ ≈ tau/H.
 * - backgroundTau: tau de fondo «normal»; lo que supera esto se considera polvo levantado cerca del suelo.
 */
export const OPTICS = Object.freeze({
  earth: Object.freeze({ fd: 0.5, diffuseAbsTau: 4, transmittanceClean: 0.75, aerosolScaleKm: 1.5, liftedScaleKm: 0.5, backgroundTau: 0.2 }),
  mars: Object.freeze({ fd: 0.4, diffuseAbsTau: 4, transmittanceClean: 1, aerosolScaleKm: 11, liftedScaleKm: 2, backgroundTau: 0.6 }),
  moon: Object.freeze({ fd: 0, diffuseAbsTau: Infinity, transmittanceClean: 1, aerosolScaleKm: Infinity, liftedScaleKm: Infinity, backgroundTau: 0 }),
});

/** Umbrales ilustrativos (no de ingeniería) usados por las alertas y la acumulación de polvo. */
export const WEATHER_THRESHOLDS = Object.freeze({
  defaultSunElevationDeg: 45,   // elevación solar de referencia para solarFactor si no se da otra
  maxVisibilityKm: 100,         // tope de visibilidad (horizonte práctico de la escena)
  lowVisibilityKm: 1,           // < 1 km: navegación por cámaras degradada
  mastForceN: 200,              // fuerza de ráfaga sobre rover+mástil que se marca como riesgo
  lowEnergyFactor: 0.5,         // solarFactor < 0,5: energía baja
  panelDustAlertPct: 30,        // polvo en paneles que dispara aviso
  heaterSetpointK: 253.15,      // −20 °C: por debajo se encienden calefactores
  heaterWPerK: 0.5,             // W por kelvin bajo el punto de consigna
  heaterMaxW: 80,
  dragCd: 1.2, frontalAreaM2: 1.5, // coeficiente de arrastre y área frontal rover + mástil
});

/**
 * Polvo en paneles. Tasa de referencia en %/día a tauRef:
 * - Marte 0,28 %/sol con tau ~0,5 (Landis & Jenkins 2000, Mars Pathfinder; MER del mismo orden).
 * - Tierra 0,3 %/día con tau ~0,1 (soiling de desiertos ~0,1–1 %/día; ilustrativo).
 * - Luna 0: no hay transporte eólico; el polvo se mueve por carga electrostática e impactos (despreciable aquí).
 * Limpieza: ráfagas fuertes con aire relativamente limpio (los «cleaning events» de Spirit/Opportunity,
 * atribuidos a remolinos y ráfagas) y, en la Tierra, la lluvia. Se modela como decaimiento exponencial.
 */
export const PANEL_DUST = Object.freeze({
  earth: Object.freeze({ basePctPerDay: 0.3, tauRef: 0.1, windRefMs: 10, dayS: 86400, cleanGustMs: 15, cleanMaxTau: 0.5, cleanEfoldS: 86400, rainCleanMmH: 1, rainEfoldS: 3600 }),
  mars: Object.freeze({ basePctPerDay: 0.28, tauRef: 0.5, windRefMs: 20, dayS: 88775, cleanGustMs: 20, cleanMaxTau: 1.5, cleanEfoldS: 88775, rainCleanMmH: Infinity, rainEfoldS: Infinity }),
  moon: Object.freeze({ basePctPerDay: 0, tauRef: 1, windRefMs: 1, dayS: 2551443, cleanGustMs: Infinity, cleanMaxTau: 0, cleanEfoldS: Infinity, rainCleanMmH: Infinity, rainEfoldS: Infinity }),
});

/** Valores por defecto cuando falta un campo de telemetría (se listan en `defaulted`). */
export const TELEMETRY_DEFAULTS = Object.freeze({ tempC: 15, rhPct: 50, windMs: 0, windDirDeg: 0, cloudPct: 0, rainMmH: 0 });

// ---------------------------------------------------------------------------------------------------------
// Óptica

/**
 * Factor de irradiancia respecto a cielo sin polvo (Beer–Lambert sobre el haz directo + difusa simple):
 *   I/I0 = exp(−τ/cosZ) + fd · e^(−τ/τabs) · (1 − exp(−τ/cosZ))
 * Ley de Beer–Lambert–Bouguer para el haz directo (masa de aire ≈ 1/cosZ); la fracción fd del haz
 * extinguido llega como difusa (Marte fd ≈ 0,3–0,5). El término e^(−τ/τabs) es una corrección heurística por
 * absorción del propio polvo (diffuseAbsTau = Infinity la desactiva y deja la fórmula clásica).
 * τ = 0 → 1. τ alto → solo queda la difusa (el directo → 0).
 */
export function beerLambertFactor({ tau = 0, cosZ = Math.sin(WEATHER_THRESHOLDS.defaultSunElevationDeg * DEG), fd = 0.4, diffuseAbsTau = Infinity } = {}) {
  const t = finite(tau) ? Math.max(0, tau) : 0;
  const mu = finite(cosZ) ? clamp(cosZ, 0.05, 1) : Math.SQRT1_2; // cosZ mínimo 0,05 (masa de aire ≤ 20)
  const f = finite(fd) ? clamp(fd, 0, 1) : 0;
  const direct = Math.exp(-t / mu);
  const absorb = finite(diffuseAbsTau) && diffuseAbsTau > 0 ? Math.exp(-t / diffuseAbsTau) : 1;
  return { factor: direct + f * absorb * (1 - direct), direct, diffuse: f * absorb * (1 - direct), blockedDirect: 1 - direct };
}

/** Nubosidad (Tierra): Kasten & Czeplak (1980), G/G_despejado = 1 − 0,75·N^3,4 con N = fracción nubosa. */
export function cloudFactor(cloudPct) {
  const n = finite(cloudPct) ? clamp(cloudPct, 0, 100) / 100 : 0;
  return 1 - 0.75 * n ** 3.4;
}

/** solarFactor del estado: dust (Beer–Lambert) × nubes (solo Tierra); 0 si el Sol está bajo el horizonte. */
export function solarFactorFor({ dustTau, cloudPct = 0, sunElevationDeg, body = 'earth' }) {
  const b = normBody(body);
  const elev = finite(sunElevationDeg) ? sunElevationDeg : WEATHER_THRESHOLDS.defaultSunElevationDeg;
  if (elev <= 0) return 0;
  const o = OPTICS[b];
  const dust = beerLambertFactor({ tau: dustTau, cosZ: Math.sin(elev * DEG), fd: o.fd, diffuseAbsTau: o.diffuseAbsTau }).factor;
  return dust * (b === 'earth' ? cloudFactor(cloudPct) : 1);
}

/**
 * Visibilidad horizontal (km) por Koschmieder: V = 3,912 / σ, con σ (km⁻¹) =
 *   τ_fondo/H_fondo + τ_levantado/H_levantado   (polvo)
 * + 0,25·R^0,63 (lluvia, R en mm/h) | 1,2·R^0,6 (nieve, equivalente en agua)   [relaciones empíricas aproximadas]
 * + 4 si HR ≥ 97 % y viento < 3 m/s (niebla, V ≈ 1 km).
 * Luna: sin atmósfera, limita solo el horizonte (tope maxVisibilityKm).
 */
export function estimateVisibilityKm({ dustTau = 0, rhPct, windMs, rainMmH = 0, snow = false, body = 'earth' } = {}) {
  const b = normBody(body);
  const cap = WEATHER_THRESHOLDS.maxVisibilityKm;
  if (b === 'moon') return cap;
  const o = OPTICS[b];
  const tau = finite(dustTau) ? Math.max(0, dustTau) : 0;
  let sigma = Math.min(tau, o.backgroundTau) / o.aerosolScaleKm + Math.max(0, tau - o.backgroundTau) / o.liftedScaleKm;
  const r = finite(rainMmH) ? Math.max(0, rainMmH) : 0;
  if (r > 0) sigma += snow ? 1.2 * r ** 0.6 : 0.25 * r ** 0.63;
  if (b === 'earth' && finite(rhPct) && rhPct >= 97 && (!finite(windMs) || windMs < 3)) sigma += 4;
  return sigma > 0 ? Math.min(cap, 3.912 / sigma) : cap;
}

/**
 * Heurística prudente de τ del aire en la Tierra a partir de la telemetría:
 *  1. Fondo continental 0,08 (AOD típico 0,05–0,2).
 *  2. Crecimiento higroscópico: × (1 − HR)^(−0,3), HR acotada a 95 % → como mucho ×2,45 (≈0,2).
 *  3. Polvo levantado: solo si saltationState (processes.mjs) da 'sustained' o 'intermittent' y la superficie
 *     está seca: + 0,02·(U − Ut)² con el viento medio (sostenida) o 0,01·(G − Ut)² con la ráfaga
 *     (intermitente); Ut ≈ 5,4 m/s a 10 m. Tope total 3 (no se inventan haboobs desde telemetría puntual).
 *  4. Lavado por lluvia: × 0,7 si hay precipitación.
 * Las nubes NO suman τ de polvo (entran por Kasten–Czeplak en solarFactor, para no contar dos veces);
 * nubosidad alta + HR alta entran en la visibilidad como niebla.
 */
export function estimateDustTau({ rhPct = TELEMETRY_DEFAULTS.rhPct, windMs = 0, gustMs, precipMm = 0, cloudPct } = {}) {
  const rh = finite(rhPct) ? clamp(rhPct, 0, 95) : TELEMETRY_DEFAULTS.rhPct;
  let tau = 0.08 * (1 - rh / 100) ** -0.3;
  const salt = saltationState({ windMs, gustMs, rhPct, precipMm });
  const ut = windThreshold();
  if (salt.level === 'sustained') tau += 0.02 * (windMs - ut) ** 2;
  else if (salt.level === 'intermittent' && finite(gustMs)) tau += 0.01 * (gustMs - ut) ** 2;
  if (finite(precipMm) && precipMm > 0) tau *= 0.7;
  void cloudPct; // documentado arriba: no suma τ
  return clamp(tau, 0.03, 3);
}

// ---------------------------------------------------------------------------------------------------------
// Telemetría → WeatherState

/**
 * Convierte la respuesta de /api/telemetry (§3) en WeatherState.
 * source = 'live' si telemetry.live === true, si no 'snapshot'. Campos de §3 ausentes/null → TELEMETRY_DEFAULTS
 * (ráfaga ausente = viento medio) y se listan en `defaulted` (tempC, rhPct, windMs, gustMs, cloudPct,
 * irradianceWm2); `complete` es false si falta alguno. windDirDeg y precipMm son opcionales: si faltan
 * valen 0 sin marcarse. Nieve si precipitación > 0 y T ≤ 0,5 °C. Radiación medida ≤ 5 W/m² → noche.
 * `irradianceWm2` conserva la radiación medida (o null): applyWeatherToRover la usa si existe.
 */
export function weatherFromTelemetry(telemetry, { body = 'earth' } = {}) {
  const b = normBody(body);
  const v = telemetry?.values ?? {};
  const defaulted = [];
  const pick = (val, key) => {
    if (finite(val)) return val;
    defaulted.push(key);
    return TELEMETRY_DEFAULTS[key];
  };
  const tempC = pick(v.temperatureC, 'tempC');
  const rhPct = clamp(pick(v.relativeHumidityPct, 'rhPct'), 0, 100);
  const windMs = Math.max(0, pick(v.windSpeedMs, 'windMs'));
  let gustMs;
  if (finite(v.windGustMs)) gustMs = Math.max(windMs, v.windGustMs);
  else { defaulted.push('gustMs'); gustMs = windMs; }
  // windDirDeg y precipMm son opcionales en §3: si faltan se usan los valores por defecto sin marcarlos.
  const windDirDeg = finite(v.windDirDeg) ? ((v.windDirDeg % 360) + 360) % 360 : TELEMETRY_DEFAULTS.windDirDeg;
  const cloudPct = clamp(pick(v.cloudCoverPct, 'cloudPct'), 0, 100);
  const rainMmH = finite(v.precipMm) ? Math.max(0, v.precipMm) : TELEMETRY_DEFAULTS.rainMmH;
  const irradianceWm2 = finite(v.solarRadiationWm2) ? Math.max(0, v.solarRadiationWm2) : null;
  if (irradianceWm2 === null) defaulted.push('irradianceWm2');
  const snow = rainMmH > 0 && tempC <= 0.5;
  const dustTau = estimateDustTau({ rhPct, windMs, gustMs, precipMm: rainMmH, cloudPct });
  const daylight = irradianceWm2 === null ? true : irradianceWm2 > 5;
  const sunElevationDeg = daylight ? WEATHER_THRESHOLDS.defaultSunElevationDeg : -10;
  // Partículas visibles solo si el polvo levantado es apreciable (τ ≥ 0,3), no por una ráfaga suelta.
  const particles = snow ? 'snow' : rainMmH > 0 ? 'rain' : dustTau >= 0.3 ? 'dust' : 'none';
  const live = telemetry?.live === true;
  return {
    source: live ? 'live' : 'snapshot',
    label: live ? 'Clima real (en vivo)' : 'Clima real (instantánea)',
    tempC, rhPct, windMs, gustMs, windDirDeg, cloudPct, rainMmH, snow,
    dustTau: round(dustTau, 3),
    visibilityKm: round(estimateVisibilityKm({ dustTau, rhPct, windMs, rainMmH, snow, body: b }), 2),
    solarFactor: round(solarFactorFor({ dustTau, cloudPct, sunElevationDeg, body: b }), 3),
    body: b, presetId: null, particles, sunElevationDeg, irradianceWm2,
    defaulted, complete: defaulted.length === 0,
    observedAt: telemetry?.observedAt ?? null, provider: telemetry?.provider ?? null,
    note: defaulted.length ? `Faltan datos (${defaulted.join(', ')}): se usan valores por defecto.` : null,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Presets

const P = (o) => Object.freeze(o);
/**
 * Presets por cuerpo. Valores representativos redondeados (no de un sitio concreto). sunElevationDeg ≤ 0 = noche.
 * visibilityKm y solarFactor se derivan con estimateVisibilityKm / solarFactorFor salvo que el preset fije
 * `visibilityKm` explícito.
 */
export const PRESETS = Object.freeze({
  earth: Object.freeze({
    clear: P({ label: 'Despejado', tempC: 25, rhPct: 30, windMs: 3, gustMs: 6, windDirDeg: 270, cloudPct: 5, rainMmH: 0, snow: false, dustTau: 0.1, sunElevationDeg: 50, particles: 'none',
      note: 'Aerosol de fondo τ ≈ 0,1: el cielo deja pasar casi todo el sol directo.' }),
    'dust-storm': P({ label: 'Tormenta de polvo (haboob)', tempC: 38, rhPct: 12, windMs: 18, gustMs: 28, windDirDeg: 200, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 4, sunElevationDeg: 40, particles: 'dust',
      note: 'Un haboob es un muro de polvo empujado por la corriente fría de una tormenta: viento ≥ 15 m/s y visibilidad < 1 km.' }),
    rain: P({ label: 'Lluvia', tempC: 12, rhPct: 95, windMs: 6, gustMs: 12, windDirDeg: 250, cloudPct: 100, rainMmH: 8, snow: false, dustTau: 0.05, sunElevationDeg: 40, particles: 'rain',
      note: 'La lluvia lava el aerosol y limpia los paneles, pero las nubes cortan ~75 % de la radiación y el suelo se vuelve resbaladizo.' }),
    'frost-night': P({ label: 'Noche de helada', tempC: -6, rhPct: 85, windMs: 1, gustMs: 2, windDirDeg: 0, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 0.08, sunElevationDeg: -20, particles: 'none',
      note: 'Cielo despejado y viento en calma: el suelo irradia calor al espacio y baja de 0 °C (enfriamiento radiativo).' }),
    snow: P({ label: 'Nevada', tempC: -3, rhPct: 90, windMs: 5, gustMs: 10, windDirDeg: 330, cloudPct: 100, rainMmH: 2, snow: true, dustTau: 0.05, sunElevationDeg: 25, particles: 'snow',
      note: 'La nieve reduce la visibilidad mucho más que la lluvia y aumenta la resistencia a la rodadura.' }),
    heat: P({ label: 'Ola de calor', tempC: 46, rhPct: 8, windMs: 4, gustMs: 8, windDirDeg: 90, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 0.25, sunElevationDeg: 70, particles: 'none',
      note: 'Calima por aire seco y caliente; la electrónica se acerca a su límite superior (≈ 50 °C).' }),
  }),
  mars: Object.freeze({
    clear: P({ label: 'Cielo marciano normal', tempC: -25, rhPct: 0, windMs: 5, gustMs: 10, windDirDeg: 270, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 0.5, sunElevationDeg: 50, particles: 'none',
      note: 'Incluso «despejado», Marte tiene τ ≈ 0,5 de polvo en suspensión: por eso su cielo es color caramelo.' }),
    'regional-storm': P({ label: 'Tormenta de polvo regional', tempC: -30, rhPct: 0, windMs: 15, gustMs: 25, windDirDeg: 200, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 2.5, sunElevationDeg: 45, particles: 'dust',
      note: 'Las tormentas regionales (τ ≈ 2–3) cubren miles de km y duran días o semanas.' }),
    'global-storm': P({ label: 'Tormenta global de polvo', tempC: -35, rhPct: 0, windMs: 10, gustMs: 20, windDirDeg: 180, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 8, sunElevationDeg: 45, particles: 'dust',
      note: 'En 2018 una tormenta global (τ > 10) dejó sin energía a Opportunity, que no volvió a despertar.' }),
    'dust-devil': P({ label: 'Remolino de polvo', tempC: -15, rhPct: 0, windMs: 8, gustMs: 30, windDirDeg: 90, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 1, sunElevationDeg: 60, particles: 'devil',
      note: 'Los remolinos de polvo marcianos limpiaron varias veces los paneles de Spirit y Opportunity («cleaning events»).' }),
    'cold-night': P({ label: 'Noche marciana', tempC: -80, rhPct: 0, windMs: 3, gustMs: 6, windDirDeg: 0, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 0.5, sunElevationDeg: -20, particles: 'none',
      note: 'La atmósfera fina apenas guarda calor: las noches bajan a ≈ −80 °C y los calefactores consumen batería.' }),
  }),
  moon: Object.freeze({
    day: P({ label: 'Día lunar', tempC: 117, rhPct: 0, windMs: 0, gustMs: 0, windDirDeg: 0, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 0, sunElevationDeg: 45, particles: 'none',
      note: 'Sin atmósfera no hay viento, nubes ni polvo en el aire; al mediodía ecuatorial el suelo llega a ≈ 390 K.' }),
    night: P({ label: 'Noche lunar', tempC: -173, rhPct: 0, windMs: 0, gustMs: 0, windDirDeg: 0, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 0, sunElevationDeg: -30, particles: 'none',
      note: 'La noche lunar dura ≈ 14 días terrestres y el suelo baja a ≈ 100 K (−173 °C).' }),
    psr: P({ label: 'Sombra permanente (PSR)', tempC: -233, rhPct: 0, windMs: 0, gustMs: 0, windDirDeg: 0, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 0, sunElevationDeg: -5, particles: 'none',
      note: 'Cráteres polares donde nunca da el sol: ≈ 40 K (LRO Diviner), lugares fríos que pueden guardar hielo de agua.' }),
    'dust-blizzard': P({ label: 'Ventisca de polvo (no existe en la Luna)', tempC: 117, rhPct: 0, windMs: 0, gustMs: 0, windDirDeg: 0, cloudPct: 0, rainMmH: 0, snow: false, dustTau: 0, sunElevationDeg: 45, particles: 'none', impossible: true,
      note: 'En la Luna no hay ventiscas: sin aire no hay viento. El polvo lunar se mueve por carga electrostática (terminador día/noche) y por impactos de micrometeoritos, no por viento.' }),
  }),
});

/**
 * WeatherState de un preset. id desconocido → null. El preset lunar 'dust-blizzard' devuelve el estado del
 * día lunar sin partículas, con impossible:true y la nota explicativa.
 */
export function presetWeather(id, body = 'earth') {
  const b = normBody(body);
  const p = PRESETS[b][id];
  if (!p) return null;
  const { note, particles, sunElevationDeg, impossible, visibilityKm, ...w } = p;
  return {
    source: 'simulated', ...w,
    visibilityKm: round(finite(visibilityKm) ? visibilityKm : estimateVisibilityKm({ ...w, body: b }), 2),
    solarFactor: round(solarFactorFor({ dustTau: w.dustTau, cloudPct: w.cloudPct, sunElevationDeg, body: b }), 3),
    body: b, presetId: id, particles, sunElevationDeg, irradianceWm2: null,
    impossible: impossible === true, note, defaulted: [], complete: true,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Efecto sobre el rover

/** Fuerza aerodinámica F = ½·ρ·v²·Cd·A (N), ρ según AIR_DENSITY del cuerpo (Luna 0 → 0 N). */
export function windForceN({ windMs, body = 'earth', cd = WEATHER_THRESHOLDS.dragCd, areaM2 = WEATHER_THRESHOLDS.frontalAreaM2 } = {}) {
  const v = finite(windMs) ? Math.abs(windMs) : 0;
  return 0.5 * AIR_DENSITY[normBody(body)] * v * v * cd * areaM2;
}

/**
 * Un paso de polvo en paneles (Euler):
 *   depósito = tasaBase · (τ/τref) · (1 + 0,5·min(1, viento/vref)) · (1 − P/100) · dt/día
 *   limpieza = P · (1 − exp(−dt/τlimpieza))  si ráfaga ≥ umbral y τ ≤ τmáx (o lluvia ≥ 1 mm/h en la Tierra)
 * Devuelve { panelDustPct, cleaning, depositPct, removedPct }.
 */
export function panelDustStep({ panelDustPct = 0, dustTau = 0, windMs = 0, gustMs, rainMmH = 0, body = 'earth', dtSeconds = 0 } = {}) {
  const b = normBody(body);
  const c = PANEL_DUST[b];
  const p0 = finite(panelDustPct) ? clamp(panelDustPct, 0, 100) : 0;
  const dt = finite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
  const tau = finite(dustTau) ? Math.max(0, dustTau) : 0;
  const wind = finite(windMs) ? Math.max(0, windMs) : 0;
  const gust = finite(gustMs) ? gustMs : wind;
  const rain = finite(rainMmH) ? rainMmH : 0;
  const deposit = c.basePctPerDay * (tau / c.tauRef) * (1 + 0.5 * Math.min(1, wind / c.windRefMs)) * (1 - p0 / 100) * dt / c.dayS;
  let removed = 0;
  let cleaning = null;
  if (rain >= c.rainCleanMmH) { removed = p0 * (1 - Math.exp(-dt / c.rainEfoldS)); cleaning = 'rain'; }
  else if (gust >= c.cleanGustMs && tau <= c.cleanMaxTau) { removed = p0 * (1 - Math.exp(-dt / c.cleanEfoldS)); cleaning = 'gust'; }
  return { panelDustPct: clamp(p0 + deposit - removed, 0, 100), cleaning, depositPct: deposit, removedPct: removed };
}

/**
 * Efecto del clima sobre el rover en un paso de simulación.
 * - Irradiancia: si weather.irradianceWm2 es una medida (telemetría) se usa tal cual; si no,
 *   I = S·T_limpio·cosZ·solarFactor (S = BODY_ENV.solarConstantWm2), con Beer–Lambert + difusa (ver
 *   beerLambertFactor). solarW = solarPowerW(I) · (1 − polvoPanel).
 * - Polvo en panel: panelDustStep. Viento: windForceN con la ráfaga (pico, para el mástil); el viento medio
 *   añade arrastre a la tracción (supuesto peor caso: de cara): P = F·v/0,6.
 * - Carga: driveLoadW (Crr 0,15; lluvia 0,20; nieve 0,25) + arrastre + calefactores
 *   (0,5 W/K bajo −20 °C, máx. 80 W).
 * - Térmico: thermalStatus de sim-physics con la temperatura ambiente.
 * alerts: [{ code, level:'critical'|'caution', text }]; notes: [texto].
 */
export function applyWeatherToRover({ weather, body, panelDustPct = 0, dtSeconds = 0, speedMs = 0, slopeDeg = 0,
  sunElevationDeg, panelAreaM2 = 2, efficiency = 0.28, massKg = 350 } = {}) {
  const b = normBody(body ?? weather?.body);
  const w = weather ?? presetWeather(b === 'moon' ? 'day' : 'clear', b);
  const env = BODY_ENV[b];
  const T = WEATHER_THRESHOLDS;
  const alerts = [];
  const notes = [];
  const elev = finite(sunElevationDeg) ? sunElevationDeg : finite(w.sunElevationDeg) ? w.sunElevationDeg : T.defaultSunElevationDeg;
  const tau = finite(w.dustTau) ? w.dustTau : 0;
  const solarFactor = solarFactorFor({ dustTau: tau, cloudPct: w.cloudPct, sunElevationDeg: elev, body: b });

  let irradiance;
  if (finite(w.irradianceWm2)) irradiance = w.irradianceWm2;
  else irradiance = elev > 0 ? env.solarConstantWm2 * OPTICS[b].transmittanceClean * Math.sin(elev * DEG) * solarFactor : 0;

  const dust = panelDustStep({ panelDustPct, dustTau: tau, windMs: w.windMs, gustMs: w.gustMs, rainMmH: w.rainMmH, body: b, dtSeconds });
  const solarW = solarPowerW({ irradianceWm2: irradiance, panelAreaM2, efficiency }) * (1 - dust.panelDustPct / 100);

  const peakForce = windForceN({ windMs: Math.max(w.windMs ?? 0, w.gustMs ?? 0), body: b });
  const meanForce = windForceN({ windMs: w.windMs, body: b });
  const crr = w.snow ? 0.25 : (w.rainMmH ?? 0) > 0 ? 0.2 : 0.15;
  const tempK = finite(w.tempC) ? w.tempC + 273.15 : null;
  const heaterW = tempK === null ? 0 : clamp((T.heaterSetpointK - tempK) * T.heaterWPerK, 0, T.heaterMaxW);
  const avionicsW = 40; // carga base por defecto de driveLoadW
  const loadW = driveLoadW({ speedMs, slopeDeg, gravityMs2: env.gravityMs2, massKg, rollingResistance: crr, avionicsW })
    + meanForce * Math.abs(finite(speedMs) ? speedMs : 0) / 0.6 + heaterW;
  const thermal = thermalStatus({ ambientK: tempK });
  const visibilityKm = finite(w.visibilityKm) ? w.visibilityKm : estimateVisibilityKm({ ...w, body: b });
  const label = (w.label ?? 'clima').toLowerCase();

  if (w.impossible) notes.push(w.note);
  if (elev <= 0) notes.push('Noche: sin generación solar, el rover consume batería.');
  else if (solarW < avionicsW) alerts.push({ code: 'energy-critical', level: 'critical', text: `energía crítica: ${label}` });
  else if (solarFactor < T.lowEnergyFactor) alerts.push({ code: 'energy-low', level: 'caution', text: `energía baja: llega el ${pctEs(solarFactor)} del sol de cielo limpio` });
  if (visibilityKm < T.lowVisibilityKm) alerts.push({ code: 'visibility', level: 'caution', text: 'visibilidad < 1 km: navegación por cámaras degradada' });
  if (peakForce >= T.mastForceN) alerts.push({ code: 'gusts', level: 'caution', text: `ráfagas: riesgo para mástil (${Math.round(peakForce)} N)` });
  if (thermal.level === 'critical' || thermal.level === 'caution') {
    alerts.push({ code: 'thermal', level: thermal.level, text: `${thermal.level === 'critical' ? 'térmico crítico' : 'térmico en precaución'}: ${thermal.text}` });
  }
  if (dust.panelDustPct >= T.panelDustAlertPct) alerts.push({ code: 'panel-dust', level: 'caution', text: `paneles con ${Math.round(dust.panelDustPct)} % de polvo: menos energía` });
  if (w.snow) alerts.push({ code: 'traction', level: 'caution', text: 'nieve: más resistencia a la rodadura y riesgo de patinaje' });
  else if ((w.rainMmH ?? 0) > 0) alerts.push({ code: 'traction', level: 'caution', text: 'lluvia: suelo resbaladizo, riesgo de patinaje' });

  if (dust.cleaning === 'gust') notes.push('Ráfagas fuertes con aire limpio: el panel se está limpiando (como los «cleaning events» de los MER).');
  if (dust.cleaning === 'rain') notes.push('La lluvia está lavando el polvo de los paneles.');
  if (b === 'mars' && (w.gustMs ?? 0) >= 10) notes.push(`Aunque sopla a ${Math.round(w.gustMs)} m/s, el aire marciano es ~60 veces menos denso: solo ${numEs(peakForce, 1)} N sobre el rover.`);
  if (b === 'moon' && !w.impossible) notes.push('Sin atmósfera: no hay viento ni polvo en suspensión.');
  if (heaterW > 0) notes.push(`Calefactores: +${Math.round(heaterW)} W para mantener la electrónica.`);
  if (Array.isArray(w.defaulted) && w.defaulted.length) notes.push(`Telemetría incompleta (${w.defaulted.join(', ')}): valores por defecto.`);

  return {
    solarW: round(solarW, 2), solarFactor: round(solarFactor, 3), panelDustPct: round(dust.panelDustPct, 4),
    loadW: round(loadW, 2), thermal, windForceN: round(peakForce, 2), visibilityKm: round(visibilityKm, 2),
    alerts, notes,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Texto para la interfaz

/** Una frase en español, para público general, que resume el clima y su efecto en la energía del rover. */
export function describeWeather(weather, body) {
  if (!weather) return 'Sin datos de clima.';
  const b = normBody(body ?? weather.body);
  const label = weather.label ?? 'Clima';
  if (weather.impossible) return `${label}: ${weather.note}`;
  const t = `${numEs(weather.tempC)} °C`;
  const elev = finite(weather.sunElevationDeg) ? weather.sunElevationDeg : WEATHER_THRESHOLDS.defaultSunElevationDeg;
  if (weather.presetId === 'psr') return `${label}: aquí nunca llega el sol; sin energía solar el rover depende de su batería a ${t}.`;
  if (elev <= 0) return `${label}: es de noche, no llega energía solar y el rover vive de su batería a ${t}.`;
  const energy = pctEs(finite(weather.solarFactor) ? weather.solarFactor : 1);
  const vis = finite(weather.visibilityKm) && weather.visibilityKm < 1 ? ` La visibilidad baja a unos ${Math.round(weather.visibilityKm * 1000 / 50) * 50} m.` : '';
  if (b === 'moon') return `${label}: sin atmósfera no hay viento ni nubes; el sol llega completo y el suelo está a ${t}.`;
  const tau = finite(weather.dustTau) ? weather.dustTau : 0;
  if (tau >= 1) {
    const blocked = beerLambertFactor({ tau, cosZ: Math.sin(elev * DEG) }).blockedDirect;
    return `${label}: el cielo bloquea ~${pctEs(blocked)} del sol directo; el rover recibe un ${energy} de su energía normal.${vis}`;
  }
  if (weather.snow) return `${label}: nieva a ${t}; las nubes dejan al rover con un ${energy} de su energía normal.${vis}`;
  if ((weather.rainMmH ?? 0) > 0) return `${label}: llueve ${numEs(weather.rainMmH, 1)} mm/h; con el cielo cubierto el rover recibe un ${energy} de su energía normal.${vis}`;
  if ((weather.cloudPct ?? 0) >= 60) return `${label}: nubes al ${Math.round(weather.cloudPct)} %; el rover recibe un ${energy} de su energía normal, a ${t}.${vis}`;
  return `${label}: viento de ${numEs(weather.windMs)} m/s y ${t}; el rover recibe un ${energy} de su energía normal.${vis}`;
}
