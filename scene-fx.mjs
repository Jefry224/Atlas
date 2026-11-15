// Scene effects for the A.R.E.S. Twin terrain scenes: sky dome, real sun, context ring around the
// measured 2400 m window, fog/haze and weather particles (dust, rain, snow). Browser module; it
// receives THREE from the caller so it shares mission.js's copy (assets/vendor/three.module.min.js).
//
// Honesty: the context ring is either «measured-lowres» (a §8 context grid, lower resolution than the
// window) or «illustrative» (extrapolated from the window edges with fractal noise). The caller must
// label it with the returned contextKind; it is never part of the measured window.
//
// Scene units follow docs/modules/m3-processes.md: U scene units per metre, x = east, z = south, y = up,
// height = (h − base)·exag·U, the window is centred on the origin.

import { directionFromAngles, earthFromMoon } from './solar.mjs';

const SKY_RADIUS = 1800;
const STAR_RADIUS = 1650;
const EARTH_DISC_DIST = 1500;
const DEFAULT_RING_HALF_M = 9600;     // 19.2 km context ring when no context grid gives its own extent
const MAX_DUST = 2600, MAX_RAIN = 1900, MAX_SNOW = 1500; // ≤ 6000 particles in total
const BODY_RAMP = { earth: [0x6b5a43, 0xc9b28a], moon: [0x3c3c40, 0xbdbdc2], mars: [0x5a2a16, 0xd08850] };
const BODY_RADIUS_M = { earth: 6371000, moon: 1737400, mars: 3389500 };
const DEFAULT_WEATHER = {
  earth: { cloudPct: 0, dustTau: 0.1, visibilityKm: 30, windMs: 3, gustMs: 5, windDirDeg: 270, rainMmH: 0, snow: false },
  mars: { cloudPct: 0, dustTau: 0.5, visibilityKm: 30, windMs: 5, gustMs: 8, windDirDeg: 270, rainMmH: 0, snow: false },
  moon: { cloudPct: 0, dustTau: 0, visibilityKm: Infinity, windMs: 0, gustMs: 0, windDirDeg: 0, rainMmH: 0, snow: false },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// ------------------------------------------------------------------ deterministic noise (CPU)
function hashString(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeNoise(seed) {
  const hash = (ix, iz) => {
    let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const value = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z);
    let fx = x - ix, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fz) * 2 - 1;
  };
  return (x, z, octaves = 5) => {
    let sum = 0, amp = 0.5, norm = 0, f = 1;
    for (let o = 0; o < octaves; o++) { sum += amp * value(x * f + o * 17.3, z * f - o * 9.1); norm += amp; amp *= 0.5; f *= 2.03; }
    return sum / norm; // ≈ −1…1
  };
}

// ------------------------------------------------------------------ grid helpers (§2 convention)
function gridOk(grid) {
  return Boolean(grid && Number.isInteger(grid.gridSize) && grid.gridSize >= 2 && num(grid.spacingMeters, 0) > 0
    && Array.isArray(grid.elevation) && grid.elevation.length === grid.gridSize ** 2);
}
/** Bilinear height in metres at (x east, z south) metres from the grid centre; clamps to the edge. */
function sampleGrid(grid, x, z) {
  const n = grid.gridSize, s = grid.spacingMeters, half = (n - 1) * s / 2;
  const col = clamp((x + half) / s, 0, n - 1), row = clamp((z + half) / s, 0, n - 1);
  const c = Math.min(Math.floor(col), n - 2), r = Math.min(Math.floor(row), n - 2);
  const tx = col - c, tz = row - r, h = grid.elevation;
  return (h[r * n + c] * (1 - tx) + h[r * n + c + 1] * tx) * (1 - tz) + (h[(r + 1) * n + c] * (1 - tx) + h[(r + 1) * n + c + 1] * tx) * tz;
}
function gridStats(grid) {
  let min = Infinity, max = -Infinity, sum = 0, sq = 0;
  for (const h of grid.elevation) { if (h < min) min = h; if (h > max) max = h; sum += h; sq += h * h; }
  const mean = sum / grid.elevation.length;
  return { min, max, mean, std: Math.sqrt(Math.max(0, sq / grid.elevation.length - mean * mean)) };
}

/** Symmetric axis coordinates: exactly the window's vertex columns inside, fine band, then growing steps. */
function ringAxis(innerHalf, segments, outerHalf) {
  const step = (2 * innerHalf) / segments;
  const inner = Array.from({ length: segments + 1 }, (_, k) => -innerHalf + k * step);
  const out = [];
  let x = innerHalf, s = step;
  const band = innerHalf + Math.max(40, innerHalf * 0.35);
  while (x < outerHalf - 1e-6) {
    if (x >= band) s = Math.min(s * 1.12, 48);
    x = Math.min(outerHalf, x + s);
    if (outerHalf - x < s * 0.35) x = outerHalf;
    out.push(x);
  }
  return [...out.slice().reverse().map((v) => -v), ...inner, ...out];
}

// ------------------------------------------------------------------ image helpers (DOM, optional)
function loadImage(url) {
  return new Promise((resolve) => {
    if (!url || typeof Image === 'undefined') { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
/** Downsample to size×size RGB floats (linear 0..1) so border colours are smooth. */
function imagePixels(img, size = 48) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const out = new Float32Array(size * size * 3);
    const toLinear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    for (let i = 0; i < size * size; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = toLinear(data[i * 4 + k]);
    return { size, data: out };
  } catch { return null; }
}
function samplePixels(px, u, v, out) {
  const n = px.size, x = clamp(u * (n - 1), 0, n - 1), y = clamp(v * (n - 1), 0, n - 1);
  const c = Math.min(Math.floor(x), n - 2), r = Math.min(Math.floor(y), n - 2), tx = x - c, ty = y - r;
  for (let k = 0; k < 3; k++) {
    const a = px.data[(r * n + c) * 3 + k], b = px.data[(r * n + c + 1) * 3 + k];
    const d = px.data[((r + 1) * n + c) * 3 + k], e = px.data[((r + 1) * n + c + 1) * 3 + k];
    out[k] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  }
  return out;
}

/**
 * Closed perimeter of the square window (half side H metres), sampled every ~H/64 m with `fn(bx, bz) → values[]`
 * and box-blurred at several radii. param() projects an outside point radially onto the edge.
 */
class Perimeter {
  constructor(H, fn, dims) {
    this.H = H; this.dims = dims; this.M = 512; this.L = 8 * H;
    this.radii = [0, 150, 450, 1200, 2600, 4000];
    const base = new Float32Array(this.M * dims);
    for (let m = 0; m < this.M; m++) {
      const [bx, bz] = this.point((m / this.M) * this.L);
      const v = fn(bx, bz);
      for (let d = 0; d < dims; d++) base[m * dims + d] = v[d];
    }
    this.levels = this.radii.map((rad) => (rad === 0 ? base : this.blur(base, Math.max(1, Math.round(rad / (this.L / this.M))))));
  }
  point(s) {
    const H = this.H;
    s = ((s % this.L) + this.L) % this.L;
    if (s < 2 * H) return [s - H, -H];
    if (s < 4 * H) return [H, s - 3 * H];
    if (s < 6 * H) return [5 * H - s, H];
    return [-H, 7 * H - s];
  }
  param(x, z) {
    const H = this.H, m = Math.max(Math.abs(x), Math.abs(z)) || 1;
    const bx = x * H / m, bz = z * H / m;
    if (Math.abs(bz + H) < 1e-6 && bx < H - 1e-6) return bx + H;
    if (Math.abs(bx - H) < 1e-6 && bz < H - 1e-6) return 3 * H + bz;
    if (Math.abs(bz - H) < 1e-6 && bx > -H + 1e-6) return 5 * H - bx;
    return 7 * H - bz;
  }
  blur(src, r) {
    const { M, dims } = this;
    let a = src, b = new Float32Array(M * dims);
    for (let pass = 0; pass < 3; pass++) { // three box passes ≈ gaussian
      for (let d = 0; d < dims; d++) {
        let sum = 0;
        for (let o = -r; o <= r; o++) sum += a[(((o % M) + M) % M) * dims + d];
        for (let m = 0; m < M; m++) {
          b[m * dims + d] = sum / (2 * r + 1);
          sum += a[(((m + r + 1) % M)) * dims + d] - a[(((m - r) % M + M) % M) * dims + d];
        }
      }
      [a, b] = [b, new Float32Array(M * dims)];
    }
    return a;
  }
  sample(s, radius, out) {
    const { M, dims, radii, levels } = this;
    let li = radii.length - 2;
    for (let i = 0; i < radii.length - 1; i++) if (radius <= radii[i + 1]) { li = i; break; }
    const lt = clamp((radius - radii[li]) / (radii[li + 1] - radii[li]), 0, 1);
    const f = ((s / this.L) * M % M + M) % M, m0 = Math.floor(f), m1 = (m0 + 1) % M, t = f - m0;
    for (let d = 0; d < dims; d++) {
      const A = levels[li], B = levels[li + 1];
      const va = A[m0 * dims + d] * (1 - t) + A[m1 * dims + d] * t;
      const vb = B[m0 * dims + d] * (1 - t) + B[m1 * dims + d] * t;
      out[d] = va + (vb - va) * lt;
    }
    return out;
  }
  mean() {
    const out = new Array(this.dims).fill(0);
    for (let m = 0; m < this.M; m++) for (let d = 0; d < this.dims; d++) out[d] += this.levels[0][m * this.dims + d] / this.M;
    return out;
  }
}
const DETAIL_MEAN = 0.9; // mean value of the procedural ground-detail texture (compensated in vertex colours)

// ------------------------------------------------------------------ shaders
const NOISE_GLSL = /* glsl */`
  float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fxNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fxFbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * fxNoise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return s; }
`;
const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SKY_FRAG = /* glsl */`
  uniform vec3 uSunDir, uZenith, uHorizon, uGround, uHalo, uGlow, uSunColor, uCloudLit, uCloudDark, uBloomColor;
  uniform float uHaloPow, uHaloStr, uGlowStr, uSunCos, uSunStr, uCloud, uTime, uHaze, uBloomStr, uBloomW;
  uniform vec2 uCloudDrift;
  varying vec3 vDir;
  ${NOISE_GLSL}
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y, up = clamp(h, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(up, 0.7));
    col = mix(col, uHorizon, uHaze * exp(-up * 5.0));
    float mu = dot(d, uSunDir), m = max(mu, 0.0);
    // broad forward-scattering glow, strongest along the horizon (sunset band) + tight halo
    float band = 0.45 + 0.55 * exp(-up * 4.0);
    col += uGlow * uGlowStr * pow(m, 3.0) * band;
    col += uHalo * uHaloStr * pow(m, uHaloPow);
    // bloom-like aureole: exponential falloff with the angle to the sun (a tight core plus a wide skirt),
    // so the disc glows without a post-processing pass; it also works with the sun on the horizon
    float ang = sqrt(max(2.0 * (1.0 - mu), 0.0));
    float bloom = 0.65 * exp(-ang / uBloomW) + 0.35 * exp(-ang / (uBloomW * 5.0));
    float cloud = 0.0;
    if (uCloud > 0.002 && h > -0.02) {
      vec2 uv = d.xz / (max(h, 0.0) + 0.1) * 1.4 + uCloudDrift;
      float n = fxFbm(uv);
      cloud = smoothstep(0.72 - 0.42 * uCloud, 0.92 - 0.38 * uCloud, n) * smoothstep(-0.02, 0.1, h) * min(1.0, uCloud * 3.0);
      vec3 cc = mix(uCloudDark, uCloudLit, clamp(0.35 + 0.9 * (n - 0.4), 0.0, 1.0));
      cc += uSunColor * 0.35 * pow(m, 10.0) * uSunStr * 0.05;   // silver lining
      col = mix(col, cc, cloud * 0.92);
    }
    col += uBloomColor * uBloomStr * bloom * (1.0 - 0.8 * cloud);
    float disc = smoothstep(uSunCos - 0.00004, uSunCos + 0.00004, mu);
    col += uSunColor * uSunStr * disc * (1.0 - 0.95 * cloud) * smoothstep(-0.01, 0.005, h + 0.004);
    col = mix(col, uGround, smoothstep(0.0, -0.03, h));       // below the horizon: exactly the fog colour
    col += (fxHash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;  // dither against banding
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const EARTH_FRAG = /* glsl */`
  uniform vec3 uSunDir;
  varying vec3 vNormal, vLocal;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vNormal);
    float lat = vLocal.y, lon = atan(vLocal.z, vLocal.x);
    float land = smoothstep(0.55, 0.62, fxFbm(vec2(lon * 1.6, lat * 3.0) + 3.0));
    vec3 base = mix(vec3(0.02, 0.09, 0.32), vec3(0.18, 0.2, 0.09), land);
    float clouds = smoothstep(0.5, 0.75, fxFbm(vec2(lon * 3.0, lat * 6.0) + 11.0));
    base = mix(base, vec3(0.85), clouds * 0.85);
    base = mix(base, vec3(0.9), smoothstep(0.82, 0.95, abs(lat)));
    float light = smoothstep(-0.05, 0.25, dot(n, uSunDir));
    vec3 col = base * (0.04 + 1.6 * light) + vec3(0.1, 0.25, 0.6) * pow(1.0 - abs(n.z), 3.0) * light * 0.6;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
const EARTH_VERT = /* glsl */`
  varying vec3 vNormal, vLocal;
  void main() { vNormal = normalize(mat3(modelMatrix) * normal); vLocal = position / length(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Particles: positions are fixed in the world and wrapped into a box around the view (no CPU per-particle work).
const PARTICLE_VERT = /* glsl */`
  attribute vec3 aRand;
  attribute float aEnd;
  uniform vec3 uCenter, uHalf, uOffset, uStreak;
  uniform float uTime, uSize, uPxScale, uSwirl, uGround, uLayer, uSway, uMaxPx;
  varying float vAlpha;
  void main() {
    vec3 p = position * 2.0 * uHalf + uOffset * (0.75 + 0.5 * aRand.x);
    p += vec3(sin(uTime * 1.3 + aRand.y * 40.0), 0.4 * sin(uTime * 0.9 + aRand.z * 30.0), cos(uTime * 1.1 + aRand.y * 20.0)) * uSwirl;
    p.xz += vec2(sin(uTime * 0.8 + aRand.z * 25.0), cos(uTime * 0.7 + aRand.x * 25.0)) * uSway;
    vec3 rel = mod(p - uCenter + uHalf, 2.0 * uHalf);
    vec3 wp = uCenter - uHalf + rel;
    wp -= uStreak * aEnd;
    vec3 q = abs(rel / uHalf - 1.0);
    vAlpha = (1.0 - smoothstep(0.65, 1.0, max(q.x, q.z))) * (1.0 - smoothstep(0.75, 1.0, q.y));
    if (uLayer > 0.0) vAlpha *= exp(-max(wp.y - uGround, 0.0) / uLayer);
    vec4 mv = modelViewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * (0.55 + 0.9 * aRand.x) * uPxScale / max(-mv.z, 0.5), 1.0, uMaxPx);
  }
`;
const POINT_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;
const LINE_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ palettes (sRGB hex)
const PALETTE = {
  earth: {
    dayZenith: 0x2f6cc0, dayHorizon: 0xbcd6ee, setZenith: 0x1f3c78, setHorizon: 0xf29a55, setAway: 0x7f86a6,
    nightZenith: 0x02050c, nightHorizon: 0x0b1424, overcast: 0x9aa2ab, haze: 0xd2d4d2, ground: 0x6b6253,
    halo: 0xfff3dc, glowDay: 0xfff0d0, glowSet: 0xff8a3c, sunHigh: 0xfff6e6, sunLow: 0xff8c3a,
    dustZenith: 0xa68262, dustHorizon: 0x7a5638, // haboob: suspended mineral dust (brown-orange)
  },
  mars: {
    dayZenith: 0x8f6a4e, dayHorizon: 0xd9ad7f, setZenith: 0x2e2a30, setHorizon: 0x7d6656, setAway: 0x4a3a35,
    nightZenith: 0x040304, nightHorizon: 0x0d0907, overcast: 0xb08d70, haze: 0xc89a6e, ground: 0x6a4027,
    storm: 0x7a4c28, stormZenith: 0x4a2e1a,
    halo: 0xf6e7d2, glowDay: 0xc7c4c0, glowSet: 0x5f93d6, sunHigh: 0xfff2e0, sunLow: 0xd9e6ff,
  },
  moon: {
    dayZenith: 0x000000, dayHorizon: 0x010102, nightZenith: 0x000000, nightHorizon: 0x000000, ground: 0x050506,
    halo: 0xffffff, glowDay: 0xffffff, sunHigh: 0xffffff, sunLow: 0xffffff,
  },
};

/**
 * Create the effects layer for one terrain scene.
 * @param {typeof import('three')} THREE
 * @param {import('three').Scene} scene
 * @param {{ body?: 'earth'|'moon'|'mars', reducedMotion?: boolean, ambient?: boolean, minLightElevationDeg?: number }} [options]
 */
export function createSceneFx(THREE, scene, { body = 'earth', reducedMotion = false, ambient = true, minLightElevationDeg = 7 } = {}) {
  const C = (hex) => new THREE.Color(hex);
  const root = new THREE.Group();
  root.name = 'scene-fx';
  scene.add(root);
  const visual = new THREE.Group(); // everything setVisible() hides (lights stay on)
  root.add(visual);

  // ---------------------------------------------------------------- lights
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  const nightLight = new THREE.DirectionalLight(0x8ea6d6, 0);
  const hemi = ambient ? new THREE.HemisphereLight(0xdfe9ff, 0x1a1408, 1.0) : null;
  root.add(sunLight, sunLight.target, nightLight, nightLight.target);
  if (hemi) root.add(hemi);

  // ---------------------------------------------------------------- sky dome
  const skyUniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: C(0x2f6cc0) }, uHorizon: { value: C(0xbcd6ee) },
    uGround: { value: C(0x6b6253) }, uHalo: { value: C(0xffffff) }, uGlow: { value: C(0xffffff) }, uSunColor: { value: C(0xffffff) },
    uCloudLit: { value: C(0xffffff) }, uCloudDark: { value: C(0x8090a0) },
    uHaloPow: { value: 600 }, uHaloStr: { value: 0.6 }, uGlowStr: { value: 0.2 }, uSunCos: { value: Math.cos(0.6 * Math.PI / 180) },
    uSunStr: { value: 6 }, uCloud: { value: 0 }, uTime: { value: 0 }, uHaze: { value: 0.2 }, uCloudDrift: { value: new THREE.Vector2() },
    uBloomColor: { value: C(0xffffff) }, uBloomStr: { value: 0 }, uBloomW: { value: 0.02 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), new THREE.ShaderMaterial({
    uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide,
    depthWrite: false, depthTest: false, fog: false,
  }));
  sky.name = 'fx-sky';
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  visual.add(sky);

  // ---------------------------------------------------------------- stars
  const starCount = 1800;
  const starPos = new Float32Array(starCount * 3), starCol = new Float32Array(starCount * 3);
  const starNoise = makeNoise(7);
  for (let i = 0; i < starCount; i++) {
    const u = (i + 0.5) / starCount, phi = Math.acos(1 - 2 * u), theta = i * 2.399963 + starNoise(i, 1) * 0.2;
    starPos.set([STAR_RADIUS * Math.sin(phi) * Math.cos(theta), STAR_RADIUS * Math.cos(phi), STAR_RADIUS * Math.sin(phi) * Math.sin(theta)], i * 3);
    const b = 0.25 + 0.75 * Math.pow(Math.abs(starNoise(i * 3.1, 7.7, 2)), 0.5);
    const tint = starNoise(i * 1.7, 2.2, 1);
    starCol.set([b * (1 + 0.15 * tint), b, b * (1 - 0.15 * tint)], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false,
  }));
  stars.name = 'fx-stars';
  stars.renderOrder = -999;
  stars.frustumCulled = false;
  visual.add(stars);

  // ---------------------------------------------------------------- Earth in the lunar sky
  const earthUniforms = { uSunDir: { value: new THREE.Vector3(0, 1, 0) } };
  // real apparent diameter ≈ 1.9°; drawn at 2.4° so it reads on a laptop screen
  const earthRadius = EARTH_DISC_DIST * Math.tan(1.2 * Math.PI / 180);
  const earthDisc = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 32, 16), new THREE.ShaderMaterial({
    uniforms: earthUniforms, vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG, depthWrite: false, fog: false,
  }));
  earthDisc.name = 'fx-earth';
  earthDisc.renderOrder = -998;
  earthDisc.frustumCulled = false;
  earthDisc.visible = false;
  visual.add(earthDisc);
  const earthDir = new THREE.Vector3(0, 0.05, -1).normalize();

  // ---------------------------------------------------------------- lens glow (one additive sprite)
  // Cheap stand-in for camera bloom: a soft radial sprite on the sun direction (one draw call, a 64² texture
  // built here). It is depth-tested, so the terrain hides it when the sun sits behind a ridge. Display only.
  const GLOW_DIST = 1550;
  const glowTex = (() => {
    const n = 64, data = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      const dx = ((i % n) + 0.5) / n * 2 - 1, dy = (Math.floor(i / n) + 0.5) / n * 2 - 1, r = Math.hypot(dx, dy);
      const a = r >= 1 ? 0 : (0.55 * Math.exp(-r * r * 40) + 0.45 * Math.exp(-r * 4.5)) * (1 - r * r);
      data.set([255, 255, 255, Math.round(255 * clamp(a, 0, 1))], i * 4);
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  })();
  const lensGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false,
  }));
  lensGlow.name = 'fx-lens-glow';
  lensGlow.renderOrder = 5;
  lensGlow.frustumCulled = false;
  lensGlow.visible = false;
  visual.add(lensGlow);
  const sunDirNow = new THREE.Vector3(0, 1, 0);

  // ---------------------------------------------------------------- particles
  function particleSystem(count, { lines = false, color, blending = THREE.NormalBlending }) {
    const verts = lines ? count * 2 : count;
    const pos = new Float32Array(verts * 3), rnd = new Float32Array(verts * 3), end = new Float32Array(verts);
    for (let i = 0; i < count; i++) {
      const p = [Math.random(), Math.random(), Math.random()], r = [Math.random(), Math.random(), Math.random()];
      for (let k = 0; k < (lines ? 2 : 1); k++) {
        const v = lines ? i * 2 + k : i;
        pos.set(p, v * 3); rnd.set(r, v * 3); end[v] = k;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geo.setDrawRange(0, 0);
    const uniforms = {
      uCenter: { value: new THREE.Vector3() }, uHalf: { value: new THREE.Vector3(50, 20, 50) }, uOffset: { value: new THREE.Vector3() },
      uStreak: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSize: { value: 1 }, uPxScale: { value: 1000 }, uSwirl: { value: 0 },
      uGround: { value: 0 }, uLayer: { value: 0 }, uSway: { value: 0 }, uMaxPx: { value: 12 }, uColor: { value: C(color) }, uOpacity: { value: 0.5 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: PARTICLE_VERT, fragmentShader: lines ? LINE_FRAG : POINT_FRAG,
      transparent: true, depthWrite: false, blending, fog: false,
    });
    const object = lines ? new THREE.LineSegments(geo, material) : new THREE.Points(geo, material);
    object.frustumCulled = false;
    object.visible = false;
    object.renderOrder = 10;
    return { object, uniforms, geo, count, lines, active: 0 };
  }
  const dust = particleSystem(MAX_DUST, { color: 0xc9a77c });
  const rainFx = particleSystem(MAX_RAIN, { lines: true, color: 0xb8c4d2 });
  const snow = particleSystem(MAX_SNOW, { color: 0xffffff });
  for (const p of [dust, rainFx, snow]) visual.add(p.object);

  // ---------------------------------------------------------------- context ring
  const ringMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const detail = (() => {
    const n = 128, data = new Uint8Array(n * n * 4), noise = makeNoise(99);
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = Math.floor(i / n);
      // tileable: blend four shifted samples
      const s = (a, b) => noise(a / 9, b / 9, 4) + 0.5 * noise(a / 2.3, b / 2.3, 2);
      const fx = x / n, fy = y / n;
      const v = s(x, y) * (1 - fx) * (1 - fy) + s(x - n, y) * fx * (1 - fy) + s(x, y - n) * (1 - fx) * fy + s(x - n, y - n) * fx * fy;
      const g = clamp(Math.round(255 * (DETAIL_MEAN + 0.07 * v)), 150, 255);
      data.set([g, g, g, 255], i * 4);
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true; // linear data (NoColorSpace): multiplies the vertex colours directly
    return tex;
  })();
  let ring = null;
  let ringToken = 0;

  const fog = new THREE.Fog(0xbcd6ee, 300, 1200);
  const state = {
    body, sun: { elevationDeg: 45, azimuthDeg: 200 }, weather: null, groundY: 0, groundAt: null, visible: true,
    fogNear: 300, fogFar: 1200, time: 0, windVec: new THREE.Vector3(1, 0, 0), windSpeed: 0, gustSpeed: 0,
    rainFall: 60, snowFall: 4, ringOuter: 960, site: null, contextKind: 'none', stormF: 0, rainMode: 'rain',
  };
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3(), camLocal = new THREE.Vector3();

  function weatherFor(w) {
    const base = DEFAULT_WEATHER[state.body] || DEFAULT_WEATHER.earth;
    const out = { ...base, ...(w || {}) };
    for (const k of Object.keys(base)) if (k !== 'snow' && !Number.isFinite(out[k])) out[k] = base[k];
    if (state.body === 'moon') return { ...base, label: w?.label };
    return out;
  }

  // ---------------------------------------------------------------- sky / light / fog solver
  function apply() {
    const b = state.body, P = PALETTE[b] || PALETTE.earth, w = weatherFor(state.weather);
    const el = num(state.sun.elevationDeg, 45), az = num(state.sun.azimuthDeg, 180);
    const sunDir = new THREE.Vector3(...directionFromAngles(el, az));
    const cloud = clamp(num(w.cloudPct, 0) / 100, 0, 1), tau = Math.max(0, num(w.dustTau, 0));
    const vis = num(w.visibilityKm, 30), rain = Math.max(0, num(w.rainMmH, 0));
    const sinEl = Math.max(Math.sin(el * Math.PI / 180), 0.06);
    const toDay = smooth(1, 16, el), toSet = smooth(-12, -1.5, el);
    const setF = smooth(-9, -1, el) * (1 - smooth(4, 18, el));
    const nightF = 1 - smooth(-13, -4, el);
    const dayLight = smooth(-6, 14, el); // how much daylight reaches the sky
    const stormF = b === 'mars' ? smooth(1.2, 3, tau) : 0;
    // Earth haboob / dust storm: mineral dust turns the sky and haze brown-orange (not the grey of urban haze)
    const dustF = b === 'earth' ? smooth(0.6, 3, tau) * (1 - clamp(rain / 2, 0, 1)) : 0;
    state.stormF = stormF;

    const zenith = C(P.nightZenith), horizon = C(P.nightHorizon);
    let haloStr = 0, haloPow = 900, glowStr = 0, sunStr = 0, hazeAmt = 0, bloomStr = 0, bloomW = 0.02, glare = 0;
    const halo = C(P.halo), glow = C(P.glowDay), sunColor = C(P.sunHigh), cloudLit = C(0xffffff), cloudDark = C(0x7d8794);

    if (b === 'moon') {
      // no atmosphere: black sky, a bare sun with a little lens glare
      zenith.set(0x000000); horizon.set(P.dayHorizon);
      const up = smooth(-0.6, 0.3, el);
      sunStr = 9 * up; haloStr = 0.5 * up; haloPow = 1600; glowStr = 0.012 * up;
      bloomStr = 0.2 * up; bloomW = 0.012; glare = 0.3 * up; // lens glare only (no aureole without air)
    } else {
      zenith.lerp(C(P.setZenith), toSet).lerp(C(P.dayZenith), toDay);
      horizon.lerp(C(P.setAway), toSet).lerp(C(P.dayHorizon), toDay);
      // sunset colours concentrate around the sun: glow carries the warm (Earth) / blue (Mars) light
      if (b === 'earth') {
        glow.copy(C(P.glowDay)).lerp(C(P.glowSet), setF);
        glowStr = 0.12 * dayLight + 1.1 * setF * (0.35 + 0.65 * smooth(-6, 2, el));
        halo.lerp(C(0xffb468), setF);
        haloStr = 0.7 * dayLight + 0.5 * setF * smooth(-4, 1, el); haloPow = lerp(400, 120, setF);
        horizon.lerp(C(0xc99aa0), setF * 0.3); // pink anti-twilight band all around
        sunColor.copy(C(P.sunLow)).lerp(C(P.sunHigh), smooth(0, 20, el));
        bloomStr = 0.32 * dayLight + 0.8 * setF * smooth(-3, 1, el); bloomW = lerp(0.02, 0.04, setF);
      } else { // mars: butterscotch day, blue halo at sunset (forward scattering by dust)
        const setM = smooth(-8, -1, el) * (1 - smooth(3, 14, el));
        glow.copy(C(0xd8c0a0)).lerp(C(P.glowSet), setM);
        glowStr = 0.1 * dayLight + 0.5 * setM * smooth(-6, 1, el);
        halo.lerp(C(0xbcd4ff), 0.15 + 0.85 * setM);
        haloStr = 0.55 * dayLight + 0.7 * setM * smooth(-5, 1, el); haloPow = lerp(300, 60, setM);
        sunColor.copy(C(P.sunHigh)).lerp(C(P.sunLow), setF);
        bloomStr = 0.22 * dayLight + 0.3 * setM * smooth(-4, 1, el); bloomW = lerp(0.025, 0.04, setM);
      }
      sunStr = 7 * smooth(-1.2, 0.5, el);
      glare = (b === 'mars' ? 0.12 : 0.25) * smooth(-1.2, 0.5, el);
      // haze: aerosols and poor visibility whiten (Earth) or redden (Mars) the horizon
      hazeAmt = clamp((tau - (b === 'mars' ? 0.3 : 0.08)) * (b === 'mars' ? 0.5 : 1.5), 0, 0.8)
        + clamp((25 - vis) / 25, 0, 1) * 0.6 + clamp(num(w.rhPct, 40) - 80, 0, 20) / 60;
      hazeAmt = clamp(hazeAmt, 0, 1);
      const light = lerp(0.05, 1, dayLight);
      const hazeColor = C(P.haze).multiplyScalar(light);
      horizon.lerp(hazeColor, hazeAmt * 0.6);
      zenith.lerp(hazeColor, hazeAmt * 0.25);
      // clouds: overcast greys the whole sky and darkens it under rain
      const overcast = C(P.overcast).multiplyScalar(light * (1 - 0.35 * clamp(rain / 6, 0, 1)));
      const ov = Math.pow(cloud, 1.4) * 0.8 + clamp(rain / 4, 0, 1) * 0.15;
      zenith.lerp(overcast, ov); horizon.lerp(overcast, ov * 0.85);
      cloudLit.copy(b === 'mars' ? C(0xf2dcc4) : C(0xffffff)).multiplyScalar(lerp(0.06, 1, dayLight)).lerp(C(P.glowSet).multiplyScalar(0.9), setF * 0.6 * (b === 'earth' ? 1 : 0.3));
      cloudDark.copy(C(b === 'mars' ? 0x8a6a52 : 0x7d8794)).multiplyScalar(lerp(0.04, 0.85, dayLight) * (1 - 0.4 * clamp(rain / 6, 0, 1)));
      // Martian dust storm: dark ochre sky, dim reddish sun, almost no halo
      if (stormF > 0) {
        const sl = lerp(0.05, 1, dayLight) * lerp(1, 0.6, smooth(3, 8, tau));
        zenith.lerp(C(P.stormZenith).multiplyScalar(sl), stormF);
        horizon.lerp(C(P.storm).multiplyScalar(sl), stormF);
        glow.lerp(C(0xc07a40), stormF); halo.lerp(C(0xe0a060), stormF);
        glowStr = lerp(glowStr, 0.35 * dayLight, stormF); haloPow = lerp(haloPow, 30, stormF); haloStr *= 1 - 0.5 * stormF;
        sunColor.lerp(C(0xffc890), stormF);
      }
      // Earth haboob: brown-orange sky, darker toward the horizon (the dust wall), wide orange aureole
      if (dustF > 0) {
        const dl = lerp(0.05, 1, dayLight), deep = smooth(2, 6, tau);
        zenith.lerp(C(P.dustZenith).multiplyScalar(dl * lerp(1, 0.75, deep)), dustF * 0.9);
        horizon.lerp(C(P.dustHorizon).multiplyScalar(dl * lerp(1, 0.7, deep)), dustF);
        glow.lerp(C(0xd9843f), dustF); halo.lerp(C(0xffa860), dustF);
        glowStr = lerp(glowStr, 0.4 * dayLight, dustF); haloPow = lerp(haloPow, 35, dustF); haloStr *= 1 - 0.4 * dustF;
        sunColor.lerp(C(0xff5e24), dustF);
        cloudLit.lerp(C(P.dustZenith).multiplyScalar(dl), dustF); cloudDark.lerp(C(P.dustHorizon).multiplyScalar(dl * 0.6), dustF);
      }
      // the solar disc is attenuated by the optical path (Beer–Lambert with air mass ≈ 1/sin el) and clouds
      const ext = Math.exp(-tau * (b === 'mars' ? 0.7 : 1) / sinEl);
      sunStr *= ext * (1 - 0.85 * Math.pow(cloud, 1.2));
      // shortcut: at τ ≳ 3 the real disc is all but extinguished; a dim red disc is kept so the viewer can
      // still place the sun in a haboob. Improve if a photometric sky model replaces this palette solver.
      if (dustF > 0) sunStr = Math.max(sunStr, 1.1 * dustF * smooth(-1.2, 0.5, el) * (1 - 0.85 * cloud));
      const bloomExt = Math.exp(-tau * (b === 'mars' ? 0.35 : 0.3) / sinEl);
      bloomStr *= Math.max(bloomExt, 0.35 * dustF) * (1 - 0.8 * cloud);
      bloomW *= 1 + 1.5 * Math.max(dustF, stormF);       // dust spreads the aureole wide
      glare *= Math.max(Math.min(1, sunStr / 4), 0) * (1 - 0.9 * cloud);
      haloStr *= 1 - 0.7 * cloud; glowStr *= 1 - 0.6 * cloud;
    }
    // ---- night: fade glows, show stars
    haloStr *= 1 - nightF; glowStr *= 1 - nightF; bloomStr *= 1 - nightF;
    const ground = C(P.ground).multiplyScalar(lerp(0.04, 0.55, dayLight)).lerp(horizon, 0.6);

    const u = skyUniforms;
    u.uSunDir.value.copy(sunDir);
    u.uZenith.value.copy(zenith); u.uHorizon.value.copy(horizon); u.uGround.value.copy(b === 'moon' ? C(0x000000) : ground);
    u.uHalo.value.copy(halo); u.uGlow.value.copy(glow); u.uSunColor.value.copy(sunColor);
    u.uHaloStr.value = haloStr; u.uHaloPow.value = haloPow; u.uGlowStr.value = glowStr; u.uSunStr.value = sunStr;
    u.uSunCos.value = Math.cos((b === 'mars' ? 0.55 : 0.75) * Math.PI / 180 * (1 + stormF * 0.6));
    u.uCloud.value = b === 'moon' ? 0 : (b === 'mars' ? cloud * 0.4 : cloud);
    u.uCloudLit.value.copy(cloudLit); u.uCloudDark.value.copy(cloudDark);
    u.uHaze.value = b === 'moon' ? 0 : 0.18 + 0.6 * hazeAmt + 0.4 * Math.max(stormF, dustF);
    u.uBloomStr.value = bloomStr; u.uBloomW.value = bloomW;
    u.uBloomColor.value.copy(sunColor).lerp(halo, 0.5);
    sunDirNow.copy(sunDir);
    lensGlow.material.color.copy(sunColor).multiplyScalar(glare);
    lensGlow.material.opacity = 1;
    lensGlow.visible = glare > 0.01;
    // ≈ 9° across on the Moon (tight), ≈ 12° with air, wider in dust
    lensGlow.scale.setScalar(2 * GLOW_DIST * Math.tan((b === 'moon' ? 4.5 : 6) * (1 + 0.8 * Math.max(dustF, stormF)) * Math.PI / 180));

    const starAlpha = b === 'moon' ? 1 : nightF * (1 - cloud * 0.95) * (1 - hazeAmt * 0.7) * (1 - Math.max(stormF, dustF));
    stars.material.opacity = starAlpha;
    stars.visible = starAlpha > 0.01;

    // ---- direct light: real azimuth, elevation clamped for legibility (documented)
    const lightEl = Math.max(el, minLightElevationDeg);
    sunLight.position.set(...directionFromAngles(lightEl, az)).multiplyScalar(400);
    sunLight.target.position.set(0, 0, 0);
    let direct;
    if (b === 'moon') direct = 2.6 * smooth(-1, 0.4, el);
    else {
      const sf = Number.isFinite(state.weather?.solarFactor) ? clamp(state.weather.solarFactor, 0.05, 1)
        : Math.exp(-tau * 0.35 / sinEl) * (1 - 0.7 * Math.pow(cloud, 1.5));
      direct = 2.3 * smooth(-3, 6, el) * lerp(1, sf, 0.85) * (1 - 0.55 * stormF);
    }
    sunLight.intensity = direct;
    sunLight.color.copy(b === 'earth' ? C(0xffffff).lerp(C(0xffa060), Math.max(setF * 0.7, dustF * 0.6)) : b === 'mars' ? C(0xfff0e0).lerp(C(0xffb070), stormF * 0.7) : C(0xffffff));

    // night light: moonlight on Earth, faint skylight on Mars, earthshine on the Moon — kept readable
    const antiAz = (az + 180) % 360;
    if (b === 'moon') {
      // Earthshine is real (full Earth ≈ 40–100× full moonlight) but still far too dim for a screen.
      // Brightened for readability: real Earth azimuth, elevation lifted to ≥ 25° so a polar site with the
      // Earth on the horizon is not lit only at grazing angles, and a cool, soft fill (low contrast).
      const night = 1 - smooth(-1, 0.4, el);
      const shine = Math.max(Math.asin(clamp(earthDir.y, -1, 1)) * 180 / Math.PI, 25);
      const earthAz = Math.atan2(earthDir.x, -earthDir.z) * 180 / Math.PI;
      nightLight.position.set(...directionFromAngles(shine, earthAz)).multiplyScalar(400);
      nightLight.color.set(0xa9c0f0);
      nightLight.intensity = 0.35 + 0.4 * night;
    } else {
      nightLight.position.set(...directionFromAngles(40, antiAz)).multiplyScalar(400);
      nightLight.color.set(b === 'mars' ? 0xb7a6a0 : 0x8ea6d6);
      // brighter than physical moonlight on purpose: the night must stay readable in the demo
      nightLight.intensity = nightF * (b === 'mars' ? 0.6 : 1.15) * (1 - 0.4 * cloud);
    }
    if (hemi) {
      const skyAmb = zenith.clone().lerp(horizon, 0.5);
      const lum = Math.max(0.0001, 0.2126 * skyAmb.r + 0.7152 * skyAmb.g + 0.0722 * skyAmb.b);
      hemi.color.copy(skyAmb).multiplyScalar(1 / lum).lerp(C(0xffffff), 0.45);
      hemi.groundColor.copy(C(P.ground)).multiplyScalar(0.35);
      if (b === 'moon') {
        // day: faint fill for shadows; night: the main earthshine ambient (flat, cool, readable)
        const day = smooth(-1, 0.4, el);
        hemi.color.set(0xb8c4dc).lerp(C(0x9fb2d8), 1 - day); hemi.groundColor.set(0x1a1a1e).lerp(C(0x3a4050), 1 - day);
        hemi.intensity = lerp(0.82, 0.5, day);
      }
      else {
        if (b === 'earth') hemi.color.lerp(C(0xc7d8f2), 0.4);
        hemi.intensity = lerp(0.55, 1.0, dayLight) * (1 + 0.35 * cloud + 0.3 * stormF) * (1 - 0.25 * clamp(rain / 6, 0, 1));
        if (nightF > 0.5) hemi.color.lerp(C(0x6f82a8), nightF - 0.5);
      }
    }

    // ---- fog / haze (none on the Moon)
    if (b === 'moon') {
      scene.fog = null;
    } else {
      const visU = vis * 1000 * 0.1 * 0.4;               // visibility → scene units, compressed so the 19 km ring still reads
      const tauFar = 1000 / (1 + 2.2 * tau);
      let far = Math.min(Number.isFinite(visU) ? visU : Infinity, tauFar) * (1 - 0.4 * clamp(rain / 8, 0, 1)) * (1 - 0.3 * cloud);
      far = clamp(far, 60, 1500);
      state.fogFar = far; state.fogNear = far * (0.1 - 0.06 * stormF);
      fog.color.copy(horizon);
      if (stormF > 0) fog.color.lerp(C(P.storm).multiplyScalar(lerp(0.05, 1, dayLight)), stormF * 0.5);
      if (dustF > 0) fog.color.lerp(C(P.dustHorizon).multiplyScalar(lerp(0.05, 1, dayLight) * 0.85), dustF * 0.4);
      if (state.visible) scene.fog = fog;
    }
    if (b === 'moon' || b === 'mars') u.uGround.value.copy(b === 'moon' ? C(0x000000) : fog.color);
    else u.uGround.value.copy(fog.color);

    // ---- particles: wind and precipitation
    const windTo = (num(w.windDirDeg, 270) + 180) % 360;
    state.windVec.set(...directionFromAngles(0, windTo));
    state.windSpeed = Math.max(0, num(w.windMs, 0));
    state.gustSpeed = Math.max(state.windSpeed, num(w.gustMs, state.windSpeed));
    const windIdx = Math.max(state.windSpeed, state.gustSpeed * 0.8);
    let dustAmt = 0;
    if (b === 'mars') dustAmt = Math.max(smooth(6, 22, windIdx) * 0.6, smooth(0.6, 3, tau)) + 0.12 * smooth(2, 8, windIdx);
    else if (b === 'earth') dustAmt = smooth(5, 15, windIdx) * (1 - clamp(rain / 2, 0, 1)) * (w.snow ? 0.2 : 1) * 0.8 + smooth(0.25, 1.2, tau) * 0.6 + 0.08 * smooth(2.5, 6, windIdx);
    dustAmt = clamp(dustAmt, 0, 1);
    dust.active = Math.round(MAX_DUST * dustAmt);
    dust.uniforms.uColor.value.copy(b === 'mars' ? C(0xc08452).lerp(C(0x8a5530), stormF) : C(0xcdb08a)).multiplyScalar(lerp(0.12, 1, dayLight));
    dust.uniforms.uOpacity.value = lerp(0.18, 0.55, dustAmt) * (1 + 0.5 * stormF);
    const rainAmt = b === 'earth' && rain > 0 && !w.snow ? clamp(0.15 + rain / 10, 0, 1) : 0;
    // without rain, the streak system draws wind-blown dust streaks (saltation / storm) when the wind is strong
    const streakAmt = rainAmt > 0 ? 0 : clamp(Math.max(stormF, smooth(12, 26, windIdx) * (b === 'moon' ? 0 : 0.7)), 0, 1) * (w.snow ? 0 : 1);
    state.rainMode = rainAmt > 0 ? 'rain' : 'dust';
    rainFx.active = Math.round(MAX_RAIN * (rainAmt || streakAmt * 0.7));
    if (rainAmt > 0) {
      rainFx.uniforms.uColor.value.set(0xc5d0dc).multiplyScalar(lerp(0.15, 1, dayLight));
      rainFx.uniforms.uOpacity.value = 0.45 + 0.25 * rainAmt;
    } else {
      rainFx.uniforms.uColor.value.copy(dust.uniforms.uColor.value).multiplyScalar(1.15);
      rainFx.uniforms.uOpacity.value = 0.28 + 0.25 * streakAmt;
    }
    const snowAmt = w.snow && b !== 'moon' ? clamp(0.25 + rain / 4 + cloud * 0.35, 0, 1) : 0;
    snow.active = Math.round(MAX_SNOW * snowAmt);
    snow.uniforms.uColor.value.set(0xffffff).multiplyScalar(lerp(0.2, 1, dayLight));
    snow.uniforms.uOpacity.value = 0.85;
    for (const p of [dust, rainFx, snow]) {
      p.geo.setDrawRange(0, p.lines ? p.active * 2 : p.active);
      p.object.visible = p.active > 0;
    }
    state.rainFall = 55 + rain * 2;
  }

  function placeEarthDisc() {
    if (state.body !== 'moon' || !state.site) { earthDisc.visible = false; return; }
    const pos = earthFromMoon(state.site[0], state.site[1]);
    // libration lifts the Earth up to ~6.7° above a polar horizon; draw it at ≥ 3° so it is not lost behind the rim
    const shown = Math.max(pos.elevationDeg, 3);
    earthDir.set(...directionFromAngles(shown, pos.azimuthDeg));
    earthDisc.visible = pos.elevationDeg > -8;
  }

  // ---------------------------------------------------------------- context ring geometry
  function buildRing({ grid, base, exag, U, context, windowSegments }) {
    const stats = gridStats(grid);
    const halfM = (grid.gridSize - 1) * grid.spacingMeters / 2;
    const innerHalf = halfM * U;
    const ctxOk = gridOk(context);
    const ctxHalfM = ctxOk ? (context.gridSize - 1) * context.spacingMeters / 2 : 0;
    const outerHalf = clamp((ctxOk ? ctxHalfM : DEFAULT_RING_HALF_M) * U, innerHalf * 2, 1500);
    const segs = windowSegments || Math.min(128, Math.max(grid.gridSize - 1, 96));
    const axis = ringAxis(innerHalf, segs, outerHalf);
    const n = axis.length;
    const noise = makeNoise(hashString(grid.id || grid.name || 'ring'));
    const bias = ctxOk ? num(context.centerBiasM, 0) : 0;
    const R = BODY_RADIUS_M[state.body] || BODY_RADIUS_M.earth;
    const amp = clamp(stats.std * 1.3, 4, 150);
    // window edge as a closed perimeter profile, pre-blurred at several radii: points outside are projected
    // radially onto the edge, so there are no corner seams, and the profile is blurred more the further out
    const perim = new Perimeter(halfM, (bx, bz) => [sampleGrid(grid, bx, bz)], 1);
    const positions = new Float32Array(n * n * 3), uvs = new Float32Array(n * n * 2);
    const dists = new Float32Array(n * n), heights = new Float32Array(n * n), perimS = new Float32Array(n * n), sea = new Uint8Array(n * n);
    const out = [0];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = axis[i], z = axis[j], k = j * n + i;
      const xm = x / U, zm = z / U;
      // metres outside the window (Euclidean distance to the square: rounded corners, no diagonal crease)
      const dM = Math.hypot(Math.max(Math.abs(xm) - halfM, 0), Math.max(Math.abs(zm) - halfM, 0));
      // domain warp along the edge so blurred edge features do not read as straight radial streaks
      const sParam = perim.param(xm, zm) + (dM > 0 ? noise(xm / 1800 + 31, zm / 1800 - 7, 3) * Math.min(dM, 3000) * 0.6 : 0);
      let h;
      if (dM <= 0) h = sampleGrid(grid, xm, zm);
      else {
        const edge = perim.sample(sParam, Math.min(dM * 1.0, 4000), out)[0];
        const inCtx = ctxOk && Math.abs(xm) <= ctxHalfM && Math.abs(zm) <= ctxHalfM;
        if (inCtx) {
          const raw = sampleGrid(context, xm, zm);
          // Earth coast: keep the sea flat at 0 m (DEMs carry noise over water)
          h = lerp(edge, (state.body === 'earth' && raw <= 0.5 ? 0 : raw) - bias, smooth(0, 700, dM));
          if (state.body === 'earth' && raw <= 0.5) sea[k] = 1;
        }
        else {
          const nn = noise(xm / 2600, zm / 2600, 5);
          const grow = 0.5 + 1.8 * smooth(0, 8000, dM); // illustrative relief grows with distance (reads as far hills)
          const rough = noise(xm / 520 - 13, zm / 520 + 5, 3) * amp * 0.22; // short-wave texture so slopes catch the light
          h = lerp(edge, stats.mean, smooth(0, 3500, dM)) + (amp * grow * nn + rough) * smooth(0, 700, dM);
        }
      }
      heights[k] = h; perimS[k] = sParam; dists[k] = dM;
      const drop = dM > 0 ? (dM * dM) / (2 * R) : 0;   // planetary curvature (real radius), so the far edge sinks
      positions.set([x, (h - base - drop) * exag * U, z], k * 3);
      uvs.set([x / (2 * outerHalf) + 0.5, 0.5 - z / (2 * outerHalf)], k * 2);
    }
    const index = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const cx = (axis[i] + axis[i + 1]) / 2, cz = (axis[j] + axis[j + 1]) / 2;
      if (Math.abs(cx) < innerHalf && Math.abs(cz) < innerHalf) continue; // hole: the measured window goes here
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
    geometry.setIndex(n * n > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return { geometry, n, axis, dists, heights, perimS, sea, stats, halfM, outerHalf, innerHalf, noise, ctxOk, U };
  }

  function colorRing(r, pixels) {
    const col = r.geometry.attributes.color, pos = r.geometry.attributes.position;
    const [low, high] = (BODY_RAMP[state.body] || BODY_RAMP.earth).map((c) => C(c));
    const { min, max } = r.stats, relief = Math.max(1, max - min);
    const tmpc = [0, 0, 0];
    const perim = pixels ? new Perimeter(r.halfM, (bx, bz) => samplePixels(pixels, bx / (2 * r.halfM) * 0.985 + 0.5, bz / (2 * r.halfM) * 0.985 + 0.5, [0, 0, 0]), 3) : null;
    const mean = perim ? perim.mean() : null;
    const c = new THREE.Color();
    const SEA = C(0x1f4a66);
    const gain = 1 / DETAIL_MEAN;
    for (let k = 0; k < r.n * r.n; k++) {
      const x = pos.getX(k) / r.U, z = pos.getZ(k) / r.U, dM = r.dists[k];
      const t = clamp((r.heights[k] - min) / relief, 0, 1);
      if (perim) {
        perim.sample(r.perimS[k], Math.min(dM * 1.4, 4000), tmpc);
        const f = smooth(0, 2200, dM);
        c.setRGB(lerp(tmpc[0], mean[0], f), lerp(tmpc[1], mean[1], f), lerp(tmpc[2], mean[2], f));
        c.multiplyScalar(lerp(1, 0.82 + 0.36 * t, f * 0.7));   // far away, relief tints brightness like the ramp
      } else {
        c.copy(low).lerp(high, 0.15 + 0.7 * t);
      }
      if (dM > 0) {
        const fine = r.noise(x / 420, z / 420, 3), broad = r.noise(x / 3000 + 50, z / 3000, 3);
        const k2 = state.body === 'earth' ? 1 : 1.6;
        c.multiplyScalar(1 + (0.09 * fine + 0.08 * broad) * k2 * smooth(0, 400, dM));
      }
      if (r.sea[k]) c.copy(SEA).multiplyScalar(1 + 0.05 * r.noise(x / 300, z / 300, 2));
      c.multiplyScalar(gain);
      col.setXYZ(k, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  // ---------------------------------------------------------------- public API
  const api = {
    get body() { return state.body; },
    get contextKind() { return state.contextKind; },
    get groundY() { return state.groundY; },
    lights: { sun: sunLight, night: nightLight, hemi },
    reducedMotion: Boolean(reducedMotion),

    /** Change the body (terrainB is reused across Moon/Mars scenarios). Re-applies sky and weather. */
    setBody(next) {
      if (!PALETTE[next] || next === state.body) return;
      state.body = next;
      placeEarthDisc();
      apply();
    },

    /**
     * Build the context ring around the measured window.
     * @returns {{ contextKind: 'measured-lowres'|'illustrative'|'none', ready: Promise<void> }}
     */
    setTerrain({ grid, base, exag = 2, U = 0.1, context = null, contextImageUrl = null, imageryUrl = null, body: b, windowSegments } = {}) {
      if (b && PALETTE[b] && b !== state.body) { state.body = b; }
      const token = ++ringToken;
      if (ring) { visual.remove(ring); ring.geometry.dispose(); ring = null; }
      if (ringMaterial.map && ringMaterial.map !== detail) { ringMaterial.map.dispose(); }
      ringMaterial.map = null;
      if (!gridOk(grid)) { state.contextKind = 'none'; apply(); return { contextKind: 'none', ready: Promise.resolve() }; }
      const baseM = Number.isFinite(base) ? base : gridStats(grid).min;
      state.site = Array.isArray(grid.center) ? grid.center : null;
      const r = buildRing({ grid, base: baseM, exag, U, context, windowSegments });
      state.groundY = (r.stats.mean - baseM) * exag * U;
      // ground height (scene units) under a scene-unit point: window grid inside, clamped to its edge outside
      state.groundAt = (xu, zu) => (sampleGrid(grid, xu / U, zu / U) - baseM) * exag * U;
      state.contextKind = r.ctxOk ? 'measured-lowres' : 'illustrative';
      state.ringOuter = r.outerHalf;
      colorRing(r, null);
      ringMaterial.map = detail;
      detail.repeat.set(r.outerHalf / 24, r.outerHalf / 24);
      ringMaterial.vertexColors = true;
      ringMaterial.needsUpdate = true;
      ring = new THREE.Mesh(r.geometry, ringMaterial);
      ring.name = 'fx-context-ring';
      ring.userData.contextKind = state.contextKind;
      ring.renderOrder = -1;
      visual.add(ring);
      placeEarthDisc();
      apply();
      const ctxUrl = r.ctxOk ? (contextImageUrl || context?.imagery?.path || null) : null;
      const ready = (async () => {
        if (ctxUrl) {
          const tex = await new Promise((resolve) => new THREE.TextureLoader().load(ctxUrl, resolve, undefined, () => resolve(null)));
          if (token !== ringToken) { tex?.dispose(); return; }
          if (tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            ringMaterial.map = tex;
            const col = r.geometry.attributes.color;
            for (let k = 0; k < r.n * r.n; k++) col.setXYZ(k, 0.97, 0.97, 0.97);
            col.needsUpdate = true;
            ringMaterial.needsUpdate = true;
            return;
          }
        }
        const img = await loadImage(imageryUrl);
        if (token !== ringToken || !img) return;
        const px = imagePixels(img, 160);
        if (px) colorRing(r, px);
      })();
      return { contextKind: state.contextKind, ready };
    },

    /** Sun position in the body's sky (azimuth from north, clockwise). */
    setSun({ elevationDeg, azimuthDeg } = {}) {
      state.sun = { elevationDeg: num(elevationDeg, 45), azimuthDeg: num(azimuthDeg, 180) };
      apply();
    },

    /** WeatherState from docs/modules/m3-processes.md (missing fields fall back to a clear sky for the body). */
    setWeather(weather) {
      state.weather = weather ? { ...weather } : null;
      apply();
    },

    setReducedMotion(on) { api.reducedMotion = Boolean(on); },

    /**
     * Per-frame update. Call once per scene per frame, before rendering, with the camera used to render it.
     * @param {number} dt seconds
     * @param {import('three').Camera} camera
     * @param {{ heightPx?: number }} [view] drawing-buffer height in pixels (for particle sizes)
     */
    update(dt, camera, { heightPx = 900 } = {}) {
      if (!camera) return;
      const still = api.reducedMotion;
      const step = still ? 0 : Math.min(0.1, Math.max(0, dt || 0));
      state.time += step;
      camLocal.copy(camera.position).sub(scene.position);
      sky.position.copy(camLocal); stars.position.copy(camLocal);
      earthDisc.position.copy(camLocal).addScaledVector(earthDir, EARTH_DISC_DIST);
      lensGlow.position.copy(camLocal).addScaledVector(sunDirNow, GLOW_DIST);
      earthUniforms.uSunDir.value.copy(skyUniforms.uSunDir.value);
      skyUniforms.uTime.value = state.time % 1000;
      const cloudSpeed = 0.004 + state.windSpeed * 0.0012;
      skyUniforms.uCloudDrift.value.addScaledVector(new THREE.Vector2(state.windVec.x, state.windVec.z), step * cloudSpeed);

      const groundCam = state.groundAt ? state.groundAt(camLocal.x, camLocal.z) : state.groundY;
      const h = clamp(camLocal.y - groundCam, 0, 600);
      // the orbit camera (≈100 u above the ground) gets a lighter haze than the rover cameras
      if (state.body !== 'moon') {
        fog.near = state.fogNear + h * 1.3;
        // never let the ring's outer edge show through: fully fogged before it
        const edgeDist = Math.max(60, state.ringOuter * 0.95 - Math.hypot(camLocal.x, camLocal.z));
        fog.far = Math.max(fog.near + 40, Math.min(state.fogFar + h * 2.2, edgeDist));
      }

      // particle box: sized by the camera height above the ground and pushed forward along the view, so the
      // orbit view (≈100 u up) gets a wide sparse cloud and the rover cameras a dense one close by
      camera.getWorldDirection(fwd);
      const half = clamp(h * 1.6 + 18, 22, 180);
      tmp.set(fwd.x, 0, fwd.z);
      if (tmp.lengthSq() < 1e-6) tmp.set(0, 0, -1);
      tmp.normalize().multiplyScalar(half * 0.85).add(camLocal);
      const fovRad = (camera.fov || 45) * Math.PI / 180;
      const pxScale = heightPx / (2 * Math.tan(fovRad / 2));
      const gust = state.windSpeed + (state.gustSpeed - state.windSpeed) * (0.5 + 0.5 * Math.sin(state.time * 0.7) * Math.sin(state.time * 1.9 + 1));
      const visualGain = clamp(half / 12, 2.5, 12); // wind drawn faster in wide views so it still reads as motion
      const g = state.groundAt ? state.groundAt(tmp.x, tmp.z) : state.groundY;
      if (dust.active) {
        const layer = clamp(half * 0.25, 4, 50) * (1 + 1.8 * state.stormF);
        const u = dust.uniforms;
        u.uCenter.value.set(tmp.x, g + layer * 0.9, tmp.z);
        u.uHalf.value.set(half, layer, half);
        u.uOffset.value.addScaledVector(state.windVec, gust * 0.1 * visualGain * step);
        u.uOffset.value.y += Math.sin(state.time * 0.5) * step * 0.3;
        u.uTime.value = state.time; u.uPxScale.value = pxScale;
        u.uSize.value = half * 0.007 * (1 + 0.4 * state.stormF); u.uMaxPx.value = 7 + 5 * state.stormF;
        u.uSwirl.value = half * 0.012; u.uGround.value = g; u.uLayer.value = layer * (0.5 + 0.6 * state.stormF);
      }
      if (rainFx.active || snow.active) {
        const top = clamp(half * 0.9, 25, 150);
        for (const p of [rainFx, snow]) {
          if (!p.active) continue;
          const u = p.uniforms;
          // precipitation box: closer to the camera than the dust box, from the ground to above the camera
          const cx = camLocal.x + (tmp.x - camLocal.x) * 0.6, cz = camLocal.z + (tmp.z - camLocal.z) * 0.6;
          const lo = Math.min(g, camLocal.y) - 2, hi = Math.max(camLocal.y + 12, g + top);
          u.uCenter.value.set(cx, (lo + hi) / 2, cz);
          u.uHalf.value.set(half * 0.8, (hi - lo) / 2, half * 0.8);
          u.uTime.value = state.time; u.uPxScale.value = pxScale; u.uGround.value = g; u.uLayer.value = 0;
        }
        if (rainFx.active && state.rainMode === 'dust') {
          // dust streaks hug the ground and fly with the wind
          const layer = clamp(half * 0.2, 3, 30) * (1 + state.stormF);
          rainFx.uniforms.uCenter.value.y = g + layer; rainFx.uniforms.uHalf.value.y = layer;
          rainFx.uniforms.uLayer.value = layer * 0.6;
          const sp = Math.max(gust, 4) * 0.12 * visualGain;
          const vel = tmp.clone().set(state.windVec.x * sp, -0.05 * sp, state.windVec.z * sp);
          rainFx.uniforms.uOffset.value.addScaledVector(vel, step);
          rainFx.uniforms.uStreak.value.copy(vel).normalize().multiplyScalar(half * 0.05);
        } else if (rainFx.active) {
          const fall = state.rainFall * clamp(half / 40, 0.6, 3);
          const vel = tmp.clone().set(state.windVec.x * gust * 0.4 * visualGain, -fall, state.windVec.z * gust * 0.4 * visualGain);
          rainFx.uniforms.uOffset.value.addScaledVector(vel, step);
          rainFx.uniforms.uStreak.value.copy(vel).normalize().multiplyScalar(half * 0.07); // tail trails behind the head
        }
        if (snow.active) {
          const fall = state.snowFall * clamp(half / 40, 0.6, 3);
          snow.uniforms.uOffset.value.add(tmp.clone().set(state.windVec.x * gust * 0.15 * visualGain, -fall, state.windVec.z * gust * 0.15 * visualGain).multiplyScalar(step));
          snow.uniforms.uSize.value = half * 0.006; snow.uniforms.uMaxPx.value = 9; snow.uniforms.uSway.value = half * 0.015;
        }
      }
    },

    /** Hide/show sky, stars, ring, fog and particles. The managed lights stay on so the terrain is still lit. */
    setVisible(on) {
      state.visible = Boolean(on);
      visual.visible = state.visible;
      if (!state.visible) { if (scene.fog === fog) scene.fog = null; } else apply();
    },

    /** Remove everything this module added to the scene and free GPU memory. */
    dispose() {
      ringToken++;
      if (scene.fog === fog) scene.fog = null;
      scene.remove(root);
      root.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); }
      });
      detail.dispose();
      ringMaterial.dispose();
      sunLight.dispose?.(); nightLight.dispose?.(); hemi?.dispose?.();
    },
  };
  apply();
  return api;
}
