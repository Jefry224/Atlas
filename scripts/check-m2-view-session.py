#!/usr/bin/env python3
"""Mission session survives a separate catalogue/site rover run without mixing history."""
import argparse,json,subprocess,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--page',required=True);a=p.parse_args();dest=Path(__file__).resolve().parents[1]/'docs/evidencias/m2-automatico';checks=[]
def cmd(*args):
 r=subprocess.run(['orca-ide',*args,'--json'],capture_output=True,text=True,timeout=60);j=json.loads(r.stdout);assert j.get('ok'),j;return j['result']
def js(code):
 v=cmd('eval','--page',a.page,'--expression',f'(()=>eval({json.dumps(code)}))()')['result'];return json.loads(v) if isinstance(v,str) else v
def click(s):js(f'document.querySelector({json.dumps(s)}).click();JSON.stringify(true)')
def wait(s):cmd('wait','--page',a.page,'--selector',s)
def snapshot():
 click('[data-audit-export=json]');return js('(async()=>JSON.stringify(JSON.parse(await window.sessionBlobs.at(-1).text())))()')
def check(name,yes):
 assert yes,name;checks.append(name);(dest/'view-session-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2)+'\n');print('PASS',name,flush=True)
cmd('goto','--page',a.page,'--url','http://localhost:8027/');wait('[data-scenario=lava-tube]');click('[data-scenario=lava-tube]');wait('[data-m2-origins] tr')
js('window.sessionBlobs=[];window.nativeSessionURL=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b.type.includes("application/json"))window.sessionBlobs.push(b);return window.nativeSessionURL(b)};JSON.stringify(true)')
click('#mission-play');time.sleep(1.5);click('#mission-play');time.sleep(1);before=snapshot();assert before['mission']['latest']['elapsed']>0
click('#view-terrain');time.sleep(1);click('#mission-reset');click('#mission-play');time.sleep(1);click('#view-split');time.sleep(1);after=snapshot()
check('Recorrido de sitio separado no altera sesión/tiempo/distancia del escenario',after['mission']['id']==before['mission']['id'] and abs(after['mission']['latest']['elapsed']-before['mission']['latest']['elapsed'])<1e-7 and abs(after['mission']['latest']['distance']-before['mission']['latest']['distance'])<1e-7)
click('[data-scenario=hyperarid-salt]');check('Cambio escenario limpia inmediatamente texto/counters previos',js('JSON.stringify(!document.querySelector("[data-m2-status]").textContent.includes("Tubo de lava")&&document.querySelector("#analogy-audit").dataset.roverSamples<=1)'))
wait('[data-m2-origins] tr');new=snapshot();check('Nueva sesión Marte no contiene observaciones/rover lunar',new['mission']['id']!=before['mission']['id'] and new['candidate']['scenario']['body']=='mars' and all(t['site']=='atacama' for t in new['mission']['weather']) and all(r['elapsed']==0 for r in new['mission']['rover']))
click('[data-scenario=hyperarid-salt]');time.sleep(1);same=snapshot();check('Seleccionar de nuevo el mismo escenario conserva sesión y tiempo',same['mission']['id']==new['mission']['id'] and same['mission']['latest']['elapsed']==new['mission']['latest']['elapsed'])
click('#mission-reset');time.sleep(1);reset=snapshot();check('Reinicio explícito abre nueva sesión y mantiene cuerpo/configuración correctos',reset['mission']['id']!=new['mission']['id'] and reset['audit']['calibration']['inputs']['massKg']==350 and reset['audit']['calibration']['gravity']['targetWeightN']==1298.5)
# The catalogue is now integrated into Mission Control rather than a separate page.
check('Catálogo integrado conserva 14 sitios y 3 perfiles',js('JSON.stringify(document.querySelectorAll("#mission-sites .site-row").length===14&&document.querySelectorAll("#mission-profiles [data-profile]").length===3)'))
js('document.querySelector("#analogy-audit").scrollIntoView({block:"start"});JSON.stringify(true)')
console=cmd('console','--page',a.page,'--limit','50');assert not console['entries'],console
print(f'{len(checks)} view/session checks passed',flush=True)
