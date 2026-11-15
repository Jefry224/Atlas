#!/usr/bin/env python3
"""Global coarse prefilter: pick the Earth regions worth refining for a planetary target.

Instead of hand-picking boxes, this sweeps a coarse grid over the world's dryland / volcanic /
high-relief belts (LAND_BBOXES, to avoid spending calls on ocean), samples a small elevation
stencil per coarse cell via the Open-Meteo Elevation API (Copernicus GLO-90, no auth), scores its
ruggedness against the target with the SAME geometric index as the fine stage, and emits the
Top-K regions to assets/data/discovery/regions-<target>.json for `discover-analogs.py --region auto`.

This is an orientating shortlist (coarse, sparsely sampled GLO-90): comparable=false. The real
measurement is the GLO-30 fine scan. Reproducible and cached under $XDG_CACHE_HOME/ares-twin-discovery.
"""
import argparse
import datetime as dt
import importlib.util
import json
import math
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from terrain_metrics import compute_metrics

_spec = importlib.util.spec_from_file_location('discover', ROOT / 'scripts/discover-analogs.py')
_disc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_disc)
geo_index, CACHE, TARGETS = _disc.geo_index, _disc.CACHE, _disc.TARGETS

ELEV_URL = 'https://api.open-meteo.com/v1/elevation'
STENCIL_N = 7                 # 7×7 sample grid per coarse cell
STENCIL_SPACING = 2000.0      # metres between stencil nodes (~12 km span, km-scale ruggedness)
# Global dryland / volcanic / high-relief belts where terrestrial analogues plausibly concentrate.
# A coarse search frame (not cherry-picked sites); each cell is still scored on its own geometry.
BELT_NAMES = {
    'sw-north-america': 'Southwestern North America',
    'andes-altiplano': 'Andean Altiplano',
    'sahara': 'Sahara',
    'arabia-levant': 'Arabian Peninsula and Levant',
    'central-asia': 'Central Asia',
    'east-africa-rift': 'East African Rift',
    'australia-interior': 'Australian Interior',
    'iceland-canaries': 'Iceland and the Canary Islands',
}
PROVENANCE_LABEL = 'A.R.E.S. Twin automatic preselection (coarse global GLO-90 prefilter)'
REGION_NOTE = 'Region chosen by a coarse low-resolution DEM scan; an orienting shortlist, not a measurement.'
PREFILTER_CAVEAT = 'Low-resolution DEM preselection (GLO-90, sparse sampling); the fine scan uses ALOS World 3D-30m.'
LAND_BBOXES = [
    ('sw-north-america', [-118.0, 31.0, -106.0, 39.0]),
    ('andes-altiplano', [-70.5, -24.5, -66.0, -16.0]),
    ('sahara', [-8.0, 20.0, 30.0, 31.0]),
    ('arabia-levant', [34.0, 23.0, 56.0, 33.0]),
    ('central-asia', [55.0, 40.0, 78.0, 48.0]),
    ('east-africa-rift', [35.0, -4.0, 42.0, 12.0]),
    ('australia-interior', [125.0, -30.0, 141.0, -22.0]),
    ('iceland-canaries', [-22.0, 27.0, -13.0, 65.0]),
]


def elevations(points):
    """Batch Open-Meteo elevation lookup for [(lat, lon), ...] (<=100 per request)."""
    out = []
    for i in range(0, len(points), 100):
        chunk = points[i:i + 100]
        query = urllib.parse.urlencode({'latitude': ','.join(f'{la:.5f}' for la, _ in chunk),
                                        'longitude': ','.join(f'{lo:.5f}' for _, lo in chunk)})
        with urllib.request.urlopen(f'{ELEV_URL}?{query}', timeout=30) as r:
            out += json.loads(r.read())['elevation']
    return out


def stencil(lat, lon):
    from pyproj import CRS, Transformer
    crs = CRS.from_proj4(f'+proj=aeqd +lat_0={lat} +lon_0={lon} +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs')
    inv = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
    half = (STENCIL_N - 1) / 2
    pts = []
    for r in range(STENCIL_N):
        for c in range(STENCIL_N):
            x, y = (c - half) * STENCIL_SPACING, (half - r) * STENCIL_SPACING
            glon, glat = inv.transform(x, y)
            pts.append((glat, glon))
    return pts


def coarse_cells(step):
    cells = []
    for name, (west, south, east, north) in LAND_BBOXES:
        lat = south + step / 2
        while lat < north:
            lon = west + step / 2
            while lon < east:
                cells.append((name, round(lat, 4), round(lon, 4)))
                lon += step
            lat += step
    return cells


def merge_regions(scored, top_regions, half_deg=0.22):
    """Greedy: best coarse cells become ~44 km region boxes; skip cells inside an existing box."""
    regions = []
    for name, lat, lon, score in scored:
        if any(r['center'][0] - 2 * half_deg <= lat <= r['center'][0] + 2 * half_deg and
               r['center'][1] - 2 * half_deg <= lon <= r['center'][1] + 2 * half_deg for r in regions):
            continue
        rid = f'auto-{len(regions) + 1:02d}-{name}'
        label = BELT_NAMES.get(name, name.replace('-', ' ').title())
        regions.append({'id': rid, 'name': f'{label} · {lat:.2f},{lon:.2f}',
                        'center': [lat, lon], 'coarseScore': score,
                        'bbox': [round(lon - half_deg, 4), round(lat - half_deg, 4), round(lon + half_deg, 4), round(lat + half_deg, 4)],
                        'provenance': [{'label': PROVENANCE_LABEL,
                                        'url': 'https://open-meteo.com/en/docs/elevation-api'}],
                        'notes': [REGION_NOTE]})
        if len(regions) >= top_regions:
            break
    return regions


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target', nargs='?', default='marius-hills')
    ap.add_argument('--step', type=float, default=1.0, help='paso de la rejilla gruesa en grados')
    ap.add_argument('--top-regions', type=int, default=6)
    ap.add_argument('--limit', type=int, help='máximo de celdas gruesas a evaluar (para demos)')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    if args.target not in TARGETS:
        raise SystemExit(f'Objetivo desconocido: {args.target}. Opciones: {", ".join(TARGETS)}')
    target_metrics = json.loads((ROOT / 'assets/data/scenarios/targets' / f'{args.target}.json').read_text())['metrics']

    cache = CACHE / f'prefilter-{args.target}-step{args.step}.json'
    if cache.exists() and not args.force:
        scored = json.loads(cache.read_text())
    else:
        cells = coarse_cells(args.step)
        if args.limit:
            cells = cells[:args.limit]
        spacing = STENCIL_SPACING
        scored = []
        for i, (name, lat, lon) in enumerate(cells, 1):
            try:
                elev = elevations(stencil(lat, lon))
                if len(elev) != STENCIL_N * STENCIL_N or not all(isinstance(v, (int, float)) for v in elev):
                    raise RuntimeError('esténcil incompleto')
                metrics = compute_metrics(elev, STENCIL_N, spacing, native_resolution_m=90, roughness=None)
                score = geo_index(metrics, target_metrics)
                if score is not None:
                    scored.append((name, lat, lon, score))
            except Exception as exc:
                print(f'  skip {name} {lat:.2f},{lon:.2f}: {exc}', flush=True)
            if i % 10 == 0:
                print(f'  gruesas {i}/{len(cells)} · válidas {len(scored)}', flush=True)
        scored.sort(key=lambda s: -s[3])
        CACHE.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(scored))

    regions = merge_regions(scored, args.top_regions)
    payload = {'version': 1, 'targetId': args.target, 'step': args.step,
               'coarseCells': len(scored), 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
               'regions': regions,
               'caveats': [_disc.GEOMETRY_CAVEAT, PREFILTER_CAVEAT]}
    out = ROOT / 'assets/data/discovery' / f'regions-{args.target}.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'coarseCells={len(scored)}; {len(regions)} regiones → {out.relative_to(ROOT)}')
    for r in regions:
        print(f'  {r["id"]} score={r["coarseScore"]} bbox={r["bbox"]}')


if __name__ == '__main__':
    main()
