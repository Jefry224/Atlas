// Contrato de captura de descenso: sin DOM, mallas, reloj implícito ni red.
import { validateLandingProfile } from './landing-profiles.mjs';
export const LANDING_POLICY = Object.freeze({ maxHistory: 1200, maxEvents: 300 });
const PHASES = new Set(['ready','descent','contact','hard-contact','aborted','unavailable']);
const terminal = new Set(['contact','hard-contact','aborted','unavailable']);
const finite = v => typeof v === 'number' && Number.isFinite(v);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const sameJSON = (a,b) => object(a) && object(b) ? Object.keys(a).length===Object.keys(b).length && Object.keys(a).every(k=>Object.hasOwn(b,k) && sameJSON(a[k],b[k])) : Array.isArray(a) && Array.isArray(b) ? a.length===b.length && a.every((v,i)=>sameJSON(v,b[i])) : a===b;
const iso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT.*Z$/.test(v) && Number.isFinite(Date.parse(v));
const nonnegative = ['simSeconds','altitudeM','horizontalSpeedMs','thrustN','propellantKg','massKg','positionErrorM','dryMassKg','payloadKg','landerDryMassKg','ispSeconds','g0Ms2','gravityMs2','thrustMaxN','startAltitudeM','maxDescentSpeedMs','touchdownVerticalSpeedMs','touchdownHorizontalSpeedMs','touchdownTiltDeg','touchdownPositionErrorM','maxRegionalSlopeDeg','maxRegionalReliefM','tiltMaxDeg','tiltDeg','score','slopeDeg','reliefM','scienceDistanceM','scaleMeters'];
/** Validate before cloning: JSON-safe, bounded, SI finite and strict mission/scenario identity. */
export function validateLandingPayload(payload, { missionId, scenarioId, body, earthId, targetId, startedAt, previous = null } = {}) {
  const errors = [], fail = message => errors.push(message);
  if (!object(payload)) return { valid:false, errors:['LandingRunPayload must be an object'] };
  let budget = 3000000; const seen = new Set();
  function walk(v, path = 'landing', depth = 0) {
    if (--budget < 0 || depth > 16) { if (!errors.length) fail('Payload exceeds allowed depth/size'); return; }
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number') { if (!finite(v)) fail(`${path}: non-finite number`); return; }
    if (typeof v !== 'object' || seen.has(v) || (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)) { fail(`${path}: valor no serializable`); return; }
    seen.add(v);
    for (const [k, value] of Object.entries(v)) {
      if (['elevation','elevations','earthGrid','targetGrid','grids','mesh','meshes'].includes(k) || k === 'grid' && Array.isArray(value)) fail(`${path}.${k}: grids/meshes are not allowed`);
      if (nonnegative.includes(k) && value !== null && (!finite(value) || value < 0)) fail(`${path}.${k}: magnitud SI no negativa requerida`);
      if (['x','z','yM','groundElevationM','vxMs','vyMs','vzMs','verticalSpeedMs','pitchDeg','rollDeg','latitude','longitude'].includes(k) && value !== null && !finite(value)) fail(`${path}.${k}: SI number required`);
      if (k === 'latitude' && finite(value) && Math.abs(value) > 90 || k === 'longitude' && finite(value) && Math.abs(value) > 180) fail(`${path}.${k}: coordinate out of range`);
      walk(value, `${path}.${k}`, depth+1);
      if (budget < 0 || errors.length > 30) break;
    }
    seen.delete(v);
  }
  walk(payload);
  if (errors.length) return {valid:false, errors};
  if (payload.schema !== 'LandingRunPayload' || payload.version !== '1.0.0') fail('Schema/version LandingRunPayload incompatible');
  if (!payload.missionId || payload.missionId !== missionId) fail('missionId does not match the active session');
  if (!payload.scenarioId || payload.scenarioId !== scenarioId) fail('scenarioId does not match the active scenario');
  if (!iso(payload.startedAtUTC) || payload.endedAtUTC !== null && !iso(payload.endedAtUTC)) fail('Invalid descent UTC dates');
  if (iso(startedAt) && Date.parse(payload.startedAtUTC) < Date.parse(startedAt)) fail('Descent earlier than session start');
  if (iso(payload.endedAtUTC) && Date.parse(payload.endedAtUTC) < Date.parse(payload.startedAtUTC)) fail('End UTC earlier than start');
  if (!new Set(['ready','preparation','descent','contact','deployment','exploration','hard-contact','aborted','unavailable']).has(payload.phase)) fail('capture phase required');
  if (!Array.isArray(payload.history) || !Array.isArray(payload.events) || !Array.isArray(payload.limitations) || payload.limitations.some(x=>typeof x !== 'string')) fail('history/events/limitations requeridos');
  const extended = ['missionMode','primarySide','explorationOrigins','mirrorAvailable'].some(k=>Object.hasOwn(payload,k));
  const targetFirst = payload.missionMode === 'target-first';
  if (extended && !['target-first','paired-legacy'].includes(payload.missionMode)) fail('missionMode: extension requires target-first or paired-legacy');
  if (extended && payload.primarySide !== (targetFirst ? 'target' : 'earth')) fail('primarySide incompatible with missionMode');
  if (previous && (previous.missionMode ?? 'paired-legacy') !== (payload.missionMode ?? 'paired-legacy')) fail('missionMode changed without resetting the session');
  for (const side of ['earth','target']) {
    const expectedBody = side === 'earth' ? 'earth' : body;
    const p = payload.profiles?.[side], plan = payload.plans?.[side], run = payload.runs?.[side];
    if (!object(payload.profiles) || !object(payload.plans) || !object(payload.runs)) { fail('profiles/plans/runs required with earth and target sides'); break; }
    if (p !== null && (!object(p) || !validateLandingProfile(p).valid || p.body !== expectedBody)) fail(`profiles.${side}: identidad incompatible`);
    if (plan !== null && (!object(plan) || plan.schema !== 'LandingZonePlan' || plan.version !== '1.0.0' || !Array.isArray(plan.zones))) fail(`plans.${side}: plan incompatible`);
    else if (plan) {
      if (plan.body && plan.body !== expectedBody || plan.profileId && plan.profileId !== p?.id) fail(`plans.${side}: body/profile from another capture`);
      if (!(plan.gridId===null && plan.selectedId===null && plan.zones.length===0 && plan.errors?.length) && (typeof plan.gridId !== 'string' || (side === 'earth' ? earthId : targetId) && plan.gridId !== (side === 'earth' ? earthId : targetId))) fail(`plans.${side}: gridId requerido`);
      if (plan.selectedId !== null && !plan.zones.some(z=>object(z) && z.id === plan.selectedId)) fail(`plans.${side}: selection missing from candidates`);
      if (plan.zones.some(z=>!object(z) || !z.id || !['candidate','caution','unevaluable'].includes(z.status))) fail(`plans.${side}: invalid candidates`);
    }
    function checkRun(r, path) {
      if (r === null) return;
      if (!object(r) || r.schema !== 'LandingRunSummary' || r.version !== '1.0.0' || !PHASES.has(r.phase) || r.body !== expectedBody && !(r.phase==='unavailable' && r.body===null) || (p ? r.profileId !== p.id : r.phase!=='unavailable' || r.profileId!==null) || !finite(r.simSeconds) || r.simSeconds < 0) { fail(`${path}: resumen incompatible`); return; }
      if (['contact','hard-contact'].includes(r.phase) && (!object(r.contact) || typeof r.contact.withinTolerances!=='boolean' || r.altitudeM!==0 || r.phase==='contact' && r.contact.withinTolerances!==true || r.phase==='hard-contact' && r.contact.withinTolerances!==false)) fail(`${path}: touchdown without model checks/zero AGL`);
      if (['ready','descent','contact','hard-contact'].includes(r.phase) && (!plan?.selectedId || !r.target || r.target.id!==plan.selectedId)) fail(`${path}: state without a coherent regional selection`);
      if (p && ((finite(r.propellantKg) && r.propellantKg > p.propellantKg+1e-8) || (finite(r.massKg) && finite(r.propellantKg) && Math.abs(r.massKg-p.dryMassKg-r.propellantKg)>1e-6) || (finite(r.thrustN) && r.thrustN>p.thrustMaxN+1e-6))) fail(`${path}: mass/fuel/thrust incompatible with SI profile`);
      if (r.throttle!==undefined && r.throttle!==null && (!finite(r.throttle) || r.throttle<0 || r.throttle>1)) fail(`${path}: throttle outside 0..1`);
      if (r.outcome!==null && r.outcome!==undefined && (!object(r.outcome) || typeof r.outcome.code!=='string' || typeof r.outcome.label!=='string' || ![null,true,false].includes(r.outcome.success))) fail(`${path}: invalid model outcome`);
      if (r.profile && (!validateLandingProfile(r.profile).valid || !p || Object.keys(p).some(k=>typeof p[k]==='number' && r.profile[k]!==p[k]))) fail(`${path}: state profile differs from capture`);
      if (r.grid?.id && r.grid.id !== (side==='earth'?earthId:targetId)) fail(`${path}: DEM from another mission`);
      if (['descent','contact','hard-contact'].includes(r.phase) && !['x','z','altitudeM','verticalSpeedMs','horizontalSpeedMs','pitchDeg','rollDeg','thrustN','propellantKg','massKg'].every(k=>finite(r[k]))) fail(`${path}: incomplete flight state`);
    }
    checkRun(run, `runs.${side}`);
    if (previous) {
      const before = previous.runs?.[side];
      if (before && (!run || run.simSeconds < before.simSeconds || terminal.has(before.phase) && run.phase !== before.phase)) fail(`runs.${side}: stale capture or terminal regression`);
    }
    if (Array.isArray(payload.history)) for (const h of payload.history) checkRun(h?.[side], `history.${side}`);
  }
  const rows = Array.isArray(payload.history) ? payload.history : [];
  if (targetFirst) {
    if (payload.runs?.earth !== null || rows.some(h=>h?.earth !== null)) fail('target-first: runs.earth and history[].earth must be null; no Earth descent');
    const origins = payload.explorationOrigins, target = payload.runs?.target;
    const nominal = target?.phase === 'contact' && target.contact?.withinTolerances === true && target.outcome?.success !== false;
    if (!object(origins) || !Object.hasOwn(origins,'earth') || !Object.hasOwn(origins,'target')) fail('explorationOrigins: both sides required explicitly');
    for (const side of ['earth','target']) {
      const origin = origins?.[side];
      if (origin === null) continue;
      const expectedGrid = (side==='earth'?earthId:targetId) || payload.plans?.[side]?.gridId;
      const expectedBody = side==='earth'?'earth':body;
      if (!object(origin) || !['x','z'].every(k=>finite(origin[k])) || typeof origin.gridId!=='string' || !origin.gridId || expectedGrid && origin.gridId!==expectedGrid || origin.body!==undefined && origin.body!==expectedBody || origin.role!==(side==='earth'?'analogue-test-origin':'target-contact') || !Object.hasOwn(origin,'georeference') || origin.georeference!==null && (!object(origin.georeference) || !finite(origin.georeference.latitude) || !finite(origin.georeference.longitude))) { fail(`explorationOrigins.${side}: invalid origin/role/body/DEM`); continue; }
      if (side==='earth' && !finite(origin.elevationM) || origin.elevationM!==undefined && !finite(origin.elevationM)) fail(`explorationOrigins.${side}: surface elevation required`);
      if (payload.plans?.[side]?.gridId && origin.gridId!==payload.plans[side].gridId) fail(`explorationOrigins.${side}: DEM differs from plan`);
      const grid = payload.plans?.[side]?.grid || payload.runs?.[side]?.grid;
      if (grid) {
        const half = (grid.gridSize-1)*grid.spacingMeters/2;
        if (grid.id!==origin.gridId || grid.body!==expectedBody || !Number.isInteger(grid.gridSize) || grid.gridSize<2 || !finite(grid.spacingMeters) || grid.spacingMeters<=0 || Math.abs(origin.x)>half || Math.abs(origin.z)>half) fail(`explorationOrigins.${side}: origin outside DEM coverage/identity`);
      }
      if (side==='target') {
        if (!nominal || !['x','z'].every(k=>Math.abs(origin[k]-target[k])<=1e-6) || origin.elevationM!==undefined && (!finite(target.groundElevationM) || Math.abs(origin.elevationM-target.groundElevationM)>1e-6)) fail('explorationOrigins.target: requires nominal touchdown and the target’s own pose');
        if (!sameJSON(origin.georeference,target?.georeference ?? null)) fail('explorationOrigins.target: georeference differs from own touchdown');
      }
    }
    if (nominal && !object(origins?.target)) fail('explorationOrigins.target: contacto nominal requiere origen propio');
    if (typeof payload.mirrorAvailable!=='boolean' || payload.mirrorAvailable!==Boolean(nominal && object(origins?.earth) && object(origins?.target))) fail('mirrorAvailable incompatible with origins/target touchdown');
    if (['contact','deployment','exploration'].includes(payload.phase) && !nominal) fail('target-first: touchdown/deployment/exploration requires nominal target touchdown');
  }
  for (let i=0;i<rows.length;i++) {
    const h=rows[i];
    if (!object(h) || !iso(h.utc) || !finite(h.simSeconds) || h.simSeconds<0 || !('earth' in h) || !('target' in h)) fail('Sample without valid UTC/SIM/sides');
    if (i && object(h) && object(rows[i-1]) && (h.simSeconds<rows[i-1].simSeconds || Date.parse(h.utc)<Date.parse(rows[i-1].utc))) fail('History out of UTC/SIM order');
  }
  if (Array.isArray(payload.events)) for (const e of payload.events) if (!object(e) || !iso(e.utc) || !finite(e.simSeconds) || e.simSeconds<0 || typeof e.type !== 'string' || !('detail' in e)) fail('Event without valid UTC/SIM/type/detail');
  if (previous?.history?.length && (!rows.length || rows.at(-1)?.simSeconds < previous.history.at(-1).simSeconds || Date.parse(rows.at(-1)?.utc)<Date.parse(previous.history.at(-1).utc))) fail('History stale relative to the last cutoff');
  if (previous?.events?.length && (!payload.events?.length || Date.parse(payload.events.at(-1)?.utc)<Date.parse(previous.events.at(-1).utc))) fail('Log stale relative to the last cutoff');
  if (previous && payload.startedAtUTC !== previous.startedAtUTC) fail('Descent start changed without resetting the session');
  return { valid:errors.length===0, errors };
}
export function captureLanding(payload, identity) {
  const result = validateLandingPayload(payload, identity);
  if (!result.valid) return result;
  const value = structuredClone(payload);
  value.history = value.history.slice(-LANDING_POLICY.maxHistory);
  value.events = value.events.slice(-LANDING_POLICY.maxEvents);
  return { ...result, value };
}
export const LANDING_SCOPE = 'Mission centered on the lunar/Martian destination: only the target descends in target-first. Earth is a simulated test/control analog, with no second landing or hardware telemetry; paired-legacy keeps two explicit virtual flights. The mirror applies targetTouchdown + displacement from earthOrigin; there is no geographic homology. Earth weather and proposed tools are not planetary readings. Regional DEM: does not resolve landing legs, rocks or cavities. Model touchdown does not certify safety; no NASA TRN/vision, entry or parachutes implemented. UTC, descent SIM (s) and rover SIM ×20 are separate clocks; ×2 visual exaggeration does not change SI physics.';
export function compactLanding(value) {
  if (!value) return null;
  return structuredClone({...Object.fromEntries(['missionMode','primarySide','explorationOrigins','mirrorAvailable'].filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]])),schema:value.schema,version:value.version,missionId:value.missionId,scenarioId:value.scenarioId,phase:value.phase,startedAtUTC:value.startedAtUTC,endedAtUTC:value.endedAtUTC,profiles:value.profiles,runs:Object.fromEntries(['earth','target'].map(side=>[side,value.runs[side]?Object.fromEntries(Object.entries(value.runs[side]).filter(([key])=>!['profile','grid','limitations'].includes(key))):null])),plans:Object.fromEntries(['earth','target'].map(side=>{const p=value.plans[side];return [side,p?{gridId:p.gridId,selectedId:p.selectedId,selected:p.zones.find(z=>z.id===p.selectedId) || null,limitations:p.limitations || []}:null];})),limitations:[LANDING_SCOPE,...value.limitations]});
}
const display = v => v === null || v === undefined ? 'Not available: source/state not provided at cutoff' : typeof v === 'object' ? JSON.stringify(v) : String(v);
export function landingMarkdown(value) {
  if (!value) return '\n\n## Final descent\n\nNo descent test in this session; landing: absent. No touchdown is inferred.\n';
  const lines = ['','', '## Final descent (simulation)', '',`Mission: ${value.missionId}. Scenario: ${value.scenarioId}. Phase: ${value.phase}.`,`Start UTC: ${value.startedAtUTC}. End UTC: ${value.endedAtUTC || 'In progress'}.`,LANDING_SCOPE,''];
  const targetFirst=value.missionMode==='target-first';
  if (targetFirst) lines.push('Purpose: choose the destination zone and fuel; Earth prepares and rehearses rover control. Target touchdown governs deployment and exploration. No second landing is requested.', `Mirror available: ${value.mirrorAvailable ? 'Yes' : 'No: requires Earth origin and target touchdown'}. Target motion = targetTouchdown + (roverEarth − earthOrigin).`, 'Own origins (no geographic homology):', '```json', JSON.stringify(value.explorationOrigins,null,2), '```');
  for (const side of targetFirst ? ['target','earth'] : ['earth','target']) {
    const run=value.runs[side], p=value.profiles[side], plan=value.plans[side];
    lines.push(`### ${side === 'earth' ? (targetFirst ? 'Earth: analog / reference' : 'Virtual Earth (legacy)') : 'Primary target'}`, ...(targetFirst && side==='earth' ? ['Not applicable: no Earth descent. Earth profile/plan are references; the surface test origin is not a lander touchdown.'] : []),`Lander profile separate from the 350 kg rover: ${display(p?.id)}.`, '```json',JSON.stringify({profile:p,plan,run},null,2),'```');
  }
  lines.push(`History: ${value.history.length} samples; events: ${value.events.length}. UTC and descent SIM are independent of the rover ×20.`,...value.limitations.map(x=>`- ${x}`));
  return lines.join('\n')+'\n';
}
