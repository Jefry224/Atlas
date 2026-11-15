#!/usr/bin/env python3
"""A.R.E.S. Twin · Frente 1: Earth analogue terrain windows (docs/contracts.md §2).

For each Earth twin it builds a 65×65 grid at 37.5 m (2400 m × 2400 m) centred on the site:
  * DEM: Copernicus DEM GLO-30 (Microsoft Planetary Computer STAC, collection cop-dem-glo-30).
    The COG is read by window, warped (bilinear) to a site-centred azimuthal-equidistant grid of
    81×81 nodes at 30 m (native resolution, same 2400 m extent) and then brought to 65×65 with
    terrain_metrics.bilinear_resample. Metrics come from terrain_metrics.compute_metrics.
  * Imagery: Sentinel-2 L2A B04/B03/B02 surface reflectance of a recent clear scene (SCL-checked over the
    window), cropped to the window, linearly stretched per site (TCI saturates on snow and bright sand), JPEG.
  * Roughness proxy: Sentinel-1 RTC backscatter (gamma0, VV; HH where only HH exists) mean/std in dB.

Reproducible and cached: outputs are reused unless --force; STAC item selections and rasters are
cached under $XDG_CACHE_HOME/ares-twin-earth (default ~/.cache). A failing site never aborts the run
and nothing is synthesised.

Setup (own venv, no system GDAL needed — rasterio wheels bundle it):
  python3 -m venv --without-pip .venv-data   # (or plain venv if ensurepip is available)
  python3 -m pip --python .venv-data/bin/python install rasterio pystac-client planetary-computer numpy pillow pyproj
Run:
  .venv-data/bin/python scripts/fetch-scenarios-earth.py [--force] [site ...]
"""
import argparse, datetime, io, json, math, os, pathlib, sys, traceback

import numpy as np
import planetary_computer as pc
import pystac_client
import rasterio
from PIL import Image
from pyproj import CRS, Transformer
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from rasterio.windows import from_bounds

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from terrain_metrics import bilinear_resample, compute_metrics  # noqa: E402

OUT = ROOT / 'assets/data/scenarios/earth'
CACHE = pathlib.Path(os.environ.get('XDG_CACHE_HOME', pathlib.Path.home() / '.cache')) / 'ares-twin-earth'
STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1'

N, SPACING = 65, 37.5
EXTENT = (N - 1) * SPACING            # 2400 m
NATIVE_N, NATIVE_RES = 81, 30.0        # 80 × 30 m = 2400 m, same extent as the standard grid
IMG_PX = 768
LOOKBACK_DAYS = 400

GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif,.tiff',
                GDAL_HTTP_MULTIRANGE='YES', GDAL_HTTP_MERGE_CONSECUTIVE_RANGES='YES', VSI_CACHE='TRUE',
                GDAL_HTTP_MAX_RETRY='4', GDAL_HTTP_RETRY_DELAY='2', GDAL_HTTP_TIMEOUT='60',
                GDAL_HTTP_CONNECTTIMEOUT='20')

# Coordinates: lanzarote / wright-valley / atacama copied from data.js (not modified here).
# wadi-rum is scenario-only (contracts §1): Rum village valley between the Jebel Rum and Jebel Umm
# Ishrin sandstone massifs, inside the UNESCO Wadi Rum Protected Area.
SITES = {
    'lanzarote': dict(name='Caldera Blanca · Lanzarote', lat=29.034, lon=-13.732, provenance=[
        {'label': 'Coordenadas del sitio · data.js (ESA · Recorrido de Caldera Blanca, PANGAEA)',
         'url': 'https://www.esa.int/ESA_Multimedia/Images/2026/09/Astronauts_explore_ancient_volcano_in_Lanzarote'}]),
    'wright-valley': dict(name='Wright Valley · Valles secos de McMurdo', lat=-77.517, lon=161.833, s2Months=(12, 1, 2), provenance=[
        {'label': 'Coordenadas del sitio · data.js (Australian Antarctic Data Centre, registro geográfico)',
         'url': 'https://data.aad.gov.au/aadc/gaz/display_name.cfm?gaz_id=133876'}],
        notes=['Las coordenadas del registro AADC están redondeadas y su precisión figura como desconocida: '
               'la ventana es representativa del valle, no un punto de ensayo concreto.']),
    'atacama': dict(name='Atacama · Sitio de ensayo ARADS', lat=-24.102, lon=-70.138, provenance=[
        {'label': 'Coordenadas del sitio · data.js (Astrobiology · Ensayo ARADS y localización)',
         'url': 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10750310/'}],
        notes=['El marcador de ARADS en data.js es orientativo; la ventana muestra el entorno, no el punto exacto de perforación.']),
    'wadi-rum': dict(name='Wadi Rum · Jordania', lat=29.56, lon=35.42, provenance=[
        {'label': 'UNESCO · Wadi Rum Protected Area (sitio del Patrimonio Mundial 1377)',
         'url': 'https://whc.unesco.org/en/list/1377/'}],
        notes=['Sitio solo de escenario (no está en data.js). Centro elegido en 29.560 N, 35.420 E: valle de arena '
               '~1 km al sur de la aldea de Rum (29.57 N; desplazado para que la ventana muestre sobre todo terreno natural), entre los macizos de arenisca de Jebel Rum (oeste) y Jebel Umm Ishrin (este), '
               'dentro del área protegida de Wadi Rum. Es una elección del equipo, no un punto de ensayo publicado.']),
}

EARTH_ENV = {'gravityMs2': 9.81, 'solarConstantWm2': 1361,
             'atmosphere': 'N₂ 78 % · O₂ 21 % · ~101 kPa a nivel del mar (menor con la altitud)', 'dayLengthHours': 24}

DEM_LICENSE = 'https://spacedata.copernicus.eu/documents/20126/0/CSCDA_ESA_Mission-specific+Annex.pdf'
S1_RTC_LICENSE = 'https://creativecommons.org/licenses/by/4.0/'
SENTINEL_LICENSE = 'https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice'


def log(*a):
    print(*a, flush=True)


def catalog():
    return pystac_client.Client.open(STAC, modifier=pc.sign_inplace)


def site_crs(lat, lon):
    return CRS.from_proj4(f'+proj=aeqd +lat_0={lat} +lon_0={lon} +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs')


def window_lonlat_bbox(lat, lon, pad_m=300):
    """Geographic bbox enclosing the 2400 m window (+padding), via the local projection."""
    tr = Transformer.from_crs(site_crs(lat, lon), 'EPSG:4326', always_xy=True)
    h = EXTENT / 2 + pad_m
    pts = [tr.transform(x, y) for x in (-h, 0, h) for y in (-h, 0, h)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def warp(href, lat, lon, n, pixel, resampling, band_count=None, src_nodata=None, dst_nodata=np.nan, dtype='float32'):
    """Read only the needed blocks of a COG and warp them to a north-up local AEQD grid.
    Grid nodes are pixel centres: node (0,0) = NW corner of the window, last node = SE corner."""
    half = (n - 1) * pixel / 2
    transform = from_origin(-half - pixel / 2, half + pixel / 2, pixel, pixel)
    with rasterio.Env(**GDAL_ENV), rasterio.open(href) as src:
        nod = src_nodata if src_nodata is not None else src.nodata
        with WarpedVRT(src, crs=site_crs(lat, lon), transform=transform, width=n, height=n,
                       resampling=resampling, src_nodata=nod, nodata=dst_nodata, dtype=dtype) as vrt:
            arr = vrt.read(indexes=band_count)
            # Orientation check from the geotransform: row 0 must be north, column 0 west.
            t = vrt.transform
            assert t.a > 0 and t.e < 0 and t.b == 0 and t.d == 0, f'unexpected geotransform {t}'
            inv = Transformer.from_crs(vrt.crs, 'EPSG:4326', always_xy=True)
            nw = inv.transform(*(t * (0.5, 0.5)))
            sw = inv.transform(*(t * (0.5, n - 0.5)))
            ne = inv.transform(*(t * (n - 0.5, 0.5)))
            assert nw[1] > sw[1], 'row 0 is not north'
            dlon = (ne[0] - nw[0] + 540) % 360 - 180
            assert dlon > 0, 'column 0 is not west'
            return arr, {'nw': nw, 'ne': ne, 'sw': sw}


def cached_json(key, fn):
    p = CACHE / f'{key}.json'
    if p.exists():
        return json.loads(p.read_text())
    val = fn()
    CACHE.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(val))
    return val


def item_record(it):
    return {'id': it.id, 'collection': it.collection_id, 'datetime': it.properties.get('datetime'),
            'properties': {k: it.properties.get(k) for k in ('eo:cloud_cover', 'sat:orbit_state', 'sat:relative_orbit',
                                                              'sar:polarizations', 'platform', 's2:processing_baseline')},
            'assets': {k: a.href.split('?')[0] for k, a in it.assets.items() if k in ('data', 'visual', 'SCL', 'B02', 'B03', 'B04', 'vv', 'vh', 'hh', 'hv')}}


def sign(href):
    return pc.sign(href)


# ---------------------------------------------------------------- DEM
def _dem_native_window(lat, lon, items, native_n=NATIVE_N):
    if not items:
        raise RuntimeError('cop-dem-glo-30: no tile covers this window')
    if len(items) == 1:
        native, corners = warp(sign(items[0]['assets']['data']), lat, lon, native_n, NATIVE_RES, Resampling.bilinear, 1)
    else:  # window straddles tile borders: fill node by node from each tile
        native = np.full((native_n, native_n), np.nan, dtype='float32')
        for it in items:
            part, corners = warp(sign(it['assets']['data']), lat, lon, native_n, NATIVE_RES, Resampling.bilinear, 1)
            native = np.where(np.isfinite(native), native, part)
    return native


def dem_window(lat, lon, items, extent=EXTENT):
    """Return a complete standard N×N DEM grid at native res over `extent` metres, from already
    selected STAC tile records. extent=EXTENT keeps the 2400 m window (native_n=NATIVE_N) unchanged."""
    native_n = round(extent / NATIVE_RES) + 1     # keep native 30 m sampling, then resample to N×N
    native = _dem_native_window(lat, lon, items, native_n)
    if native.shape != (native_n, native_n) or not np.isfinite(native).all():
        raise RuntimeError(f'DEM window incomplete: {int((~np.isfinite(native)).sum())} non-finite nodes')
    grid = bilinear_resample([float(v) for v in native.ravel()], native_n, N)
    elev = [round(v, 1) for v in grid]
    if len(elev) != N * N or not all(math.isfinite(v) for v in elev):
        raise RuntimeError('resampled DEM is not 4225 finite values')
    return elev


def fetch_dem(ident, lat, lon):
    def search():
        items = list(catalog().search(collections=['cop-dem-glo-30'], bbox=window_lonlat_bbox(lat, lon, 100)).items())
        if not items:
            raise RuntimeError('cop-dem-glo-30: no tile covers this window')
        return [item_record(i) for i in items]
    items = cached_json(f'{ident}-dem-items', search)
    npy = CACHE / f'{ident}-dem-native.npy'
    if npy.exists():
        native = np.load(npy)
    else:
        native = _dem_native_window(lat, lon, items)
        CACHE.mkdir(parents=True, exist_ok=True)
        np.save(npy, native)
    if native.shape != (NATIVE_N, NATIVE_N) or not np.isfinite(native).all():
        raise RuntimeError(f'DEM window incomplete: {int((~np.isfinite(native)).sum())} non-finite nodes')
    grid = bilinear_resample([float(v) for v in native.ravel()], NATIVE_N, N)
    elev = [round(v, 1) for v in grid]
    if len(elev) != N * N or not all(math.isfinite(v) for v in elev):
        raise RuntimeError('resampled DEM is not 4225 finite values')
    return elev, items


# ---------------------------------------------------------------- Sentinel-2 imagery
def fetch_imagery(ident, lat, lon, months=None):
    jpg = OUT / f'{ident}.jpg'
    end = datetime.date.today()
    start = end - datetime.timedelta(days=LOOKBACK_DAYS)
    bbox = window_lonlat_bbox(lat, lon, 0)

    def search():
        items = catalog().search(collections=['sentinel-2-l2a'], bbox=bbox, datetime=f'{start}/{end}',
                                 query={'eo:cloud_cover': {'lt': 10}},
                                 sortby=[{'field': 'datetime', 'direction': 'desc'}], max_items=60).items()
        recs = [item_record(i) for i in items]
        if months:  # e.g. austral summer for Antarctica: less seasonal snow and higher sun
            recs = [r for r in recs if int(r['datetime'][5:7]) in months]
        for rec in recs:  # first scene with complete coverage and a clear window (SCL)
            try:
                scl, _ = warp(sign(rec['assets']['SCL']), lat, lon, 120, 20.0, Resampling.nearest, 1,
                              src_nodata=0, dst_nodata=0, dtype='uint8')
                total = scl.size
                nodata = int((scl == 0).sum())
                cloud = int(np.isin(scl, [3, 8, 9, 10]).sum())
                log(f'  S2 {rec["id"]} nodata={nodata} cloud/shadow={cloud}/{total}')
                if nodata == 0 and cloud / total < 0.01:
                    rec['windowCloudFraction'] = round(cloud / total, 4)
                    return rec
            except Exception as e:
                log('  S2 candidate failed', rec['id'], e)
        raise RuntimeError('no clear, complete Sentinel-2 L2A scene in the look-back period')
    rec = cached_json(f'{ident}-s2-item', search)
    if not jpg.exists():
        # L2A DN -> reflectance; processing baseline >= 04.00 adds a +1000 DN offset (BOA_ADD_OFFSET).
        baseline = float(rec['properties'].get('s2:processing_baseline') or '0')
        offset = 1000 if baseline >= 4 else 0
        bands = [warp(sign(rec['assets'][b]), lat, lon, IMG_PX, EXTENT / IMG_PX, Resampling.cubic, 1,
                      src_nodata=0, dtype='float32')[0] for b in ('B04', 'B03', 'B02')]
        refl = (np.stack(bands, -1) - offset) / 10000
        lo, hi = np.nanpercentile(refl, 0.5), np.nanpercentile(refl, 99.7)  # one stretch for all bands keeps hue
        rgb = np.clip((refl - lo) / (hi - lo), 0, 1) ** (1 / 1.2)
        rec['stretch'] = [round(float(lo), 4), round(float(hi), 4)]
        (CACHE / f'{ident}-s2-item.json').write_text(json.dumps(rec))  # keep the stretch with the selection
        img = Image.fromarray(np.nan_to_num(rgb * 255).astype('uint8'), 'RGB')
        for q in (85, 80, 75, 70, 65, 60):
            buf = io.BytesIO()
            img.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
            if buf.tell() < 300_000:
                break
        jpg.write_bytes(buf.getvalue())
    date = rec['datetime'][:10]
    return {
        'path': f'assets/data/scenarios/earth/{ident}.jpg',
        'credit': f'Contains modified Copernicus Sentinel data {date[:4]} (Sentinel-2 L2A, {rec["id"]}), processed by ESA; '
                  'distributed via Microsoft Planetary Computer',
        'license': SENTINEL_LICENSE,
        'source': f'{STAC}/collections/sentinel-2-l2a/items/{rec["id"]}',
        'product': 'Sentinel-2 L2A reflectancia de superficie B04/B03/B02 (10 m), recortada a la ventana de 2400 m '
                   '(bordes de imagen = bordes de la ventana), remuestreo cúbico a 768 px, estiramiento lineal común '
                   f'{rec.get("stretch")} de reflectancia y gamma 1/1.2',
        'acquired': rec['datetime'],
        'sceneCloudCoverPct': rec['properties'].get('eo:cloud_cover'),
        'windowCloudFraction': rec.get('windowCloudFraction'),
    }, rec


# ---------------------------------------------------------------- Sentinel-1 roughness proxy
def fetch_roughness(ident, lat, lon):
    end = datetime.date.today()
    start = end - datetime.timedelta(days=90)
    bbox = window_lonlat_bbox(lat, lon, 0)

    def search():
        items = catalog().search(collections=['sentinel-1-rtc'], bbox=bbox, datetime=f'{start}/{end}',
                                 sortby=[{'field': 'datetime', 'direction': 'desc'}], max_items=10).items()
        for i in items:
            rec = item_record(i)
            pol = 'vv' if 'vv' in rec['assets'] else 'hh' if 'hh' in rec['assets'] else None
            if not pol:
                continue
            arr, _ = warp(sign(rec['assets'][pol]), lat, lon, 240, 10.0, Resampling.nearest, 1)
            valid = np.isfinite(arr) & (arr > 0)
            log(f'  S1 {rec["id"]} {pol} valid={int(valid.sum())}/{arr.size}')
            if valid.mean() < 0.95:
                continue
            db = 10 * np.log10(arr[valid])
            rec.update(pol=pol, meanDb=float(db.mean()), stdDb=float(db.std()), validFraction=float(valid.mean()))
            return rec
        raise RuntimeError('no Sentinel-1 RTC scene with ≥95 % valid pixels over the window')
    rec = cached_json(f'{ident}-s1-rtc', search)
    pol = rec['pol'].upper()
    return {
        'value': round(rec['meanDb'], 2),
        'unit': 'dB',
        'method': f'Media de gamma0 {pol} (RTC, aplanada por terreno) en dB sobre la ventana 2400 m (240×240 px a 10 m, '
                  f'vecino más próximo); desviación típica {rec["stdDb"]:.2f} dB. Proxy de rugosidad superficial a escala '
                  f'de la longitud de onda banda C (~5.6 cm), no rugosidad geométrica medida. Escena única '
                  f'{rec["datetime"][:10]}, órbita {rec["properties"].get("sat:orbit_state")}.',
        'source': f'{STAC}/collections/sentinel-1-rtc/items/{rec["id"]}',
        'license': S1_RTC_LICENSE,
        'credit': 'Sentinel-1 RTC (Planetary Computer, CC BY 4.0) · contains modified Copernicus Sentinel data',
        'stdDb': round(rec['stdDb'], 2),
        'polarization': pol,
        'acquired': rec['datetime'],
    }, rec


# ---------------------------------------------------------------- site assembly
def build(ident, force=False):
    cfg = SITES[ident]
    dest = OUT / f'{ident}.json'
    if dest.exists() and not force:
        log('cached', ident)
        return json.loads(dest.read_text())
    lat, lon = cfg['lat'], cfg['lon']
    log('site', ident, lat, lon)
    notes = list(cfg.get('notes', []))
    provenance = list(cfg['provenance'])

    elev, dem_items = fetch_dem(ident, lat, lon)  # DEM failure = site failure (no synthesis)
    for it in dem_items:
        provenance.append({'label': f'Copernicus DEM GLO-30 · tesela {it["id"]} (Planetary Computer)',
                           'url': f'{STAC}/collections/cop-dem-glo-30/items/{it["id"]}'})

    imagery = None
    try:
        imagery, s2 = fetch_imagery(ident, lat, lon, cfg.get('s2Months'))
        provenance.append({'label': f'Sentinel-2 L2A · {s2["id"]} ({s2["datetime"][:10]})', 'url': imagery['source']})
    except Exception as e:
        log('  imagery failed', ident, e)
        notes.append(f'Sin imagen: no se obtuvo una escena Sentinel-2 L2A válida ({e}).')

    roughness = None
    try:
        roughness, s1 = fetch_roughness(ident, lat, lon)
        provenance.append({'label': f'Sentinel-1 RTC · {s1["id"]} ({s1["datetime"][:10]})', 'url': roughness['source']})
        if roughness['polarization'] != 'VV':
            notes.append(f'Rugosidad radar en polarización {roughness["polarization"]}: en esta zona Sentinel-1 solo adquiere '
                         f'{roughness["polarization"]} (modo polar), por lo que no es directamente comparable con valores VV.')
    except Exception as e:
        log('  roughness failed', ident, e)
        notes.append(f'roughness=null: no se pudo calcular la retrodispersión Sentinel-1 RTC ({e}).')

    metrics = compute_metrics(elev, N, SPACING, native_resolution_m=30, roughness=roughness)
    notes += [
        'Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, '
        'reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y '
        'remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.',
        'Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).',
        'thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).',
        'La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria.',
    ]
    record = {
        'id': ident, 'body': 'earth', 'name': cfg['name'], 'center': [lat, lon],
        'gridSize': N, 'spacingMeters': SPACING, 'extentMeters': EXTENT,
        'elevation': elev,
        'imagery': imagery,
        'dataset': 'Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)',
        'nativeResolutionMeters': 30,
        'source': f'{STAC}/collections/cop-dem-glo-30',
        'license': DEM_LICENSE,
        'demCredit': '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS '
                     'by the European Union and ESA; all rights reserved',
        'fetchedAt': datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        'metrics': metrics,
        'thermal': None,
        'environment': EARTH_ENV,
        'provenance': provenance,
        'notes': notes,
    }
    validate(record)
    text = json.dumps(record, ensure_ascii=False, separators=(',', ':'))
    dest.write_text(text + '\n')
    log(f'  saved {dest.relative_to(ROOT)} ({len(text) // 1024} KB) metrics={metrics}')
    return record


def validate(rec):
    e = rec['elevation']
    assert rec['gridSize'] == 65 and rec['spacingMeters'] == 37.5 and rec['extentMeters'] == 2400
    assert len(e) == 4225 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in e)
    m = rec['metrics']
    for k in ('slopeP50Deg', 'slopeP90Deg', 'reliefP95P5M', 'triMeanM'):
        assert isinstance(m[k], (int, float)) and math.isfinite(m[k]), k
    assert m['comparable'] is True
    if rec['imagery']:
        p = ROOT / rec['imagery']['path']
        assert p.exists() and p.stat().st_size < 300_000, 'imagery missing or ≥300 KB'


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('sites', nargs='*', default=list(SITES))
    ap.add_argument('--force', action='store_true', help='rebuild outputs (STAC selections stay cached; delete the cache dir to re-select)')
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    ok = []
    for ident in args.sites:
        try:
            build(ident, args.force)
            ok.append(ident)
        except Exception:
            log('FAILED', ident)
            traceback.print_exc()
    log(f'Complete: {len(ok)}/{len(args.sites)} sites ({", ".join(ok)}). Failed sites are NOT synthesised.')
    return 0 if len(ok) == len(args.sites) else 1


if __name__ == '__main__':
    sys.exit(main())
