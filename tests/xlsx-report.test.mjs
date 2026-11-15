import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missionSheets, missionWorkbook } from '../src/audit/xlsx-report.mjs';
import { buildCandidateAnalogPayload } from '../src/audit/analog-audit.mjs';
import { automaticEngineering, missionDesignEngineering, createMissionRecorder } from '../src/audit/mission-audit.mjs';
import { getMissionBaseProfile } from '../src/audit/mission-profiles.mjs';
const read = p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const scenarios=read('assets/data/scenarios.json').scenarios;
function snapshot(i=0,telemetry=null){const scenario=scenarios[i],candidate=buildCandidateAnalogPayload({scenario,earthGrid:read(scenario.earth),targetGrid:read(scenario.target),telemetry});const {audit}=automaticEngineering(candidate),r=createMissionRecorder();r.begin(scenario);return {candidate,audit,session:r.snapshot(),cutoffUTC:new Date().toISOString(),manifest:read('assets/data/nasa-assets.json')};}
const data = (s,name)=>s.find(x=>x.name===name).rows.slice(6);
test('all four dossiers have complete typed parameter bases, no empty data and independent actual state',()=>{
  for(let i=0;i<4;i++){
    const snap=snapshot(i),before=structuredClone(snap),sheets=missionSheets(snap),p=getMissionBaseProfile(scenarios[i]);
    assert.equal(sheets.length,12);assert.deepEqual(snap,before);
    for(const sheet of sheets.filter(s=>!s.cover)){
      assert.equal(sheet.headerRow,6);assert.ok(sheet.rows.length>6);
      for(const row of sheet.rows.slice(6)){
        assert.equal(row.length,sheet.rows[5].length);
        for(const value of row){assert.notEqual(value,null);assert.notEqual(value,undefined);assert.notEqual(value,'');assert.ok(typeof value!=='object');if(typeof value==='number')assert.ok(Number.isFinite(value));assert.doesNotMatch(String(value),/\b(?:null|undefined|NaN|Infinity)\b/);}
      }
    }
    const tools=data(sheets,'Tools');assert.equal(tools.length,p.tools.reduce((n,t)=>n+t.parameters.length,0));
    for(const t of p.tools)for(const parameter of t.parameters)assert.ok(tools.some(row=>row[0]===`${t.name} · ×${t.quantity}`&&row[2]===parameter.label&&row[3]===parameter.value&&row[4]===parameter.unit));
    assert.equal(data(sheets,'Thermal').find(r=>r[0]==='Exchange area')[1],p.thermal.areaM2.value);
    assert.match(data(sheets,'Thermal').find(r=>r[0]==='Q radiation')[2],/incomplete/);
    assert.match(data(sheets,'Rover_history')[0][1],/Not recorded/);assert.equal(snap.session.rover.length,0);assert.equal(snap.session.weather.length,0);
    assert.match(sheets[0].rows[15][0],/In progress/);
  }
});
test('thermal bank model uses explicit air=wall setpoint separately; polar idealization keeps numeric zero',()=>{
  for(let i=0;i<4;i++){
    const snap=snapshot(i),d=missionDesignEngineering(snap.candidate),v=d.calibration.inputs;
    assert.equal(v.airK,v.surroundingsK);assert.equal(d.calibration.thermal.convectionW,v.hWm2K*v.areaM2*(v.surfaceK-v.airK));
    assert.equal(snap.audit.calibration.inputs.surfaceK,null);assert.equal(snap.audit.calibration.thermal.radiationW,null);
    if(i===1){assert.equal(d.calibration.thermal.convectionW,0);const row=data(missionSheets(snap),'Thermal').find(r=>r[0]==='Q convection');assert.equal(row[1],0);}
  }
});
test('available provider air and pressure win over design values without filling recorded gaps',()=>{
 const t={site:scenarios[0].earthId,provider:'open-meteo',live:true,observedAt:'2026-11-14T17:00:00Z',values:{temperatureC:31,surfacePressurePa:97654},source:{url:'https://open-meteo.com/en/docs'}};
 const snap=snapshot(0,t),orig=data(missionSheets(snap),'Data_and_origin');assert.equal(orig.find(r=>r[0]==='airK')[2],304.15);assert.equal(orig.find(r=>r[0]==='earthPressurePa')[2],97654);assert.equal(snap.session.weather.length,0);
 const cal=data(missionSheets(snap),'Calibration');assert.match(cal.find(r=>r[1]==='Inverse ratio')[2],/Not applicable: ideal vacuum/);
 assert.equal(cal.find(r=>r[0]==='equivalent'&&r[1]==='Vertical support')[2],0);
});
test('old snapshots resolve their exact profile and reject a cross-mission or malformed supplied profile',()=>{
 const snap=snapshot();assert.doesNotThrow(()=>missionWorkbook(snap));assert.throws(()=>missionWorkbook({...snap,baseProfile:getMissionBaseProfile('polar-shadow')}),/incompatible/i);
 const p=getMissionBaseProfile('lava-tube');p.thermal.areaM2.value=NaN;assert.throws(()=>missionWorkbook({...snap,baseProfile:p}),/incompatible/i);
});
test('dossier package carries real print ranges, table filters, native chart and safe cell text',()=>{
 const snap=snapshot();snap.candidate.scenario.title='=HYPERLINK("evil") 🌙 & <test>';
 const xml=new TextDecoder().decode(missionWorkbook(snap));assert.ok(xml.includes('xl/styles.xml'));assert.ok(xml.includes('xl/charts/chart1.xml'));
 assert.ok(xml.includes('autoFilter ref="A6:I57"'));assert.ok(xml.includes('ySplit="6" topLeftCell="A7"'));assert.ok(xml.includes('showGridLines="0"'));assert.ok(xml.includes('_xlnm.Print_Area'));
 assert.ok(xml.includes('Static load and vertical support (N)'));assert.ok(xml.includes("'Summary'!$B$25:$B$26"));assert.ok(xml.includes('t="inlineStr"'));assert.ok(!xml.includes('<f>'));assert.ok(xml.includes('🌙 &amp; &lt;test&gt;'));
});
test('visual assets use honest mesh scale and manifest texture pixels, evidence rows fit printable cells',()=>{
 const sheets=missionSheets(snapshot()),assets=data(sheets,'NASA_assets');
 assert.ok(assets.filter(r=>!r[1].includes('texture')).every(r=>r[5]==='Visual scale; physical units not verified'));
 assert.ok(assets.filter(r=>r[1].includes('texture')).every(r=>r[5].includes('2048 × 1024 pixels')));
 assert.ok(data(sheets,'Breakdown_matrix').every(row=>row[5].split('\n').length<=8));
 assert.ok(data(sheets,'Breakdown_matrix').some(row=>row[5].includes('geometry.caveats.2')));
});
