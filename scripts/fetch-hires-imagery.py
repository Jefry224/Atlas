#!/usr/bin/env python3
"""S.E.L.E.N.E. Ops: higher-resolution imagery for the measured 2400 m scenario windows.

Writes assets/data/scenarios/{earth,targets}/<id>-hires.jpg and updates ONLY the `imagery` object of the
matching scenario grid JSON (elevation, metrics and every other key stay byte-identical). The previous
image is kept and referenced as `imagery.previewPath` (progressive loading). Geometry is never touched.

Frames (identical to the existing images, so the texture mapping does not change):
  * Earth: site-centred azimuthal-equidistant (WGS84) frame, image EDGES = window edges
    (same as scripts/fetch-scenarios-earth.py, pixel = 2400 m / width).
  * Moon / Mars: local azimuthal-equidistant frame on the body sphere, pixel CENTRES of the first and last
    row/column on the window edges (same as scripts/fetch-targets.py, spacing = 2400 m / (width - 1)).
  * Row 0 = north, column 0 = west in both.

Sources (public, credential-free; nothing is synthesised):
  * jezero            MRO HiRISE ESP_045994_1985_RED_A_01_ORTHO (0.25 m/px), controlled orthoimage of the
                      scenario DTM (USGS Astrogeology STAC mro_hirise_socet_dtms, CC0-1.0) -> 4096 px.
  * valles-marineris  MRO CTX global mosaic beta01 (Caltech Murray Lab, ~5 m/px, uncontrolled; Esri tile
                      service that NASA Mars Trek points to). "The Murray Lab/Caltech grants free use of the
                      beta01 version of the mosaic for all purposes"; credit NASA/JPL/MSSS/The Murray Lab.
                      Uncontrolled, so it is registered to the existing controlled USGS CTX orthoimage by
                      phase correlation (pure translation) -> 2048 px. No HiRISE DTM ortho covers the window.
  * marius-hills      SELENE/Kaguya Terrain Camera orthoimage of the scenario DTM pair (USGS Astrogeology
                      STAC kaguya_terrain_camera_usgs_dtms_v2, ~10.6 m/px) -> 2048 px. No public LROC NAC COG
                      of this window is listed in the USGS STAC catalogue.
  * shackleton        Hillshade (sun 315 deg / 35 deg, as today) computed from the LRO LOLA 5 m/px LDEM Site04
                      (NASA GSFC PGDA, Barker et al. 2021) -> 2048 px. Derived from the DEM, NOT a photograph.
  * Earth sites       Sentinel-2 L2A B04/B03/B02 (10 m) of the SAME scene as the existing image (Microsoft
                      Planetary Computer), same common linear stretch and gamma 1/1.2, cubic resampling to
                      2048 px plus mild unsharp masking FOR DISPLAY. The native detail is still 10 m.
  * la-corona         Exception: Spain's PNOA-MA aerial orthophoto (IGN, 0.20 m, WMS https://www.ign.es/wms-inspire/pnoa-ma,
                      AccessConstraints "CC BY 4.0 scne.es"), warped to the site frame and colour-matched to the
                      Sentinel-2 preview; falls back to the Sentinel-2 product above if the WMS fails.

Reproducible and cached: downloads and tiles reuse the caches of the existing pipelines (~/.cache/ares-twin,
~/.cache/ares-twin-context); per-site results live in ~/.cache/ares-twin-hires. Existing outputs are reused
unless --force. Writes are atomic. A failing site never aborts the run and keeps its previous imagery.

Every new image is checked against the previous image of the same window: it is reduced to the preview
scale and compared (Pearson r and phase-correlation shift); a site with r below MIN_R fails.

Run (needs planetary-computer, so the Earth venv):
  .venv-data/bin/python scripts/fetch-hires-imagery.py [--force] [--no-json] [id ...]
"""
import argparse, importlib.util, io, json, os, pathlib, re, sys, traceback, urllib.parse, urllib.request

import numpy as np
import rasterio
from PIL import Image, ImageFilter
from pyproj import CRS, Transformer
from rasterio.enums import Resampling
from rasterio.windows import Window

ROOT = pathlib.Path(__file__).resolve().parents[1]
Image.MAX_IMAGE_PIXELS = None


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


fc = _load('fetch_context', 'fetch-context.py')   # geo_tiles(), TREK_CTX (tile pyramid quirks)
fe, ft = fc.fe, fc.ft                             # fetch-scenarios-earth.py, fetch-targets.py

CACHE = pathlib.Path(os.environ.get('XDG_CACHE_HOME', pathlib.Path.home() / '.cache')) / 'ares-twin-hires'
EXTENT = 2400.0
JPEG_Q = (82, 78, 75)
# Gaussian prefilter sigmas (output px) tried in order only when the size budget is not met at quality 75
# (HiRISE at 0.59 m/px is rich in real texture); the sigma used is stated in imagery.product.
PREFILTER = (0.0, 0.6, 1.0, 1.4)
MAX_BYTES = {4096: 2_500_000, 2048: 1_000_000}
MIN_R = 0.6          # minimum Pearson r against the preview, at preview scale or after smoothing both to ~25 m
MAX_SHIFT_M = 20.0   # maximum residual translation against the preview (phase correlation)
STAC_ITEM = 'https://stac.astrogeology.usgs.gov/api/collections/{c}/items/{i}'
PC_ITEM = 'https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/{i}'

SITES = {
    'jezero': {'body': 'mars', 'px': 4096, 'kind': 'cog',
               'stac': ('mro_hirise_socet_dtms', 'DTEEC_045994_1985_046060_1985_U01'),
               'asset_name': 'ESP_045994_1985_RED_A_01_ORTHO.tif',
               'product': 'MRO HiRISE ESP_045994_1985_RED_A_01_ORTHO, controlled orthoimage of the scenario DTM '
                          '(USGS Astrogeology), native {native:.2f} m/px',
               'credit': 'NASA/JPL-Caltech/University of Arizona (HiRISE); COG USGS Astrogeology',
               'license': 'CC0-1.0 (per the USGS Astrogeology STAC catalogue); HiRISE credit NASA/JPL/UArizona'},
    'valles-marineris': {'body': 'mars', 'px': 2048, 'kind': 'tiles', 'register': True,
                         'tiles': {**fc.TREK_CTX, 'levels': [12, 11]},
                         'native': 5.09,
                         'product': 'MRO CTX global mosaic beta01 (Caltech Murray Lab, uncontrolled), Esri tile level '
                                    '12 (0.309 arcsec/px, ~5 m/px; CTX native ~5-6 m/px)',
                         'credit': 'NASA/JPL/MSSS/The Murray Lab (CTX global mosaic beta01); tiles hosted by Esri',
                         'license': 'CTX data NASA (public domain); "The Murray Lab/Caltech grants free use of the '
                                    'beta01 version of the mosaic for all purposes" (Esri OnMars/CTX service description)',
                         'source': 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer'},
    'marius-hills': {'body': 'moon', 'px': 2048, 'kind': 'cog',
                     'stac': ('kaguya_terrain_camera_usgs_dtms_v2', 'TC1W2B0_01_02742N140E3036__TC2W2B0_01_02742N145E3036'),
                     'asset': 'orthoimage_left',
                     'product': 'SELENE/Kaguya Terrain Camera orthoimage TC1W2B0_01_02742N140E3036 of the scenario DTM '
                                'pair (USGS Astrogeology, aligned to LOLA), native {native:.1f} m/px',
                     'credit': 'JAXA/SELENE Terrain Camera; orthoimage USGS Astrogeology',
                     'license': 'SELENE data (c) JAXA, free use with attribution (JAXA SELENE Data Archive); USGS product public domain'},
    'shackleton': {'body': 'moon', 'px': 2048, 'kind': 'hillshade',
                   'dem': 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif',
                   'native': 5.0,
                   'product': 'Hillshade (sun azimuth 315 deg, elevation 35 deg) computed from the LRO LOLA 5 m/px LDEM '
                              'Site04 (Barker et al. 2021), bicubic-sampled to the local frame; derived from the DEM, '
                              'not a photograph',
                   'credit': 'Hillshade computed from the LRO LOLA 5 m LDEM (NASA GSFC PGDA, Barker et al. 2021); not a photograph',
                   'license': 'Public domain (NASA data)',
                   'source': 'https://pgda.gsfc.nasa.gov/products/78'},
}
for _e in ('la-corona', 'wright-valley', 'atacama', 'wadi-rum'):
    SITES[_e] = {'body': 'earth', 'px': 2048, 'kind': 's2', 'native': 10.0}
# La Corona (Lanzarote): Spain's PNOA-MA aerial orthophoto is open data (WMS AccessConstraints "CC BY 4.0 scne.es",
# Fees "No se aplican condiciones"), so it replaces the 10 m Sentinel-2 view there. Falls back to Sentinel-2 on failure.
SITES['la-corona']['pnoa'] = {
    'wms': 'https://www.ign.es/wms-inspire/pnoa-ma', 'layer': 'OI.OrthoimageCoverage', 'info_layer': 'OI.MosaicElement',
    'crs': 'EPSG:32628', 'px': 4096, 'pad_m': 100.0,
    'credit': 'PNOA-MA orthophoto courtesy of (c) Instituto Geografico Nacional de Espana (scne.es)',
    'license': 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), per the IGN PNOA-MA WMS access constraints "CC BY 4.0 scne.es"'}
EARTH = [k for k, v in SITES.items() if v['body'] == 'earth']


def log(*a):
    print(*a, flush=True)


def grid_path(ident):
    return ROOT / 'assets/data/scenarios' / ('earth' if SITES[ident]['body'] == 'earth' else 'targets') / f'{ident}.json'


def rel(p):
    return str(pathlib.Path(p).relative_to(ROOT))


def atomic_write(dest, data):
    tmp = dest.with_name(f'.{dest.name}.tmp')
    tmp.write_bytes(data)
    os.replace(tmp, dest)


def http_json(url):
    req = urllib.request.Request(url, headers=ft.UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def cached_json(key, fn):
    p = CACHE / f'{key}.json'
    if p.exists():
        return json.loads(p.read_text())
    val = fn()
    CACHE.mkdir(parents=True, exist_ok=True)
    atomic_write(p, json.dumps(val).encode())
    return val


# ---------------------------------------------------------------- sampling (local frame, bicubic)
def frame_nodes(lat0, lon0, radius, n, offset_m=(0.0, 0.0)):
    """lon/lat of an n×n node grid whose first/last nodes sit on the window edges (fetch-targets frame).
    offset_m = (east, north) shift of the sampling positions, used only to register an uncontrolled mosaic."""
    step = EXTENT / (n - 1)
    half = EXTENT / 2
    east = -half + np.arange(n) * step + offset_m[0]
    north = half - np.arange(n) * step + offset_m[1]
    ee, nn = np.meshgrid(east, north)
    aeqd = CRS.from_proj4(f'+proj=aeqd +lat_0={lat0} +lon_0={lon0} +R={radius} +units=m +no_defs')
    geo = CRS.from_proj4(f'+proj=longlat +R={radius} +no_defs')
    lon, lat = Transformer.from_crs(aeqd, geo, always_xy=True).transform(ee, nn)
    return np.asarray(lon), np.asarray(lat)


def _cubic_w(t):
    """Catmull-Rom weights for offsets -1, 0, 1, 2."""
    t2, t3 = t * t, t * t * t
    return (-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2)


def bicubic(arr, fx, fy, chunk=256):
    """Catmull-Rom sample of arr at fractional pixel-centre coordinates (NaN propagates; outside -> NaN)."""
    h, w = arr.shape
    out = np.empty(fx.shape, dtype='float32')
    for r0 in range(0, fx.shape[0], chunk):
        x, y = fx[r0:r0 + chunk], fy[r0:r0 + chunk]
        x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
        wx, wy = _cubic_w(x - x0), _cubic_w(y - y0)
        acc = np.zeros(x.shape, dtype='float64')
        for j in range(4):
            yy = np.clip(y0 + j - 1, 0, h - 1)
            row = np.zeros(x.shape, dtype='float64')
            for i in range(4):
                row += wx[i] * arr[yy, np.clip(x0 + i - 1, 0, w - 1)]
            acc += wy[j] * row
        acc[(x < -0.5) | (y < -0.5) | (x > w - 0.5) | (y > h - 0.5)] = np.nan
        out[r0:r0 + chunk] = acc
    return out


def sample_cog(path, lon, lat, radius, cell_m, zero_is_nodata=True):
    """Like fetch-targets.sample_raster (area average to ~cell_m when the product is finer), but bicubic."""
    with rasterio.Env(**fe.GDAL_ENV), rasterio.open(path) as ds:
        x, y = ft.to_dataset_xy(ds, lon, lat, radius)
        col, row = ~ds.transform * (x, y)
        native = abs(ds.transform.a)
        f = max(1, int(round(cell_m / native)))
        c0 = max(int(np.floor(col.min())) - 3 * f, 0)
        r0 = max(int(np.floor(row.min())) - 3 * f, 0)
        c1 = min(int(np.ceil(col.max())) + 3 * f, ds.width)
        r1 = min(int(np.ceil(row.max())) + 3 * f, ds.height)
        if c1 <= c0 or r1 <= r0:
            raise RuntimeError('window outside the product')
        w, h = c1 - c0, r1 - r0
        ow, oh = max(4, round(w / f)), max(4, round(h / f))
        data = ds.read(1, window=Window(c0, r0, w, h), out_shape=(oh, ow),
                       resampling=Resampling.average if f > 1 else Resampling.nearest, masked=True)
        arr = data.astype('float32').filled(np.nan)
        arr[arr <= -1e30] = np.nan
        if zero_is_nodata:
            arr[arr <= 0] = np.nan          # 0 = nodata in HiRISE / CTX / TC orthos
        del x, y
        fx = (col - c0) / (w / ow) - 0.5
        fy = (row - r0) / (h / oh) - 0.5
        return bicubic(arr, fx, fy), native, f * native


def stretch_l(vals):
    """Linear stretch of the window's 1st-99th percentiles (as fetch-targets.write_jpeg)."""
    lo, hi = np.nanpercentile(vals, [1, 99])
    img = np.clip((np.nan_to_num(vals, nan=lo) - lo) / max(hi - lo, 1e-9) * 255, 0, 255)
    return np.round(img).astype('uint8')


# ---------------------------------------------------------------- products
def build_target(ident, grid, offset_m=(0.0, 0.0)):
    cfg = SITES[ident]
    lat0, lon0 = grid['center']
    radius = ft.RADIUS[cfg['body']]
    n = cfg['px']
    step = EXTENT / (n - 1)
    lon, lat = frame_nodes(lat0, lon0, radius, n, offset_m)
    meta = {}
    if cfg['kind'] == 'cog':
        coll, item_id = cfg['stac']
        item = cached_json(f'stac-{item_id}', lambda: http_json(STAC_ITEM.format(c=coll, i=item_id)))
        if 'asset_name' in cfg:
            href = next(a['href'] for a in item['assets'].values() if a['href'].endswith(cfg['asset_name']))
        else:
            href = item['assets'][cfg['asset']]['href']
        vals, native, used = sample_cog('/vsicurl/' + href, lon, lat, radius, step)
        meta.update(source=href, native=native, used=used)
    elif cfg['kind'] == 'tiles':
        vals, levels = fc.geo_tiles(cfg['tiles'], lon, lat)
        vals = vals.astype('float32')
        vals[~(vals > 0)] = np.nan
        meta.update(source=cfg['source'], native=cfg['native'], levels={str(k): v for k, v in levels.items()},
                    template=cfg['tiles']['template'])
    elif cfg['kind'] == 'hillshade':
        dem = ft.cached_download(cfg['dem'])
        z, native, _ = sample_cog(dem, lon, lat, radius, cfg['native'], zero_is_nodata=False)
        if np.mean(np.isfinite(z)) < 0.99:
            raise RuntimeError('hillshade DEM window incomplete')
        vals = ft.hillshade(np.nan_to_num(z, nan=float(np.nanmean(z))).astype('float64'), step)
        meta.update(source=cfg['source'], native=cfg['native'], dem=cfg['dem'])
    valid = float(np.mean(np.isfinite(vals)))
    if valid < 0.98:
        raise RuntimeError(f'image window incomplete ({valid:.1%} valid)')
    meta['validFraction'] = round(valid, 4)
    return Image.fromarray(stretch_l(vals), 'L'), meta


def s2_record(ident, grid):
    img = grid['imagery']
    m = re.search(r'/items/([^/?#]+)$', img.get('previewSource') or img['source'])
    if not m:
        raise RuntimeError('previous imagery.source does not name a Sentinel-2 item')
    item_id = m.group(1)

    def get():
        it = http_json(PC_ITEM.format(i=item_id))
        return {'id': it['id'], 'datetime': it['properties']['datetime'],
                'baseline': it['properties'].get('s2:processing_baseline'),
                'assets': {b: it['assets'][b]['href'].split('?')[0] for b in ('B02', 'B03', 'B04')}}
    rec = cached_json(f'{ident}-s2-{item_id}', get)
    st = re.search(r'\[(-?[\d.]+),\s*(-?[\d.]+)\]', img.get('previewProduct') or img.get('product', ''))
    if not st:
        raise RuntimeError('previous imagery.product does not state the stretch')
    return rec, (float(st.group(1)), float(st.group(2)))


def wms_get(cfg, **params):
    q = dict(SERVICE='WMS', VERSION='1.3.0', STYLES='', CRS=cfg['crs'], **params)
    req = urllib.request.Request(cfg['wms'] + '?' + urllib.parse.urlencode(q), headers=ft.UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.headers.get('Content-Type', ''), r.read()


def build_pnoa(ident, grid, preview):
    """PNOA-MA orthophoto (GetMap in UTM, then warped to the site AEQD frame, image edges = window edges)."""
    from rasterio.transform import from_origin
    from rasterio.warp import reproject
    cfg = SITES[ident]['pnoa']
    n = SITES[ident]['px']
    lat, lon = grid['center']
    cx, cy = Transformer.from_crs('EPSG:4326', cfg['crs'], always_xy=True).transform(lon, lat)
    h = EXTENT / 2 * 1.05 + cfg['pad_m']          # AEQD vs UTM scale/rotation differ by < 1 % here
    src_px = cfg['px']
    raw_p = CACHE / f'{ident}-pnoa-{src_px}.png'
    if not raw_p.exists():
        ctype, raw = wms_get(cfg, REQUEST='GetMap', LAYERS=cfg['layer'], BBOX=f'{cx - h},{cy - h},{cx + h},{cy + h}',
                             WIDTH=src_px, HEIGHT=src_px, FORMAT='image/png')
        if not ctype.startswith('image/'):
            raise RuntimeError(f'PNOA GetMap returned {ctype}: {raw[:200]!r}')
        CACHE.mkdir(parents=True, exist_ok=True)
        atomic_write(raw_p, raw)
    src = np.asarray(Image.open(raw_p).convert('RGB'), dtype='float32')

    def info():          # acquisition month and ground resolution of the mosaic elements across the window
        out = []
        for fi, fj in ((0.5, 0.5), (0.2, 0.2), (0.8, 0.2), (0.2, 0.8), (0.8, 0.8)):
            _, txt = wms_get(cfg, REQUEST='GetFeatureInfo', LAYERS=cfg['info_layer'], QUERY_LAYERS=cfg['info_layer'],
                             BBOX=f'{cx - h},{cy - h},{cx + h},{cy + h}', WIDTH=512, HEIGHT=512, FORMAT='image/png',
                             INFO_FORMAT='text/plain', I=int(fi * 512), J=int(fj * 512))
            t = txt.decode('utf-8', 'replace')
            d, r = re.search(r"FECHA = '([^']+)'", t), re.search(r"RESOLUCION = '([^']+)'", t)
            out.append({'date': d and d.group(1), 'resolutionM': r and float(r.group(1))})
        return out
    elements = cached_json(f'{ident}-pnoa-elements', info)
    src_t = from_origin(cx - h, cy + h, 2 * h / src_px, 2 * h / src_px)
    dst_t = from_origin(-EXTENT / 2, EXTENT / 2, EXTENT / n, EXTENT / n)
    dst = np.full((3, n, n), np.nan, dtype='float32')
    for b in range(3):
        reproject(src[..., b], dst[b], src_transform=src_t, src_crs=cfg['crs'], dst_transform=dst_t,
                  dst_crs=fe.site_crs(lat, lon), resampling=Resampling.cubic, src_nodata=None, dst_nodata=np.nan)
    rgb = np.moveaxis(dst, 0, -1)
    if np.mean(np.isfinite(rgb)) < 0.999:
        raise RuntimeError('PNOA window incomplete')
    # Colour-match to the Sentinel-2 preview (per-channel gain/offset on means and standard deviations at the preview
    # scale) so that the progressive swap keeps the same colour balance. Display choice; documented in imagery.product.
    prev = np.asarray(Image.open(ROOT / preview).convert('RGB'), dtype='float32')
    small = np.asarray(Image.fromarray(np.clip(np.nan_to_num(rgb), 0, 255).astype('uint8')).resize(
        (prev.shape[1], prev.shape[0]), Image.BOX), dtype='float32')
    gain = prev.reshape(-1, 3).std(0) / np.maximum(small.reshape(-1, 3).std(0), 1e-6)
    off = prev.reshape(-1, 3).mean(0) - gain * small.reshape(-1, 3).mean(0)
    out = np.clip(rgb * gain + off, 0, 255)
    img = Image.fromarray(np.round(np.nan_to_num(out)).astype('uint8'), 'RGB')
    res = [e['resolutionM'] for e in elements if e['resolutionM']]
    dates = sorted({e['date'] for e in elements if e['date']})
    return img, {'pnoa': True, 'native': max(res) if res else None, 'dates': dates,
                 'colourMatch': {'gain': [round(float(v), 3) for v in gain], 'offset': [round(float(v), 1) for v in off]},
                 'sourcePx': src_px, 'sourcePixelM': round(2 * h / src_px, 3)}


def build_earth(ident, grid, preview=None):
    n = SITES[ident]['px']
    lat, lon = grid['center']
    if SITES[ident].get('pnoa'):
        try:
            return build_pnoa(ident, grid, preview)
        except Exception as e:
            log(f'  PNOA failed ({e.__class__.__name__}: {e}); falling back to Sentinel-2')
    rec, (lo, hi) = s2_record(ident, grid)
    offset = 1000 if float(rec['baseline'] or 0) >= 4 else 0      # BOA_ADD_OFFSET for baseline >= 04.00
    bands = [fe.warp(fe.sign(rec['assets'][b]), lat, lon, n, EXTENT / n, Resampling.cubic, 1,
                     src_nodata=0, dtype='float32')[0] for b in ('B04', 'B03', 'B02')]
    refl = (np.stack(bands, -1) - offset) / 10000
    if np.mean(np.isfinite(refl)) < 0.999:
        raise RuntimeError('Sentinel-2 window incomplete')
    rgb = np.clip((refl - lo) / (hi - lo), 0, 1) ** (1 / 1.2)
    img = Image.fromarray(np.round(np.nan_to_num(rgb) * 255).astype('uint8'), 'RGB')
    # mild unsharp mask at ~half a native 10 m pixel (display only; it adds no information)
    img = img.filter(ImageFilter.UnsharpMask(radius=3, percent=45, threshold=2))
    return img, {'rec': rec, 'stretch': [lo, hi], 'native': 10.0}


# ---------------------------------------------------------------- alignment check
def to_preview_scale(new, old, frame):
    """Reduce the new image to the preview grid of the same window (grey, float)."""
    a = new.convert('L')
    if frame == 'edge':                     # pixel edges = window edges in both images
        return np.asarray(a.resize(old.size, Image.BOX), dtype='float64')
    # node frame: pixel centres of the first/last rows sit on the window edges in both images
    ratio = (a.size[0] - 1) / (old.size[0] - 1)
    blurred = np.asarray(a.filter(ImageFilter.BoxBlur(ratio / 2)), dtype='float64')
    i = np.arange(old.size[0]) * ratio
    fx, fy = np.meshgrid(i, i)
    return ft.bilinear(blurred, fx, fy)


def phase_shift(ref, mov):
    """(dy, dx) in pixels such that ref(p) ~ mov(p - d)."""
    win = np.outer(np.hanning(ref.shape[0]), np.hanning(ref.shape[1]))
    A = np.fft.fft2((ref - ref.mean()) * win)
    B = np.fft.fft2((mov - mov.mean()) * win)
    R = A * np.conj(B)
    r = np.real(np.fft.ifft2(R / np.maximum(np.abs(R), 1e-12)))
    py, px = np.unravel_index(np.argmax(r), r.shape)
    out = []
    for p, axis_len, getter in ((py, r.shape[0], lambda k: r[k % r.shape[0], px]),
                                (px, r.shape[1], lambda k: r[py, k % r.shape[1]])):
        c0, cm, cp = getter(p), getter(p - 1), getter(p + 1)
        den = cm - 2 * c0 + cp
        sub = 0.5 * (cm - cp) / den if den != 0 else 0.0
        v = p + sub
        out.append(v - axis_len if v > axis_len / 2 else v)
    return out[0], out[1]


def gauss(a, sigma):
    """Separable Gaussian blur with edge padding (numpy only)."""
    r = int(np.ceil(3 * sigma))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    p = np.pad(a, r, mode='edge')
    p = np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 0, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 1, p)


def alignment(new, old_path, frame):
    old = Image.open(old_path)
    ref = np.asarray(old.convert('L'), dtype='float64')
    mov = to_preview_scale(new, old, frame)
    ok = np.isfinite(mov) & np.isfinite(ref)
    r = float(np.corrcoef(ref[ok], mov[ok])[0, 1])
    # same comparison after smoothing both to ~25 m (cross-sensor sources differ in fine texture, not in layout)
    px_m0 = EXTENT / old.size[0]
    k = 25.0 / px_m0 / 2
    sm = lambda a: gauss(np.nan_to_num(a, nan=float(np.nanmean(a))), k)
    r25 = float(np.corrcoef(sm(ref)[ok], sm(mov)[ok])[0, 1])
    dy, dx = phase_shift(ref, np.nan_to_num(mov, nan=float(np.nanmean(mov))))
    px_m = EXTENT / old.size[0] if frame == 'edge' else EXTENT / (old.size[0] - 1)
    return {'reference': rel(old_path), 'referencePx': old.size[0], 'pearsonR': round(r, 3), 'pearsonR25m': round(r25, 3),
            'shiftPx': [round(dy, 2), round(dx, 2)], 'shiftM': round(float(np.hypot(dy, dx)) * px_m, 1),
            '_d': (dy, dx), '_px_m': px_m}


# ---------------------------------------------------------------- output
def encode_jpeg(img, limit):
    for sigma in PREFILTER:
        im = img.filter(ImageFilter.GaussianBlur(sigma)) if sigma else img
        for q in JPEG_Q:
            buf = io.BytesIO()
            im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
            if buf.tell() <= limit:
                return buf.getvalue(), q, sigma
    raise RuntimeError(f'JPEG over {limit} bytes even at quality {JPEG_Q[-1]} with prefilter sigma {PREFILTER[-1]}')


def imagery_record(ident, grid, preview, meta, check, q, size):
    cfg = SITES[ident]
    n = cfg['px']
    old = grid['imagery']
    sub = 'earth' if cfg['body'] == 'earth' else 'targets'
    out = {'path': f'assets/data/scenarios/{sub}/{ident}-hires.jpg', 'previewPath': preview}
    check = {k: v for k, v in check.items() if not k.startswith('_')}
    if cfg['body'] == 'earth' and meta.get('pnoa'):
        p = cfg['pnoa']
        out.update({
            'credit': p['credit'], 'license': p['license'],
            'source': f'{p["wms"]}?SERVICE=WMS&REQUEST=GetCapabilities',
            'product': (f'PNOA-MA aerial orthophoto mosaic (IGN Spain), WMS layer {p["layer"]}, ground resolution '
                        f'{meta["native"]} m per the mosaic metadata; requested as {meta["sourcePx"]} px in {p["crs"]} '
                        f'({meta["sourcePixelM"]} m/px) and cubic-warped to {n} px ({EXTENT / n:.2f} m/px) in the site '
                        'azimuthal-equidistant frame (image edges = window edges); colours matched per channel '
                        f'(linear gain/offset {meta["colourMatch"]}) to the Sentinel-2 preview so the progressive swap '
                        'keeps the same colour balance, so they are not the aerial camera\'s own colours.'),
            'nativeResolutionM': meta['native'], 'widthPx': n,
            'note': (f'Aerial orthophoto finer than the display ({EXTENT / n:.2f} m/px). Different date and sensor than '
                     f'the Sentinel-2 preview; residual offset against it {check["shiftM"]} m (phase correlation), within '
                     'Sentinel-2 geolocation accuracy, so the PNOA geometry is kept unshifted.'),
            'acquired': ', '.join(meta['dates']) or None,
            'previewCredit': old.get('previewCredit') or old['credit'],
            'previewLicense': old.get('previewLicense') or old['license'],
            'previewSource': old.get('previewSource') or old['source'],
            'previewProduct': old.get('previewProduct') or old['product'],
        })
    elif cfg['body'] == 'earth':
        rec = meta['rec']
        out.update({
            'credit': old.get('previewCredit') or old['credit'], 'license': old.get('previewLicense') or old['license'],
            'source': old.get('previewSource') or old['source'],
            'product': ('Sentinel-2 L2A surface reflectance B04/B03/B02 at its native 10 m ground sampling, same scene and '
                        f'same common linear stretch {meta["stretch"]} and gamma 1/1.2 as the preview; cubic resampling '
                        f'to {n} px ({EXTENT / n:.2f} m/px) over the 2400 m window (image edges = window edges) and mild '
                        'unsharp masking, for display only. It shows no detail finer than 10 m.'),
            'nativeResolutionM': 10.0, 'widthPx': n,
            'note': ('10 m data resampled for display: the extra pixels are interpolation, not observed detail. '
                     'No licence-compatible public imagery finer than 10 m was used for this site.'),
            'acquired': old.get('acquired', rec['datetime']),
        })
        for k in ('sceneCloudCoverPct', 'windowCloudFraction'):
            if k in old:
                out[k] = old[k]
    else:
        native = meta['native']
        disp = EXTENT / (n - 1)
        product = cfg['product'].format(native=native)
        if cfg['kind'] == 'cog' and meta['used'] > native * 1.01:
            product += f', area-averaged to {meta["used"]:.2f} m'
        if meta.get('prefilterSigmaPx'):
            product += (f', light Gaussian prefilter (sigma {meta["prefilterSigmaPx"]} px) to fit the '
                        f'{MAX_BYTES[n] / 1e6:.1f} MB JPEG budget')
        product += (f'; {n} px at {disp:.2f} m/px in the local azimuthal-equidistant frame (row 0 = north, column 0 = '
                    'west, edge pixel centres on the 2400 m window edges), linear stretch of the 1st-99th percentiles')
        out.update({'credit': cfg['credit'], 'license': cfg['license'], 'source': meta['source'],
                    'kind': 'hillshade' if cfg['kind'] == 'hillshade' else 'orthoimage',
                    'product': product, 'nativeResolutionM': round(native, 2), 'widthPx': n})
        if cfg['kind'] == 'tiles':
            out['tiles'] = meta['template'].replace('{z}', str(max(int(k) for k in meta['levels'])))
            out['levels'] = meta['levels']
            reg = meta.get('registration')
            out['note'] = ('Uncontrolled mosaic: registered to the controlled USGS CTX orthoimage used by the preview by '
                           f'phase correlation (translation east {reg["eastM"]} m, north {reg["northM"]} m); seams '
                           'between CTX orbits may remain.' if reg else
                           'Uncontrolled mosaic: may be offset by tens of metres from the DTM; seams may remain.')
        if cfg['kind'] == 'hillshade':
            out['note'] = ('Derived from the DEM (computed relief shading), not a photograph. About 90 % of the 5 m LDEM '
                           'pixels are interpolated between LOLA footprints (Barker et al. 2021), so metre-scale pits and '
                           'bumps in the shading can be interpolation artefacts rather than boulders or craters.')
    out['alignmentCheck'] = check
    out['jpegQuality'] = q
    out['bytes'] = size
    return out


def process(ident, force, write_json):
    cfg = SITES[ident]
    gp = grid_path(ident)
    text = gp.read_text(encoding='utf-8')
    grid = json.loads(text)
    if json.dumps(grid, ensure_ascii=False, separators=(',', ':')) + '\n' != text:
        raise RuntimeError('grid JSON does not round-trip byte-exactly; refusing to rewrite it')
    old = grid.get('imagery') or {}
    preview = old.get('previewPath') or old.get('path')
    if not preview or preview.endswith('-hires.jpg') or not (ROOT / preview).exists():
        raise RuntimeError(f'no previous imagery to keep as preview ({preview})')
    dest = gp.with_name(f'{ident}-hires.jpg')
    side = CACHE / f'{ident}-result.json'
    frame = 'edge' if cfg['body'] == 'earth' else 'node'
    if dest.exists() and side.exists() and not force:
        log('  cached', rel(dest))
        res = json.loads(side.read_text())
        meta, q = res['meta'], res['q']
        data = dest.read_bytes()
    else:
        if cfg['body'] == 'earth':
            img, meta = build_earth(ident, grid, preview)
        else:
            img, meta = build_target(ident, grid)
            if cfg.get('register'):
                chk = alignment(img, ROOT / preview, frame)
                dy, dx = chk['_d']
                if np.hypot(dy, dx) > 0.25:
                    # ref(p) ~ mov(p - d): sample the source d preview pixels back (rows grow southwards)
                    east, north = -dx * chk['_px_m'], dy * chk['_px_m']
                    img2, meta2 = build_target(ident, grid, (east, north))
                    chk2 = alignment(img2, ROOT / preview, frame)
                    log(f'  registration: shift {chk["shiftM"]} m r={chk["pearsonR"]} -> {chk2["shiftM"]} m r={chk2["pearsonR"]}')
                    if chk2['pearsonR'] > chk['pearsonR']:
                        img, meta = img2, meta2
                        meta['registration'] = {'eastM': round(east, 1), 'northM': round(north, 1)}
        data, q, meta['prefilterSigmaPx'] = encode_jpeg(img, MAX_BYTES[cfg['px']])
    img = Image.open(io.BytesIO(data))     # check the encoded image (after any prefilter and JPEG coding)
    img.load()
    size = len(data)
    check = alignment(img, ROOT / preview, frame)
    log(f'  {ident}: {img.size[0]} px, q{q}, {size / 1e6:.2f} MB, r={check["pearsonR"]} '
        f'(25 m: {check["pearsonR25m"]}), shift {check["shiftM"]} m')
    if max(check['pearsonR'], check['pearsonR25m']) < MIN_R or check['shiftM'] > MAX_SHIFT_M:
        raise RuntimeError(f'alignment check failed (r={check["pearsonR"]}, r25={check["pearsonR25m"]}, '
                           f'shift {check["shiftM"]} m)')
    if not (dest.exists() and dest.read_bytes() == data):
        atomic_write(dest, data)           # only after the check passed: a failing site keeps its old files
        CACHE.mkdir(parents=True, exist_ok=True)
        atomic_write(side, json.dumps({'meta': meta, 'q': q}).encode())
    imagery = imagery_record(ident, grid, preview, meta, check, q, size)
    if write_json:
        new = dict(grid)
        new['imagery'] = imagery
        for k in grid:
            if k != 'imagery':
                assert json.dumps(new[k], ensure_ascii=False) == json.dumps(grid[k], ensure_ascii=False)
        atomic_write(gp, (json.dumps(new, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8'))
        log('  updated imagery in', rel(gp))
    return imagery


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('ids', nargs='*', default=list(SITES), help=f'sites (default all): {", ".join(SITES)}')
    ap.add_argument('--force', action='store_true', help='rebuild images even if a cached result exists')
    ap.add_argument('--no-json', action='store_true', help='write images only, leave the grid JSONs untouched')
    args = ap.parse_args()
    unknown = [i for i in args.ids if i not in SITES]
    if unknown:
        ap.error(f'unknown ids: {unknown}')
    ok, failed = [], []
    for ident in args.ids:
        log('==', ident)
        try:
            process(ident, args.force, not args.no_json)
            ok.append(ident)
        except Exception as e:
            failed.append(ident)
            log(f'  FAILED {ident}: {e.__class__.__name__}: {e} (previous imagery kept)')
            traceback.print_exc()
    log(f'done: {len(ok)}/{len(args.ids)} ok; failed: {", ".join(failed) or "none"}')
    return 0 if not failed else 1


if __name__ == '__main__':
    sys.exit(main())
