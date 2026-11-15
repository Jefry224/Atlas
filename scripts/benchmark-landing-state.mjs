// Hardware-neutral evidence: timings are descriptive, never pass/fail thresholds.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createLandingController } from '../src/landing/landing-controller.mjs';
const scenarios=JSON.parse(fs.readFileSync(new URL('../assets/data/scenarios.json',import.meta.url))).scenarios;
const sc=scenarios[0], read=path=>JSON.parse(fs.readFileSync(new URL(`../${path}`,import.meta.url)));
const c=createLandingController(); c.configure({scenarioId:sc.id,body:sc.body,earthGrid:read(sc.earth),targetGrid:read(sc.target)});
function measure(fn){for(let i=0;i<10;i++)fn(); const times=[]; for(let b=0;b<50;b++){const t=performance.now();for(let i=0;i<10;i++)fn();times.push(performance.now()-t)}times.sort((a,b)=>a-b);return {batches:50,callsPerBatch:10,medianMs:times[25],p95Ms:times[47]};}
const rows=[];function capture(label){const state=c.inspect(); rows.push({label,phase:c.phase,history:state.history.length,view:measure(()=>c.view()),...(c.renderState?{renderState:measure(()=>c.renderState())}:{})})}
capture('ready');c.start('benchmark');while(c.phase==='preparation')c.step(.1);while(c.inspect().runs.target.simSeconds<25&&c.running)c.step(.1);capture('flight-25-SI-seconds');while(c.running)c.step(.1);capture('contact');c.requestDeployment();while(c.phase!=='exploration'&&c.running)c.step(.1);capture('exploration');
// Synthetic, covered route fixture measures projection operations, not a rover flight.
const rover={x:0,z:0,heading:0,path:Array.from({length:1200},()=>[0,0])};rows.push({label:'projection-1200-points',targetPose:measure(()=>c.targetPose(rover)),...(c.renderTargetPose?{
 renderTargetPose:measure(()=>c.renderTargetPose(rover)),
 renderTargetPoseWithPath:measure(()=>c.renderTargetPose(rover,{includePath:true})),
 renderTargetPoseVersioned:measure(()=>c.renderTargetPose(rover,{includePath:true,pathRevision:1})),
}:{})});
if(process.argv.includes('--stress-history')){c.start('recorder-stress');c.pause(false);for(let i=0;i<1205;i++)c.record(true);capture('1200-bounded-records-explicit-recorder-stress-not-a-longer-flight')}
console.log(JSON.stringify({capturedAt:new Date().toISOString(),controllerSha256:createHash('sha256').update(fs.readFileSync(new URL('../src/landing/landing-controller.mjs',import.meta.url))).digest('hex'),runtime:process.version,platform:process.platform,arch:process.arch,unit:'milliseconds per 10 calls; 50 batches; no hardware thresholds',rows},null,2));
