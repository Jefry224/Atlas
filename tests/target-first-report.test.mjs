import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLandingController } from '../landing-controller.mjs';
import { createMissionRecorder, automaticEngineering } from '../mission-audit.mjs';
import { captureLanding, compactLanding, landingMarkdown } from '../landing-report.mjs';
import { buildCandidateAnalogPayload } from '../analog-audit.mjs';
import { missionSheets } from '../xlsx-report.mjs';
import { answerLocally } from '../copilot-rules.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const scenarios=read('assets/data/scenarios.json').scenarios;
const start=Date.parse('2026-11-14T22:00:00Z');
function flight(index=0,{noEarth=false,fail=false,legacy=false}={}) {
  const scenario=scenarios[index]; let frame=0, count=0;
  const recorder=createMissionRecorder({now:()=>start+frame*500,id:()=>`report-target-${index}`});recorder.begin(scenario);
  const rejected=[],earthGrid=read(scenario.earth),targetGrid=read(scenario.target);
  const controller=createLandingController({clock:()=>new Date(start+frame*500).toISOString(),publish:p=>{count++;const result=recorder.landing(p);if(!result.valid)rejected.push(result.errors);}});
  controller.configure({scenarioId:scenario.id,body:scenario.body,earthGrid:noEarth?null:earthGrid,targetGrid,...legacy?{missionMode:'paired-legacy'}:{}});
  controller.setOptions({timeScale:4,deploymentMode:'automatic'});
  controller.start(recorder.current.id,fail?{initial:{target:{propellantKg:0}}}:{});
  while(!['exploration','hard-contact','aborted','unavailable'].includes(controller.phase) && frame<300){frame++;controller.step(.5);}
  assert.ok(frame<300);assert.ok(count>10);assert.deepEqual(rejected,[]);
  const candidate=buildCandidateAnalogPayload({scenario,earthGrid,targetGrid});
  const snapshot={candidate,audit:automaticEngineering(candidate).audit,session:recorder.snapshot(),cutoffUTC:new Date(start+frame*500).toISOString()};
  return {controller,recorder,snapshot,payload:controller.snapshot()};
}
test('four real scenario producers validate every target-first cut and preserve Earth origin/control roles',()=>{
  for(let i=0;i<4;i++){
    const {controller,recorder,snapshot,payload:l}=flight(i);
    assert.equal(l.missionMode,'target-first');assert.equal(l.primarySide,'target');assert.equal(l.phase,'exploration');
    assert.equal(l.runs.earth,null);assert.ok(l.history.every(h=>h.earth===null));assert.equal(l.runs.target.body,scenarios[i].body);
    assert.equal(l.explorationOrigins.earth.role,'analogue-test-origin');assert.equal(l.explorationOrigins.target.role,'target-contact');
    assert.equal(l.explorationOrigins.target.x,l.runs.target.x);assert.equal(l.explorationOrigins.earth.gridId,scenarios[i].earthId);
    const earth=l.explorationOrigins.earth,target=l.explorationOrigins.target;
    const rover={x:earth.x+2,z:earth.z+3,path:[[earth.x,earth.z],[earth.x+2,earth.z+3]]};
    const mirrored=controller.targetPose(rover);assert.equal(mirrored.x,target.x+2);assert.equal(mirrored.z,target.z+3);
    recorder.sample(rover,{body:'mars',latitude:20,longitude:30},true);
    assert.equal(recorder.current.latest.body,'earth');assert.equal(recorder.current.latest.gridId,scenarios[i].earthId);assert.equal(recorder.current.latest.latitude,20);
    const compact=compactLanding(l);assert.equal(compact.history,undefined);assert.equal(compact.events,undefined);assert.deepEqual(compact.explorationOrigins,l.explorationOrigins);
    compact.explorationOrigins.earth.x+=99;assert.equal(l.explorationOrigins.earth.x,earth.x);
    const sheets=missionSheets(snapshot),descent=sheets.find(s=>s.name==='Descent'),trajectory=sheets.find(s=>s.name==='Trajectory');
    assert.equal(sheets.length,15);assert.equal(descent.rows[5][2],'Primary target / data');
    assert.equal(trajectory.rows.length-6,l.history.length);assert.ok(trajectory.rows.slice(6).every(row=>row[3].startsWith('Primary target')));
    assert.equal(descent.rows.find(row=>row[0]==='runs' && row[1]==='Physical phase')[3],'Not applicable: no Earth descent');
    for(const sheet of sheets)for(const row of sheet.rows.slice(6))if(!sheet.cover)for(const cell of row){assert.notEqual(cell,null);assert.notEqual(cell,undefined);assert.notEqual(cell,'');assert.doesNotMatch(String(cell),/\b(?:null|undefined|NaN|Infinity)\b/);}
    const response=answerLocally('Descenso combustible contacto',{analogyAudit:{landing:compactLanding(l)}});
    assert.match(response.answer,/no Earth descent/);assert.match(response.answer,/targetTouchdown/);assert.match(response.answer,/Earth weather/);
    assert.ok(response.grounded.includes('analogyAudit.landing.explorationOrigins'));assert.ok(!response.grounded.some(p=>p.startsWith('analogyAudit.landing.runs.earth')));
    const md=landingMarkdown(l);assert.ok(md.indexOf('Primary target')<md.indexOf('Earth: analog'));assert.match(md,/Not applicable: no Earth descent/);
  }
});
test('target failure retains cause and blocks deployment; no Earth limits mirror without blocking target contact',()=>{
  const failed=flight(0,{fail:true});assert.equal(failed.payload.runs.target.phase,'hard-contact');assert.equal(failed.payload.explorationOrigins.target,null);assert.equal(failed.payload.mirrorAvailable,false);assert.equal(failed.controller.roverAllowed,false);
  const absent=flight(0,{noEarth:true});assert.equal(absent.payload.phase,'exploration');assert.equal(absent.payload.runs.earth,null);assert.equal(absent.payload.explorationOrigins.earth,null);assert.equal(absent.payload.runs.target.phase,'contact');assert.equal(absent.payload.mirrorAvailable,false);assert.equal(absent.controller.roverAllowed,true);assert.equal(absent.controller.targetPose({x:0,z:0}),null);
  assert.equal(missionSheets(absent.snapshot).length,15);
  const rows=missionSheets(failed.snapshot).find(s=>s.name==='Descent').rows;assert.ok(rows.some(row=>row.some(cell=>String(cell).includes('outside-model-tolerances'))));
});
test('target-first rejects forged mode, role, grid, contact, mirror and Earth flight atomically',()=>{
  const {payload:l,snapshot,recorder}=flight();
  const identity={missionId:l.missionId,scenarioId:l.scenarioId,body:scenarios[0].body,earthId:scenarios[0].earthId,targetId:scenarios[0].targetId,startedAt:snapshot.session.startedAt};
  const mutations=[p=>p.missionMode='unknown',p=>delete p.missionMode,p=>p.primarySide='earth',p=>delete p.explorationOrigins,p=>p.explorationOrigins.earth.role='target-contact',p=>p.explorationOrigins.target.role='analogue-test-origin',p=>p.explorationOrigins.earth.gridId='foreign',p=>p.explorationOrigins.target.gridId='foreign',p=>p.explorationOrigins.target.body='earth',p=>p.explorationOrigins.earth.elevationM=null,p=>p.explorationOrigins.earth.x=1e12,p=>p.plans.earth.grid.body='mars',p=>p.plans.target.grid.id='foreign',p=>p.explorationOrigins.target.x++,p=>p.explorationOrigins.target.elevationM++,p=>p.explorationOrigins.target.georeference.latitude++,p=>p.explorationOrigins.target=null,p=>p.mirrorAvailable=false,p=>p.runs.earth=structuredClone(p.runs.target),p=>p.history[0].earth=structuredClone(p.history[0].target),p=>p.runs.target.outcome.success=false];
  for(const mutate of mutations){const p=structuredClone(l);mutate(p);assert.equal(captureLanding(p,identity).valid,false);assert.equal(recorder.landing(p).valid,false);assert.deepEqual(recorder.snapshot().landing,l);}
  const failed=flight(0,{fail:true});
  for(const phase of ['contact','deployment','exploration']){const p=structuredClone(failed.payload);p.phase=phase;assert.equal(captureLanding(p,identity).valid,false);}
  const reordered=structuredClone(l);reordered.explorationOrigins.target.georeference=Object.fromEntries(Object.entries(reordered.explorationOrigins.target.georeference).reverse());assert.equal(captureLanding(reordered,identity).valid,true);
});
test('explicit paired legacy exports both flights and historical payload without extensions remains accepted',()=>{
  const {payload:l,snapshot}=flight(0,{legacy:true});assert.ok(l.runs.earth);assert.equal(l.primarySide,'earth');
  assert.equal(missionSheets(snapshot).find(s=>s.name==='Trajectory').rows.length-6,l.history.length*2);
  for(const key of ['missionMode','primarySide','explorationOrigins','mirrorAvailable'])delete l[key];
  assert.equal(captureLanding(l,{missionId:l.missionId,scenarioId:l.scenarioId,body:scenarios[0].body,earthId:scenarios[0].earthId,targetId:scenarios[0].targetId,startedAt:snapshot.session.startedAt}).valid,true);
  const noFlight=structuredClone(snapshot);noFlight.session.landing=null;assert.equal(missionSheets(noFlight).length,12);
});
