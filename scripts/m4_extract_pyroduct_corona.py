"""Extract La Corona lava-tube cross-sections from the open Pyroduct v3 archive.

Source: Romio et al. (2026), Pyroduct Digital Catalog 3.0, CC BY 4.0,
https://zenodo.org/records/23456401. Its ES.LNZ.00 entry digitizes sections
from the VIGEA survey cited by Tomasi et al. (2022), DOI 10.1029/2022JB024056.

Download the original ZIP yourself, then run:
python3 scripts/m4_extract_pyroduct_corona.py --input /path/to/Pyroduct-v3.zip

These individual 2-D section outlines have metric scale but no georeferenced
station positions or co-registered surface heights. They cannot yield roof depth,
an underground route, or a complete 3-D tube model.
"""

import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import tempfile
import zipfile


PREFIX = ('(Cross-Sections) Pyroduct Digital Catalog in .txt/Spain/Lanzarote/'
          'ES.LNZ.00 La Corona Lava Tube System/')
RECORD_URL = 'https://zenodo.org/records/23456401'
ORIGINAL_PAPER = 'https://doi.org/10.1029/2022JB024056'
EXPECTED_SECTIONS = 74
EXPECTED_POINTS = 99


def section_metrics(points):
    """Return extent and polygon area of one metric 2-D section outline."""
    if len(points) < 3 or not all(len(point) == 2 and all(math.isfinite(v) for v in point)
                                      for point in points):
        raise ValueError('Invalid cross-section vertices')
    xs, ys = zip(*points)
    width, height = max(xs) - min(xs), max(ys) - min(ys)
    if not 0 < width < 35 or not 0 < height < 35:
        raise ValueError('Cross-section exceeds the catalog cell scale')
    twice_area = sum(x * points[(i + 1) % len(points)][1] -
                     points[(i + 1) % len(points)][0] * y
                     for i, (x, y) in enumerate(points))
    area = abs(twice_area) / 2
    if not 0 < area <= width * height:
        raise ValueError('Invalid cross-section polygon area')
    return width, height, area


def parse_section(raw, number):
    rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
    if not rows or [part.strip() for part in rows[0]] != ['X', 'Y']:
        raise ValueError(f'Unexpected section {number} header')
    try:
        points = [(float(row[0]), float(row[1])) for row in rows[1:]]
    except (IndexError, ValueError) as error:
        raise ValueError(f'Invalid section {number} coordinate') from error
    # The catalog repeats the first three vertices at the end for curve fitting.
    if len(points) != EXPECTED_POINTS + 3 or points[-3:] != points[:3]:
        raise ValueError(f'Section {number} has an unexpected vertex layout')
    points = points[:-3]
    width, height, area = section_metrics(points)
    min_x = min(x for x, _ in points)
    min_y = min(y for _, y in points)
    return {
        'number': number,
        'widthM': round(width, 2),
        'heightM': round(height, 2),
        'areaM2': round(area, 2),
        'outlineM': [[round(x - min_x, 3), round(y - min_y, 3)] for x, y in points],
    }


def extract(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        readme = archive.read('README.txt').decode('utf-8-sig')
        if 'PYRODUCT DIGITAL CATALOG' not in readme or 'CC BY 4.0' not in readme:
            raise ValueError('Unexpected catalog release or license')
        numbered = {}
        for name in names:
            if not name.startswith(PREFIX):
                continue
            match = re.fullmatch(r'cross-section_(\d+)\.txt', name[len(PREFIX):])
            if match:
                number = int(match.group(1))
                if number in numbered:
                    raise ValueError(f'Duplicate section {number}')
                numbered[number] = name
        if set(numbered) != set(range(1, EXPECTED_SECTIONS + 1)):
            raise ValueError('La Corona section sequence is incomplete')
        sections = [parse_section(archive.read(numbered[n]), n)
                    for n in range(1, EXPECTED_SECTIONS + 1)]
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {
        'schema': 'M4CaveSections', 'version': 1,
        'kind': 'digitized-literature-cross-sections',
        'siteId': 'la-corona', 'body': 'earth', 'catalogCode': 'ES.LNZ.00',
        'sectionCount': EXPECTED_SECTIONS, 'coordinateFrame': 'independent local 2-D metric outlines',
        'stationCoordinates': None, 'roofDepthBySectionM': None,
        'sections': sections,
        'source': RECORD_URL, 'sourceArchive': 'Pyroduct Digital Catalog v.3.0.zip',
        'sourceArchiveSha256': digest, 'originalSurveyPaper': ORIGINAL_PAPER,
        'license': 'CC BY 4.0',
        'credit': ('Romio et al. (2026), Pyroduct Digital Catalog v3.0; '
                   'original La Corona survey by VIGEA, published by Tomasi et al. (2022)'),
        'method': ('Read the 74 ES.LNZ.00 TXT outlines in catalog order; remove three repeated '
                   'curve-fitting vertices; subtract each outline minimum X and Y; calculate '
                   'width, height, and shoelace polygon area in meters.'),
        'caveats': [
            'The catalog sections are digitized 2-D drawings, not the restricted raw 3-D survey.',
            'Their drawing coordinates do not locate a section along the tube or on the Earth DEM.',
            'No section-specific ceiling-to-surface distance, roof stability, or traversable path is known.',
            'Reported shape dimensions are descriptive, not rover clearance or a planetary measurement.',
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True, help='Downloaded Pyroduct v3 ZIP')
    parser.add_argument('--output', type=Path,
                        default=Path('assets/data/m4/la-corona-cave-sections.json'))
    args = parser.parse_args()
    result = extract(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=args.output.parent,
                                     prefix='.m4-cave-', suffix='.json', delete=False) as temp:
        json.dump(result, temp, ensure_ascii=False, separators=(',', ':'))
        temp.write('\n')
        temp_path = Path(temp.name)
    temp_path.replace(args.output)
    print(f'{args.output}: {result["sectionCount"]} sections, '
          f'SHA-256 {result["sourceArchiveSha256"]}')


if __name__ == '__main__':
    main()
