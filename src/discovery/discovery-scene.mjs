import * as THREE from '../../assets/vendor/three.module.min.js';
import { clamp, validGrid, gridExtent, sampleHeight, sampleSlope, elevationRange } from '../shared/mission-math.mjs';

const U = 0.1;
const EXAG = 2;
const FRAME_DIST_RATIO = 0.72;
const FRAME_EL = 0.48;
const ZOOM_MIN_RATIO = 0.18;
const ZOOM_MAX_RATIO = 2.2;
const GRID_LINE_EVERY = 8;

function blockSide(grid) {
  return validGrid(grid) ? gridExtent(grid) * U : 240;
}

function frameDistance(earthGrid, targetGrid) {
  const side = Math.max(blockSide(earthGrid), blockSide(targetGrid));
  return side * FRAME_DIST_RATIO;
}

function zoomLimits(earthGrid, targetGrid) {
  const side = Math.max(blockSide(earthGrid), blockSide(targetGrid));
  return { min: side * ZOOM_MIN_RATIO, max: side * ZOOM_MAX_RATIO };
}
const BODY_RAMP = {
  earth: [0x6b5a43, 0xc9b28a],
  moon: [0x3c3c40, 0xbdbdc2],
  mars: [0x5a2a16, 0xd08850],
};
const BODY_BG = { earth: null, moon: 0x05070d, mars: 0x1d0f0a };
const sharedTextureLoader = new THREE.TextureLoader();

function latLonToVector(lat, lon, radius = 1) {
  const a = lat * Math.PI / 180;
  const b = lon * Math.PI / 180;
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * radius, Math.sin(a) * radius, -Math.cos(a) * Math.sin(b) * radius);
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of materials) {
      if (m) {
        m.map?.dispose();
        m.dispose();
      }
    }
  });
}

function createTerrainSlot() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x1a1408, 0.5));
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.65);
  sun.position.set(-90, 42, 70);
  scene.add(sun);
  const root = new THREE.Group();
  scene.add(root);
  return { scene, root, grid: null, base: 0, body: 'earth', token: 0, imageryPath: null, targetImagery: false };
}

function displayHeight(T, x, z) {
  const h = sampleHeight(T.grid, x, z);
  return h === null ? 0 : (h - T.base) * EXAG * U;
}

async function buildTerrain(T, grid, { imageryPath = null, body = 'earth', drapeImagery = false } = {}) {
  const token = ++T.token;
  disposeObject(T.root);
  T.root.clear();
  T.grid = validGrid(grid) ? grid : null;
  T.body = body;
  T.imageryPath = imageryPath;
  T.targetImagery = drapeImagery;
  T.scene.background = BODY_BG[body] !== null && BODY_BG[body] !== undefined ? new THREE.Color(BODY_BG[body]) : null;
  if (!T.grid) return;
  const range = elevationRange(grid);
  T.base = range.min;
  const extent = gridExtent(grid);
  const size = extent * U;
  const segments = Math.max(grid.gridSize - 1, 2);
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const [low, high] = (BODY_RAMP[body] || BODY_RAMP.earth).map((c) => new THREE.Color(c));
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / U;
    const z = position.getZ(i) / U;
    const h = sampleHeight(grid, x, z);
    position.setY(i, (h - T.base) * EXAG * U);
    color.copy(low).lerp(high, range.relief > 0 ? (h - range.min) / range.relief : 0.5);
    const slopeDeg = sampleSlope(grid, x, z) ?? 0;
    const shade = 1 - clamp(slopeDeg / 35, 0, 0.42);
    color.multiplyScalar(shade);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  T.root.add(mesh);
  T.mesh = mesh;
  const skirtPositions = [];
  const floor = -6;
  const edge = (fx, fz) => {
    const x = fx * extent / 2;
    const z = fz * extent / 2;
    return [x * U, displayHeight(T, x, z), z * U];
  };
  const sides = [[(t) => edge(t, -1)], [(t) => edge(1, t)], [(t) => edge(-t, 1)], [(t) => edge(-1, -t)]];
  for (const [fn] of sides) {
    for (let i = 0; i < 48; i++) {
      const a = fn(-1 + (2 * i) / 48);
      const b = fn(-1 + (2 * (i + 1)) / 48);
      skirtPositions.push(...a, ...b, b[0], floor, b[2], ...a, b[0], floor, b[2], a[0], floor, a[2]);
    }
  }
  const skirtGeometry = new THREE.BufferGeometry();
  skirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(skirtPositions, 3));
  T.root.add(new THREE.Mesh(skirtGeometry, new THREE.MeshBasicMaterial({ color: 0x0b2152, side: THREE.DoubleSide })));
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, 0.01, size)),
    new THREE.LineBasicMaterial({ color: 0x2b4371 }),
  );
  frame.position.y = floor;
  T.root.add(frame);
  addSurfaceGrid(T, grid);
  if (drapeImagery && imageryPath) {
    const map = await loadTexture(sharedTextureLoader, imageryPath);
    if (token !== T.token) {
      map?.dispose();
      return;
    }
    if (map) {
      material.map = map;
      material.vertexColors = false;
      material.needsUpdate = true;
    }
  }
}

function addSurfaceGrid(T, grid) {
  const n = grid.gridSize;
  const step = grid.spacingMeters;
  const half = (n - 1) * step / 2;
  const lift = 0.08;
  const positions = [];
  for (let c = 0; c < n; c += GRID_LINE_EVERY) {
    const x = c * step - half;
    for (let r = 0; r < n - 1; r++) {
      const z0 = r * step - half;
      const z1 = (r + 1) * step - half;
      const y0 = displayHeight(T, x, z0) + lift;
      const y1 = displayHeight(T, x, z1) + lift;
      positions.push(x * U, y0, z0 * U, x * U, y1, z1 * U);
    }
  }
  for (let r = 0; r < n; r += GRID_LINE_EVERY) {
    const z = r * step - half;
    for (let c = 0; c < n - 1; c++) {
      const x0 = c * step - half;
      const x1 = (c + 1) * step - half;
      const y0 = displayHeight(T, x0, z) + lift;
      const y1 = displayHeight(T, x1, z) + lift;
      positions.push(x0 * U, y0, z * U, x1 * U, y1, z * U);
    }
  }
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  T.root.add(new THREE.LineSegments(
    gridGeometry,
    new THREE.LineBasicMaterial({ color: 0x3d5f8a, transparent: true, opacity: 0.38 }),
  ));
}

function createGlobe(textureLoader) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const group = new THREE.Group();
  const state = { dist: 3.4, rotX: 0.35, rotY: -1.6, goal: null };
  const markerGroup = new THREE.Group();
  const hits = [];
  scene.add(group, new THREE.AmbientLight(0xbfd4ff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-3, 2, 4);
  scene.add(sun);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.MeshStandardMaterial({ color: 0x2e5a9a, roughness: 0.9, metalness: 0 }),
  );
  group.add(earth);
  textureLoader.load(
    'assets/earth/blue-marble.jpg',
    (map) => {
      map.colorSpace = THREE.SRGBColorSpace;
      earth.material.map = map;
      earth.material.color.set(0xffffff);
      earth.material.needsUpdate = true;
    },
    undefined,
    () => {},
  );
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.06, 64, 32),
    new THREE.MeshBasicMaterial({ color: 0x2e96f5, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }),
  );
  scene.add(atmosphere);
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20);
    starPositions.set([v.x, v.y, v.z], i * 3);
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xb4c8e6, size: 0.08, sizeAttenuation: true })));
  group.add(markerGroup);
  const raycaster = new THREE.Raycaster();
  let selectedId = null;

  function clearMarkers() {
    for (const child of [...markerGroup.children]) {
      markerGroup.remove(child);
      disposeObject(child);
    }
    hits.length = 0;
  }

  function setMarkers({ regions = [], candidates = [], activeRegionIds = new Set(), selectedCandidateId = null }) {
    clearMarkers();
    selectedId = selectedCandidateId;
    const markerGeometry = new THREE.SphereGeometry(0.012, 12, 10);
    const hitGeometry = new THREE.SphereGeometry(0.04, 8, 6);
    const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    for (const region of regions) {
      if (!Array.isArray(region.center) || region.center.length < 2) continue;
      const [lat, lon] = region.center;
      const active = activeRegionIds.has(region.id);
      const marker = new THREE.Mesh(
        markerGeometry,
        new THREE.MeshBasicMaterial({ color: active ? 0x6e91be : 0x2b4371, transparent: true, opacity: active ? 0.85 : 0.35 }),
      );
      marker.position.copy(latLonToVector(lat, lon, 1.006));
      markerGroup.add(marker);
    }
    for (const candidate of candidates) {
      if (!Array.isArray(candidate.center) || candidate.center.length < 2) continue;
      const [lat, lon] = candidate.center;
      const selected = candidate.id === selectedCandidateId;
      const marker = new THREE.Mesh(
        markerGeometry,
        new THREE.MeshBasicMaterial({ color: selected ? 0xeafe07 : 0x2e96f5 }),
      );
      marker.position.copy(latLonToVector(lat, lon, 1.01));
      marker.scale.setScalar(selected ? 1.8 : 1.2);
      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      hit.position.copy(marker.position);
      hit.userData = { candidateId: candidate.id, regionId: candidate.region?.id };
      markerGroup.add(marker, hit);
      hits.push(hit);
    }
  }

  function focus(lat, lon) {
    const targetY = -Math.PI / 2 - lon * Math.PI / 180;
    let delta = (targetY - state.rotY) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    state.goal = { x: clamp(lat * Math.PI / 180, -1.2, 1.2), y: state.rotY + delta };
  }

  function update(dt, motion) {
    if (state.goal) {
      const k = 1 - Math.exp(-dt * 4);
      state.rotX += (state.goal.x - state.rotX) * k;
      state.rotY += (state.goal.y - state.rotY) * k;
      if (Math.abs(state.goal.x - state.rotX) + Math.abs(state.goal.y - state.rotY) < 0.002) state.goal = null;
    } else if (motion) state.rotY += dt * 0.05;
    group.rotation.set(state.rotX, state.rotY, 0, 'XYZ');
    camera.position.set(0, 0, state.dist * Math.max(1, 1.1 / camera.aspect));
    camera.lookAt(0, 0, 0);
  }

  function pick(ndc) {
    raycaster.setFromCamera(ndc, camera);
    const intersects = raycaster.intersectObjects(hits, false);
    return intersects[0]?.object?.userData ?? null;
  }

  return {
    scene,
    camera,
    state,
    setMarkers,
    focus,
    update,
    pick,
    rotate(dx, dy) {
      state.goal = null;
      state.rotY += dx * 0.006;
      state.rotX = clamp(state.rotX + dy * 0.006, -1.3, 1.3);
    },
    zoom(factor) {
      state.dist = clamp(state.dist * factor, 1.45, 6);
    },
  };
}

function loadTexture(textureLoader, path) {
  return new Promise((resolve) => {
    textureLoader.load(
      path,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  });
}

/**
 * WebGL workspace for Discovery: split terrain (Earth | target) or globe with scan markers.
 * @param {HTMLCanvasElement} canvas
 * @param {{ reducedMotion?: MediaQueryList, onPick?: (payload: { candidateId?: string, regionId?: string }) => void }} options
 */
export function createDiscoveryScene(canvas, { reducedMotion, onPick } = {}) {
  const reduced = reducedMotion || matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = matchMedia('(max-width: 760px)');
  let renderer = null;
  let webgl = false;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    webgl = true;
  } catch {
    renderer = null;
  }

  const textureLoader = new THREE.TextureLoader();
  const globe = createGlobe(textureLoader);
  const terrainEarth = createTerrainSlot();
  const terrainTarget = createTerrainSlot();
  const tcam = new THREE.PerspectiveCamera(45, 1, 1, 8000);
  const orbit = { az: -0.7, el: FRAME_EL, dist: 173, target: new THREE.Vector3(0, 0, 0) };
  let zoomBounds = { min: 43, max: 528 };
  let view = 'split';
  let motion = !reduced.matches;
  let targetImagery = false;
  let splitPane = 'earth';
  let viewportSize = { w: 1, h: 1 };
  let lastFrame = performance.now();
  let animId = 0;
  let currentTargetBody = 'moon';
  let currentTargetImageryPath = null;
  let candidateGrid = null;
  let targetGrid = null;
  const pointer = { dragging: false, moved: 0, x: 0, y: 0, active: new Map(), pinch: 0 };

  function alignTarget() {
    if (!terrainEarth.grid || !terrainTarget.grid) {
      terrainTarget.scene.position.y = 0;
      return;
    }
    const goal = displayHeight(terrainEarth, 0, 0) - displayHeight(terrainTarget, 0, 0);
    terrainTarget.scene.position.y = goal;
  }

  function updateTerrainCamera(dt) {
    if (motion && !pointer.dragging && view === 'split') orbit.az += dt * 0.03;
    const T = terrainEarth;
    if (T.grid) {
      const y = displayHeight(T, 0, 0);
      orbit.target.set(0, y, 0);
    }
    const { az, el: elevation, dist } = orbit;
    tcam.position.set(
      orbit.target.x + dist * Math.cos(elevation) * Math.sin(az),
      orbit.target.y + dist * Math.sin(elevation),
      orbit.target.z + dist * Math.cos(elevation) * Math.cos(az),
    );
    tcam.lookAt(orbit.target);
  }

  function frame(now) {
    if (!renderer || !webgl) return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    const { w, h } = viewportSize;
    if (view === 'globe') {
      globe.update(dt, motion);
      globe.camera.aspect = w / h;
      globe.camera.updateProjectionMatrix();
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.render(globe.scene, globe.camera);
    } else {
      updateTerrainCamera(dt);
      alignTarget();
      if (mobileQuery.matches) {
        const T = splitPane === 'target' ? terrainTarget : terrainEarth;
        tcam.aspect = w / h;
        tcam.updateProjectionMatrix();
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        renderer.render(T.scene, tcam);
      } else {
        const half = Math.floor(w / 2);
        tcam.aspect = half / h;
        tcam.updateProjectionMatrix();
        renderer.setScissorTest(true);
        renderer.clear();
        for (const [T, x, width] of [
          [terrainEarth, 0, half],
          [terrainTarget, half, w - half],
        ]) {
          renderer.setViewport(x, 0, width, h);
          renderer.setScissor(x, 0, width, h);
          renderer.render(T.scene, tcam);
        }
        renderer.setScissorTest(false);
      }
    }
    animId = requestAnimationFrame(frame);
  }

  function bindPointer() {
    canvas.addEventListener('pointerdown', (event) => {
      pointer.active.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      pointer.dragging = true;
      pointer.moved = 0;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (pointer.active.size === 2) {
        const [a, b] = [...pointer.active.values()];
        pointer.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!pointer.active.has(event.pointerId)) return;
      pointer.active.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointer.active.size === 2) {
        const [a, b] = [...pointer.active.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pointer.pinch > 0) zoom(pointer.pinch / distance);
        pointer.pinch = distance;
        pointer.moved += 10;
        return;
      }
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      if (view === 'globe') globe.rotate(dx, dy);
      else {
        orbit.az -= dx * 0.006;
        orbit.el = clamp(orbit.el + dy * 0.004, 0.12, 1.45);
      }
    });
    const endPointer = (event) => {
      if (!pointer.active.has(event.pointerId)) return;
      pointer.active.delete(event.pointerId);
      if (pointer.active.size) return;
      const wasDrag = pointer.moved >= 6;
      pointer.dragging = false;
      if (!wasDrag && event.type === 'pointerup' && view === 'globe' && onPick) {
        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const hit = globe.pick(ndc);
        if (hit) onPick(hit);
      }
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      zoom(event.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
  }

  function zoom(factor) {
    if (view === 'globe') globe.zoom(factor);
    else orbit.dist = clamp(orbit.dist * factor, zoomBounds.min, zoomBounds.max);
  }

  function start() {
    if (!webgl) return;
    bindPointer();
    animId = requestAnimationFrame(frame);
  }

  return {
    webgl,
    start,
    setMotion(on) {
      motion = on;
    },
    setView(v) {
      view = v === 'globe' ? 'globe' : 'split';
    },
    setSplitPane(pane) {
      splitPane = pane === 'target' ? 'target' : 'earth';
    },
    setTargetImagery(on) {
      targetImagery = on;
      if (targetGrid) {
        buildTerrain(terrainTarget, targetGrid, {
          imageryPath: currentTargetImageryPath,
          body: currentTargetBody,
          drapeImagery: on && currentTargetImageryPath,
        });
      }
    },
    async setPair(candidate, target) {
      candidateGrid = candidate;
      targetGrid = target;
      currentTargetBody = target?.body || 'moon';
      const imagery = target?.imagery;
      currentTargetImageryPath = typeof imagery === 'string' ? imagery : imagery?.path || null;
      const earthGrid = {
        elevation: candidate.elevation,
        gridSize: candidate.gridSize,
        spacingMeters: candidate.spacingMeters,
        extentMeters: candidate.extentMeters,
      };
      const tgtGrid = {
        elevation: target.elevation,
        gridSize: target.gridSize,
        spacingMeters: target.spacingMeters,
        extentMeters: target.extentMeters,
      };
      await Promise.all([
        buildTerrain(terrainEarth, earthGrid, { body: 'earth', drapeImagery: false }),
        buildTerrain(terrainTarget, tgtGrid, {
          imageryPath: currentTargetImageryPath,
          body: currentTargetBody,
          drapeImagery: targetImagery && currentTargetImageryPath,
        }),
      ]);
      zoomBounds = zoomLimits(earthGrid, tgtGrid);
      orbit.dist = frameDistance(earthGrid, tgtGrid);
      orbit.el = FRAME_EL;
      orbit.az = -0.7;
    },
    setGlobeMarkers(payload) {
      globe.setMarkers(payload);
    },
    focusCandidate(lat, lon) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      globe.focus(lat, lon);
    },
    centerCamera() {
      if (terrainEarth.grid && terrainTarget.grid) {
        zoomBounds = zoomLimits(terrainEarth.grid, terrainTarget.grid);
        orbit.dist = frameDistance(terrainEarth.grid, terrainTarget.grid);
      } else if (terrainEarth.grid) {
        const side = blockSide(terrainEarth.grid);
        zoomBounds = { min: side * ZOOM_MIN_RATIO, max: side * ZOOM_MAX_RATIO };
        orbit.dist = side * FRAME_DIST_RATIO;
      }
      orbit.el = FRAME_EL;
      if (view === 'globe') globe.state.dist = 3.4;
    },
    zoomIn() {
      zoom(0.8);
    },
    zoomOut() {
      zoom(1.25);
    },
    resize(w, h) {
      viewportSize = { w: Math.max(1, w), h: Math.max(1, h) };
      if (renderer) renderer.setSize(viewportSize.w, viewportSize.h, false);
    },
    dispose() {
      cancelAnimationFrame(animId);
      disposeObject(terrainEarth.root);
      disposeObject(terrainTarget.root);
      renderer?.dispose();
    },
  };
}