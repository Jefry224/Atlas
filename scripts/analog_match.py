#!/usr/bin/env python3
"""A.R.E.S. Twin · búsqueda de ventanas análogas con la ventana estándar (2400 m, 65×65, 37.5 m).

Dada una ventana de referencia (sus `metrics`), recorre una región más grande de otro DEM con la
misma rejilla y devuelve las ventanas de 2400 m ordenadas por el índice de similitud geométrica.
Es la correspondencia que usan los escenarios y la base de la futura selección manual de área:

  * earth  → busca en Copernicus GLO-30 alrededor de (lat, lon) la ventana terrestre que mejor
             replica un objetivo lunar/marciano.
  * target → busca dentro del DTM de un objetivo (fetch-targets.py) la ventana que mejor replica
             una ventana terrestre (p. ej. un área elegida a mano por el usuario).

Las métricas de cada ventana son exactamente las de terrain_metrics.compute_metrics (pendiente por
diferencias centrales en los nodos interiores, percentiles lineales, TRI de Riley, desnivel p95–p5)
y el índice replica similarity.mjs (tests/analog-match.test.mjs comprueba la paridad). La región se
remuestrea una sola vez a 37.5 m en un marco azimutal equidistante centrado en la región; la ventana
elegida se vuelve a generar con fetch-scenarios-earth.py / fetch-targets.py centrada en su propio
punto, que es la que se publica.

Uso (venv de datos, ver fetch-scenarios-earth.py):
  .venv-data/bin/python scripts/analog_match.py earth  --lat 29.17 --lon -13.45 --radius 6000 \\
        --ref assets/data/scenarios/targets/marius-hills.json
  .venv-data/bin/python scripts/analog_match.py target --id jezero --radius 1500 \\
        --ref assets/data/scenarios/earth/atacama.json [--keep-anchor]
"""
import argparse, importlib.util, json, math, pathlib, sys

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

ROOT = pathlib.Path(__file__).resolve().parents[1]
N, SPACING = 65, 37.5
HALF = (N - 1) * SPACING / 2

sys.path.insert(0, str(ROOT / 'scripts'))
from terrain_metrics import SIMILARITY_COMPONENTS as COMPONENTS, geometric_index  # noqa: E402,F401

METRIC_KEYS = tuple(k for k, _, _ in COMPONENTS)


def _round2(a):
    return np.round(a, 2)


def window_metrics(z, spacing=SPACING, n=N, stride=4):
    """Métricas de todas las ventanas n×n de la rejilla z (fila 0 = norte) con paso `stride` nodos.
    Devuelve (rows, cols, metrics) con metrics[k] de forma (len(rows), len(cols)); NaN si la ventana
    tiene nodos sin dato."""
    z = np.asarray(z, dtype='float64')
    h, w = z.shape
    dzdx = (z[1:-1, 2:] - z[1:-1, :-2]) / (2 * spacing)
    dzdy = (z[2:, 1:-1] - z[:-2, 1:-1]) / (2 * spacing)
    slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))          # nodos interiores de z
    c = z[1:-1, 1:-1]
    tri = sum(np.abs(z[1 + dr:h - 1 + dr, 1 + dc:w - 1 + dc] - c)
              for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc) / 8
    rows = np.arange(0, h - n + 1, stride)
    cols = np.arange(0, w - n + 1, stride)
    out = {k: np.full((len(rows), len(cols)), np.nan) for k in METRIC_KEYS}
    zw = sliding_window_view(z, (n, n))
    sw = sliding_window_view(slope, (n - 2, n - 2))
    tw = sliding_window_view(tri, (n - 2, n - 2))
    for i, r in enumerate(rows):
        ze = zw[r, cols].reshape(len(cols), -1)
        se = sw[r, cols].reshape(len(cols), -1)
        te = tw[r, cols].reshape(len(cols), -1)
        ok = np.isfinite(ze).all(axis=1)
        if not ok.any():
            continue
        ze, se, te = ze[ok], se[ok], te[ok]
        p50, p90 = np.percentile(se, [50, 90], axis=1)
        p5, p95 = np.percentile(ze, [5, 95], axis=1)
        out['slopeP50Deg'][i, ok] = _round2(p50)
        out['slopeP90Deg'][i, ok] = _round2(p90)
        out['reliefP95P5M'][i, ok] = _round2(p95 - p5)
        out['triMeanM'][i, ok] = _round2(te.mean(axis=1))
    return rows, cols, out


def index_field(metrics, ref):
    """Índice geométrico vectorizado (misma fórmula y redondeos que geometric_index)."""
    total = sum(w for _, w, _ in COMPONENTS)
    acc = 0.0
    for key, w, floor in COMPONENTS:
        x = np.maximum(np.abs(metrics[key]), floor)
        y = max(abs(ref[key]), floor)
        score = 100.0 * np.exp(-np.abs(np.log(x / y)))
        acc = acc + (w / total) * np.floor(score * 10 + 0.5) / 10
    return np.floor(acc + 0.5)


def rank(z, ref, spacing=SPACING, stride=4, allow=None, top=10, min_sep_m=600.0):
    """Ventanas ordenadas por índice (desempate: menor distancia al centro de la región).
    `allow(east_m, north_m)` filtra centros de ventana; las ventanas devueltas distan ≥ min_sep_m entre sí."""
    h, w = np.asarray(z).shape
    rows, cols, m = window_metrics(z, spacing, N, stride)
    idx = index_field(m, ref)
    half_h, half_w = (h - 1) * spacing / 2, (w - 1) * spacing / 2
    cands = []
    for i, r in enumerate(rows):
        for j, c in enumerate(cols):
            if not np.isfinite(idx[i, j]):
                continue
            east = -half_w + (c + N // 2) * spacing
            north = half_h - (r + N // 2) * spacing
            if allow and not allow(east, north):
                continue
            cands.append((-idx[i, j], math.hypot(east, north), east, north, {k: float(m[k][i, j]) for k in METRIC_KEYS}))
    cands.sort(key=lambda t: (t[0], t[1]))
    picked = []
    for neg, dist, east, north, met in cands:
        if all(math.hypot(east - p['east'], north - p['north']) >= min_sep_m for p in picked):
            picked.append({'index': int(-neg), 'east': east, 'north': north, 'distance': dist, 'metrics': met})
            if len(picked) >= top:
                break
    return picked


# ---------------------------------------------------------------- región de DEM
def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def earth_region(lat, lon, radius_m, land_only=True):
    """Copernicus GLO-30 remuestreado (bilineal) a 37.5 m en el marco AEQD centrado en (lat, lon)."""
    fe = _load('fetch_scenarios_earth', 'fetch-scenarios-earth.py')
    from rasterio.enums import Resampling
    from pyproj import Transformer
    n = 2 * int(math.ceil((radius_m + HALF) / SPACING)) + 1
    half = (n - 1) * SPACING / 2
    tr = Transformer.from_crs(fe.site_crs(lat, lon), 'EPSG:4326', always_xy=True)
    pts = [tr.transform(x, y) for x in (-half, 0, half) for y in (-half, 0, half)]
    bbox = [min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)]
    items = list(fe.catalog().search(collections=['cop-dem-glo-30'], bbox=bbox).items())
    if not items:
        raise RuntimeError('cop-dem-glo-30: ninguna tesela cubre la región')
    z = np.full((n, n), np.nan, dtype='float64')
    for it in items:
        part, _ = fe.warp(fe.sign(it.assets['data'].href), lat, lon, n, SPACING, Resampling.bilinear, 1)
        z = np.where(np.isfinite(z), z, part)
    if land_only:
        z[z <= 0] = np.nan       # GLO-30 rellena el mar con 0 m: una ventana con mar no es análoga
    to_geo = lambda e, nn: tuple(reversed(tr.transform(e, nn)))
    return z, to_geo


def target_region(ident, radius_m, center=None):
    """DTM del objetivo (misma fuente que fetch-targets.py) promediado a 37.5 m alrededor de su centro."""
    ft = _load('fetch_targets', 'fetch-targets.py')
    from pyproj import CRS, Transformer
    t = ft.target_by_id(ident)
    path = ft.cached_download(t['dem']['url']) if t['dem'].get('download') else ft.stac_dem(t)
    if center is None:
        center = ft.choose_shackleton_center(path) if ident == 'shackleton' else t['center']
    lat0, lon0 = center
    radius = ft.RADIUS[t['body']]
    n = 2 * int(math.ceil((radius_m + HALF) / SPACING)) + 1
    lon, lat = ft.local_nodes(lat0, lon0, radius, n, SPACING)
    z, _ = ft.sample_raster(path, lon, lat, radius, SPACING)
    aeqd = CRS.from_proj4(f'+proj=aeqd +lat_0={lat0} +lon_0={lon0} +R={radius} +units=m +no_defs')
    geo = CRS.from_proj4(f'+proj=longlat +R={radius} +no_defs')
    tr = Transformer.from_crs(aeqd, geo, always_xy=True)
    to_geo = lambda e, nn: tuple(reversed(tr.transform(e, nn)))
    return np.asarray(z, dtype='float64'), to_geo


def _ref_metrics(path):
    d = json.loads(pathlib.Path(path).read_text())
    m = d.get('metrics') or {}
    missing = [k for k in METRIC_KEYS if not isinstance(m.get(k), (int, float))]
    if missing:
        raise SystemExit(f'{path}: faltan métricas {missing}')
    return d, m


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('mode', choices=['earth', 'target'])
    ap.add_argument('--ref', required=True, help='rejilla §2 de referencia (usa sus metrics)')
    ap.add_argument('--lat', type=float)
    ap.add_argument('--lon', type=float)
    ap.add_argument('--id', help='id del objetivo (modo target)')
    ap.add_argument('--radius', type=float, default=4000, help='desplazamiento máximo del centro de la ventana (m)')
    ap.add_argument('--keep-anchor', action='store_true', help='el centro de la región debe quedar dentro de la ventana')
    ap.add_argument('--stride', type=int, default=4)
    ap.add_argument('--top', type=int, default=10)
    args = ap.parse_args(argv)
    ref_doc, ref = _ref_metrics(args.ref)
    if args.mode == 'earth':
        if args.lat is None or args.lon is None:
            ap.error('earth necesita --lat y --lon')
        z, to_geo = earth_region(args.lat, args.lon, args.radius)
    else:
        if not args.id:
            ap.error('target necesita --id')
        z, to_geo = target_region(args.id, args.radius, (args.lat, args.lon) if args.lat is not None else None)
    lim = HALF - SPACING if args.keep_anchor else args.radius

    def allow(e, n):
        return (max(abs(e), abs(n)) <= lim) if args.keep_anchor else math.hypot(e, n) <= args.radius
    print(f'referencia {ref_doc.get("id")}: ' + ' '.join(f'{k}={ref[k]}' for k in METRIC_KEYS))
    print(f'región {z.shape[0]}×{z.shape[1]} nodos a {SPACING} m, {np.isfinite(z).mean():.0%} con dato')
    for p in rank(z, ref, SPACING, args.stride, allow, args.top):
        lat, lon = to_geo(p['east'], p['north'])
        met = ' '.join(f'{k}={p["metrics"][k]:g}' for k in METRIC_KEYS)
        print(f'  índice {p["index"]:3d}  centro {lat:.5f}, {lon:.5f}  (E {p["east"]:+.0f} m, N {p["north"]:+.0f} m)  {met}')


if __name__ == '__main__':
    main()
