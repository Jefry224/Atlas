import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const crop = JSON.parse(readFileSync(new URL('../assets/data/m4/marius-pit-dtm.json', import.meta.url)));

test('published Marius pit crop retains native geometry and unknown elevation', () => {
  assert.equal(crop.schema, 'M4SurfaceDtmCrop');
  assert.equal(crop.product, 'NAC_DTM_MARIUSPIT01');
  assert.equal(crop.kind, 'published-surface-dtm-crop');
  assert.equal(crop.gridSize, 101);
  assert.equal(crop.spacingMeters, 4);
  assert.equal(crop.extentMeters, 400);
  assert.equal(crop.sourceWindow.width, 101);
  assert.equal(crop.sourceWindow.height, 101);
  assert.equal(crop.elevation.length, 101 * 101);
  assert.equal(crop.nodataCount, crop.elevation.filter(value => value === null).length);
  assert.ok(crop.nodataCount > 0);
  assert.ok(crop.elevation.filter(Number.isFinite).length > 9000);
  assert.ok(crop.elevation.every(value => value === null || Number.isFinite(value)));
  assert.ok(crop.elevation.every(value => value === null || value > -10000));
  assert.ok(crop.pitCell.row > 48 && crop.pitCell.row < 52);
  assert.ok(crop.pitCell.col > 48 && crop.pitCell.col < 52);
  assert.deepEqual(crop.pitLocation, [14.0917, -56.7701]);
  assert.match(crop.source, /^https:\/\/pds\.lroc\.im-ldi\.com\//);
  assert.match(crop.sourceSha256, /^[0-9a-f]{64}$/);
  assert.ok(crop.caveats.some(text => /not an underground survey/.test(text)));
});
