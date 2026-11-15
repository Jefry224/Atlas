import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getLandingProfile } from '../landing-profiles.mjs';
import { evaluateLandingZones, createDescent, stepDescent, abortDescent, summarizeDescent } from '../landing-physics.mjs';

function flat(body='moon', {slopeX=0,slopeZ=0,offset=1400,n=65,spacing=37.5}={}) {
  return {id:`synthetic-${body}`,body,gridSize:n,spacingMeters:spacing,extentMeters:(n-1)*spacing,
    nativeResolutionMeters:spacing,center:[15,10],dataset:'synthetic test plane',source:'test',
    sampling:body==='earth'?{frame:'azimutal equidistante local',ellipsoid:'WGS84'}:{frame:'azimutal equidistante local',radiusMeters:body==='moon'?1737400:3396190},
    elevation:Array.from({length:n*n},(_,i)=>offset+slopeX*(i%n-(n-1)/2)*spacing+slopeZ*(Math.floor(i/n)-(n-1)/2)*spacing)};
}
function setup(body='moon', grid=flat(body), profile=getLandingProfile(body), initial) {
  const plan=evaluateLandingZones(grid,{profile});
  const zone=plan.zones.find(z=>z.id===plan.selectedId);
  return {grid,profile,plan,zone,state:createDescent({grid,profile,zone,initial})};
}
function finish(state,dt=.25) {
  let s=state;
  for(let i=0;i<10000&&['ready','descent'].includes(s.phase);i++) s=stepDescent(s,dt);
  assert.ok(!['ready','descent'].includes(s.phase),'run must terminate');
  return s;
}
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} ≠ ${expected} ±${tolerance}`);

for (const body of ['earth','moon','mars']) {
  test(`${body}: ballistic free fall uses SI gravity, not rendering scales or rover mass`,()=>{
    const {profile,grid,zone}=setup(body);
    const start=createDescent({profile,grid,zone,initial:{x:zone.x,z:zone.z,verticalSpeedMs:0}});
    const end=stepDescent(start,.05), g=profile.gravityMs2;
    assert.equal(end.thrustN,0);
    near(end.vyMs,-g*.05); near(end.yM-start.yM,-.5*g*.05**2);
    near(summarizeDescent(end).weightN,end.massKg*g);
    assert.ok(end.massKg>850); assert.notEqual(end.massKg,350);
  });
  test(`${body}: hover impulse obeys T/(Isp*g0), mass decreases and thrust remains bounded`,()=>{
    const {profile,grid,zone}=setup(body);
    const start=createDescent({profile,grid,zone,initial:{x:zone.x,z:zone.z,verticalSpeedMs:-profile.maxDescentSpeedMs}});
    const next=stepDescent(start,.05), expectedThrust=start.massKg*profile.gravityMs2;
    near(next.thrustN,expectedThrust,1e-8);
    near(start.propellantKg-next.propellantKg,expectedThrust*.05/(profile.ispSeconds*profile.g0Ms2));
    near(next.massKg,profile.dryMassKg+next.propellantKg);
    assert.ok(next.thrustN<=profile.thrustMaxN);
    const end=finish(start);
    assert.equal(end.phase,'contact');
    assert.ok(end.propellantKg<start.propellantKg);
    assert.ok(end.contact.verticalSpeedMs<=profile.touchdownVerticalSpeedMs);
  });
}

test('deterministic runs, pause, substep convergence and terminal idempotence without mutation',()=>{
  const {state}=setup(); const original=JSON.stringify(state);
  assert.notEqual(stepDescent(state,1,{running:false}),state);
  assert.equal(JSON.stringify(stepDescent(state,1,{running:false})),original);
  assert.equal(stepDescent(state,0).phase,'ready');
  const first=finish(state), second=finish(state);
  assert.deepEqual(first,second);
  assert.equal(JSON.stringify(state),original);
  let a=state,b=state;
  for(let i=0;i<80;i++) a=stepDescent(a,.25);
  for(let i=0;i<400;i++) b=stepDescent(b,.05);
  near(a.x,b.x,1e-8);near(a.yM,b.yM,1e-8);near(a.propellantKg,b.propellantKg,1e-8);
  const finer=finish(state,.025);
  near(first.simSeconds,finer.simSeconds,.25);
  near(first.x,finer.x,.3);
  assert.deepEqual(stepDescent(first,2),first);
  assert.deepEqual(abortDescent(first),first);
});

test('loaded DEM/profile/zone mutation cannot change an existing run or prior snapshot',()=>{
  const {state,grid,profile,zone}=setup(); const before=summarizeDescent(state);
  grid.elevation.fill(-9999);profile.thrustMaxN=0;zone.x=0;
  const end=finish(state);
  assert.equal(end.phase,'contact');
  assert.deepEqual(summarizeDescent(state),before);
  const snapshot=summarizeDescent(end);snapshot.profile.limitations.push('edit');snapshot.target.x=999;
  assert.notDeepEqual(snapshot,summarizeDescent(end));
  const json=JSON.stringify(summarizeDescent(end));
  assert.ok(!json.includes('"elevation":'));assert.ok(!json.includes('_terrain'));
  assert.ok(!json.includes('NaN'));assert.ok(!json.includes('Infinity'));
  assert.equal(summarizeDescent(end).georeference.kind,'model-projection-inverse');
});

test('empty/tiny fuel budgets never create a successful contact or negative mass/propellant',()=>{
  for (const fuel of [0,.001]) {
    const {profile,grid,zone}=setup();
    const start=createDescent({profile,grid,zone,initial:{propellantKg:fuel}});
    const next=stepDescent(start,.05);
    if(fuel===0)assert.equal(next.thrustN,0);
    const end=finish(start);
    assert.equal(end.phase,'hard-contact');assert.equal(end.outcome.success,false);
    assert.ok(end.faultCodes.includes('fuel-exhausted'));
    assert.ok(end.propellantKg>=0);assert.ok(end.massKg>=profile.dryMassKg);
    assert.equal(end.thrustN,0);
  }
});

test('insufficient thrust, explicit abort, and time limit stop honestly',()=>{
  const profile={...getLandingProfile('earth'),thrustMaxN:50};
  const broken=finish(setup('earth',flat('earth'),profile).state);
  assert.equal(broken.phase,'hard-contact');assert.ok(broken.faultCodes.includes('insufficient-thrust'));
  const {state}=setup(); const original=JSON.stringify(state);
  const aborted=abortDescent(stepDescent(state,1),'Parada manual de prueba.');
  assert.equal(aborted.phase,'aborted');assert.equal(aborted.thrustN,0);
  assert.equal(aborted.outcome.label,'Parada manual de prueba.');
  assert.equal(JSON.stringify(state),original);
  assert.deepEqual(stepDescent(aborted,5),aborted);
  const limited=setup('moon',flat(),{...getLandingProfile('moon'),maxSimSeconds:1}).state;
  const timeout=finish(limited);
  assert.equal(timeout.phase,'aborted');assert.equal(timeout.outcome.code,'time-limit');near(timeout.simSeconds,1);
});

test('inclined bilinear DEM collision preserves datum height, actual hit velocity and contact point',()=>{
  const grid=flat('moon',{slopeX:.08,slopeZ:-.02,offset:-1600});
  const {profile,zone}=setup('moon',grid);
  const start=createDescent({grid,profile,zone,initial:{x:zone.x,z:zone.z,altitudeM:1,verticalSpeedMs:-20,vxMs:5,propellantKg:0}});
  const end=stepDescent(start,1);
  assert.equal(end.phase,'hard-contact');assert.equal(end.altitudeM,0);
  near(end.yM,-1600+.08*end.x-.02*end.z,1e-8);
  near(end.x,start.x+5*end.simSeconds,1e-8);
  near(end.vyMs,-20-profile.gravityMs2*end.simSeconds,1e-8);
  near(end.contact.verticalSpeedMs,Math.abs(end.vyMs-.08*5),1e-8);
  assert.ok(end.simSeconds<.05);assert.ok(end.vyMs<-20,'impact velocity must not be zeroed');
  assert.equal(finish(setup('moon',grid).state).phase,'contact');
});

test('planner respects regional scale, science separation, edge coverage, scores and low native resolution',()=>{
  const {grid,profile,plan}=setup();
  assert.equal(plan.zones.length,5);assert.ok(plan.selectedId);
  assert.equal(plan.schema,'LandingZonePlan');
  for(const zone of plan.zones){
    assert.equal(zone.scaleMeters,225);assert.equal(zone.coverage,1);
    assert.ok(zone.scienceDistanceM>=300);assert.ok(Math.abs(zone.x)+zone.neighborhoodRadiusM<=1200);
    assert.ok(Math.abs(zone.z)+zone.neighborhoodRadiusM<=1200);
    assert.equal(zone.status,'candidate');assert.ok(zone.score>=0&&zone.score<=100);
  }
  assert.equal(createDescent({grid,profile,zone:{id:'edge',x:1200,z:1200}}).phase,'unavailable');
  for(const native of [undefined,463]){
    const coarse={...grid,nativeResolutionMeters:native};const out=evaluateLandingZones(coarse,{profile});
    assert.equal(out.selectedId,null);assert.ok(out.zones.every(z=>z.status==='unevaluable'));
  }
  assert.equal(evaluateLandingZones({...grid,metrics:{comparable:false}},{profile}).selectedId,null);
  assert.equal(evaluateLandingZones(flat('moon',{n:9}),{profile}).selectedId,null);
});

test('entirely steep grids retain caution evidence but cannot force a selection or spoof geometry',()=>{
  const {profile}=setup(),grid=flat('moon',{slopeX:1});
  const plan=evaluateLandingZones(grid,{profile});
  assert.equal(plan.selectedId,null);assert.ok(plan.zones.length>=3);
  assert.ok(plan.zones.every(z=>z.status==='caution'&&!z.eligible));
  const fake={...plan.zones[0],eligible:true,status:'candidate',slopeDeg:0,reliefM:0};
  assert.equal(createDescent({profile,grid,zone:fake}).phase,'unavailable');
});

test('nulls, invalid SI ranges, mismatched bodies/IDs, no coverage and absent candidates fail explicitly',()=>{
  const {grid,profile,zone,state}=setup();
  for(const bad of [null,{}, {...grid,elevation:[0]}, {...grid,elevation:grid.elevation.map((v,i)=>i===1?null:v)}, {...grid,extentMeters:100}]){
    assert.equal(evaluateLandingZones(bad,{profile}).selectedId,null);
    assert.equal(createDescent({grid:bad,profile,zone}).phase,'unavailable');
  }
  assert.equal(createDescent(null).phase,'unavailable');assert.equal(evaluateLandingZones(null,null).selectedId,null);
  assert.equal(createDescent({grid,profile:getLandingProfile('mars'),zone}).phase,'unavailable');
  assert.equal(createDescent({grid,profile,zone:{...zone,gridId:'foreign'}}).phase,'unavailable');
  assert.equal(createDescent({grid,profile,zone:null}).phase,'unavailable');
  for(const initial of [{altitudeM:null},{propellantKg:-1},{x:Infinity},{verticalSpeedMs:'-1'},{altitudeM:-1},{unknown:5},null]){
    assert.equal(createDescent({grid,profile,zone,initial}).phase,'unavailable');
  }
  for(const dt of [-1,61,null,NaN,Infinity,'1'])assert.equal(stepDescent(state,dt).phase,'unavailable');
  assert.equal(stepDescent(null,1).phase,'unavailable');assert.equal(abortDescent(null).phase,'unavailable');
  assert.equal(stepDescent(state,1,{running:'yes'}).phase,'unavailable');
  assert.equal(summarizeDescent(null).altitudeM,null);
  assert.equal(evaluateLandingZones(grid,{profile,sciencePoint:{x:9999,z:0}}).selectedId,null);
  const edge=createDescent({grid,profile,zone,initial:{x:1199,z:0,vxMs:100,altitudeM:180}});
  const gone=stepDescent(edge,1);assert.equal(gone.phase,'aborted');assert.equal(gone.outcome.code,'outside-dem');assert.equal(gone.altitudeM,null);
});

test('noncentral science points are preserved consistently through planning and creation',()=>{
  const grid=flat(),profile=getLandingProfile('moon'),sciencePoint={x:300,z:300};
  const plan=evaluateLandingZones(grid,{profile,sciencePoint});const zone=plan.zones.find(z=>z.id===plan.selectedId);
  const s=createDescent({grid,profile,zone});
  assert.deepEqual(s.target.sciencePoint,sciencePoint);
  near(s.target.scienceDistanceM,Math.hypot(zone.x-300,zone.z-300));
});

test('inverse AEQD georeferences match independent PROJ references including Shackleton, or return null for unknown frames',()=>{
  // Generated independently with pyproj/PROJ Transformer(AEQD->longlat), x=1000m, north=500m.
  const expected={
    atacama:[-24.104935409001342,-70.09939416966122],
    'la-corona':[29.174040669152337,-13.43027989139214],
    'wadi-rum':[29.57060039431632,35.417160028709596],
    'wright-valley':[-77.4957182059969,161.86504763937177],
    jezero:[18.453134473878595,77.46858506146877],
    'marius-hills':[14.107486559740307,-56.74299657683197],
    shackleton:[-89.76425308641794,-147.70218061832227],
    'valles-marineris':[-12.831564131592849,-60.56269729749471],
  };
  for(const [id,[latitude,longitude]] of Object.entries(expected)){
    const dir=['atacama','la-corona','wadi-rum','wright-valley'].includes(id)?'earth':'targets';
    const grid=JSON.parse(fs.readFileSync(new URL(`../assets/data/scenarios/${dir}/${id}.json`,import.meta.url)));
    const {profile,zone}=setup(grid.body,grid);
    const s=createDescent({grid,profile,zone,initial:{x:1000,z:-500}}),geo=summarizeDescent(s).georeference;
    assert.ok(geo,id);near(geo.latitude,latitude,1e-8);near(geo.longitude,longitude,1e-8);
    if(grid.body==='mars')assert.equal(geo.reference.radiusMeters,3396190);
  }
  const grid={...flat(),sampling:null};
  const {state,plan}=setup('moon',grid);
  assert.equal(summarizeDescent(state).georeference,null);
  assert.ok(plan.limitations.some(s=>s.includes('Georreferencia no disponible')));
});

for(const [scenario,earth,target] of [['lava-tube','la-corona','marius-hills'],['polar-shadow','wright-valley','shackleton'],['hyperarid-salt','atacama','jezero'],['wind-canyon','wadi-rum','valles-marineris']]) {
  test(`${scenario}: both real DEMs have independent regional candidates and viable proposed descents`,()=>{
    const durations=[];
    for(const [directory,id] of [['earth',earth],['targets',target]]){
      const grid=JSON.parse(fs.readFileSync(new URL(`../assets/data/scenarios/${directory}/${id}.json`,import.meta.url)));
      const {plan,profile,state}=setup(grid.body,grid);
      assert.ok(plan.selectedId,id);assert.ok(plan.zones.length>=3);
      const end=finish(state);assert.equal(end.phase,'contact',id);
      assert.equal(end.contact.withinTolerances,true);assert.equal(end.outcome.success,true);
      assert.ok(end.propellantKg>0);assert.ok(end.simSeconds<profile.maxSimSeconds);
      durations.push(end.simSeconds);
      const perturbed={...grid,elevation:grid.elevation.map((v,i)=>v+Math.sin(i*12.34)*.001)};
      const noisy=evaluateLandingZones(perturbed,{profile});
      assert.equal(noisy.selectedId,plan.selectedId,`${id}: millimetric noise must not retarget`);
      assert.deepEqual(evaluateLandingZones(grid,{profile}),plan);
      const lowres=evaluateLandingZones({...grid,nativeResolutionMeters:463},{profile});
      assert.equal(lowres.selectedId,null);
    }
    assert.ok(Math.abs(durations[0]-durations[1])>1,'Earth and target dynamics must differ');
  });
}
