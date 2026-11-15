const BASE_CAVEAT = 'Regional DEM corridor only; this is not a rover-scale safe path.';

function emptyResult(status, caveats) {
  return { status, path: [], distanceM: null, ascentM: null, descentM: null,
    maxSlopeDeg: null, meanSlopeDeg: null, unknownCount: 0, caveats };
}

export function analyzeTerrain(grid) {
  const n = grid?.gridSize;
  const spacing = grid?.spacingMeters;
  if (!Number.isInteger(n) || n < 3 || !Number.isFinite(spacing) || spacing <= 0 ||
      !Array.isArray(grid?.elevation) || grid.elevation.length !== n * n) {
    return { status: 'invalid', gridSize: null, spacingMeters: null, slopeDeg: [], valid: [],
      caveats: ['Invalid terrain grid: expected a square elevation array and positive spacing.'] };
  }
  const valid = grid.elevation.map(value => typeof value === 'number' && Number.isFinite(value));
  const slopeDeg = Array(n * n).fill(null);
  for (let row = 1; row < n - 1; row++) {
    for (let col = 1; col < n - 1; col++) {
      const index = row * n + col;
      const neighbors = [index - n - 1, index - n, index - n + 1,
        index - 1, index, index + 1, index + n - 1, index + n, index + n + 1];
      if (!neighbors.every(i => valid[i])) continue;
      const z = i => grid.elevation[neighbors[i]];
      const dx = ((z(2) + 2 * z(5) + z(8)) - (z(0) + 2 * z(3) + z(6))) / (8 * spacing);
      const dy = ((z(6) + 2 * z(7) + z(8)) - (z(0) + 2 * z(1) + z(2))) / (8 * spacing);
      slopeDeg[index] = Math.atan(Math.hypot(dx, dy)) * 180 / Math.PI;
    }
  }
  return { status: 'ok', gridSize: n, spacingMeters: spacing, slopeDeg, valid,
    caveats: [BASE_CAVEAT, 'Border and nodata-adjacent slopes are unknown and excluded from routing.'] };
}

class MinHeap {
  items = [];
  push(item) {
    const a = this.items;
    let i = a.length;
    a.push(item);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= item.cost) break;
      a[i] = a[p]; i = p;
    }
    a[i] = item;
  }
  pop() {
    const a = this.items;
    const first = a[0];
    const last = a.pop();
    if (a.length) {
      let i = 0;
      while (2 * i + 1 < a.length) {
        let child = 2 * i + 1;
        if (child + 1 < a.length && a[child + 1].cost < a[child].cost) child++;
        if (last.cost <= a[child].cost) break;
        a[i] = a[child]; i = child;
      }
      a[i] = last;
    }
    return first;
  }
  get length() { return this.items.length; }
}

export function planRoute(grid, start, end, { maxSlopeDeg = 15, slopeWeight = 3, blockedCells = null } = {}) {
  const terrain = analyzeTerrain(grid);
  const caveats = [...terrain.caveats];
  if (terrain.status !== 'ok' || !Number.isFinite(maxSlopeDeg) || maxSlopeDeg < 0 ||
      !Number.isFinite(slopeWeight) || slopeWeight < 0) return emptyResult('invalid', caveats);
  const n = terrain.gridSize;
  if (blockedCells !== null && (!Array.isArray(blockedCells) || blockedCells.length !== n * n ||
      !blockedCells.every(value => typeof value === 'boolean'))) {
    caveats.push('Blocked-cell scenario must be a boolean array matching the DEM grid.');
    return emptyResult('invalid', caveats);
  }
  if (blockedCells !== null) caveats.push('User-selected regional terrain constraints exclude marked cells; this is not rover clearance validation.');
  const indexOf = point => point && Number.isInteger(point.row) && Number.isInteger(point.col) &&
    point.row >= 0 && point.row < n && point.col >= 0 && point.col < n
    ? point.row * n + point.col : -1;
  const source = indexOf(start), target = indexOf(end);
  const allowed = i => i >= 0 && terrain.valid[i] && terrain.slopeDeg[i] !== null &&
    terrain.slopeDeg[i] <= maxSlopeDeg && !blockedCells?.[i];
  if (!allowed(source) || !allowed(target)) {
    caveats.push('Route endpoints must have known slopes within the selected limits and must not be excluded.');
    return emptyResult('invalid', caveats);
  }
  const distance = Array(n * n).fill(Infinity);
  const previous = Array(n * n).fill(-1);
  const heap = new MinHeap();
  distance[source] = 0;
  heap.push({ index: source, cost: 0 });
  while (heap.length) {
    const { index, cost } = heap.pop();
    if (cost !== distance[index]) continue;
    if (index === target) break;
    const row = Math.floor(index / n), col = index % n;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = row + dr, nc = col + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const next = nr * n + nc;
      if (!allowed(next)) continue;
      if (dr && dc && (!allowed((row + dr) * n + col) || !allowed(row * n + col + dc))) continue;
      const step = Math.hypot(dr, dc) * terrain.spacingMeters;
      const edgeGradeDeg = Math.atan(Math.abs(grid.elevation[next] - grid.elevation[index]) / step) * 180 / Math.PI;
      if (edgeGradeDeg > maxSlopeDeg) continue;
      const penalty = 1 + slopeWeight * edgeGradeDeg / 90;
      const candidate = cost + step * penalty;
      if (candidate >= distance[next]) continue;
      distance[next] = candidate;
      previous[next] = index;
      heap.push({ index: next, cost: candidate });
    }
  }
  if (!Number.isFinite(distance[target])) {
    caveats.push('No corridor meets the slope and data coverage constraints.');
    return emptyResult('no-route', caveats);
  }
  const indices = [];
  for (let i = target; i !== -1; i = previous[i]) indices.push(i);
  indices.reverse();
  const path = indices.map(i => ({ row: Math.floor(i / n), col: i % n,
    elevationM: grid.elevation[i], slopeDeg: terrain.slopeDeg[i] }));
  let distanceM = 0, ascentM = 0, descentM = 0, edgeGradeSum = 0, maxEdgeGrade = 0;
  for (let i = 1; i < path.length; i++) {
    const step = Math.hypot(path[i].row - path[i - 1].row,
      path[i].col - path[i - 1].col) * terrain.spacingMeters;
    distanceM += step;
    const delta = path[i].elevationM - path[i - 1].elevationM;
    const grade = Math.atan(Math.abs(delta) / step) * 180 / Math.PI;
    edgeGradeSum += grade;
    maxEdgeGrade = Math.max(maxEdgeGrade, grade);
    if (delta > 0) ascentM += delta; else descentM -= delta;
  }
  return { status: 'ok', path, distanceM, ascentM, descentM,
    maxSlopeDeg: maxEdgeGrade,
    meanSlopeDeg: path.length > 1 ? edgeGradeSum / (path.length - 1) : 0,
    unknownCount: 0, caveats };
}
