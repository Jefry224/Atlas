import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { earthExportIdentity } from '../src/mission/mission-export-identity.mjs';
const scenarios=JSON.parse(readFileSync(new URL('../assets/data/scenarios.json',import.meta.url))).scenarios;
test('fresh destination exports resolve every paired Earth window without a prior catalogue or Earth visit',()=>{
  for(const scenario of scenarios){
    const grid=JSON.parse(readFileSync(new URL(`../${scenario.earth}`,import.meta.url)));
    const site=earthExportIdentity({view:'split',scenario,grid,selectedSite:null});
    assert.equal(site.id,scenario.earthId);assert.equal(site.id,grid.id);assert.equal(site.lat,grid.center[0]);assert.equal(site.lon,grid.center[1]);assert.equal(site.country,null);assert.equal(site.catalogueReference,null);
  }
});
test('a stale catalogue selection cannot override destination identity, while a genuine documentary marker stays separate',()=>{
  const scenario=scenarios.find(s=>s.id==='hyperarid-salt'),grid=JSON.parse(readFileSync(new URL(`../${scenario.earth}`,import.meta.url)));
  const stale={id:'pampa-joya',name:'Unrelated site',lat:1,lon:2,country:'Unrelated country'};
  const site=earthExportIdentity({view:'split',scenario,grid,selectedSite:stale,catalogueSite:stale});
  assert.equal(site.id,'atacama');assert.equal(site.lat,grid.center[0]);assert.equal(site.country,null);assert.equal(site.catalogueReference,null);
  const reference={id:'atacama',lat:-24.102,lon:-70.138,country:'Chile'};
  const known=earthExportIdentity({view:'split',scenario,grid,catalogueSite:reference});
  assert.deepEqual(known.catalogueReference,{lat:reference.lat,lon:reference.lon});assert.equal(known.country,'Chile');assert.notEqual(known.lat,reference.lat);
});
test('known scenario Earth identity remains available when the Earth DEM and catalogue reference are missing',()=>{
  const scenario=scenarios[0],site=earthExportIdentity({view:'split',scenario,grid:null});
  assert.equal(site.id,'la-corona');assert.equal(site.name,scenario.earthLabel);assert.equal(site.lat,null);assert.equal(site.lon,null);assert.equal(earthExportIdentity({view:'terrain'}),null);
});
