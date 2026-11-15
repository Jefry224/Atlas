// Solar geometry for the terrain scenes (pure, no DOM).
// Earth: NOAA / Astronomical Almanac low-precision solar position (declination and equation of time
// accurate to ~0.01°, well inside the 1° budget), with the NOAA atmospheric refraction correction.
// Mars and Moon: deliberately simple approximations from the body's local solar hour; documented below.
// Convention everywhere: elevation above the local horizon in degrees, azimuth from north, clockwise
// (90° = east, 180° = south, 270° = west).

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const norm360 = (a) => ((a % 360) + 360) % 360;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Horizontal coordinates from hour angle, latitude and declination (all degrees).
 * Hour angle is negative in the morning, 0 at local solar noon, positive in the afternoon.
 * @returns {{ elevationDeg: number, azimuthDeg: number }}
 */
export function horizontalFromHourAngle(hourAngleDeg, latDeg, decDeg) {
  const H = hourAngleDeg * RAD, phi = clamp(latDeg, -90, 90) * RAD, dec = decDeg * RAD;
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const el = Math.asin(clamp(sinEl, -1, 1));
  // azimuth from north, clockwise; atan2 keeps the quadrant (also at the poles, where it follows H)
  let y = -Math.cos(dec) * Math.sin(H);
  let x = Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.cos(H) * Math.sin(phi);
  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12) { y = 0; x = 1; } // sun at the zenith: azimuth undefined → 0
  return { elevationDeg: el * DEG, azimuthDeg: norm360(Math.atan2(y, x) * DEG) };
}

/** NOAA approximation of atmospheric refraction (degrees to add to the geometric elevation). */
export function refractionDeg(elevationDeg) {
  const e = elevationDeg;
  if (e > 85) return 0;
  const te = Math.tan(e * RAD);
  let arcsec;
  if (e > 5) arcsec = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (e > -0.575) arcsec = 1735 + e * (-518.2 + e * (103.4 + e * (-12.79 + e * 0.711)));
  else arcsec = -20.772 / te;
  return arcsec / 3600;
}

/**
 * Sun position on Earth.
 * @param {number} dateMs  UTC instant (ms since epoch, e.g. Date.now()).
 * @param {number} lat     latitude in degrees (north positive).
 * @param {number} lon     longitude in degrees (east positive).
 * @param {{ refraction?: boolean }} [options] refraction (default true) adds the NOAA apparent-elevation correction.
 * @returns {{ elevationDeg: number, azimuthDeg: number, declinationDeg: number, hourAngleDeg: number }}
 */
export function sunPosition(dateMs, lat, lon, { refraction = true } = {}) {
  const n = dateMs / 86400000 + 2440587.5 - 2451545.0; // days since J2000.0
  const L = norm360(280.460 + 0.9856474 * n);           // mean longitude
  const g = norm360(357.528 + 0.9856003 * n) * RAD;     // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD; // ecliptic longitude
  const eps = (23.439 - 0.0000004 * n) * RAD;           // obliquity
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) * DEG;
  const gmst = norm360(280.46061837 + 360.98564736629 * n);
  let H = norm360(gmst + lon - ra);
  if (H > 180) H -= 360;
  const pos = horizontalFromHourAngle(H, lat, dec);
  const elevationDeg = refraction ? pos.elevationDeg + refractionDeg(pos.elevationDeg) : pos.elevationDeg;
  return { elevationDeg, azimuthDeg: pos.azimuthDeg, declinationDeg: dec, hourAngleDeg: H };
}

/** Mars obliquity (degrees). */
export const MARS_OBLIQUITY_DEG = 25.19;

/**
 * Approximate solar declination on Mars from the areocentric solar longitude Ls:
 * δ = asin(sin ε · sin Ls), ε = 25.19°. Ignores the small eccentricity term (< 0.1° on δ is not the
 * issue; the real error source is ignoring the Mars equation of time, up to ±50 min of local hour).
 */
export function marsDeclinationDeg(lsDeg) {
  return Math.asin(Math.sin(MARS_OBLIQUITY_DEG * RAD) * Math.sin(lsDeg * RAD)) * DEG;
}

/**
 * Sun on Mars from local TRUE solar time (0–24 «Mars hours», 12 = noon), latitude and Ls.
 * Approximation: hour angle = (hour − 12)·15°, declination from Ls, no refraction (thin atmosphere).
 * Good to ~1° for elevation if the hour is true solar time; use for lighting, not navigation.
 * @returns {{ elevationDeg: number, azimuthDeg: number, declinationDeg: number }}
 */
export function marsSunElevation(localSolarHour, latDeg, lsDeg = 0) {
  const dec = marsDeclinationDeg(lsDeg);
  return { ...horizontalFromHourAngle((localSolarHour - 12) * 15, latDeg, dec), declinationDeg: dec };
}

/** Lunar equator to ecliptic inclination: the subsolar latitude never leaves ±1.54°. */
export const MOON_MAX_SUBSOLAR_LAT_DEG = 1.54;

/**
 * Sun on the Moon from local solar hour (0–24 «lunar hours», one lunar day = 29.53 Earth days),
 * latitude and subsolar latitude (−1.54…+1.54°, default 0; clamped).
 * At the poles (e.g. Shackleton, −89.8°) this gives the real grazing sun: elevation stays within
 * about ±1.6° and the azimuth sweeps the whole horizon once per lunar day.
 * @returns {{ elevationDeg: number, azimuthDeg: number, declinationDeg: number }}
 */
export function moonSunElevation(localSolarHour, latDeg, subsolarLatDeg = 0) {
  const dec = clamp(subsolarLatDeg, -MOON_MAX_SUBSOLAR_LAT_DEG, MOON_MAX_SUBSOLAR_LAT_DEG);
  return { ...horizontalFromHourAngle((localSolarHour - 12) * 15, latDeg, dec), declinationDeg: dec };
}

/**
 * Mean direction of the Earth seen from a point of the Moon's surface (selenographic lat/lon,
 * east positive). The Earth hangs near the sub-Earth point (0°, 0°); libration moves it up to
 * ±6.7° in latitude and ±7.9° in longitude, which is not modelled here (optional librationLatDeg /
 * librationLonDeg shift the sub-Earth point). From the far side the result is below the horizon.
 * @returns {{ elevationDeg: number, azimuthDeg: number }}
 */
export function earthFromMoon(latDeg, lonDeg, { librationLatDeg = 0, librationLonDeg = 0 } = {}) {
  // the Earth is ~60 lunar radii away: treat it as a direction from the Moon's centre (parallax ≤ 1°)
  const phi = latDeg * RAD, lam = lonDeg * RAD;
  const ePhi = librationLatDeg * RAD, eLam = librationLonDeg * RAD;
  const target = [Math.cos(ePhi) * Math.cos(eLam), Math.cos(ePhi) * Math.sin(eLam), Math.sin(ePhi)];
  const up = [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
  const east = [-Math.sin(lam), Math.cos(lam), 0];
  const north = [-Math.sin(phi) * Math.cos(lam), -Math.sin(phi) * Math.sin(lam), Math.cos(phi)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const u = dot(target, up), e = dot(target, east), nn = dot(target, north);
  return { elevationDeg: Math.asin(clamp(u, -1, 1)) * DEG, azimuthDeg: norm360(Math.atan2(e, nn) * DEG) };
}

/**
 * Unit vector in scene axes (x = east, y = up, z = south) for an elevation/azimuth pair.
 * @returns {[number, number, number]}
 */
export function directionFromAngles(elevationDeg, azimuthDeg) {
  const el = elevationDeg * RAD, az = azimuthDeg * RAD;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}
