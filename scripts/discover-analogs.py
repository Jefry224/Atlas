#!/usr/bin/env python3
"""Discover geometric Earth terrain analogues from Planetary Computer DEM windows.

Two-tier search (docs/module-1-discovery-spec.md, iteration 2):
  * `--region <id>` scans one hand-defined region; `--region auto` reads the regions that
    scripts/prefilter-regions.py chose for the target (assets/data/discovery/regions-<target>.json).
  * Geometric ranking at the base scale picks a pool; the pool is re-scored multi-scale
    (`--scales`) and enriched with ERA5 climatology (diurnal thermal amplitude + aridity), then
    the final Top-N is chosen with spatial non-max suppression so they are distinct places.
The displayed index is always recomputed in the browser by similarity.mjs; `selectionIndex` here
is only for ordering. Nothing is synthesised: a cell whose DEM window is incomplete is skipped.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
import pathlib
import sys
import tempfile
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from terrain_metrics import compute_metrics

N = 65
DEM_COLLECTION = 'alos-dem'
DATASET = 'ALOS World 3D-30m (AW3D30) · JAXA/EORC and METI, via Planetary Computer alos-dem'
EXTENT = 2400                      # base window; (N-1)*37.5
GEOMETRY_CAVEAT = ('Geometric similarity index, not planetary: terrain shape alone does not reproduce '
                   'gravity, regolith, lighting, or chemistry.')
SELECTION_CAVEAT = 'Geometric selection score; the displayed index is recalculated by similarity.mjs.'
THERMAL_CAVEAT = ('Thermal amplitude: Earth diurnal air temperature (2 m, ERA5) is compared with target '
                  'surface temperature (Diviner/MCD). Higher-amplitude sites score better; measurements '
                  'differ in gravity, atmosphere, and surface-versus-air context, so this is not a claim of physical equivalence.')
ARIDITY_CAVEAT = ('Aridity is Earth-side context from annual ERA5 precipitation; it is not scored against the '
                  'target because Moon and Mars do not have comparable aridity.')
VERTICAL_DATUM_CAVEAT = ('AW3D30 uses the EGM96 geoid while Copernicus uses EGM2008; the difference is '
                         'effectively constant and sub-meter across a 2.4 km window, so it is negligible for relative terrain metrics.')
REGIONS = {
    'centroamerica-volcanic': {'name': 'Central American Volcanic Arc · El Salvador', 'bbox': [-89.45, 13.55, -89.05, 13.95],
        'provenance': [{'label': 'Exploratory search region defined for A.R.E.S. Twin', 'url': 'https://www.volcanodiscovery.com/el-salvador.html'}],
        'notes': ['This is an exploratory search window, not an official geological boundary.']},
    'altiplano-andino': {'name': 'Andean Altiplano · Bolivia', 'bbox': [-68.05, -18.05, -67.65, -17.65],
        'provenance': [{'label': 'Exploratory search region defined for A.R.E.S. Twin', 'url': 'https://www.britannica.com/place/Altiplano'}], 'notes': []},
    'asia-central-basin': {'name': 'Central Asian Basin · Kazakhstan', 'bbox': [65.55, 44.85, 65.95, 45.25],
        'provenance': [{'label': 'Exploratory search region defined for A.R.E.S. Twin', 'url': 'https://www.britannica.com/place/Turan-Plain'}], 'notes': []},
}
TARGETS = ('marius-hills', 'shackleton', 'jezero', 'valles-marineris')
CACHE = pathlib.Path(os.environ.get('XDG_CACHE_HOME', pathlib.Path.home() / '.cache')) / 'ares-twin-discovery'
ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(value, f, ensure_ascii=False, separators=(',', ':'))
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def _round1(x):
    return math.floor(x * 10 + .5) / 10


def amplitude_k(thermal):
    """Diurnal amplitude (K) from a thermal block (§2/§5), or None."""
    if not isinstance(thermal, dict):
        return None
    if isinstance(thermal.get('amplitudeK'), (int, float)):
        return abs(thermal['amplitudeK'])
    lo, hi = thermal.get('minK'), thermal.get('maxK')
    if isinstance(lo, (int, float)) and isinstance(hi, (int, float)):
        return abs(hi - lo)
    return None


def geo_index(metrics, target, earth_thermal=None, target_thermal=None):
    """Python mirror of similarity.mjs compareTerrain (geometry + optional thermal amplitude).
    Only for ordering: the user-facing index is recomputed by similarity.mjs."""
    components = [('slopeP50Deg', .30, .1), ('slopeP90Deg', .25, .1), ('reliefP95P5M', .20, 1), ('triMeanM', .15, .05)]
    available = []
    for k, w, floor in components:
        a, b = metrics.get(k), target.get(k)
        if a is None or b is None:
            continue
        x, y = max(abs(a), floor), max(abs(b), floor)
        available.append((w, _round1(100 * min(x, y) / max(x, y))))
    ae, at = amplitude_k(earth_thermal), amplitude_k(target_thermal)
    if ae is not None and at is not None:
        x, y = max(ae, 1), max(at, 1)
        available.append((.15, _round1(100 * min(x, y) / max(x, y))))
    if not available:
        return None
    return math.floor(sum(w * s for w, s in available) / sum(w for w, _ in available) + .5)


def cell_centers(region, extent=EXTENT):
    from pyproj import CRS, Transformer
    west, south, east, north = region['bbox']
    lat0, lon0 = (south + north) / 2, (west + east) / 2
    crs = CRS.from_proj4(f'+proj=aeqd +lat_0={lat0} +lon_0={lon0} +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs')
    forward = Transformer.from_crs('EPSG:4326', crs, always_xy=True)
    inverse = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
    corners = [forward.transform(lon, lat) for lon in (west, east) for lat in (south, north)]
    minx, maxx = min(p[0] for p in corners), max(p[0] for p in corners)
    miny, maxy = min(p[1] for p in corners), max(p[1] for p in corners)
    cells = []
    x = minx + extent / 2
    while x <= maxx - extent / 2 + 1e-6:
        y = miny + extent / 2
        while y <= maxy - extent / 2 + 1e-6:
            lon, lat = inverse.transform(x, y)
            cells.append((round(lat, 7), round(lon, 7)))
            y += extent
        x += extent
    return cells


def haversine_m(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dphi, dlmb = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(h)))


def select_nms(ranked, top, min_dist_m):
    """Greedy pick by descending score, skipping any within min_dist_m of an already chosen cell."""
    chosen = []
    for c in ranked:
        if all(haversine_m(c['center'], k['center']) >= min_dist_m for k in chosen):
            chosen.append(c)
            if len(chosen) >= top:
                break
    return chosen


def cache_key(lat, lon, extent):
    return hashlib.sha256(f'v3|{lat:.7f}|{lon:.7f}|{N}|{extent}|{DEM_COLLECTION}'.encode()).hexdigest()


def covering_tiles(records, bbox):
    return [it for it in records if it['bbox'][0] <= bbox[2] and it['bbox'][2] >= bbox[0]
            and it['bbox'][1] <= bbox[3] and it['bbox'][3] >= bbox[1]]


def cell_at_scale(earth, records, lat, lon, extent, force):
    """DEM metrics (+elevation) for one cell at one window scale, cached. Raises on incomplete DEM."""
    cp = CACHE / f'{cache_key(lat, lon, extent)}.json'
    if cp.exists() and not force:
        try:
            entry = json.loads(cp.read_text())
            if isinstance(entry, dict) and len(entry.get('elevation', [])) == N * N and all(
                    entry.get('metrics', {}).get(k) is not None for k in ('slopeP50Deg', 'slopeP90Deg', 'reliefP95P5M', 'triMeanM')):
                return entry
        except (OSError, ValueError, TypeError):
            pass
    bbox = earth.window_lonlat_bbox(lat, lon, pad_m=(extent - EXTENT) / 2 + 100)
    covers = covering_tiles(records, bbox)
    elev = earth.dem_window(lat, lon, covers, extent=extent)
    spacing = extent / (N - 1)
    metrics = compute_metrics(elev, N, spacing, native_resolution_m=30, roughness=None)
    tiles = ', '.join(it['id'] for it in covers)
    entry = {'center': [lat, lon], 'extentMeters': extent, 'spacingMeters': round(spacing, 4),
             'metrics': metrics, 'elevation': elev, 'tiles': tiles}
    atomic_json(cp, entry)
    return entry


def era5_climate(lat, lon, force=False):
    """Diurnal thermal amplitude (K) and annual precipitation (mm) from Open-Meteo ERA5 archive."""
    cp = CACHE / f'era5-{lat:.4f}-{lon:.4f}.json'
    if cp.exists() and not force:
        try:
            return json.loads(cp.read_text())
        except (OSError, ValueError):
            pass
    end = dt.date(dt.date.today().year - 1, 12, 31)
    start = dt.date(end.year - 1, 1, 1)
    query = urllib.parse.urlencode({'latitude': f'{lat:.4f}', 'longitude': f'{lon:.4f}',
        'start_date': start.isoformat(), 'end_date': end.isoformat(),
        'daily': 'temperature_2m_max,temperature_2m_min,precipitation_sum', 'timezone': 'UTC'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f'{ARCHIVE_URL}?{query}', timeout=30) as r:
                daily = json.loads(r.read())['daily']
            break
        except Exception:
            if attempt == 2:
                raise
    tmax = [t for t in daily['temperature_2m_max'] if t is not None]
    tmin = [t for t in daily['temperature_2m_min'] if t is not None]
    precip = [p for p in daily['precipitation_sum'] if p is not None]
    if not tmax or not tmin:
        raise RuntimeError('ERA5 sin temperatura para esta celda')
    amp = sum(hi - lo for hi, lo in zip(tmax, tmin)) / min(len(tmax), len(tmin))
    years = max(1, (end - start).days / 365.25)
    result = {'amplitudeK': round(amp, 2), 'minK': round(min(tmin) + 273.15, 1), 'maxK': round(max(tmax) + 273.15, 1),
              'annualPrecipMm': round(sum(precip) / years, 1), 'start': start.isoformat(), 'end': end.isoformat()}
    atomic_json(cp, result)
    return result


def aridity_class(precip_mm):
    return 'Arid' if precip_mm < 250 else 'Semi-arid' if precip_mm < 500 else 'Humid'


def region_name_en(name):
    """Translate names emitted by the global prefilter into display-ready English."""
    names = {
        'andes-altiplano': 'Andean Altiplano', 'sw-north-america': 'Southwestern North America',
        'arabia-levant': 'Arabian Peninsula and Levant', 'east-africa-rift': 'East African Rift',
        'patagonia': 'Patagonia', 'central-asia': 'Central Asia', 'australia-outback': 'Australian Outback',
    }
    import re
    match = re.match(r'Prefiltro\s+(.+?)\s+·\s+(.+)$', name)
    if match:
        slug = match.group(1).lower()
        return f'{names.get(slug, slug.replace("-", " ").title())} · {match.group(2)}'
    return name


def resolve_regions(args):
    if args.region == 'auto':
        path = ROOT / 'assets/data/discovery' / f'regions-{args.target}.json'
        if not path.exists():
            raise SystemExit(f'No prefilter found. Run scripts/prefilter-regions.py {args.target} first.')
        data = json.loads(path.read_text())
        return [(r['id'], r) for r in data['regions']]
    return [(args.region, REGIONS[args.region])]


def scan_region(earth, region, target_metrics, scales, args):
    """Base-scale geometric scan of a region. Returns (candidates, scanned, failed)."""
    cells = cell_centers(region, scales[0])
    if args.limit and len(cells) > args.limit:
        cells = cells[::max(1, len(cells) // args.limit)][:args.limit]   # muestreo repartido, no una columna
    bbox = region['bbox']
    stac_cache = CACHE / f"{region.get('id', 'region')}-{bbox}-{DEM_COLLECTION}-v3.json".replace(' ', '')
    if stac_cache.exists() and not args.force:
        records = json.loads(stac_cache.read_text())
    else:
        items = list(earth.catalog().search(collections=[DEM_COLLECTION], bbox=bbox).items())
        records = [{**earth.item_record(i), 'bbox': i.bbox} for i in items]
        atomic_json(stac_cache, records)
    candidates, scanned, failed = [], 0, 0
    for lat, lon in cells:
        scanned += 1
        try:
            entry = cell_at_scale(earth, records, lat, lon, scales[0], args.force)
        except Exception as exc:
            failed += 1
            print(f'  skip {lat:.5f},{lon:.5f}: {exc}', flush=True)
            continue
        score = geo_index(entry['metrics'], target_metrics)
        if score is not None:
            candidates.append({'center': [lat, lon], 'base': entry, 'baseScore': score, 'records': records,
                               'region': {'id': region.get('id'), 'name': region.get('name'), 'provenance': region.get('provenance', [])}})
        if scanned % 10 == 0:
            print(f'  scanned {scanned}/{len(cells)} · valid {len(candidates)}', flush=True)
    return candidates, scanned, failed


def run(args):
    import importlib.util
    spec = importlib.util.spec_from_file_location('earth_fetch', ROOT / 'scripts/fetch-scenarios-earth.py')
    earth = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(earth)
    if args.target not in TARGETS:
        raise SystemExit(f'Objetivo desconocido: {args.target}. Opciones: {", ".join(TARGETS)}')
    target_json = json.loads((ROOT / 'assets/data/scenarios/targets' / f'{args.target}.json').read_text())
    target_metrics = target_json.get('metrics', {})
    target_thermal = target_json.get('thermal')
    scales = args.scales

    all_cands, scanned, failed, regions_used = [], 0, 0, []
    for region_id, region in resolve_regions(args):
        region = {**region, 'id': region_id}
        region['name'] = region_name_en(region.get('name', region_id))
        regions_used.append({'id': region_id, 'name': region.get('name')})
        print(f'Region {region_id} · base scale {scales[0]} m', flush=True)
        cands, s, f = scan_region(earth, region, target_metrics, scales, args)
        all_cands += cands
        scanned += s
        failed += f
    all_cands.sort(key=lambda c: -c['baseScore'])

    # Enrich a bounded pool: multi-scale re-score + ERA5 climatology, then full index with thermal.
    pool = all_cands[:max(args.top * 4, 20)]
    print(f'Enriching {len(pool)} candidates (multi-scale {scales} + ERA5)…', flush=True)
    for c in pool:
        lat, lon = c['center']
        best = {'entry': c['base'], 'scaleMeters': scales[0], 'score': c['baseScore']}
        for extent in scales[1:]:
            try:
                entry = cell_at_scale(earth, c['records'], lat, lon, extent, args.force)
            except Exception as exc:
                print(f'  scale {extent} m failed at {lat:.5f},{lon:.5f}: {exc}', flush=True)
                continue
            score = geo_index(entry['metrics'], target_metrics)
            if score is not None and score > best['score']:
                best = {'entry': entry, 'scaleMeters': extent, 'score': score}
        c.update(best=best)
        try:
            clim = era5_climate(lat, lon, args.force)
            c['thermal'] = {'amplitudeK': clim['amplitudeK'], 'minK': clim['minK'], 'maxK': clim['maxK'],
                            'kind': 'era5-climatology',
                            'source': f'Open-Meteo ERA5 (archive) {clim["start"]}…{clim["end"]}'}
            c['aridity'] = {'annualPrecipMm': clim['annualPrecipMm'], 'class': aridity_class(clim['annualPrecipMm']),
                            'source': f'Open-Meteo ERA5 (archive) {clim["start"]}…{clim["end"]}'}
        except Exception as exc:
            print(f'  ERA5 failed at {lat:.5f},{lon:.5f}: {exc}', flush=True)
            c['thermal'], c['aridity'] = None, None
        c['fullScore'] = geo_index(best['entry']['metrics'], target_metrics, c.get('thermal'), target_thermal)

    # Humid cells are de-prioritised (not hidden), then descending index, then spatial NMS.
    pool.sort(key=lambda c: (bool(c.get('aridity') and c['aridity']['class'] == 'Humid'),
                             -(c.get('fullScore') or c['baseScore'])))
    final = select_nms(pool, args.top, min_dist_m=scales[0])

    result = []
    for rank, c in enumerate(final, 1):
        entry = c['best']['entry']
        tiles = entry.get('tiles', '')
        result.append({'rank': rank, 'id': f'cand-{args.target}-{rank:02d}', 'name': f"{c['region']['name']} · candidate {rank}",
            'body': 'earth', 'center': c['center'], 'selectionIndex': c.get('fullScore') or c['baseScore'],
            'metrics': entry['metrics'], 'elevation': entry['elevation'], 'gridSize': N,
            'spacingMeters': entry['spacingMeters'], 'extentMeters': entry['extentMeters'], 'scaleMeters': c['best']['scaleMeters'],
            'nativeResolutionMeters': 30, 'dataset': DATASET, 'thermal': c.get('thermal'), 'aridity': c.get('aridity'),
            'region': {'id': c['region']['id'], 'name': c['region']['name']},
            'provenance': [*c['region']['provenance'], {'label': f'ALOS World 3D-30m (AW3D30) DSM · JAXA/EORC and METI · tile {tiles} (Planetary Computer)',
                           'url': f'{earth.STAC}/collections/{DEM_COLLECTION}'}],
            'notes': ['Candidate discovered by grid scan; this is not a published field-test site.',
                      f'Best geometric match at {c["best"]["scaleMeters"]} m scale; thermal and aridity context from ERA5 climatology.']})
    payload = {'version': 2, 'targetId': args.target, 'target': f'assets/data/scenarios/targets/{args.target}.json',
        'body': target_json.get('body'), 'window': {'extentMeters': EXTENT, 'gridSize': N, 'spacingMeters': EXTENT / (N - 1)},
        'scales': scales, 'regions': regions_used, 'scannedCells': scanned, 'validCells': len(all_cands), 'failedCells': failed,
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'candidates': result,
        'caveats': [GEOMETRY_CAVEAT, SELECTION_CAVEAT, THERMAL_CAVEAT, ARIDITY_CAVEAT, VERTICAL_DATUM_CAVEAT]}
    out = ROOT / 'assets/data/discovery' / f'{args.target}.json'
    atomic_json(out, payload)
    print(f'scannedCells={scanned} validCells={len(all_cands)} failedCells={failed}; wrote {out.relative_to(ROOT)}')
    for c in result:
        a = c['aridity']['class'] if c.get('aridity') else '—'
        print(f'  #{c["rank"]} {c["id"]} {c["center"]} index={c["selectionIndex"]} scale={c["scaleMeters"]}m aridity={a}')


def self_check():
    # geo_index antideriva: debe coincidir con similarity.mjs (compareTerrain) para el mismo par.
    known = {'slopeP50Deg': 2, 'slopeP90Deg': 4, 'reliefP95P5M': 10, 'triMeanM': 1}
    target = {'slopeP50Deg': 1, 'slopeP90Deg': 2, 'reliefP95P5M': 5, 'triMeanM': .5}
    assert geo_index(known, target) == 50, geo_index(known, target)
    # thermal amplitude participa y renormaliza (earth 20 K vs target 200 K → componente baja).
    with_thermal = geo_index(known, target, {'amplitudeK': 20}, {'minK': 100, 'maxK': 300})
    assert with_thermal == 44, with_thermal   # == compareTerrain() en similarity.mjs para el mismo par
    # NMS: nearby cells do not coexist; a farther third cell can still be selected.
    ranked = [{'center': [0, 0]}, {'center': [0, 0.001]}, {'center': [1, 1]}]
    picked = select_nms(ranked, 3, min_dist_m=2400)
    assert [p['center'] for p in picked] == [[0, 0], [1, 1]], picked
    assert aridity_class(100) == 'Arid' and aridity_class(600) == 'Humid'
    print('discover-analogs self-check OK (geo_index=50, thermal<50, NMS, aridity)')
    try:
        import pyproj  # noqa: F401
    except ImportError:
        print('  (cell_centers not checked: pyproj is not installed)')
        return
    centers = cell_centers({'bbox': [-89.4, 13.6, -89.35, 13.65]})
    assert centers and all(-89.4 < lon < -89.35 and 13.6 < lat < 13.65 for lat, lon in centers)
    print('  cell_centers OK')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('target', nargs='?', default='marius-hills')
    parser.add_argument('--region', default='centroamerica-volcanic',
                        help='REGIONS id, or "auto" to read regions-<target>.json from the global prefilter')
    parser.add_argument('--scales', default='2400,7200', help='window extents in meters; the first value is the base scale')
    parser.add_argument('--top', type=int, default=5)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--self-check', action='store_true')
    args = parser.parse_args()
    if args.self_check:
        self_check()
        return
    if args.region != 'auto' and args.region not in REGIONS:
        parser.error(f'--region must be "auto" or one of: {", ".join(REGIONS)}')
    if args.top < 1 or (args.limit is not None and args.limit < 1):
        parser.error('--top and --limit must be positive')
    args.scales = [int(s) for s in str(args.scales).split(',') if s.strip()]
    if not args.scales:
        parser.error('--scales requires at least one value')
    run(args)


if __name__ == '__main__':
    main()
