import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCandidateAnalogPayload } from '../analog-audit.mjs';
import { automaticEngineering, createMissionRecorder, weatherState, RECORD_POLICY } from '../mission-audit.mjs';
import { ROVER_CONFIG } from '../rover-config.mjs';
import { answerLocally } from '../copilot-rules.mjs';
import { driveLoadW } from '../sim-physics.mjs';
import { missionSheets, missionWorkbook, workbookBytes } from '../xlsx-report.mjs';
const read = p => JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const scenarios=read('assets/data/scenarios.json').scenarios;
function candidate(i=0,telemetry=null){const scenario=scenarios[i]; return buildCandidateAnalogPayload({scenario, earthGrid:read(scenario.earth), targetGrid:read(scenario.target),telemetry});}
test('automatic mission mapping: four bodies/coordinates/config match simulation, NASA mesh irrelevant',()=>{
  for(let i=0;i<4;i++){const c=candidate(i), a=automaticEngineering(c);assert.equal(a.audit.valid,true);assert.equal(a.inputs.massKg,ROVER_CONFIG.massKg);assert.equal(a.inputs.targetBody,scenarios[i].body);assert.equal(a.audit.calibration.kind,'mission-config');assert.equal(a.origins.massKg.source,'prototype-config');assert.equal(a.audit.calibration.gravity.targetWeightN,350*(scenarios[i].body==='moon'?1.62:3.71));assert.equal(driveLoadW({speedMs:1}),driveLoadW({speedMs:1,massKg:ROVER_CONFIG.massKg}));assert.equal(c.earth.center.length,2);}
});
test('auto weather: absolute Pa and air only; missing instrument/thermal values stay null',()=>{
  const c=candidate(0,{site:'lanzarote',provider:'open-meteo',live:true,observedAt:new Date().toISOString(),source:{url:'https://open-meteo.com/en/docs'},values:{surfacePressurePa:97000,temperatureC:20,pressureMslPa:101300}}), a=automaticEngineering(c);
  assert.equal(a.inputs.earthPressurePa,97000);assert.equal(a.inputs.airK,293.15);for(const k of ['surfaceK','surroundingsK','areaM2','emissivity','hWm2K']){assert.equal(a.inputs[k],null);assert.equal(a.origins[k].kind,'missing');}assert.equal(a.audit.calibration.thermal.radiationW,null);assert.equal(a.inputs.targetPressurePa,0);assert.equal(c.target.surfaceTemperature.kind,'diviner');assert.equal(automaticEngineering(candidate()).inputs.earthPressurePa,null);
});
test('foreign mission weather discarded; historical source retained without live claims',()=>{
 const t={site:'atacama',provider:'snapshot',observedAt:'2020-01-01T00:00:00Z',values:{surfacePressurePa:80000},source:{url:'archive'}};assert.equal(candidate(0,t).earth.pressure.value,null);assert.equal(candidate(2,t).earth.pressure.kind,'archive');assert.equal(weatherState({...t,live:true}),'archive');assert.equal(weatherState({...t,provider:'open-meteo',live:true}),'archive/model');
});
test('sessions UTC/SIM separated, bounded cadence, immutable snapshot, isolated restart/change',()=>{
 let time=0, n=0;const r=createMissionRecorder({now:()=>time,id:()=>String(++n)});r.begin(scenarios[0]);r.sample({elapsed:200,x:3});time=9999;r.sample({elapsed:400,x:4});assert.equal(r.current.rover.length,1);time=10000;r.sample({elapsed:401,x:5});assert.equal(r.current.rover.length,2);assert.equal(r.current.rover[1].utc,'1970-01-01T00:00:10.000Z');const frozen=r.snapshot();r.sample({elapsed:500,x:9}, {},true);assert.equal(frozen.rover.length,2);r.begin(scenarios[2]);assert.equal(r.current.rover.length,0);assert.equal(r.current.weather.length,0);assert.equal(r.previous()[0].endedAt,'1970-01-01T00:00:10.000Z');r.begin(scenarios[2],'mission-reset');assert.equal(r.current.id,'3');
});
test('weather dedup timestamp/provider not cache fetch, rejects prior site; sample limits applied',()=>{
 let time=0; const r=createMissionRecorder({now:()=>time});r.begin(scenarios[0]);const t={site:'lanzarote',provider:'snapshot',observedAt:'2020-01-01T00:00:00Z'};assert.equal(r.weather(t),true);assert.equal(r.weather({...t,cached:true,fetchedAt:'new'}),false);assert.equal(r.weather({...t,site:'atacama'}),false);assert.equal(r.current.weather.length,1);
 for(let i=0;i<2300;i++){time+=10000;r.sample({elapsed:i});}assert.equal(r.current.rover.length,RECORD_POLICY.maxRover);for(let i=0;i<300;i++)r.weather({...t,observedAt:`timestamp-${i}`});assert.equal(r.current.weather.length,RECORD_POLICY.maxWeather);for(let i=0;i<600;i++)r.event('x',String(i));assert.equal(r.current.events.length,RECORD_POLICY.maxEvents);for(let i=0;i<8;i++)r.begin(scenarios[0]);assert.equal(r.previous().length,5);
});
test('XLSX complete multi-sheet snapshot has both modes, types, all NASA assets, null reasons',()=>{
 const c=candidate(), {audit}=automaticEngineering(c), r=createMissionRecorder();r.begin(scenarios[0]);r.sample({elapsed:1,battery:90});const snap={candidate:c,audit,session:r.snapshot(),cutoffUTC:new Date().toISOString(),manifest:read('assets/data/nasa-assets.json')};const sheets=missionSheets(snap);assert.equal(sheets.length,12);assert.equal(sheets.find(s=>s.name==='Recursos_NASA').rows.length,15);assert.equal(sheets.find(s=>s.name==='Calibracion').rows.some(r=>r[0]==='equivalent'),true);assert.equal(typeof sheets.find(s=>s.name==='Historial_rover').rows[6][1],'number');const bytes=missionWorkbook(snap);assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);assert.equal(snap.audit.calibration.inputs.surfaceK,null);
});
test('OOXML external strings always inline text, no formulas or controls; Unicode preserved',()=>{const bytes=workbookBytes([{name:'Prueba',rows:[['Texto','Número'],['=HYPERLINK("evil")',42],['+cmd',null],['@SUM(A1)',-3],['-malicioso','Luna 🌙\u0001 & < >']]}]);const text=new TextDecoder().decode(bytes);assert.ok(text.includes('t="inlineStr"'));assert.ok(!text.includes('<f>'));assert.ok(!text.slice(text.indexOf('<worksheet')).split('</worksheet>')[0].includes('\u0001'));assert.ok(text.includes('Luna 🌙'));assert.ok(text.includes('&amp; &lt; &gt;'));assert.ok(text.includes('<v>-3</v>'));});

test('copilot automatic calibration labels mission config instead of user assumptions',()=>{const {audit}=automaticEngineering(candidate());const c=audit.calibration;const response=answerLocally('¿Qué descarga de peso y ruptura hay?',{analogyAudit:{matrix:audit.matrix,calibration:{...c,massKg:c.inputs.massKg}}});assert.ok(response.answer.includes('prototype-config'));assert.ok(!response.answer.includes('parámetros como hipótesis del usuario'));});
