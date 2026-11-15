#!/usr/bin/env python3
"""A.R.E.S. Twin — wide, lower-resolution terrain context around each measured window (docs/modules/m3-processes.md).

For every Earth twin and every Moon/Mars target it writes
    assets/data/scenarios/context/<id>.json   (§2 grid schema, role "context")
    assets/data/scenarios/context/<id>.jpg    (1024×1024, edges = window bbox)
on the SAME centre and SAME local frame as assets/data/scenarios/{earth,targets}/<id>.json
(azimuthal equidistant, row 0 = north, column 0 = west) but with a 19 200 m window:
97×97 nodes at 200 m. The context is drawn around the measured 2400 m window; it is never
presented as measured data of that window.

Elevation
  * Earth: Copernicus DEM GLO-30 (same product as the scenario; it covers 19.2 km).
  * Moon/Mars: the scenario product when it covers the whole 19.2 km window, otherwise the
    closest global product (none of the four scenario DTMs covers it, see notes in the JSON):
      marius-hills  -> LRO LOLA + SELENE TC merge (SLDEM2015) 512 ppd, ~59 m  (USGS)
      shackleton    -> LRO LOLA LDEM_80S_40M polar stereographic, 40 m        (PDS Geosciences)
      jezero, valles-marineris -> MGS MOLA + MEX HRSC blended DEM v2, 200 m      (USGS)
  * Every node is an area average over its 200 m cell, never extrapolated: a window with gaps
    fails that site (nothing synthesised).
  * centerBiasM = mean(context, central 2.4 km) − mean(scenario grid); the frontend subtracts it.

Imagery
  * Earth: Sentinel-2 L2A B04/B03/B02 cloud-masked (SCL) mosaic from the scenario's year,
    starting with the scenario's own scene, stretched with the scenario's stretch.
  * Marius Hills: SELENE/Kaguya TC ortho mosaic (NASA Moon Trek WMTS).
  * Jezero / Valles Marineris: MRO CTX beta01 mosaic (Caltech Murray Lab, via the Esri tile
    service that Mars Trek WMTS points to).
  * Shackleton: hillshade of the context DEM (like the scenario: the rim is almost always in
    grazing light or shadow). Not a photograph; marked kind="hillshade".
  * A failing image -> imagery = null with the reason in notes.

Reproducible and cached (rasters / tiles / STAC selections under $XDG_CACHE_HOME/ares-twin-context);
outputs are reused unless --force. A failing site never aborts the run.

Run (needs planetary-computer, so the Earth venv):
  .venv-data/bin/python scripts/fetch-context.py [--force] [id ...]
"""
import argparse, datetime, importlib.util, io, json, math, os, pathlib, sys, time, traceback, urllib.parse

import numpy as np
import rasterio
from PIL import Image, ImageFile
from pyproj import Transformer
from rasterio.enums import Resampling

ROOT = pathlib.Path(__file__).resolve().parents[1]
# The Esri CTX tile server omits the final PNG IEND chunk: decode anyway; really truncated pixels come out 0
# and are rejected by the > 0 validity check (≥ 98 % valid pixels required).
ImageFile.LOAD_TRUNCATED_IMAGES = True


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


fe = _load('fetch_scenarios_earth', 'fetch-scenarios-earth.py')  # catalog(), sign(), warp(), site_crs(), item_record(), GDAL_ENV
ft = _load('fetch_targets', 'fetch-targets.py')                  # local_nodes(), sample_raster(), hillshade(), http(), cached_download()

OUT = ROOT / 'assets/data/scenarios/context'
CACHE = pathlib.Path(os.environ.get('XDG_CACHE_HOME', pathlib.Path.home() / '.cache')) / 'ares-twin-context'

N, SPACING = 97, 200.0
EXTENT = (N - 1) * SPACING            # 19 200 m
SCEN_EXTENT = 2400.0
IMG_PX = 1024
IMG_MAX_BYTES = 400_000
JSON_MAX_BYTES = 150_000
NOW = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()

EARTH_IDS = ['la-corona', 'wright-valley', 'atacama', 'wadi-rum']
TARGET_IDS = ['marius-hills', 'shackleton', 'jezero', 'valles-marineris']

USGS = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic'
LOLA_POLAR = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/float_img'

GLOBAL_DEMS = {
    'sldem': {
        'url': f'{USGS}/LolaKaguya_Topo/Lunar_LRO_LOLAKaguya_DEMmerge_60N60S_512ppd.tif', 'scale': 0.5, 'native': 59.2,
        'dataset': 'LRO LOLA + SELENE/Kaguya TC DEM merge 60N–60S 512 ppd (SLDEM2015, Barker et al. 2016), ~59 m/px (USGS Astrogeology)',
        'page': 'https://astrogeology.usgs.gov/search/map/moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m',
        'license': 'Dominio público (NASA / USGS); datos SELENE © JAXA con atribución',
        'datum': 'altura (m) relativa a la esfera de 1737.4 km (DN × 0.5)'},
    'lola80s': {
        'url': f'{LOLA_POLAR}/ldem_80s_40m_float.lbl', 'scale': 1000.0, 'native': 40.0,
        'dataset': 'LRO LOLA LDEM_80S_40M (GDR polar estereográfico, 40 m/px, v2.1 2017; NASA GSFC / PDS Geosciences)',
        'page': 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/',
        'license': 'Dominio público (datos NASA PDS)',
        'datum': 'altura (km × 1000 → m) relativa a la esfera de 1737.4 km'},
    'mola_hrsc': {
        'url': f'{USGS}/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif', 'scale': 1.0, 'native': 200.0,
        'dataset': 'MGS MOLA + MEX HRSC Blended DEM Global 200 m v2 (Fergason et al. 2018, USGS Astrogeology)',
        'page': 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m',
        'license': 'Dominio público (NASA / USGS); HRSC © ESA/DLR/FU Berlin con atribución',
        'datum': 'altura (m) relativa al areoide MOLA'},
}

TREK_KAGUYA = {
    'key': 'kaguya-tc-ortho',
    'template': 'https://trek.nasa.gov/tiles/Moon/EQ/Kaguya_TCortho_Mosaic_Global_4096ppd/1.0.0/default/default028mm/{z}/{row}/{col}.png',
    'levels': [10, 9], 'tile': 256, 'res0': 180 / 256,   # deg/px at z=0 (2×1 tiles of 256 px); 10 = finest served
    'name': 'SELENE/Kaguya Terrain Camera ortho mosaic global (NASA Moon Trek WMTS; nivel 10 ≈ 20.8 m/px)',
    'credit': 'JAXA/SELENE Terrain Camera; mosaico NASA Moon Trek (NASA/JPL-Caltech SSD)',
    'license': 'Datos SELENE © JAXA, uso libre con atribución; servicio NASA Moon Trek',
    'page': 'https://trek.nasa.gov/tiles/Moon/EQ/Kaguya_TCortho_Mosaic_Global_4096ppd/1.0.0/WMTSCapabilities.xml'}
TREK_CTX = {
    'key': 'ctx-beta01-esri',
    'template': 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{row}/{col}',
    'levels': [11, 9], 'tile': 512, 'res0': 0.3515625,   # level 10 serves placeholder tiles over Coprates; failing tiles -> level 9
    'name': 'MRO CTX global mosaic beta01 (Caltech Murray Lab, no controlado; teselas Esri a las que apunta Mars Trek WMTS; nivel 11 ≈ 10.2 m/px, nivel 10 ≈ 20.3 m/px)',
    'credit': 'NASA/JPL-Caltech/MSSS · Caltech Murray Lab (CTX beta01) · Esri',
    'license': 'Datos CTX de NASA (dominio público); mosaico Caltech Murray Lab, uso con atribución',
    'page': 'https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0/WMTSCapabilities.xml'}

TARGET_CFG = {
    'marius-hills': {'dem': 'sldem', 'image': TREK_KAGUYA,
                     'why': 'El DTM Kaguya TC v2 del escenario (un solo par estéreo) cubre sólo ~84 % de la ventana de 19.2 km'},
    'shackleton': {'dem': 'lola80s', 'image': 'hillshade',
                   'why': 'El LDEM LOLA 5 m Site04 de PGDA (16 × 16 km) cubre sólo ~65 % de la ventana de 19.2 km'},
    'jezero': {'dem': 'mola_hrsc', 'image': {**TREK_CTX, 'levels': [10, 9]},   # level 11 repeats one tile here
               'why': 'El DTM HiRISE del escenario (franja de ~7 × 14 km) cubre sólo ~19 % de la ventana de 19.2 km'},
    'valles-marineris': {'dem': 'mola_hrsc', 'image': TREK_CTX,
                         'why': 'La franja del DTM CTX del escenario cubre sólo ~83 % de la ventana de 19.2 km'},
}

# Earth GDAL env minus the .tif-only extension filter (the LOLA polar DEM is opened through its PDS3 .lbl)
RAW_ENV = {k: v for k, v in fe.GDAL_ENV.items() if k != 'CPL_VSIL_CURL_ALLOWED_EXTENSIONS'}


def log(*a):
    print(*a, flush=True)


def cached_json(key, fn):
    p = CACHE / f'{key}.json'
    if p.exists():
        return json.loads(p.read_text())
    val = fn()
    CACHE.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(val))
    return val


def scenario(ident):
    sub = 'earth' if ident in EARTH_IDS else 'targets'
    return json.loads((ROOT / f'assets/data/scenarios/{sub}/{ident}.json').read_text())


def center_bias(elev, scen):
    """Mean of the context nodes inside the central 2400 m vs. mean of the scenario grid."""
    z = np.asarray(elev, dtype='float64').reshape(N, N)
    k = int(round(SCEN_EXTENT / 2 / SPACING))        # 6 nodes each side of the centre
    c = N // 2
    core = z[c - k:c + k + 1, c - k:c + k + 1]
    ctx_mean = float(core.mean())
    scen_mean = float(np.mean(scen['elevation']))
    return round(ctx_mean - scen_mean, 1), round(ctx_mean, 1), round(scen_mean, 1), core.shape[0]


def save_jpeg(img, dest):
    for q in (88, 84, 80, 75, 70, 65, 60, 55):
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        if buf.tell() < IMG_MAX_BYTES:
            dest.write_bytes(buf.getvalue())
            return q
    raise RuntimeError('JPEG ≥ 400 KB even at q55')


def pixel_offsets(n=IMG_PX):
    """Pixel-centre metric offsets so that image EDGES = window bbox (±EXTENT/2)."""
    px = EXTENT / n
    return px, np.array([-EXTENT / 2 + (i + 0.5) * px for i in range(n)])


# ================================================================ Earth
def earth_bbox(lat, lon, pad_m=400):
    tr = Transformer.from_crs(fe.site_crs(lat, lon), 'EPSG:4326', always_xy=True)
    h = EXTENT / 2 + pad_m
    s = np.linspace(-h, h, 9)
    pts = [tr.transform(x, y) for x in s for y in s]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def earth_dem(ident, lat, lon):
    """GLO-30 sampled bilinearly on a 25 m sub-grid, then box-averaged to the 200 m nodes."""
    def search():
        items = list(fe.catalog().search(collections=['cop-dem-glo-30'], bbox=earth_bbox(lat, lon, 300)).items())
        if not items:
            raise RuntimeError('cop-dem-glo-30: no tile covers this window')
        return [fe.item_record(i) for i in items]
    items = cached_json(f'{ident}-dem-items', search)
    sub, f = 25.0, 8                     # 8 × 25 m = 200 m
    fine_n = (N - 1) * f + 1 + 2 * (f // 2)   # one half-cell margin each side: 777 nodes
    npy = CACHE / f'{ident}-dem-25m.npy'
    if npy.exists():
        fine = np.load(npy)
    else:
        fine = np.full((fine_n, fine_n), np.nan, dtype='float32')
        for it in items:
            part, _ = fe.warp(fe.sign(it['assets']['data']), lat, lon, fine_n, sub, Resampling.bilinear, 1)
            fine = np.where(np.isfinite(fine), fine, part)
        CACHE.mkdir(parents=True, exist_ok=True)
        np.save(npy, fine)
    if not np.isfinite(fine).all():
        raise RuntimeError(f'GLO-30 context incomplete: {int((~np.isfinite(fine)).sum())} sub-nodes without data')
    # node k sits at fine index k*f + f//2; average the (f+1)² sub-nodes within ±100 m (trapezoid edge weights)
    w1 = np.ones(f + 1); w1[0] = w1[-1] = 0.5
    w = np.outer(w1, w1); w /= w.sum()
    out = np.empty((N, N))
    for r in range(N):
        for c in range(N):
            out[r, c] = (fine[r * f:r * f + f + 1, c * f:c * f + f + 1] * w).sum()
    return out, items


# Over Antarctic ice SCL flags bright snow/ice as cloud and steep shaded slopes as cloud shadow, so for
# wright-valley only nodata is masked and the scenario's own pass (same date, adjacent tiles) is mosaicked.
S2_TRUST_SCL_CLOUDS = {'wright-valley': False}


def scl_good(scl, buffer_px, clouds=True):
    """Valid, clear pixels: SCL not nodata/saturated/shadow/cloud/cirrus, with a square buffer around the bad ones."""
    if not clouds:
        return scl != 0
    bad = (scl == 0) | np.isin(scl, [1, 3, 8, 9, 10])
    k = 2 * buffer_px + 1
    ii = np.pad(np.cumsum(np.cumsum(np.pad(bad.astype('int32'), buffer_px), 0), 1), ((1, 0), (1, 0)))
    count = ii[k:, k:] - ii[:-k, k:] - ii[k:, :-k] + ii[:-k, :-k]
    return count == 0


def s2_mosaic(ident, lat, lon, scen):
    jpg = OUT / f'{ident}.jpg'
    s2cache = fe.CACHE / f'{ident}-s2-item.json'
    scen_rec = json.loads(s2cache.read_text()) if s2cache.exists() else None
    scen_scene = scen_rec['id'] if scen_rec else None
    year = int((scen_rec or {}).get('datetime', NOW)[:4])
    months = fe.SITES[ident].get('s2Months')
    bbox = earth_bbox(lat, lon, 0)
    mask_n = 256                                     # SCL check grid: 75 m pixels
    trust = S2_TRUST_SCL_CLOUDS.get(ident, True)

    def select():
        end = min(datetime.date(year, 12, 31), datetime.date.today())
        items = fe.catalog().search(collections=['sentinel-2-l2a'], bbox=bbox, datetime=f'{year}-01-01/{end}',
                                    query={'eo:cloud_cover': {'lt': 25}}, max_items=150).items()
        recs = [fe.item_record(i) for i in items]
        if months:
            recs = [r for r in recs if int(r['datetime'][5:7]) in months]
        scen_date = scen_rec['datetime'][:10] if scen_rec else None
        recs.sort(key=lambda r: (r['id'] != scen_scene, r['datetime'][:10] != scen_date,
                                 r['properties'].get('eo:cloud_cover') or 100))
        scored = []
        for rec in recs[:16]:
            try:
                scl, _ = fe.warp(fe.sign(rec['assets']['SCL']), lat, lon, mask_n, EXTENT / mask_n, Resampling.nearest, 1,
                                 src_nodata=0, dst_nodata=0, dtype='uint8')
            except Exception as e:
                log('  S2 SCL failed', rec['id'], e)
                continue
            good = scl_good(scl, 5, trust)      # 5 × 75 m buffer around clouds/shadows
            rec['goodFraction'] = round(float(good.mean()), 4)
            log(f'  S2 {rec["id"]} {rec["datetime"][:10]} good(buffered)={good.mean():.4f}')
            scored.append((rec, good))
        # a fully clear scene wins (scenario scene first, then its pass, then clearest); otherwise greedy by clearness
        scored.sort(key=lambda t: (t[0]['goodFraction'] < 0.998, t[0]['id'] != scen_scene,
                                   t[0]['datetime'][:10] != scen_date, -t[0]['goodFraction']))
        filled = np.zeros((mask_n, mask_n), bool)
        chosen = []
        for rec, good in scored:
            if (good & ~filled).mean() < 0.002:
                continue
            filled |= good
            chosen.append(rec)
            if filled.mean() > 0.999 or len(chosen) >= 6:
                break
        if not chosen:
            raise RuntimeError(f'no usable Sentinel-2 L2A scene in {year}')
        return {'scenes': chosen, 'clearFraction': round(float(filled.mean()), 4), 'year': year}

    sel = cached_json(f'{ident}-s2-mosaic', select)
    stretch = (scen_rec or {}).get('stretch')
    if not jpg.exists():
        px = EXTENT / IMG_PX
        acc = np.full((IMG_PX, IMG_PX, 3), np.nan, dtype='float32')
        fallback = np.full_like(acc, np.nan)
        for rec in sel['scenes']:
            scl, _ = fe.warp(fe.sign(rec['assets']['SCL']), lat, lon, IMG_PX, px, Resampling.nearest, 1,
                             src_nodata=0, dst_nodata=0, dtype='uint8')
            good = scl_good(scl, 20, trust)     # 20 × 18.75 m buffer: SCL misses cloud edges and thin shadows
            baseline = float(rec['properties'].get('s2:processing_baseline') or '0')
            offset = 1000 if baseline >= 4 else 0
            bands = [fe.warp(fe.sign(rec['assets'][b]), lat, lon, IMG_PX, px, Resampling.average, 1,
                             src_nodata=0, dtype='float32')[0] for b in ('B04', 'B03', 'B02')]
            refl = (np.stack(bands, -1) - offset) / 10000
            both = good & np.isfinite(acc[..., 0]) & np.isfinite(refl).all(-1)
            if both.sum() > 5000:   # radiometric match of fill scenes to the base scene (per-band gain/offset, LSQ)
                for b in range(3):
                    gain, off = np.polyfit(refl[..., b][both], acc[..., b][both], 1)
                    if 0.67 <= gain <= 1.5:   # implausible fits (different snow/sun) are not applied
                        refl[..., b] = refl[..., b] * gain + off
            take = good[..., None] & np.isnan(acc)
            acc = np.where(take, refl, acc)
            fallback = np.where(np.isnan(fallback) & np.isfinite(refl), refl, fallback)
        holes = np.isnan(acc[..., 0])
        acc = np.where(np.isnan(acc), fallback, acc)          # residual cloud pixels keep their (cloudy) value
        missing = float(np.isnan(acc[..., 0]).mean())
        if missing > 0.02:
            raise RuntimeError(f'Sentinel-2 mosaic leaves {missing:.1%} of the window without data')
        if not stretch:
            stretch = [float(np.nanpercentile(acc, 0.5)), float(np.nanpercentile(acc, 99.7))]
            sel['stretchSource'] = 'calculado sobre el contexto (percentiles 0.5/99.7)'
        else:
            sel['stretchSource'] = 'el mismo estiramiento que la imagen del escenario, para que ambas empalmen'
        lo, hi = stretch
        rgb = np.clip((acc - lo) / (hi - lo), 0, 1) ** (1 / 1.2)
        img = Image.fromarray(np.nan_to_num(rgb * 255).astype('uint8'), 'RGB')
        sel['quality'] = save_jpeg(img, jpg)
        sel['stretch'] = [round(float(lo), 4), round(float(hi), 4)]
        sel['cloudFallbackFraction'] = round(float(holes.mean()), 4)
        sel['missingFraction'] = round(missing, 4)
        (CACHE / f'{ident}-s2-mosaic.json').write_text(json.dumps(sel))
    scenes = sel['scenes']
    dates = sorted({s['datetime'][:10] for s in scenes})
    imagery = {
        'path': f'assets/data/scenarios/context/{ident}.jpg',
        'credit': f'Contains modified Copernicus Sentinel data {sel["year"]} (Sentinel-2 L2A, {len(scenes)} escena(s): '
                  + ', '.join(s['id'] for s in scenes) + '), processed by ESA; distributed via Microsoft Planetary Computer',
        'license': fe.SENTINEL_LICENSE,
        'source': f'{fe.STAC}/collections/sentinel-2-l2a',
        'kind': 'orthoimage',
        'product': f'Mosaico Sentinel-2 L2A B04/B03/B02 (10 m) enmascarado con SCL (nubes, sombras, cirros, saturados; margen de 375 m alrededor); las escenas de relleno se ajustan a la escena base con ganancia/desplazamiento por banda (mínimos cuadrados sobre los píxeles despejados comunes), '
                   f'{IMG_PX} px sobre la ventana de {EXTENT:.0f} m (bordes = bbox de la ventana), promedio de área a '
                   f'{EXTENT / IMG_PX:.2f} m/px; estiramiento lineal común {sel.get("stretch")} de reflectancia y gamma 1/1.2 '
                   f'({sel.get("stretchSource")}).',
        'acquired': dates,
        'scenes': [{'id': s['id'], 'datetime': s['datetime'], 'sceneCloudCoverPct': s['properties'].get('eo:cloud_cover'),
                    'url': f'{fe.STAC}/collections/sentinel-2-l2a/items/{s["id"]}'} for s in scenes],
        'clearFraction': sel['clearFraction'],
        'cloudFallbackFraction': sel.get('cloudFallbackFraction'),
    }
    return imagery, sel


def build_earth(ident, scen):
    lat, lon = scen['center']
    notes, provenance = [], []
    z, items = earth_dem(ident, lat, lon)
    for it in items:
        provenance.append({'label': f'Copernicus DEM GLO-30 · tesela {it["id"]} (Planetary Computer)',
                           'url': f'{fe.STAC}/collections/cop-dem-glo-30/items/{it["id"]}'})
    notes.append('Alturas Copernicus DEM GLO-30 (mismo producto que la ventana medida; MDS, alturas ortométricas EGM2008) '
                 'muestreadas bilinealmente en una subrejilla acimutal equidistante de 25 m centrada en el sitio y promediadas '
                 'en celdas de 200 m (pesos trapezoidales) para cada nodo. Fila 0 = norte, columna 0 = oeste.')
    imagery = None
    try:
        imagery, sel = s2_mosaic(ident, lat, lon, scen)
        for s in imagery['scenes']:
            provenance.append({'label': f'Sentinel-2 L2A · {s["id"]} ({s["datetime"][:10]})', 'url': s['url']})
        if not S2_TRUST_SCL_CLOUDS.get(ident, True):
            imagery['product'] = imagery['product'].replace('enmascarado con SCL (nubes, sombras, cirros, saturados; margen de 375 m alrededor)',
                                                            'enmascarado sólo por ausencia de dato (SCL = 0)')
            notes.append('Imagen: sobre hielo antártico la clasificación SCL confunde nieve/hielo brillante con nube y laderas en sombra con '
                         'sombra de nube, así que no se usa para enmascarar; el mosaico une las teselas de la misma pasada que la imagen del '
                         'escenario (misma fecha e iluminación) y puede conservar nubes reales si las hubiera.')
        elif sel['clearFraction'] < 0.999:
            notes.append(f'Imagen: tras {len(sel["scenes"])} escena(s) el {sel["clearFraction"]:.1%} de la ventana queda libre de nubes '
                         f'según SCL; el resto ({sel.get("cloudFallbackFraction", 0):.1%}) muestra la primera escena con dato aunque '
                         'tenga nube o sombra.')
        if len({s['datetime'][:10] for s in imagery['scenes']}) > 1:
            notes.append('Imagen compuesta de escenas de fechas distintas: pueden verse costuras de iluminación o de nieve/humedad.')
    except Exception as e:
        log('  imagery failed', ident, e)
        notes.append(f'imagery = null: no se pudo componer el mosaico Sentinel-2 L2A ({e}).')
    return dict(z=z, imagery=imagery, notes=notes, provenance=provenance,
                dataset='Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30), promediado a 200 m',
                native=30, source=f'{fe.STAC}/collections/cop-dem-glo-30', license=fe.DEM_LICENSE,
                datum='altura ortométrica EGM2008 (m)', radius=None)


# ================================================================ Moon / Mars
def raw_layout(url):
    """(data_url, first_row_offset, row_stride_bytes, dtype) of an UNCOMPRESSED, row-contiguous raster.
    GDAL's /vsicurl/ reads of these huge striped files are very slow, so rows are range-read directly."""
    with rasterio.Env(**RAW_ENV), rasterio.open('/vsicurl/' + url) as ds:
        dt = np.dtype(ds.dtypes[0]).newbyteorder('<')
        if ds.driver == 'GTiff':
            assert ds.profile.get('compress') is None, 'compressed TIFF'
            o0, o1 = (int(ds.get_tag_item(f'BLOCK_OFFSET_0_{r}', 'TIFF', bidx=1)) for r in (0, 1))
            size = int(ds.get_tag_item('BLOCK_SIZE_0_0', 'TIFF', bidx=1))
            assert ds.block_shapes[0] == (1, ds.width) and o1 - o0 == size == ds.width * dt.itemsize, 'not row-contiguous'
            return url, o0, size, dt
        if ds.driver == 'PDS':   # detached PDS3 label: ^IMAGE points to the start of the sibling .img (PC_REAL = LE)
            return url.rsplit('/', 1)[0] + '/' + pathlib.Path(url).stem + '.img', 0, ds.width * dt.itemsize, dt
    raise RuntimeError('unsupported raw layout')


def range_sample(url, lon, lat, radius, cell_m, scale, key):
    """Area-average the raster to ~cell_m cells and sample bilinearly at lon/lat (same maths as
    fetch-targets.sample_raster), reading only the needed bytes of each row over HTTP."""
    with rasterio.Env(**RAW_ENV), rasterio.open('/vsicurl/' + url) as ds:
        x, y = ft.to_dataset_xy(ds, lon, lat, radius)
        col, row = (~ds.transform) * (x, y)
        native = abs(ds.transform.a)
        if ds.crs.is_geographic:   # degrees -> metres at the equator of the body sphere
            native = math.radians(native) * radius
        nodata = ds.nodata
        width, height = ds.width, ds.height
    f = max(1, int(round(cell_m / native)))
    m = 12   # fixed margin (≥ 2f for every product used) so DEM and hillshade reads share one cached window
    c0 = max(int(np.floor(col.min())) - m, 0); c1 = min(int(np.ceil(col.max())) + m, width)
    r0 = max(int(np.floor(row.min())) - m, 0); r1 = min(int(np.ceil(row.max())) + m, height)
    npy = CACHE / f'{key}-raw-{r0}-{r1}-{c0}-{c1}.npy'
    if npy.exists():
        arr = np.load(npy)
    else:
        data_url, off0, stride, dt = raw_layout(url)
        isz = dt.itemsize

        import http.client
        u = urllib.parse.urlparse(data_url)
        local = type('Conn', (), {'conn': None})()   # keep-alive connection (slow DNS + TLS per request otherwise)

        def one(r):
            a = off0 + r * stride + c0 * isz
            n = (c1 - c0) * isz
            for attempt in range(6):
                try:
                    if getattr(local, 'conn', None) is None:
                        local.conn = http.client.HTTPSConnection(u.netloc, timeout=120)
                    local.conn.request('GET', u.path, headers={**ft.UA, 'Range': f'bytes={a}-{a + n - 1}'})
                    resp = local.conn.getresponse()
                    body = resp.read()
                    if resp.status != 206 or len(body) != n:
                        raise RuntimeError(f'HTTP {resp.status}, {len(body)} B')
                    return np.frombuffer(body, dtype=dt)
                except Exception:
                    local.conn = None
                    if attempt == 5:
                        raise
                    time.sleep(1 + 2 * attempt)
        # sequential on ONE keep-alive connection: parallel connections stall in this environment
        rows = [one(r) for r in range(r0, r1)]
        arr = np.stack(rows).astype('float64')
        if nodata is not None:
            arr[arr == nodata] = np.nan
        arr[arr <= -1e30] = np.nan
        CACHE.mkdir(parents=True, exist_ok=True)
        np.save(npy, arr)
    h, w = arr.shape
    oh, ow = h // f, w // f
    dec = np.nanmean(arr[:oh * f, :ow * f].reshape(oh, f, ow, f), axis=(1, 3)) if f > 1 else arr
    fx = (col - c0) / f - 0.5
    fy = (row - r0) / f - 0.5
    return ft.bilinear(dec, fx, fy) * scale, native


def planet_dem(ident, scen):
    lat0, lon0 = scen['center']
    body = scen['body']
    radius = ft.RADIUS[body]
    cfg = TARGET_CFG[ident]
    g = GLOBAL_DEMS[cfg['dem']]
    npy = CACHE / f'{ident}-dem-{cfg["dem"]}.npy'
    if npy.exists():
        z = np.load(npy)
    else:
        lon, lat = ft.local_nodes(lat0, lon0, radius, N, SPACING)
        z, _ = range_sample(g['url'], lon, lat, radius, SPACING, g['scale'], f'{ident}-{cfg["dem"]}')
        CACHE.mkdir(parents=True, exist_ok=True)
        np.save(npy, z)
    if not np.isfinite(z).all():
        raise RuntimeError(f'{cfg["dem"]}: {np.mean(~np.isfinite(z)):.1%} of context nodes without data')
    return z, g


def scenario_dem_coverage(ident, scen):
    """Fraction of the context nodes that the scenario's own DTM covers (decides product choice; cached)."""
    def run():
        t = ft.target_by_id(ident)
        path = ft.cached_download(t['dem']['url']) if t['dem'].get('download') else ft.stac_dem(t)
        lon, lat = ft.local_nodes(scen['center'][0], scen['center'][1], ft.RADIUS[scen['body']], N, SPACING)
        with rasterio.Env(**fe.GDAL_ENV):
            v, _ = ft.sample_raster(path, lon, lat, ft.RADIUS[scen['body']], SPACING)
        return {'coverage': round(float(np.isfinite(v).mean()), 4), 'product': scen['dataset']}
    return cached_json(f'{ident}-scenario-coverage', run)


def fetch_tile(cfg, z, r, c):
    """Decoded tile (float32, NaN = transparent) or None. Only decodable tiles are cached."""
    tdir = CACHE / 'tiles' / cfg['key'] / str(z)
    tdir.mkdir(parents=True, exist_ok=True)
    p = tdir / f'{r}_{c}.img'
    if not p.exists():
        err = None
        for attempt in range(4):   # flaky servers: 500s and truncated bodies
            try:
                raw = ft.http(cfg['template'].format(z=z, row=r, col=c), timeout=60, tries=1)
                Image.open(io.BytesIO(raw)).load()
                p.write_bytes(raw)
                break
            except Exception as e:
                err = e
                time.sleep(2 + 3 * attempt)
        if not p.exists():
            log(f'  tile z{z} {r}/{c} failed: {err}')
            return None
    im = Image.open(io.BytesIO(p.read_bytes()))
    if im.mode in ('RGBA', 'LA', 'P'):
        a = np.asarray(im.convert('LA'), dtype='float32')
        return np.where(a[..., 1] > 0, a[..., 0], np.nan)
    return np.asarray(im.convert('L'), dtype='float32')


def geo_tiles(cfg, lon, lat):
    """Sample a geographic (plate carrée, origin -180/90) tile pyramid bilinearly at lon/lat (deg) at the finest
    level in cfg['levels']. A tile that fails, or that nearly repeats another tile of the window (placeholder
    tiles served instead of data), is replaced by the matching quarter of its parent tile (one level coarser,
    upsampled), down to the coarsest level listed. Returns (values, {level: pixel fraction of the mosaic})."""
    ts, z = cfg['tile'], cfg['levels'][0]
    res = cfg['res0'] / 2 ** z
    lon = ((lon + 180) % 360) - 180
    fx = (lon + 180) / res - 0.5
    fy = (90 - lat) / res - 0.5
    c0, c1 = int(np.floor(fx.min() / ts)), int(np.floor((fx.max() + 1) / ts))
    r0, r1 = int(np.floor(fy.min() / ts)), int(np.floor((fy.max() + 1) / ts))
    tiles = {(r, c): fetch_tile(cfg, z, r, c) for r in range(r0, r1 + 1) for c in range(c0, c1 + 1)}
    # placeholder detection: tiles whose 32×32 thumbnails are near-identical (r > 0.97) to another tile's
    thumbs = {k: np.nan_to_num(v[:ts, :ts], nan=0).reshape(32, ts // 32, 32, ts // 32).mean(axis=(1, 3)).ravel()
              for k, v in tiles.items() if v is not None}
    keys = list(thumbs)
    dup = set()
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            x, y = thumbs[a], thumbs[b]
            if x.std() > 0 and y.std() > 0 and np.corrcoef(x, y)[0, 1] > 0.97:
                dup.update((a, b))
    if dup:
        log(f'  z{z}: {len(dup)} repeated tiles treated as placeholders')
        for k in dup:
            tiles[k] = None
    used, parent_sigs = {}, {}
    mosaic = np.full(((r1 - r0 + 1) * ts, (c1 - c0 + 1) * ts), np.nan, dtype='float32')
    for (r, c), v in tiles.items():
        v = np.full((ts, ts), np.nan, dtype='float32') if v is None else v[:ts, :ts].astype('float32')
        v[~(v > 0)] = np.nan            # 0 = nodata, or pixels missing from a truncated tile
        src = np.where(np.isfinite(v), z, 0)
        for lvl in cfg['levels'][1:]:   # fill gaps pixel by pixel from the parent tile, upsampled
            if np.isfinite(v).all():
                break
            d = 2 ** (z - lvl)
            par = fetch_tile(cfg, lvl, r // d, c // d)
            if par is None:
                continue
            psig = parent_sigs.setdefault(lvl, {}).setdefault(par.tobytes(), (r // d, c // d))
            if psig != (r // d, c // d):   # same bytes as another parent tile: placeholder again
                continue
            q = ts // d
            sub = par[(r % d) * q:(r % d + 1) * q, (c % d) * q:(c % d + 1) * q]
            up = np.asarray(Image.fromarray(np.nan_to_num(sub, nan=0).astype('float32')).resize((ts, ts), Image.BILINEAR))
            fill = ~np.isfinite(v) & (up > 0)
            v[fill] = up[fill]
            src[fill] = lvl
        for lvl in cfg['levels']:
            used[lvl] = used.get(lvl, 0) + int((src == lvl).sum())
        mosaic[(r - r0) * ts:(r - r0 + 1) * ts, (c - c0) * ts:(c - c0 + 1) * ts] = v
    total = len(tiles) * ts * ts
    return (ft.bilinear(mosaic.astype('float64'), fx - c0 * ts, fy - r0 * ts),
            {k: round(n / total, 3) for k, n in used.items() if n})


def planet_image(ident, scen, z_ctx, g):
    lat0, lon0 = scen['center']
    body = scen['body']
    radius = ft.RADIUS[body]
    cfg = TARGET_CFG[ident]['image']
    dest = OUT / f'{ident}.jpg'
    px, off = pixel_offsets()
    if cfg == 'hillshade':
        if not dest.exists():
            # nodes at pixel centres: reuse local_nodes on the (IMG_PX) grid with the pixel spacing
            lon, lat = ft.local_nodes(lat0, lon0, radius, IMG_PX, px)
            zz, _ = range_sample(g['url'], lon, lat, radius, g['native'], g['scale'], f'{ident}-{TARGET_CFG[ident]["dem"]}')
            if np.mean(np.isfinite(zz)) < 0.99:
                raise RuntimeError('hillshade DEM incomplete')
            hs = ft.hillshade(np.nan_to_num(zz, nan=float(np.nanmean(zz))), px)
            lo, hi = np.nanpercentile(hs, [1, 99])
            img = np.clip((hs - lo) / max(hi - lo, 1e-9) * 255, 0, 255).astype('uint8')
            save_jpeg(Image.fromarray(img, 'L'), dest)
        return {'path': f'assets/data/scenarios/context/{ident}.jpg', 'kind': 'hillshade',
                'credit': f'Relieve sombreado calculado de {g["dataset"].split(" (")[0]} (sol a 315°/35°); no es fotografía',
                'license': g['license'], 'source': g['page'],
                'product': f'Relieve sombreado {IMG_PX} px a {px:.2f} m/px del DEM {g["native"]} m, bordes = bbox de la ventana de {EXTENT:.0f} m'}
    if not dest.exists():
        lon, lat = ft.local_nodes(lat0, lon0, radius, IMG_PX, px)
        vals, used = geo_tiles(cfg, lon, lat)
        valid = np.isfinite(vals) & (vals > 0)
        if valid.mean() < 0.98:
            raise RuntimeError(f'image window incomplete ({valid.mean():.1%} valid; tiles by level {used})')
        (CACHE / f'{ident}-image-levels.json').write_text(json.dumps(used))
        vals[~valid] = np.nan
        lo, hi = np.nanpercentile(vals, [1, 99])
        img = np.clip((np.nan_to_num(vals, nan=lo) - lo) / max(hi - lo, 1e-9) * 255, 0, 255).astype('uint8')
        save_jpeg(Image.fromarray(img, 'L'), dest)
    lv = CACHE / f'{ident}-image-levels.json'
    used = {int(k): v for k, v in json.loads(lv.read_text()).items()} if lv.exists() else {cfg['levels'][0]: 1.0}
    level = max(used)
    levels_txt = ', '.join(f'nivel {k} ({cfg["res0"] / 2 ** k * 3600:.2f}″/px): {v:.0%} de los píxeles del mosaico' for k, v in sorted(used.items(), reverse=True))
    return {'path': f'assets/data/scenarios/context/{ident}.jpg', 'kind': 'orthoimage', 'credit': cfg['credit'],
            'license': cfg['license'], 'source': cfg['page'], 'tiles': cfg['template'].replace('{z}', str(level)),
            'levels': {str(k): v for k, v in used.items()},
            'product': f'{cfg["name"]}; {levels_txt} (los píxeles de teselas que fallan, llegan truncadas o que el servidor repite se rellenan con la tesela del nivel inferior, ampliada); {IMG_PX} px a {px:.2f} m/px remuestreado bilinealmente al marco local, '
                       f'bordes = bbox de la ventana de {EXTENT:.0f} m, estiramiento lineal percentiles 1–99'}


def build_target(ident, scen):
    notes, provenance = [], []
    cfg = TARGET_CFG[ident]
    cov = None
    try:
        cov = scenario_dem_coverage(ident, scen)['coverage']
    except Exception as e:
        log('  scenario coverage check failed', e)
    if cov is not None and cov >= 0.999:
        log(f'  NOTE {ident}: scenario product covers the context window; global product still used for consistency')
    z, g = planet_dem(ident, scen)
    reason = cfg['why'] if cov is None else cfg['why'].split(' cubre')[0] + f' cubre sólo el {cov:.0%} de los nodos de la ventana de 19.2 km'
    notes.append(f'{reason}; para el contexto se usa {g["dataset"]}, sin mezclarlo con el DTM de la ventana medida '
                 '(evita costuras artificiales). La diferencia de nivel entre ambos productos queda en centerBiasM.')
    notes.append(f'Cada nodo es el promedio de área del producto a ~200 m (lectura por rangos HTTP de las filas necesarias y promedio por bloques) muestreado '
                 f'bilinealmente en el marco azimutal equidistante local de la esfera de {ft.RADIUS[scen["body"]]:.0f} m '
                 '(fila 0 = norte, columna 0 = oeste), igual que la ventana medida.')
    if g['native'] >= SPACING:
        notes.append(f'Resolución nativa {g["native"]:.0f} m ≈ separación de la rejilla: el relieve del contexto es más suave que el de la ventana medida y no resuelve rasgos < ~400 m.')
    if ident == 'shackleton':
        notes.append('La ventana de 19.2 km incluye el polo sur (~6.6 km del centro): la proyección polar estereográfica del LDEM no tiene singularidad allí.')
    provenance.append({'label': g['dataset'], 'url': g['url']})
    provenance.append({'label': 'Página del producto', 'url': g['page']})
    imagery = None
    try:
        imagery = planet_image(ident, scen, z, g)
        if imagery['source'] != g['page']:
            provenance.append({'label': 'Imagen de contexto', 'url': imagery['source']})
        if imagery['kind'] == 'hillshade':
            notes.append('La imagen es un relieve sombreado calculado del propio DEM de contexto (sol a 315°/35°, como la ventana medida), '
                         'no una fotografía: en el borde de Shackleton la iluminación es casi siempre rasante o nula.')
        if isinstance(TARGET_CFG[ident]['image'], dict) and TARGET_CFG[ident]['image']['key'] == TREK_CTX['key']:
            notes.append('Mosaico CTX beta01 no controlado: puede desplazarse decenas de metros respecto al DEM y mostrar costuras entre órbitas.')
    except Exception as e:
        log('  imagery failed', ident, e)
        dest = OUT / f'{ident}.jpg'
        if dest.exists():
            dest.unlink()
        notes.append(f'imagery = null: no se pudo obtener la imagen de contexto ({e}).')
    return dict(z=z, imagery=imagery, notes=notes, provenance=provenance, dataset=g['dataset'], native=g['native'],
                source=g['url'], license=g['license'], datum=g['datum'], radius=ft.RADIUS[scen['body']],
                scenarioCoverage=cov)


# ================================================================ assembly
def build(ident, force=False):
    dest = OUT / f'{ident}.json'
    if dest.exists() and not force:
        log('cached', ident)
        return json.loads(dest.read_text())
    if force:
        jpg = OUT / f'{ident}.jpg'
        if jpg.exists():
            jpg.unlink()
    scen = scenario(ident)
    log('==', ident, scen['center'])
    part = build_earth(ident, scen) if ident in EARTH_IDS else build_target(ident, scen)
    z = np.asarray(part['z'], dtype='float64')
    elev = [round(float(v), 1) for v in z.ravel()]
    if len(elev) != N * N or not all(math.isfinite(v) for v in elev):
        raise RuntimeError('context grid is not 97×97 finite values')
    bias, ctx_mean, scen_mean, core_n = center_bias(elev, scen)
    notes = part['notes'] + [
        f'centerBiasM = {bias} m: media de los {core_n}×{core_n} nodos centrales del contexto (2.4 km) = {ctx_mean} m frente a '
        f'la media de la rejilla del escenario = {scen_mean} m. El frontend resta este sesgo para que el contexto empalme con la ventana medida.',
        'Contexto de menor resolución para rellenar el horizonte alrededor de la ventana medida de 2400 m; no es dato medido de esa '
        'ventana y no entra en métricas ni comparaciones (metrics = null).',
    ]
    record = {
        'id': ident, 'body': scen['body'], 'role': 'context', 'name': scen['name'] + ' · contexto 19.2 km',
        'center': scen['center'], 'gridSize': N, 'spacingMeters': SPACING, 'extentMeters': EXTENT, 'windowMeters': EXTENT,
        'elevation': elev,
        'imagery': part['imagery'],
        'dataset': part['dataset'],
        'nativeResolutionMeters': part['native'],
        'source': part['source'],
        'license': part['license'],
        'fetchedAt': NOW,
        'centerBiasM': bias,
        'centerBias': {'contextCoreMeanM': ctx_mean, 'scenarioMeanM': scen_mean, 'coreNodes': core_n * core_n,
                       'definition': 'contexto − escenario (m), media del centro 2.4 km'},
        'metrics': None,
        'thermal': None,
        'environment': scen.get('environment'),
        'scenario': f'assets/data/scenarios/{"earth" if ident in EARTH_IDS else "targets"}/{ident}.json',
        'sampling': {'frame': 'azimutal equidistante local centrado en `center` (fila 0 = norte, columna 0 = oeste)'
                              + (' · WGS84' if part['radius'] is None else f' · esfera R = {part["radius"]:.0f} m'),
                     'node': 'promedio de área de la celda de 200 m centrada en el nodo',
                     'elevationDatum': part['datum']},
        'provenance': part['provenance'],
        'notes': notes,
    }
    if part.get('scenarioCoverage') is not None:
        record['sampling']['scenarioProductCoverage'] = part['scenarioCoverage']
    text = json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n'
    if len(text.encode()) >= JSON_MAX_BYTES:
        raise RuntimeError(f'JSON {len(text.encode())} B ≥ 150 KB')
    OUT.mkdir(parents=True, exist_ok=True)
    dest.write_text(text)
    jpg = OUT / f'{ident}.jpg'
    log(f'  saved {dest.relative_to(ROOT)} {len(text.encode()) // 1024} KB · jpg '
        f'{(jpg.stat().st_size // 1024) if jpg.exists() else "-"} KB · bias {bias} m · range {min(elev)}..{max(elev)}')
    return record


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('ids', nargs='*', default=EARTH_IDS + TARGET_IDS)
    ap.add_argument('--force', action='store_true', help='rebuild JSON/JPEG (downloads and selections stay cached; delete the cache dir to refetch)')
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    ok, failed = [], []
    for ident in args.ids:
        try:
            build(ident, args.force)
            ok.append(ident)
        except Exception:
            failed.append(ident)
            log('FAILED', ident, '(nothing synthesised)')
            traceback.print_exc()
    log(f'done: {len(ok)}/{len(args.ids)} ok; failed: {failed or "none"}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
