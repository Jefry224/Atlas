// Una escena por magnitud: fuerzas, escalares, flujos o datos regionales.
import { THREE, mesh } from './nasa-stage.mjs';
import { BENCH_COLORS as COLORS, inspectionValue as value, signedFraction } from './bench-inspection.mjs';
const color = key => COLORS[key] || key;
const finite = Number.isFinite;

export function inspectionVisual(view) {
  const group = new THREE.Group(), labels = [];
  const box = (size, position, tone, options = {}) => {
    const object = mesh(new THREE.BoxGeometry(...size), color(tone), options); object.position.set(...position); group.add(object); return object;
  };
  const label = (text, position, tone) => labels.push({ text, position, color: color(tone) });
  const line = (points, tone, dashed = false) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const material = dashed ? new THREE.LineDashedMaterial({ color: color(tone), dashSize: .1, gapSize: .08 }) : new THREE.LineBasicMaterial({ color: color(tone) });
    const object = new THREE.Line(geometry, material); if (dashed) object.computeLineDistances(); group.add(object); return object;
  };
  const arrow = (origin, direction, length, tone) => {
    if (!finite(length) || length <= 0) return;
    group.add(new THREE.ArrowHelper(new THREE.Vector3(...direction).normalize(), new THREE.Vector3(...origin), length, color(tone), Math.min(.19, length * .35), Math.min(.13, length * .25)));
  };
  const ring = (position, radius, tone) => {
    const object = mesh(new THREE.TorusGeometry(radius, .025, 8, 48), color(tone), { emissive: color(tone), emissiveIntensity: .25 });
    object.rotation.x = -Math.PI / 2; object.position.set(...position); group.add(object); return object;
  };
  const empty = (position, text = 'No data') => { box([.85, 1.5, .6], position, 'unknown', { wireframe: true, transparent: true, opacity: .4 }); label(text, [position[0], position[1] + .95, position[2]], 'unknown'); };
  const column = (x, n, maximum, tone, text, z = .1) => {
    box([.8, .05, .7], [x, -.73, z], 'unknown');
    if (!finite(n)) { empty([x, .05, z], `${text} · no data`); return; }
    const height = n / maximum * 2.7;
    if (height > 0) box([.65, height, .55], [x, -.7 + height / 2, z], tone, { emissive: color(tone), emissiveIntensity: .2 });
    label(`${text} · ${value(n)}`, [x, -.4 + height, z], tone);
  };
  const { factor, data, state } = view;
  if (factor === 'gravity') {
    if (state.mode === 'offload') {
      for (const x of [-2.5, 2.5]) box([.06, 3.6, .06], [x, 1, -.65], 'unknown');
      box([5.06, .07, .07], [0, 2.8, -.65], 'unknown');
      if (state.known && state.supportN > 0) line([[0, 1.2, 0], [0, 2.8, -.65]], 'support');
    } else {
      // Referencia fija del peso original frente a la masa aligerada.
      line([[-2.65, -.7, -.8], [-2.65, 2, -.8]], 'earth', true);
      label(`Mass ×${value(data.fraction)}`, [0, 2.35, -.4], 'support');
    }
    if (state.known) {
      arrow([-1.85, 2, .75], [0, -1, 0], 2.45 * state.testEarthWeightN / data.max, 'earth');
      arrow([0, .35, 1.5], [0, Math.sign(state.supportN), 0], 2.45 * Math.abs(state.supportN) / data.max, 'support');
      arrow([1.9, -.7, .7], [0, 1, 0], 2.45 * state.contactLoadN / data.max, 'contact');
      label(`W ${value(state.testEarthWeightN, 'N')}`, [-1.85, 2.25, .75], 'earth');
      label(`N ${value(state.contactLoadN, 'N')}`, [1.9, -.45 + 2.45 * state.contactLoadN / data.max, .7], 'contact');
      label(`F ${value(state.supportN, 'N')}`, [0, .1, 1.55], 'support');
    } else label('No computable load', [0, 1.7, 0], 'unknown');
  } else if (factor === 'pressure') {
    for (const [index, side] of ['earth', 'target'].entries()) {
      const x = index === 0 ? -1.8 : 1.8, n = data[side];
      box([1.5, 1.8, 1.45], [x, .25, 0], side, { transparent: true, opacity: .09, depthWrite: false });
      box([1.5, 1.8, 1.45], [x, .25, 0], side, { wireframe: true, transparent: true, opacity: .6 });
      label(`${index ? 'Target' : 'Earth'} · ${value(n, 'Pa')}`, [x, 1.75, 0], side);
      if (finite(n) && n > 0) {
        const length = .95 * Math.log1p(n) / Math.log1p(data.max);
        for (const z of [-.35, .35]) { arrow([x - .78 - length, .25, z], [1, 0, 0], length, side); arrow([x + .78 + length, .25, z], [-1, 0, 0], length, side); }
        arrow([x, 1.2 + length, 0], [0, -1, 0], length, side);
      } else label(n === 0 ? 'Ideal vacuum · 0 Pa' : 'Pressure pending', [x, -.35, .9], n === 0 ? side : 'unknown');
    }
  } else if (factor === 'atmosphere') {
    box([3.9, 2.6, 2.8], [0, .55, 0], 'gas', { wireframe: true, transparent: true, opacity: .22 });
    ring([0, -.72, 0], 2.2, 'gas');
    line([[-2.5, -.69, 0], [2.5, -.69, 0]], 'unknown'); line([[0, -.69, -2.4], [0, -.69, 2.4]], 'unknown');
    label('N', [0, -.6, -2.45], 'gas'); label('E', [2.6, -.6, 0], 'gas');
    if (data.wind?.speed > 0) {
      const d = data.wind.toward;
      arrow([-d[0] * 1.4, 2, -d[2] * 1.4], d, 2.8, 'gas');
      label(`${value(data.wind.speed, 'm/s')} · from ${value(data.wind.fromDeg, '°')}`, [0, 2.65, 0], 'gas');
    } else label(data.speed === 0 ? 'Calm wind · 0 m/s' : 'Wind · no vector available', [0, 2.3, 0], 'unknown');
  } else if (factor === 'temperature') {
    // El rover es contexto: los nodos tienen su propia escala absoluta y no cambian su material.
    for (const [j, n] of data.temperatures.entries()) column(-2 + j * 2, n, data.max, ['heat', 'gas', 'target'][j], ['Ts K', 'Ta K', 'Tr K'][j], 1.5);
    const { minK, maxK } = data.surface || {};
    if (finite(minK) && finite(maxK)) {
      line([[-2, 2.7, -.6], [2, 2.7, -.6]], 'unknown');
      const start = -2 + minK / data.max * 4, end = -2 + maxK / data.max * 4;
      box([Math.max(.01, end - start), .12, .12], [(start + end) / 2, 2.7, -.6], 'target');
      label(`Target ground ${value(minK)}–${value(maxK, 'K')}`, [0, 3.05, -.6], 'target');
    }
  } else if (factor === 'heat-transfer') {
    for (const [j, key] of ['convection', 'radiation'].entries()) {
      const n = data[key], tone = j ? 'heat' : 'gas', direction = j ? 1 : -1, x = direction * 2.6;
      box([.5, 1.1, 1.2], [x, .8, 0], tone, { transparent: true, opacity: .22, wireframe: true });
      const length = finite(n) ? 1.75 * Math.abs(signedFraction(n, data.max)) : null;
      if (finite(n) && n !== 0) {
        const origin = n > 0 ? [direction * .6, 1.1, .9] : [direction * (length + .6), 1.1, .9];
        arrow(origin, [direction * Math.sign(n), 0, 0], length, tone);
      } else line([[direction * .6, 1.1, .9], [direction * 2.35, 1.1, .9]], 'unknown', true);
      label(`${j ? 'Entorno / Qrad' : 'Gas / Qconv'} · ${value(n, 'W')}`, [x, 1.95, 0], tone);
    }
    label('Equipment · Ts', [0, -.35, 1.1], 'unknown');
  } else if (factor === 'radiation') {
    column(-2, data.solar, data.max, 'earth', 'Earth W/m²'); column(0, data.reference, data.max, 'target', 'Exoatmospheric W/m²');
    ring([2.35, .25, .2], .65, 'unknown').rotation.x = 0;
    box([1.25, 1.7, .5], [2.35, .3, .1], 'unknown', { wireframe: true, opacity: .4, transparent: true });
    label(`Dosis · ${value(data.targetDose, 'Sv/s')}`, [2.35, 1.65, .1], 'unknown');
    label('IONIZING CHANNEL', [2.35, -.65, .6], 'unknown');
  } else if (factor === 'regolith') {
    for (let j = 0; j < 3; j++) box([4.4, .25, 2.6], [0, -1 - j * .32, 0], j ? 'unknown' : 'target', { wireframe: true, transparent: true, opacity: .25 });
    ring([0, -.74, 0], 1.5, 'contact');
    if (state.known) arrow([1.9, -.7, 1], [0, 1, 0], 2.5 * state.contactLoadN / data.max, 'contact');
    label(`N total · ${value(state.contactLoadN, 'N')}`, [1.9, 1.8, 1], 'contact');
    label('Cohesion · friction · grains: unmeasured', [0, -1.7, 1.2], 'unknown');
  } else if (factor === 'geometry') {
    for (const [index, surface] of data.terrain.surfaces.entries()) {
      const side = index ? 'target' : 'earth', x = index ? 1.8 : -1.8;
      if (!surface) { empty([x, .25, 0], 'DEM pending'); continue; }
      const horizontalScale = 2.9 / data.terrain.extent, vertices = [], indices = [];
      for (const [east, height, south] of surface.vertices) vertices.push(x + (east - surface.extent / 2) * horizontalScale, -.68 + height * horizontalScale * data.terrain.exaggeration, (south - surface.extent / 2) * horizontalScale);
      for (let row = 0; row < surface.count - 1; row++) for (let col = 0; col < surface.count - 1; col++) {
        const a = row * surface.count + col, b = a + surface.count; indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      const terrain = mesh(geometry, color(side), { side: THREE.DoubleSide, roughness: .95 }); group.add(terrain);
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: color(side), opacity: .14, transparent: true })); group.add(wire);
      label(`${index ? 'Target' : 'Earth'} · real DEM`, [x, 2.35, 0], side);
      label(`Ventana ${value(surface.extent, 'm')}`, [x, -.65, 1.8], side);
    }
  } else if (factor === 'scale') {
    const maxExtent = Math.max(data.earth?.extentMeters || 0, data.target?.extentMeters || 0, 1);
    const zoomExtent = Math.max(data.earth?.nativeResolutionMeters || 0, data.target?.nativeResolutionMeters || 0, data.earth?.spacingMeters || 0, data.target?.spacingMeters || 0, 1) * 2;
    for (const [index, side] of ['earth', 'target'].entries()) {
      const g = data[side], x = index ? 1.8 : -1.8;
      if (!g) { empty([x, .25, 0], 'Scale pending'); continue; }
      const size = 2.6 * g.extentMeters / maxExtent;
      box([size, .05, size], [x, -.68, -.3], side, { transparent: true, opacity: .16 });
      // Todas las líneas de la rejilla; no se dibujan píxeles ficticios más finos.
      if (finite(g.spacingMeters) && g.spacingMeters > 0) for (let j = 0; j < Math.min(257, g.gridSize); j++) {
        const p = j * g.spacingMeters / g.extentMeters * size - size / 2;
        line([[x + p, -.63, -.3 - size / 2], [x + p, -.63, -.3 + size / 2]], side);
        line([[x - size / 2, -.63, -.3 + p], [x + size / 2, -.63, -.3 + p]], side);
      }
      box([1.75, .04, 1.75], [x, .45, 1], 'unknown', { wireframe: true });
      if (finite(g.nativeResolutionMeters) && g.nativeResolutionMeters > 0) {
        const nativeSize = 1.75 * g.nativeResolutionMeters / zoomExtent;
        box([nativeSize, .05, nativeSize], [x, .5, 1], side);
      }
      label(`${index ? 'Target' : 'Earth'} · native ${value(g.nativeResolutionMeters, 'm')}`, [x, 1.5, .5], side);
      label(`Detalle ${value(zoomExtent)} × ${value(zoomExtent, 'm')}`, [x, .1, 2], 'unknown');
    }
  }
  return { group, labels };
}
