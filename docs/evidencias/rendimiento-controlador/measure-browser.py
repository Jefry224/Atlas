"""Real Orca rAF/longtask capture; start is nonblocking, collect later. No engine hooks."""
import json,subprocess,sys
from pathlib import Path
PAGE='0cab6187-6ca9-462d-81b0-5b32807871ec'
def call(*args):
 p=subprocess.run(['orca-ide',*args,'--json'],capture_output=True,text=True,timeout=58)
 d=json.loads(p.stdout);assert d.get('ok'),d
 return d['result']
def ev(js):
 r=call('eval','--page',PAGE,'--expression',js)['result']
 return json.loads(r) if isinstance(r,str) else r
if sys.argv[1]=='start':
 print(ev('''(()=>{
 const p=window.__frameProbe={frames:{},longtasks:[],done:false,start:performance.now(),phaseStart:performance.now(),lastPhase:'ready'};
 const canvas=document.querySelector('#atlas-scene'),gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');const ext=gl?.getExtension('WEBGL_debug_renderer_info');
 p.config={ua:navigator.userAgent,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,visibility:document.visibilityState,camera:document.querySelector('[data-flight-camera]')?.value,rate:1,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,longtaskSupported:PerformanceObserver.supportedEntryTypes.includes('longtask'),vsync:'rAF host scheduled; no independent GPU FPS or physical mobile hardware'};
 if(p.config.longtaskSupported){p.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())p.longtasks.push({start:e.startTime,duration:e.duration,phase:p.lastPhase})});p.observer.observe({type:'longtask',buffered:false})}
 let last=null,contactAt=null,exploreAt=null;
 function tick(t){const phase=document.querySelector('#landing-panel').dataset.phase;if(phase!==p.lastPhase){p.phaseStart=t;p.lastPhase=phase}const key=phase==='descent'?(t-p.phaseStart<15000?'descent-early':'descent-late'):phase;if(last!==null)(p.frames[key]??=[]).push(t-last);last=t;
 if(phase==='contact'){contactAt??=t;if(t-contactAt>6000)document.querySelector('[data-flight-action]').click()}
 if(phase==='exploration'){exploreAt??=t;if(t-exploreAt>8000){p.done=true;p.observer?.disconnect();return}}
 if(t-p.start>85000){p.done=true;p.timeout=true;p.observer?.disconnect();return}requestAnimationFrame(tick)}requestAnimationFrame(tick);
 setTimeout(()=>document.querySelector('[data-flight-action]').click(),8000);return JSON.stringify({started:true,config:p.config})})()'''))
else:
 data=ev('''(()=>{const p=window.__frameProbe;const stats=a=>{const b=[...a].sort((x,y)=>x-y);return {n:b.length,median:b[Math.floor(b.length*.5)]??null,p95:b[Math.floor(b.length*.95)]??null,over50:b.filter(v=>v>50).length}};return JSON.stringify({done:p.done,timeout:p.timeout??false,config:p.config,frames:Object.fromEntries(Object.entries(p.frames).map(([k,v])=>[k,stats(v)])),longtasks:p.longtasks,elapsed:performance.now()-p.start})})()''')
 Path(sys.argv[2]).write_text(json.dumps(data,indent=2));print(json.dumps(data))
