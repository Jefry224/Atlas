import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { terrainEvidence, automaticSurface } from '../src/mission/surface-evidence.mjs';
import { compactSurface, surfaceMarkdown, answerSurface } from '../src/mission/surface-assessment.mjs';
import { validGrid } from '../src/shared/mission-math.mjs';

const grid={id:'test',body:'earth',gridSize:3,spacingMeters:10,nativeResolutionMeters:30,elevation:[0,10,20,20,30,40,40,50,60],dataset:'Test plane',source:'https://example.test/dem'};
const context={key:'earth:test:session:dem',siteId:'test',body:'earth',name:'Test plane',sessionId:'session'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('automatic regional evidence uses actual flat DEM nodes and known plane gradients',()=>{
  const t=terrainEvidence(grid,'test','earth');near(t.reliefP95P5M,52);near(t.slopeP90Deg,Math.atan(Math.sqrt(5))*180/Math.PI);near(t.meanNeighbourReliefM,15);
  assert.deepEqual(t.profile.map(p=>p.heightM),[20,30,40]);assert.equal(t.effectiveScaleM,30);assert.equal(t.triMeanM,null);
});
test('published metrics retain their values and source; display imagery cannot improve DEM scale',()=>{
  const t=terrainEvidence({...grid,metrics:{reliefP95P5M:12,slopeP50Deg:1,slopeP90Deg:2,triMeanM:3},imagery:{nativeResolutionM:.2}},'test','earth');
  assert.equal(t.reliefP95P5M,12);assert.equal(t.triMeanM,3);assert.equal(t.effectiveScaleM,30);assert.equal(t.source,grid.source);
});
test('missing and foreign DEMs never produce borrowed terrain values',()=>{
  for(const g of [null,{...grid,id:'other'},{...grid,body:'moon'},{...grid,elevation:[]},{...grid,elevation:[...grid.elevation.slice(1),NaN]}])assert.equal(terrainEvidence(g,'test','earth'),null);
  assert.equal(terrainEvidence({...grid,nativeResolutionMeters:null},'test','earth').effectiveScaleM,null);
});
test('automatic Earth assessment reports useful regional values without inventing a boulder',()=>{
  const r=automaticSurface(context,grid);assert.equal(r.automatic.terrain.reliefP95P5M,52);assert.equal(r.rock.volumeM3.nominal,null);assert.equal(r.rock.massKg.min,null);assert.equal(r.cavity.source,null);
  assert.equal(r.rock.kind,'unresolved-from-regional-dem');assert.match(r.automatic.rockStatus,/not measured/);
});
test('Marius cavity geometry loads automatically only at the lunar Marius identity',()=>{
  const c={...context,siteId:'marius-hills',body:'moon'},r=automaticSurface(c,{...grid,id:c.siteId,body:'moon'});
  assert.equal(r.cavity.kind,'published-stereo-estimate');assert.deepEqual([r.cavity.inputs.lengthM,r.cavity.inputs.widthM,r.cavity.inputs.depthM],[55,49,40]);
  near(r.cavity.openingAreaM2.nominal,Math.PI/4*55*49);assert.equal(r.cavity.pitEnvelopeM3.min,null);
  for(const altered of [{...c,body:'earth'},{...c,siteId:'shackleton'}])assert.equal(automaticSurface(altered,null).cavity.source,null);
});
test('La Corona documentary context does not inherit Marius dimensions or imply an interior DEM',()=>{
  const c={...context,siteId:'la-corona'},r=automaticSurface(c,{...grid,id:c.siteId,provenance:[{url:'https://cactlanzarote.com/en/cact/cueva-de-los-verdes/'}]});
  assert.equal(r.automatic.cavityGeometryKind,'documented-context-no-geometry');assert.equal(r.cavity.inputs.depthM,null);assert.match(r.automatic.cavityStatus,/does not measure its interior/);
});
test('automatic compact context fits its complete provider reservation and excludes raw DEM nodes',()=>{
  const r=automaticSurface(context,grid),c=compactSurface(r);const leaves=x=>x&&typeof x==='object'?Object.values(x).reduce((n,v)=>n+leaves(v),0):1;
  assert.ok(leaves(c)<=55);assert.equal(c.terrain.reliefP95P5M,52);assert.equal(c.rock.massKg,null);assert.ok(!JSON.stringify(c).includes('profile'));assert.ok(!JSON.stringify(c).includes('elevation'));
});
test('automatic Markdown and local director use captured regional evidence and explicit missing geometry',()=>{
  const r=automaticSurface(context,grid),md=surfaceMarkdown(r),answer=answerSurface('Evaluate rocks and cavities',r);
  assert.match(md,/Automatic surface evidence/);assert.match(md,/52 m/);assert.match(md,/Individual rock dimensions/);assert.match(answer.answer,/52 m/);assert.match(answer.answer,/not measured/);assert.ok(answer.grounded.includes('surfaceAssessment.terrain.reliefP95P5M'));
});
test('every published catalogue DEM can populate automatic terrain evidence without manual inputs',()=>{
  let count=0;
  for(const file of readdirSync(new URL('../assets/data/',import.meta.url)).filter(f=>f.endsWith('.json'))){
    const g=JSON.parse(readFileSync(new URL('../assets/data/'+file,import.meta.url)));if(!g.site||!validGrid(g))continue;
    const r=automaticSurface({...context,siteId:g.site},g);assert.ok(Number.isFinite(r.automatic.terrain.reliefP95P5M),g.site);assert.ok(Number.isFinite(r.automatic.terrain.slopeP90Deg),g.site);assert.equal(r.rock.massKg.min,null);count++;
  }
  assert.ok(count>=14);
});
