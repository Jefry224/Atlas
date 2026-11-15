#!/usr/bin/env python3
"""Supplemental real-browser lifecycle checks for the NASA stages, using the same pinned Orca page."""
import argparse, json, subprocess
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--page',required=True);args=parser.parse_args();checks=[];unavailable=[]
root=Path(__file__).resolve().parents[1];dest=root/'docs/evidencias/nasa-3d/lifecycle-results.json'
def command(*argv):
    p=subprocess.run(['orca-ide',*argv,'--json'],text=True,capture_output=True,timeout=60);d=json.loads(p.stdout);assert d.get('ok'),d;return d['result']
def js(code):
    value=command('eval','--page',args.page,'--expression',f'(()=>eval({json.dumps(code)}))()')['result'];return json.loads(value) if isinstance(value,str) else value
def check(name,code):
    assert js(code) is True,name;checks.append(name);dest.write_text(json.dumps({'passed':len(checks),'checks':checks,'unavailable':unavailable},ensure_ascii=False,indent=2)+'\n');print('PASS '+name,flush=True)
command('reload','--page',args.page)
command('wait','--page',args.page,'--selector','[data-scenario=hyperarid-salt]')
js('document.querySelector("[data-scenario=hyperarid-salt]").click();JSON.stringify(true)')
command('viewport','--page',args.page,'--width','1440','--height','1000')
js('document.querySelector("[data-nasa-bench]").scrollIntoView({block:"start"});JSON.stringify(true)')
command('wait','--page',args.page,'--selector','[data-bench-stage][data-load=ready]')
js('document.querySelector("[data-nasa-bench]").scrollIntoView({block:"start"});window.nasaDraws=0;window.nativeNasaRAF=requestAnimationFrame;window.requestAnimationFrame=callback=>{if(String(callback).includes("this.draw(time)"))window.nasaDraws++;return window.nativeNasaRAF(callback);};document.querySelector("[data-bench-motion]").click();JSON.stringify(true)')
check('Rotación opt-in genera cuadros mientras escena visible','(async()=>{await new Promise(r=>setTimeout(r,250));return JSON.stringify(window.nasaDraws>=2 && document.querySelector("[data-bench-motion]").getAttribute("aria-pressed")==="true");})()')
check('IntersectionObserver detiene cuadros fuera de vista','(async()=>{scrollTo(0,0);await new Promise(r=>setTimeout(r,180));const count=window.nasaDraws;await new Promise(r=>setTimeout(r,220));return JSON.stringify(window.nasaDraws===count);})()')
check('Escena visible reanuda su rotación sin crear otro renderer','(async()=>{const canvas=document.querySelector("[data-bench-stage] canvas"),count=window.nasaDraws;document.querySelector("[data-nasa-bench]").scrollIntoView({block:"start"});await new Promise(r=>setTimeout(r,250));return JSON.stringify(window.nasaDraws>count && canvas===document.querySelector("[data-bench-stage] canvas"));})()')
# Use actual tab visibility; document.hidden is read-only in the Orca browser.
background=command('tab','create','--url','about:blank')['browserPageId']
try:
    command('tab','switch','--page',background)
    if not js('JSON.stringify(document.hidden)'):
        unavailable.append('Orca no expone document.hidden=true al cambiar de pestaña; suspensión nativa por visibilidad no verificable en este runtime.')
        print('UNAVAILABLE document.hidden en pestaña de fondo de Orca',flush=True)
    else:
        check('Documento en segundo plano detiene cuadros', '(async()=>{await new Promise(r=>setTimeout(r,150));const count=window.nasaDraws;await new Promise(r=>setTimeout(r,200));return JSON.stringify(window.nasaDraws===count);})()')
finally:
    command('tab','close','--page',background)
    command('tab','switch','--page',args.page)
check('Modo estático sin rotación dibuja solo por demanda','(async()=>{document.querySelector("[data-bench-motion]").click();await new Promise(r=>setTimeout(r,150));const count=window.nasaDraws;await new Promise(r=>setTimeout(r,220));return JSON.stringify(window.nasaDraws===count && document.querySelector("[data-bench-motion]").getAttribute("aria-pressed")==="false");})()')
js('window.requestAnimationFrame=window.nativeNasaRAF;JSON.stringify(true)')
check('Preferencia de movimiento reducido desactiva rotación desde el montaje','(async()=>{const native=window.matchMedia;window.matchMedia=query=>{if(query.includes("prefers-reduced-motion")){const events=new EventTarget();return {matches:true,media:query,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};}return native(query);};const {createNasaBench}=await import("./src/audit/nasa-bench.mjs");const root=document.createElement("div");document.body.append(root);let bench;try{bench=createNasaBench(root);const b=root.querySelector("[data-bench-motion]");b.click();return JSON.stringify(b.disabled && b.getAttribute("aria-pressed")==="false");}finally{window.matchMedia=native;bench?.dispose();root.remove();}})()')
# The highlights show current formula results, not values derived from the mesh.
js('for(const [id,value]of Object.entries({"audit-area":"2","audit-surface":"300","audit-air":"280","audit-h":"10","audit-emissivity":"0.8","audit-surroundings":"250"})){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event("input",{bubbles:true}));}document.querySelector("[data-audit-factor=heat-transfer]").click();JSON.stringify(true)')
check('Superficies muestran Q_conv/Q_rad reales y área del usuario','JSON.stringify(document.querySelector("[data-bench-factor-note]").textContent.includes("400 W") && document.querySelector("[data-bench-factor-note]").textContent.includes("380,48 W") && document.querySelector("[data-bench-factor-note]").textContent.includes("2 m²"))')
js('document.querySelector(".nasa-explorer-details").open=true;document.querySelector("#nasa-explorer").scrollIntoView({block:"start"});JSON.stringify(true)')
command('wait','--page',args.page,'--selector','[data-nasa-stage][data-load=ready]')
js('document.querySelector("[data-nasa-model=moon]").click();document.querySelector("[data-nasa-model=mars]").click();document.querySelector("[data-nasa-model=lro]").click();JSON.stringify(true)')
command('wait','--page',args.page,'--selector','[data-nasa-stage][data-asset=lro][data-load=ready]')
check('Cambios rápidos de modelos descartan cargas antiguas por token','(async()=>{await new Promise(r=>setTimeout(r,200));return JSON.stringify(document.querySelector("[data-nasa-stage]").dataset.asset==="lro" && document.querySelector("#nasa-resource-title").textContent==="LRO" && document.querySelector("[data-nasa-model=lro]").getAttribute("aria-pressed")==="true");})()')
js('document.querySelector("[data-nasa-tab=moon]").click();JSON.stringify(true)')
command('wait','--page',args.page,'--selector','[data-nasa-stage][data-asset=moon-coordinates][data-load=ready]')
centers={name:json.loads((root/f'assets/data/scenarios/targets/{name}.json').read_text())['center'] for name in ['marius-hills','shackleton']}
check('Registro 2D independiente coincide con lat/lon de los marcadores del globo',f'JSON.stringify([...document.querySelectorAll("[data-nasa-map-marker]")].every(b=>{{const [lat,lon]={json.dumps(centers)}[b.dataset.nasaMapMarker];return Math.abs(parseFloat(b.style.left)-(lon+180)/360*100)<0.0001 && Math.abs(parseFloat(b.style.top)-(90-lat)/180*100)<0.0001;}}))')
check('Raycast del marcador 3D abre Marius Hills', '(async()=>{await new Promise(r=>setTimeout(r,150));const h=document.querySelector("[data-nasa-stage]"),r=h.getBoundingClientRect(),options={clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,button:0};h.dispatchEvent(new PointerEvent("pointerdown",options));h.dispatchEvent(new PointerEvent("pointerup",options));return JSON.stringify(document.querySelector("[data-scenario=lava-tube]").getAttribute("aria-pressed")==="true");})()')
js('document.querySelector("[data-nasa-target=shackleton]").click();JSON.stringify(true)')
check('Objetivo polar Shackleton abre escenario correcto conservando cuerpo lunar','JSON.stringify(document.querySelector("[data-scenario=polar-shadow]").getAttribute("aria-pressed")==="true" && document.querySelector("#audit-body").value==="moon")')
js('document.querySelector("[data-nasa-tab=mars]").click();JSON.stringify(true)')
command('wait','--page',args.page,'--selector','[data-nasa-stage][data-asset=mars-coordinates][data-load=ready]')
js('document.querySelector("[data-nasa-map-marker=valles-marineris]").click();JSON.stringify(true)')
check('Marcador del mapa Coprates abre cuarto escenario y reinicia banco','JSON.stringify(document.querySelector("[data-scenario=wind-canyon]").getAttribute("aria-pressed")==="true" && document.querySelector("#bench-mode").value==="offload" && document.querySelector("#audit-h").value==="")')
# Restore a clean review state and keep the preview alive.
js('document.querySelector(".nasa-explorer-details").open=false;document.querySelector("[data-scenario=hyperarid-salt]").click();document.querySelector("[data-nasa-bench]").scrollIntoView({block:"start"});JSON.stringify(true)')
print(json.dumps({'passed':len(checks),'evidence':str(dest)},ensure_ascii=False),flush=True)
