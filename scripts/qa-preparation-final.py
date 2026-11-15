#!/usr/bin/env python3
"""Run remaining real-browser checks sequentially on one selected Orca page."""
import json
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root / 'docs/evidencias/preparacion-rendimiento'
out.mkdir(parents=True, exist_ok=True)
result_path = out / 'qa-final-run.json'
results = {'page': sys.argv[1], 'url': sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8031/', 'modes': {}, 'complete': False}
if '--resume' in sys.argv and result_path.exists():
    previous = json.loads(result_path.read_text())
    if previous['page'] == results['page']:
        results['modes'] = previous['modes']
for mode in ['visual', 'mobile', 'fallback', 'motion', 'extras']:
    if results['modes'].get(mode, {}).get('exitCode') == 0:
        continue
    results['active'] = mode
    result_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    with (out / f'qa-{mode}.log').open('w') as log:
        process = subprocess.run([sys.executable, str(root / 'scripts/qa-target-mission.py'), results['page'], results['url'], f'--{mode}-only'], stdout=log, stderr=subprocess.STDOUT)
    results['modes'][mode] = {'exitCode': process.returncode, 'log': f'qa-{mode}.log'}
    result_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    if process.returncode:
        sys.exit(process.returncode)
results['complete'] = True
results['active'] = None
result_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps(results, ensure_ascii=False))
