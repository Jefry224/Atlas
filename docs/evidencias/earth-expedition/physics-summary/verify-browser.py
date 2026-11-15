#!/usr/bin/env python3
"""Verify actual destination physics cards on an owned Orca page, without controller hooks.
Usage: /tmp/selene-merge-venv/bin/python verify-browser.py PAGE_ID [http://localhost:8231/]
The second case explicitly omits Earth DEM responses and target thermal metadata in-browser.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

PAGE = sys.argv[1]
URL = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8231/'
OUT = Path(__file__).resolve().parent
results = {'page': PAGE, 'url': URL, 'cases': [], 'complete': False}


def cmd(*args):
    process = subprocess.run(['orca-ide', *args, '--json'], capture_output=True, text=True, timeout=58)
    data = json.loads(process.stdout)
    if not data.get('ok'):
        raise RuntimeError(data)
    return data['result']


def ev(js):
    value = cmd('eval', '--page', PAGE, '--expression', js)['result']
    return json.loads(value) if isinstance(value, str) else value


def act(js):
    return ev('(()=>{' + js + ';return JSON.stringify(true)})()')


def wait(condition):
    assert ev('(async()=>{const end=Date.now()+20000;while(Date.now()<end){if(' + condition + ')return JSON.stringify(true);await new Promise(r=>setTimeout(r,100))}return JSON.stringify(false)})()'), condition


def shot(name):
    act('document.querySelector("#physics-plain").scrollIntoView({block:"center"})')
    path = cmd('screenshot', '--page', PAGE)['path'].replace('\\', '/')
    if len(path) > 1 and path[1] == ':':
        path = '/mnt/' + path[0].lower() + path[2:]
    shutil.copyfile(path, OUT / name)


def cards():
    return ev('JSON.stringify({phase:document.querySelector("#landing-panel").dataset.phase,earthThermal:document.querySelector("#phys-thermal-earth").dataset.level,targetThermal:document.querySelector("#phys-thermal-target").dataset.level,pitch:document.querySelector("#phys-pitch").textContent,roll:document.querySelector("#phys-roll").textContent,cards:[...document.querySelector("#physics-plain").children].map(e=>({label:e.querySelector(".k").textContent,title:e.querySelector(".v").textContent,detail:e.querySelector(".d").textContent,tone:e.querySelector(".v").dataset.tone||null}))})')


def select():
    act('document.querySelector("[data-scenario=hyperarid-salt]").click()')
    wait('document.querySelectorAll(".landing-zone").length===3&&document.querySelector("#physics-plain").textContent.includes("REGIONAL TILT / DEM MODEL")')
    act('document.querySelector("[data-preparation-close]").click()')


cmd('tab', 'switch', '--page', PAGE)
cmd('goto', '--page', PAGE, '--url', URL)
cmd('viewport', '--page', PAGE, '--width', '1440', '--height', '1000')
wait('document.querySelectorAll(".scenario-button").length===4')
select()
wait('document.querySelector("#phys-thermal-target").dataset.level==="critical"&&document.querySelector("#phys-pitch").textContent!=="—"')
normal = cards()
assert normal['targetThermal'] == 'critical'
assert normal['cards'][1]['title'].endswith('Target critical')
assert 'outside the illustrative operating range' in normal['cards'][1]['detail']
assert 'within' not in normal['cards'][1]['detail']
assert 'not a local stability certification' in normal['cards'][2]['detail']
assert normal['cards'][2]['tone'] != 'good'
assert 'Sin riesgo de vuelco' not in json.dumps(normal)
results['cases'].append({'case': 'Published Jezero destination data, real physics/DOM', 'passed': True, 'observed': normal})
shot('published-destination.png')

# A top-level document keeps real visibility/physics scheduling. Only missing data is injected.
hook = """const original=window.fetch.bind(window);window.fetch=async(input,options)=>{const path=new URL(String(input),document.baseURI).pathname;if(path.startsWith('/assets/data/scenarios/earth/')||path==='/assets/data/atacama.json')return new Response('',{status:404});const response=await original(input,options);if(path==='/assets/data/scenarios/targets/jezero.json'&&response.ok){const data=await response.json();delete data.thermal;return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})}return response};"""
# Build the HTML string with literal quotes using a structured JS expression.
js = '(async()=>{const base=' + json.dumps(URL) + ',html=await(await fetch(base)).text();const opening=' + json.dumps('<head><base href="' + URL + '"><script>') + ';const injected=html.replace("<head>",opening+' + json.dumps(hook) + '+' + json.dumps('</script>') + ');const url=URL.createObjectURL(new Blob([injected],{type:"text/html"}));setTimeout(()=>location.href=url,80);return JSON.stringify(true)})()'
assert ev(js)
wait('location.protocol==="blob:"&&document.querySelectorAll(".scenario-button").length===4')
select()
wait('document.querySelector("#phys-thermal-target").dataset.level==="unknown"&&document.querySelector("#physics-plain").textContent.includes("Regional tilt unavailable")')
missing = cards()
assert missing['pitch'] == missing['roll'] == '—'
assert missing['targetThermal'] == 'unknown'
assert missing['cards'][2]['title'] == 'Regional tilt unavailable'
assert missing['cards'][2]['tone'] is None
assert 'Pitch: unavailable; roll: unavailable' in missing['cards'][2]['detail']
assert 'within' not in missing['cards'][1]['detail']
assert 'no joint nominal conclusion is supported' in missing['cards'][1]['detail']
results['cases'].append({'case': 'Explicit missing-data fixture: Earth DEM responses 404 and target thermal field omitted; original physics and UI unchanged', 'passed': True, 'observed': missing})
shot('missing-destination-inputs.png')
results['complete'] = True
(OUT / 'browser.json').write_text(json.dumps(results, indent=2))
print(json.dumps({'cases': len(results['cases']), 'complete': True}), flush=True)
