#!/usr/bin/env python3
"""Pruebas de navegador del inspector M2. Requiere Playwright y un servidor local.

python scripts/qa-bench-inspector.py --url http://127.0.0.1:8043
Meteorología controlada y forecast archivado: no verifica disponibilidad del proveedor.
"""
import argparse
import asyncio
import copy
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8043')
parser.add_argument('--output', type=Path, default=ROOT / 'docs/evidencias/m2-inspector')
parser.add_argument('--serve', action='store_true', help='Servir el repositorio durante la prueba y cerrar el servidor al terminar')
args = parser.parse_args()
FORECAST = json.loads((ROOT / 'assets/data/processes-forecast-snapshot.json').read_text())
SCENARIOS = json.loads((ROOT / 'assets/data/scenarios.json').read_text())['scenarios']
checks, errors = [], []

def check(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)

async def main():
    args.output.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        chromium = os.environ.get('CHROMIUM_EXECUTABLE') or next(iter(Path.home().glob('.cache/ms-playwright/chromium-*/chrome-linux64/chrome')), p.chromium.executable_path)
        browser = await p.chromium.launch(executable_path=str(chromium), headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
        async def telemetry(route):
            q = parse_qs(urlparse(route.request.url).query)
            now = datetime.now(timezone.utc).isoformat()
            await route.fulfill(json={'site': q['site'][0], 'lat': float(q['lat'][0]), 'lon': float(q['lon'][0]), 'observedAt': now, 'fetchedAt': now, 'provider': 'open-meteo', 'live': True, 'cached': False, 'ageSeconds': 0, 'observationAgeSeconds': 0, 'values': {'solarRadiationWm2': 800, 'temperatureC': 20, 'windSpeedMs': 4, 'windGustMs': 8, 'relativeHumidityPct': 25, 'cloudCoverPct': 10, 'surfacePressurePa': 97500, 'windDirDeg': 225, 'precipMm': .4}, 'source': {'label': 'MOCK QA inspector M2', 'url': 'https://open-meteo.com/en/docs'}})
        async def forecast(route):
            site = parse_qs(urlparse(route.request.url).query).get('site', ['atacama'])[0]
            body = copy.deepcopy(FORECAST[site]); body.update(provider='snapshot', live=False)
            await route.fulfill(json=body)
        await ctx.route('**/api/health', lambda r: r.fulfill(json={'status': 'ok', 'version': 'qa-inspector', 'providers': {'ai': 'none'}}))
        await ctx.route('**/api/telemetry?*', telemetry)
        await ctx.route('**/api/processes/forecast?*', forecast)
        page = await ctx.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.add_locator_handler(page.locator('[data-preparation-dialog][open]'), lambda: page.locator('[data-preparation-close]').click())
        await page.goto(args.url, wait_until='domcontentloaded')

        async def close_dialog():
            # La preparación de descenso es otra herramienta; el inspector se opera fuera del modal.
            await page.evaluate("document.querySelector('[data-preparation-dialog][open]')?.close()")
        async def select_scenario(scenario):
            await close_dialog()
            await page.locator(f'[data-scenario="{scenario}"]').click()
            await page.wait_for_selector('[data-nasa-bench][data-known=true]')
            await close_dialog()
            await page.locator('#view-split').click()
            await page.wait_for_function('document.querySelector("[data-m2-origins]").textContent.includes("97.500") || document.querySelector("[data-m2-origins]").textContent.includes("97500")')
            await page.locator('#bench-factor').select_option('geometry')
            await page.wait_for_function('document.querySelector("[data-bench-legend]").textContent.split("Rejilla real").length === 3')
            await close_dialog()
            await page.locator('[data-nasa-bench]').scroll_into_view_if_needed()
        async def dossier():
            await close_dialog()
            async with page.expect_download() as info:
                await page.locator('[data-audit-export=json]').click()
            return json.loads(Path(await (await info.value).path()).read_text())
        async def capture(name):
            await close_dialog()
            await page.locator('[data-nasa-bench]').screenshot(path=str(args.output / f'{name}.png'))

        await select_scenario('lava-tube')
        initial = await dossier()
        await page.locator('#bench-factor').select_option('gravity')
        await page.wait_for_selector('[data-bench-stage][data-load=ready]')
        check('Gravedad: tres vectores de balance y unidades N', await page.locator('[data-bench-stage]').get_attribute('data-vectors') == '3' and 'W − F = N' in await page.locator('[data-bench-balance]').inner_text())
        await capture('gravedad-soporte')
        await page.locator('#bench-mode').select_option('equivalent')
        await page.wait_for_selector('[data-bench-stage][data-asset=scarecrow][data-load=ready]')
        check('Masa equivalente: desaparece el soporte y se explica la inercia', await page.locator('[data-bench-stage]').get_attribute('data-vectors') == '2' and 'inercia' in await page.locator('[data-bench-method]').inner_text())
        await capture('gravedad-masa-equivalente')

        titles = set()
        for factor in ['gravity', 'pressure', 'temperature', 'heat-transfer', 'geometry', 'scale', 'atmosphere', 'radiation', 'regolith']:
            await page.locator('#bench-factor').select_option(factor)
            titles.add(await page.locator('[data-bench-title]').inner_text())
            check(f'{factor}: lectura, utilidad y siguiente paso propios', all([await page.locator(s).inner_text() for s in ['[data-bench-factor-note]', '[data-bench-benefit]', '[data-bench-next]']]))
            check(f'{factor}: método habilitado solo para carga/contacto', await page.locator('#bench-mode').is_disabled() == (factor not in ['gravity', 'regolith']))
            if factor == 'pressure':
                check('Presión: 97500 Pa frente a vacío ideal, sin flechas de peso', await page.locator('[data-bench-stage]').get_attribute('data-vectors') == '5' and 'log(1' in await page.locator('[data-bench-balance]').inner_text())
                await capture('presion')
            if factor in ['temperature', 'heat-transfer']:
                check(f'{factor}: valor actual desconocido no se inventa', 'Sin dato' in await page.locator('[data-bench-values]').inner_text())
                await page.locator('#bench-source').select_option('design')
                check(f'{factor}: diseño propuesto identificado', await page.locator('[data-nasa-bench]').get_attribute('data-source') == 'design' and 'PROPUESTA' in await page.locator('[data-bench-scope]').inner_text())
                if factor == 'heat-transfer':
                    check('Diseño térmico produce dos flujos en W', await page.locator('[data-bench-stage]').get_attribute('data-vectors') == '2')
                    await capture('termica-propuesta')
                else:
                    await page.locator('#bench-source').select_option('mission')
            if factor in ['temperature', 'radiation', 'geometry', 'scale']:
                check(f'{factor}: escalares sin flechas de fuerza decorativas', await page.locator('[data-bench-stage]').get_attribute('data-vectors') == '0')
            if factor == 'geometry':
                await capture('relieve-dem')
            if factor == 'atmosphere':
                check('Atmósfera: viento meteorológico con dirección y velocidad', await page.locator('[data-bench-stage]').get_attribute('data-vectors') == '1' and '225' in await page.locator('[data-bench-values]').inner_text())
            if factor == 'radiation':
                check('Radiación: irradiancia en W/m² y dosis pendiente', '800 W/m²' in await page.locator('[data-bench-values]').inner_text() and 'Dosis ionizante objetivo' in await page.locator('[data-bench-values]').inner_text())
        check('Nueve factores producen nueve escenas explicadas', len(titles) == 9)
        after = await dossier()
        check('Explorar factores, modos y base no modifica auditoría automática', initial['audit'] == after['audit'])

        # Acceso directo al laboratorio y cambio de signo del flujo con hipótesis explícitas.
        await page.locator('#bench-factor').select_option('heat-transfer')
        await page.locator('[data-bench-configure]').click()
        check('Acción del inspector abre laboratorio y enfoca el área', await page.locator('[data-m2-manual]').get_attribute('open') is not None and await page.locator('#audit-area').evaluate('(e)=>document.activeElement===e'))
        for selector, number in {'#audit-area': '2', '#audit-surface': '260', '#audit-air': '280', '#audit-surroundings': '280', '#audit-h': '10', '#audit-emissivity': '.8'}.items():
            await page.locator(selector).fill(number)
        await page.wait_for_function('document.querySelector("[data-nasa-bench]").dataset.source === "manual"')
        check('Hipótesis frías muestran ganancia de calor negativa', '-400 W' in await page.locator('[data-bench-values]').inner_text() and await page.locator('[data-bench-stage]').get_attribute('data-vectors') == '2')
        manual = await dossier()
        check('Laboratorio manual tampoco altera reporte de misión', initial['audit'] == manual['audit'])
        await page.locator('[data-m2-manual]>summary').click()

        for scenario in SCENARIOS[1:] + SCENARIOS[:1]:
            await select_scenario(scenario['id'])
            check(f'{scenario["id"]}: dos DEM reales y modo reiniciado', 'Rejilla real' in await page.locator('[data-bench-legend]').inner_text() and await page.locator('#bench-mode').input_value() == 'offload')
        check('Movimiento reducido respeta preferencia del navegador', await page.locator('[data-bench-motion]').is_disabled())

        await page.set_viewport_size({'width': 390, 'height': 844})
        for factor in ['gravity', 'heat-transfer', 'geometry', 'scale', 'radiation']:
            await page.locator('#bench-factor').select_option(factor)
            await page.locator('[data-bench-stage]').scroll_into_view_if_needed()
            check(f'Móvil 390 px: {factor} sin desbordamiento global', await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        await capture('movil-radiacion')
        check('Sin excepciones JavaScript', not errors)
        await ctx.close()

        # Sin WebGL: una instancia aislada conserva datos y explicaciones accesibles.
        fallback = await browser.new_context(viewport={'width': 390, 'height': 844})
        await fallback.add_init_script("const get=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args)}")
        await fallback.route('**/bench-qa.html', lambda r: r.fulfill(content_type='text/html', body='<html lang="es"><link rel="stylesheet" href="styles.css"><body><main data-test-bench></main></body></html>'))
        fp = await fallback.new_page()
        await fp.goto(args.url.rstrip('/') + '/bench-qa.html', wait_until='domcontentloaded')
        await fp.evaluate("""async () => {
          const {createNasaBench}=await import('./nasa-bench.mjs');
          const {calibrateEngineering}=await import('./analog-audit.mjs');
          const bench=createNasaBench(document.querySelector('main'));
          bench.update(calibrateEngineering({massKg:100,targetBody:'moon',earthGravityMs2:9.81,targetGravityMs2:1.62}));
          document.querySelector('main').style.width='100%';
        }""")
        await fp.wait_for_selector('[data-bench-stage][data-render=fallback]')
        check('Sin WebGL: valores 981 N y utilidad del ensayo siguen accesibles', '981 N' in await fp.locator('[data-bench-values]').inner_text() and bool(await fp.locator('[data-bench-benefit]').inner_text()))
        await fallback.close(); await browser.close()
    (args.output / 'resultados.json').write_text(json.dumps({'passed': len(checks), 'checks': checks, 'pageErrors': errors, 'weather': 'MOCK controlado; forecast local archivado', 'viewports': ['1440x1000', '390x844']}, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    preview = None
    if args.serve:
        from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
        from threading import Thread
        from functools import partial
        class QuietHandler(SimpleHTTPRequestHandler):
            def log_message(self, *_args):
                pass
        endpoint = urlparse(args.url)
        if endpoint.hostname not in ['127.0.0.1', 'localhost']:
            raise ValueError('--serve requiere una URL local')
        preview = ThreadingHTTPServer((endpoint.hostname, endpoint.port or 80), partial(QuietHandler, directory=str(ROOT)))
        Thread(target=preview.serve_forever, daemon=True).start()
    try:
        asyncio.run(main())
    finally:
        if preview:
            preview.shutdown(); preview.server_close()
