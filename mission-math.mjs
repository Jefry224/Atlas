// Pure, testable functions. World x points east, z points south; heading 0° = north.
// Distances are metres in a local tangent plane centred on the grid; nothing here touches the DOM.
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const DEFAULT_EXTENT = 2400; // V1 window: 9×9 nodes at 300 m. A.R.E.S. window: 65×65 at 37.5 m.
const EDGE_RATIO = 0.95; // rover stays inside 95 % of the half-extent (±1140 m for 2400 m)
const BASE_WAYPOINTS = [[550,-500],[700,350],[-500,650],[-650,-450],[0,0]]; // defined for 2400 m

export function validGrid(grid) {
  return Boolean(grid && Number.isInteger(grid.gridSize) && grid.gridSize >= 2
    && Number.isFinite(grid.spacingMeters) && grid.spacingMeters > 0
    && Array.isArray(grid.elevation) && grid.elevation.length === grid.gridSize ** 2
    && grid.elevation.every(Number.isFinite));
}
/** Side length in metres covered by the node centres: (N-1)·spacing. Falls back to 2400 m. */
export function gridExtent(grid) {
  return validGrid(grid) ? (grid.gridSize - 1) * grid.spacingMeters : DEFAULT_EXTENT;
}
const extentOf = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : DEFAULT_EXTENT;
  return gridExtent(value);
};
/** Maximum |x| and |z| the rover may reach. Accepts an extent in metres or a grid. */
export function roverLimit(extentOrGrid = DEFAULT_EXTENT) {
  return extentOf(extentOrGrid) / 2 * EDGE_RATIO;
}
/** Autonomous loop scaled to the grid extent (identical to the V1 loop for 2400 m). */
export function waypointsFor(extentOrGrid = DEFAULT_EXTENT) {
  const k = extentOf(extentOrGrid) / DEFAULT_EXTENT;
  return BASE_WAYPOINTS.map(([x, z]) => [x * k, z * k]);
}
export const waypoints = waypointsFor(DEFAULT_EXTENT);

export function sampleHeight(grid, x, z) {
  if (!validGrid(grid)) return null;
  const n = grid.gridSize, half = (n - 1) * grid.spacingMeters / 2;
  const col = clamp((x + half) / grid.spacingMeters, 0, n - 1);
  const row = clamp((z + half) / grid.spacingMeters, 0, n - 1);
  const c = Math.min(Math.floor(col), n - 2), r = Math.min(Math.floor(row), n - 2);
  const tx = col - c, tz = row - r, h = grid.elevation;
  return (h[r*n+c]*(1-tx)+h[r*n+c+1]*tx)*(1-tz)
    + (h[(r+1)*n+c]*(1-tx)+h[(r+1)*n+c+1]*tx)*tz;
}
export function sampleSlope(grid, x, z) {
  if (!validGrid(grid)) return null;
  const d=grid.spacingMeters/2, half=(grid.gridSize-1)*grid.spacingMeters/2;
  const x0=clamp(x-d,-half,half),x1=clamp(x+d,-half,half),z0=clamp(z-d,-half,half),z1=clamp(z+d,-half,half);
  const dx=(sampleHeight(grid,x1,z)-sampleHeight(grid,x0,z))/(x1-x0);
  const dz=(sampleHeight(grid,x,z1)-sampleHeight(grid,x,z0))/(z1-z0);
  return Math.atan(Math.hypot(dx,dz))*180/Math.PI;
}
/** { min, max, relief } of the elevation array, or null. */
export function elevationRange(grid) {
  if (!validGrid(grid)) return null;
  let min = Infinity, max = -Infinity;
  for (const h of grid.elevation) { if (h < min) min = h; if (h > max) max = h; }
  return { min, max, relief: max - min };
}
/** West→east transect along the central row: [{ x, distance, elevation }]. */
export function centerProfile(grid) {
  if (!validGrid(grid)) return [];
  const n = grid.gridSize, row = Math.floor(n / 2), half = (n - 1) * grid.spacingMeters / 2;
  return Array.from({ length: n }, (_, c) => ({
    x: c * grid.spacingMeters - half,
    distance: c * grid.spacingMeters,
    elevation: grid.elevation[row * n + c],
  }));
}
export function localCoordinates(site,x,z) {
  return {lat:site.lat-z/111320,lon:site.lon+x/(111320*Math.cos(site.lat*Math.PI/180))};
}
export function slopeAlert(slope) {
  if (slope === null || slope === undefined || !Number.isFinite(slope)) return {level:'unknown',text:'Sin DEM: pendiente no disponible.'};
  if (slope >= 12) return {level:'warning',text:'Precaución · pendiente regional ≥12°. Umbral ilustrativo.'};
  if (slope >= 6) return {level:'caution',text:'Relieve regional moderado · no identifica obstáculos locales.'};
  return {level:'nominal',text:'Pendiente regional baja · no garantiza transitabilidad.'};
}
export function newRover() {return {x:0,z:0,heading:30,distance:0,elapsed:0,battery:100,speed:0,waypoint:0,path:[]};}
/**
 * Kinematic step. Options: running, mode ('auto'|'manual'), throttle (-1..1), turn (-1..1) and
 * `extent` (metres) or `grid`, which set the bounds and the autonomous loop. Default: 2400 m.
 */
export function advanceRover(rover, dt, {running=false,mode='auto',throttle=0,turn=0,extent,grid}={}) {
  if (!running || rover.battery<=0) {rover.speed=0;return rover;}
  const size = extentOf(extent ?? grid ?? DEFAULT_EXTENT);
  const limit = roverLimit(size), loop = waypointsFor(size), arrive = 25 * size / DEFAULT_EXTENT;
  const seconds=clamp(dt,0,0.1)*20; // explicitly accelerated simulation, never satellite time
  let drive=clamp(throttle,-1,1);
  if (mode==='auto') {
    const target=loop[rover.waypoint%loop.length];
    if (Math.hypot(target[0]-rover.x,target[1]-rover.z)<arrive) rover.waypoint=(rover.waypoint+1)%loop.length;
    const next=loop[rover.waypoint%loop.length];
    rover.heading=(Math.atan2(next[0]-rover.x,-(next[1]-rover.z))*180/Math.PI+360)%360;drive=1;
  } else rover.heading=(rover.heading+clamp(turn,-1,1)*seconds*8+360)%360;
  rover.speed=Math.abs(drive)*0.8;
  const r=rover.heading*Math.PI/180, oldX=rover.x,oldZ=rover.z;
  rover.x=clamp(rover.x+Math.sin(r)*drive*.8*seconds,-limit,limit);
  rover.z=clamp(rover.z-Math.cos(r)*drive*.8*seconds,-limit,limit);
  const moved=Math.hypot(rover.x-oldX,rover.z-oldZ);rover.distance+=moved;rover.elapsed+=seconds;
  rover.battery=Math.max(0,rover.battery-seconds*(moved>0?.0018:.0004));
  if (!rover.path.length || Math.hypot(rover.x-rover.path.at(-1)[0],rover.z-rover.path.at(-1)[1])>=8) {
    rover.path.push([rover.x,rover.z]);if(rover.path.length>1500)rover.path.shift();
  }
  return rover;
}
