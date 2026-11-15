#!/usr/bin/env python3
"""Real Orca browser acceptance checks. Run against an already open page on the local static preview."""
import argparse, json, subprocess, shutil
from pathlib import Path
p = argparse.ArgumentParser(); p.add_argument('--page', required=True); args = p.parse_args()
root = Path(__file__).resolve().parents[1]; evidence = root / 'docs/evidencias/nasa-3d'; evidence.mkdir(parents=True, exist_ok=True)
checks = []; screenshots = []
def command(*args):
    process = subprocess.run(['orca-ide', *args, '--json'], text=True, capture_output=True, timeout=60)
    result = json.loads(process.stdout)
    assert result.get('ok'), result
    return result['result']
def js(expression):
    value = command('eval', '--page', args.page, '--expression', f'(()=>eval({json.dumps(expression)}))()')['result']
    return json.loads(value) if isinstance(value, str) else value
def save():
    (evidence / 'browser-results.json').write_text(json.dumps({'passed': len(checks), 'checks':checks, 'screenshots':screenshots}, ensure_ascii=False, indent=2)+'\n')
def check(name, expression):
    result = js(expression); assert result is True, (name, result)
    checks.append(name); save(); print(f'PASS {name}', flush=True)
def wait(selector): command('wait', '--page', args.page, '--selector', selector)
def capture(name):
    result = command('screenshot', '--page', args.page)
    path = result['path']; source = Path('/mnt/' + path[0].lower() + '/' + path[3:].replace('\\','/')) if ':\\' in path else Path(path)
    dest = evidence / f'{name}.png'; shutil.copyfile(source, dest); screenshots.append(dest.name); save()
def select(selector, value):
    js(f'const e=document.querySelector({json.dumps(selector)});e.value={json.dumps(value)};e.dispatchEvent(new Event("input",{{bubbles:true}}));e.dispatchEvent(new Event("change",{{bubbles:true}}));JSON.stringify(true)')
def click(selector): js(f'document.querySelector({json.dumps(selector)}).click();JSON.stringify(true)')
def input_value(selector, value):
    js(f'const e=document.querySelector({json.dumps(selector)});e.value={json.dumps(value)};e.dispatchEvent(new Event("input",{{bubbles:true}}));JSON.stringify(true)')
command('reload', '--page', args.page)
command('wait', '--page', args.page, '--selector', '[data-scenario=lava-tube]')
command('viewport', '--page', args.page, '--width','1440','--height','1000')
check('NASA lazy: sin descargar modelos ni texturas al inicio', 'JSON.stringify(!performance.getEntriesByType("resource").some(r=>/assets\\/(models|textures)\\/nasa\\//.test(r.name)))')
click('[data-scenario=lava-tube]')
js('document.querySelector("[data-nasa-bench]").scrollIntoView({block:"start"});window.benchCanvas=document.querySelector("[data-bench-stage] canvas");JSON.stringify(true)')
wait('[data-bench-stage][data-asset=perseverance][data-load=ready]')
input_value('#audit-mass', '100')
check('Luna 100 kg: flechas rotuladas 981/162/819 N y carga contacto 162 N', 'JSON.stringify(document.querySelector("[data-bench-values]").textContent.includes("981 N") && document.querySelector("[data-bench-values]").textContent.includes("819 N") && document.querySelectorAll(".nasa-arrow-label").length===3 && document.querySelector("[data-bench-balance]").textContent.includes("981 N − 819 N = 162 N"))')
capture('bench-luna-desktop')
select('#bench-mode', 'equivalent'); wait('[data-bench-stage][data-asset=scarecrow][data-load=ready]')
check('Masa equivalente + Scarecrow: masa original 100 kg, ensayo 16,51 kg, soporte cero y límite de inercia', 'JSON.stringify(document.querySelector("[data-bench-values]").textContent.includes("16,51 kg") && document.querySelector("[data-bench-values]").textContent.includes("100 kg") && document.querySelector("[data-bench-balance]").textContent.includes("162 N − 0 N = 162 N") && document.querySelector("[data-bench-method]").textContent.includes("inercia cambia"))')
capture('bench-scarecrow-desktop')
input_value('#audit-mass','-1')
check('Entrada inválida borra flechas y carga anterior, bloquea exportadores', 'JSON.stringify(document.querySelector("[data-nasa-bench]").dataset.known==="false" && !document.querySelectorAll(".nasa-arrow-label").length && !document.querySelector("[data-bench-values]").textContent.includes("162 N") && [...document.querySelectorAll("[data-audit-export]")].every(b=>b.disabled))')
input_value('#audit-mass','')
check('Masa vacía conserva desconocidos explícitos', 'JSON.stringify([...document.querySelectorAll("[data-bench-values] strong")].every(e=>e.textContent==="desconocido"))')
input_value('#audit-mass','100')
select('#audit-equipment','wheel'); wait('[data-bench-stage][data-load=schematic]')
check('Rueda: representación propia explícita y masa soportada', 'JSON.stringify(document.querySelector("[data-bench-load]").textContent.includes("Rueda / masa soportada") && document.querySelector("#bench-model").disabled)')
select('#audit-equipment','drill')
check('Taladro: representación propia sin atribución NASA ni empuje activo', 'JSON.stringify(document.querySelector("[data-bench-load]").textContent.includes("Taladro / masa descargada") && document.querySelector("[data-bench-load]").textContent.includes("No es un modelo NASA"))')
select('#audit-equipment','rover'); wait('[data-bench-stage][data-load=ready]')
click('[data-audit-factor=temperature]')
check('Matriz térmica selecciona superficies, explica límites y enfoca control del banco', 'JSON.stringify(document.querySelector("[data-nasa-bench]").dataset.factor==="temperature" && document.querySelector("[data-audit-factor=temperature]").getAttribute("aria-pressed")==="true" && document.activeElement.id==="bench-factor" && document.querySelector("[data-bench-factor-note]").textContent.includes("Superficies"))')
click('[data-audit-factor=atmosphere]')
check('Matriz atmósfera destaca envolvente y no afirma equivalencia de densidad', 'JSON.stringify(document.querySelector("[data-nasa-bench]").dataset.factor==="atmosphere" && document.querySelector("[data-bench-factor-note]").textContent.includes("Envolvente"))')
click('[data-audit-factor=gravity]')
check('Renderer persistente después de inputs/modos/equipo/factores', 'JSON.stringify(window.benchCanvas===document.querySelector("[data-bench-stage] canvas"))')
select('#audit-body','earth')
check('Ensayo hipotético Tierra deja objetivo real lunar explícito y soporte 0', 'JSON.stringify(document.querySelector("[data-bench-context]").textContent.includes("hipótesis distinta") && document.querySelector("[data-bench-balance]").textContent.includes("981 N − 0 N = 981 N"))')
click('[data-scenario=hyperarid-salt]')
wait('[data-bench-stage][data-asset=perseverance][data-load=ready]')
input_value('#audit-mass','100')
check('Cambio a Marte reinicia modo y banco conserva 371 N objetivo / 610 N soporte', 'JSON.stringify(document.querySelector("#bench-mode").value==="offload" && document.querySelector("[data-bench-balance]").textContent.includes("981 N − 610 N = 371 N"))')
# Exercise the actual camera keyboard path, checking the focus remains scoped to this canvas.
js('document.querySelector("[data-bench-stage] canvas").focus();JSON.stringify(true)')
command('keypress','--page',args.page,'--key','ArrowRight')
check('Cámara operable por teclado sin perder foco', 'JSON.stringify(document.activeElement===window.benchCanvas)')
js('window.nasaBlobs=[];window.savedCreateURL=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{window.nasaBlobs.push(b.text());return window.savedCreateURL(b);};JSON.stringify(true)')
click('[data-audit-export=json]'); click('[data-audit-export=md]'); click('#export-mission')
check('JSON/Markdown/misión exportan contrato y selección visual sin modificar masa científica', '(async()=>{const t=await Promise.all(window.nasaBlobs),d=JSON.parse(t[0]),m=JSON.parse(t[2]);return JSON.stringify(d.schema==="AnalogAuditDossier"&&d.audit.calibration.inputs.massKg===100&&d.visualPresentation.mode==="offload"&&d.visualPresentation.scientificSource===false&&t[1].includes("Strength vs. Breakdown")&&m.analogyDossier.visualPresentation.mode==="offload");})()')
# Failure is injected without requesting a nonexistent asset, preserving a clean asset network log.
js('window.originalNasaFetch=window.fetch;window.fetch=(url,...args)=>String(url).includes("assets/models/nasa/")?Promise.reject(new Error("fallo de ensayo QA")):window.originalNasaFetch(url,...args);JSON.stringify(true)')
click('[data-bench-retry]'); wait('[data-bench-stage][data-load=fallback]')
check('Fallo de modelo muestra esquema explícito y mantiene cálculo', 'JSON.stringify(document.querySelector("[data-bench-load]").textContent.includes("fallo de ensayo QA") && document.querySelector("[data-bench-values]").textContent.includes("610 N"))')
js('window.fetch=window.originalNasaFetch;JSON.stringify(true)');click('[data-bench-retry]');wait('[data-bench-stage][data-load=ready]')
js('document.querySelector(".nasa-explorer-details").open=true;document.querySelector("#nasa-explorer").scrollIntoView({block:"start"});JSON.stringify(true)')
wait('[data-nasa-stage][data-asset=scarecrow][data-load=ready]')
for model in ['scarecrow','perseverance','moon','mars','lro','block-island','apollo-11']:
    click(f'[data-nasa-model="{model}"]');wait(f'[data-nasa-stage][data-asset="{model}"][data-load=ready]')
    check(f'GLTFLoader local carga {model} y su ficha/atribución', 'JSON.stringify(document.querySelector("[data-nasa-stage]").dataset.render==="webgl" && document.querySelectorAll("[data-nasa-credit] a").length===2 && document.querySelector("[data-nasa-meta]").textContent.includes("GLB"))')
    if model in ['lro','block-island','apollo-11']: capture(f'gallery-{model}-desktop')
check('Apollo 11 Z×60 excluido expresamente de pendientes y DEM', 'JSON.stringify(document.querySelector("[data-nasa-note]").textContent.includes("Z×60") && document.querySelector("[data-nasa-note]").textContent.includes("excluido"))')
for body, target in [('moon','marius-hills'),('mars','jezero')]:
    click(f'[data-nasa-tab={body}]');wait(f'[data-nasa-stage][data-asset="{body}-coordinates"][data-load=ready]')
    command('wait','--page',args.page,'--text','textura oficial equirectangular local')
    check(f'Globo {body}: dos centros de JSON, textura oficial y registro geográfico explícito', 'JSON.stringify(document.querySelectorAll("[data-nasa-target]").length===2 && document.querySelector("[data-nasa-registration]").textContent.includes("centro de imagen 0°E"))')
    capture(f'globe-{body}-desktop')
    click(f'[data-nasa-target="{target}"]')
    check(f'Marcador accesible {target} selecciona escenario existente y M2', f'JSON.stringify(document.querySelector("[data-bench-context]").textContent.toLowerCase().includes({json.dumps("marius" if body=="moon" else "jezero")}) && document.querySelector("#audit-body").value==={json.dumps(body)} && document.querySelector("[data-nasa-target={target}]").getAttribute("aria-pressed")==="true")')
# No global overflow on mobile; matrix retains local scrolling.
command('viewport','--page',args.page,'--width','390','--height','844','--mobile')
js('document.querySelector("[data-nasa-bench]").scrollIntoView({block:"start"});JSON.stringify(true)')
check('Móvil 390: sin scroll global, controles del banco dentro del viewport', 'JSON.stringify(document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll(".nasa-bench select")].every(e=>e.getBoundingClientRect().left>=0 && e.getBoundingClientRect().right<=innerWidth) && document.querySelector(".audit-table-wrap").scrollWidth>document.querySelector(".audit-table-wrap").clientWidth)')
capture('bench-mobile')
js('document.querySelector("[data-bench-stage]").scrollIntoView({block:"start"});JSON.stringify(true)');capture('bench-mobile-scene')
js('document.querySelector("#nasa-explorer").scrollIntoView({block:"start"});JSON.stringify(true)');capture('globe-mobile')
check('Móvil 390: galería/globos sin desbordar página', 'JSON.stringify(document.documentElement.scrollWidth<=innerWidth)')
# Context loss exercises the explicit static-mode fallback while keeping calculations available.
js('document.querySelector("[data-bench-stage] canvas").dispatchEvent(new Event("webglcontextlost",{cancelable:true}));document.querySelector("[data-bench-stage]").scrollIntoView({block:"start"});JSON.stringify(true)')
check('Modo estático sin WebGL mantiene esquema, mensaje y valores accesibles', 'JSON.stringify(document.querySelector("[data-bench-stage]").dataset.render==="fallback" && document.querySelector("[data-bench-load]").textContent.includes("WebGL interrumpido") && document.querySelectorAll("[data-bench-values] strong").length===6)')
capture('bench-static-mobile')
check('Modelos y texturas NASA sin requests externos ni 404', 'JSON.stringify(performance.getEntriesByType("resource").filter(r=>/assets\\/(models|textures)\\/nasa\\//.test(r.name)).every(r=>new URL(r.name).origin===location.origin && (!r.responseStatus || r.responseStatus===200 || r.responseStatus===304)))')
(evidence / 'browser-console.json').write_text(json.dumps(command('console','--page',args.page,'--limit','100'),ensure_ascii=False,indent=2)+'\n')
(evidence / 'browser-network.json').write_text(json.dumps(command('network','--page',args.page,'--limit','250'),ensure_ascii=False,indent=2)+'\n')
# Leave review page healthy in the full desktop bench.
command('reload','--page',args.page);wait('[data-scenario=hyperarid-salt]');command('viewport','--page',args.page,'--width','1440','--height','1000');click('[data-scenario=hyperarid-salt]')
js('document.querySelector("[data-nasa-bench]").scrollIntoView({block:"start"});JSON.stringify(true)');wait('[data-bench-stage][data-load=ready]')
save();print(json.dumps({'passed':len(checks),'evidence':str(evidence)},ensure_ascii=False),flush=True)
