// Reproduce report evidence from the actual landing engine and the four versioned DEM pairs.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getLandingProfile } from '../landing-profiles.mjs';
import { evaluateLandingZones, createDescent, stepDescent, abortDescent, summarizeDescent } from '../landing-physics.mjs';
import { buildCandidateAnalogPayload, createDossier, dossierMarkdown } from '../analog-audit.mjs';
import { createMissionRecorder, automaticEngineering } from '../mission-audit.mjs';
import { compactLanding, landingMarkdown } from '../landing-report.mjs';
import { missionWorkbook } from '../xlsx-report.mjs';
import { answerLocally } from '../copilot-rules.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const dest=new URL('../docs/evidencias/descenso-informe/',import.meta.url);mkdirSync(dest,{recursive:true});
const start=Date.parse('2026-11-14T20:00:00.000Z');
const iso=t=>new Date(start+t*1000).toISOString();
const scenarios=read('assets/data/scenarios.json').scenarios,results=[];
function generate(scenario,mode='nominal') {
  let wall=start;const recorder=createMissionRecorder({now:()=>wall,id:()=>`evidence-${scenario.id}-${mode}`});recorder.begin(scenario);
  const earthGrid=read(scenario.earth),targetGrid=read(scenario.target),profiles={earth:getLandingProfile('earth'),target:getLandingProfile(scenario.body)};
  const plans={earth:evaluateLandingZones(earthGrid,{profile:profiles.earth}),target:evaluateLandingZones(mode==='missing-data'?null:targetGrid,{profile:profiles.target})};
  let states=Object.fromEntries(['earth','target'].map(side=>[side,createDescent({profile:profiles[side],grid:side==='earth'?earthGrid:mode==='missing-data'?null:targetGrid,zone:plans[side].zones.find(z=>z.id===plans[side].selectedId),...(mode==='fuel-failure'&&side==='target'?{initial:{propellantKg:0}}:{})})]));
  const history=[],events=[{utc:iso(0),simSeconds:0,type:'start',detail:`Evidencia ${mode}: motor real, datos versionados; no ejecución de interfaz ni ensayo físico`}];
  let t=0;
  const record=()=>history.push({utc:iso(t),simSeconds:t,earth:summarizeDescent(states.earth),target:summarizeDescent(states.target)});
  record();
  while(['earth','target'].some(side=>['ready','descent'].includes(states[side].phase)) && t<200) {
    t=Number((t+0.5).toFixed(1));
    for (const side of ['earth','target']) {
      const before=states[side].phase;
      states[side]=stepDescent(states[side],0.5);
      if(mode==='abort' && side==='target' && t>=5)states[side]=abortDescent(states[side],'Aborto reproducible de evidencia a 5 s; no maniobra de escape.');
      if(before!==states[side].phase)events.push({utc:iso(t),simSeconds:t,type:states[side].phase,detail:`${side}: ${states[side].outcome.label}`});
    }
    record();
  }
  assert.ok(t<200);
  const payload={schema:'LandingRunPayload',version:'1.0.0',missionId:recorder.current.id,scenarioId:scenario.id,startedAtUTC:iso(0),endedAtUTC:iso(t),phase:states.target.phase,profiles,plans,runs:{earth:summarizeDescent(states.earth),target:summarizeDescent(states.target)},history,events,limitations:['Ejecución reproducible del motor idealizado a 2 muestras/s SIM; fechas de evidencia controladas, no observación UTC de vuelo.', 'Datos DEM reales versionados; la ejecución es virtual. No certifica el terreno.', 'SIM descenso y UTC controlada separados del SIM rover ×20; no se fabrican muestras rover.']};
  wall=start+t*1000;const accepted=recorder.landing(payload);assert.equal(accepted.valid,true,accepted.errors.join('; '));
  if(mode==='nominal')assert.equal(states.target.phase,'contact');
  if(mode==='fuel-failure')assert.equal(states.target.phase,'hard-contact');
  if(mode==='abort')assert.equal(states.target.phase,'aborted');
  if(mode==='missing-data')assert.equal(states.target.phase,'unavailable');
  const candidate=buildCandidateAnalogPayload({scenario,earthGrid,targetGrid}),audit=automaticEngineering(candidate).audit;
  const session=recorder.snapshot(),snapshot={candidate,audit,session,landing:session.landing,cutoffUTC:iso(t),manifest:read('assets/data/nasa-assets.json')};
  const dossier={...createDossier(candidate,audit,iso(t)),mission:session,landing:session.landing};
  const name=`Atlas-descenso-${scenario.id}-${mode}`;
  writeFileSync(new URL(name+'.xlsx',dest),missionWorkbook(snapshot));
  writeFileSync(new URL(name+'.json',dest),JSON.stringify(dossier,null,2)+'\n');
  writeFileSync(new URL(name+'.md',dest),dossierMarkdown(dossier)+landingMarkdown(payload));
  const copilot=answerLocally('Explica descenso combustible y zona de contacto',{scenario,analogyAudit:{landing:compactLanding(payload)}});
  writeFileSync(new URL(name+'-copilot.json',dest),JSON.stringify(copilot,null,2)+'\n');
  results.push({name,scenarioId:scenario.id,mode,history:history.length,events:events.length,earth:{phase:states.earth.phase,...summarizeDescent(states.earth).contact},target:{phase:states.target.phase,...summarizeDescent(states.target).contact},outcomes:payload.runs.target.outcome,files:[name+'.xlsx',name+'.json',name+'.md']});
}
for(const s of scenarios)generate(s);
for(const mode of ['fuel-failure','abort','missing-data'])generate(scenarios[0],mode);
writeFileSync(new URL('engine-report-validation.json',dest),JSON.stringify({generator:'Actual landing engine and versioned four DEM pairs; fixed evidence clocks, not UI capture',results},null,2)+'\n');
console.log(JSON.stringify({directory:fileURLToPath(dest),results:results.map(r=>({name:r.name,samples:r.history,target:r.target.phase,earth:r.earth.phase}))},null,2));
