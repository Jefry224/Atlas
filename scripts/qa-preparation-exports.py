#!/usr/bin/env python3
"""Validate real UI downloads without recreating the workbook or requiring packages."""
import json
import sys
import zipfile
import xml.etree.ElementTree as XML
from pathlib import Path

root = Path(__file__).resolve().parents[1]
prefix = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'docs/evidencias/preparacion-rendimiento/preparacion-personalizada'
mission = json.loads(Path(str(prefix) + '-mission.json').read_text())
dossier = json.loads(Path(str(prefix) + '-dossier.json').read_text())
confirmation = mission['preparation']
identity = confirmation['identity']
session_id = confirmation['sessionId']
assert session_id == mission['landing']['missionId'] == dossier['mission']['id'] == dossier['landing']['missionId']
events = [event for event in dossier['mission']['events'] if event['type'] == 'preparation-confirmed']
assert events
event_identity = json.loads(events[-1]['detail'])
assert event_identity['sessionId'] == session_id
assert all(event_identity[key] == value for key, value in identity.items())
for flight in [mission['landing'], dossier['landing']]:
    assert flight['scenarioId'] == identity['scenarioId']
    assert flight['plans']['target']['selectedId'] == identity['zoneId']
    assert flight['history'][0]['target']['propellantKg'] == identity['propellantKg']
    assert flight['runs']['earth'] is None

namespace = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
xlsx_path = Path(str(prefix) + '.xlsx')
with zipfile.ZipFile(xlsx_path) as archive:
    sheets = [sheet.attrib['name'] for sheet in XML.fromstring(archive.read('xl/workbook.xml')).findall('m:sheets/m:sheet', namespace)]
    assert len(sheets) == 15
    assert sheets[-3:] == ['Descenso', 'Trayectoria', 'Zona_ensayo']
    index = sheets.index('Limites_eventos') + 1
    rows = XML.fromstring(archive.read(f'xl/worksheets/sheet{index}.xml')).findall('.//m:row', namespace)
    values = [[''.join(cell.itertext()) for cell in row] for row in rows]
    xlsx_events = [row for row in values if row and row[0] == 'preparation-confirmed']
    assert xlsx_events
    xlsx_identity = json.loads(xlsx_events[-1][3])
    assert xlsx_identity == event_identity

result = {'validator': 'UI JSON + dossier + XLSX XML, sin reconstruir reportes', 'sheets': sheets,
          'sessionId': session_id, 'zoneId': identity['zoneId'], 'fuelPercent': identity['fuelPercent'],
          'propellantKg': identity['propellantKg'], 'initialMassKg': identity['initialMassKg'],
          'eventInXlsx': True, 'sameSession': True, 'xlsxBytes': xlsx_path.stat().st_size}
(prefix.parent / 'exportacion-validada.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
