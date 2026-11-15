"""Extract one 1 m bare-earth USGS OPR DEM crop for an M4 candidate.

Source: USGS 3DEP Original Product Resolution DEM, NM_SouthEast_2018_D19,
https://www.sciencebase.gov/catalog/item/6197a1e0d34eb622f692c33d.
The input is the public-domain USGS GeoTIFF named in SOURCE_URL. This script
uses only the Python standard library and validates its TIFF layout, projection,
and LZW floating-point predictor before publishing a small local crop.

Run: python3 scripts/m4_extract_usgs_opr.py --input /path/to/source.tif

A bare-earth DEM can screen slope and terrain breaks at 1 m cell spacing. It
cannot identify every rock, vegetation, wheel trap, or vehicle clearance.
"""

import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import struct
import tempfile

from m4_extract_lroc_dtm import _geokey, read_tiff_tags


ROOT = Path(__file__).resolve().parents[1]
CANDIDATE_ID = 'cand-valles-marineris-05'
SOURCE_URL = ('https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/OPR/Projects/'
              'NM_SouthEast_2018_D19/NM_SouthEast_B1_2018/TIFF/'
              'USGS_OPR_NM_SouthEast_2018_D19_13S_CS_59999_04500.tif')
SOURCE_RECORD = 'https://www.sciencebase.gov/catalog/item/6197a1e0d34eb622f692c33d'
TERMS_URL = 'https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map'
GRID_SIZE = 401
TILE_SIZE = 256
TILE_BYTES = TILE_SIZE * TILE_SIZE * 4
SOURCE_WIDTH = SOURCE_HEIGHT = 1500
SOURCE_X = 360000.0
SOURCE_Y = 3606000.0


def utm13_from_wgs84(latitude, longitude):
    """Approximate UTM 13N coordinates; no WGS84-to-NAD83 datum shift is applied."""
    lat, lon = math.radians(latitude), math.radians(longitude)
    lon0 = math.radians(-105)
    a, e2, k0 = 6378137.0, 0.00669438, 0.9996
    ep2 = e2 / (1 - e2)
    sin_lat, cos_lat = math.sin(lat), math.cos(lat)
    n = a / math.sqrt(1 - e2 * sin_lat ** 2)
    t, c, aa = math.tan(lat) ** 2, ep2 * cos_lat ** 2, cos_lat * (lon - lon0)
    meridian = a * (
        (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * lat)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * lat)
        - 35 * e2 ** 3 / 3072 * math.sin(6 * lat)
    )
    x = 500000 + k0 * n * (aa + (1 - t + c) * aa ** 3 / 6 +
                            (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * aa ** 5 / 120)
    y = k0 * (meridian + n * math.tan(lat) *
              (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24 +
               (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * aa ** 6 / 720))
    return x, y


def validate_source(tags):
    expected = {256: SOURCE_WIDTH, 257: SOURCE_HEIGHT, 258: 32, 259: 5,
                262: 1, 277: 1, 284: 1, 317: 3, 322: TILE_SIZE,
                323: TILE_SIZE, 339: 3}
    for tag, value in expected.items():
        if tags.get(tag) != (value,):
            raise ValueError(f'Unexpected TIFF tag {tag}')
    if len(tags.get(324, ())) != 36 or len(tags.get(325, ())) != 36:
        raise ValueError('Expected 6 by 6 tiled GeoTIFF')
    if tags.get(33550) != (1.0, 1.0, 1.0) or tags.get(33922) != (
            0.0, 0.0, 0.0, SOURCE_X, SOURCE_Y, 0.0):
        raise ValueError('Unexpected 1 m UTM geotransform')
    if _geokey(tags, 3072) != 6342 or _geokey(tags, 4096) != 5703:
        raise ValueError('Expected NAD83(2011) UTM 13N and NAVD88 heights')
    if tags.get(42113) != '-999999':
        raise ValueError('Unexpected nodata marker')


def decode_tiff_lzw(raw):
    """Decode the reviewed TIFF LZW stream (MSB codes, early code-width change)."""
    bit_position, code_width, next_code = 0, 9, 258
    table = {i: bytes((i,)) for i in range(256)}
    previous = None
    output = bytearray()

    def read_code(width):
        nonlocal bit_position
        if bit_position + width > len(raw) * 8:
            raise ValueError('Truncated LZW tile')
        start = bit_position // 8
        bits = int.from_bytes(raw[start:start + 3].ljust(3, b'\x00'), 'big')
        code = (bits >> (24 - bit_position % 8 - width)) & ((1 << width) - 1)
        bit_position += width
        return code

    while True:
        code = read_code(code_width)
        if code == 256:
            table = {i: bytes((i,)) for i in range(256)}
            code_width, next_code, previous = 9, 258, None
            continue
        if code == 257:
            break
        entry = table.get(code)
        if entry is None and code == next_code and previous is not None:
            entry = previous + previous[:1]
        if entry is None:
            raise ValueError('Invalid LZW code')
        output.extend(entry)
        if len(output) > TILE_BYTES + 1:
            raise ValueError('Oversized LZW tile')
        if previous is not None:
            table[next_code] = previous + entry[:1]
            next_code += 1
            if code_width < 12 and next_code == (1 << code_width) - 1:
                code_width += 1
        previous = entry
    # This source's TIFF-LZW encoder emits one trailing decoded byte per tile.
    if len(output) not in (TILE_BYTES, TILE_BYTES + 1):
        raise ValueError('Unexpected uncompressed tile length')
    return output[:TILE_BYTES]


def undo_float_predictor(encoded):
    """Undo TIFF Predictor 3: row-byte differencing and four byte planes."""
    decoded = bytearray(TILE_BYTES)
    for row in range(TILE_SIZE):
        start = row * TILE_SIZE * 4
        line = bytearray(encoded[start:start + TILE_SIZE * 4])
        for i in range(1, len(line)):
            line[i] = (line[i] + line[i - 1]) & 255
        for col in range(TILE_SIZE):
            for byte in range(4):
                decoded[start + 4 * col + byte] = line[(3 - byte) * TILE_SIZE + col]
    return struct.unpack('<' + str(TILE_SIZE * TILE_SIZE) + 'f', decoded)


def read_crop(file, tags, left, top):
    tiles_per_row = math.ceil(SOURCE_WIDTH / TILE_SIZE)
    cache = {}
    values = []
    for row in range(top, top + GRID_SIZE):
        for col in range(left, left + GRID_SIZE):
            tile = (row // TILE_SIZE) * tiles_per_row + col // TILE_SIZE
            if tile not in cache:
                file.seek(tags[324][tile])
                compressed = file.read(tags[325][tile])
                if len(compressed) != tags[325][tile]:
                    raise ValueError('Truncated compressed tile')
                cache[tile] = undo_float_predictor(decode_tiff_lzw(compressed))
            value = cache[tile][(row % TILE_SIZE) * TILE_SIZE + col % TILE_SIZE]
            values.append(round(value * 100) if math.isfinite(value) and value != -999999 else None)
    return values


def extract(file, candidate):
    tags = read_tiff_tags(file)
    validate_source(tags)
    lat, lon = candidate['center']
    x, y = utm13_from_wgs84(lat, lon)
    center_col = round(x - SOURCE_X - 0.5)
    center_row = round(SOURCE_Y - y - 0.5)
    half = GRID_SIZE // 2
    left, top = center_col - half, center_row - half
    if left < 0 or top < 0 or left + GRID_SIZE > SOURCE_WIDTH or top + GRID_SIZE > SOURCE_HEIGHT:
        raise ValueError('Candidate crop falls outside the reviewed OPR tile')
    elevation_cm = read_crop(file, tags, left, top)
    if elevation_cm.count(None) / len(elevation_cm) > 0.05:
        raise ValueError('More than 5% of the local terrain patch is nodata')
    file.seek(0)
    digest = hashlib.file_digest(file, 'sha256').hexdigest()
    return {
        'schema': 'M4LocalDemCrop', 'version': 1, 'kind': 'published-bare-earth-dem-crop',
        'siteId': CANDIDATE_ID, 'targetId': 'valles-marineris', 'body': 'earth',
        'candidateCenter': candidate['center'], 'gridSize': GRID_SIZE,
        'spacingMeters': 1, 'extentMeters': GRID_SIZE - 1,
        'elevationUnit': 'centimetres', 'elevationCm': elevation_cm,
        'nodataCount': elevation_cm.count(None),
        'sourceWindow': {'left': left, 'top': top, 'width': GRID_SIZE, 'height': GRID_SIZE,
                         'sourceWidth': SOURCE_WIDTH, 'sourceHeight': SOURCE_HEIGHT},
        'projection': {'horizontal': 'EPSG:6342 NAD83(2011) / UTM zone 13N',
                       'vertical': 'EPSG:5703 NAVD88 height',
                       'topLeftPixelCornerUtmMeters': [SOURCE_X + left, SOURCE_Y - top],
                       'centerPixelCenterUtmMeters': [SOURCE_X + center_col + 0.5,
                                                      SOURCE_Y - center_row - 0.5],
                       'candidateCenterUtmApproxMeters': [round(x, 3), round(y, 3)]},
        'nativeResolutionMeters': 1,
        'verticalAccuracyMeters': None,
        'source': SOURCE_URL, 'sourceRecord': SOURCE_RECORD,
        'sourceSha256': digest, 'terms': TERMS_URL, 'license': 'USGS public domain',
        'credit': 'U.S. Geological Survey, 3DEP OPR DEM, NM_SouthEast_2018_D19',
        'generatedAt': dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        'method': ('Extract a 401 by 401 native 1 m bare-earth grid from the USGS source '
                   'GeoTIFF around the Discovery candidate center. Source float elevations '
                   'are rounded to 1 cm for compact publication; this is not a vertical '
                   'accuracy claim. WGS84 candidate coordinates are projected with UTM '
                   'formulas without a NAD83(2011) datum shift.'),
        'caveats': [
            'This 400 m local patch is only a small part of the 2400 m Discovery window.',
            'Bare-earth processing may omit rocks, vegetation and other objects above ground.',
            'One-meter samples may miss sub-meter obstacles, cracks and wheel traps.',
            'The exact survey accuracy and independent obstacle labels are not attached.',
            'Terrain-break screens derived from this DEM are not rover clearance or a field-verified trail.',
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True, help='Downloaded USGS OPR GeoTIFF')
    parser.add_argument('--output', type=Path,
                        default=Path('assets/data/m4/cand-valles-marineris-05-local-dem.json'))
    args = parser.parse_args()
    discovery = json.loads((ROOT / 'assets/data/discovery/valles-marineris.json').read_text())
    candidate = next(c for c in discovery['candidates'] if c['id'] == CANDIDATE_ID)
    with args.input.open('rb') as source:
        result = extract(source, candidate)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=args.output.parent,
                                     prefix='.m4-local-dem-', suffix='.json', delete=False) as temp:
        json.dump(result, temp, ensure_ascii=False, separators=(',', ':'))
        temp.write('\n')
        temp_path = Path(temp.name)
    temp_path.replace(args.output)
    print(f'{args.output}: {result["gridSize"]}×{result["gridSize"]} at 1 m, '
          f'{result["nodataCount"]} unknown; SHA-256 {result["sourceSha256"]}')


if __name__ == '__main__':
    main()
