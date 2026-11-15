import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLandingController } from '../landing-controller.mjs';
import { validateLandingPayload } from '../landing-report.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(`../${path}`,import.meta.url)));
const scenarios=read('assets/data/scenarios.json').scenarios;
const configs=scenarios.map(sc=>({scenarioId:sc.id,body:sc.body,earthGrid:read(sc.earth),targetGrid:read(sc.target)}));
function setup(index=0,extra={}){const c=createLandingController();c.configure({...configs[index],...extra});return c;}
function finish(c){for(let i=0;i<2000&&c.running;i++)c.step(.1);}
function explore(c){c.setOptions({timeScale:4});c.start('render');finish(c);assert.equal(c.phase,'contact');c.requestDeployment();finish(c);assert.equal(c.phase,'exploration');}
function countClones(fn){const original=globalThis.structuredClone;let calls=0;globalThis.structuredClone=(...args)=>{calls++;return original(...args)};try{fn();return calls}finally{globalThis.structuredClone=original}}

test('render reads reuse immutable plans, summaries and origins; copies retain writable isolation',()=>{
 const c=setup(),ready=c.renderState();assert.equal(c.renderState(),ready);
 c.setOptions({timeScale:1});c.choose('target',ready.plans.target.selectedId);assert.equal(c.renderState(),ready);
 assert.ok(Object.isFrozen(ready));assert.ok(Object.isFrozen(ready.profiles.target));assert.ok(Object.isFrozen(ready.plans.target.zones[0]));
 assert.throws(()=>{ready.plans.target.selectedId='bad'},TypeError);
 c.setOptions({timeScale:2});const options=c.renderState();assert.ok(options.revision>ready.revision);assert.equal(options.planRevision,ready.planRevision);assert.equal(options.plans,ready.plans);assert.equal(options.profiles,ready.profiles);
 const zone=options.plans.target.zones.find(z=>z.eligible&&z.id!==options.plans.target.selectedId);assert.ok(zone);c.choose('target',zone.id);const chosen=c.renderState();assert.ok(chosen.planRevision>options.planRevision);assert.notEqual(chosen.plans,options.plans);
 c.start('cache');const start=c.renderState();assert.ok(start.historyRevision>chosen.historyRevision);assert.equal(start.history.length,1);assert.equal(c.renderState(),start);
 c.step(1);c.step(1);const descent=c.renderState();c.step(.1);let next;assert.equal(countClones(()=>{next=c.renderState()}),0);assert.notEqual(next.runs.target,descent.runs.target);assert.equal(next.plans,chosen.plans);assert.equal(next.profiles,chosen.profiles);
 assert.equal(countClones(()=>{for(let batch=0;batch<50;batch++)for(let call=0;call<10;call++){assert.equal(c.renderState(),next);assert.equal(c.mirrorAvailable,next.mirrorAvailable)}}),0);
 for(const copy of [c.view(),c.inspect(),c.snapshot()]){copy.history[0].target.x=999;copy.runs.target.x=999;copy.plans.target.selectedId='bad';copy.profiles.target.dryMassKg=0;copy.options.timeScale=0;copy.explorationOrigins.earth.x=999;}
 assert.notEqual(c.snapshot().history[0].target.x,999);assert.equal(c.renderState(),next);assert.equal(c.options.timeScale,2);
 c.pause(false);const paused=c.renderState();c.step(.1);assert.equal(c.renderState(),paused);c.pause(true);assert.equal(c.renderState().running,true);c.abort();assert.equal(c.renderState().running,false);
});

test('render history is live, readonly, bounded; exports and previous sessions remain isolated',()=>{
 const c=setup();c.start('bounded');c.pause(false);const initial=c.snapshot(),live=c.renderState().history;
 for(const mutate of [()=>live.push({}),()=>live.pop(),()=>{live[0]={}},()=>{delete live[0]},()=>Object.defineProperty(live,'0',{value:{}}),()=>Object.setPrototypeOf(live,{}),()=>Object.preventExtensions(live),()=>{live[0].target.x=999}])assert.throws(mutate,TypeError);
 // Stress the public recorder honestly, without altering physics or claiming a longer flight.
 for(let i=0;i<1205;i++)c.record(true);
 const full=c.renderState();assert.equal(full.history,live);assert.equal(live.length,1200);assert.equal(initial.history.length,1);assert.equal(c.snapshot().history.length,1200);
 assert.equal(countClones(()=>{for(let i=0;i<500;i++){assert.equal(c.renderState(),full);assert.equal(c.renderState().history.length,1200)}}),0);
 c.setOptions({timeScale:2});assert.equal(countClones(()=>{assert.equal(c.renderState().history,live)}),0);
 const exported=c.snapshot();exported.history[0].target.x=999;assert.notEqual(live[0].target.x,999);
 exported.runs.target.x=777;assert.notEqual(exported.history.at(-1).target.x,777);
 const sc=scenarios[0];assert.equal(validateLandingPayload(c.snapshot(),{missionId:'bounded',scenarioId:sc.id,body:sc.body,earthId:sc.earthId,targetId:sc.targetId}).valid,true);
 c.configure(configs[1]);assert.equal(c.renderState().history.length,0);assert.equal(live.length,1200);assert.ok(c.renderState().planRevision>full.planRevision);assert.equal(c.renderState().active,false);
});

test('projection handles in-place paths, push, shift, cap, heading, coverage and session invalidation',()=>{
 const c=setup();explore(c);const origin=c.renderState().explorationOrigins.target;
 const rover={x:1,z:2,heading:3,path:[[0,0],[1,2]],extra:{unchanged:true}};
 const first=c.renderTargetPose(rover,{includePath:true});assert.equal(first.x,origin.x+1);assert.ok(Object.isFrozen(first.path[0]));assert.equal(first.extra,undefined);
 assert.equal(c.renderTargetPose(rover,{includePath:true}).path,first.path);
 rover.heading=90;assert.equal(c.renderTargetPose(rover).heading,90);assert.equal(c.renderTargetPose(rover).path,undefined);
 rover.path[0][0]=7;const edited=c.renderTargetPose(rover,{includePath:true});assert.equal(edited.path[0][0],origin.x+7);assert.equal(first.path[0][0],origin.x);
 rover.path.push([2,3]);assert.equal(c.renderTargetPose(rover,{includePath:true}).path.length,3);
 rover.path.shift();rover.path.push([3,4]);const capped=c.renderTargetPose(rover,{includePath:true});assert.equal(capped.path.length,3);assert.equal(capped.path[0][0],origin.x+1);
 rover.path=[[4,5]];assert.equal(c.renderTargetPose(rover,{includePath:true}).path[0][0],origin.x+4);
 const isolated=c.targetPose(rover);isolated.extra.unchanged=false;isolated.path[0][0]=999;assert.equal(rover.extra.unchanged,true);assert.equal(c.targetPose(rover).path[0][0],origin.x+4);
 rover.path[0][0]=Infinity;assert.equal(c.targetPose(rover),null);assert.equal(c.renderTargetPose(rover,{includePath:true}),null);rover.path=[[1e9,0]];assert.equal(c.targetPose(rover),null);
 rover.x=1e9;assert.equal(c.renderTargetPose(rover),null);
 c.configure(configs[1]);assert.equal(c.renderTargetPose({x:0,z:0,path:[]}),null);explore(c);assert.notDeepEqual(c.renderState().explorationOrigins.target,origin);
});

test('versioned render projection and scalar reads never traverse an unchanged route',()=>{
 const c=setup();explore(c);let reads=0;const route=new Proxy([[0,0],[1,1]],{get(target,key,receiver){if(key===Symbol.iterator||/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key,receiver)}});
 const rover={x:0,z:0,heading:0,path:route};const initial=c.renderTargetPose(rover,{includePath:true,pathRevision:1});assert.ok(initial);reads=0;
 assert.equal(countClones(()=>{for(let i=0;i<500;i++){assert.equal(c.renderTargetPose(rover,{includePath:true,pathRevision:1}).path,initial.path);assert.equal(c.renderTargetPose(rover).x,initial.x)}}),0);assert.equal(reads,0);
 route.push([2,2]);const changed=c.renderTargetPose(rover,{includePath:true,pathRevision:2});assert.equal(changed.path.length,3);assert.ok(reads>0);assert.equal(initial.path.length,2);
});

test('render state agrees with isolated API in four scenarios, legacy and missing Earth',()=>{
 for(let index=0;index<4;index++)for(const mode of ['target-first','paired-legacy','missing-earth']){
  const c=setup(index,mode==='missing-earth'?{earthGrid:null}:{missionMode:mode});explore(c);
  const render=c.renderState(),copy=c.inspect();for(const key of Object.keys(copy))assert.deepEqual(render[key],copy[key]);
  assert.equal(render.mirrorAvailable,mode!=='missing-earth');assert.equal(render.runs.earth===null,mode!=='paired-legacy');
  if(mode==='missing-earth')assert.equal(c.renderTargetPose({x:0,z:0,path:[]}),null);
 }
});

test('synchronous event/deploy observers see current transitions and both legacy sides',()=>{
 const seen=[];let deployedState=null;
 const c=createLandingController({event:type=>seen.push({type,state:c.renderState()}),deploy:()=>{deployedState=c.renderState()}});
 c.configure({...configs[0],missionMode:'paired-legacy'});c.renderState();c.setOptions({timeScale:4});c.start('observer');
 c.pause(false);assert.equal(seen.at(-1).type,'pause');assert.equal(seen.at(-1).state.running,false);
 c.pause(true);assert.equal(seen.at(-1).state.running,true);
 for(let i=0;i<1500&&c.running;i++){c.step(.05);assert.deepEqual(c.renderState().runs,c.inspect().runs)}
 assert.equal(c.phase,'contact');assert.equal(seen.find(e=>e.type==='contact').state.phase,'contact');assert.equal(seen.at(-1).state.running,false);
 c.requestDeployment();assert.equal(seen.at(-1).state.phase,'deployment');finish(c);assert.equal(deployedState.phase,'exploration');assert.equal(deployedState.deployed,true);
 c.configure(configs[0]);c.start('abort-observer');c.renderState();c.abort();assert.equal(seen.at(-1).state.phase,'aborted');assert.equal(seen.at(-1).state.runs.target.phase,'aborted');
});
