#!/usr/bin/env python3
"""Owned Orca page checks through real UI handlers and export Blobs.
Usage: python scripts/qa-earth-analysis.py PAGE_ID http://localhost:8284/
Weather uses published snapshots; optional provider transport is explicitly mocked.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

PAGE, URL = sys.argv[1:3]
OUT = Path(__file__).resolve().parents[1] / 'docs/evidencias/earth-analysis'
OUT.mkdir(parents=True, exist_ok=True)
checks = []
CLI = os.environ.get('ORCA_CLI_COMMAND', 'orca-ide')


def cmd(*args):
    result = subprocess.run([CLI, *args, '--json'], capture_output=True, text=True, timeout=58)
    data = json.loads(result.stdout)
    if not data.get('ok'):
        raise RuntimeError(data)
    return data['result']


def ev(js):
    value = cmd('eval', '--page', PAGE, '--expression', js)['result']
    return json.loads(value) if isinstance(value, str) else value


def act(js):
    return ev('(()=>{' + js + ';return JSON.stringify(true)})()')


def click(selector):
    act('const e=document.querySelector(' + json.dumps(selector) + ');if(!e||e.disabled)throw Error(' + json.dumps('Unavailable control: '+selector) + ');e.click()')


def change(selector, value):
    act('const e=document.querySelector(' + json.dumps(selector) + ');e.value=' + json.dumps(value) + ';e.dispatchEvent(new Event("change",{bubbles:true}))')


def wait(condition):
    assert ev('(async()=>{const end=Date.now()+25000;while(Date.now()<end){if(' + condition + ')return JSON.stringify(true);await new Promise(r=>setTimeout(r,80))}return JSON.stringify(false)})()'), condition


def check(name, result):
    assert result, name
    checks.append({'name': name, 'passed': True})
    (OUT / 'browser.json').write_text(json.dumps({'complete':False,'checks':checks}, indent=2))
    print('PASS:', name, flush=True)


def export(selector, fmt='json'):
    text = ev('(async()=>{const i=qaBlobs.length;document.querySelector(' + json.dumps(selector) + ').click();const b=qaBlobs.slice(i).find(b=>b.type.includes(' + json.dumps('json' if fmt=='json' else 'markdown') + '));if(!b)throw Error("No export Blob");return JSON.stringify(await b.text())})()')
    return json.loads(text) if fmt == 'json' else text


def drawer(tab):
    act('const d=document.querySelector("#sim-drawer");if(d.hidden||d.dataset.tab!==' + json.dumps(tab) + ')document.querySelector("[data-open-drawer=' + tab + ']").click()')


def close_drawer():
    act('const d=document.querySelector("#sim-drawer");if(!d.hidden)document.querySelector("[data-drawer-close]").click()')


def screenshot(name, selector):
    act('document.querySelector(' + json.dumps(selector) + ').scrollIntoView({block:"start"})')
    path = cmd('screenshot', '--page', PAGE)['path'].replace('\\', '/')
    if len(path)>1 and path[1]==':':
        path='/mnt/'+path[0].lower()+path[2:]
    shutil.copyfile(path, OUT / name)


# The injected document uses the unmodified app modules and actual data files.
# Only network/provider availability and export observation are fixtures.
hook = '''window.qaBlobs=[];window.qaRequests=[];window.qaErrors=[];window.qaMockAnswer=false;window.qaDelayTarget=false;window.qaReplyCompleted=0;addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));const create=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b instanceof Blob)qaBlobs.push(b);return create(b)};const anchor=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!this.download)return anchor.call(this)};const original=fetch.bind(window);window.fetch=async(input,options)=>{const url=new URL(typeof input==='string'?input:input.url,document.baseURI),path=url.pathname;if(path==='/api/health')return new Response(JSON.stringify({status:'ok',providers:{ai:'openai'}}),{headers:{'Content-Type':'application/json'}});if(path==='/api/copilot'){const body=JSON.parse(options.body);qaRequests.push(body);if(!qaMockAnswer)return new Response('{}',{status:503});if(body.question.includes('delayed'))await new Promise(r=>setTimeout(r,1300));qaReplyCompleted++;return new Response(JSON.stringify({answer:'QA transport response for '+body.context.surfaceAssessment.siteId,provider:'openai',grounded:['surfaceAssessment.siteId'],disclaimer:'Local transport fixture, not an AI answer.'}),{headers:{'Content-Type':'application/json'}})}if(path.startsWith('/api/'))return new Response('{}',{status:503});if(qaDelayTarget&&path.includes('/targets/'))await new Promise(r=>setTimeout(r,1100));if(url.origin!==new URL(document.baseURI).origin)return new Response('{}',{status:503});return original(input,options)};'''
expression='(async()=>{const base='+json.dumps(URL)+',html=await(await fetch(base)).text();const injected=html.replace("<head>",'+json.dumps('<head><base href="'+URL+'"><script>'+hook+'</script>')+');const url=URL.createObjectURL(new Blob([injected],{type:"text/html"}));setTimeout(()=>location.href=url,60);return JSON.stringify(true)})()'
assert ev(expression)
wait('location.protocol==="blob:"&&document.querySelectorAll(".scenario-button").length===4')
cmd('viewport','--page',PAGE,'--width','1440','--height','1050')
click('#view-terrain')
wait('document.querySelector("#earth-expedition").dataset.sessionId&&document.querySelectorAll("[data-surface-metrics] .surface-metric").length===4')
drawer('flight')
earth = export('[data-surface-export=json]')
check('Terrain 3D automatically populates regional relief, slopes and scale', earth['context']['body']=='earth' and earth['automatic']['terrain']['reliefP95P5M'] is not None and earth['automatic']['terrain']['source'])
check('Manual Rock envelope and reference-loading controls are removed', ev('JSON.stringify(!document.querySelector("[data-surface-input],[data-surface-shape],[data-surface-reference]"))'))
check('Automatic Earth evidence does not invent individual boulder or cavity dimensions', earth['rock']['massKg']['min'] is None and earth['cavity']['inputs']['depthM'] is None)
(OUT/'earth-surface.json').write_text(json.dumps(earth,indent=2))
screenshot('earth-surface.png','#surface-lab')
drawer('compare')
wait('document.querySelectorAll("#earth-analogy-audit .audit-table tbody tr").length===9')
check('Earth expedition exposes the complete nine-factor M2 Test Inspector', ev('JSON.stringify(!document.querySelector("#earth-analogy-audit").closest("[hidden]")&&document.querySelector("#analogy-audit").hidden)'))
check('Both M2 instances have unique IDs and independent label references', ev('JSON.stringify((()=>{const a=[...document.querySelectorAll("[id]")].map(n=>n.id);return new Set(a).size===a.length&&document.querySelector("label[for=earth-bench-factor]")&&document.querySelector("#earth-bench-factor")})())'))
m2=export('#earth-analogy-audit [data-audit-export=json]')
check('Earth M2 export retains actual site, expedition session and reference-only target', m2['candidate']['earth']['id']==earth['context']['siteId'] and m2['analysisContext']['expeditionSessionId']==earth['context']['sessionId'] and m2['landing'] is None)
change('#earth-bench-factor','geometry')
check('Earth M2 factor switching updates the geometry inspector and evidence legend', ev('JSON.stringify(document.querySelector("#earth-analogy-audit [data-nasa-bench]").dataset.factor==="geometry"&&document.querySelector("#earth-analogy-audit [data-bench-legend]").children.length>0)'))
change('[data-earth-analysis-reference]','hyperarid-salt')
wait('document.querySelector("#earth-analogy-audit [data-m2-tools]").dataset.profileScenario==="hyperarid-salt"')
mars_ref=export('#earth-analogy-audit [data-audit-export=json]')
check('Choosing a Mars benchmark keeps the current Earth site and creates a separate M2 session', mars_ref['candidate']['earth']['id']==earth['context']['siteId'] and mars_ref['candidate']['target']['id']=='jezero' and mars_ref['mission']['id']!=m2['mission']['id'])
(OUT/'earth-m2.json').write_text(json.dumps(mars_ref,indent=2))
screenshot('earth-m2.png','#earth-analysis')
drawer('processes')
wait('document.querySelectorAll("#proc-table tr").length>=24')
check('Processes 72 h renders the active Earth site with archive/source labels', ev('JSON.stringify(!document.querySelector("#processes-panel").closest("[hidden]")&&document.querySelector("#proc-badge").textContent.includes("ARCHIVED")&&document.querySelector("#proc-focus").textContent.includes("Jezero"))'))
click('[data-preset=now]')
check('The process lab can load the active Earth forecast hour', ev('JSON.stringify(document.querySelector("#lab-wind-v").textContent.includes("m/s"))'))
screenshot('earth-processes.png','#processes-panel')
drawer('flight');click('[data-surface-ask]')
wait('document.querySelector("#copilot-log .assistant:not(.pending)")')
check('Earth Flight Director local fallback explains automatic regional evidence', ev('JSON.stringify(document.querySelector("#copilot-log").textContent.includes("Automatic DEM evidence"))'))
request=ev('JSON.stringify(qaRequests.at(-1))')
check('Provider context includes matching Earth M2, processes and automatic surface evidence', request['context']['surfaceAssessment']['mode']=='active-location-evidence' and request['context']['analogyAudit']['analysisContext']['earthSiteId']==earth['context']['siteId'] and request['context']['processes'])
(OUT/'earth-provider-request.json').write_text(json.dumps(request,indent=2))
close_drawer();click('[data-exp-step="3"]');click('#exp-reviewed');click('[data-exp-confirm]');click('[data-exp-play]');click('[data-exp-finish]')
closed=export('[data-exp-export=json]')
check('Closing an Earth expedition freezes matching automatic surface evidence', closed['surfaceAssessment']['context']['sessionId']==closed['sessionId'] and closed['surfaceAssessment']['automatic']['terrain']['source'])
(OUT/'closed-earth.json').write_text(json.dumps(closed,indent=2))
click('[data-site=atacama]')
wait('document.querySelector("#surface-lab").dataset.siteId==="atacama"&&document.querySelector("#earth-expedition").dataset.siteId==="atacama"')
drawer('compare');wait('document.querySelectorAll("#earth-analogy-audit .audit-table tbody tr").length===9')
atacama=export('#earth-analogy-audit [data-audit-export=json]')
check('Switching Earth sites replaces M2 site identity without borrowing the previous run', atacama['candidate']['earth']['id']=='atacama' and atacama['analysisContext']['expeditionSessionId']!=earth['context']['sessionId'])
close_drawer();change('[data-exp-reference]','lava-tube')
wait('document.querySelector("#surface-lab").dataset.siteId==="la-corona"&&document.querySelector("[data-surface-cavity]").textContent.includes("La Corona")')
drawer('flight');tube=export('[data-surface-export=json]')
check('La Corona automatically shows documentary tube evidence without lunar dimensions', tube['automatic']['cavityGeometryKind']=='documented-context-no-geometry' and tube['cavity']['inputs']['depthM'] is None and tube['automatic']['cavityContextSource'])
close_drawer();click('[data-scenario=lava-tube]')
wait('document.querySelector("#surface-lab").dataset.body==="moon"&&document.querySelector("#surface-lab").dataset.siteId==="marius-hills"')
drawer('flight');marius=export('[data-surface-export=json]')
check('Marius destination automatically loads published 55 by 49 by 40 m pit geometry', [marius['cavity']['inputs'][k] for k in ['lengthM','widthM','depthM']]==[55,49,40] and marius['cavity']['source'])
(OUT/'marius-surface.json').write_text(json.dumps(marius,indent=2))
md=export('[data-surface-export=md]','md');(OUT/'marius-surface.md').write_text(md)
check('Automatic surface Markdown preserves published geometry and explicit unresolved roof/material data', '55 × 49 m' in md and 'stability remain unknown' in md)
drawer('compare');wait('document.querySelectorAll("#analogy-audit .audit-table tbody tr").length===9')
destination=export('#analogy-audit [data-audit-export=json]')
check('Destination M2 remains intact and separate from the Earth audit', 'analysisContext' not in destination and destination['candidate']['earth']['id']=='la-corona' and destination['candidate']['target']['id']=='marius-hills')
act('qaDelayTarget=true');close_drawer();click('[data-scenario=hyperarid-salt]')
wait('document.querySelector("#surface-lab").dataset.siteId==="jezero"')
drawer('flight');jezero=export('[data-surface-export=json]')
check('Jezero never adopts Marius pit geometry or attribution', jezero['context']['body']=='mars' and jezero['cavity']['source'] is None and jezero['cavity']['inputs']['depthM'] is None)
act('qaMockAnswer=true;document.querySelector("#copilot-input").value="QA delayed rocks context";document.querySelector("#copilot-form").requestSubmit();document.querySelector("#view-terrain").click()')
wait('document.querySelector("#surface-lab").dataset.body==="earth"&&document.querySelector("#earth-expedition").dataset.sessionId')
drawer('flight')
wait('qaReplyCompleted>0&&!document.querySelector("#copilot-log .assistant")')
check('A delayed destination provider answer is discarded after switching to the Earth run', ev('JSON.stringify(!document.querySelector("#copilot-log").textContent.includes("QA transport response for jezero"))'))
drawer('compare');wait('document.querySelectorAll("#earth-analogy-audit .audit-table tbody tr").length===9')
cmd('viewport','--page',PAGE,'--width','390','--height','844','--mobile')
check('Earth analysis drawer fits a mobile viewport', ev('JSON.stringify(document.querySelector("#sim-drawer").getBoundingClientRect().width<=innerWidth+1&&document.documentElement.scrollWidth<=innerWidth+1)'))
screenshot('mobile-earth-m2.png','#earth-analysis')
check('No uncaught browser errors or unhandled rejections occurred', ev('JSON.stringify(qaErrors.length===0)'))
(OUT/'browser.json').write_text(json.dumps({'complete':True,'checks':checks,'passed':len(checks),'method':'Owned Orca page; actual UI handlers, real published files and export Blobs. Weather/provider availability and one delayed provider reply use explicit local transport fixtures.'},indent=2))
print(json.dumps({'passed':len(checks),'output':str(OUT)}),flush=True)
