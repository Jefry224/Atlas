// Módulo 3 · Simulador de procesos dinámicos (polvo, viento y ciclos térmicos). Funciones puras, sin DOM.
//
// Entrada: el pronóstico horario de /api/processes/forecast (contrato §7) y, opcionalmente, la rejilla del
// objetivo (§2) con su `thermal.curve` (LRO Diviner o Mars Climate Database) y `body`.
// Reglas de honestidad:
// - La ventana térmica compara la FORMA y la FASE de la curva diurna (normalizada 0–1), nunca la temperatura
//   absoluta: ningún sitio terrestre llega a los 95–390 K de la Luna.
// - La saltación terrestre es el mismo PROCESO que alimenta las tormentas de polvo marcianas, no la misma
//   intensidad: en Marte el umbral de velocidad de fricción es ~1–1,5 m/s por la baja densidad del aire.
// - Todo pronóstico es salida de modelo, no observación.

export const KARMAN = 0.4;
export const SALTATION_DEFAULTS = Object.freeze({
  z: 10,                // altura del viento del pronóstico (m)
  z0: 5e-4,             // rugosidad aerodinámica típica de arena suelta (m)
  uStarThreshold: 0.22, // velocidad de fricción umbral, arena fina seca ~100–200 µm (Bagnold 1941; Shao & Lu 2000)
  rhSuppress: 65,       // % HR desde el que la cohesión por humedad inhibe la saltación (criterio editorial)
  precipSuppressMm: 0.2,
  recentPrecipThresholdMm: 1, // lluvia acumulada en 24 h que deja la superficie húmeda
});
export const MARS_USTAR_THRESHOLD = Object.freeze([1.0, 1.5]); // m/s (Greeley & Iversen 1985; referencia)
export const FREEZE_DEFAULTS = Object.freeze({ rateCph: -1.5, spanHours: 3 });
export const THERMAL_DEFAULTS = Object.freeze({ minScore: 85, minHours: 2, rateScale: 0.3 });

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d = 2) => (finite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const surfaceTemp = (h) => (finite(h?.groundTempC) ? h.groundTempC : finite(h?.tempC) ? h.tempC : null);

/** Velocidad de fricción u* (m/s) por perfil logarítmico: u* = κ·U(z) / ln(z/z0). */
export function frictionVelocity(windMs, { z = SALTATION_DEFAULTS.z, z0 = SALTATION_DEFAULTS.z0 } = {}) {
  if (!finite(windMs) || windMs < 0) return null;
  return KARMAN * windMs / Math.log(z / z0);
}

/** Viento a z que corresponde al umbral u*t (m/s). */
export function windThreshold(opts = {}) {
  const o = { ...SALTATION_DEFAULTS, ...opts };
  return o.uStarThreshold * Math.log(o.z / o.z0) / KARMAN;
}

/**
 * Estado de saltación eólica de una hora.
 * level: 'sustained' (viento medio ≥ umbral), 'intermittent' (solo las ráfagas), 'suppressed' (superaría el
 * umbral pero la superficie está húmeda), 'none' o 'unknown'.
 */
export function saltationState(hour, opts = {}) {
  const o = { ...SALTATION_DEFAULTS, ...opts };
  const uStar = frictionVelocity(hour?.windMs, o);
  const uStarGust = frictionVelocity(hour?.gustMs, o);
  const base = { uStar: round(uStar, 3), uStarGust: round(uStarGust, 3), threshold: o.uStarThreshold };
  if (uStar === null && uStarGust === null) return { level: 'unknown', ...base };
  let level = 'none';
  if (uStar !== null && uStar >= o.uStarThreshold) level = 'sustained';
  else if (uStarGust !== null && uStarGust >= o.uStarThreshold) level = 'intermittent';
  const wet = (finite(hour?.precipMm) && hour.precipMm >= o.precipSuppressMm)
    || (finite(hour?.rhPct) && hour.rhPct >= o.rhSuppress)
    || (finite(opts.recentPrecipMm) && opts.recentPrecipMm >= o.recentPrecipThresholdMm);
  if (level !== 'none' && wet) level = 'suppressed';
  return { level, ...base };
}

/** Hora solar local aproximada (0–24) a partir de la hora UTC y la longitud (este positivo). */
export function solarHour(isoUtc, lon) {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime()) || !finite(lon)) return null;
  const h = d.getUTCHours() + d.getUTCMinutes() / 60 + lon / 15;
  return ((h % 24) + 24) % 24;
}

/** Curva cíclica del objetivo [{hourLocal, tempK}] → función de fase (0–24) interpolada, o null. */
export function makeCurve(points) {
  const pts = (Array.isArray(points) ? points : [])
    .filter((p) => finite(p?.hourLocal) && finite(p?.tempK))
    .map((p) => ({ h: ((p.hourLocal % 24) + 24) % 24, t: p.tempK }))
    .sort((a, b) => a.h - b.h);
  if (pts.length < 6) return null;
  const temps = pts.map((p) => p.t);
  const min = Math.min(...temps), max = Math.max(...temps);
  if (!(max > min)) return null;
  const at = (phase) => {
    const x = ((phase % 24) + 24) % 24;
    let i = pts.findIndex((p) => p.h > x);
    if (i === -1) i = pts.length;
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i % pts.length];
    const span = ((b.h - a.h) + 24) % 24 || 24;
    const tt = (((x - a.h) + 24) % 24) / span;
    return a.t + (b.t - a.t) * tt;
  };
  const norm = (phase) => (at(phase) - min) / (max - min);
  const rate = (phase) => norm(phase + 0.5) - norm(phase - 0.5); // Δ normalizado por «hora» de fase
  return { at, norm, rate, min, max, points: pts.length };
}

/**
 * Puntuación (0–100) de la coincidencia de forma/fase entre la curva terrestre y la del objetivo en cada hora.
 * La Tierra se normaliza en una ventana móvil de 24 h; el objetivo en su ciclo completo, con su hora local
 * expresada como fracción de su día (24 «horas» lunares o marcianas ↔ 24 h solares terrestres).
 */
export function thermalScores(hours, curve, lon, opts = {}) {
  const o = { ...THERMAL_DEFAULTS, ...opts };
  const temps = hours.map(surfaceTemp);
  return hours.map((h, i) => {
    const phase = solarHour(h.time, lon);
    const t = temps[i];
    if (!curve || phase === null || t === null) return null;
    const win = temps.slice(Math.max(0, i - 12), i + 13).filter(finite);
    const lo = Math.min(...win), hi = Math.max(...win);
    if (!(hi - lo >= 2)) return null; // sin ciclo diurno apreciable (< 2 °C)
    const prev = temps[i - 1], next = temps[i + 1];
    const earthNorm = (t - lo) / (hi - lo);
    const earthRate = finite(prev) && finite(next) ? (next - prev) / 2 / (hi - lo)
      : finite(next) ? (next - t) / (hi - lo) : finite(prev) ? (t - prev) / (hi - lo) : 0;
    const targetNorm = curve.norm(phase), targetRate = curve.rate(phase);
    const score = Math.round(100 * clamp(1 - 0.6 * Math.abs(earthNorm - targetNorm)
      - 0.4 * Math.min(1, Math.abs(earthRate - targetRate) / o.rateScale), 0, 1));
    const sameTrend = Math.abs(targetRate) < 0.02 || Math.sign(earthRate) === Math.sign(targetRate);
    return { phase: round(phase, 2), earthNorm: round(earthNorm, 3), targetNorm: round(targetNorm, 3),
      earthRate: round(earthRate, 3), targetRate: round(targetRate, 3), score, sameTrend };
  });
}

/** Detecta cruces de 0 °C en la superficie; marca como «rápido» el enfriamiento ≥ |rateCph| °C/h en 3 h. */
export function freezeEvents(hours, opts = {}) {
  const o = { ...FREEZE_DEFAULTS, ...opts };
  const temps = hours.map(surfaceTemp);
  const events = [];
  for (let i = 1; i < temps.length; i++) {
    const a = temps[i - 1], b = temps[i];
    if (!finite(a) || !finite(b)) continue;
    const back = temps[Math.max(0, i - o.spanHours)];
    const rate = finite(back) ? (b - back) / Math.min(i, o.spanHours) : b - a;
    const night = !finite(hours[i].radiationWm2) || hours[i].radiationWm2 < 5;
    if (a > 0 && b <= 0) events.push({ kind: 'freeze', index: i, time: hours[i].time, tempC: b, rateCph: round(rate, 2), rapid: rate <= o.rateCph, night });
    else if (a <= 0 && b > 0) events.push({ kind: 'thaw', index: i, time: hours[i].time, tempC: b, rateCph: round(rate, 2), rapid: false, night });
  }
  let cycles = 0, frozen = false;
  for (const e of events) { if (e.kind === 'freeze') frozen = true; else if (frozen) { cycles++; frozen = false; } }
  return { events, cycles };
}

/** Agrupa horas consecutivas que cumplen `test` en ventanas de al menos `minHours`. */
export function findWindows(hours, test, { minHours = 2 } = {}) {
  const out = [];
  let start = -1;
  for (let i = 0; i <= hours.length; i++) {
    const ok = i < hours.length && test(hours[i], i);
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      if (i - start >= minHours) out.push({ startIndex: start, endIndex: i - 1, start: hours[start].time, end: hours[i - 1].time, hours: i - start });
      start = -1;
    }
  }
  return out;
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Análisis completo del Módulo 3.
 * @param forecast respuesta de /api/processes/forecast
 * @param target   rejilla del objetivo (§2) o null
 * @param options  { nowMs, saltation, freeze, thermal }
 */
export function analyzeProcesses(forecast, target = null, options = {}) {
  const hoursIn = Array.isArray(forecast?.hours) ? forecast.hours.filter((h) => h && typeof h.time === 'string') : [];
  const lon = finite(forecast?.lon) ? forecast.lon : null;
  const body = target?.body || null;
  const curve = makeCurve(target?.thermal?.curve);
  const nowMs = finite(options.nowMs) ? options.nowMs : Date.now();
  const scores = thermalScores(hoursIn, curve, lon, options.thermal);
  const hours = hoursIn.map((h, i) => {
    const recentPrecipMm = hoursIn.slice(Math.max(0, i - 24), i).reduce((s, x) => s + (finite(x.precipMm) ? x.precipMm : 0), 0);
    return { ...h, solarHour: round(solarHour(h.time, lon), 2), saltation: saltationState(h, { ...options.saltation, recentPrecipMm }), thermal: scores[i] };
  });
  const freeze = freezeEvents(hours, options.freeze);
  const tMin = options.thermal?.minScore ?? THERMAL_DEFAULTS.minScore;
  const minHours = options.thermal?.minHours ?? THERMAL_DEFAULTS.minHours;

  const phaseOf = (h) => (h.thermal.targetRate > 0.02 ? 'calentamiento' : h.thermal.targetRate < -0.02 ? 'enfriamiento' : 'meseta');
  // una ventana por tramo de fase: se corta donde el objetivo pasa de calentar a enfriar (o a meseta)
  const thermal = findWindows(hours, (h) => h.thermal && h.thermal.score >= tMin && h.thermal.sameTrend, { minHours: 1 })
    .flatMap((w) => {
      const parts = [];
      let s0 = w.startIndex;
      for (let i = w.startIndex + 1; i <= w.endIndex + 1; i++) {
        if (i > w.endIndex || phaseOf(hours[i]) !== phaseOf(hours[s0])) { parts.push([s0, i - 1]); s0 = i; }
      }
      return parts.filter(([a, b]) => b - a + 1 >= minHours).map(([a, b]) => {
        const span = hours.slice(a, b + 1);
        return { startIndex: a, endIndex: b, start: hours[a].time, end: hours[b].time, hours: b - a + 1, kind: 'thermal',
          score: Math.round(mean(span.map((h) => h.thermal.score))), phase: phaseOf(hours[a]) };
      });
    })
    // Prioridad: las transiciones (calentamiento/enfriamiento) informan más que la meseta nocturna, donde dos
    // curvas planas coinciden trivialmente; a igual fase, más puntuación y más duración (hasta 6 h).
    .map((w) => ({ ...w, rank: w.score + Math.min(w.hours, 6) - (w.phase === 'meseta' ? 20 : 0) }))
    .sort((a, b) => b.rank - a.rank || a.startIndex - b.startIndex);
  const aeolian = findWindows(hours, (h) => h.saltation.level === 'sustained' || h.saltation.level === 'intermittent', { minHours: 2 })
    .map((w) => {
      const span = hours.slice(w.startIndex, w.endIndex + 1);
      const gusts = span.map((h) => h.gustMs).filter(finite);
      return { ...w, kind: 'aeolian', sustainedHours: span.filter((h) => h.saltation.level === 'sustained').length,
        maxGustMs: gusts.length ? Math.max(...gusts) : null, maxUStar: round(Math.max(...span.map((h) => h.saltation.uStarGust ?? h.saltation.uStar ?? 0)), 3) };
    });
  const freezeWindows = freeze.events.filter((e) => e.kind === 'freeze').map((e) => ({
    kind: 'freeze', startIndex: Math.max(0, e.index - 2), endIndex: e.index, start: hours[Math.max(0, e.index - 2)].time,
    end: e.time, hours: Math.min(3, e.index + 1), rapid: e.rapid, rateCph: e.rateCph, night: e.night,
  }));

  // Ventana fría: mínimo térmico sin radiación solar (útil para objetivos criogénicos sin curva diurna).
  const surf = hours.map(surfaceTemp);
  const surfOk = surf.filter(finite);
  const coldCut = surfOk.length ? Math.min(...surfOk) + 0.15 * (Math.max(...surfOk) - Math.min(...surfOk)) : null;
  // «Sin sol» relativo: el 15 % inferior de la radiación del período (en el día polar el sol nunca se pone).
  const rad = hours.map((h) => h.radiationWm2).filter(finite);
  const radCut = rad.length ? Math.max(5, Math.min(...rad) + 0.15 * (Math.max(...rad) - Math.min(...rad))) : Infinity;
  const cold = coldCut === null ? [] : findWindows(hours, (h, i) => finite(surf[i]) && surf[i] <= coldCut
    && (!finite(h.radiationWm2) || h.radiationWm2 <= radCut), { minHours: 2 })
    .map((w) => ({ ...w, kind: 'cold', minC: Math.min(...surf.slice(w.startIndex, w.endIndex + 1).filter(finite)) }))
    .sort((p, q) => p.minC - q.minC || p.startIndex - q.startIndex);

  // Ventana recomendada según el objetivo
  let best = null;
  if (body === 'mars') best = thermal[0] || aeolian[0] || null;
  else if (body === 'moon') best = thermal[0] || (curve ? null : freezeWindows.find((w) => w.rapid) || freezeWindows[0] || cold[0] || null);
  else best = aeolian[0] || freezeWindows[0] || null;

  const currentIndex = Math.max(0, hours.findIndex((h) => Date.parse(h.time) >= nowMs - 30 * 60 * 1000));
  const current = hours.length ? { index: currentIndex, time: hours[currentIndex].time, saltation: hours[currentIndex].saltation,
    thermalScore: hours[currentIndex].thermal?.score ?? null } : null;

  const temps = hours.map(surfaceTemp).filter(finite);
  const caveats = [
    'Weather-model forecast, not a field observation.',
    'The thermal window compares the shape and phase of the normalized diurnal curve; absolute temperatures do not match.',
  ];
  if (body === 'moon') caveats.push('A lunar day lasts ~708.7 h: the lunar curve is compressed to 24 h only to compare its shape. There is no wind on the Moon; dust is mobilized by electrostatics and impacts.');
  if (body === 'mars') caveats.push(`Earth saltation is the same process that feeds Martian dust storms, not the same intensity: on Mars u*t ≈ ${MARS_USTAR_THRESHOLD[0]}–${MARS_USTAR_THRESHOLD[1]} m/s.`);
  if (target && !curve) caveats.push('The target has no diurnal curve in the product used: no thermal window is computed; the cold window is proposed instead (thermal minimum with the lowest radiation of the period), far from the ~40–100 K of permanently shadowed regions.');
  caveats.push(`Editorial saltation threshold: u*t ${SALTATION_DEFAULTS.uStarThreshold} m/s (≈${round(windThreshold(options.saltation), 1)} m/s at 10 m) for dry fine sand; moisture suppresses it.`);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    source: { provider: forecast?.provider ?? null, live: forecast?.live === true, cached: forecast?.cached === true,
      fetchedAt: forecast?.fetchedAt ?? null, label: forecast?.source?.label ?? null, url: forecast?.source?.url ?? null },
    timezone: forecast?.timezone ?? null, utcOffsetSeconds: finite(forecast?.utcOffsetSeconds) ? forecast.utcOffsetSeconds : 0,
    body,
    targetCurve: { available: Boolean(curve), kind: target?.thermal?.kind ?? null, source: target?.thermal?.source ?? null,
      minK: target?.thermal?.minK ?? null, maxK: target?.thermal?.maxK ?? null,
      curveMinK: curve ? round(curve.min, 1) : null, curveMaxK: curve ? round(curve.max, 1) : null },
    earthRangeC: temps.length ? [Math.min(...temps), Math.max(...temps)] : null,
    hours,
    current,
    windows: { thermal, aeolian, freeze: freezeWindows, cold },
    freezeThawCycles: freeze.cycles,
    best,
    thresholds: { uStar: SALTATION_DEFAULTS.uStarThreshold, windMs: round(windThreshold(options.saltation), 2),
      marsUStar: [...MARS_USTAR_THRESHOLD], freezeRateCph: FREEZE_DEFAULTS.rateCph, thermalMinScore: tMin },
    caveats,
  };
}

/** Resumen compacto para el contexto del copiloto (§5). */
export function summarizeProcesses(analysis) {
  if (!analysis) return null;
  const pick = (w) => (w ? { kind: w.kind, start: w.start, end: w.end, hours: w.hours, score: w.score ?? null, phase: w.phase ?? null } : null);
  return {
    provider: analysis.source.provider, live: analysis.source.live, timezone: analysis.timezone, utcOffsetSeconds: analysis.utcOffsetSeconds,
    currentSaltation: analysis.current?.saltation?.level ?? null, currentThermalScore: analysis.current?.thermalScore ?? null,
    best: pick(analysis.best),
    thermalWindows: analysis.windows.thermal.slice(0, 3).map(pick),
    aeolianWindows: analysis.windows.aeolian.slice(0, 3).map(pick),
    freezeEvents: analysis.windows.freeze.length, freezeThawCycles: analysis.freezeThawCycles,
    targetCurve: analysis.targetCurve.available ? analysis.targetCurve.kind : null,
    caveats: analysis.caveats.slice(0, 3),
  };
}
