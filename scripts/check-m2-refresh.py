#!/usr/bin/env python3
"""Static REAL fallback + explicitly mocked clock/backend lifecycle through Orca."""
import argparse,json,subprocess,time,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--page',required=True);a=p.parse_args();dest=Path(__file__).resolve().parents[1]/'docs/evidencias/m2-automatico';checks=[];unavailable=[]
def cmd(*args):
 r=subprocess.run(['orca-ide',*args,'--json'],capture_output=True,text=True,timeout=60);j=json.loads(r.stdout);assert j.get('ok'),j;return j['result']
def js(code):
 v=cmd('eval','--page',a.page,'--expression',f'(()=>eval({json.dumps(code)}))()')['result'];return json.loads(v) if isinstance(v,str) else v
def check(name,code):
 v=js(code);assert v is True,(name,v);checks.append(name);print('PASS',name,flush=True);(dest/'refresh-static-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'unavailable':unavailable},ensure_ascii=False,indent=2)+'\n')
def click(s):js(f'document.querySelector({json.dumps(s)}).click();JSON.stringify(true)')
def wait(s):cmd('wait','--page',a.page,'--selector',s)
cmd('goto','--page',a.page,'--url','http://localhost:8028/');wait('[data-scenario=lava-tube]');click('[data-scenario=lava-tube]');wait('#analogy-audit[data-weather-samples="1"]')
check('REAL STATIC: sin API muestra archivo fechado y mantiene carga automática', 'JSON.stringify(document.querySelector("[data-m2-status]").textContent.includes("clima archive")&&document.querySelector("[data-m2-origins]").textContent.includes("archive")&&document.querySelector("[data-bench-values]").textContent.includes("567 N"))')
js('document.querySelector("#analogy-audit").scrollIntoView({block:"start"});JSON.stringify(true)');v=cmd('screenshot','--page',a.page)['path'];src=Path('/mnt/'+v[0].lower()+'/'+v[3:].replace('\\','/')) if ':\\' in v else Path(v);shutil.copyfile(src,dest/'static-archivo-desktop.png')
# Explicit QA backend mock appears AFTER initial actual static backend detection failed.
js('window.realNow=Date.now;window.clockShift=0;Date.now=()=>window.realNow()+window.clockShift;window.realFetch=fetch;window.qaCalls=[];window.qaObservation=new Date().toISOString();window.fetch=async(url,opts)=>{if(String(url).startsWith("/api/health")){window.qaCalls.push("health");return new Response(JSON.stringify({status:"ok",version:"QA-MOCK",providers:{weather:"QA-MOCK",ai:"rules"}}));}if(String(url).startsWith("/api/telemetry")){window.qaCalls.push("weather");return new Response(JSON.stringify({site:"lanzarote",provider:"QA-MOCK",observedAt:window.qaObservation,live:true,cached:window.qaCalls.filter(x=>x==="weather").length>1,values:{surfacePressurePa:95000,temperatureC:12},source:{url:"QA-MOCK"}}));}return window.realFetch(url,opts)};window.clockShift=31000;JSON.stringify(true)')
wait('#analogy-audit[data-weather-samples="2"]')
check('MOCK: backend ausente al arranque se detecta al reintentar 30s', 'JSON.stringify(window.qaCalls.includes("health")&&document.querySelector("[data-m2-origins]").textContent.includes("QA-MOCK")&&document.querySelector("[data-m2-status]").textContent.includes("model/current"))')
# 599 s since last fetch remains inside TTL, 601 s triggers once.
js('window.beforeQA=window.qaCalls.filter(x=>x==="weather").length;window.clockShift+=590000;JSON.stringify(true)');time.sleep(1)
check('MOCK: 590s todavía sin nueva consulta meteorológica', 'JSON.stringify(window.qaCalls.filter(x=>x==="weather").length===window.beforeQA)')
js('window.clockShift+=11000;JSON.stringify(true)');time.sleep(1.5)
check('MOCK: 600s TTL permite siguiente fetch y deduplica misma observación', 'JSON.stringify(window.qaCalls.filter(x=>x==="weather").length===window.beforeQA+1&&document.querySelector("#analogy-audit").dataset.weatherSamples==="2")')
# Test actual page lifecycle handlers with explicit visibility override, not fake provider data labelled real.
supported=js('(()=>{try{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});return JSON.stringify(true)}catch{return JSON.stringify(false)}})()')
if supported:
 js('window.beforeHiddenCalls=window.qaCalls.length;window.beforeHiddenSamples=document.querySelector("#analogy-audit").dataset.roverSamples;document.dispatchEvent(new Event("visibilitychange",{bubbles:true}));window.clockShift+=601000;JSON.stringify(true)');time.sleep(1.5)
 check('MOCK: página oculta detiene registro y fetch aunque venza TTL', 'JSON.stringify(window.qaCalls.length===window.beforeHiddenCalls&&document.querySelector("#analogy-audit").dataset.roverSamples===window.beforeHiddenSamples)')
 js('delete document.hidden;window.qaObservation=new Date(Date.now()).toISOString();document.dispatchEvent(new Event("visibilitychange",{bubbles:true}));JSON.stringify(true)');wait('#analogy-audit[data-weather-samples="3"]')
 check('MOCK: recuperar visibilidad reanuda datos y consulta vencida', 'JSON.stringify(window.qaCalls.length>window.beforeHiddenCalls&&document.querySelector("#analogy-audit").dataset.weatherSamples==="3")')
else:
 unavailable.append('Orca: document.hidden no es redefinible y cambiar pestaña no ofrece visibilidad nativa fiable; rama oculta revisada en código, sin afirmar prueba nativa.')
 js('window.qaObservation=new Date(Date.now()).toISOString();document.dispatchEvent(new Event("visibilitychange",{bubbles:true}));JSON.stringify(true)')
 check('Evento de visibilidad visible recupera seguimiento', 'JSON.stringify(document.querySelector("[data-m2-status]").textContent.includes("Misión:"))')
# Reset new session and force pagehide suspension, then persisted pageshow to recover.
click('#mission-reset');time.sleep(1)
js('window.beforeHide=document.querySelector("#analogy-audit").dataset.roverSamples;dispatchEvent(new Event("pagehide"));window.clockShift+=20000;JSON.stringify(true)');time.sleep(1.5)
check('MOCK: pagehide limpia temporizador de seguimiento', 'JSON.stringify(document.querySelector("#analogy-audit").dataset.roverSamples===window.beforeHide)')
# Return to real live preview with no patched clocks or network.
cmd('goto','--page',a.page,'--url','http://localhost:8027/');wait('[data-scenario=lava-tube]');click('[data-scenario=lava-tube]');wait('[data-m2-origins] tr')
print(f'{len(checks)} refresh/static checks passed',flush=True)
