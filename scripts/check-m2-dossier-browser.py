import argparse,json,subprocess,base64,pathlib,time,shutil
parser=argparse.ArgumentParser();parser.add_argument('--page',required=True);args=parser.parse_args();page=args.page
root=pathlib.Path(__file__).resolve().parents[1]; dest=root/'docs/evidencias/m2-excel-diseno'
def cmd(*a):
 r=subprocess.run(['orca-ide',*a,'--json'],text=True,capture_output=True,timeout=65);j=json.loads(r.stdout);assert j['ok'],j;return j['result']
def js(s):
 r=cmd('eval','--page',page,'--expression',f'(()=>eval({json.dumps(s)}))()')['result'];return json.loads(r) if isinstance(r,str) else r
cmd('reload','--page',page)
cmd('wait','--page',page,'--selector','[data-scenario=lava-tube]')
js('document.querySelector("[data-scenario=lava-tube]").click();JSON.stringify(true)')
cmd('wait','--page',page,'--selector','[data-base-tool=rover]')
js('window.m2Blobs=[];const original=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{window.m2Blobs.push(b);return original(b)};JSON.stringify(true)')
r=js('(async()=>{const t=await fetch("/api/telemetry?lat=29.034&lon=-13.732&site=lanzarote").then(r=>r.json());return JSON.stringify(t)})()');(dest/'real-api.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
js('document.querySelector("[data-m2-xlsx]").click();JSON.stringify(true)')
for _ in range(8):
 if js('JSON.stringify(window.m2Blobs.some(b=>b.type.includes("spreadsheetml")))'):break
 time.sleep(.3)
b64=js('(async()=>{const a=new Uint8Array(await window.m2Blobs.find(b=>b.type.includes("spreadsheetml")).arrayBuffer());let s="";for(const b of a)s+=String.fromCharCode(b);return JSON.stringify(btoa(s))})()');(dest/'Atlas-M2-descarga-UI-real.xlsx').write_bytes(base64.b64decode(b64))
summary=js('JSON.stringify({tools:document.querySelectorAll("[data-base-tool]").length,status:document.querySelector("[data-m2-status]").textContent,base:document.querySelector("[data-m2-tools]").textContent,origins:document.querySelector("[data-m2-origins]").textContent})')
assert summary['tools']==8 and 'Base propuesta: 0,8' in summary['origins'];assert r['provider']!='snapshot' and isinstance(r['values']['surfacePressurePa'],(int,float));assert 'model/' in summary['status']
(dest/'browser-real.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');(dest/'browser-console.json').write_text(json.dumps(cmd('console','--page',page,'--limit','100'),ensure_ascii=False,indent=2)+'\n')
assert not json.loads((dest/'browser-console.json').read_text())['entries']
print('PASS: actual browser XLSX download; 8 tools; live provider model; console clean')

checks=[]
# Compare each rendered instrument parameter against its applicable profile in the browser.
for scenario in ['lava-tube','polar-shadow','hyperarid-salt','wind-canyon']:
 js(f'document.querySelector("[data-scenario={scenario}]").click();JSON.stringify(true)')
 cmd('wait','--page',page,'--selector',f'[data-m2-tools][data-profile-scenario={scenario}]')
 result=js('(async()=>{const {getMissionBaseProfile}=await import("/mission-profiles.mjs");const p=getMissionBaseProfile('+json.dumps(scenario)+');const fmt=v=>typeof v==="number"?(v!==0&&Math.abs(v)<0.0001?v.toExponential(3):v.toLocaleString("es-ES",{maximumFractionDigits:4})):String(v);return JSON.stringify({id:p.scenarioId,tools:p.tools.length,match:p.tools.every(t=>{const el=document.querySelector(`[data-base-tool="${t.id}"]`);return el&&t.parameters.every(q=>el.textContent.includes(q.label)&&el.textContent.includes(fmt(q.value))&&el.textContent.includes(q.rationale))})})})()')
 assert result['match'] and result['tools']==8,result;checks.append({'scenario':scenario,'profileParametersMatch':True})
# Laboratory changes must remain isolated from exported base/current records.
js('document.querySelector("[data-m2-manual]").open=true;JSON.stringify(true)');time.sleep(.2)
js('const f=document.querySelector("#audit-mass");f.value=100;f.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("[data-audit-export=json]").click();JSON.stringify(true)')
report=js('(async()=>JSON.stringify(JSON.parse(await window.m2Blobs.at(-1).text())))()')
assert report['audit']['calibration']['inputs']['massKg']==350
assert report['audit']['calibration']['thermal']['radiationW'] is None
assert report['baseProfile']['scenarioId']=='wind-canyon'
assert not any(r.get('kind')=='prototype-design' for r in report['mission']['rover'])
checks.append({'lab100kgExport350kg':True,'baseNotRecordedAsTelemetry':True})
cmd('viewport','--page',page,'--width','390','--height','844','--mobile')
assert js('JSON.stringify(document.documentElement.scrollWidth<=innerWidth)')
checks.append({'mobile390NoOverflow':True})
js('document.querySelector("[data-m2-manual]").open=false;document.querySelector("[data-base-tool=rover]").open=true;document.querySelector("[data-m2-tools]").scrollIntoView({block:"start"});JSON.stringify(true)')
for width,height,name in [(390,844,'ui-perfil-mobile.png'),(1440,1000,'ui-perfil-desktop.png')]:
 cmd('viewport','--page',page,'--width',str(width),'--height',str(height))
 file=cmd('screenshot','--page',page)['path'];src=pathlib.Path('/mnt/'+file[0].lower()+'/'+file[3:].replace('\\','/')) if ':\\' in file else pathlib.Path(file);shutil.copyfile(src,dest/name)
console=cmd('console','--page',page,'--limit','100');assert not console['entries'],console
(dest/'browser-regression.json').write_text(json.dumps({'checks':checks,'console':console},ensure_ascii=False,indent=2)+'\n')
print('PASS: four profiles match UI, lab isolation, 390px and clean console')
# Isolated offline-provider phase, kept separate from the real provider download above.
cmd('reload','--page',page);cmd('wait','--page',page,'--selector','[data-scenario=lava-tube]')
js('window.m2Blobs=[];const originalURL=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{window.m2Blobs.push(b);return originalURL(b)};const originalFetch=window.fetch.bind(window);window.fetch=(url,opts)=>String(url).startsWith("/api/telemetry")?Promise.reject(new Error("QA offline provider")):originalFetch(url,opts);document.querySelector("[data-scenario=lava-tube]").click();JSON.stringify(true)')
cmd('wait','--page',page,'--selector','#analogy-audit[data-weather-samples="1"]')
state=js('JSON.stringify({status:document.querySelector("[data-m2-status]").textContent,tools:document.querySelectorAll("[data-base-tool]").length,enabled:!document.querySelector("[data-m2-xlsx]").disabled})')
assert 'archive' in state['status'] and state['tools']==8 and state['enabled'],state
js('document.querySelector("[data-m2-xlsx]").click();JSON.stringify(true)')
for _ in range(8):
 if js('JSON.stringify(window.m2Blobs.some(b=>b.type.includes("spreadsheetml")))'):break
 time.sleep(.3)
b64=js('(async()=>{const a=new Uint8Array(await window.m2Blobs.find(b=>b.type.includes("spreadsheetml")).arrayBuffer());let s="";for(const b of a)s+=String.fromCharCode(b);return JSON.stringify(btoa(s))})()');(dest/'Atlas-M2-offline-UI.xlsx').write_bytes(base64.b64decode(b64))
(dest/'browser-offline.json').write_text(json.dumps({'phase':'Explicit provider failure mock; archive fallback, no real current-model claim','result':state,'console':cmd('console','--page',page,'--limit','100')},ensure_ascii=False,indent=2)+'\n')
cmd('reload','--page',page);cmd('wait','--page',page,'--selector','[data-scenario=lava-tube]');js('document.querySelector("[data-scenario=lava-tube]").click();JSON.stringify(true)')
print('PASS: offline-provider UI download keeps all 8 base tools; preview restored without mocks')
