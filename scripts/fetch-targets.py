#!/usr/bin/env python3
"""A.R.E.S. Twin — Frente 2: real Moon/Mars terrain windows (docs/contracts.md §2).

Builds assets/data/scenarios/targets/<id>.json (+ .jpg context image) for
shackleton, marius-hills, jezero and valles-marineris from PUBLIC, credential-free
archives only (USGS Astrogeology STAC COGs, NASA GSFC PGDA, PDS Geosciences Node,
Mars Climate Database web interface). Nothing is synthesised: if a source fails the
target is skipped (elevation) or the field is left null (thermal / roughness / image).

Environment (Python 3.14):
    python3 -m venv --without-pip .venv-planet
    pip3 --python .venv-planet/bin/python install rasterio numpy pillow pyproj
    .venv-planet/bin/python scripts/fetch-targets.py [target-id ...]

Grid recipe (identical for the four targets):
  * Local azimuthal-equidistant frame centred on `center` (sphere of the body), so
    row 0 = local NORTH and column 0 = local WEST even at the lunar south pole.
  * 129×129 nodes at 18.75 m (2400 m extent) sampled bilinearly from the native DEM
    after area-averaging it to ~18.75 m cells (GDAL average resampling / overviews).
  * Downsampled to 65×65 at 37.5 m with terrain_metrics.bilinear_resample and
    measured with terrain_metrics.compute_metrics (shared with the Earth pipeline).
Downloads are cached in $ARES_CACHE (default ~/.cache/ares-twin).
"""
import datetime
import json
import math
import os
import pathlib
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
import rasterio
from PIL import Image
from pyproj import CRS, Transformer
from rasterio.enums import Resampling
from rasterio.windows import Window

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from terrain_metrics import bilinear_resample, compute_metrics  # noqa: E402

OUT = ROOT / 'assets/data/scenarios/targets'
CACHE = pathlib.Path(os.environ.get('ARES_CACHE', pathlib.Path.home() / '.cache/ares-twin'))
UA = {'User-Agent': 'ARES-Twin-hackathon/2.0 (educational prototype; NASA Space Apps)'}

N, SPACING, EXTENT = 65, 37.5, 2400.0
SRC_N, SRC_SPACING = 129, 18.75          # pre-grid: 2x denser, then bilinear_resample -> 65
IMG_N = 512                               # context image pixels (north-up, same window)
RADIUS = {'moon': 1737400.0, 'mars': 3396190.0}
ENV = {
    'moon': {'gravityMs2': 1.62, 'solarConstantWm2': 1361, 'atmosphere': 'Ninguna (exosfera, ~3×10⁻¹⁵ bar)',
             'dayLengthHours': 708.7},
    'mars': {'gravityMs2': 3.71, 'solarConstantWm2': 590, 'atmosphere': 'CO₂ ~95 %, presión superficial ~6–7 hPa (≈0.6 % de la terrestre)',
             'dayLengthHours': 24.66},
}
STAC = 'https://stac.astrogeology.usgs.gov/api'
PRP_SOUTH = 'https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab'
GCP_BASE = 'https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/'
MINIRF_CPR = 'https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-5-global-mosaic-v1/lromrf_1001/data/128ppd/global_cpr_128ppd_simp_0c.img'
MCD_CGI = 'http://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py'
NOW = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------- HTTP helpers
def http(url, rng=None, timeout=120, tries=3):
    headers = dict(UA)
    if rng:
        headers['Range'] = f'bytes={rng[0]}-{rng[1]}'
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as r:
                return r.read()
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 + 3 * attempt)


def cached_download(url):
    dest = CACHE / 'dl' / pathlib.Path(urllib.parse.urlparse(url).path).name
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix('.part')
        tmp.write_bytes(http(url, timeout=900))
        tmp.rename(dest)
    return str(dest)


def stac_item(collection, item_id):
    return json.loads(http(f'{STAC}/collections/{collection}/items/{item_id}'))


# ---------------------------------------------------------------- geometry
def local_nodes(lat0, lon0, radius, n, spacing):
    """Node lon/lat (deg) of an n×n north-up grid centred on (lat0, lon0)."""
    half = (n - 1) * spacing / 2
    east = np.array([-half + c * spacing for c in range(n)])
    north = np.array([half - r * spacing for r in range(n)])
    ee, nn = np.meshgrid(east, north)
    aeqd = CRS.from_proj4(f'+proj=aeqd +lat_0={lat0} +lon_0={lon0} +R={radius} +units=m +no_defs')
    geo = CRS.from_proj4(f'+proj=longlat +R={radius} +no_defs')
    lon, lat = Transformer.from_crs(aeqd, geo, always_xy=True).transform(ee, nn)
    return np.asarray(lon), np.asarray(lat)


def to_dataset_xy(ds, lon, lat, radius):
    geo = CRS.from_proj4(f'+proj=longlat +R={radius} +no_defs')
    t = Transformer.from_crs(geo, CRS.from_wkt(ds.crs.to_wkt()), always_xy=True)
    b = ds.bounds
    best = None
    for shift in (0, 360, -360):   # products may use 0–360 or ±180 longitudes
        x, y = t.transform(lon + shift, lat)
        x, y = np.asarray(x), np.asarray(y)
        inside = np.mean((x >= b.left) & (x <= b.right) & (y >= b.bottom) & (y <= b.top))
        if best is None or inside > best[0]:
            best = (inside, x, y)
    return best[1], best[2]


def sample_raster(path, lon, lat, radius, cell_m, band=1):
    """Area-average the raster to ~cell_m pixels and sample bilinearly at lon/lat.
    Returns (values, native_res_m) with NaN where data are missing."""
    with rasterio.open(path) as ds:
        x, y = to_dataset_xy(ds, lon, lat, radius)
        inv = ~ds.transform
        col, row = inv * (x, y)
        native = abs(ds.transform.a)
        f = max(1, int(round(cell_m / native)))
        c0 = max(int(np.floor(col.min())) - 2 * f, 0)
        r0 = max(int(np.floor(row.min())) - 2 * f, 0)
        c1 = min(int(np.ceil(col.max())) + 2 * f, ds.width)
        r1 = min(int(np.ceil(row.max())) + 2 * f, ds.height)
        if c1 <= c0 or r1 <= r0:
            return np.full(lon.shape, np.nan), native
        w, h = c1 - c0, r1 - r0
        ow, oh = max(2, round(w / f)), max(2, round(h / f))
        data = ds.read(band, window=Window(c0, r0, w, h), out_shape=(oh, ow),
                       resampling=Resampling.average if f > 1 else Resampling.nearest,
                       masked=True).astype('float64')
        arr = data.filled(np.nan)
        if ds.nodata is not None:
            arr[arr <= -1e30] = np.nan
        sx, sy = w / ow, h / oh
        # pixel-centre coordinates in the decimated window
        fx = (col - c0) / sx - 0.5
        fy = (row - r0) / sy - 0.5
        return bilinear(arr, fx, fy), native


def bilinear(arr, fx, fy):
    h, w = arr.shape
    x0 = np.clip(np.floor(fx).astype(int), 0, w - 2)
    y0 = np.clip(np.floor(fy).astype(int), 0, h - 2)
    tx, ty = fx - x0, fy - y0
    v = (arr[y0, x0] * (1 - tx) * (1 - ty) + arr[y0, x0 + 1] * tx * (1 - ty)
         + arr[y0 + 1, x0] * (1 - tx) * ty + arr[y0 + 1, x0 + 1] * tx * ty)
    out_of_range = (fx < -0.5) | (fy < -0.5) | (fx > w - 0.5) | (fy > h - 0.5)
    v[out_of_range] = np.nan
    return v


def build_grid(path, lat0, lon0, body, scale=1.0):
    radius = RADIUS[body]
    lon, lat = local_nodes(lat0, lon0, radius, SRC_N, SRC_SPACING)
    vals, native = sample_raster(path, lon, lat, radius, SRC_SPACING)
    vals = vals * scale
    if not np.all(np.isfinite(vals)):
        raise RuntimeError(f'DEM window incomplete: {np.mean(~np.isfinite(vals)):.1%} nodes without data')
    src = [float(v) for v in vals.ravel()]
    grid = [round(v, 2) for v in bilinear_resample(src, SRC_N, N)]
    return grid, native


def build_image(path, lat0, lon0, body, dest, cell_m=None, band=1):
    radius = RADIUS[body]
    step = EXTENT / (IMG_N - 1)
    lon, lat = local_nodes(lat0, lon0, radius, IMG_N, step)
    vals, _ = sample_raster(path, lon, lat, radius, cell_m or step, band=band)
    vals[vals <= 0] = np.nan            # 0 = nodata in HiRISE/CTX/TC orthos
    if np.mean(np.isfinite(vals)) < 0.98:
        raise RuntimeError(f'image window incomplete ({np.mean(np.isfinite(vals)):.1%} valid)')
    write_jpeg(vals, dest)


def write_jpeg(vals, dest):
    lo, hi = np.nanpercentile(vals, [1, 99])
    img = np.clip((np.nan_to_num(vals, nan=lo) - lo) / max(hi - lo, 1e-9) * 255, 0, 255).astype('uint8')
    for q in (88, 82, 75, 68, 60):
        Image.fromarray(img, 'L').save(dest, 'JPEG', quality=q, optimize=True, progressive=True)
        if dest.stat().st_size < 300_000:
            return
    raise RuntimeError('JPEG over 300 KB')


def hillshade(z, spacing, az=315.0, alt=35.0):
    gy, gx = np.gradient(z, spacing)          # rows run north->south
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    a, e = math.radians(az), math.radians(alt)
    return np.sin(e) * np.cos(slope) + np.cos(e) * np.sin(slope) * np.cos(a - aspect)


# ---------------------------------------------------------------- thermal sources
def diviner_prp_south(lat0, lon0):
    """LRO Diviner Polar Resource Product (Paige et al. 2010): annual mean / max surface T
    for the PRP triangles whose centroid falls inside the 2400 m window."""
    R = 1737.4
    x = R * math.cos(math.radians(lat0)) * math.cos(math.radians(lon0))
    y = R * math.cos(math.radians(lat0)) * math.sin(math.radians(lon0))
    # Rows: 1200×1200 cells (x descending from +299.5 km, y ascending from -299.5 km), 2 triangles/cell.
    ix, iy = int(round((300 - x) / 0.5)), int(round((y + 300) / 0.5))
    for _ in range(6):   # grid spacing is not exactly uniform in body-fixed x/y: refine on the file itself
        k = (ix * 1200 + iy) * 2
        p = http(PRP_SOUTH, ((k + 1) * 210, (k + 2) * 210 - 1)).decode().split(',')
        dx, dy = float(p[0]) - x, float(p[1]) - y
        if abs(dx) < 0.6 and abs(dy) < 0.6:
            break
        ix += int(round(dx / 0.5)); iy -= int(round(dy / 0.5))
    aeqd = Transformer.from_crs(CRS.from_proj4(f'+proj=longlat +R={R*1000} +no_defs'),
                                CRS.from_proj4(f'+proj=aeqd +lat_0={lat0} +lon_0={lon0} +R={R*1000} +units=m'), always_xy=True)
    avg, mx = [], []
    for i in range(ix - 6, ix + 7):
        k0, k1 = (i * 1200 + iy - 6) * 2, (i * 1200 + iy + 6) * 2 + 1
        raw = http(PRP_SOUTH, ((k0 + 1) * 210, (k1 + 2) * 210 - 1)).decode()
        for line in raw.splitlines():
            p = line.split(',')
            if len(p) != 15:
                continue
            e, n = aeqd.transform(float(p[9]), float(p[10]))
            if abs(e) <= EXTENT / 2 and abs(n) <= EXTENT / 2 and float(p[13]) > 0:
                avg.append(float(p[12])); mx.append(float(p[13]))
    if not avg:
        return None
    return {'kind': 'diviner', 'minK': None, 'maxK': round(max(mx), 1), 'meanK': round(float(np.mean(avg)), 1),
            'curve': None,
            'source': f'LRO Diviner Polar Resource Product LRO-L-DLRE-5-PRP-V2.0 (Paige et al. 2010, Science 330:479), '
                      f'{len(avg)} celdas del modelo térmico ajustado dentro de la ventana; meanK = media anual, '
                      f'maxK = máximo anual. {PRP_SOUTH}',
            'cells': len(avg), 'meanRangeK': [round(min(avg), 1), round(max(avg), 1)]}


def diviner_gcp(lat0, lon0):
    """Diviner Global Cumulative Product (Williams et al. 2017): Tbol vs local time,
    0.5° bin containing the centre; averaged to hourly lunar-local-time steps."""
    lat_band = int(math.floor(lat0 / 10) * 10)
    name = f"global_cumul_avg_cyl_{abs(lat_band):02d}{'n' if lat_band >= 0 else 's'}" \
           f"{abs(lat_band+10):02d}{'n' if lat_band + 10 > 0 else 's'}_002.tab"
    lon = ((lon0 + 180) % 360) - 180
    ilon, ilat = int((lon + 180) // 0.5), int((lat0 - lat_band) // 0.5)
    k0 = (ilon * 20 + ilat) * 96
    raw = http(GCP_BASE + name, ((k0 + 1) * 113, (k0 + 97) * 113 - 1)).decode()
    rows = [l.split(',') for l in raw.splitlines() if l.count(',') == 10]
    clon, clat = float(rows[0][0]), float(rows[0][1])
    q = {round(float(r[2]), 2): float(r[10]) for r in rows if float(r[10]) > 0}
    curve = []
    for h in range(24):
        vals = [v for t, v in q.items() if h <= t < h + 1]
        if vals:
            curve.append({'hourLocal': h, 'tempK': round(float(np.mean(vals)), 1)})
    allv = list(q.values())
    return {'kind': 'diviner', 'minK': round(min(allv), 1), 'maxK': round(max(allv), 1),
            'meanK': round(float(np.mean([c['tempK'] for c in curve])), 1), 'curve': curve,
            'source': f'LRO Diviner Global Cumulative Product LRO-L-DLRE-5-GCP-V1.0 (Williams et al. 2017, Icarus 283:300), '
                      f'Tbol media 2009-07→2015-04, celda 0.5° centrada en {clat}°N {clon}°E, 96 tramos de 0.25 h '
                      f'promediados a horas locales lunares. {GCP_BASE + name}'}


def mcd_curve(lat, lon, ls):
    params = {'var1': 'tsurf', 'var2': 'none', 'var3': 'none', 'var4': 'none', 'datekeyhtml': 1, 'ls': ls,
              'localtime': 'all', 'year': 2025, 'month': 1, 'day': 1, 'hours': 0, 'minutes': 0, 'seconds': 0,
              'julian': '', 'martianyear': '', 'martianmonth': '', 'sol': '', 'latitude': lat, 'longitude': lon,
              'altitude': 10., 'zkey': 3, 'isfixedlt': 'off', 'dust': 1, 'hrkey': 1, 'averaging': 'off',
              'dpi': 80, 'islog': 'off', 'colorm': 'jet', 'minval': '', 'maxval': '', 'proj': 'cyl', 'palat': '',
              'palon': '', 'trans': '', 'iswind': 'off', 'latpoint': '', 'lonpoint': ''}
    html = http(MCD_CGI + '?' + urllib.parse.urlencode(params), timeout=180).decode('utf-8', 'replace')
    ref = html.split("href='../txt/")[1].split("'")[0]
    txt = http(MCD_CGI.rsplit('/cgi-bin/', 1)[0] + '/txt/' + ref).decode()
    pts = [tuple(map(float, l.split())) for l in txt.splitlines() if l.strip() and not l.startswith('#')]
    return [(int(round(h)), t) for h, t in pts if h < 24]


def mcd_thermal(lat, lon):
    curves = {}
    for ls in (0, 90, 180, 270):
        curves[ls] = mcd_curve(lat, lon, ls)
        time.sleep(1)
    allt = [t for c in curves.values() for _, t in c]
    return {'kind': 'model', 'minK': round(min(allt), 1), 'maxK': round(max(allt), 1),
            'meanK': round(float(np.mean(allt)), 1),
            'curve': [{'hourLocal': h, 'tempK': round(t, 1)} for h, t in curves[0]],
            'source': f'Mars Climate Database v6.2 (LMD/OU/IAA/ESA/CNES), escenario climatológico, temperatura de superficie '
                      f'en {lat}°N {lon}°E; curve = Ls 0° (equinoccio de primavera boreal) por hora solar local marciana; '
                      f'min/max/mean sobre Ls 0/90/180/270 × 24 h. {MCD_CGI}',
            'seasonsLs': {str(k): [round(min(t for _, t in v), 1), round(max(t for _, t in v), 1)] for k, v in curves.items()}}


def minirf_cpr(lat0, lon0):
    """Mean Mini-RF S-band CPR over the window (global 128 ppd mosaic, raw float32 via HTTP range)."""
    lon, lat = local_nodes(lat0, lon0, RADIUS['moon'], N, SPACING)
    lines = np.floor((90 - lat) * 128).astype(int)
    samples = np.floor((((lon + 180) % 360)) * 128).astype(int)
    vals = []
    for line in np.unique(lines):
        s = samples[lines == line]
        a, b = int(s.min()), int(s.max())
        if b - a > 46080 // 2:      # wraps around the dateline: not expected for our targets
            return None
        base = int(line) * 46080 * 4
        raw = np.frombuffer(http(MINIRF_CPR, (base + a * 4, base + b * 4 + 3)), dtype='<f4')
        v = raw[s - a]
        vals.extend(v[(v > 0) & (v < 10)].tolist())
    valid = len(vals) / lines.size
    if valid < 0.8:
        return None, valid
    return {'value': round(float(np.median(vals)), 3), 'unit': 'CPR',
            'method': 'Mini-RF S-band (12.6 cm) circular polarization ratio, mediana de los nodos de la ventana (mosaico global 128 ppd ≈ 237 m/px)',
            'source': MINIRF_CPR}, valid


# ---------------------------------------------------------------- targets
TARGETS = [
    {
        'id': 'shackleton', 'body': 'moon', 'name': 'Cráter Shackleton · borde (Polo Sur lunar, sitio Artemis «Shackleton rim»)',
        'center_proj': (-2950.0, -6050.0),     # polar stereographic metres (Moon2000_spole), refined to rim crest
        'dem': {'url': 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif', 'download': True,
                'dataset': 'LRO LOLA 5 m/pix LDEM, Site04 «Shackleton rim» (Barker et al. 2021, NASA GSFC PGDA)',
                'native': 5.0, 'page': 'https://pgda.gsfc.nasa.gov/products/78'},
        'image': 'hillshade',
        'notes': [
            'Ventana centrada en la cresta del borde de Shackleton dentro del LDEM Site04 de PGDA (región de interés Artemis «Shackleton rim»); incluye la pared interior hacia la región en sombra permanente y el flanco exterior.',
            'Orientación: la rejilla se muestrea en un marco azimutal equidistante local, por lo que fila 0 = norte local verdadero (alejándose del polo) y columna 0 = oeste local, igual que en los otros objetivos; no es la orientación de la cuadrícula estereográfica polar del producto.',
            'Barker et al. (2021): ~90 % de los píxeles de 5 m están interpolados entre huellas LOLA; la resolución efectiva es más gruesa que 5 m, aunque el promedio a 18.75 m y la rejilla de 37.5 m quedan dentro de la escala que las pasadas LOLA resuelven cerca del polo.',
            'La imagen de contexto es un relieve sombreado calculado del propio LDEM (sol a 315°/35°), no una fotografía: el borde de Shackleton está casi siempre en iluminación rasante o sombra.',
            'Diviner PRP no publica la mínima anual por celda; minK = null. En las zonas en sombra permanente del interior del cráter Paige et al. (2010) reportan medias anuales < 110 K, fuera de esta ventana de borde.',
        ],
    },
    {
        'id': 'marius-hills', 'body': 'moon', 'name': 'Marius Hills · entorno del pozo (skylight) de tubo de lava',
        'center': (14.091, -56.777),          # Marius Hills Hole, Haruyama et al. 2009 / LROC (303.223°E)
        'dem': {'stac': ('kaguya_terrain_camera_usgs_dtms_v2', 'TC1W2B0_01_02742N140E3036__TC2W2B0_01_02742N145E3036'),
                'dataset': 'SELENE/Kaguya Terrain Camera DTM v2.0 (USGS Astrogeology, Ames Stereo Pipeline, alineado a LOLA)'},
        'image': {'asset': 'orthoimage_left', 'credit': 'JAXA/SELENE Terrain Camera; ortoimagen USGS Astrogeology',
                  'license': 'Datos SELENE © JAXA, uso libre con atribución (JAXA SELENE Data Archive); producto USGS de dominio público'},
        'notes': [
            'Centro en el pozo de Marius Hills (14.091°N, 303.223°E = -56.777°), descubierto por Haruyama et al. (2009, GRL 36:L21206). El pozo (~65 m de diámetro, ~40 m de profundidad) es menor que la separación de 37.5 m y el DTM Kaguya (~33 m/px; se eligió el único par estéreo TC v2 que cubre la ventana completa sin huecos) no lo resuelve: la rejilla muestra la meseta de mare y los domos/canales del entorno.',
            'Diviner GCP es un promedio de 0.5° (~15 km): la curva térmica describe el mare circundante, no el interior del pozo (Horvath et al. 2022 miden ~290 K estables en sombras de pozos lunares, otro sitio).',
            'Rugosidad: se intenta Mini-RF CPR (mosaico global 128 ppd, ~237 m/px, rocas de escala decimétrica); sólo se publica si ≥ 80 % de los nodos tienen dato. No hay CPR terrestre en el contrato, así que nunca entra en la comparación geométrica.',
        ],
    },
    {
        'id': 'jezero', 'body': 'mars', 'name': 'Cráter Jezero · zona de aterrizaje de Perseverance (Octavia E. Butler)',
        'center': (18.4447, 77.4508),
        'dem': {'stac': ('mro_hirise_socet_dtms', 'DTEEC_045994_1985_046060_1985_U01'),
                'dataset': 'MRO HiRISE DTM DTEEC_045994_1985_046060_1985_U01 (Univ. of Arizona / USGS, 1 m/px)'},
        'image': {'asset': 'ortho_0', 'credit': 'NASA/JPL-Caltech/University of Arizona (HiRISE); COG USGS Astrogeology',
                  'license': 'CC0-1.0 (según el catálogo STAC de USGS); créditos HiRISE NASA/JPL/UArizona'},
        'notes': [
            'Centro en el sitio de aterrizaje Octavia E. Butler (18.4447°N, 77.4508°E); el frente del delta queda ~2 km al oeste, en el borde de la ventana.',
            'HiRISE DTM a 1 m promediado a celdas de 18.75 m antes de la rejilla de 37.5 m: la rugosidad métrica (rocas, megaripples) desaparece del índice geométrico.',
            'Elevación relativa al areoide/esfera de referencia de Marte del producto PDS (valores negativos ~-2.5 km son normales en Jezero).',
            'Térmica: Mars Climate Database (modelo, celda de varios km), no medición MEDA/Perseverance; queda como propuesta integrar series MEDA del PDS Atmospheres Node.',
            'Rugosidad: sin dato de radar equivalente; metrics.roughness = null.',
        ],
    },
    {
        'id': 'valles-marineris', 'body': 'mars', 'name': 'Valles Marineris · pared norte de Coprates Chasma',
        'center': (-12.84, -60.58),             # from choose_valles_center(); ARES_RESCAN_VALLES=1 re-runs the scan
        'dem': {'stac': ('mro_ctx_controlled_usgs_dtms', 'D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W'),
                'dataset': 'MRO CTX DTM D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W (USGS Astrogeology, ASP, 20 m/px, controlado a MOLA)'},
        'image': {'asset': 'orthoimage', 'credit': 'NASA/JPL-Caltech/MSSS (CTX); ortoimagen USGS Astrogeology',
                  'license': 'CC0-1.0 (según el catálogo STAC de USGS); créditos CTX NASA/JPL/MSSS'},
        'notes': [
            'Ventana sobre la pared norte de Coprates Chasma (Valles Marineris) en la franja del DTM CTX; el centro (-12.84°, -60.58° = 299.42°E) se eligió con choose_valles_center(): entre ventanas completas con desnivel < 1500 m a lo largo de la pared, la de mayor pendiente p50. Es talud de pared con espolones y cárcavas (no el fondo plano), el caso extremo de navegación en pendiente.',
            'Elevación relativa al areoide MOLA (GEOID=mola en el producto).',
            'Térmica: Mars Climate Database (modelo); THEMIS no se usó porque los mosaicos THEMIS IR de USGS son de brillo/inercia térmica y no curvas de temperatura absolutas por hora.',
            'Rugosidad: sin dato de radar equivalente; metrics.roughness = null.',
        ],
    },
]


def stac_dem(target):
    coll, item_id = target['dem']['stac']
    item = stac_item(coll, item_id)
    target['_item'] = item
    target['dem']['url'] = item['assets']['dtm']['href']
    target['dem']['page'] = f'{STAC}/collections/{coll}/items/{item_id}'
    target['dem']['license'] = item['properties'].get('license')
    return '/vsicurl/' + target['dem']['url']


def choose_shackleton_center(path):
    """Refine the hand-picked rim point to the local crest (max of 300 m-smoothed DEM within 600 m)."""
    with rasterio.open(path) as ds:
        z = ds.read(1)
        inv = ~ds.transform
        c, r = (int(v) for v in inv * target_by_id('shackleton')['center_proj'])
        k = 60
        sub = z[r - 2 * k:r + 2 * k, c - 2 * k:c + 2 * k].astype('float64')
        # 300 m box smooth via cumulative sums
        s = 30
        cs = np.cumsum(np.cumsum(np.pad(sub, ((1, 0), (1, 0))), 0), 1)
        sm = (cs[s:, s:] - cs[:-s, s:] - cs[s:, :-s] + cs[:-s, :-s]) / s ** 2
        off = s // 2
        rr, cc = np.unravel_index(np.nanargmax(sm), sm.shape)
        x, y = ds.transform * (c - 2 * k + cc + off + 0.5, r - 2 * k + rr + off + 0.5)
        geo = CRS.from_wkt(ds.crs.to_wkt()).geodetic_crs
        lon, lat = Transformer.from_crs(CRS.from_wkt(ds.crs.to_wkt()), geo, always_xy=True).transform(x, y)
        return round(float(lat), 5), round(float(lon), 4)


def choose_valles_center(path):
    """Scan the north-wall toe of Coprates along the strip and keep the complete window with
    the highest p50 slope whose window still contains canyon floor (relief < 1500 m)."""
    best = None
    for lat in np.arange(-12.62, -13.06, -0.02):
        for lon in (-60.66, -60.62, -60.58):
            try:
                grid, _ = build_grid(path, float(lat), lon, 'mars')
            except RuntimeError:
                continue
            m = compute_metrics(grid, N, SPACING, 20)
            if m['reliefP95P5M'] < 1500 and (best is None or m['slopeP50Deg'] > best[0]):
                best = (m['slopeP50Deg'], round(float(lat), 3), lon)
    if not best:
        raise RuntimeError('no complete Coprates window found')
    print('  valles centre', best, flush=True)
    return best[1], best[2]


def target_by_id(ident):
    return next(t for t in TARGETS if t['id'] == ident)


def build(target):
    body, ident = target['body'], target['id']
    print('==', ident, flush=True)
    if target['dem'].get('download'):
        path = cached_download(target['dem']['url'])
    else:
        path = stac_dem(target)
    if ident == 'shackleton':
        target['center'] = choose_shackleton_center(path)
    elif ident == 'valles-marineris' and os.environ.get('ARES_RESCAN_VALLES'):
        target['center'] = choose_valles_center(path)
    lat0, lon0 = target['center']
    grid, native_ds = build_grid(path, lat0, lon0, body)
    native = target['dem'].get('native') or round(native_ds, 2)

    roughness, notes = None, list(target['notes'])
    if body == 'moon':
        try:
            res = minirf_cpr(lat0, lon0)
            if isinstance(res, tuple):
                roughness, valid = res
                if roughness is None:
                    notes.append(f'Mini-RF CPR: sólo {valid:.0%} de nodos con dato válido en el mosaico global; roughness = null.')
                else:
                    notes.append(f'Mini-RF CPR = {roughness["value"]} (mediana, {valid:.0%} de nodos válidos). Píxel de ~237 m: '
                                 'valor regional, no por nodo; en latitudes polares el mosaico cilíndrico estira mucho en longitud. '
                                 'CPR alto (≳1) suele asociarse a superficies rocosas a escala de la longitud de onda (Cahill et al. 2014, Icarus).')
        except Exception as e:
            notes.append(f'Mini-RF CPR no disponible ({e.__class__.__name__}); roughness = null.')
    metrics = compute_metrics(grid, N, SPACING, native, roughness)
    if not metrics['comparable']:
        notes.append(f'Resolución nativa {native} m > 2×37.5 m: rejilla interpolada, metrics.comparable = false.')

    thermal = None
    try:
        if ident == 'shackleton':
            thermal = diviner_prp_south(lat0, lon0)
        elif body == 'moon':
            thermal = diviner_gcp(lat0, lon0)
        else:
            thermal = mcd_thermal(lat0, lon0 % 360)
    except Exception as e:
        notes.append(f'Fuente térmica no disponible en la descarga ({e.__class__.__name__}: {e}); thermal = null.')

    imagery = None
    dest = OUT / f'{ident}.jpg'
    try:
        if target['image'] == 'hillshade':
            lon, lat = local_nodes(lat0, lon0, RADIUS[body], IMG_N, EXTENT / (IMG_N - 1))
            z, _ = sample_raster(path, lon, lat, RADIUS[body], 5.0)
            write_jpeg(hillshade(z, EXTENT / (IMG_N - 1)), dest)
            imagery = {'path': f'assets/data/scenarios/targets/{ident}.jpg',
                       'credit': 'Relieve sombreado calculado del LDEM LOLA 5 m (NASA GSFC PGDA, Barker et al. 2021); no es fotografía',
                       'license': 'Dominio público (datos NASA)', 'source': target['dem']['page'], 'kind': 'hillshade'}
        else:
            href = target['_item']['assets'][target['image']['asset']]['href']
            build_image('/vsicurl/' + href, lat0, lon0, body, dest)
            imagery = {'path': f'assets/data/scenarios/targets/{ident}.jpg', 'credit': target['image']['credit'],
                       'license': target['image']['license'], 'source': href, 'kind': 'orthoimage'}
    except Exception as e:
        notes.append(f'Imagen de contexto no disponible ({e}); imagery = null.')
        if dest.exists():
            dest.unlink()

    provenance = [{'label': target['dem']['dataset'], 'url': target['dem']['url']},
                  {'label': 'Catálogo / página del producto', 'url': target['dem']['page']}]
    if roughness:
        provenance.append({'label': 'LRO Mini-RF Global Mosaic CPR 128 ppd (PDS Geosciences)', 'url': MINIRF_CPR})
    if thermal:
        provenance.append({'label': 'Térmica: ' + thermal['source'].split(' (')[0], 'url': thermal['source'].rsplit(' ', 1)[-1]})
    if imagery and imagery['source'] != target['dem']['page']:
        provenance.append({'label': 'Imagen de contexto', 'url': imagery['source']})

    record = {
        'id': ident, 'body': body, 'name': target['name'], 'center': [lat0, lon0],
        'gridSize': N, 'spacingMeters': SPACING, 'extentMeters': EXTENT,
        'elevation': grid, 'imagery': imagery, 'dataset': target['dem']['dataset'],
        'nativeResolutionMeters': native, 'source': target['dem']['url'], 'fetchedAt': NOW,
        'metrics': metrics, 'thermal': thermal, 'environment': ENV[body],
        'provenance': provenance, 'notes': notes,
        'sampling': {'frame': 'azimutal equidistante local (fila 0 = norte, columna 0 = oeste)',
                     'preGrid': f'{SRC_N}×{SRC_N} a {SRC_SPACING} m, promedio de área + bilineal',
                     'resample': 'terrain_metrics.bilinear_resample 129→65',
                     'radiusMeters': RADIUS[body], 'elevationDatum': 'altura relativa al radio/areoide de referencia del producto (m)'},
    }
    (OUT / f'{ident}.json').write_text(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('  saved', ident, record['center'], metrics, 'thermal', bool(thermal), 'image', bool(imagery), flush=True)


def main(ids):
    OUT.mkdir(parents=True, exist_ok=True)
    failed = []
    for t in TARGETS:
        if ids and t['id'] not in ids:
            continue
        try:
            build(t)
        except Exception as e:
            failed.append(t['id'])
            print('  FAILED', t['id'], e.__class__.__name__, e, '(no elevation is synthesised)', flush=True)
    print('done; failed:', failed or 'none')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
