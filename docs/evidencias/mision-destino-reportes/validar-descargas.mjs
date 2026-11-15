// Valida bytes JSON descargados por la UI, sin reconstruir la misión.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve,relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureLanding,compactLanding } from '../../../landing-report.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),reports=[];
for(const filename of process.argv.slice(2)) {
  const path=resolve(filename),d=JSON.parse(readFileSync(path)),dossier=d.analogyDossier;
  assert.ok(dossier?.candidate?.scenario);const s=dossier.candidate.scenario,session=dossier.mission,l=d.landing;
  assert.deepEqual(l,dossier.landing);assert.deepEqual(l,session.landing);
  const result=captureLanding(l,{missionId:session.id,scenarioId:s.id,body:s.body,earthId:s.earthId,targetId:s.targetId,startedAt:session.startedAt});
  assert.equal(result.valid,true,result.errors.join('; '));assert.equal(l.missionMode,'target-first');assert.equal(l.primarySide,'target');
  assert.equal(l.runs.earth,null);assert.ok(l.history.every(h=>h.earth===null));assert.equal(l.runs.target.body,s.body);
  assert.equal(d.rover.body,'earth');assert.equal(d.rover.role,'analogue-test-rover');
  if(d.targetRover) {
    assert.equal(d.targetRover.body,s.body);assert.equal(l.phase,'exploration');
    const e=l.explorationOrigins.earth,t=l.explorationOrigins.target;
    assert.ok(Math.abs((d.targetRover.x-t.x)-(d.rover.x-e.x))<1e-8);
    assert.ok(Math.abs((d.targetRover.z-t.z)-(d.rover.z-e.z))<1e-8);
  }
  for(const sample of session.rover){assert.equal(sample.body,'earth');assert.equal(sample.gridId,s.earthId);}
  const compact=compactLanding(l);assert.equal(compact.history,undefined);assert.equal(compact.events,undefined);assert.deepEqual(compact.explorationOrigins,l.explorationOrigins);
  reports.push({file:relative(root,path),scenario:s.id,missionId:session.id,phase:l.phase,earthFlight:null,targetBody:l.runs.target.body,earthRoverBody:d.rover.body,targetRoverBody:d.targetRover?.body ?? null,initialTargetFuelKg:l.history[0].target.propellantKg,nominalTargetFuelKg:l.profiles.target.propellantKg,selectedTargetZone:l.plans.target.selectedId,mirrorAvailable:l.mirrorAvailable,earthSamples:session.rover.length,history:l.history.length,captureValid:true,compactRolesPreserved:true});
}
assert.ok(reports.length,'Aportar rutas de descargas *-mission.json');
writeFileSync(new URL('validacion-descargas-ui.json',import.meta.url),JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
