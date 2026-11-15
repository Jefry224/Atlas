import { validateLandingProfile } from './landing-profiles.mjs';

const VERSION = '1.0.0';
const DEG = Math.PI / 180;
const finite = Number.isFinite;
const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
const copy = value => JSON.parse(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const BASE_LIMITATIONS = [
  'Deterministic regional heuristic, with no success probability or certified safe zone.',
  'Idealized navigation with exact position; no vision, TRN, SPLICE or hazard detection implemented.',
  'Local coordinates x east, z south, y DEM height, in SI meters; ×2 graphic exaggeration excluded from the physics.',
  'Science point and touchdown are distinct; the nominal separation does not represent a pit outline.',
];
function gridErrors(grid) {
  if (!grid || typeof grid !== 'object') return ['grid: DEM required'];
  const errors = [];
  if (!Number.isInteger(grid.gridSize) || grid.gridSize < 7 || grid.gridSize > 1025) errors.push('gridSize: integer 7..1025 required');
  if (!finite(grid.spacingMeters) || grid.spacingMeters <= 0 || grid.spacingMeters > 5000) errors.push('spacingMeters: out of range');
  if (!Array.isArray(grid.elevation) || grid.elevation.length !== grid.gridSize ** 2 || !grid.elevation.every(h => finite(h) && Math.abs(h) <= 1e6)) errors.push('elevation: complete, finite SI raster required');
  if (!['earth', 'moon', 'mars'].includes(grid.body)) errors.push('grid.body: unknown');
  if (typeof grid.id !== 'string' || !grid.id) errors.push('grid.id: required');
  if (finite(grid.extentMeters) && Math.abs(grid.extentMeters - (grid.gridSize - 1) * grid.spacingMeters) > 0.01) errors.push('extentMeters: inconsistent with nodes/spacing');
  return errors;
}
const halfExtent = grid => (grid.gridSize - 1) * grid.spacingMeters / 2;
function inside(grid, x, z, margin = 0) {
  return finite(x) && finite(z) && Math.abs(x) <= halfExtent(grid) - margin && Math.abs(z) <= halfExtent(grid) - margin;
}
/** Strict bilinear DEM sample: unlike rendering/rover samplers, never clamps outside coverage. */
function surface(grid, x, z) {
  if (!inside(grid, x, z)) return null;
  const n = grid.gridSize, d = grid.spacingMeters, half = halfExtent(grid);
  const col = (x + half) / d, row = (z + half) / d;
  const c = Math.min(n - 2, Math.floor(col)), r = Math.min(n - 2, Math.floor(row));
  const tx = col - c, tz = row - r, h = grid.elevation;
  const a = h[r*n+c], b = h[r*n+c+1], e = h[(r+1)*n+c], f = h[(r+1)*n+c+1];
  const dx = ((b-a)*(1-tz)+(f-e)*tz)/d;
  const dz = ((e-a)*(1-tx)+(f-b)*tx)/d;
  return { height: (a*(1-tx)+b*tx)*(1-tz)+(e*(1-tx)+f*tx)*tz, dx, dz,
    slopeDeg: Math.atan(Math.hypot(dx, dz)) / DEG };
}
function projectionFor(grid) {
  if (grid._projection) return grid._projection;
  if (grid.body !== 'earth' && typeof grid.sampling?.frame === 'string' && grid.sampling.frame.includes('equidistant') && finite(grid.sampling.radiusMeters) && grid.sampling.radiusMeters > 0) {
    return { frame: 'AEQD', radiusMeters: grid.sampling.radiusMeters, source: 'grid.sampling.frame/radiusMeters' };
  }
  if (grid.body === 'earth' && (grid.sampling?.ellipsoid === 'WGS84' || (typeof grid.dataset === 'string' && grid.dataset.includes('Copernicus DEM GLO-30') && Array.isArray(grid.notes) && grid.notes.some(s => typeof s === 'string' && (s.includes('azimuthal equidistant') || s.includes('acimutal equidistante')))))) {
    return { frame: 'AEQD', ellipsoid: 'WGS84', source: 'scripts/fetch-scenarios-earth.py:site_crs + grid.notes' };
  }
  return null;
}
// Vincenty direct on WGS84; AEQD radius/azimuth are the distance/bearing from its centre.
// Restricted to this module's local DEM coverage; return null on non-convergence.
function earthDirect(phi, lambda, azimuth, distance) {
  const a=6378137, f=1/298.257223563, b=a*(1-f), tanU=(1-f)*Math.tan(phi);
  const cosU=1/Math.sqrt(1+tanU*tanU), sinU=tanU*cosU, ca=Math.cos(azimuth), sa=Math.sin(azimuth);
  const sigma1=Math.atan2(tanU,ca), sinAlpha=cosU*sa, cosSqAlpha=1-sinAlpha*sinAlpha;
  const uSq=cosSqAlpha*(a*a-b*b)/(b*b);
  const A=1+uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
  const B=uSq/1024*(256+uSq*(-128+uSq*(74-47*uSq)));
  let sigma=distance/(b*A), converged=false;
  for(let i=0;i<30;i++) {
    const c2=Math.cos(2*sigma1+sigma), ss=Math.sin(sigma), cs=Math.cos(sigma);
    const delta=B*ss*(c2+B/4*(cs*(-1+2*c2*c2)-B/6*c2*(-3+4*ss*ss)*(-3+4*c2*c2)));
    const next=distance/(b*A)+delta;
    if(Math.abs(next-sigma)<1e-13){sigma=next;converged=true;break;} sigma=next;
  }
  if(!converged) return null;
  const ss=Math.sin(sigma),cs=Math.cos(sigma),c2=Math.cos(2*sigma1+sigma);
  const tmp=sinU*ss-cosU*cs*ca;
  const latitude=Math.atan2(sinU*cs+cosU*ss*ca,(1-f)*Math.hypot(sinAlpha,tmp))/DEG;
  const angle=Math.atan2(ss*sa,cosU*cs-sinU*ss*ca),C=f/16*cosSqAlpha*(4+f*(4-3*cosSqAlpha));
  const L=angle-(1-C)*f*sinAlpha*(sigma+C*ss*(c2+C*cs*(-1+2*c2*c2)));
  return {latitude,longitude:(lambda+L)/DEG};
}
function georeference(grid, x, z) {
  if (!Array.isArray(grid.center) || grid.center.length !== 2 || !grid.center.every(finite)
    || Math.abs(grid.center[0]) >= 90 || Math.abs(grid.center[1]) > 180) return null;
  const projection=projectionFor(grid);
  if(!projection || !finite(x) || !finite(z)) return null;
  const phi=grid.center[0]*DEG,lambda=grid.center[1]*DEG,rho=Math.hypot(x,z);
  let result;
  if(rho===0) result={latitude:grid.center[0],longitude:grid.center[1]};
  else if(projection.ellipsoid==='WGS84') result=earthDirect(phi,lambda,Math.atan2(x,-z),rho);
  else {
    const c=rho/projection.radiusMeters,sc=Math.sin(c),cc=Math.cos(c);
    result={latitude:Math.asin(clamp(cc*Math.sin(phi)-z*sc*Math.cos(phi)/rho,-1,1))/DEG,
      longitude:(lambda+Math.atan2(x*sc,rho*Math.cos(phi)*cc+z*Math.sin(phi)*sc))/DEG};
  }
  if(!result) return null;
  return {...result,longitude:((result.longitude+540)%360)-180,kind:'model-projection-inverse',
    method:projection.ellipsoid==='WGS84'?'Inverse AEQD WGS84 via Vincenty direct geodesic.':'Spherical inverse AEQD with the DEM sampling radius.',
    reference:projection,limitation:'Coordinates derived from the DEM frame; physical accuracy limited by the product and its resampling.'};
}
function gridMetadata(grid) {
  if (!grid || typeof grid !== 'object') return null;
  return { id: typeof grid.id === 'string' ? grid.id : null, body: grid.body ?? null,
    gridSize: finite(grid.gridSize) ? grid.gridSize : null, spacingMeters: finite(grid.spacingMeters) ? grid.spacingMeters : null,
    nativeResolutionMeters: finite(grid.nativeResolutionMeters) ? grid.nativeResolutionMeters : null,
    center: Array.isArray(grid.center) && grid.center.length === 2 && grid.center.every(finite) ? [...grid.center] : null,
    dataset: typeof grid.dataset === 'string' ? grid.dataset : null,
    source: typeof grid.source === 'string' ? grid.source : null,
    fetchedAt: typeof grid.fetchedAt === 'string' ? grid.fetchedAt : null,
    sampling: grid.sampling && typeof grid.sampling === 'object' ? copy(grid.sampling) : null,
    georeferencing: projectionFor(grid),
    notes: Array.isArray(grid.notes) ? grid.notes.filter(s=>typeof s==='string') : [],
    provenance: Array.isArray(grid.provenance) ? grid.provenance.filter(p=>p && typeof p.label==='string' && typeof p.url==='string').map(p=>({label:p.label,url:p.url})) : [] };
}
function regionalZone(grid, profile, x, z, id, sciencePoint) {
  const radius = profile.regionalRadiusCells * grid.spacingMeters;
  const distance = Math.hypot(x-sciencePoint.x, z-sciencePoint.z);
  const out = { id, gridId: grid.id, x, z, elevationM: null, slopeDeg: null, maxSlopeDeg: null,
    reliefM: null, scienceDistanceM: distance, status: 'unevaluable', eligible: false, score: null,
    reason: '', scaleMeters: radius * 2, neighborhoodRadiusM: radius,
    spacingMeters: grid.spacingMeters, nativeResolutionMeters: finite(grid.nativeResolutionMeters) ? grid.nativeResolutionMeters : null,
    coverage: 0, sciencePoint: { x: sciencePoint.x, z: sciencePoint.z }, georeference: georeference(grid, x, z) };
  if (!inside(grid, x, z, radius)) return { ...out, reason: 'Edge: regional neighborhood without full coverage.' };
  const heights = [], slopes = [];
  for (let r = -profile.regionalRadiusCells; r <= profile.regionalRadiusCells; r++) {
    for (let c = -profile.regionalRadiusCells; c <= profile.regionalRadiusCells; c++) {
      const s = surface(grid, x+c*grid.spacingMeters, z+r*grid.spacingMeters);
      heights.push(s.height); slopes.push(s.slopeDeg);
    }
  }
  slopes.sort((a,b) => a-b);
  out.elevationM = surface(grid, x, z).height;
  out.slopeDeg = slopes[Math.floor((slopes.length - 1) * 0.9)];
  out.maxSlopeDeg = slopes.at(-1);
  out.reliefM = Math.max(...heights) - Math.min(...heights);
  out.coverage = 1;
  if (!finite(grid.nativeResolutionMeters) || grid.nativeResolutionMeters <= 0) return { ...out, reason: 'Native resolution missing: regional assessment unavailable.' };
  if (grid.nativeResolutionMeters > grid.spacingMeters * profile.maxNativeResolutionRatio || grid.metrics?.comparable === false) {
    return { ...out, reason: 'Native resolution too coarse: resampling adds no detail.' };
  }
  if (distance < profile.nominalScienceSeparationM) return { ...out, reason: 'Insufficient nominal separation from the science target.' };
  // Quantized costs avoid ranking on meaningless sub-decimetric DEM differences.
  const slope = Math.round(out.slopeDeg * 10) / 10, relief = Math.round(out.reliefM);
  out.score = Math.round(100 * clamp(1 - 0.55 * slope / profile.maxRegionalSlopeDeg
    - 0.35 * relief / profile.maxRegionalReliefM - 0.1 * distance / (2 * halfExtent(grid)), 0, 1) * 10) / 10;
  out.eligible = out.slopeDeg <= profile.maxRegionalSlopeDeg && out.reliefM <= profile.maxRegionalReliefM
    && out.maxSlopeDeg <= profile.maxRegionalSlopeDeg * 1.5;
  out.status = out.eligible && out.slopeDeg <= profile.maxRegionalSlopeDeg * 0.65 && out.reliefM <= profile.maxRegionalReliefM * 0.65 ? 'candidate' : 'caution';
  out.reason = out.eligible ? (out.status === 'candidate' ? 'Regional candidate within proposed limits; local obstacles unknown.' : 'Regional caution: near proposed limits; local obstacles unknown.')
    : 'Regional slope or relief outside the proposed domain: not selected for descent.';
  return out;
}

export function evaluateLandingZones(grid, options = {}) {
  const { profile, sciencePoint = { x: 0, z: 0 } } = options ?? {};
  const errors = [...gridErrors(grid), ...validateLandingProfile(profile).errors];
  if (grid?.body && profile?.body && grid.body !== profile.body) errors.push('grid/profile: incompatible bodies');
  if (!sciencePoint || !finite(sciencePoint.x) || !finite(sciencePoint.z)) errors.push('sciencePoint: finite SI x/z required');
  else if (!errors.length && !inside(grid, sciencePoint.x, sciencePoint.z)) errors.push('sciencePoint: outside the DEM');
  const plan = { schema: 'LandingZonePlan', version: VERSION, gridId: typeof grid?.id === 'string' ? grid.id : null,
    body: grid?.body ?? null, profileId: profile?.id ?? null, grid: gridMetadata(grid),
    sciencePoint: sciencePoint && finite(sciencePoint.x) && finite(sciencePoint.z) ? { x: sciencePoint.x, z: sciencePoint.z } : null,
    zones: [], selectedId: null,
    scoring: 'Heuristic score 0..100 = 100·clamp(1−0.55·slopeP90/limit−0.35·relief/limit−0.10·distance/extent,0,1); costs rounded to 0.1°/1 m, not a probability.',
    limitations: [...BASE_LIMITATIONS, ...(profile?.limitations?.filter?.(s => typeof s === 'string') ?? [])], errors };
  if (errors.length) { plan.limitations.push(...errors); return plan; }
  if (!georeference(grid,sciencePoint.x,sciencePoint.z)) plan.limitations.push('Georeference unavailable: verifiable projection frame/center missing; local SI coordinates are kept.');
  const all = [], n = grid.gridSize, d = grid.spacingMeters, radius = profile.regionalRadiusCells;
  for (let r = radius; r < n-radius; r += 2) {
    for (let c = radius; c < n-radius; c += 2) {
      const x = (c-(n-1)/2)*d, z = (r-(n-1)/2)*d;
      if (Math.hypot(x-sciencePoint.x,z-sciencePoint.z) < profile.nominalScienceSeparationM) continue;
      all.push(regionalZone(grid, profile, x, z, `${grid.id}-r${r}-c${c}`, sciencePoint));
    }
  }
  all.sort((a,b) => Number(b.eligible)-Number(a.eligible) || (b.score ?? -1)-(a.score ?? -1) || a.id.localeCompare(b.id, 'en'));
  for (const zone of all) {
    if (plan.zones.every(other => Math.hypot(other.x-zone.x,other.z-zone.z) >= Math.max(2*radius*d, profile.nominalScienceSeparationM))) plan.zones.push(zone);
    if (plan.zones.length === 5) break;
  }
  plan.selectedId = plan.zones.find(z => z.eligible)?.id ?? null;
  if (!plan.selectedId) plan.limitations.push('No selectable regional candidate with the data and proposed limits; no landing is forced.');
  if (!plan.zones.length) plan.limitations.push('Window too small to separate the science target from regional descent neighborhoods.');
  return plan;
}

const outcome = (code, label, success = null) => ({ code, label, success });
function unavailable(reason, profile = null, grid = null) {
  return freeze({ schema: 'LandingState', version: VERSION, phase: 'unavailable', simSeconds: 0,
    body: profile?.body ?? null, profileId: profile?.id ?? null, profile: profile && validateLandingProfile(profile).valid ? copy(profile) : null,
    grid: gridMetadata(grid), target: null, x: null, z: null, yM: null, altitudeM: null, groundElevationM: null,
    vxMs: null, vyMs: null, vzMs: null, pitchDeg: null, rollDeg: null, thrustN: null, throttle: null,
    propellantKg: null, massKg: null, contact: null, faultCodes: [], limits: null,
    outcome: outcome('unavailable', reason, false), limitations: [...BASE_LIMITATIONS, reason] });
}
function contactLimits(profile) {
  return { verticalSpeedMs: profile.touchdownVerticalSpeedMs, horizontalSpeedMs: profile.touchdownHorizontalSpeedMs,
    tiltDeg: profile.touchdownTiltDeg, positionErrorM: profile.touchdownPositionErrorM,
    regionalSlopeDeg: profile.maxRegionalSlopeDeg, regionalReliefM: profile.maxRegionalReliefM,
    maxSimSeconds: profile.maxSimSeconds, maxSubstepSeconds: 0.05 };
}

export function createDescent(options = {}) {
  const { profile, grid, zone, initial = {} } = options ?? {};
  const errors = [...validateLandingProfile(profile).errors, ...gridErrors(grid)];
  if (grid?.body !== profile?.body) errors.push('grid/profile: incompatible bodies');
  if (!zone || typeof zone.id !== 'string' || !finite(zone.x) || !finite(zone.z)) errors.push('zone: candidate with id/x/z required');
  if (!initial || typeof initial !== 'object' || Array.isArray(initial)) errors.push('initial: object required');
  if (errors.length) return unavailable(errors.join('; '), profile, grid);
  if (zone.gridId && zone.gridId !== grid.id) return unavailable('zone/grid: incompatible identities', profile, grid);
  const sciencePoint = zone.sciencePoint ?? { x: 0, z: 0 };
  if (!sciencePoint || !inside(grid,sciencePoint.x,sciencePoint.z)) return unavailable('zone.sciencePoint: outside the DEM or invalid.',profile,grid);
  // Validate geometry afresh; supplied scores/statuses cannot turn a wall into a candidate.
  const verified = regionalZone(grid, profile, zone.x, zone.z, zone.id, sciencePoint);
  if (!verified.eligible || zone.status === 'unevaluable') return unavailable(verified.reason, profile, grid);
  const ranges = { x: [-halfExtent(grid), halfExtent(grid)], z: [-halfExtent(grid), halfExtent(grid)],
    altitudeM: [0.01, 5000], verticalSpeedMs: [-200, 50], vxMs: [-100, 100], vzMs: [-100, 100], propellantKg: [0, profile.propellantKg] };
  for (const [key, value] of Object.entries(initial)) {
    if (!Object.hasOwn(ranges, key) || !finite(value) || value < ranges[key][0] || value > ranges[key][1]) return unavailable(`initial.${key}: outside SI range or unknown field`, profile, grid);
  }
  const x = initial.x ?? zone.x + profile.startOffsetXM, z = initial.z ?? zone.z + profile.startOffsetZM;
  const ground = surface(grid, x, z);
  if (!ground) return unavailable('Start outside DEM coverage; terrain is not extrapolated.', profile, grid);
  const fuel = initial.propellantKg ?? profile.propellantKg;
  const faults = [];
  if (fuel === 0) faults.push('fuel-exhausted');
  if (profile.thrustMaxN <= (profile.dryMassKg + fuel) * profile.gravityMs2) faults.push('insufficient-thrust');
  // Private immutable snapshot: future caller changes to a loaded DEM/profile cannot alter a run.
  const terrain = { id: grid.id, body: grid.body, gridSize: grid.gridSize, spacingMeters: grid.spacingMeters,
    elevation: [...grid.elevation], center: gridMetadata(grid).center, _projection: projectionFor(grid) };
  return freeze({ schema: 'LandingState', version: VERSION, body: profile.body, profileId: profile.id,
    phase: 'ready', guidanceStage: 'alignment', simSeconds: 0, profile: copy(profile), grid: gridMetadata(grid), _terrain: terrain,
    target: verified, x, z, yM: ground.height + (initial.altitudeM ?? profile.startAltitudeM),
    altitudeM: initial.altitudeM ?? profile.startAltitudeM, groundElevationM: ground.height,
    vxMs: initial.vxMs ?? 0, vyMs: initial.verticalSpeedMs ?? profile.startVerticalSpeedMs, vzMs: initial.vzMs ?? 0,
    pitchDeg: 0, rollDeg: 0, thrustN: 0, throttle: 0, propellantKg: fuel, massKg: profile.dryMassKg + fuel,
    contact: null, faultCodes: faults, limits: contactLimits(profile), outcome: outcome('ready', 'Ready for virtual final descent.'),
    limitations: [...BASE_LIMITATIONS, ...profile.limitations] });
}

function advance(s, h) {
  const p = s.profile, grid = s._terrain, before = surface(grid, s.x, s.z);
  const agl = s.yM-before.height;
  const aligned = Math.hypot(s.target.x-s.x,s.target.z-s.z) <= 2 && Math.hypot(s.vxMs,s.vzMs) <= 0.3;
  const guidanceStage = s.guidanceStage === 'terminal' || aligned ? 'terminal' : 'alignment';
  // Brake toward an AGL hold at 40 m until the lateral transfer is settled.
  // The low lunar weight gives less lateral authority at the same tilt limit.
  const desiredVy = guidanceStage === 'alignment'
    ? -Math.min(p.maxDescentSpeedMs,Math.sqrt(2*p.brakingAccelerationMs2*Math.max(0,agl-40)))
    : -Math.min(p.maxDescentSpeedMs,Math.sqrt(p.finalDescentSpeedMs**2+2*p.brakingAccelerationMs2*Math.max(0,agl-1)));
  const relativeVy = s.vyMs-before.dx*s.vxMs-before.dz*s.vzMs;
  const ay = p.gravityMs2 + clamp(2*(desiredVy-relativeVy), -p.gravityMs2, p.maxAccelerationMs2);
  let ax = clamp(0.12*(s.target.x-s.x)-0.85*s.vxMs, -p.lateralAccelerationMs2, p.lateralAccelerationMs2);
  let az = clamp(0.12*(s.target.z-s.z)-0.85*s.vzMs, -p.lateralAccelerationMs2, p.lateralAccelerationMs2);
  const lateral = Math.hypot(ax,az), lateralLimit = ay*Math.tan(p.tiltMaxDeg*DEG);
  if (lateral > lateralLimit) { ax *= lateralLimit/lateral; az *= lateralLimit/lateral; }
  const desiredAcceleration = Math.hypot(ax,ay,az);
  const requestedThrust = Math.min(p.thrustMaxN, desiredAcceleration*s.massKg);
  // Fuel cap is an impulse budget over this step; no negative fuel or thrust without propellant.
  const thrust = Math.min(requestedThrust, s.propellantKg*p.ispSeconds*p.g0Ms2/h);
  const usedFuel = thrust*h/(p.ispSeconds*p.g0Ms2);
  const midMass = s.massKg-usedFuel/2;
  const scale = desiredAcceleration > 0 ? thrust/(midMass*desiredAcceleration) : 0;
  const accelerations = { x: ax*scale, y: ay*scale-p.gravityMs2, z: az*scale };
  const next = { ...s, phase: 'descent', guidanceStage, contact: null, faultCodes: [...s.faultCodes],
    x: s.x+s.vxMs*h+0.5*accelerations.x*h*h, yM: s.yM+s.vyMs*h+0.5*accelerations.y*h*h,
    z: s.z+s.vzMs*h+0.5*accelerations.z*h*h,
    vxMs: s.vxMs+accelerations.x*h, vyMs: s.vyMs+accelerations.y*h, vzMs: s.vzMs+accelerations.z*h,
    simSeconds: s.simSeconds+h, thrustN: thrust, throttle: p.thrustMaxN > 0 ? thrust/p.thrustMaxN : 0,
    propellantKg: Math.max(0,s.propellantKg-usedFuel), massKg: p.dryMassKg+Math.max(0,s.propellantKg-usedFuel),
    pitchDeg: thrust > 0 ? Math.atan2(az,ay)/DEG : 0, rollDeg: thrust > 0 ? -Math.atan2(ax,ay)/DEG : 0,
    outcome: outcome('descending', 'Final descent with idealized navigation.') };
  if (next.propellantKg <= 1e-10 && !next.faultCodes.includes('fuel-exhausted')) next.faultCodes.push('fuel-exhausted');
  let after = surface(grid,next.x,next.z);
  if (!after) return { ...next, phase: 'aborted', altitudeM: null, groundElevationM: null, thrustN: 0, throttle: 0,
    outcome: outcome('outside-dem', 'Test stopped outside DEM coverage; terrain unknown.', false) };
  next.groundElevationM = after.height;
  next.altitudeM = next.yM-after.height;
  if (next.altitudeM <= 0) {
    // First intersection of ballistic substep with bilinear terrain, including rising ground.
    let low = 0, high = h;
    for (let i=0;i<24;i++) {
      const t = (low+high)/2, x = s.x+s.vxMs*t+0.5*accelerations.x*t*t, z = s.z+s.vzMs*t+0.5*accelerations.z*t*t;
      const ground = surface(grid,x,z);
      if (s.yM+s.vyMs*t+0.5*accelerations.y*t*t > ground.height) low=t; else high=t;
    }
    const t = high;
    next.x = s.x+s.vxMs*t+0.5*accelerations.x*t*t; next.z = s.z+s.vzMs*t+0.5*accelerations.z*t*t;
    next.vxMs = s.vxMs+accelerations.x*t; next.vyMs = s.vyMs+accelerations.y*t; next.vzMs = s.vzMs+accelerations.z*t;
    after = surface(grid,next.x,next.z);
    next.yM = after.height; next.groundElevationM = after.height; next.altitudeM = 0;
    next.simSeconds = s.simSeconds+t; next.propellantKg = Math.max(0,s.propellantKg-usedFuel*t/h); next.massKg = p.dryMassKg+next.propellantKg;
    const verticalSpeedMs = Math.abs(next.vyMs-after.dx*next.vxMs-after.dz*next.vzMs);
    const horizontalSpeedMs = Math.hypot(next.vxMs,next.vzMs), tiltDeg = thrust > 0 ? Math.atan2(Math.hypot(ax,az),ay)/DEG : 0;
    const positionErrorM = Math.hypot(next.x-next.target.x,next.z-next.target.z);
    const checks = { verticalSpeed: verticalSpeedMs <= p.touchdownVerticalSpeedMs,
      horizontalSpeed: horizontalSpeedMs <= p.touchdownHorizontalSpeedMs, tilt: tiltDeg <= p.touchdownTiltDeg,
      position: positionErrorM <= p.touchdownPositionErrorM, slope: after.slopeDeg <= p.maxRegionalSlopeDeg,
      propulsion: next.faultCodes.length === 0 };
    const withinTolerances = Object.values(checks).every(Boolean);
    next.contact = { verticalSpeedMs, horizontalSpeedMs, tiltDeg, positionErrorM, slopeDeg: after.slopeDeg, withinTolerances, checks };
    next.phase = withinTolerances ? 'contact' : 'hard-contact';
    next.outcome = withinTolerances ? outcome('within-model-tolerances', 'Touchdown within model tolerances; terrain not certified.', true)
      : outcome('outside-model-tolerances', `Touchdown outside tolerances: ${Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name).join(', ')}.`, false);
    next.thrustN = 0; next.throttle = 0;
  } else if (next.simSeconds >= p.maxSimSeconds) {
    next.phase='aborted'; next.thrustN=0; next.throttle=0;
    next.outcome=outcome('time-limit','Test stopped by time limit; no escape is simulated.',false);
  }
  return next;
}

/** dt is elapsed simulation seconds, independent of rover's time scale. No prior state is mutated. */
export function stepDescent(state, dt, options = {}) {
  if (!state || state.schema !== 'LandingState' || !['ready','descent','contact','hard-contact','aborted','unavailable'].includes(state.phase)) return unavailable('Invalid LandingState.');
  if (!finite(dt) || dt < 0 || dt > 60) return unavailable('dt: finite SI seconds in [0,60] required.', state.profile);
  if (options?.running !== undefined && typeof options.running !== 'boolean') return unavailable('running: boolean required.',state.profile);
  if (options?.running === false || dt === 0 || !['ready','descent'].includes(state.phase)) return freeze({ ...state });
  if (!state._terrain || !state.profile || !state.target) return unavailable('Descent state without internal data.');
  let next = state;
  let remaining = Math.min(dt, state.profile.maxSimSeconds-state.simSeconds);
  while (remaining > 1e-10 && ['ready','descent'].includes(next.phase)) {
    const h = Math.min(0.05,remaining);
    next = advance(next,h); remaining -= h;
  }
  return freeze({ ...next });
}

/** Abort stops the virtual trial immediately; it is not a certified escape manoeuvre. */
export function abortDescent(state, reason = 'Abort requested by the operator.') {
  if (!state || state.schema !== 'LandingState') return unavailable('Invalid LandingState.');
  if (!['ready','descent'].includes(state.phase)) return freeze({ ...state });
  return freeze({ ...state, phase: 'aborted', thrustN: 0, throttle: 0,
    outcome: outcome('operator-abort', typeof reason === 'string' && reason.trim() ? reason : 'Abort requested.',false) });
}

/** Explicit whitelist: serializable scientific snapshot, no DEM raster or rendering objects. */
export function summarizeDescent(state) {
  const s = state?.schema === 'LandingState' ? state : unavailable('Invalid LandingState.');
  const numeric = key => finite(s[key]) ? s[key] : null;
  return copy({ schema: 'LandingRunSummary', version: VERSION, body: s.body, profileId: s.profileId, phase: s.phase,
    guidanceStage: s.guidanceStage ?? null, simSeconds: numeric('simSeconds'), x: numeric('x'), z: numeric('z'), yM: numeric('yM'), altitudeM: numeric('altitudeM'),
    groundElevationM: numeric('groundElevationM'), verticalSpeedMs: numeric('vyMs'), horizontalSpeedMs: finite(s.vxMs) && finite(s.vzMs) ? Math.hypot(s.vxMs,s.vzMs) : null,
    vxMs: numeric('vxMs'), vyMs: numeric('vyMs'), vzMs: numeric('vzMs'), pitchDeg: numeric('pitchDeg'), rollDeg: numeric('rollDeg'),
    thrustN: numeric('thrustN'), throttle: numeric('throttle'), propellantKg: numeric('propellantKg'), massKg: numeric('massKg'),
    gravityMs2: s.profile?.gravityMs2 ?? null, weightN: finite(s.massKg) && finite(s.profile?.gravityMs2) ? s.massKg*s.profile.gravityMs2 : null,
    positionErrorM: s.target && finite(s.x) && finite(s.z) ? Math.hypot(s.x-s.target.x,s.z-s.target.z) : null,
    target: s.target ?? null, contact: s.contact ?? null, profile: s.profile ?? null, grid: s.grid ?? null,
    georeference: s._terrain && finite(s.x) && finite(s.z) ? georeference(s._terrain,s.x,s.z) : null,
    outcome: s.outcome, faultCodes: s.faultCodes, limits: s.limits, limitations: s.limitations });
}
