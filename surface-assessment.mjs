// Planning estimates, kept separate from detected terrain and rover measurements.
import { BODY_ENV } from './sim-physics.mjs';

export const SURFACE_LIMIT = 'Planning estimates only. Regional DEMs do not detect individual rocks or underground voids. Geometry does not establish composition, connected cave extent, roof stability, access or route safety.';
export const MARIUS_REFERENCE = Object.freeze({
  id: 'lroc-marius-pit', siteId: 'marius-hills', body: 'moon', name: 'Marius Hills pit · LROC Pit Atlas',
  kind: 'published-stereo-estimate', longitude: -56.7701, latitude: 14.0917,
  lengthM: 55, widthM: 49, depthM: 40,
  source: 'https://lroc.im-ldi.com/atlases/pits/1', accessedAtUTC: '2026-11-15',
  definition: 'Inner pit diameters and stereo-derived depth; not the larger funnel or a mapped connected cave volume. Published uncertainty is unavailable.',
});
export const EMPTY_ROCK = Object.freeze({ lengthM: null, widthM: null, heightM: null, uncertaintyPct: null, densityMinKgM3: null, densityMaxKgM3: null, clearanceM: null });
export const EMPTY_CAVITY = Object.freeze({ lengthM: null, widthM: null, depthM: null, uncertaintyPct: null });
const finite = Number.isFinite;
const copy = value => structuredClone(value);
const missing = value => value === null || value === undefined;

function validate(input, fields) {
  const errors = [];
  for (const key of fields) {
    const value = input[key];
    if (missing(value)) continue;
    const uncertainty = key === 'uncertaintyPct';
    if (!finite(value) || (uncertainty ? value < 0 || value >= 100 : value <= 0 || value > 100000)) errors.push(`${key}: enter ${uncertainty ? '0 to less than 100 percent' : 'a positive finite value up to 100000'}, or leave it unavailable.`);
  }
  return errors;
}
function envelope(value, uncertaintyPct, dimensions) {
  if (!finite(value)) return { nominal: null, min: null, max: null };
  const fraction = finite(uncertaintyPct) ? uncertaintyPct / 100 : null;
  return { nominal: value, min: fraction === null ? null : value * (1 - fraction) ** dimensions, max: fraction === null ? null : value * (1 + fraction) ** dimensions };
}
function scaleEvidence(span, grid) {
  const native = finite(grid?.nativeResolutionMeters) && grid.nativeResolutionMeters > 0 ? grid.nativeResolutionMeters : null;
  const spacing = finite(grid?.spacingMeters) && grid.spacingMeters > 0 ? grid.spacingMeters : null;
  const effective = native !== null && spacing !== null ? Math.max(native, spacing) : null;
  return { nativeResolutionM: native, gridSpacingM: spacing, samplesAcross: effective && finite(span) ? span / effective : null,
    requestedSurveySpacingM: finite(span) ? span / 3 : null,
    meaning: 'Samples across the smaller horizontal axis use the coarser of native resolution and grid spacing. Three samples across is an editorial survey-planning target, not a detection or accuracy guarantee; no feature was detected.' };
}
export function estimateRock(input = {}, { body = 'earth', grid = null } = {}) {
  const inputs = { ...EMPTY_ROCK, ...input }, errors = validate(inputs, Object.keys(EMPTY_ROCK));
  const pairedDensity = !missing(inputs.densityMinKgM3) && !missing(inputs.densityMaxKgM3);
  if (pairedDensity && inputs.densityMinKgM3 > inputs.densityMaxKgM3) errors.push('Density minimum must not exceed maximum.');
  const valid = errors.length === 0, axes = [inputs.lengthM, inputs.widthM, inputs.heightM];
  const volumeM3 = envelope(valid && axes.every(finite) ? Math.PI / 6 * axes.reduce((a, b) => a * b, 1) : null, inputs.uncertaintyPct, 3);
  const massKg = valid && pairedDensity && finite(volumeM3.nominal) ? { min: (volumeM3.min ?? volumeM3.nominal) * inputs.densityMinKgM3, max: (volumeM3.max ?? volumeM3.nominal) * inputs.densityMaxKgM3 } : { min: null, max: null };
  const gravityMs2 = BODY_ENV[body]?.gravityMs2 ?? null;
  return { valid, errors, inputs, kind: 'operator-hypothesis', method: 'Ellipsoid envelope: V = pi × length × width × height / 6; mass = volume × assumed density. Axes are full diameters.',
    volumeM3, massKg, weightN: { min: finite(massKg.min) && finite(gravityMs2) ? massKg.min * gravityMs2 : null, max: finite(massKg.max) && finite(gravityMs2) ? massKg.max * gravityMs2 : null }, gravityMs2,
    heightToClearance: valid && finite(inputs.heightM) && finite(inputs.clearanceM) ? inputs.heightM / inputs.clearanceM : null,
    scale: scaleEvidence(valid && [inputs.lengthM, inputs.widthM].every(finite) ? Math.min(inputs.lengthM, inputs.widthM) : null, grid),
    material: null, detection: null,
    next: 'Acquire calibrated stereo/lidar dimensions and a material/density measurement. Compare obstacle geometry with a validated rover model before planning a crossing.',
    limitation: 'An ellipsoid is a geometric envelope, not measured rock shape or total buried volume. Density bounds and axis uncertainty are operator assumptions. Mass bounds are conditional on those inputs; unknown dimensional uncertainty is not zero. Clearance ratio is not traversability.' };
}
export function estimateCavity(input = {}, { body = 'earth', grid = null, siteId = null, basis = 'operator-hypothesis' } = {}) {
  const inputs = { ...EMPTY_CAVITY, ...input }, errors = validate(inputs, Object.keys(EMPTY_CAVITY));
  // A publication label is accepted only for the exact published point values at its own site/body.
  const published = basis === MARIUS_REFERENCE.id && siteId === MARIUS_REFERENCE.siteId && body === 'moon'
    && ['lengthM', 'widthM', 'depthM'].every(key => inputs[key] === MARIUS_REFERENCE[key]) && inputs.uncertaintyPct === null;
  const valid = errors.length === 0;
  const area = valid && [inputs.lengthM, inputs.widthM].every(finite) ? Math.PI / 4 * inputs.lengthM * inputs.widthM : null;
  const openingAreaM2 = envelope(area, inputs.uncertaintyPct, 2);
  const pitEnvelopeM3 = envelope(finite(area) && finite(inputs.depthM) ? area * inputs.depthM : null, inputs.uncertaintyPct, 3);
  const gravityMs2 = BODY_ENV[body]?.gravityMs2 ?? null;
  return { valid, errors, inputs, kind: published ? MARIUS_REFERENCE.kind : 'operator-hypothesis', source: published ? copy(MARIUS_REFERENCE) : null,
    method: 'Elliptical opening: A = pi × length × width / 4. Vertical cylindrical pit envelope: V = A × depth. A pit is not the connected cave.',
    openingAreaM2, pitEnvelopeM3,
    idealDropSeconds: valid && finite(inputs.depthM) && finite(gravityMs2) ? Math.sqrt(2 * inputs.depthM / gravityMs2) : null,
    gravityMs2, scale: scaleEvidence(valid && [inputs.lengthM, inputs.widthM].every(finite) ? Math.min(inputs.lengthM, inputs.widthM) : null, grid),
    referenceAreaRatio: finite(area) ? area / (Math.PI / 4 * MARIUS_REFERENCE.lengthM * MARIUS_REFERENCE.widthM) : null,
    connectedCaveVolumeM3: null, roofThicknessM: null, stability: null, detection: null,
    next: 'Obtain local stereo/lidar and subsurface/structural evidence; establish access geometry and survey requirements before selecting a shelter or descent operation.',
    limitation: 'Volume is a cylindrical geometric envelope, not surveyed capacity, shelter area or subsurface extent. Ideal drop time assumes rest and constant gravity, without drag; it is an illustrative comparison, not a descent design. Roof, access, ice and shielding remain unknown.' };
}
export function assessSurface(context, rock = {}, cavity = {}, basis = 'operator-hypothesis') {
  return { schema: 'surface-assessment/1', context: copy(context), rock: estimateRock(rock, context), cavity: estimateCavity(cavity, { ...context, basis }), reference: copy(MARIUS_REFERENCE), limitation: SURFACE_LIMIT };
}
export function compactSurface(report, revision = 0) {
  if (!report) return null;
  const { context: c, rock: r, cavity: v } = report;
  if (report.automatic) {
    const t = report.automatic.terrain;
    return { contextKey:c.key,siteId:c.siteId,name:c.name||c.siteId,body:c.body,sessionId:c.sessionId,revision,mode:'active-location-evidence',
      terrain:t?{source:t.source,dataset:t.dataset,nativeResolutionM:t.nativeResolutionM,gridSpacingM:t.gridSpacingM,effectiveScaleM:t.effectiveScaleM,extentM:t.extentM,reliefP95P5M:t.reliefP95P5M,slopeP50Deg:t.slopeP50Deg,slopeP90Deg:t.slopeP90Deg,triMeanM:t.triMeanM,meanNeighbourReliefM:t.meanNeighbourReliefM}:null,
      rock:{kind:r.kind,dimensionsM:null,massKg:null,status:report.automatic.rockStatus},
      cavity:{kind:report.automatic.cavityGeometryKind,axesDepthM:[v.inputs.lengthM,v.inputs.widthM,v.inputs.depthM],openingAreaM2:v.openingAreaM2.nominal,pitEnvelopeM3:v.pitEnvelopeM3.nominal,idealDropSeconds:v.idealDropSeconds,source:report.automatic.cavityContextSource,connectedCaveVolumeM3:null,stability:null,status:report.automatic.cavityStatus},
      scope:SURFACE_LIMIT+' Automatic DEM metrics are regional. A documented cavity reference is local to its own body/site; missing geometry is not inferred.' };
  }
  // Keep this DTO small enough to retain the complete evidence under its provider reservation.
  return { contextKey: c.key, siteId: c.siteId, name:c.name||c.siteId, body: c.body, sessionId: c.sessionId, revision,
    nativeResolutionM:r.scale.nativeResolutionM,gridSpacingM:r.scale.gridSpacingM,gravityMs2:r.gravityMs2,
    rock: { kind: r.kind, valid: r.valid, axesM: [r.inputs.lengthM, r.inputs.widthM, r.inputs.heightM], uncertaintyPct: r.inputs.uncertaintyPct, densityKgM3: [r.inputs.densityMinKgM3, r.inputs.densityMaxKgM3], volumeM3: r.volumeM3.nominal, volumeBoundsM3: [r.volumeM3.min, r.volumeM3.max], massBoundsKg: [r.massKg.min, r.massKg.max], weightBoundsN:[r.weightN.min,r.weightN.max],clearanceM:r.inputs.clearanceM,heightToClearance: r.heightToClearance, samplesAcross: r.scale.samplesAcross, requestedSurveySpacingM: r.scale.requestedSurveySpacingM },
    cavity: { kind: v.kind, valid: v.valid, axesDepthM: [v.inputs.lengthM, v.inputs.widthM, v.inputs.depthM], uncertaintyPct: v.inputs.uncertaintyPct, openingAreaM2: v.openingAreaM2.nominal, pitEnvelopeM3: v.pitEnvelopeM3.nominal,pitEnvelopeBoundsM3:[v.pitEnvelopeM3.min,v.pitEnvelopeM3.max], idealDropSeconds: v.idealDropSeconds, samplesAcross: v.scale.samplesAcross, referenceAreaRatio: v.referenceAreaRatio, source: v.source?.source || null, connectedCaveVolumeM3: null, stability: null },
    reference:{name:MARIUS_REFERENCE.name,body:MARIUS_REFERENCE.body,axesDepthM:[MARIUS_REFERENCE.lengthM,MARIUS_REFERENCE.widthM,MARIUS_REFERENCE.depthM],source:MARIUS_REFERENCE.source},
    scope: SURFACE_LIMIT + ' Bounds are conditional on operator dimensions, uncertainty and density assumptions. A missing uncertainty is unknown, not zero. Drop time is an ideal constant-gravity illustration without drag.' };
}
export function surfaceMarkdown(report) {
  const f = value => finite(value) ? Number(value.toPrecision(6)).toString() : 'unavailable';
  const { context: c, rock: r, cavity: v } = report;
  if (report.automatic) {
    const t = report.automatic.terrain;
    return ['# Automatic surface evidence','','Context: '+c.name+' · '+c.body+' · '+(c.sessionId||'loading')+' · '+c.key,
      'Evidence cutoff: '+(report.capturedAtUTC||'not recorded'),'', '## Regional terrain',
      t?`DEM: ${t.dataset}. Source: ${t.source}. Native resolution ${f(t.nativeResolutionM)} m; grid spacing ${f(t.gridSpacingM)} m. Effective scale ${f(t.effectiveScaleM)} m.`:'No matching source DEM is available.',
      t?`P95–P5 relief ${f(t.reliefP95P5M)} m; slope median ${f(t.slopeP50Deg)}° and P90 ${f(t.slopeP90Deg)}°. Published TRI ${f(t.triMeanM)} m; mean adjacent-node relief ${f(t.meanNeighbourReliefM)} m.`:'',
      t?.method||'','', '## Rocks and obstacles',report.automatic.rockStatus,'', '## Cavities',report.automatic.cavityStatus,
      ...(v.source?[`Published inner opening ${f(v.inputs.lengthM)} × ${f(v.inputs.widthM)} m; depth ${f(v.inputs.depthM)} m.`,`Derived opening ${f(v.openingAreaM2.nominal)} m²; cylindrical envelope ${f(v.pitEnvelopeM3.nominal)} m³; ideal gravity-only drop ${f(v.idealDropSeconds)} s. Published dimensional uncertainty is unknown.`]:[]),
      'Context source: '+(report.automatic.cavityContextSource||'no measured geometry supplied'),
      'Connected cave volume, roof thickness, composition and stability remain unknown.','',SURFACE_LIMIT].join('\n');
  }
  return ['# Rocks and cavities · planning assessment', '', `Context: ${c.name} · ${c.body} · ${c.sessionId || 'no active run'} · ${c.key}`,
    `Evidence cutoff: ${report.capturedAtUTC || 'not recorded'}. DEM: ${c.grid?.source || 'unavailable'}.`, '', '## Rock hypothesis', r.method,
    `Axes: ${f(r.inputs.lengthM)} × ${f(r.inputs.widthM)} × ${f(r.inputs.heightM)} m. Assumed axis uncertainty: ${f(r.inputs.uncertaintyPct)}%.`,
    `Volume: ${f(r.volumeM3.nominal)} m³; conditional range ${f(r.volumeM3.min)}–${f(r.volumeM3.max)} m³.`,
    `Assumed density: ${f(r.inputs.densityMinKgM3)}–${f(r.inputs.densityMaxKgM3)} kg/m³. Conditional mass: ${f(r.massKg.min)}–${f(r.massKg.max)} kg.`,
    `Weight at ${f(r.gravityMs2)} m/s²: ${f(r.weightN.min)}–${f(r.weightN.max)} N. Height / assumed clearance: ${f(r.heightToClearance)}.`,
    `Effective DEM samples across: ${f(r.scale.samplesAcross)}. Survey target spacing: ${f(r.scale.requestedSurveySpacingM)} m (editorial).`, r.limitation, ...r.errors, r.next,
    '', '## Cavity / vertical pit estimate', `Input kind: ${v.kind}. Source: ${v.source?.source || 'operator hypothesis; no detected cavity'}.`, v.method,
    `Axes/depth: ${f(v.inputs.lengthM)} × ${f(v.inputs.widthM)} × ${f(v.inputs.depthM)} m. Assumed axis uncertainty: ${f(v.inputs.uncertaintyPct)}%.`,
    `Opening: ${f(v.openingAreaM2.nominal)} m²; cylindrical envelope: ${f(v.pitEnvelopeM3.nominal)} m³.`,
    `Envelope bounds: ${f(v.pitEnvelopeM3.min)}–${f(v.pitEnvelopeM3.max)} m³. Ideal drop time: ${f(v.idealDropSeconds)} s at ${f(v.gravityMs2)} m/s².`,
    `Effective DEM samples across: ${f(v.scale.samplesAcross)}. Opening-area ratio to Marius inner pit: ${f(v.referenceAreaRatio)}.`,
    'Connected cave volume, roof thickness and stability: unavailable.', v.limitation, ...v.errors, v.next,
    '', '## Documented comparison', `${MARIUS_REFERENCE.name}: ${MARIUS_REFERENCE.lengthM} × ${MARIUS_REFERENCE.widthM} m inner opening, ${MARIUS_REFERENCE.depthM} m stereo-derived depth.`,
    MARIUS_REFERENCE.definition, MARIUS_REFERENCE.source, '', SURFACE_LIMIT, ''].join('\n');
}
export function answerSurface(question, report) {
  if (!report || !/rock|boulder|cavit|cavid|cave|pit\b|roca|cueva|pozo|void|subsuelo|clearance|masa|volume|volumen|weigh|peso|density|densidad/i.test(question)) return null;
  const c = compactSurface(report), f = value => finite(value) ? Number(value.toPrecision(5)).toString() : 'unavailable';
  if (report.automatic) {
    const t=c.terrain,v=c.cavity;
    return {answer:[`${report.context.name} · ${report.context.body}.`,t?`Automatic DEM evidence: P95–P5 relief ${f(t.reliefP95P5M)} m, P90 regional slope ${f(t.slopeP90Deg)}°, native/grid resolution ${f(t.nativeResolutionM)}/${f(t.gridSpacingM)} m. Source: ${t.source}.`:'A matching source DEM is not available.',c.rock.status,v.status,
      ...(report.cavity.source?[`Published inner pit ${v.axesDepthM.map(f).join(' × ')} m (length/width/depth), derived opening ${f(v.openingAreaM2)} m² and cylindrical envelope ${f(v.pitEnvelopeM3)} m³. Source: ${v.source}.`]:[]),SURFACE_LIMIT].join(' '),provider:'rules',model:'surface-evidence/1',generatedAt:new Date().toISOString(),grounded:['surfaceAssessment.siteId',...(t?['surfaceAssessment.terrain.reliefP95P5M','surfaceAssessment.terrain.slopeP90Deg']:[]),'surfaceAssessment.cavity.status'],disclaimer:'Automatic regional evidence and explicitly sourced local geometry; no individual rock or subsurface detection.'};
  }
  const rock = /rock|boulder|roca|clearance|masa|weigh|peso|density|densidad/i.test(question), cavity = /cavit|cavid|cave|pit\b|cueva|pozo|void|subsuelo/i.test(question);
  const lines = [`${report.context.name} · ${report.context.body}.`];
  if (rock || !cavity) lines.push(`Rock [operator hypothesis]: ellipsoid envelope ${f(c.rock.volumeM3)} m³; conditional mass ${c.rock.massBoundsKg.map(f).join('–')} kg; modeled weight ${c.rock.weightBoundsN.map(f).join('–')} N at ${f(c.gravityMs2)} m/s²; assumed density ${c.rock.densityKgM3.map(f).join('–')} kg/m³; height / assumed clearance ${f(c.rock.heightToClearance)}. DEM samples across: ${f(c.rock.samplesAcross)}. Axis uncertainty and density are assumptions; unavailable values are not zero.`);
  if (cavity || !rock) lines.push(`Pit [${c.cavity.kind}]: opening ${f(c.cavity.openingAreaM2)} m²; cylindrical envelope ${f(c.cavity.pitEnvelopeM3)} m³; ideal constant-gravity drop ${f(c.cavity.idealDropSeconds)} s. Connected cave volume and roof stability are unavailable.${c.cavity.source ? ` Source: ${c.cavity.source}.` : ' No cavity has been detected at this site by this tool.'}`);
  lines.push(SURFACE_LIMIT, rock ? report.rock.next : report.cavity.next);
  return { answer: lines.join(' '), provider: 'rules', model: 'surface-rules/1', generatedAt: new Date().toISOString(), grounded: ['surfaceAssessment.siteId', ...(rock || !cavity ? ['surfaceAssessment.rock.volumeM3', 'surfaceAssessment.rock.massBoundsKg[0]', 'surfaceAssessment.rock.massBoundsKg[1]'] : []), ...(cavity || !rock ? ['surfaceAssessment.cavity.openingAreaM2', 'surfaceAssessment.cavity.pitEnvelopeM3'] : [])], disclaimer: 'Local calculations and source-linked planning context; no AI inference of geology or mission certification.' };
}
