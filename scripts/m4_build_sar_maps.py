#!/usr/bin/env python3
"""Publish spatial Sentinel-1 RTC surface-backscatter context for four Earth references.

Source: Microsoft Planetary Computer STAC collection ``sentinel-1-rtc`` and its
public Data API, https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc.
The API signs restricted COG assets server-side; no account or local credentials
are required. This script requests small numeric NPY crops and writes only
calibrated surface-backscatter summaries, source item IDs, coverage, and method.

The two scenes use the same platform, polarization, relative orbit, and pass.
Their 5x5 spatially averaged gamma0 difference is a *screening layer*, not a
validated change detector, trafficability estimate, or underground-void map.
Reference-site SAR is never assigned to a nearby discovery candidate; the
separate discovery publisher obtains each candidate's own scene pair.

Run: python3 scripts/m4_build_sar_maps.py [--force] [site ...]
"""

import argparse
import ast
import datetime as dt
import json
import math
from pathlib import Path
import struct
import tempfile
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
PROCESSES = ROOT / 'assets/data/processes'
SCENARIOS = ROOT / 'assets/data/scenarios/earth'
OUTPUT = ROOT / 'assets/data/m4'
SITES = ('la-corona', 'wright-valley', 'atacama', 'wadi-rum')
COLLECTION = 'sentinel-1-rtc'
BASE = 'https://planetarycomputer.microsoft.com'
WINDOW_METERS = 2400
GRID_SIZE = 120
BOXCAR = 5
CHANGE_DB = 3.0
MIN_VALID_FRACTION = 0.9
EARTH_RADIUS_M = 6371008.8
REQUEST_TIMEOUT_SECONDS = 90


def request_bytes(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'selene-ops-m4-sar/1'})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read()


def request_json(url):
    return json.loads(request_bytes(url))


def bbox_for_center(center):
    lat, lon = center
    half = WINDOW_METERS / 2
    lat_delta = math.degrees(half / EARTH_RADIUS_M)
    lon_delta = math.degrees(half / (EARTH_RADIUS_M * math.cos(math.radians(lat))))
    return [lon - lon_delta, lat - lat_delta, lon + lon_delta, lat + lat_delta]


def choose_pair(history):
    """Choose the newest repeat-pass pair, allowing an interleaved platform."""
    series = history['series']
    for newest in reversed(series):
        for older in reversed(series[:series.index(newest)]):
            if (newest['platform'], newest['relativeOrbit'], newest['orbitState']) != (
                older['platform'], older['relativeOrbit'], older['orbitState']
            ):
                continue
            gap = (dt.date.fromisoformat(newest['date']) - dt.date.fromisoformat(older['date'])).days
            if 0 < gap <= 24 and newest['validFraction'] >= MIN_VALID_FRACTION and older['validFraction'] >= MIN_VALID_FRACTION:
                return older, newest
    raise ValueError('No comparable repeat-pass pair in the published process history')


def validate_item(item, scene, history):
    properties = item['properties']
    polar = history['polarization']
    if (item['collection'] != COLLECTION or item['id'] != scene['item'] or
        properties['platform'] != scene['platform'] or
        properties['sat:relative_orbit'] != scene['relativeOrbit'] or
        properties['sat:orbit_state'] != scene['orbitState'] or
        polar not in properties['sar:polarizations'] or
        properties['datetime'][:10] != scene['date'] or
        polar.lower() not in item['assets']):
        raise ValueError(f'STAC scene metadata disagree with published history for {scene["item"]}')
    band = item['assets'][polar.lower()]['raster:bands'][0]
    return {
        'sourcePixelSpacingMeters': band.get('spatial_resolution'),
        'nominalRadarResolutionMeters': {
            'range': properties.get('sar:resolution_range'),
            'azimuth': properties.get('sar:resolution_azimuth'),
        },
        'instrumentMode': properties.get('sar:instrument_mode'),
        'observationDirection': properties.get('sar:observation_direction'),
    }


def decode_npy(data):
    """Decode the Data API's two-band little-endian float32 data/mask array."""
    if not data.startswith(b'\x93NUMPY') or data[6:8] != b'\x01\x00':
        raise ValueError('Unexpected NPY version')
    header_length = struct.unpack_from('<H', data, 8)[0]
    header = ast.literal_eval(data[10:10 + header_length].decode('ascii'))
    if header != {'descr': '<f4', 'fortran_order': False, 'shape': (2, GRID_SIZE, GRID_SIZE)}:
        raise ValueError(f'Unexpected NPY raster layout: {header}')
    count = GRID_SIZE * GRID_SIZE
    if len(data) != 10 + header_length + 2 * count * 4:
        raise ValueError('Truncated or oversized NPY raster')
    values = struct.unpack_from('<' + str(2 * count) + 'f', data, 10 + header_length)
    return [value if math.isfinite(value) and value > 0 and mask > 0 else None
            for value, mask in zip(values[:count], values[count:])]


def fetch_scene(scene, history, bbox):
    item_url = f'{BASE}/api/stac/v1/collections/{COLLECTION}/items/{urllib.parse.quote(scene["item"])}'
    item = request_json(item_url)
    metadata = validate_item(item, scene, history)
    path = f'{BASE}/api/data/v1/item/bbox/{",".join(f"{x:.8f}" for x in bbox)}/{GRID_SIZE}x{GRID_SIZE}.npy'
    params = urllib.parse.urlencode({
        'collection': COLLECTION, 'item': scene['item'], 'assets': history['polarization'].lower(),
        'coord_crs': 'EPSG:4326', 'dst_crs': 'EPSG:4326', 'resampling': 'nearest', 'return_mask': 'true',
    })
    raster = decode_npy(request_bytes(path + '?' + params))
    coverage = sum(value is not None for value in raster) / len(raster)
    if coverage < MIN_VALID_FRACTION:
        raise ValueError(f'Spatial SAR coverage below {MIN_VALID_FRACTION:.0%}: {scene["item"]} ({coverage:.1%})')
    return raster, coverage, metadata, item_url


def local_mean(values, row, col):
    total = 0.0
    count = 0
    radius = BOXCAR // 2
    for y in range(max(0, row - radius), min(GRID_SIZE, row + radius + 1)):
        for x in range(max(0, col - radius), min(GRID_SIZE, col + radius + 1)):
            value = values[y * GRID_SIZE + x]
            if value is not None:
                total += value
                count += 1
    return total / count if count >= (BOXCAR * BOXCAR * 0.8) else None


def surface_layers(older, newer):
    latest_db = []
    delta_db = []
    for i, value in enumerate(newer):
        latest_db.append(round(10 * math.log10(value), 2) if value is not None else None)
        if value is None or older[i] is None:
            delta_db.append(None)
            continue
        row, col = divmod(i, GRID_SIZE)
        before, after = local_mean(older, row, col), local_mean(newer, row, col)
        delta_db.append(round(10 * math.log10(after / before), 2) if before and after else None)
    return latest_db, delta_db


def assemble_pair(site, history, older, newer, site_role='fixed-reference', target_id=None, search_interval=None):
    """Validate, crop, derive, and package a scene pair for one exact Earth window."""
    bbox = bbox_for_center(history['center'])
    old_values, old_coverage, old_metadata, old_url = fetch_scene(older, history, bbox)
    new_values, new_coverage, new_metadata, new_url = fetch_scene(newer, history, bbox)
    if old_metadata != new_metadata or not all(
        isinstance(value, (int, float)) and value > 0
        for value in (new_metadata['sourcePixelSpacingMeters'],
                      *new_metadata['nominalRadarResolutionMeters'].values())
    ) or new_metadata['instrumentMode'] not in ('IW', 'EW', 'SM') or new_metadata['observationDirection'] not in ('right', 'left'):
        raise ValueError('Paired SAR mode, direction, pixel spacing, or radar resolution differ or are unavailable')
    latest_db, delta_db = surface_layers(old_values, new_values)
    valid_pair = [value for value in delta_db if value is not None]
    if len(valid_pair) / len(delta_db) < MIN_VALID_FRACTION:
        raise ValueError('Comparable spatial SAR coverage is insufficient')
    changed = sum(abs(value) > CHANGE_DB for value in valid_pair)
    result = {
        'schema': 'M4SpatialSarPair', 'version': 1, 'kind': 'published-sar-derived-surface-context',
        'siteId': site, 'siteRole': site_role, 'targetId': target_id,
        'searchInterval': search_interval,
        'center': history['center'], 'bboxWgs84': [round(value, 8) for value in bbox],
        'collection': COLLECTION, 'polarization': history['polarization'],
        'platform': newer['platform'], 'relativeOrbit': newer['relativeOrbit'], 'orbitState': newer['orbitState'],
        'gridSize': GRID_SIZE, 'windowMeters': WINDOW_METERS,
        'sampleSpacingMetersApprox': WINDOW_METERS / GRID_SIZE,
        'sourcePixelSpacingMeters': new_metadata['sourcePixelSpacingMeters'],
        'nominalRadarResolutionMeters': new_metadata['nominalRadarResolutionMeters'],
        'instrumentMode': new_metadata['instrumentMode'],
        'observationDirection': new_metadata['observationDirection'],
        'oldScene': {'date': older['date'], 'item': older['item'], 'validFraction': round(old_coverage, 4), 'source': old_url},
        'newScene': {'date': newer['date'], 'item': newer['item'], 'validFraction': round(new_coverage, 4), 'source': new_url},
        'latestDb': latest_db, 'deltaDb': delta_db,
        'comparableFraction': round(len(valid_pair) / len(delta_db), 4),
        'screeningThresholdDb': CHANGE_DB,
        'aboveThresholdFraction': round(changed / len(valid_pair), 4),
        'fetchedAt': dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        'source': f'{BASE}/dataset/{COLLECTION}', 'license': 'CC-BY-4.0',
        'credit': 'Contains modified Copernicus Sentinel data; RTC hosted by Microsoft Planetary Computer',
        'method': ('WGS84 2400 m square centered on the published Earth window; 120x120 nearest-neighbor samples. '
                   'Later paired gamma0 converted to dB. Pair difference computed after a 5x5 local mean in linear power '
                   '(approximately 100 m), then 10 log10(new/old). Null means missing or insufficient valid pixels. '
                   'The two acquisitions share platform, polarization, relative orbit and orbit direction.'),
        'caveats': [
            'The 3 dB threshold is an exploratory surface-change screen, not a validated hazard detector.',
            'Backscatter responds to surface moisture, roughness, incidence geometry and processing; it does not measure cave depth or void geometry.',
            'The output grid is approximately aligned to the regional DEM window and is not a rover-scale survey.',
            'A quiet pixel does not establish safety; a highlighted pixel does not establish a hazard.',
        ],
    }
    return result


def build(site):
    history = json.loads((PROCESSES / f'{site}.json').read_text())
    scenario = json.loads((SCENARIOS / f'{site}.json').read_text())
    if (history['site'] != site or scenario['id'] != site or history['center'] != scenario['center'] or
        history['collection'] != COLLECTION or history['windowMeters'] != WINDOW_METERS or
        history['polarization'] not in ('VV', 'HH')):
        raise ValueError(f'Published history and reference center do not match for {site}')
    older, newer = choose_pair(history)
    return assemble_pair(site, history, older, newer)


def publish(site, force):
    path = OUTPUT / f'{site}-sar.json'
    if path.exists() and not force:
        print(f'cached {path}')
        return
    result = build(site)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=OUTPUT, prefix='.m4-sar-', suffix='.json', delete=False) as temp:
        json.dump(result, temp, separators=(',', ':'), ensure_ascii=False)
        temp.write('\n')
        temp_path = Path(temp.name)
    temp_path.replace(path)
    print(f'{path}: {result["oldScene"]["date"]} → {result["newScene"]["date"]}; '
          f'{result["comparableFraction"]:.1%} comparable; {result["aboveThresholdFraction"]:.1%} >3 dB')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sites', nargs='*', choices=SITES, help='Earth reference sites; defaults to all four')
    parser.add_argument('--force', action='store_true', help='Rebuild existing output from the public API')
    args = parser.parse_args()
    for site in args.sites or SITES:
        publish(site, args.force)


if __name__ == '__main__':
    main()
