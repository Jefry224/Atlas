import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLandingProfile } from '../landing-profiles.mjs';
import { createMissionRecorder, automaticEngineering } from '../mission-audit.mjs';
import { captureLanding, compactLanding, landingMarkdown, LANDING_POLICY } from '../landing-report.mjs';
import { missionSheets, missionWorkbook } from '../xlsx-report.mjs';
import { buildCandidateAnalogPayload, createDossier, dossierMarkdown } from '../analog-audit.mjs';
import { answerLocally, detectIntents } from '../copilot-rules.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const scenarios=read('assets/data/scenarios.json').scenarios;
const utc='2026-11-14T19:00:00.000Z';
function setup(index=0) {
  const scenario=scenarios[index],recorder=createMissionRecorder({now:()=>Date.parse(utc),id:()=>`mission-${index}`});recorder.begin(scenario);
  const candidate=buildCandidateAnalogPayload({scenario,earthGrid:read(scenario.earth),targetGrid:read(scenario.target)});
  return {recorder,snapshot:{candidate,audit:automaticEngineering(candidate).audit,session:recorder.snapshot(),cutoffUTC:utc}};
}
function fixture(r) {
  const {id,scenario}=r.current;
  const profiles={earth:getLandingProfile('earth'),target:getLandingProfile(scenario.body)};
  const plans=Object.fromEntries(['earth','target'].map(side=>[side,{schema:'LandingZonePlan',version:'1.0.0',gridId:side==='earth'?scenario.earthId:scenario.targetId,sciencePoint:{x:0,z:0},selectedId:'zone-1',zones:[{id:'zone-1',x:300,z:150,slopeDeg:3,reliefM:2,scienceDistanceM:335.4,status:'candidate',score:85,reason:'Evaluación regional, no patas/rocas'}],limitations:['37.5 m efectivo; regional']} ]));
  const runs=Object.fromEntries(['earth','target'].map(side=>[side,{schema:'LandingRunSummary',version:'1.0.0',body:profiles[side].body,profileId:profiles[side].id,phase:'descent',simSeconds:5,x:301,z:150,altitudeM:80,verticalSpeedMs:-4,horizontalSpeedMs:1,pitchDeg:1,rollDeg:0,thrustN:side==='earth'?12000:4000,propellantKg:side==='earth'?580:150,massKg:profiles[side].dryMassKg+(side==='earth'?580:150),target:plans[side].zones[0],outcome:null,contact:null,georeference:{latitude:20,longitude:30},limits:{maxTiltDeg:6},limitations:['Modelo idealizado']} ]));
  return {schema:'LandingRunPayload',version:'1.0.0',missionId:id,scenarioId:scenario.id,startedAtUTC:utc,endedAtUTC:null,phase:'descent',profiles,plans,runs,history:[{utc,simSeconds:5,earth:runs.earth,target:runs.target}],events:[{utc,simSeconds:0,type:'start',detail:'Descenso simulado'}],limitations:['Sin certificación de seguridad']};
}
test('recorder accepts isolated capture; missing payload is null and restart/change invalidate old identity',()=>{
  const {recorder:r}=setup();assert.equal(r.snapshot().landing,null);const p=fixture(r);assert.deepEqual(r.landing(p),{valid:true,errors:[]});p.runs.target.propellantKg=1;assert.equal(r.snapshot().landing.runs.target.propellantKg,150);
  const snap=r.snapshot();snap.landing.profiles.target.payloadKg=7;assert.equal(r.snapshot().landing.profiles.target.payloadKg,350);
  r.begin(scenarios[1]);assert.equal(r.snapshot().landing,null);assert.equal(r.landing(p).valid,false);
});
test('strict identity, dates, finite SI, schemas, profile/grid IDs, prohibited arrays and bad magnitudes reject atomically',()=>{
  const {recorder:r}=setup();const good=fixture(r);assert.equal(r.landing(good).valid,true);
  const changes=[p=>p.missionId='other',p=>p.scenarioId='other',p=>p.version='2.0.0',p=>p.startedAtUTC='2026-11-14T18:00:00.000Z',p=>p.endedAtUTC='2020-01-01T00:00:00Z',p=>p.runs.target.altitudeM=NaN,p=>p.runs.target.thrustN=-1,p=>p.runs.target.propellantKg='300',p=>p.runs.target.massKg=Infinity,p=>p.runs.target.massKg+=1,p=>p.runs.target.propellantKg=1e9,p=>p.runs.target.throttle=2,p=>p.runs.target.x=true,p=>p.runs.target.georeference.latitude=100,p=>p.plans.target.gridId='foreign',p=>p.profiles.target.body='earth',p=>p.runs.target.profileId='other',p=>p.plans.target.selectedId='absent',p=>p.runs.target.phase='landed-safely',p=>p.elevation=[0],p=>p.history[0].target=undefined,p=>p.events[0].simSeconds='0',p=>p.plans.target.zones=[null],p=>p.history=[null],p=>p.history=[null,null],p=>p.runs.target.target.id='other-zone'];
  for(const change of changes){const p=structuredClone(good);change(p);assert.equal(r.landing(p).valid,false);assert.deepEqual(r.snapshot().landing,good);}
});
test('bounded histories/events and stale, out-of-order or terminal regression rejected',()=>{
  const {recorder:r}=setup(),p=fixture(r);p.history=Array.from({length:1210},(_,i)=>({...p.history[0],simSeconds:i/5}));p.events=Array.from({length:310},()=>p.events[0]);assert.equal(r.landing(p).valid,true);assert.equal(r.snapshot().landing.history.length,LANDING_POLICY.maxHistory);assert.equal(r.snapshot().landing.events.length,LANDING_POLICY.maxEvents);assert.equal(r.snapshot().landing.history[0].simSeconds,2);
  let next=fixture(r);next.runs.target.simSeconds=4;assert.equal(r.landing(next).valid,false);
  next=fixture(r);next.history[0].simSeconds=242;next.runs.target.phase='aborted';next.runs.target.outcome={code:'propellant-depleted',label:'Sin combustible',success:false};assert.equal(r.landing(next).valid,true);assert.equal(r.landing(fixture(r)).valid,false);
  const {recorder:r2}=setup();next=fixture(r2);next.history.push({...next.history[0],simSeconds:4});assert.equal(r2.landing(next).valid,false);
});
test('null/unavailable and hard-contact/abort outcomes preserved, never fabricated as contacts',()=>{
  for (const phase of ['unavailable','hard-contact','aborted','contact']) {
    const {recorder:r,snapshot:s}=setup(),p=fixture(r);p.runs.target.phase=phase;p.phase=phase;
    if(phase==='unavailable'){p.runs.target.altitudeM=null;p.runs.target.thrustN=null;p.runs.target.contact=null;p.plans.target=null;}
    if(['contact','hard-contact'].includes(phase)){p.runs.target.altitudeM=0;p.runs.target.contact={withinTolerances:phase==='contact',verticalSpeedMs:phase==='contact'?0.6:12,horizontalSpeedMs:0,tiltDeg:0,positionErrorM:0,slopeDeg:3,checks:{verticalSpeed:phase==='contact'}};}
    p.runs.target.outcome={code:phase==='aborted'?'fuel-exhausted':phase,label:phase,success:phase==='contact'};assert.equal(r.landing(p).valid,true);s.session=r.snapshot();
    const json=JSON.parse(JSON.stringify(s));assert.equal(json.session.landing.runs.target.phase,phase);
    const sheets=missionSheets(s);assert.equal(sheets.length,15);assert.equal(sheets.find(x=>x.name==='Descent').rows.some(row=>row.includes(phase)),true);
    const md=landingMarkdown(s.session.landing);assert.match(md,/Model touchdown does not certify safety/);assert.match(md,new RegExp(phase));
  }
});
test('entirely unavailable flight preserves null sides and explains every missing Excel field',()=>{
  const {recorder:r,snapshot:s}=setup(),p=fixture(r);p.phase='unavailable';p.profiles={earth:null,target:null};p.plans={earth:null,target:null};p.runs={earth:null,target:null};p.history=[];
  assert.equal(r.landing(p).valid,true);s.session=r.snapshot();const sheets=missionSheets(s);assert.equal(sheets.length,15);assert.equal(s.session.landing.runs.target,null);
  assert.ok(sheets.find(x=>x.name==='Descent').rows.some(row=>row.some(v=>typeof v==='string' && v.startsWith('Pending:'))));
  assert.ok(sheets.find(x=>x.name==='Trajectory').rows.some(row=>row.includes('No result: contact is not inferred')));
});

test('legacy XLSX stays 12, flight XLSX adds exactly 3 styled sheets; captured export isolated and mismatches reject',()=>{
  for(let i=0;i<4;i++){
    const {recorder:r,snapshot:s}=setup(i);assert.equal(missionSheets(s).length,12);r.landing(fixture(r));s.session=r.snapshot();s.landing=structuredClone(s.session.landing);
    const before=structuredClone(s),sheets=missionSheets(s);assert.deepEqual(s,before);assert.deepEqual(sheets.slice(-3).map(x=>x.name),['Descent','Trajectory','Test_zone']);
    for(const sheet of sheets.slice(-3)){assert.equal(sheet.headerRow,6);for(const row of sheet.rows.slice(6)){assert.equal(row.length,sheet.rows[5].length);for(const v of row){assert.notEqual(v,null);assert.notEqual(v,undefined);assert.notEqual(v,'');assert.notEqual(typeof v,'object');assert.doesNotMatch(String(v),/\b(?:null|undefined|NaN|Infinity)\b/);}}}
    const xml=new TextDecoder().decode(missionWorkbook(s));assert.ok(xml.includes("'Summary'!$B$25:$B$26"));assert.ok(xml.includes('topLeftCell="A7"'));assert.ok(!xml.includes('<f>'));
    r.begin(scenarios[(i+1)%4]);assert.equal(missionSheets(s).length,15);assert.deepEqual(s,before);
    assert.throws(()=>missionWorkbook({...s,session:{...s.session,id:'foreign'}}),/Incompatible descent/);
    const bad=structuredClone(s);bad.landing.phase='other';assert.throws(()=>missionWorkbook(bad),/two different captures/);
  }
});
test('JSON/Markdown legacy absence honest, compact copilot grounded only in current flight without history',()=>{
  const {recorder:r,snapshot:s}=setup();const d=createDossier(s.candidate,s.audit,utc);assert.match(dossierMarkdown(d),/Local dossier/);assert.match(landingMarkdown(null),/No descent test/);
  r.landing(fixture(r));const compact=compactLanding(r.snapshot().landing);assert.equal(compact.history,undefined);assert.equal(compact.events,undefined);compact.runs.target.propellantKg=999;assert.equal(r.snapshot().landing.runs.target.propellantKg,150);
  for(const q of ['aterrizaje','descenso','landing','combustible','zona de contacto']){assert.ok(detectIntents(q).includes('landing'));const out=answerLocally(q,{analogyAudit:{landing:compact}});assert.ok(out.grounded.includes('analogyAudit.landing.runs.target'));assert.match(out.answer,/999 kg/);assert.match(out.answer,/Proposed tolerances/);assert.match(out.answer,/no NASA TRN\/vision implemented/);assert.doesNotMatch(out.answer,/GO \(illustrative\)|certified safe zone|successful landing/);}
  const empty=answerLocally('descenso',{});assert.match(empty.answer,/No descent test/);assert.doesNotMatch(empty.answer,/GO \(illustrative\)/);
});

test('actual UI controller publishes only valid report captures for all four real DEM pairs',async()=>{
  const {createLandingController}=await import('../landing-controller.mjs');
  for(let i=0;i<4;i++){
    const {recorder:r,snapshot:s}=setup(i),scenario=scenarios[i],rejected=[];let frame=0,count=0;
    const controller=createLandingController({clock:()=>new Date(Date.parse(utc)+frame*100).toISOString(),publish:p=>{const accepted=r.landing(p);count++;if(!accepted.valid)rejected.push(accepted.errors);}});
    controller.configure({missionMode:'paired-legacy',scenarioId:scenario.id,body:scenario.body,earthGrid:read(scenario.earth),targetGrid:read(scenario.target)});
    // Preserve coverage of the legacy automatic, accelerated lifecycle explicitly.
    assert.equal(controller.setOptions({deploymentMode:'automatic',timeScale:4}),true);
    controller.start(r.current.id);
    while(!controller.roverAllowed && frame<1000){frame++;controller.step(0.1);}
    assert.ok(controller.roverAllowed);assert.ok(count>10);assert.deepEqual(rejected,[]);assert.equal(r.snapshot().landing.phase,'exploration');
    s.session=r.snapshot();assert.equal(missionSheets(s).length,15);assert.equal(s.session.landing.runs.target.phase,'contact');
  }
});
