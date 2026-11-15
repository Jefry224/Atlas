import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDossierContext } from '../dossier-context.mjs';

test('dossier context keeps evidence summaries and omits raw elevation arrays', () => {
  const context = buildDossierContext({
    scenario: { id: 'demo', title: 'Demo', body: 'moon' },
    earthGrid: { id: 'earth', elevation: [1, 2], metrics: { slopeP90Deg: 8 }, provenance: [] },
    targetGrid: { id: 'target', elevation: [3, 4], metrics: { slopeP90Deg: 4 }, provenance: [] },
  });
  assert.equal(context.scenario.id, 'demo');
  assert.equal(context.earth.metrics.slopeP90Deg, 8);
  assert.equal('elevation' in context.earth, false);
  assert.equal(context.hazards, null);
});

test('dossier context preserves supplied M2 and M3 summaries while leaving hazards unavailable', () => {
  const context = buildDossierContext({
    scenario: { id: 'demo', title: 'Demo', body: 'moon' },
    analogyAudit: { valid: true, matrix: [{ id: 'gravity', status: 'breakdown', strength: 'Measured' }] },
    processes: { best: { kind: 'cold' } },
  });
  assert.equal(context.analogyAudit.valid, true);
  assert.equal(context.processes.best.kind, 'cold');
  assert.equal(context.hazards, null);
  assert.equal(context.unavailableModules.some((item) => item.includes('Module 4')), true);
});
