"""Extract a native-resolution Marius Hills Pit surface DTM window from the LROC PDS GeoTIFF.

Source: NASA/GSFC/Arizona State University, LROC NAC_DTM_MARIUSPIT01,
https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_MARIUSPIT01

The source is an uncompressed, north-up float32 GeoTIFF in Moon equirectangular
coordinates. This script validates its layout and projection before writing a
small JSON crop. Nodata remains null; the surface DTM cannot measure a cave
interior or validate the published 40 m pit depth.
"""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import tempfile


SOURCE_URL = ('https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/'
              'LROLRC_2001/DATA/SDP/NAC_DTM/MARIUSPIT01/NAC_DTM_MARIUSPIT01.TIF')
PRODUCT_URL = 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_MARIUSPIT01'
PIT_ATLAS_URL = 'https://lroc.im-ldi.com/atlases/pits/1'
PIT_LAT = 14.0917
PIT_LON_EAST = 303.2299
MOON_RADIUS_M = 1737400.0
GRID_SIZE = 101
TAG_TYPES = {2: ('s', 1), 3: ('H', 2), 4: ('I', 4), 12: ('d', 8)}


def _one(values, label):
    if len(values) != 1:
        raise ValueError(f'{label} must contain exactly one value')
    return values[0]


def read_tiff_tags(file):
    """Read only the baseline tags needed for this particular uncompressed GeoTIFF."""
    file.seek(0)
    header = file.read(8)
    if len(header) != 8 or header[:4] != b'II*\x00':
        raise ValueError('Expected a little-endian classic TIFF')
    ifd_offset = struct.unpack_from('<I', header, 4)[0]
    file.seek(ifd_offset)
    count_raw = file.read(2)
    if len(count_raw) != 2:
        raise ValueError('Truncated TIFF directory')
    count = struct.unpack('<H', count_raw)[0]
    tags = {}
    file_size = os.fstat(file.fileno()).st_size
    for _ in range(count):
        entry = file.read(12)
        if len(entry) != 12:
            raise ValueError('Truncated TIFF tag entry')
        tag, type_id, n, offset = struct.unpack('<HHII', entry)
        if type_id not in TAG_TYPES or n > 200000:
            continue
        fmt, size = TAG_TYPES[type_id]
        byte_count = n * size
        if byte_count > 4 and offset + byte_count > file_size:
            raise ValueError(f'TIFF tag {tag} points past end of file')
        position = file.tell()
        if byte_count <= 4:
            raw = entry[8:8 + byte_count]
        else:
            file.seek(offset)
            raw = file.read(byte_count)
            file.seek(position)
        if len(raw) != byte_count:
            raise ValueError(f'Truncated TIFF tag {tag}')
        tags[tag] = raw.rstrip(b'\x00').decode('ascii') if type_id == 2 else struct.unpack('<' + str(n) + fmt, raw)
    return tags


def _geokey(tags, key):
    directory = tags[34735]
    if directory[:3] != (1, 1, 0) or len(directory) < 4 + directory[3] * 4:
        raise ValueError('Unexpected GeoKey directory layout')
    for i in range(4, 4 + directory[3] * 4, 4):
        k, location, count, offset = directory[i:i + 4]
        if k != key:
            continue
        if location == 0 and count == 1:
            return offset
        if location == 34736:
            values = tags[34736][offset:offset + count]
            return _one(values, f'GeoKey {key}')
    raise ValueError(f'Missing GeoKey {key}')


def validate_source(tags):
    """Reject products whose raster layout or lunar projection differs from the reviewed DTM."""
    width = _one(tags[256], 'width')
    height = _one(tags[257], 'height')
    if (width, height) != (3331, 12529):
        raise ValueError('Unexpected NAC_DTM_MARIUSPIT01 dimensions')
    expected = {258: 32, 259: 1, 262: 1, 277: 1, 278: 1, 284: 1, 339: 3}
    for tag, value in expected.items():
        if _one(tags[tag], f'TIFF tag {tag}') != value:
            raise ValueError(f'Unexpected TIFF tag {tag}')
    if len(tags[273]) != height or len(tags[279]) != height or any(n != width * 4 for n in tags[279]):
        raise ValueError('Expected one uncompressed float32 strip per raster row')
    scale = tags[33550]
    tie = tags[33922]
    if len(scale) != 3 or len(tie) != 6:
        raise ValueError('Unexpected GeoTIFF transform')
    for actual, expected_value in zip(scale, (4.0, 4.0, 0.0)):
        if not math.isclose(actual, expected_value, abs_tol=1e-5):
            raise ValueError('Unexpected GeoTIFF pixel scale')
    for actual, expected_value in zip(tie, (0.0, 0.0, 0.0, 3619148.0, 456356.0, 0.0)):
        if not math.isclose(actual, expected_value, abs_tol=1e-3):
            raise ValueError('Unexpected GeoTIFF tiepoint')
    for key, value in {1024: 1, 1025: 1, 2054: 9102, 3075: 17, 3076: 9001,
                       3078: 14.0, 3082: 0.0, 3083: 0.0, 3088: 180.0,
                       3089: 0.0, 2057: MOON_RADIUS_M, 2058: MOON_RADIUS_M}.items():
        actual = _geokey(tags, key)
        if not math.isclose(actual, value, abs_tol=1e-5):
            raise ValueError(f'Unexpected GeoKey {key}')
    return width, height, scale, tie


def projected_point(latitude, longitude_east):
    x = MOON_RADIUS_M * math.radians(longitude_east - 180.0) * math.cos(math.radians(14.0))
    y = MOON_RADIUS_M * math.radians(latitude)
    return x, y


def extract(file):
    tags = read_tiff_tags(file)
    width, height, scale, tie = validate_source(tags)
    x, y = projected_point(PIT_LAT, PIT_LON_EAST)
    col_float = (x - tie[3]) / scale[0]
    row_float = (tie[4] - y) / scale[1]
    center_col = round(col_float - 0.5)
    center_row = round(row_float - 0.5)
    half = GRID_SIZE // 2
    left, top = center_col - half, center_row - half
    if left < 0 or top < 0 or left + GRID_SIZE > width or top + GRID_SIZE > height:
        raise ValueError('Pit crop falls outside the source raster')
    elevation = []
    for row in range(top, top + GRID_SIZE):
        offset = tags[273][row] + left * 4
        file.seek(offset)
        raw = file.read(GRID_SIZE * 4)
        if len(raw) != GRID_SIZE * 4:
            raise ValueError('Truncated DTM raster row')
        for value in struct.unpack('<' + str(GRID_SIZE) + 'f', raw):
            elevation.append(round(value, 2) if math.isfinite(value) and value > -1e30 else None)
    center_x = tie[3] + (center_col + 0.5) * scale[0]
    center_y = tie[4] - (center_row + 0.5) * scale[1]
    center_lat = math.degrees(center_y / MOON_RADIUS_M)
    center_lon = 180.0 + math.degrees(center_x / (MOON_RADIUS_M * math.cos(math.radians(14.0))))
    if center_lon > 180:
        center_lon -= 360
    file.seek(0)
    digest = hashlib.file_digest(file, 'sha256').hexdigest()
    return {
        'schema': 'M4SurfaceDtmCrop', 'version': 1, 'kind': 'published-surface-dtm-crop',
        'product': 'NAC_DTM_MARIUSPIT01', 'body': 'moon',
        'center': [round(center_lat, 8), round(center_lon, 8)],
        'pitLocation': [PIT_LAT, round(PIT_LON_EAST - 360, 4)],
        'pitCell': {'row': round(row_float - top - 0.5, 3), 'col': round(col_float - left - 0.5, 3)},
        'gridSize': GRID_SIZE, 'spacingMeters': 4, 'extentMeters': (GRID_SIZE - 1) * 4,
        'nativeResolutionMeters': 4, 'elevationUnit': 'm',
        'elevation': elevation, 'nodataCount': elevation.count(None),
        'sourceWindow': {'sourceWidth': width, 'sourceHeight': height,
                         'left': left, 'top': top, 'width': GRID_SIZE, 'height': GRID_SIZE},
        'projection': {'name': 'Moon equirectangular', 'geokeyProjection': 17,
                       'coordinateReference': 'IAU Moon 2000, planetocentric',
                       'radiusMeters': MOON_RADIUS_M, 'centralMeridianDeg': 180,
                       'standardParallelDeg': 14, 'pixelIsArea': True,
                       'sourceTiepointMeters': [tie[3], tie[4]]},
        'source': SOURCE_URL, 'productPage': PRODUCT_URL,
        'pitAtlas': PIT_ATLAS_URL, 'sourceSha256': digest,
        'termsUrl': 'https://lroc.im-ldi.com/about/terms',
        'credit': 'NASA/GSFC/Arizona State University · LROC',
        'caveats': [
            'This crop is a published surface DTM around the mapped pit, not an underground survey.',
            'Nodata inside the pit is unknown elevation, not a measured cavity outline or depth.',
            'Elevations are rounded to 0.01 m for publication; this does not improve source accuracy.',
            'The LROC atlas reports 40 m pit depth from stereo modeling; this grid does not independently validate it.',
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True, help='Downloaded NAC_DTM_MARIUSPIT01.TIF')
    parser.add_argument('--output', type=Path, default=Path('assets/data/m4/marius-pit-dtm.json'))
    args = parser.parse_args()
    with args.input.open('rb') as source:
        result = extract(source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=args.output.parent,
                                     prefix='.m4-dtm-', suffix='.json', delete=False) as temp:
        json.dump(result, temp, ensure_ascii=False, separators=(',', ':'))
        temp.write('\n')
        temp_path = Path(temp.name)
    temp_path.replace(args.output)
    print(f'{args.output}: {result["gridSize"]}×{result["gridSize"]}, '
          f'{result["nodataCount"]} unknown cells, source SHA-256 {result["sourceSha256"]}')


if __name__ == '__main__':
    main()
