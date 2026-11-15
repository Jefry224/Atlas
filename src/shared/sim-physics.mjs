// A.R.E.S. Twin · simulación física simplificada del rover (docs/contracts.md §4).
// Módulo ES puro: sin DOM, sin dependencias. Unidades SI salvo que se indique.
// Convención espacial heredada de mission-math.mjs: x = este, z = sur, rumbo 0° = norte,
// 90° = este. Es un modelo didáctico de primer orden, NO un modelo de ingeniería validado.
import { ROVER_CONFIG } from './rover-config.mjs';
import { sampleHeight, clamp } from './mission-math.mjs';

const DEG = Math.PI / 180;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Entorno por cuerpo. Valores de referencia redondeados:
 * - gravityMs2: gravedad superficial media (m/s²).
 * - solarConstantWm2: irradiancia solar media en el tope de atmósfera a la distancia
 *   media del cuerpo al Sol (W/m²). Marte: 1361 / 1.524² ≈ 586 W/m².
 * - dayLengthHours: día solar medio (Luna: mes sinódico ≈ 29.53 d ≈ 708.7 h; Marte: sol ≈ 24.66 h).
 */
export const BODY_ENV = Object.freeze({
  earth: Object.freeze({ gravityMs2: 9.81, solarConstantWm2: 1361, dayLengthHours: 24, atmosphere: 'N₂/O₂ ≈ 101 kPa' }),
  moon: Object.freeze({ gravityMs2: 1.62, solarConstantWm2: 1361, dayLengthHours: 708.7, atmosphere: 'No atmosphere (exosphere)' }),
  mars: Object.freeze({ gravityMs2: 3.71, solarConstantWm2: 586, dayLengthHours: 24.66, atmosphere: 'CO₂ ≈ 0.6 kPa' }),
});

/**
 * Actitud del rover a partir del DEM (rejilla del contrato §2).
 * Se muestrea la altura a ±d metros a lo largo del eje de avance y del eje lateral (d = spacing),
 * y se convierte cada diferencia central en ángulo: atan(Δh / 2d).
 * - pitchDeg > 0: morro arriba (el terreno sube hacia delante).
 * - rollDeg  > 0: inclinado a la derecha (el lado derecho queda más bajo que el izquierdo).
 * Rejilla inválida → { pitchDeg: null, rollDeg: null } (no se inventa actitud).
 */
export function attitude(grid, x, z, headingDeg = 0) {
  const h0 = sampleHeight(grid, x, z);
  if (h0 === null || !finite(x) || !finite(z)) return { pitchDeg: null, rollDeg: null };
  const d = grid.spacingMeters;
  const r = (finite(headingDeg) ? headingDeg : 0) * DEG;
  // Avance: rumbo 0 = norte = −z. Derecha = rumbo + 90°.
  const fx = Math.sin(r), fz = -Math.cos(r);
  const rx = Math.cos(r), rz = Math.sin(r);
  const front = sampleHeight(grid, x + fx * d, z + fz * d);
  const back = sampleHeight(grid, x - fx * d, z - fz * d);
  const right = sampleHeight(grid, x + rx * d, z + rz * d);
  const left = sampleHeight(grid, x - rx * d, z - rz * d);
  const pitchDeg = Math.atan((front - back) / (2 * d)) / DEG;
  const rollDeg = Math.atan((left - right) / (2 * d)) / DEG;
  // Evita −0 en terreno plano.
  return { pitchDeg: pitchDeg + 0, rollDeg: rollDeg + 0 };
}

/**
 * Potencia eléctrica de los paneles (W) = irradiancia × área × eficiencia × cos(inclinación).
 * tiltDeg es el ángulo entre la normal del panel y la dirección del Sol (0 = incidencia normal);
 * ≥ 90° → 0 W. Sin pérdidas térmicas, polvo ni sombras: es una cota superior.
 * Irradiancia no finita o negativa → 0 W.
 */
export function solarPowerW({ irradianceWm2, panelAreaM2 = 2, efficiency = 0.28, tiltDeg = 0 } = {}) {
  if (!finite(irradianceWm2) || irradianceWm2 <= 0) return 0;
  const area = finite(panelAreaM2) ? Math.max(0, panelAreaM2) : 0;
  const eff = finite(efficiency) ? clamp(efficiency, 0, 1) : 0;
  const cosT = finite(tiltDeg) ? Math.cos(clamp(Math.abs(tiltDeg), 0, 90) * DEG) : 1;
  return Math.max(0, irradianceWm2 * area * eff * cosT);
}

/**
 * Integra la batería un paso (Euler): E' = E + (solarW − loadW) · dt / 3600   [Wh].
 * Sin pérdidas de carga/descarga ni dependencia térmica. Resultado acotado a [0, 100] %.
 */
export function batteryStep({ batteryPct, capacityWh = 1000, solarW = 0, loadW = 0, dtSeconds = 0 } = {}) {
  const pct = finite(batteryPct) ? clamp(batteryPct, 0, 100) : 0;
  if (!finite(capacityWh) || capacityWh <= 0 || !finite(dtSeconds) || dtSeconds <= 0) return pct;
  const netW = (finite(solarW) ? solarW : 0) - (finite(loadW) ? loadW : 0);
  const energyWh = pct / 100 * capacityWh + netW * dtSeconds / 3600;
  return clamp(energyWh / capacityWh * 100, 0, 100);
}

/**
 * Consumo eléctrico de tracción + aviónica (W).
 *   F = m · g · (Crr · cos θ + sin θ)      [N]  rodadura + componente gravitatoria de la pendiente
 *   P_tracción = max(0, F · v) / η         [W]  sin frenado regenerativo
 *   P_total = P_tracción + avionicsW
 * Supuestos por defecto: Crr = 0.15 (suelo suelto, orden de magnitud de rovers sobre regolito),
 * η = 0.6 (motor + reductora + rueda/suelo), avionicsW = 40 W de carga base.
 * slopeDeg > 0 = subida en el sentido de la marcha.
 */
export function driveLoadW({
  speedMs = 0, slopeDeg = 0, gravityMs2 = BODY_ENV.earth.gravityMs2, massKg = ROVER_CONFIG.massKg,
  rollingResistance = 0.15, tractionEfficiency = 0.6, avionicsW = 40,
} = {}) {
  const v = finite(speedMs) ? Math.abs(speedMs) : 0;
  const g = finite(gravityMs2) ? Math.max(0, gravityMs2) : BODY_ENV.earth.gravityMs2;
  const m = finite(massKg) ? Math.max(0, massKg) : ROVER_CONFIG.massKg;
  const th = (finite(slopeDeg) ? clamp(slopeDeg, -89, 89) : 0) * DEG;
  const eta = finite(tractionEfficiency) && tractionEfficiency > 0 ? Math.min(1, tractionEfficiency) : 0.6;
  const base = finite(avionicsW) ? Math.max(0, avionicsW) : 0;
  const force = m * g * (rollingResistance * Math.cos(th) + Math.sin(th));
  return Math.max(0, force * v) / eta + base;
}

/**
 * Estado térmico frente a la ventana operativa [minOpK, maxOpK] (por defecto −40 °C … +50 °C).
 * marginK = distancia al límite más cercano (negativa si está fuera).
 * Niveles: critical si marginK < 0; caution si marginK < 15 K; nominal en otro caso.
 * Sin temperatura → level "unknown" (no se inventa un valor).
 */
export function thermalStatus({ ambientK, minOpK = 233, maxOpK = 323 } = {}) {
  if (!finite(ambientK)) {
    return { level: 'unknown', marginK: null, text: 'No ambient temperature: thermal state cannot be assessed.' };
  }
  const low = ambientK - minOpK, high = maxOpK - ambientK;
  const marginK = Math.min(low, high);
  const side = low <= high ? 'cold' : 'heat';
  const c = (k) => `${(k - 273.15).toFixed(0)} °C`;
  if (marginK < 0) {
    return { level: 'critical', marginK, text: `Outside operating range (${side}): ${ambientK.toFixed(0)} K (${c(ambientK)}), ${Math.abs(marginK).toFixed(0)} K beyond the limit.` };
  }
  if (marginK < 15) {
    return { level: 'caution', marginK, text: `Near the ${side} limit: ${marginK.toFixed(0)} K margin.` };
  }
  return { level: 'nominal', marginK, text: `Within operating range: ${marginK.toFixed(0)} K margin.` };
}
