import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { compareTerrain } from '../similarity.mjs';

// scripts/terrain_metrics.geometric_index (used by scripts/analog_match.py to choose scenario windows)
// must give exactly the index that similarity.mjs shows in the interface.
const python = ['python3', 'python'].find((cmd) => { try { execFileSync(cmd, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } });
const KEYS = ['slopeP50Deg', 'slopeP90Deg', 'reliefP95P5M', 'triMeanM'];

function pyIndex(pairs) {
  const code = 'import json,sys; sys.path.insert(0, "scripts"); from terrain_metrics import geometric_index as g; '
    + 'print(json.dumps([g(a, b) for a, b in json.load(sys.stdin)]))';
  return JSON.parse(execFileSync(python, ['-c', code], { input: JSON.stringify(pairs) }).toString());
}

test('Python preserves the UI reduction at a half-integer floating-point boundary', { skip: !python && 'python3 not available' }, () => {
  const earth = { slopeP50Deg: 29.41, slopeP90Deg: 42.26, reliefP95P5M: 782.99, triMeanM: 13.86 };
  const target = { slopeP50Deg: 9.95, slopeP90Deg: 32.52, reliefP95P5M: 534.52, triMeanM: 12.19 };
  assert.equal(compareTerrain(earth, target).index, 62);
  assert.equal(pyIndex([[earth, target]])[0], 62);
});

test('geometric_index (Python) = compareTerrain (JS)', { skip: !python && 'python3 not available' }, () => {
  const scenarios = JSON.parse(readFileSync('assets/data/scenarios.json', 'utf8')).scenarios;
  const pairs = scenarios.map((s) => [s.earth, s.target].map((p) => JSON.parse(readFileSync(p, 'utf8')).metrics));
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) {
    const m = () => ({ slopeP50Deg: +(rnd() * 30).toFixed(2), slopeP90Deg: +(rnd() * 50).toFixed(2), reliefP95P5M: +(rnd() * 900).toFixed(2), triMeanM: +(rnd() * 15).toFixed(2) });
    pairs.push([m(), m()]);
  }
  pairs.push([{ slopeP50Deg: 0, slopeP90Deg: 0.05, reliefP95P5M: 0, triMeanM: 0 }, { slopeP50Deg: 0.1, slopeP90Deg: 0, reliefP95P5M: 0.5, triMeanM: 0.01 }]);
  const strip = (m) => Object.fromEntries(KEYS.map((k) => [k, m[k]]));
  const py = pyIndex(pairs.map(([a, b]) => [strip(a), strip(b)]));
  pairs.forEach(([a, b], i) => assert.equal(py[i], compareTerrain(strip(a), strip(b)).index, JSON.stringify([a, b])));
});
