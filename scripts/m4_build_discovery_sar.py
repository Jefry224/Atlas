#!/usr/bin/env python3
"""Publish same-orbit Sentinel-1 RTC surface maps for Module 1 Earth candidates.

Source: Microsoft Planetary Computer public STAC and Data APIs,
https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc.
Candidate IDs and centers come from the published Module 1 discovery JSON.
No reference-site SAR is copied to a candidate. Missing coverage leaves no map.
The result is an unvalidated surface-backscatter screen, never a cave detector.

Run: python3 scripts/m4_build_discovery_sar.py [--as-of YYYY-MM-DD] [--force] [candidate-id ...]
"""

import argparse
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import urllib.parse


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / 'scripts/m4_build_sar_maps.py'
SPEC = importlib.util.spec_from_file_location('m4_build_sar_maps', MODULE_PATH)
SAR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SAR)
TARGETS = ('marius-hills', 'shackleton', 'jezero', 'valles-marineris')
DISCOVERY = ROOT / 'assets/data/discovery'
SEARCH_DAYS = 90
MAX_PAIR_ATTEMPTS = 5


def candidates():
    found = {}
    for target in TARGETS:
        data = json.loads((DISCOVERY / f'{target}.json').read_text())
        if data['targetId'] != target:
            raise ValueError(f'Discovery target mismatch: {target}')
        for candidate in data['candidates']:
            if candidate['id'] in found or candidate['body'] != 'earth' or candidate['extentMeters'] != SAR.WINDOW_METERS:
                raise ValueError(f'Invalid discovery candidate identity or extent: {candidate["id"]}')
            found[candidate['id']] = (target, candidate)
    return found


def search_records(center, as_of):
    start = as_of - dt.timedelta(days=SEARCH_DAYS)
    interval = f'{start}/{as_of}'
    bbox = SAR.bbox_for_center(center)
    params = urllib.parse.urlencode({
        'collections': SAR.COLLECTION, 'bbox': ','.join(f'{x:.8f}' for x in bbox),
        'datetime': interval, 'limit': 100, 'sortby': '-datetime',
    })
    data = SAR.request_json(f'{SAR.BASE}/api/stac/v1/search?{params}')
    records = []
    for item in data.get('features', []):
        props = item.get('properties', {})
        polar = 'VV' if 'VV' in props.get('sar:polarizations', []) and 'vv' in item.get('assets', {}) else (
            'HH' if 'HH' in props.get('sar:polarizations', []) and 'hh' in item.get('assets', {}) else None)
        date = str(props.get('datetime', ''))[:10]
        if (item.get('collection') != SAR.COLLECTION or polar is None or
            props.get('sat:orbit_state') not in ('ascending', 'descending') or
            not isinstance(props.get('sat:relative_orbit'), int) or
            not isinstance(props.get('platform'), str)):
            continue
        try:
            dt.date.fromisoformat(date)
        except ValueError:
            continue
        records.append({
            'date': date, 'platform': props['platform'], 'relativeOrbit': props['sat:relative_orbit'],
            'orbitState': props['sat:orbit_state'], 'polarization': polar,
            'validFraction': 1.0, 'item': item['id'],
        })
    records.sort(key=lambda item: (item['date'], item['item']), reverse=True)
    return records, interval


def comparable_pairs(records):
    for i, newer in enumerate(records):
        for older in records[i + 1:]:
            gap = (dt.date.fromisoformat(newer['date']) - dt.date.fromisoformat(older['date'])).days
            if gap > 24:
                continue
            if 0 < gap and all(newer[key] == older[key] for key in
                               ('platform', 'relativeOrbit', 'orbitState', 'polarization')):
                yield older, newer


def build_candidate(target, candidate, as_of):
    records, interval = search_records(candidate['center'], as_of)
    attempted = 0
    for older, newer in comparable_pairs(records):
        context = {'center': candidate['center'], 'polarization': newer['polarization']}
        try:
            return SAR.assemble_pair(candidate['id'], context, older, newer,
                                     site_role='discovery-candidate', target_id=target,
                                     search_interval=interval)
        except ValueError as error:
            if not any(reason in str(error).lower() for reason in ('coverage', 'paired sar mode')):
                raise
            attempted += 1
            if attempted >= MAX_PAIR_ATTEMPTS:
                break
    raise ValueError(f'No two same-platform, same-orbit scenes with >=90% paired coverage in {interval}')


def publish(target, candidate, as_of, force):
    path = SAR.OUTPUT / f'{candidate["id"]}-sar.json'
    if path.exists() and not force:
        print(f'cached {path}')
        return True
    try:
        result = build_candidate(target, candidate, as_of)
    except ValueError as error:
        print(f'unavailable {candidate["id"]}: {error}')
        return False
    SAR.OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=SAR.OUTPUT,
                                     prefix='.m4-sar-', suffix='.json', delete=False) as temp:
        json.dump(result, temp, separators=(',', ':'), ensure_ascii=False)
        temp.write('\n')
        temp_path = Path(temp.name)
    temp_path.replace(path)
    print(f'{path}: {result["oldScene"]["date"]} → {result["newScene"]["date"]}; '
          f'{result["comparableFraction"]:.1%} comparable; {result["aboveThresholdFraction"]:.1%} >3 dB')
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ids', nargs='*', help='Candidate IDs; defaults to every published candidate')
    parser.add_argument('--as-of', type=dt.date.fromisoformat, default=dt.date.today(),
                        help='Last STAC search date in UTC (default: today)')
    parser.add_argument('--force', action='store_true', help='Rebuild existing maps')
    args = parser.parse_args()
    catalog = candidates()
    unknown = set(args.ids) - set(catalog)
    if unknown:
        parser.error(f'Unknown candidate IDs: {", ".join(sorted(unknown))}')
    selected = args.ids or list(catalog)
    available = 0
    for site_id in selected:
        target, candidate = catalog[site_id]
        available += publish(target, candidate, args.as_of, args.force)
    print(f'published/available: {available}/{len(selected)} candidate SAR maps')


if __name__ == '__main__':
    main()
