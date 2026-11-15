#!/usr/bin/env python3
"""Owned Orca page integration checks through UI handlers and actual export Blobs.

Usage: python qa-surface-assessment.py PAGE_ID http://localhost:8238/
Local browser fixtures suppress weather/provider network calls; AI is a transport mock.
No rover/controller/time or geology source values are changed by the fixture.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

PAGE, URL = sys.argv[1:3]
OUT = Path(__file__).resolve().parents[1] / 'docs/evidencias/surface-assessment'
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def cmd(*args):
    p = subprocess.run(['orca-ide', *args, '--json'], capture_output=True, text=True, timeout=58)
    d = json.loads(p.stdout)
    if not d.get('ok'):
        raise RuntimeError(d)
    return d['result']


def ev(js):
    v = cmd('eval', '--page', PAGE, '--expression', js)['result']
    return json.loads(v) if isinstance(v, str) else v


def act(js):
    return ev('(()=>{' + js + ';return JSON.stringify(true)})()')


def click(selector):
    assert ev('(()=>{const e=document.querySelector(' + json.dumps(selector) + ');if(!e||e.disabled)throw Error("Unavailable control");e.click();return JSON.stringify(true)})()')


def fill(selector, value):
    act('const e=document.querySelector(' + json.dumps(selector) + ');e.value=' + json.dumps(str(value)) + ';e.dispatchEvent(new Event("change",{bubbles:true}))')


def wait(condition):
    assert ev('(async()=>{const end=Date.now()+25000;while(Date.now()<end){if(' + condition + ')return JSON.stringify(true);await new Promise(r=>setTimeout(r,80))}return JSON.stringify(false)})()'), condition


def check(name, result):
    assert result, name
    checks.append({'name': name, 'passed': True})
    (OUT / 'browser.json').write_text(json.dumps({'page': PAGE, 'url': URL, 'complete': False, 'checks': checks}, indent=2))


def export(selector, fmt='json'):
    text = ev('(async()=>{const i=window.qaBlobs.length;document.querySelector(' + json.dumps(selector) + ').click();return JSON.stringify(await window.qaBlobs[i].text())})()')
    return json.loads(text) if fmt == 'json' else text


def screenshot(name, selector='#decision-workspace'):
    act('document.querySelector(' + json.dumps(selector) + ').scrollIntoView({block:"start"})')
    p = cmd('screenshot', '--page', PAGE)['path'].replace('\\', '/')
    if len(p) > 1 and p[1] == ':':
        p = '/mnt/' + p[0].lower() + p[2:]
    shutil.copyfile(p, OUT / name)


def fixture(ai=False, fallback=False):
    # A new top-level Blob document runs the real unmodified modules. Only external
    # API availability, provider transport, export observation and optional WebGL vary.
    hook = '''window.qaBlobs=[];window.qaRequests=[];const create=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b instanceof Blob)qaBlobs.push(b);return create(b)};const anchor=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!this.download)return anchor.call(this)};const original=fetch.bind(window);window.fetch=async(input,options)=>{const path=new URL(String(input),document.baseURI).pathname;if(path==='/api/health')return new Response(JSON.stringify({status:'ok',providers:{ai:AI}}),{headers:{'Content-Type':'application/json'}});if(path==='/api/copilot'){const body=JSON.parse(options.body);qaRequests.push(body);if(body.question.includes('delayed'))await new Promise(r=>setTimeout(r,1000));return new Response(JSON.stringify({answer:'LOCAL QA TRANSPORT '+body.context.surfaceAssessment.siteId+' revision '+body.context.surfaceAssessment.revision,provider:'openai',generatedAt:new Date().toISOString(),grounded:['surfaceAssessment.siteId'],disclaimer:'Local transport mock; not an AI answer.'}),{headers:{'Content-Type':'application/json'}})}if(path.startsWith('/api/'))return new Response('{}',{status:503});return original(input,options)};'''.replace('AI', json.dumps('openai' if ai else 'none'))
    if fallback:
        hook += "const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args)};"
    expression = '(async()=>{const base=' + json.dumps(URL) + ',html=await(await fetch(base)).text();const injected=html.replace("<head>",' + json.dumps('<head><base href="' + URL + '"><script>' + hook + '</script>') + ');const url=URL.createObjectURL(new Blob([injected],{type:"text/html"}));setTimeout(()=>location.href=url,60);return JSON.stringify(true)})()'
    assert ev(expression)
    wait('location.protocol==="blob:"&&document.querySelectorAll(".scenario-button").length===4')
    cmd('viewport', '--page', PAGE, '--width', '1440', '--height', '1050')


cmd('goto', '--page', PAGE, '--url', URL)
wait('document.querySelectorAll(".scenario-button").length===4')
fixture()
click('#view-terrain')
wait('document.querySelector("#earth-expedition").dataset.sessionId&&document.querySelector("#surface-lab").dataset.contextKey?.includes(document.querySelector("#earth-expedition").dataset.sessionId)')
check('Flight Director is visible outside the destination-only grid in Terrain 3D', ev('JSON.stringify(!document.querySelector("#flight-director").closest("[hidden]")&&!document.querySelector("#flight-director").closest("#ares-grid"))'))
empty = export('[data-surface-export=json]')
check('new Earth estimates retain unavailable geometry/material instead of zero', empty['rock']['volumeM3']['nominal'] is None and empty['cavity']['stability'] is None)
click('[data-surface-example]')
rock = export('[data-surface-export=json]')
check('explicit rock hypothesis computes conditional volume, mass and scale with Earth identity', rock['rock']['massKg']['min'] > 0 and rock['rock']['volumeM3']['min'] < rock['rock']['volumeM3']['nominal'] < rock['rock']['volumeM3']['max'] and rock['context']['body'] == 'earth' and rock['rock']['scale']['samplesAcross'] < 1)
(OUT / 'earth-estimates.json').write_text(json.dumps(rock, indent=2))
md = export('[data-surface-export=md]', 'md'); (OUT / 'earth-estimates.md').write_text(md)
check('actual Markdown export preserves site, assumptions and source limits', rock['context']['sessionId'] in md and 'Conditional mass' in md and 'operator hypothesis' in md)
click('[data-surface-ask]'); wait('document.querySelector("#copilot-log .assistant:not(.pending)")')
check('Terrain Flight Director local fallback answers from the actual rock estimate', ev('JSON.stringify(document.querySelector("#copilot-log").textContent.includes("Rock [operator hypothesis]")&&document.querySelector("#copilot-provider").textContent.includes("LOCAL RULES"))'))
fill('[data-surface-input="rock.lengthM"]', 2)
changed = export('[data-surface-export=json]')
check('geometry edits change volume and SVG dimensions and invalidate prior conversation', changed['rock']['volumeM3']['nominal'] > rock['rock']['volumeM3']['nominal'] and ev('JSON.stringify(!document.querySelector("#copilot-log .assistant")&&document.querySelector("#surface-lab svg").textContent.includes("2 m long"))'))
fill('[data-surface-input="rock.lengthM"]', -2)
invalid = export('[data-surface-export=json]')
check('invalid dimensions show errors and suppress plausible estimates', not invalid['rock']['valid'] and invalid['rock']['volumeM3']['nominal'] is None and ev('JSON.stringify(!!document.querySelector("#surface-lab [role=alert]"))'))
fill('[data-surface-input="rock.lengthM"]', 2)
click('[data-surface-shape=cavity]'); click('[data-surface-example]')
pit = export('[data-surface-export=json]')
check('Earth cavity estimates stay hypothetical with unknown roof and connected volume', pit['cavity']['openingAreaM2']['nominal'] > 0 and pit['cavity']['pitEnvelopeM3']['nominal'] > 0 and pit['cavity']['source'] is None and pit['cavity']['connectedCaveVolumeM3'] is None and pit['cavity']['stability'] is None)
click('[data-surface-ask]'); wait('document.querySelector("#copilot-log .assistant:not(.pending)")')
check('Flight Director explains cavity geometry without inventing local detection', ev('JSON.stringify(document.querySelector("#copilot-log").textContent.includes("No cavity has been detected"))'))
screenshot('earth-decision-workspace.png')
click('[data-exp-step="3"]'); click('#exp-reviewed'); click('[data-exp-confirm]'); click('[data-exp-play]'); click('[data-exp-inspect]'); click('[data-exp-finish]')
closed = export('[data-exp-export=json]'); closed_md = export('[data-exp-export=md]', 'md')
check('closed Earth JSON/MD include matching model hypotheses and site/session snapshot', closed['surfaceAssessment']['context']['sessionId'] == closed['sessionId'] and closed['surfaceAssessment']['cavity']['inputs']['depthM'] == 4 and 'Rocks and cavities' in closed_md)
fill('[data-surface-input="cavity.depthM"]', 5)
again = export('[data-exp-export=json]')
check('later planning edits cannot rewrite closed Earth evidence', again['surfaceAssessment'] == closed['surfaceAssessment'] and again['cutoffAtUTC'] == closed['cutoffAtUTC'])
(OUT / 'closed-earth-expedition.json').write_text(json.dumps(closed, indent=2))
(OUT / 'closed-earth-expedition.md').write_text(closed_md)
click('[data-scenario="lava-tube"]'); wait('document.querySelector("#landing-panel").dataset.phase==="ready"&&document.querySelector("#surface-lab").dataset.contextKey?.includes("marius-hills")')
click('[data-preparation-close]')
destination_empty = export('[data-surface-export=json]')
check('destination switch keeps Flight Director visible and clears Earth hypotheses', destination_empty['rock']['inputs']['lengthM'] is None and destination_empty['cavity']['inputs']['depthM'] is None and ev('JSON.stringify(!document.querySelector("#flight-director").closest("[hidden]"))'))
click('[data-surface-shape=cavity]'); click('[data-surface-reference]')
published = export('[data-surface-export=json]')
check('Marius uses its own lunar published stereo dimensions and citation', published['context']['body'] == 'moon' and published['context']['siteId'] == 'marius-hills' and published['cavity']['kind'] == 'published-stereo-estimate' and published['cavity']['inputs']['depthM'] == 40 and published['cavity']['source']['source'].startswith('https://lroc.') and published['cavity']['pitEnvelopeM3']['min'] is None)
(OUT / 'marius-estimates.json').write_text(json.dumps(published, indent=2))
click('[data-surface-ask]'); wait('document.querySelector("#copilot-log .assistant:not(.pending)")')
check('destination local assistant explains the cited pit rather than Earth geometry', ev('JSON.stringify(document.querySelector("#copilot-log").textContent.includes("published-stereo-estimate")&&document.querySelector("#copilot-log").textContent.includes("roof stability are unavailable"))'))
screenshot('marius-decision-workspace.png')
fill('[data-surface-input="cavity.depthM"]', 41)
edited = export('[data-surface-export=json]')
check('editing a published dimension removes publication attribution', edited['cavity']['kind'] == 'operator-hypothesis' and edited['cavity']['source'] is None)
fixture(ai=True)
click('#view-terrain'); wait('document.querySelector("#earth-expedition").dataset.sessionId&&document.querySelector("[data-surface-example]")')
click('[data-surface-example]'); fill('#copilot-input', 'delayed rock assessment'); act('document.querySelector("#copilot-form").requestSubmit()')
wait('qaRequests.length===1')
fill('[data-surface-input="rock.lengthM"]', 3)
fill('#copilot-input', 'Evaluate the rock estimate'); act('document.querySelector("#copilot-form").requestSubmit()'); wait('qaRequests.length===2&&document.querySelector("#copilot-log .assistant:not(.pending)")')
act('window.qaFirstReplySettled=false;setTimeout(()=>window.qaFirstReplySettled=true,1300)'); wait('qaFirstReplySettled')
requests = ev('JSON.stringify(qaRequests)'); (OUT / 'provider-requests.json').write_text(json.dumps(requests, indent=2))
check('actual AI POST receives active Earth estimates with explicit assumption and null cavity data', requests[-1]['context']['surfaceAssessment']['rock']['axesM'][0] == 3 and requests[-1]['context']['surfaceAssessment']['cavity']['stability'] is None and requests[-1]['context']['domain'] == 'earth-field-expedition')
check('estimate revision clears history and late provider reply cannot publish', requests[-1]['history'] == [] and ev('JSON.stringify(document.querySelectorAll("#copilot-log .assistant").length===1&&!document.querySelector("#copilot-log").textContent.includes("revision 1"))'))
fixture(fallback=True)
cmd('viewport', '--page', PAGE, '--width', '390', '--height', '844', '--mobile')
click('#view-terrain'); wait('document.querySelector("#earth-expedition").dataset.sessionId&&document.querySelector("[data-surface-example]")')
click('[data-surface-example]'); mobile = export('[data-surface-export=json]')
check('mobile WebGL fallback retains numerical estimates, schematics, Director and export', mobile['rock']['volumeM3']['nominal'] > 0 and ev('JSON.stringify(!document.querySelector("#scene-fallback").hidden&&!!document.querySelector("#surface-lab svg")&&!document.querySelector("#flight-director").closest("[hidden]")&&document.querySelector("#decision-workspace").scrollWidth<=document.querySelector("#decision-workspace").clientWidth+1)'))
screenshot('mobile-fallback.png', '#surface-lab')
(OUT / 'browser.json').write_text(json.dumps({'page': PAGE, 'url': URL, 'complete': True, 'checks': checks, 'passed': len(checks), 'provider': 'Local transport mock, no external AI call', 'controls': 'Actual DOM handlers and Blob exports; no controller/physics override'}, indent=2))
print(json.dumps({'complete': True, 'passed': len(checks)}))
