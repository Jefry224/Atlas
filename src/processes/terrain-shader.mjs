// S.E.L.E.N.E. Ops · terrain shader (docs/qa/plan-visual-refactor.md, phase 3b).
//
// Patches the terrain MeshStandardMaterial built in mission.js `buildTerrain()` with onBeforeCompile.
// It keeps the material's own map / vertex colours, lights, fog and shadows and adds:
//   - procedural micro-detail (multi-octave value noise in model space, in metres) on albedo and normal,
//     anti-aliased per octave and faded out with view distance, so orbit views are unchanged;
//   - a slope tint from the true (de-exaggerated) slope: rockier, darker steep faces and slightly dustier,
//     brighter flats, per body;
//   - a derivative-based (dFdx/dFdy) detail normal combined with the mesh normal;
//   - weather coats: frost on the flats and a dust layer (`setTerrainWeather`).
//
// Honesty note: everything this shader adds is a DISPLAY effect. Micro-detail is procedural (it is not
// measured relief and never enters slope metrics); the body tint colourises single-band imagery such as
// HiRISE RED (greyscale) toward the body's typical colour; frost and dust coats are illustrative cues
// derived from the simulated WeatherState. Measured data (DEM, orthoimage) is never altered.
//
// No extra textures or downloads. Three.js r181 is WebGL2-only, so dFdx/dFdy/fwidth are core GLSL ES 3.0.
// `terrainWeatherFromState` is pure and tested in tests/terrain-shader.test.mjs.

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const normBody = (b) => (b === 'mars' || b === 'moon' ? b : 'earth');
const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Map a WeatherState (docs/modules/m3-processes.md) to the terrain coat uniforms. Pure.
 * Illustrative thresholds (visual cues, not a deposition model):
 * - Earth frost: snowfall blankets the flats (0.8–1 with intensity); otherwise hoar frost needs air at or
 *   below ~0 °C and humid air (rh ≳ 60 %); rain without snow clears it.
 * - Mars frost: thin seasonal water/CO₂ frost on very cold nights (seen by Viking Lander 2 in Utopia
 *   Planitia); appears below ≈ −70 °C, capped at 0.4 so it stays a light dusting.
 * - Dust: optical depth above the body's normal background (Earth τ ≳ 0.3, Mars τ ≳ 0.6); rain or snow on
 *   Earth suppresses it.
 * - Moon: no atmosphere, no weather coat (PSR ice is not drawn as surface frost).
 * @param {object|null} weather
 * @param {'earth'|'moon'|'mars'|string} body
 * @returns {{ frost: number, dust: number }} both in [0, 1]
 */
export function terrainWeatherFromState(weather, body) {
  const b = normBody(body ?? weather?.body);
  if (!weather || typeof weather !== 'object' || b === 'moon') return { frost: 0, dust: 0 };
  const tempC = finite(weather.tempC) ? weather.tempC : null;
  const rh = finite(weather.rhPct) ? weather.rhPct : 0;
  const rain = finite(weather.rainMmH) ? Math.max(0, weather.rainMmH) : 0;
  const tau = finite(weather.dustTau) ? Math.max(0, weather.dustTau) : 0;
  const snow = weather.snow === true;
  let frost = 0, dust = 0;
  if (b === 'earth') {
    if (snow) frost = clamp(0.8 + 0.1 * rain, 0.8, 1);
    else if (rain === 0 && tempC !== null) frost = 0.7 * smooth(2, -6, tempC) * smooth(60, 95, rh);
    dust = 0.6 * smooth(0.3, 2.5, tau) * (snow ? 0 : rain > 0 ? 0.2 : 1);
  } else {
    if (tempC !== null) frost = 0.4 * smooth(-70, -105, tempC);
    dust = 0.85 * smooth(0.6, 5, tau);
  }
  return { frost: r3(clamp(frost, 0, 1)), dust: r3(clamp(dust, 0, 1)) };
}

/**
 * Per-body look. Tints are linear multipliers; colours are sRGB hex (converted by THREE.Color).
 * bodyTint is applied only to near-greyscale pixels (single-band imagery), weighted by tintAmt.
 */
export const TERRAIN_LOOK = Object.freeze({
  moon: Object.freeze({ rockTint: [0.7, 0.7, 0.73], dust: 0x8e8b86, frost: 0xdfe4ea, bodyTint: 0xa8a49d, tintAmt: 0.25, steep: 0.75, flat: 0.16, detail: 0.55, bumpM: 2.2 }),
  mars: Object.freeze({ rockTint: [0.72, 0.6, 0.54], dust: 0xa87a58, frost: 0xe6e2dc, bodyTint: 0xc0875a, tintAmt: 0.7, steep: 0.7, flat: 0.3, detail: 0.55, bumpM: 2.2 }),
  earth: Object.freeze({ rockTint: [0.86, 0.84, 0.82], dust: 0xb59d7a, frost: 0xe8edf2, bodyTint: 0xb0a089, tintAmt: 0, steep: 0.55, flat: 0.2, detail: 0.55, bumpM: 2.0 }),
});

const CACHE_KEY = 'selene-terrain-v1';

const VERT_PARS = /* glsl */`
varying vec3 vTerrainPos;
varying vec3 vTerrainNrm;
`;
const VERT_MAIN = /* glsl */`
vTerrainPos = transformed;
vTerrainNrm = objectNormal;
`;

const FRAG_PARS = /* glsl */`
varying vec3 vTerrainPos;
varying vec3 vTerrainNrm;
uniform float uTerrainUnits;
uniform float uTerrainExag;
uniform vec2 uTerrainFade;
uniform float uTerrainFrost;
uniform float uTerrainDust;
uniform vec3 uTerrainRockTint;
uniform vec3 uTerrainDustColor;
uniform vec3 uTerrainFrostColor;
uniform vec3 uTerrainBodyTint;
uniform vec4 uTerrainAmt; // x steep, y flat, z detail albedo, w body tint
uniform float uTerrainBump; // detail relief amplitude, metres
float tDetailH;   // micro height (metres), shared with the normal step
float tDetailFade;

float tHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float tNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = tHash(i), n100 = tHash(i + vec3(1, 0, 0)), n010 = tHash(i + vec3(0, 1, 0)), n110 = tHash(i + vec3(1, 1, 0));
  float n001 = tHash(i + vec3(0, 0, 1)), n101 = tHash(i + vec3(1, 0, 1)), n011 = tHash(i + vec3(0, 1, 1)), n111 = tHash(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z) * 2.0 - 1.0;
}
// fBm with per-octave anti-aliasing: an octave fades out once one cycle spans less than ~2 pixels
float tFbm(vec3 p, float baseFreq, float pxM, int octaves) {
  float sum = 0.0, amp = 0.5, freq = baseFreq;
  for (int o = 0; o < 6; o++) {
    if (o >= octaves) break;
    float aa = 1.0 - smoothstep(0.25, 0.6, pxM * freq);
    sum += amp * aa * tNoise(p * freq + float(o) * 17.13);
    freq *= 2.37; amp *= 0.55;
  }
  return sum;
}
float tLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// Mikkelsen's surface-gradient bump (unnormalised screen derivatives, so the height is in scene units)
vec3 tPerturb(vec3 surfPos, vec3 n, float dhx, float dhy, float faceDir) {
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad);
}
`;

const FRAG_COLOR = /* glsl */`
{
  vec3 pM = vec3(vTerrainPos.x, vTerrainPos.y / uTerrainExag, vTerrainPos.z) / uTerrainUnits; // metres
  float pxM = length(fwidth(pM));                       // metres covered by one pixel
  float dist = length(vViewPosition);                   // scene units
  tDetailFade = 1.0 - smoothstep(uTerrainFade.x, uTerrainFade.y, dist);
  // true slope: undo the vertical exaggeration on the mesh normal
  vec3 nM = normalize(vTerrainNrm);
  float slopeDeg = degrees(atan(length(nM.xz), max(nM.y * uTerrainExag, 1e-3)));
  float steepW = smoothstep(5.0, 22.0, slopeDeg);
  float flatW = 1.0 - smoothstep(1.5, 7.0, slopeDeg);
  // macro breakup (25 m and up): always on, keeps coats and tints from looking flat at a distance
  float macro = tFbm(pM, 1.0 / 90.0, pxM, 3);
  // micro detail (≈ 12 m down to ≈ 0.6 m): close range only
  tDetailH = tDetailFade > 0.0 ? tFbm(pM, 1.0 / 12.0, pxM, 5) : 0.0;
  vec3 col = diffuseColor.rgb;
  // body tint on near-greyscale imagery (single-band HiRISE / LROC), luminance preserved
  float lum = tLuma(col);
  float sat = (max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b))) / max(max(col.r, max(col.g, col.b)), 1e-4);
  vec3 tinted = uTerrainBodyTint * (lum / max(tLuma(uTerrainBodyTint), 1e-4));
  col = mix(col, tinted, uTerrainAmt.w * (1.0 - smoothstep(0.04, 0.18, sat)));
  // slope tint: rock on steep faces, dust on flats
  col *= mix(vec3(1.0), uTerrainRockTint, steepW * uTerrainAmt.x * (0.8 + 0.4 * macro));
  col = mix(col, uTerrainDustColor * (0.75 + 0.5 * lum / max(tLuma(uTerrainDustColor), 1e-4)) * 0.5 + col * 0.5, flatW * uTerrainAmt.y);
  // micro albedo
  col *= 1.0 + uTerrainAmt.z * tDetailFade * tDetailH + 0.06 * macro;
  // dust coat: settles everywhere, thicker on flats
  float dustM = uTerrainDust * clamp((0.35 + 0.35 * flatW) * (0.85 + 0.3 * macro), 0.0, 1.0);
  col = mix(col, uTerrainDustColor * (0.9 + 0.2 * macro), dustM);
  // frost: soft white on flats, broken up by the macro noise; thins on steep faces
  // coverage threshold on the noise field: light frost = scattered patches, heavy frost or snow = blanket
  float cover = uTerrainFrost * (0.4 + 0.6 * flatW) * (1.0 - 0.75 * steepW);
  float field = 0.5 + 0.7 * macro + 0.6 * tDetailH * tDetailFade;
  float frostM = smoothstep(1.0 - cover - 0.2, 1.0 - cover + 0.2, field) * (0.2 + 0.7 * pow(cover, 1.5)) * step(0.001, cover);
  col = mix(col, uTerrainFrostColor * (0.92 + 0.08 * macro), frostM);
  diffuseColor.rgb = col;
}
`;

// derivatives must run in uniform control flow (no branch around dFdx), so this step is unconditional;
// beyond the fade distance hU is 0 and the normal is returned unchanged
const FRAG_NORMAL = /* glsl */`
{
  float hU = tDetailH * uTerrainBump * uTerrainUnits * tDetailFade;
  normal = tPerturb(-vViewPosition, normal, dFdx(hU), dFdy(hU), faceDirection);
}
`;

function bodyValues(THREE, body) {
  const look = TERRAIN_LOOK[normBody(body)];
  return {
    uTerrainRockTint: new THREE.Vector3(...look.rockTint),
    uTerrainDustColor: new THREE.Color(look.dust),
    uTerrainFrostColor: new THREE.Color(look.frost),
    uTerrainBodyTint: new THREE.Color(look.bodyTint),
    uTerrainAmt: new THREE.Vector4(look.steep, look.flat, look.detail, look.tintAmt),
    uTerrainBump: look.bumpM,
  };
}

/**
 * Patch a terrain MeshStandardMaterial in place (idempotent; a second call only updates body/scale).
 * @param {import('three').MeshStandardMaterial} material
 * @param {object} THREE
 * @param {{ body?: 'earth'|'moon'|'mars', unitsPerMeter?: number, exag?: number, detailNearM?: number, detailFarM?: number }} [options]
 *   detailNearM / detailFarM: view distance (metres) where micro-detail starts fading / is gone
 *   (defaults 250 m / 1200 m ⇒ 25 / 120 scene units at U = 0.1; the default orbit view sits ≈ 170 units away).
 * @returns {import('three').MeshStandardMaterial}
 */
export function patchTerrainMaterial(material, THREE, { body = 'earth', unitsPerMeter = 0.1, exag = 2, detailNearM = 800, detailFarM = 3500 } = {}) {
  if (!material) return material;
  const values = bodyValues(THREE, body);
  const existing = material.userData?.terrainUniforms;
  const uniforms = existing || {
    uTerrainUnits: { value: 0.1 }, uTerrainExag: { value: 2 }, uTerrainFade: { value: new THREE.Vector2() },
    uTerrainFrost: { value: 0 }, uTerrainDust: { value: 0 },
    uTerrainRockTint: { value: null }, uTerrainDustColor: { value: null }, uTerrainFrostColor: { value: null },
    uTerrainBodyTint: { value: null }, uTerrainAmt: { value: null }, uTerrainBump: { value: 0.4 },
  };
  for (const [k, v] of Object.entries(values)) uniforms[k].value = v;
  uniforms.uTerrainUnits.value = finite(unitsPerMeter) && unitsPerMeter > 0 ? unitsPerMeter : 0.1;
  uniforms.uTerrainExag.value = finite(exag) && exag > 0 ? exag : 1;
  uniforms.uTerrainFade.value.set(detailNearM * uniforms.uTerrainUnits.value, Math.max(detailFarM, detailNearM + 1) * uniforms.uTerrainUnits.value);
  material.userData = { ...(material.userData || {}), terrainUniforms: uniforms, terrainBody: normBody(body) };
  if (existing) return material;

  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (typeof previous === 'function') previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`);
  };
  // one shared program for every body (the look is uniforms only); chained with any earlier key
  material.customProgramCacheKey = () => {
    const prior = typeof previousKey === 'function' && previousKey !== THREE.Material?.prototype?.customProgramCacheKey
      ? previousKey.call(material) : '';
    return `${CACHE_KEY}${prior ? `|${prior}` : ''}`;
  };
  material.needsUpdate = true;
  return material;
}

/** Set the weather coats (each clamped to 0..1). Safe before or after the first compile. */
export function setTerrainWeather(material, { frost = 0, dust = 0 } = {}) {
  const u = material?.userData?.terrainUniforms;
  if (!u) return false;
  u.uTerrainFrost.value = clamp(finite(frost) ? frost : 0, 0, 1);
  u.uTerrainDust.value = clamp(finite(dust) ? dust : 0, 0, 1);
  return true;
}
