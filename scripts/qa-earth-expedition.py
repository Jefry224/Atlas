#!/usr/bin/env python3
"""Real Orca browser acceptance through rendered controls and UI export Blobs.
No engine/controller hooks or time acceleration beyond the product's SIM x20.
Usage: python3 scripts/qa-earth-expedition.py PAGE_ID [http://localhost:8248/] [--advanced]
Requires the local fixture server for missing/delayed/provider checks. No provider credentials/calls.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

PAGE = sys.argv[1]
URL = next((x for x in sys.argv[2:] if x.startswith('http')), 'http://localhost:8248/')
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/evidencias/earth-expedition'
OUT.mkdir(parents=True, exist_ok=True)
CLI = os.environ.get('ORCA_CLI_COMMAND', 'orca-ide')
checks = []
mode = 'missing-switch' if '--missing-switch' in sys.argv else 'advanced' if '--advanced' in sys.argv else 'core'


def cmd(*args):
    p = subprocess.run([CLI, *args, '--json'], capture_output=True, text=True, timeout=58)
    data = json.loads(p.stdout)
    if not data.get('ok'):
        raise RuntimeError(data)
    return data['result']


def ev(js):
    value = cmd('eval', '--page', PAGE, '--expression', js)['result']
    return json.loads(value) if isinstance(value, str) else value


def act(js):
    return ev('(()=>{' + js + ';return JSON.stringify(true)})()')


def wait(js, seconds=20):
    result = ev('(async()=>{const end=Date.now()+' + str(seconds * 1000) + ';while(Date.now()<end){if(' + js + ')return JSON.stringify(true);await new Promise(r=>setTimeout(r,100))}return JSON.stringify(false)})()')
    assert result, js


def ck(name, result=True):
    assert result, name
    checks.append(name)
    print('PASS', name, flush=True)
    (OUT / f'browser-{mode}.json').write_text(json.dumps({'page': PAGE, 'url': URL, 'checks': checks, 'passed': len(checks), 'complete': False}, indent=2))


def click(selector):
    return act('const e=document.querySelector(' + json.dumps(selector) + ');if(!e||e.disabled)throw new Error("Control unavailable: "+' + json.dumps(selector) + ');e.click()')


def fill(selector, value):
    return act('const e=document.querySelector(' + json.dumps(selector) + ');e.value=' + json.dumps(str(value)) + ';e.dispatchEvent(new Event("change",{bubbles:true}))')


def phase(value):
    wait('document.querySelector("#earth-expedition").dataset.phase===' + json.dumps(value),45)


def hooks():
    act('window.expeditionBlobs=[];window.expeditionDownloads=[];const original=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{expeditionBlobs.push(b);return original(b)};const anchor=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)expeditionDownloads.push(this.download);return anchor.call(this)}')


def report():
    return ev('(async()=>{const i=expeditionBlobs.length;document.querySelector("[data-exp-export=json]").click();return JSON.stringify(JSON.parse(await expeditionBlobs[i].text()))})()')


def mission():
    return ev('(async()=>{const i=expeditionBlobs.length;document.querySelector("#export-mission").click();return JSON.stringify(JSON.parse(await expeditionBlobs[i].text()))})()')


def shot(name):
    act('document.querySelector("#earth-expedition").scrollIntoView({block:"start"})')
    path = cmd('screenshot', '--page', PAGE)['path'].replace('\\', '/')
    if len(path) > 1 and path[1] == ':':
        path = '/mnt/' + path[0].lower() + path[2:]
    shutil.copyfile(path, OUT / name)


def boot(query=''):
    cmd('tab', 'switch', '--page', PAGE)
    cmd('goto', '--page', PAGE, '--url', URL + query)
    cmd('viewport', '--page', PAGE, '--width', '1440', '--height', '1000')
    wait('document.querySelectorAll(".scenario-button").length===4')
    hooks()


def earth(site='atacama'):
    click('[data-site=' + site + ']')
    if ev('JSON.stringify(document.querySelector("#view-terrain").getAttribute("aria-pressed")!=="true")'):
        click('#view-terrain')
    wait('document.querySelector("#earth-expedition").dataset.siteId===' + json.dumps(site) + '&&document.querySelector("#earth-expedition").dataset.phase==="draft"')


def confirm():
    click('[data-exp-step="3"]')
    ck('confirmation starts disabled without explicit operator review', ev('JSON.stringify(document.querySelector("[data-exp-confirm]").disabled)'))
    click('#exp-reviewed')
    click('[data-exp-confirm]')
    phase('ready')


def start_inspect():
    click('[data-exp-play]')
    phase('inspection')
    click('[data-exp-inspect]')
    phase('paused')


if mode == 'core':
    boot()
    earth()
    ck('14-site catalogue, four scenarios, Discovery and Mission Dossier navigation preserved', ev(r'JSON.stringify(document.querySelectorAll(".site-row").length===14&&document.querySelectorAll(".scenario-button").length===4&&!!document.querySelector("a[href=\"discovery.html\"]")&&!!document.querySelector("a[href=\"dossier.html\"]"))'))
    click('#mission-play')
    ck('shared play cannot bypass Earth preparation', report()['startedAtUTC'] is None)
    fill('#exp-objective', 'sampling')
    fill('[data-exp-input=payloadKg]', 30)
    click('[data-exp-step="2"]')
    ck('paired Earth DEM evidence and native resolution are visible', '37.5 m grid spacing' in ev('JSON.stringify(document.querySelector(".exp-dem-strip").textContent)'))
    act('document.querySelector("[data-exp-map]").focus()')
    cmd('keypress', '--page', PAGE, '--key', 'ArrowLeft')
    ck('keyboard map changes the actual chosen starting stop', report()['preparation']['stops'][0]['x'] != 0)
    fill('[data-exp-input=stop-x]', -75)
    fill('[data-exp-input=stop-z]', 0)
    click('[data-exp-stop="1"]')
    fill('[data-exp-input=stop-x]', 2000)
    ck('out-of-window plan is blocked with an explicit reason', ev('JSON.stringify(document.querySelector("[data-exp-validation]").dataset.expValidation==="invalid"&&document.querySelector(".exp-plan-status").textContent.includes("outside"))'))
    fill('[data-exp-input=stop-x]', 75)
    fill('[data-exp-input=stop-z]', 0)
    ck('edited valid traverse drives the actual plan', ev('JSON.stringify(document.querySelector("[data-exp-validation]").dataset.expValidation==="valid")'))
    shot('desktop-plan.png')
    confirm()
    r = report()
    ck('confirmation holds rover at the selected Earth origin and SIM time zero', r['rover']['x'] == -75 and r['rover']['z'] == 0 and r['rover']['simSeconds'] == 0 and r['confirmedAtUTC'] and r['startedAtUTC'] is None)
    start_inspect()
    first = report()
    ck('inspection is location-aware DEM evidence with UTC, source and material unknown', first['inspections'][0]['position']['x'] == -75 and first['inspections'][0]['terrain']['demId'] == first['dem']['identity'] and first['inspections'][0]['atUTC'] and first['inspections'][0]['materialMeasurement'] is None)
    click('[data-exp-play]')
    wait('parseFloat(document.querySelector("[data-exp-metrics]").textContent)>3')
    click('#mission-play')
    phase('paused')
    before = report()
    ev('(async()=>{await new Promise(r=>setTimeout(r,650));return JSON.stringify(true)})()')
    after = report()
    ck('shared pause freezes SIM time, path and energy', before['rover'] == after['rover'] and before['path'] == after['path'] and before['observations'] == after['observations'])
    click('#mission-play')
    phase('running')
    phase('inspection')
    r = report()
    ck('Auto reaches the edited inspection stop instead of the legacy loop', abs(r['rover']['x'] - 75) <= 5 and abs(r['rover']['z']) < 1)
    fill('[data-exp-note]', 'Acquire field stereo before selecting sampling access.')
    click('[data-exp-inspect]')
    phase('review')
    click('[data-exp-finish]')
    phase('finished')
    r = report()
    (OUT / 'completed-expedition.json').write_text(json.dumps(r, indent=2))
    md = ev('(async()=>{const i=expeditionBlobs.length;document.querySelector("[data-exp-export=md]").click();return JSON.stringify(await expeditionBlobs[i].text())})()')
    (OUT / 'completed-expedition.md').write_text(md)
    ck('complete report preserves objective, load, confirmed route, path, both inspections and next validation decision', r['objective']['id'] == 'sampling' and r['preparation']['config']['payloadKg'] == 30 and len(r['inspections']) == 2 and len(r['path']) > 1 and r['decision']['status'] == 'Advance to targeted validation' and r['finishedAtUTC'] and r['sessionId'] in md)
    ck('planetary benchmark uses four published topography components with scale caveats', r['benchmark']['scenario']['targetId'] == 'jezero' and len(r['benchmark']['comparison']['components']) == 4 and 'not planetary similarity' in ' '.join(r['limitations']))
    exported = mission()
    ck('legacy JSON receives additive Earth evidence with authoritative site/grid identity and no destination tracking', exported['site']['id'] == r['site']['id'] == 'atacama' and exported['dem']['identity'] == r['dem']['identity'] and exported['earthExpedition']['sessionId'] == r['sessionId'] and exported['landing'] is None and exported['analogyDossier'] is None and exported['scenario'] is None)
    shot('desktop-findings.png')
    old_id = r['sessionId']
    click('#mission-reset')
    phase('draft')
    ck('reset invalidates confirmation with a new Earth session and retained local report', report()['sessionId'] != old_id and report()['confirmedAtUTC'] is None and 'Previous expedition reports' in ev('JSON.stringify(document.querySelector("#earth-expedition").textContent)'))
    earth('merzouga')
    ck('unpaired catalogue site explains its missing quantitative benchmark', report()['benchmark']['comparison'] is None)
    click('[data-exp-step="2"]')
    click('[data-exp-stop="1"]')
    fill('[data-exp-input=stop-x]', 300)
    fill('[data-exp-input=stop-z]', 0)
    confirm()
    start_inspect()
    click('#pilot-manual')
    click('[data-exp-play]')
    act('document.querySelector("#atlas-scene").focus()')
    cmd('keypress', '--page', PAGE, '--key', 'ArrowUp')
    # Use the keyboard drive-pad pulse to sustain a real manual movement without changing engine state.
    click('[data-drive=forward]')
    click('#mission-play')
    phase('paused')
    partial = report()
    ck('manual drive changes actual pose/path and consumes the expedition load model', partial['rover']['mode'] == 'manual' and partial['rover']['distanceM'] > 0 and partial['observations']['energyUsedPct'] > 0)
    click('[data-exp-finish]')
    partial = report()
    (OUT / 'incomplete-expedition.json').write_text(json.dumps(partial, indent=2))
    partial_md = ev('(async()=>{const i=expeditionBlobs.length;document.querySelector("[data-exp-export=md]").click();return JSON.stringify(await expeditionBlobs[i].text())})()')
    (OUT / 'incomplete-expedition.md').write_text(partial_md)

    ck('partial report retains planned but uninspected stops and calls for revision', len(partial['inspections']) == 1 and partial['decision']['status'] == 'Revise the reconnaissance plan')
    # All published paired Earth windows, including those outside the fourteen catalogue sites.
    click('#mission-reset')
    for scenario, site_id in [('lava-tube', 'la-corona'), ('wind-canyon', 'wadi-rum'), ('polar-shadow', 'wright-valley'), ('hyperarid-salt', 'atacama')]:
        fill('[data-exp-reference]', scenario)
        wait('document.querySelector("#earth-expedition").dataset.siteId===' + json.dumps(site_id) + '&&document.querySelector("#earth-expedition").dataset.phase==="draft"')
        ck('paired Earth window available: ' + site_id, report()['dem']['gridSize'] == 65 and report()['benchmark']['scenario']['id'] == scenario)
    # Confirm destination preparation/contact/deployment and exporters remain separate.
    click('[data-scenario=hyperarid-salt]')
    wait('document.querySelector("[data-preparation-dialog]").open&&document.querySelectorAll(".landing-zone").length===3')
    click('[data-preparation-next]')
    click('[data-preparation-confirm]')
    click('[data-flight-rate="4"]')
    click('[data-flight-action]')
    wait('document.querySelector("#landing-panel").dataset.phase==="contact"', 45)
    d = mission()
    ck('destination still descends to explicit contact with Earth rover held and no Earth expedition contamination', d['landing']['runs']['target']['phase'] == 'contact' and d['rover']['distanceM'] == 0 and d['earthExpedition'] is None and d['site']['id'] == d['scenario']['earthId'] == 'atacama' and d['dem']['center'])
    click('[data-flight-action]')
    wait('document.querySelector("#landing-panel").dataset.phase==="exploration"', 35)
    click('#mission-play')
    d = mission()
    ck('destination deployment still releases its own Earth test rover and mirrored target rover', d['landing']['explorationOrigins']['earth'] is not None and d['targetRover'] is not None)
    i = ev('JSON.stringify(expeditionBlobs.length)')
    click('[data-audit-export=json]')
    click('[data-audit-export=md]')
    click('[data-m2-xlsx]')
    wait('expeditionBlobs.length>=' + str(i + 3))
    ck('M2 dossier JSON, Markdown and Excel export controls still produce real output Blobs')
    click('#view-terrain')
    wait('document.querySelector("#earth-expedition").dataset.phase==="draft"')
    ck('returning to Earth restores its independent draft instead of destination flight state', report()['startedAtUTC'] is None and report()['inspections'] == [])

elif mode == 'missing-switch':
    boot('?qa=missing-earth')
    earth('merzouga')
    assert report()['dem'] is not None
    earth('dumont')
    ck('supported to missing Earth DEM clears stale terrain execution and report evidence', report()['dem'] is None and report()['inspections'] == [] and report()['startedAtUTC'] is None)
    boot()
    earth()
    confirm()
    start_inspect()
    click('[data-exp-finish]')
    ck('closed partial expedition points to its report and exposes no resume or next-stop action', ev('JSON.stringify(document.querySelector("[data-exp-next]").textContent.includes("Evidence closed with 1/2")&&document.querySelector("[data-exp-play]").disabled&&document.querySelector("[data-exp-play]").textContent==="Expedition closed")'))
    click('#mission-reset')
    click('[data-exp-step="2"]')
    click('[data-exp-stop="1"]')
    fill('[data-exp-input=stop-x]', 40)
    fill('[data-exp-input=stop-z]', 0)
    confirm()
    start_inspect()
    click('[data-exp-play]')
    phase('inspection')
    click('[data-exp-inspect]')
    click('[data-exp-finish]')
    closure = ev('JSON.stringify({phase:document.querySelector("#earth-expedition").dataset.phase,sessionId:document.querySelector("#earth-expedition").dataset.sessionId,inspected:document.querySelector("#earth-expedition").dataset.inspected,hint:document.querySelector("[data-exp-next]").textContent,play:document.querySelector("[data-exp-play]").textContent,disabled:document.querySelector("[data-exp-play]").disabled})')
    ck('completed expedition uses the closed report hint instead of asking to finish again', closure['phase']=='finished' and closure['inspected']=='2' and closure['hint'].startswith('Evidence closed with 2/2') and closure['disabled'] and closure['play']=='Expedition closed')
    (OUT / 'closure-ui.json').write_text(json.dumps(closure, indent=2))



else:
    for scenario, site_id in [('lava-tube','la-corona'),('wind-canyon','wadi-rum')]:
        boot()
        click('[data-scenario='+scenario+']')
        wait('document.querySelectorAll(".landing-zone").length===3&&!document.querySelector("[data-flight-action]").disabled')
        click('[data-preparation-close]')
        exported=mission()
        ck('fresh destination export resolves Earth identity without a prior Earth visit: '+site_id, exported['site']['id']==exported['scenario']['earthId']==exported['dem']['id']==site_id and [exported['site']['lat'],exported['site']['lon']]==exported['dem']['center'] and exported['site']['catalogueReference'] is None and exported['earthExpedition'] is None)
    boot('?qa=missing-earth')
    earth('dumont')
    ck('missing Earth DEM blocks confirmation and driving with explicit evidence gaps', report()['dem'] is None and report()['startedAtUTC'] is None)
    click('[data-exp-step="3"]')
    click('#exp-reviewed')
    ck('missing Earth DEM cannot be confirmed', ev('JSON.stringify(document.querySelector("[data-exp-confirm]").disabled)'))
    earth('merzouga')
    ck('switching away from a missing DEM recovers a real supported Earth window', report()['dem'] is not None)
    earth('dumont')
    ck('switching from supported terrain to a missing DEM clears execution and exposes no stale Earth evidence', report()['dem'] is None and report()['inspections'] == [] and report()['startedAtUTC'] is None)

    boot('?qa=missing-target')
    earth()
    confirm()
    start_inspect()
    click('[data-exp-finish]')
    ck('missing target benchmark still permits supported Earth evidence and partial report', report()['benchmark']['targetDEM'] is None and len(report()['inspections']) == 1)
    fill('#copilot-input', 'What benchmark and analogy breakdowns are available?')
    click('#copilot-form button')
    wait('!document.querySelector("#copilot-form button").disabled')
    ck('local Earth copilot answers from this captured session and reports missing benchmark honestly', ev('JSON.stringify(document.querySelector("#copilot-provider").dataset.kind==="model"&&document.querySelector("#copilot-log").textContent.includes("missing"))'))

    boot('?qa=delayed')
    click('[data-site=atacama]')
    click('#view-terrain')
    click('[data-site=merzouga]')
    phase('draft')
    ev('(async()=>{await new Promise(r=>setTimeout(r,2500));return JSON.stringify(true)})()')
    r = report()
    ck('reverse DEM/benchmark completion cannot replace the newly selected site/session', r['site']['id'] == 'merzouga' and r['dem']['spacingMeters'] == 300)
    boot('?qa=copilot')
    earth()
    confirm()
    start_inspect()
    fill('#copilot-input', 'What evidence supports this sampling route?')
    click('#copilot-form button')
    wait('!document.querySelector("#copilot-form button").disabled')
    first = ev('(async()=>{return JSON.stringify((await(await fetch("/__qa/requests")).json()).at(-1))})()')
    ck('actual provider POST includes bounded Earth objective, plan, evidence, benchmark and limits without destination fields', first['context']['earthExpedition']['site']['id'] == 'atacama' and len(first['context']['earthExpedition']['inspections']) == 1 and first['context']['earthExpedition']['decision']['nextSteps'] and 'scenario' not in first['context'] and first['history'] == [])
    (OUT / 'provider-context.json').write_text(json.dumps(first['context'], indent=2))
    sys.path.insert(0, str(ROOT))
    from server import copilot, dossier
    flat = copilot.flatten_context(first['context'])
    required = ['earthExpedition.sessionId', 'earthExpedition.objective.id', 'earthExpedition.preparation.config.payloadKg', 'earthExpedition.preparation.stops[0].x', 'earthExpedition.inspections[0].sourceDEM', 'earthExpedition.inspections[0].elevationM', 'earthExpedition.decision.status', 'earthExpedition.decision.nextSteps', 'earthExpedition.benchmark.reason', 'earthExpedition.dem.nativeResolutionMeters', 'earthExpedition.limitations']
    prompts = [copilot.build_user_message('What should we validate?', flat), dossier.build_user_message(flat)]
    ck('actual provider context retains objective, evidence, decision, source scale and limits in both provider prompts', len(flat) <= 400 and all(path in flat and all(path in prompt for prompt in prompts) for path in required) and not any(path.startswith(('scenario.', 'landing.', 'analogyAudit.', 'targetRover.')) for path in flat))
    (OUT / 'provider-projection.json').write_text(json.dumps({'source': 'Actual locally captured browser POST context; no external provider call', 'schema': 'provider-context/1', 'retainedFields': len(flat), 'serializedBytes': len(json.dumps(flat).encode()), 'requiredPaths': required, 'copilotPrompt': True, 'dossierPrompt': True, 'destinationContamination': False, 'complete': True}, indent=2))

    fill('#copilot-input', 'delayed response to discard')
    click('#copilot-form button')
    earth('merzouga')
    fill('#copilot-input', 'Which site is active now?')
    click('#copilot-form button')
    wait('!document.querySelector("#copilot-form button").disabled')
    ev('(async()=>{await new Promise(r=>setTimeout(r,2800));return JSON.stringify(true)})()')
    requests = ev('(async()=>{return JSON.stringify(await(await fetch("/__qa/requests")).json())})()')
    last = requests[-1]
    ck('site switching clears provider history and suppresses a late answer from another expedition', last['context']['earthExpedition']['site']['id'] == 'merzouga' and last['history'] == [] and 'atacama' not in ev('JSON.stringify(document.querySelector("#copilot-log").textContent)'))
    fill('#copilot-input', 'delayed same-session response to discard')
    click('#copilot-form button')
    click('#view-globe')
    click('#view-terrain')
    phase('draft')
    ev('(async()=>{await new Promise(r=>setTimeout(r,2800));return JSON.stringify(true)})()')
    fill('#copilot-input', 'Fresh conversation after mode switch')
    click('#copilot-form button')
    wait('!document.querySelector("#copilot-form button").disabled')
    same = ev('(async()=>{return JSON.stringify((await(await fetch("/__qa/requests")).json()).at(-1))})()')
    ck('a late answer is suppressed after leaving and returning to the same Earth session', same['history'] == [])
    # Mobile and reduced motion are real browser media/device settings.
    boot()
    earth()
    fill('[data-exp-input=slopeLimitDeg]', 1)
    click('[data-exp-step="2"]')
    ck('no permitted direct traverse is rejected by actual regional slope evidence', ev('JSON.stringify(document.querySelector("[data-exp-validation]").dataset.expValidation==="invalid"&&document.querySelector(".exp-plan-status").textContent.includes("no permitted direct route"))'))
    click('[data-exp-step="1"]')
    fill('[data-exp-input=slopeLimitDeg]', 15)
    cmd('viewport', '--page', PAGE, '--width', '390', '--height', '844', '--mobile')
    cmd('set', 'media', '--page', PAGE, '--reduced-motion', 'reduce')
    click('[data-exp-step="2"]')
    ck('mobile reduced-motion map and preparation remain inside the viewport', ev('JSON.stringify(matchMedia("(prefers-reduced-motion: reduce)").matches&&document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector(".exp-map").getBoundingClientRect().width>200)'))
    shot('mobile-plan.png')
    confirm()
    start_inspect()
    click('[data-exp-finish]')
    ck('mobile reduced-motion inspection and finish produce a useful independent report', report()['status'] == 'finished' and len(report()['inspections']) == 1)
    click('#scene-fullscreen')
    wait('!document.querySelector("#stream-hud").hidden')
    ck('existing streaming camera retains Earth identity and explicit SIM labeling', ev('JSON.stringify(document.querySelector("#sh-site").textContent.includes("Atacama")&&document.querySelector("#sh-utc").textContent.includes("SIM"))'))
    click('#sh-exit')
    wait('document.querySelector("#stream-hud").hidden')

    cmd('set', 'media', '--page', PAGE, '--reduced-motion', 'no-preference')
    boot('?qa=webgl')
    earth()
    ck('actual WebGL fallback exposes the DEM map and operational controls', ev('JSON.stringify(document.querySelector("#atlas-scene").hidden&&!document.querySelector("#scene-fallback").hidden)'))
    confirm()
    start_inspect()
    click('[data-exp-play]')
    phase('inspection')
    click('[data-exp-inspect]')
    click('[data-exp-finish]')
    ck('fallback traverses the real DEM, inspects both stops and exports without WebGL', len(report()['inspections']) == 2 and report()['rover']['distanceM'] > 100)
    shot('fallback-findings.png')

(OUT / f'browser-{mode}.json').write_text(json.dumps({'page': PAGE, 'url': URL, 'checks': checks, 'passed': len(checks), 'complete': True}, indent=2))
print(json.dumps({'mode': mode, 'passed': len(checks), 'complete': True}), flush=True)
