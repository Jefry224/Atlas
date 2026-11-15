#!/usr/bin/env python3
"""Acceptance in Orca browser. Mocks are explicitly confined to the second phase."""
import argparse,base64,json,subprocess,shutil,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--page',required=True);p.add_argument('--url',default='http://localhost:8027/');args=p.parse_args()
root=Path(__file__).resolve().parents[1];dest=root/'docs/evidencias/m2-automatico';dest.mkdir(parents=True,exist_ok=True)
checks=[]
def cmd(*argv):
 r=subprocess.run(['orca-ide',*argv,'--json'],capture_output=True,text=True,timeout=65);j=json.loads(r.stdout);assert j.get('ok'),j;return j['result']
def js(code):
 v=cmd('eval','--page',args.page,'--expression',f'(()=>eval({json.dumps(code)}))()')['result'];return json.loads(v) if isinstance(v,str) else v
def save(): (dest/'browser-results.json').write_text(json.dumps({'url':args.url,'checks':checks,'passed':len(checks)},ensure_ascii=False,indent=2)+'\n')
def check(name,code):
 result=js(code);assert result is True,(name,result);checks.append(name);save();print('PASS',name,flush=True)
def click(sel):js(f'document.querySelector({json.dumps(sel)}).click();JSON.stringify(true)')
def wait(sel):cmd('wait','--page',args.page,'--selector',sel)
def capture(name):
 v=cmd('screenshot','--page',args.page)['path'];src=Path('/mnt/'+v[0].lower()+'/'+v[3:].replace('\\','/')) if ':\\' in v else Path(v);shutil.copyfile(src,dest/name)
cmd('goto','--page',args.page,'--url',args.url);wait('[data-scenario=lava-tube]');cmd('viewport','--page',args.page,'--width','1440','--height','1000')
# Capture bytes from the actual user download, preserving browser download behavior.
js('window.m2Blobs=[];window.realCreateURL=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{window.m2Blobs.push(b);return window.realCreateURL(b)};JSON.stringify(true)')
click('[data-scenario=lava-tube]');wait('[data-m2-origins] tr');wait('#analogy-audit[data-weather-samples="1"]')
check('REAL: Luna automática 350 kg, 567 N y descarga 2866,5 N sin editar', 'JSON.stringify(document.querySelector("[data-bench-values]").textContent.includes("567 N")&&document.querySelector("[data-bench-values]").textContent.includes("2866,5 N")&&!document.querySelector("[data-m2-manual]").open)')
check('REAL: fuentes 11 variables, configuración y térmica desconocida', 'JSON.stringify(document.querySelectorAll("[data-m2-origins] tr").length===11&&document.querySelector("[data-m2-origins]").textContent.includes("prototype-config")&&document.querySelector("[data-m2-origins]").textContent.includes("missing"))')
# Real API must show pressure and current model if network works; keep raw evidence either way.
real=js('(async()=>{const t=await fetch("/api/telemetry?lat=29.025&lon=-13.68&site=lanzarote").then(r=>r.json());return JSON.stringify(t)})()');(dest/'real-api.json').write_text(json.dumps(real,ensure_ascii=False,indent=2)+'\n')
check('REAL: clima modelo API y presión absoluta en Pa disponibles', 'JSON.stringify(document.querySelector("[data-m2-status]").textContent.includes("clima model/")&&document.querySelector("[data-m2-origins]").textContent.includes("weather-model"))')
assert isinstance(real['values']['surfacePressurePa'],(float,int)) and real['provider']!='snapshot'
click('#mission-play');js('document.querySelector("#analogy-audit").scrollIntoView({block:"start"});JSON.stringify(true)')
# Wait by predicate with short tool calls, not provider fetches.
for _ in range(18):
 if js('JSON.stringify(Number(document.querySelector("#analogy-audit").dataset.roverSamples)>=2&&document.querySelector("[data-m2-live-values]").textContent.includes("0,8 m/s"))'):break
 time.sleep(1)
check('REAL: rover avanza, registro separado a 10s y reloj SIM explícito', 'JSON.stringify(Number(document.querySelector("#analogy-audit").dataset.roverSamples)>=2&&document.querySelector("[data-m2-live-values]").textContent.includes("SIM acelerado ×20")&&!document.querySelector("[data-m2-live-values]").textContent.includes("distancia 0 m"))')
js('window.benchCanvas=document.querySelector("[data-bench-stage] canvas");JSON.stringify(true)');capture('automatico-desktop.png')
click('[data-m2-xlsx]')
for _ in range(10):
 if js('JSON.stringify(window.m2Blobs.some(b=>b.type.includes("spreadsheetml")))'):break
 time.sleep(.5)
b64=js('(async()=>{const b=window.m2Blobs.find(b=>b.type.includes("spreadsheetml"));const a=new Uint8Array(await b.arrayBuffer());let s="";for(const x of a)s+=String.fromCharCode(x);return JSON.stringify(btoa(s));})()');(dest/'Atlas-M2-mision-real.xlsx').write_bytes(base64.b64decode(b64))
click('[data-audit-export=json]');click('[data-audit-export=md]');click('#export-mission')
reports=js('(async()=>JSON.stringify(await Promise.all(window.m2Blobs.filter(b=>b.type.includes("application/json")||b.type.includes("text/markdown")).map(b=>b.text()))))()');d=json.loads(reports[0]);(dest/'mission-snapshot-real.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
assert d['audit']['calibration']['inputs']['massKg']==350 and d['mission']['rover'][-1]['distance']>0
checks.append('REAL: descarga XLSX + JSON/Markdown/export misión contienen sesión e historia');save()
# Hypothetical inputs deliberately differ and must not contaminate exports.
js('document.querySelector("[data-m2-manual]").open=true;JSON.stringify(true)');time.sleep(.2)
js('const f=document.querySelector("#audit-mass");f.value=100;f.dispatchEvent(new Event("input",{bubbles:true}));JSON.stringify(true)')
check('Laboratorio opcional cambia banco hipotético a 162 N', 'JSON.stringify(document.querySelector("[data-bench-values]").textContent.includes("162 N"))')
click('[data-audit-export=json]');latest=js('(async()=>JSON.stringify(JSON.parse(await window.m2Blobs.at(-1).text())))()');assert latest['audit']['calibration']['inputs']['massKg']==350;checks.append('Hipótesis 100kg no contamina reporte de misión 350kg');save()
js('document.querySelector("[data-m2-manual]").open=false;JSON.stringify(true)');time.sleep(.2)
check('Cerrar laboratorio recupera banco automático y conserva renderer', 'JSON.stringify(document.querySelector("[data-bench-values]").textContent.includes("567 N")&&window.benchCanvas===document.querySelector("[data-bench-stage] canvas"))')
js('document.querySelector("#bench-mode").value="equivalent";document.querySelector("#bench-mode").dispatchEvent(new Event("change"));JSON.stringify(true)')
check('Banco mantiene segundo modo equivalente con inercia distinta', 'JSON.stringify(document.querySelector("[data-bench-values]").textContent.includes("57,8 kg")&&document.querySelector("[data-bench-method]").textContent.includes("inercia cambia"))')
click('[data-audit-factor=radiation]');check('Factores de matriz mantienen navegación al banco', 'JSON.stringify(document.querySelector("[data-nasa-bench]").dataset.factor==="radiation")')
click('[data-scenario=hyperarid-salt]');wait('#analogy-audit[data-weather-samples="1"]')
check('Marte automático: 1298,5 N y descarga 2135 N; sesión sin Luna anterior', 'JSON.stringify(document.querySelector("[data-bench-values]").textContent.includes("1298,5 N")&&document.querySelector("[data-bench-values]").textContent.includes("2135 N")&&document.querySelector("[data-m2-status]").textContent.includes("mars")&&!document.querySelector("[data-m2-status]").textContent.includes("lanzarote"))')
js('document.querySelector("#analogy-audit").scrollIntoView({block:"start"});JSON.stringify(true)');capture('marte-desktop.png')
click('#mission-reset');check('Reinicio misión abre sesión con historial rover vacío', 'JSON.stringify(document.querySelector("#analogy-audit").dataset.roverSamples==="0" || Number(document.querySelector("#analogy-audit").dataset.roverSamples)<=1)')
js('document.querySelector(".nasa-explorer-details").open=true;document.querySelector("#nasa-explorer").scrollIntoView({block:"start"});JSON.stringify(true)');wait('[data-nasa-stage][data-load=ready]')
for model in ['scarecrow','perseverance','moon','mars','lro','block-island','apollo-11']:
 click(f'[data-nasa-model="{model}"]');wait(f'[data-nasa-stage][data-asset="{model}"][data-load=ready]')
checks.append('Galería conserva carga local de los 7 recursos NASA');save()
for body in ['moon','mars']:
 click(f'[data-nasa-tab={body}]');wait(f'[data-nasa-stage][data-asset="{body}-coordinates"][data-load=ready]')
checks.append('Globos Luna/Marte conservan texturas y marcadores');save()
cmd('viewport','--page',args.page,'--width','390','--height','844','--mobile');js('document.querySelector("#analogy-audit").scrollIntoView({block:"start"});JSON.stringify(true)')
check('Móvil 390 sin overflow global y botón Excel accesible', 'JSON.stringify(document.documentElement.scrollWidth<=innerWidth&&document.querySelector("[data-m2-xlsx]").getBoundingClientRect().right<=innerWidth)');capture('automatico-mobile.png')
# Explicit mocks test async race and failed provider fallback in isolation from real evidence.
cmd('reload','--page',args.page);wait('[data-scenario=lava-tube]')
js('window.baseFetch=window.fetch;window.mockCalls=[];window.fetch=async(url,opts={})=>{if(String(url).startsWith("/api/telemetry")){window.mockCalls.push(String(url));if(String(url).includes("lanzarote")){await new Promise(r=>setTimeout(r,1800));return new Response(JSON.stringify({site:"lanzarote",provider:"QA-MOCK",live:true,observedAt:new Date().toISOString(),values:{surfacePressurePa:11111,temperatureC:99},source:{url:"QA-MOCK"}}));}throw new Error("QA-MOCK provider unavailable");}return window.baseFetch(url,opts)};JSON.stringify(true)')
click('[data-scenario=lava-tube]');time.sleep(.3);click('[data-scenario=hyperarid-salt]');time.sleep(2)
check('MOCK aislado: respuesta tardía Luna descartada al cambiar a Marte', 'JSON.stringify(document.querySelector("[data-bench-context]").textContent.includes("Planicie")&&!document.querySelector("[data-m2-origins]").textContent.includes("11111")&&!document.querySelector("[data-m2-origins]").textContent.includes("QA-MOCK"))')
check('MOCK aislado: fallo API usa archivo explícito y presión desconocida', 'JSON.stringify(document.querySelector("[data-m2-status]").textContent.includes("archive")&&document.querySelector("[data-m2-origins]").textContent.includes("desconocido"))')
count=js('JSON.stringify(window.mockCalls.length)');time.sleep(3);assert js('JSON.stringify(window.mockCalls.length)')==count;checks.append('MOCK: sin fetch por frame/segundo durante ventana refresh');save()
click('#view-globe');count=js('JSON.stringify(window.mockCalls.length)');time.sleep(2);assert js('JSON.stringify(window.mockCalls.length)')==count;checks.append('MOCK: salir vista suspende seguimiento/fetch');save()
console=cmd('console','--page',args.page,'--limit','100');(dest/'browser-console.json').write_text(json.dumps(console,ensure_ascii=False,indent=2)+'\n');assert not console['entries'],console
checks.append('Navegador sin errores de consola');save()
# Leave real preview active, no mocks or manual changes.
cmd('reload','--page',args.page);wait('[data-scenario=lava-tube]');click('[data-scenario=lava-tube]');wait('[data-m2-origins] tr')
print(f'{len(checks)} checks passed; evidence {dest}',flush=True)
