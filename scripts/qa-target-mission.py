#!/usr/bin/env python3
"""Real Orca browser regression of target landing + authoritative Earth test rover.
Usage: python3 scripts/qa-target-mission.py PAGE_ID [URL] [--preparation-only|--desktop-only|--mobile-only|--motion-only|--fallback-only|--extras-only|--visual-only]
No controller hooks, fake rendering, physics substitution, server lifecycle or remote writes.
"""
import base64,json,os,re,shutil,subprocess,sys
from pathlib import Path
PAGE=sys.argv[1]; URL=next((x for x in sys.argv[2:] if x.startswith('http')),'http://localhost:8031/')
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/evidencias/preparacion-rendimiento';OUT.mkdir(parents=True,exist_ok=True)
CLI=os.environ.get('ORCA_CLI_COMMAND','orca-ide');checks=[];missions=[]
mode=next((x for x in sys.argv if x.endswith('-only')),'all');RESULT=OUT/(mode.strip('-')+'-checks.json')
if '--resume' in sys.argv and RESULT.exists():
 previous=json.loads(RESULT.read_text());checks=previous['checks'];missions=previous['missions']
def cmd(*args):
 p=subprocess.run([CLI,*args,'--json'],capture_output=True,text=True,timeout=58)
 try:d=json.loads(p.stdout)
 except ValueError:raise RuntimeError((args,p.stdout,p.stderr))
 if not d.get('ok'):raise RuntimeError(d)
 return d['result']
def ev(js):
 r=cmd('eval','--page',PAGE,'--expression',js)['result'];return json.loads(r) if isinstance(r,str) else r
def act(js):return ev('(()=>{'+js+';return JSON.stringify(true)})()')
def wait(js,seconds=30):
 return ev('(async()=>{const end=Date.now()+'+str(seconds*1000)+';while(Date.now()<end){if('+js+')return JSON.stringify(true);await new Promise(r=>setTimeout(r,100))}return JSON.stringify(false)})()')
def ck(name,value):
 assert value,name
 checks.append(name);print('PASS',name,flush=True)
 RESULT.write_text(json.dumps({'page':PAGE,'url':URL,'passed':len(checks),'checks':checks,'missions':missions},ensure_ascii=False,indent=2))
def confirm_preparation():
 if ev('JSON.stringify(document.querySelector("#landing-panel").dataset.phase!=="ready"||(document.querySelector("#landing-panel").dataset.prepared==="true"&&!document.querySelector("[data-preparation-dialog]").open))'):return
 if not ev('JSON.stringify(document.querySelector("[data-preparation-dialog]").open)'):act('document.querySelector("[data-flight-plan]").click()')
 act('document.querySelector("[data-preparation-next]").click();document.querySelector("[data-preparation-confirm]").click()')
 assert ev('JSON.stringify(document.querySelector("#landing-panel").dataset.prepared==="true"&&!document.querySelector("[data-preparation-dialog]").open&&document.querySelector("#landing-panel").dataset.phase==="ready")')
def click(selector):
 if selector=='[data-flight-action]' and ev('JSON.stringify(document.querySelector("#landing-panel").dataset.phase==="ready")'):confirm_preparation()
 # Activate the actual rendered control/event path; never call the controller or replace physics.
 return act('document.querySelector('+json.dumps(selector)+').click()')

def shot(name,selector='#scene-viewport'):
 act('document.querySelector('+json.dumps(selector)+').scrollIntoView({block:"start"})')
 r=cmd('screenshot','--page',PAGE);p=r['path'].replace('\\','/')
 if len(p)>1 and p[1]==':':p='/mnt/'+p[0].lower()+p[2:]
 shutil.copyfile(p,OUT/name)
def hooks():
 act('window.targetBlobs=[];window.targetDownloads=[];const originalURL=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{targetBlobs.push(b);return originalURL(b)};const originalClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)targetDownloads.push({name:this.download,href:this.href});return originalClick.call(this)}')
def data():
 return ev('(async()=>{const n=targetBlobs.length;document.querySelector("#export-mission").click();return JSON.stringify(JSON.parse(await targetBlobs[n].text()))})()')
def phase(value):assert wait('document.querySelector("#landing-panel").dataset.phase==='+json.dumps(value)),value

def boot(mobile=False):
 # Flight intentionally pauses in hidden pages; select this actual tab before interacting.
 cmd('tab','switch','--page',PAGE)
 cmd('goto','--page',PAGE,'--url',URL);act('localStorage.setItem("atlas-landing-guide","seen")');cmd('reload','--page',PAGE);cmd('viewport','--page',PAGE,'--width','390' if mobile else '1440','--height','844' if mobile else '1000',*(['--mobile'] if mobile else []))
 assert wait('document.querySelectorAll(".scenario-button").length===4',15);hooks()
def select(sc):
 click('[data-scenario='+sc+']');assert wait('document.querySelectorAll(".landing-zone").length===3&&!document.querySelector("[data-flight-action]").disabled',15)
def pause():
 if ev('JSON.stringify(document.querySelector("[data-flight-action]").dataset.action==="pause")'):click('[data-flight-action]')
def fuel(n):
 act('if(!document.querySelector("[data-preparation-dialog]").open)document.querySelector("[data-flight-plan]").click();document.querySelector("[data-preparation-next]").click()')
 act('const e=document.querySelector("[data-flight-fuel=target]");e.value='+str(n)+';e.dispatchEvent(new Event("input",{bubbles:true}))')
def save_exports(prefix):
 # These bytes come from the UI's own download Blob and real anchor click; no report reconstruction.
 payload=data();(OUT/(prefix+'-mission.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2))
 for selector,suffix in [('[data-audit-export=json]','-dossier.json'),('[data-m2-xlsx]','.xlsx')]:
  n=ev('JSON.stringify(targetBlobs.length)');act('document.querySelector('+json.dumps(selector)+').click()')
  assert wait('targetBlobs.length>'+str(n),15)
  raw=ev('(async()=>{const b=targetBlobs['+str(n)+'];const a=new Uint8Array(await b.arrayBuffer());let s="";for(let i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return JSON.stringify(btoa(s))})()')
  (OUT/(prefix+suffix)).write_bytes(base64.b64decode(raw))
 return payload
if mode=='--visual-only':
 boot(True);select('lava-tube');click('[data-flight-dismiss]')
 act('document.querySelector(".landing-region-map").scrollIntoView({block:"center"});document.querySelector(".landing-map-marker").focus()');cmd('keypress','--page',PAGE,'--key','ArrowRight');cmd('keypress','--page',PAGE,'--key','Enter')
 shot('mobile-zona.png','[data-preparation-dialog]')
 ck('Móvil mapa conserva selección y foco por teclado',ev('JSON.stringify(document.activeElement.matches(".landing-map-marker")&&document.activeElement.getAttribute("aria-pressed")==="true")'))
 probe=(ROOT/'docs/evidencias/preparacion-diseno/probe-cssom.js').read_text()
 result=ev(probe);result['documentHasFocus']=ev('JSON.stringify(document.hasFocus())');result['visibilityState']=ev('JSON.stringify(document.visibilityState)')
 (ROOT/'docs/evidencias/preparacion-diseno/cssom-mobile-zona.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 ck('Regla scoped de foco existe en CSSOM real',ev('JSON.stringify([...[...document.styleSheets].find(s=>s.href?.includes("mission-preparation.css")).cssRules].some(r=>r.selectorText?.endsWith(":focus")&&r.style.getPropertyValue("outline").includes("2px solid")&&CSS.supports("outline",r.style.getPropertyValue("outline"))))'))
 click('[data-preparation-next]');fuel(80)
 for label in ['mobile','landscape','reduced-motion']:
  if label=='landscape':cmd('viewport','--page',PAGE,'--width','844','--height','390','--mobile')
  if label=='reduced-motion':cmd('viewport','--page',PAGE,'--width','390','--height','844','--mobile');cmd('set','media','--page',PAGE,'--reduced-motion','reduce')
  act('document.querySelector(".landing-workbench").scrollTop=document.querySelector(".landing-workbench").scrollHeight;document.querySelector("[data-preparation-confirm]").focus()')
  cmd('keypress','--page',PAGE,'--key','Shift+Tab')
  (ROOT/('docs/evidencias/preparacion-diseno/cssom-'+label+'-resumen-v2.json')).write_text(json.dumps(ev(probe),ensure_ascii=False,indent=2))
  shot(label+'-resumen-completo.png','[data-preparation-dialog]')
  ck(label+' resumen completo dentro del scroll del diálogo',ev('JSON.stringify(document.querySelector(".landing-workbench").scrollTop>0&&document.querySelector("[data-preparation-dialog]").contains(document.activeElement)&&document.documentElement.scrollWidth<=innerWidth)'))
 cmd('set','media','--page',PAGE,'--reduced-motion','no-preference')
if mode=='--preparation-only':
 boot();select('lava-tube')
 ck('Preparación abre modal en zona con foco y nombre accesible',ev('JSON.stringify(document.querySelector("[data-preparation-dialog]").open&&document.activeElement.id==="preparation-title"&&document.querySelector("[data-preparation-dialog]").getAttribute("aria-labelledby")==="preparation-title")'))
 act('document.querySelector("[data-preparation-confirm]").click()')
 ck('Confirmación fuera del segundo paso rechazada',ev('JSON.stringify(document.querySelector("#landing-panel").dataset.prepared==="false"&&document.querySelector("#landing-panel").dataset.phase==="ready")'))
 cmd('keypress','--page',PAGE,'--key','Escape')
 ck('Escape cierra sin confirmar ni iniciar',ev('JSON.stringify(!document.querySelector("[data-preparation-dialog]").open&&document.querySelector("#landing-panel").dataset.prepared==="false"&&document.querySelector("#landing-panel").dataset.phase==="ready")'))
 for selector in ['#launch-mission','#mission-play','[data-flight-action]','#landing-scene-action','#sh-play']:
  act('document.querySelector('+json.dumps(selector)+').click()')
  ck('Gate obligatorio '+selector,ev('JSON.stringify(document.querySelector("#landing-panel").dataset.phase==="ready"&&document.querySelector("#landing-panel").dataset.prepared==="false")'))
  act('document.querySelector("[data-preparation-dialog]").close()')
 act('document.querySelector("#mission-play").focus()');cmd('keypress','--page',PAGE,'--key','Enter')
 ck('Inicio por teclado exige preparación',ev('JSON.stringify(document.querySelector("[data-preparation-dialog]").open&&document.querySelector("#landing-panel").dataset.phase==="ready")'))
 act('document.querySelector("[data-preparation-next]").focus()');cmd('keypress','--page',PAGE,'--key','Tab')
 ck('Tab mantiene foco dentro del diálogo',ev('JSON.stringify(document.querySelector("[data-preparation-dialog]").contains(document.activeElement))'))
 cmd('keypress','--page',PAGE,'--key','Escape');act('document.querySelector("#atlas-scene").focus()');cmd('keypress','--page',PAGE,'--key','f')
 ck('Atajo transmisión no elude gate ni libera rover',ev('JSON.stringify(document.querySelector("#stream-hud").hidden&&document.querySelector("#landing-panel").dataset.phase==="ready")'))
 click('[data-flight-plan]');act('document.querySelector(".landing-map-marker").focus()');cmd('keypress','--page',PAGE,'--key','ArrowRight');cmd('keypress','--page',PAGE,'--key','Enter')
 ck('Mapa selecciona candidato con teclado sin reconstruir el foco',ev('JSON.stringify(document.activeElement.matches(".landing-map-marker")&&document.activeElement.getAttribute("aria-pressed")==="true")'))
 click('[data-flight-dismiss]');shot('desktop-zona.png','[data-preparation-dialog]');click('[data-preparation-next]');fuel(80)
 ck('Resumen target muestra carga SI personalizada',ev('JSON.stringify(document.querySelector("[data-preparation-summary]").textContent.includes("144")&&document.querySelector("[data-preparation-summary]").textContent.includes("994")&&document.querySelector("[data-preparation-step=zone]").hidden)'))
 shot('desktop-carga-resumen.png','[data-preparation-dialog]')
 probe=(ROOT/'docs/evidencias/preparacion-diseno/probe-cssom.js').read_text()
 for label in ['desktop','mobile','landscape','reduced-motion']:
  if label=='mobile':cmd('viewport','--page',PAGE,'--width','390','--height','844','--mobile')
  if label=='landscape':cmd('viewport','--page',PAGE,'--width','844','--height','390','--mobile')
  if label=='reduced-motion':cmd('viewport','--page',PAGE,'--width','390','--height','844','--mobile');cmd('set','media','--page',PAGE,'--reduced-motion','reduce')
  result=ev(probe);(ROOT/('docs/evidencias/preparacion-diseno/cssom-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
  shot(label+'-carga-resumen.png','[data-preparation-dialog]')
  ck(label+' modal, footer y foco accesibles sin overflow horizontal',ev('JSON.stringify(document.documentElement.scrollWidth<=innerWidth&&document.querySelector("[data-preparation-dialog]").getBoundingClientRect().bottom<=innerHeight&&document.querySelector(".preparation-footer").getBoundingClientRect().bottom<=innerHeight)'))
 cmd('set','media','--page',PAGE,'--reduced-motion','no-preference');cmd('viewport','--page',PAGE,'--width','1440','--height','1000')
 click('[data-preparation-confirm]')
 ck('Confirmar habilita inicio pero no arranca vuelo',ev('JSON.stringify(document.querySelector("#landing-panel").dataset.prepared==="true"&&document.querySelector("#landing-panel").dataset.phase==="ready"&&!document.querySelector("[data-preparation-dialog]").open&&document.querySelector("[data-flight-action]").textContent==="Iniciar descenso")'))
 act('document.querySelector(".landing-reference").open=true');click('[data-flight-compare]');click('[data-flight-rate="4"]')
 ck('Comparación, tasa y cámara no invalidan preparación',ev('JSON.stringify(document.querySelector("#landing-panel").dataset.prepared==="true")'))
 fuel(81);click('[data-preparation-close]');act('document.querySelector("#launch-mission").click()')
 ck('Editar carga invalida y rechaza inicio',ev('JSON.stringify(document.querySelector("#landing-panel").dataset.prepared==="false"&&document.querySelector("#landing-panel").dataset.phase==="ready"&&document.querySelector("[data-preparation-dialog]").open)'))
 fuel(80);confirm_preparation();click('[data-flight-plan]');act('document.querySelectorAll(".landing-map-marker")[2].click()')
 ck('Editar zona invalida confirmación anterior',ev('JSON.stringify(document.querySelector("#landing-panel").dataset.prepared==="false")'))
 confirm_preparation();click('[data-flight-action]');phase('descent');pause();payload=save_exports('preparacion-personalizada')
 event=[e for e in payload['analogyDossier']['mission']['events'] if e['type']=='preparation-confirmed'][-1];identity=json.loads(event['detail'])
 ck('JSON descargado refleja zona, carga y evento de sesión correctos',payload['preparation']['sessionId']==payload['landing']['missionId']==payload['analogyDossier']['mission']['id']==identity['sessionId'] and identity['zoneId']==payload['landing']['plans']['target']['selectedId'] and identity['fuelPercent']==80 and identity['propellantKg']==144 and payload['landing']['history'][0]['target']['propellantKg']==144)
 shot('desktop-vuelo-pausado.png')
 click('[data-flight-reset]');reset=data()
 ck('Reset abre preparación nueva sin evento confirmado obsoleto',reset['landing'] is None and reset['preparation'] is None and reset['analogyDossier']['mission']['id']!=identity['sessionId'] and not any(e['type']=='preparation-confirmed' for e in reset['analogyDossier']['mission']['events']) and ev('JSON.stringify(document.querySelector("[data-preparation-dialog]").open)'))
 confirm_preparation();act('document.querySelector("[data-scenario=hyperarid-salt]").click()');assert wait('document.querySelector("#landing-panel").dataset.prepared==="false"&&document.querySelectorAll(".landing-zone").length===3')
 ck('Cambiar escenario invalida y abre zona del nuevo destino',ev('JSON.stringify(document.querySelector("[data-preparation-dialog]").open&&!document.querySelector("[data-preparation-step=zone]").hidden&&document.querySelector("#landing-panel").dataset.phase==="ready")'))
 fuel(0)
 ck('Cero combustible es ensayo explícito con aviso honesto',ev('JSON.stringify(!document.querySelector("[data-preparation-confirm]").disabled&&document.querySelector("[data-preparation-warning]").textContent.includes("fallo deliberado"))'))
if mode in ['all','--desktop-only','--mobile-only']:
 mobile=mode=='--mobile-only';boot(mobile)
 ck('Catálogo conserva 14 sitios',ev('JSON.stringify(document.querySelectorAll(".site-row").length===14)'))
 for i,sc in enumerate(['lava-tube','hyperarid-salt'] if mobile else ['lava-tube','polar-shadow','hyperarid-salt','wind-canyon']):
  if any(m['scenario']==sc for m in missions):continue
  select(sc)
  ck(sc+' solo mapa y combustible target, 1× manual',ev('JSON.stringify(document.querySelectorAll("[data-map-body]").length===1&&document.querySelector("[data-map-body]").dataset.mapBody==="target"&&document.querySelectorAll("[data-flight-fuel]").length===1&&document.querySelector("[data-flight-fuel]").dataset.flightFuel==="target"&&document.querySelector("[data-flight-rate=\\"1\\"]").getAttribute("aria-pressed")==="true"&&document.querySelector("#scene-viewport").dataset.comparison==="false")'))
  if i==0:
   act('localStorage.setItem("atlas-landing-guide","seen")')
   ck('Guía de flujo nuevo visible pese a versión anterior',ev('JSON.stringify(!document.querySelector("[data-flight-guide]").hidden)'))
   click('[data-flight-dismiss]')
   if mobile:shot('movil-preparacion.png','.landing-command')
   else:shot('desktop-preparacion.png','.viewport-heading');shot('desktop-mapa-objetivo.png','.landing-prep-heading')
   click('[data-preparation-close]');act('document.querySelector(".landing-reference").open=true')
   click('[data-flight-compare]');ck('Comparación opcional revela origen de ensayo sin aterrizaje Earth',ev('JSON.stringify(document.querySelector("#scene-viewport").dataset.comparison==="true"&&!document.querySelector("[data-analogue-details]").hidden&&!document.querySelector("[data-flight-fuel=earth]")&&!document.querySelector("[data-map-body=earth]"))'))
   if mobile:
    click('#split-tab-earth');shot('movil-referencia.png');click('#split-tab-target')
   else:shot('desktop-referencia.png')
   click('[data-flight-compare]')
   click('[data-flight-plan]');act('document.querySelector(".landing-map-marker").focus()');cmd('keypress','--page',PAGE,'--key','ArrowRight');cmd('keypress','--page',PAGE,'--key','Enter')
   ck('Mapa conserva selección por teclado y foco',ev('JSON.stringify(document.activeElement.matches(".landing-map-marker")&&document.activeElement.getAttribute("aria-pressed")==="true")'))
   fuel(80)
  click('[data-flight-rate="4"]');click('[data-flight-action]');phase('descent');pause();before=data()
  ck(sc+' Earth no vuela y objetivo desciende; rover retenido',before['landing']['runs']['earth'] is None and before['landing']['runs']['target']['phase']=='descent' and before['rover']['distanceM']==0 and all(h['earth'] is None for h in before['landing']['history']))
  click('[data-flight-compare]');after=data();ck(sc+' comparar no resetea sesión ni vuelo',after['landing']['missionId']==before['landing']['missionId'] and after['landing']['runs']==before['landing']['runs']);click('[data-flight-compare]')
  if i==0:
   shot('movil-descenso.png' if mobile else 'desktop-descenso.png')
   for camera in ['lower','orbital','exterior']:
    act('const e=document.querySelector("[data-flight-camera]");e.value='+json.dumps(camera)+';e.dispatchEvent(new Event("change",{bubbles:true}))')
   ck('Pausa conserva estado SI y cámaras',data()['landing']['runs']==before['landing']['runs'])
   for rate in ['0.5','1','2','4']:click('[data-flight-rate=\"'+rate+'\"]')
   ck('Cuatro velocidades preservan estado SI e identidad durante pausa',data()['landing']['runs']==before['landing']['runs'] and data()['landing']['missionId']==before['landing']['missionId'])
  click('[data-flight-action]');phase('contact');contact=data();origin=contact['landing']['explorationOrigins'];run=contact['landing']['runs']['target']
  ck(sc+' contacto target suficiente y origen Earth real automático',run['phase']=='contact' and origin['earth']['role']=='analogue-test-origin' and origin['target']['x']==run['x'] and origin['target']['z']==run['z'] and contact['rover']['distanceM']==0)
  act('document.querySelector("#launch-mission").click();document.querySelector("#mission-play").click();document.querySelector("#pilot-manual").click()')
  ck(sc+' órdenes no eluden autorización manual',data()['landing']['phase']=='contact' and data()['rover']['distanceM']==0)
  if i==0:shot('movil-contacto.png' if mobile else 'desktop-contacto.png')
  click('[data-flight-action]');phase('exploration');pause();explore=data();earth=explore['rover'];target=explore['targetRover'];o=explore['landing']['explorationOrigins']
  ck(sc+' dos rovers con offset y roles propios',target is not None and earth['body']=='earth' and target['body']==run['body'] and abs((target['x']-o['target']['x'])-(earth['x']-o['earth']['x']))<1e-8 and abs((target['z']-o['target']['z'])-(earth['z']-o['earth']['z']))<1e-8 and ev('JSON.stringify(document.querySelector("#split-earth-kind").textContent.includes("ROVER DE ENSAYO")&&document.querySelector("#split-target-kind").textContent.includes("ROVER ESPEJO")&&!document.querySelector("#rover-mirror-legend").hidden)'))
  if i==0:
   click('#pilot-manual');click('[data-flight-action]');ev('(async()=>{window.dispatchEvent(new KeyboardEvent("keydown",{key:"w",bubbles:true}));await new Promise(r=>setTimeout(r,2200));window.dispatchEvent(new KeyboardEvent("keyup",{key:"w",bubbles:true}));return JSON.stringify(true)})()');pause();driven=data();a=driven['rover'];b=driven['targetRover'];oo=driven['landing']['explorationOrigins']
   ck('Conducir Earth mueve espejo relativamente sin igualar coordenadas',a['distanceM']>earth['distanceM'] and b is not None and abs((b['x']-oo['target']['x'])-(a['x']-oo['earth']['x']))<1e-8 and abs((b['z']-oo['target']['z'])-(a['z']-oo['earth']['z']))<1e-8 and (a['x'],a['z'])!=(b['x'],b['z']))
   ck('Cada suelo evalúa actitud propia',ev('JSON.stringify(document.querySelector("#phys-pitch").textContent!==document.querySelector("#phys-target-pitch").textContent||document.querySelector("#phys-roll").textContent!==document.querySelector("#phys-target-roll").textContent)'))
   if mobile:
    click('#split-tab-earth');shot('movil-rover-ensayo.png');click('#split-tab-target');shot('movil-rover-espejo.png')
   else:shot('desktop-rovers-espejo.png');save_exports('personalizado-lava-tube')
   click('#scene-fullscreen');click('[data-cam=mast]');ck('Transmisión simulada y cámara mástil conservadas',ev('JSON.stringify(!document.querySelector("#stream-hud").hidden&&document.querySelector("[data-cam=mast]").getAttribute("aria-pressed")==="true")'));click('#sh-exit')
   cmd('viewport','--page',PAGE,'--width','390' if mobile else '1440','--height','844' if mobile else '1000',*(['--mobile'] if mobile else []))
  if i==2 and not mobile:save_exports('nominal-jezero')
  ck(sc+' sin desborde horizontal',ev('JSON.stringify(document.documentElement.scrollWidth<=innerWidth)'))
  missions.append({'scenario':sc,'missionId':explore['landing']['missionId'],'targetContact':run,'origins':o,'earthFlight':None})
  click('[data-flight-reset]')
 # Explicit target failure; Earth's valid DEM/origin must never authorize deployment.
 select('lava-tube');fuel(0);click('[data-flight-rate="4"]');click('[data-flight-action]');phase('hard-contact');failure=data()
 ck('Fallo target retiene rover aun con origen Earth válido',failure['landing']['explorationOrigins']['earth'] is not None and failure['targetRover'] is None and failure['rover']['distanceM']==0)
 act('document.querySelector("#mission-play").click();document.querySelector("#pilot-manual").click()');ck('Órdenes no liberan rover tras fallo target',data()['landing']['phase']=='hard-contact' and data()['rover']['distanceM']==0)
 click('[data-flight-action]');ck('Botón de fallo reinicia preparación editable',ev('JSON.stringify(document.querySelector("#landing-panel").dataset.phase==="ready"&&!document.querySelector("[data-flight-fuel]").disabled)'))
 if not mobile:
  # The preserved catalogue still starts directly, with no landing gate.
  act('document.querySelector(".site-row").click()');click('#launch-mission');ck('Catálogo legacy mantiene exploración directa',data()['landing'] is None and data()['view']=='terrain')
  click('#mission-play')
if mode=='--mirror-only':
 boot(True);select('lava-tube');click('[data-flight-rate="4"]');click('[data-flight-action]');phase('contact');click('[data-flight-action]');phase('exploration');pause()
 click('#pilot-manual');click('[data-flight-action]');ev('(async()=>{window.dispatchEvent(new KeyboardEvent("keydown",{key:"w",bubbles:true}));await new Promise(r=>setTimeout(r,2200));window.dispatchEvent(new KeyboardEvent("keyup",{key:"w",bubbles:true}));return JSON.stringify(true)})()');pause()
 click('#split-tab-earth');assert wait('document.querySelector("#scene-coordinate").textContent.includes("TIERRA")',5)
 ck('Coordenadas móviles cambian a Earth con rover de ensayo',ev('JSON.stringify(document.querySelector("#split-overlay").dataset.pane==="earth"&&document.querySelector("#scene-coordinate").textContent.includes("TIERRA"))'));shot('movil-rover-ensayo.png')
 click('#split-tab-target');assert wait('document.querySelector("#scene-coordinate").textContent.includes("LUNA")',5)
 ck('Coordenadas móviles vuelven a Luna con rover espejo',ev('JSON.stringify(document.querySelector("#split-overlay").dataset.pane==="target"&&document.querySelector("#scene-coordinate").textContent.includes("LUNA"))'));shot('movil-rover-espejo.png')
 ck('Índice flotante no tapa navegación ni leyenda móvil',ev('JSON.stringify(getComputedStyle(document.querySelector("#split-index")).display==="none"&&document.documentElement.scrollWidth<=innerWidth)'))
if mode in ['all','--extras-only']:
 boot();select('hyperarid-salt');click('[data-flight-rate="4"]');click('[data-flight-action]');phase('contact');shot('desktop-contacto-jezero.png');click('[data-flight-action]');phase('exploration');pause();shot('desktop-rovers-jezero.png')
 act('document.querySelector("#copilot-input").value="descenso y combustible del destino";document.querySelector("#copilot-form").requestSubmit()')
 assert wait('document.querySelector("#copilot-log").textContent.includes("Propelente")',25)
 ck('Respuesta local del copiloto usa combustible y fase actual',ev('JSON.stringify(document.querySelector("#copilot-log").textContent.includes("Fase de misión:"))'))
 c=data();ck('Sesión usada por copiloto conserva Earth ensayo y objetivo Mars',c['rover']['body']=='earth' and c['targetRover']['body']=='mars' and c['landing']['runs']['earth'] is None and c['landing']['primarySide']=='target')
 (OUT/'copilot-ui.json').write_text(json.dumps({'missionId':c['landing']['missionId'],'responseText':ev('JSON.stringify(document.querySelector("#copilot-log").innerText)'),'providerScope':'Reglas locales: preview sin proveedor IA configurado; no se emitió request de contexto API'},ensure_ascii=False,indent=2))
 d=data();history=d['landing']['history'];ck('Registro de vuelo conserva orden UTC y SIM',all(a['utc']<=b['utc'] and a['simSeconds']<=b['simSeconds'] for a,b in zip(history,history[1:])))
 act('document.querySelector("#nasa-explorer details").open=true;document.querySelector("[data-nasa-tab=gallery]").click();document.querySelector("[data-nasa-model=moon]").click();document.querySelector("[data-nasa-stage]").scrollIntoView({block:"center"})')
 assert wait('document.querySelector("[data-nasa-stage]").dataset.load==="ready"',20)
 ck('Galería NASA carga archivo real sin cambiar misión',data()['landing']['missionId']==d['landing']['missionId'])
 shot('desktop-nasa-conservada.png','#nasa-explorer');act('document.querySelector("#nasa-explorer details").open=false')
 click('[data-flight-reset]');click('[data-flight-rate="4"]');click('[data-flight-action]');phase('descent')
 act('window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}))');before=data();act('window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))');after=data()
 ck('Pagehide/pageshow conserva sesión y pausa vuelo',before['landing']['missionId']==after['landing']['missionId'] and before['landing']['runs']==after['landing']['runs'] and ev('JSON.stringify(document.querySelector("#landing-panel").dataset.paused==="true")'))
if mode in ['all','--motion-only']:
 boot(True);cmd('set','media','--page',PAGE,'--reduced-motion','reduce');select('wind-canyon')
 ck('Preferencia real reduced-motion desactiva animaciones',ev('JSON.stringify(matchMedia("(prefers-reduced-motion: reduce)").matches&&getComputedStyle(document.querySelector(".landing-status")).animationName==="none")'))
 click('[data-flight-rate="4"]');click('[data-flight-action]');phase('descent');pause();d=data()
 ck('Reduced-motion conserva descenso deliberado y puerta manual',d['landing']['runs']['target']['simSeconds']>0 and d['rover']['distanceM']==0)
 shot('movil-movimiento-reducido.png','.landing-command');cmd('set','media','--page',PAGE,'--reduced-motion','no-preference')
 act('window.phaseAnimations=[];new MutationObserver(()=>{const a=document.querySelector(".landing-status").getAnimations();if(a.length)phaseAnimations.push({phase:document.querySelector("#landing-panel").dataset.phase,count:a.length})}).observe(document.querySelector("#landing-panel"),{attributes:true,attributeFilter:["data-phase"]})')
 click('[data-flight-reset]');click('[data-flight-rate="4"]');click('[data-flight-action]');phase('descent');pause()
 ck('Animación de llegada se reproduce por fase sin reflow forzado',ev('JSON.stringify(phaseAnimations.some(e=>e.phase==="preparation")&&phaseAnimations.some(e=>e.phase==="descent"))'))
if mode in ['all','--fallback-only']:
 boot()
 for case in ['missing-target','missing-earth','webgl']:
  # Use a real top-level document: this host marks srcdoc iframes hidden independently
  # of the selected visible tab. Do not override document.hidden or flight pause logic.
  hook="const originalFetch=window.fetch;window.fetch=(url,...args)=>/assets\\/data\\/(scenarios\\/earth\\/|la-corona\\.json)/.test(String(url))?Promise.resolve(new Response('',{status:404})):originalFetch(url,...args);" if case=='missing-earth' else "const ctx=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:ctx.call(this,type,...args)};"
  if case=='missing-target':hook="const originalFetch=window.fetch;window.fetch=(url,...args)=>/assets\\/data\\/scenarios\\/targets\\//.test(String(url))?Promise.resolve(new Response('',{status:404})):originalFetch(url,...args);"
  code=r'''(async()=>{const base=SOURCE,html=await(await fetch(base)).text();const injected=html.replace('<head>','<head><base href="'+base+'"><script>'+HOOK+'<\/script>');const url=URL.createObjectURL(new Blob([injected],{type:'text/html'}));setTimeout(()=>location.href=url,80);return JSON.stringify(true)})()'''.replace('SOURCE',json.dumps(URL)).replace('HOOK',json.dumps(hook))
  assert ev(code)
  assert wait('location.protocol==="blob:"&&document.querySelectorAll(".scenario-button").length===4',20)
  cmd('viewport','--page',PAGE,'--width','1440','--height','1000');hooks()
  click('[data-scenario=lava-tube]')
  assert wait('!document.querySelector("[data-flight-action]").disabled&&(document.querySelectorAll(".landing-zone").length===3||document.querySelector(".landing-missing"))',20)
  if case=='missing-target':
   act('for(const selector of ["#launch-mission","#mission-play","[data-flight-action]","#landing-scene-action","[data-preparation-next]","[data-preparation-confirm]"])document.querySelector(selector).click()')
   ck('Sin DEM target no confirma ni fuerza vuelo',ev('JSON.stringify(document.querySelector("#landing-panel").dataset.phase==="ready"&&document.querySelector("#landing-panel").dataset.prepared==="false"&&document.querySelector("[data-preparation-next]").disabled&&document.querySelector("[data-preparation-confirm]").disabled)'))
   shot('missing-target.png','[data-preparation-dialog]');continue
  click('[data-flight-rate="4"]');click('[data-flight-action]');phase('contact');d=data()
  ck(case+' destino aterriza sin dependencia Earth/WebGL',d['landing']['runs']['target']['phase']=='contact' and d['landing']['runs']['earth'] is None)
  click('[data-flight-action]');phase('exploration');d=data()
  if case=='missing-earth':ck('Sin Earth DEM despliega target y explica espejo no disponible',d['landing']['explorationOrigins']['earth'] is None and d['targetRover'] is None and d['rover']['available'] is False and d['rover']['x'] is None and d['rover']['z'] is None and not d['path'] and ev('JSON.stringify(document.querySelector("#split-target-kind").textContent.includes("NAVE DEL DESTINO")&&document.querySelector("[data-flight-action]").textContent==="Espejo no disponible"&&document.querySelector("#rover-mirror-legend").textContent.includes("no disponible"))'))
  else:ck('Fallback WebGL real mantiene controles, radar y espejo',ev('JSON.stringify(document.querySelector("#atlas-scene").hidden&&!document.querySelector("#scene-fallback").hidden)') and d['targetRover'] is not None)
  (OUT/(case+'-mission.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2));shot(case+'.png')
# Always leave a clean editable target preparation, flight 1x, no Earth comparison.
boot();select('lava-tube');shot('preview-final.png','.viewport-heading')
ck('Preview listo: target solo, 1×, carga 100 %, preparación limpia',ev('JSON.stringify(document.querySelector("#landing-panel").dataset.phase==="ready"&&document.querySelector("#scene-viewport").dataset.comparison==="false"&&document.querySelector("[data-flight-fuel]").value==="100")'))
print(json.dumps({'passed':len(checks),'report':str(RESULT)},ensure_ascii=False),flush=True)
