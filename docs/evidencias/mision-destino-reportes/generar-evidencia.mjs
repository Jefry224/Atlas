// Ejecutar desde cualquier directorio: node docs/evidencias/mision-destino-reportes/generar-evidencia.mjs
// Reloj controlado de evidencia; productor/controlador real y DEM versionados, sin red ni hardware.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createLandingController } from '../../../landing-controller.mjs';
import { createMissionRecorder, automaticEngineering } from '../../../mission-audit.mjs';
import { buildCandidateAnalogPayload, createDossier, dossierMarkdown } from '../../../analog-audit.mjs';
import { compactLanding, landingMarkdown } from '../../../landing-report.mjs';
import { missionWorkbook } from '../../../xlsx-report.mjs';
import { answerLocally } from '../../../copilot-rules.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../../../'+p,import.meta.url)));
const scenarios=read('assets/data/scenarios.json').scenarios, manifest=read('assets/data/nasa-assets.json');
const results=[];
for(const [index,mode] of [[0,'nominal'],[1,'nominal'],[2,'nominal'],[3,'nominal'],[0,'fallo-objetivo'],[0,'sin-tierra'],[2,'personalizada']]) {
  let frame=0,captures=0;const start=Date.parse('2026-11-14T22:00:00Z'),scenario=scenarios[index];
  const earthGrid=mode==='sin-tierra'?null:read(scenario.earth),targetGrid=read(scenario.target);
  const recorder=createMissionRecorder({now:()=>start+frame*500,id:()=>`evidencia-destino-${scenario.id}-${mode}`});recorder.begin(scenario);
  const controller=createLandingController({clock:()=>new Date(start+frame*500).toISOString(),publish:p=>{const r=recorder.landing(p);assert.equal(r.valid,true,r.errors.join('; '));captures++;}});
  controller.configure({scenarioId:scenario.id,body:scenario.body,earthGrid,targetGrid});
  controller.setOptions({timeScale:4,deploymentMode:'manual'});
  if(mode==='personalizada') {
    const alternative=controller.inspect().plans.target.zones.find(z=>z.id!==controller.inspect().plans.target.selectedId && z.eligible!==false && z.status!=='unevaluable');
    assert.ok(alternative);assert.equal(controller.choose('target',alternative.id),true);
  }
  const fuel=mode==='fallo-objetivo'?0:mode==='personalizada'?controller.inspect().profiles.target.propellantKg*.8:null;
  controller.start(recorder.current.id,fuel===null?{}:{initial:{target:{propellantKg:fuel}}});
  while(!['contact','hard-contact','aborted','unavailable'].includes(controller.phase) && frame<300){frame++;controller.step(.5);}
  assert.ok(frame<300);
  if(controller.phase==='contact') {
    assert.equal(controller.roverAllowed,false);assert.equal(controller.requestDeployment(),true);
    while(!controller.roverAllowed && frame<320){frame++;controller.step(.5);}
  }
  const landing=controller.snapshot();assert.equal(landing.runs.earth,null);assert.ok(landing.history.every(h=>h.earth===null));
  if(mode==='fallo-objetivo')assert.equal(controller.roverAllowed,false);
  else assert.equal(landing.runs.target.phase,'contact');
  if(mode==='sin-tierra'){assert.equal(landing.explorationOrigins.earth,null);assert.equal(landing.mirrorAvailable,false);}
  const cutoffUTC=new Date(start+frame*500).toISOString();
  const candidate=buildCandidateAnalogPayload({scenario,earthGrid,targetGrid}),audit=automaticEngineering(candidate).audit;
  const session=recorder.snapshot(),snapshot={candidate,audit,session,landing,cutoffUTC,manifest};
  const dossier={...createDossier(candidate,audit,cutoffUTC),mission:session,landing};
  const name=`Atlas-destino-${scenario.id}-${mode}`;
  writeFileSync(new URL(name+'.xlsx',import.meta.url),missionWorkbook(snapshot));
  writeFileSync(new URL(name+'.json',import.meta.url),JSON.stringify(dossier,null,2)+'\n');
  writeFileSync(new URL(name+'.md',import.meta.url),dossierMarkdown(dossier)+landingMarkdown(landing));
  writeFileSync(new URL(name+'-copilot.json',import.meta.url),JSON.stringify(answerLocally('Explica descenso, combustible y espejo relativo',{scenario,analogyAudit:{landing:compactLanding(landing)}}),null,2)+'\n');
  results.push({name,scenarioId:scenario.id,mode,source:'Controlador real + DEM versionado; UTC de evidencia controlada, sin UI ni hardware',capturesValidated:captures,phase:landing.phase,targetPhase:landing.runs.target.phase,earthRun:landing.runs.earth,earthOrigin:landing.explorationOrigins.earth,mirrorAvailable:landing.mirrorAvailable,history:landing.history.length,trajectoryExpected:landing.history.filter(h=>h.target!==null).length,fuelInitialKg:fuel ?? landing.profiles.target.propellantKg,selectedTargetZone:landing.plans.target.selectedId});
}
writeFileSync(new URL('validacion-productor.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({name,capturesValidated,phase,targetPhase,mirrorAvailable,history})=>({name,capturesValidated,phase,targetPhase,mirrorAvailable,history})),null,2));
