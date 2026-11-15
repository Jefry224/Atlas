import test from 'node:test';
import assert from 'node:assert/strict';
import { earthAnalysisInput } from '../src/expedition/earth-analysis.mjs';
import { buildCandidateAnalogPayload, validateCandidateAnalogPayload } from '../src/audit/analog-audit.mjs';
import { automaticEngineering, missionDesignEngineering } from '../src/audit/mission-audit.mjs';
const grid={site:'earth-site',gridSize:3,spacingMeters:10,nativeResolutionMeters:30,elevation:Array(9).fill(10),dataset:'Published test DEM',source:'https://example.test/dem'};
const reference={id:'lava-tube',earthId:'la-corona',targetId:'marius-hills',body:'moon',targetLabel:'Marius Hills',title:'Volcanic lava tube'};
const base={site:{id:'earth-site',name:'Actual Earth site'},grid,reference,sessionId:'earth-session'};
test('any Earth site can use an explicit planetary reference without changing its active identity',()=>{
  const input=earthAnalysisInput(base),candidate=buildCandidateAnalogPayload(input);
  assert.equal(input.scenario.id,'lava-tube');assert.equal(candidate.earth.id,'earth-site');assert.equal(candidate.earth.name,'Actual Earth site');assert.equal(candidate.target.id,'marius-hills');assert.equal(input.analysisContext.domain,'earth-field-test');assert.equal(input.analysisContext.expeditionSessionId,'earth-session');
  assert.equal(validateCandidateAnalogPayload(candidate).valid,true);assert.equal(automaticEngineering(candidate).audit.valid,true);assert.equal(missionDesignEngineering(candidate).profile.scenarioId,'lava-tube');assert.equal(grid.id,undefined);
});
test('field-test scopes change with the expedition, Earth DEM or comparison reference',()=>{
  const a=earthAnalysisInput(base);
  for(const change of [{sessionId:'new-session'},{grid:{...grid,elevation:Array(9).fill(20)}},{reference:{...reference,id:'wind-canyon',body:'mars',targetId:'valles-marineris'}}])assert.notEqual(earthAnalysisInput({...base,...change}).scopeKey,a.scopeKey);
});
test('foreign Earth grids and unsupported comparison bodies are rejected',()=>{
  for(const change of [{grid:{...grid,site:'other'}},{grid:{...grid,body:'mars'}},{grid:null},{reference:{...reference,body:'earth'}}])assert.equal(earthAnalysisInput({...base,...change}),null);
});
test('reference loading does not restart an unchanged Earth field-test recording',()=>{
  const a=earthAnalysisInput(base),b=earthAnalysisInput({...base,targetGrid:{...grid,id:'marius-hills',body:'moon'}});
  assert.equal(a.scopeKey,b.scopeKey);
});
test('foreign target terrain and telemetry are discarded instead of contaminating the field audit',()=>{
  const input=earthAnalysisInput({...base,targetGrid:{...grid,id:'jezero',body:'mars'},telemetry:{site:'other',values:{temperatureC:25}}});
  assert.equal(input.targetGrid,null);assert.equal(input.telemetry,null);assert.equal(buildCandidateAnalogPayload(input).earth.airTemperature.value,null);
});
test('matching target grid remains a reference while sourced Earth weather stays local',()=>{
  const t={...grid,id:'marius-hills',body:'moon'},weather={site:'earth-site',provider:'snapshot',source:{url:'https://example.test/weather'},values:{temperatureC:20,surfacePressurePa:85000}};
  const input=earthAnalysisInput({...base,targetGrid:t,telemetry:weather}),candidate=buildCandidateAnalogPayload(input);
  assert.equal(input.targetGrid,t);assert.equal(candidate.earth.pressure.value,85000);assert.equal(candidate.target.pressure.value,0);assert.equal(candidate.earth.airTemperature.value,293.15);
});
