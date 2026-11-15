import test from 'node:test';
import assert from 'node:assert/strict';
import { createDossierSession, dossierModuleAvailability } from '../src/dossier/dossier-session.mjs';

const pair = id => ({ id, earthId: `earth-${id}`, targetId: `target-${id}`, body: 'moon' });
const context = (scenario, marker = scenario.id) => ({ scenario, earth: { id: scenario.earthId }, target: { id: scenario.targetId }, marker });
const dossier = markdown => ({ markdown, generatedAt: '2026-11-15T08:00:00Z', disclaimer: 'Supplied evidence only.' });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('reverse-completing scenario loads publish only the selected pair and gate generation while loading', async () => {
  const a = pair('polar-shadow'), b = pair('hyperarid-salt'), loads = [], providerCalls = [];
  const session = createDossierSession({
    loadContext: (scenario, { signal }) => { const pending = deferred(); loads.push({ scenario, signal, ...pending }); return pending.promise; },
    generateDossier: async c => { providerCalls.push(c); return dossier(c.scenario.id); },
  });
  const first = session.select(a);
  assert.equal(await session.generate(), false);
  const second = session.select(b);
  assert.equal(loads[0].signal.aborted, true);
  assert.equal(session.state.context, null);
  assert.equal(session.state.loading, true);
  loads[1].resolve(context(b)); await second;
  loads[0].resolve(context(a)); await first; // Transport deliberately ignores abort.
  assert.equal(session.state.scenario.id, b.id);
  assert.deepEqual(session.state.context, context(b));
  assert.equal(session.state.loading, false);
  assert.equal(providerCalls.length, 0);
  assert.equal(await session.generate(), true);
  assert.equal(providerCalls[0].scenario.id, b.id);
});

test('reselecting the same scenario still discards its previous context and output', async () => {
  const selected = pair('same'), pending = deferred(); let loads = 0;
  const session = createDossierSession({
    loadContext: async s => ++loads === 2 ? pending.promise : context(s, loads),
    generateDossier: async () => dossier('old result'),
  });
  await session.select(selected); await session.generate();
  const old = session.select(selected);
  assert.equal(session.state.context, null); assert.equal(session.state.dossier, null);
  await session.select(selected);
  pending.resolve(context(selected, 'stale same-ID result')); await old;
  assert.equal(session.state.context.marker, 3);
});

test('a stale terrain error cannot replace the status or loading state of a newer selection', async () => {
  const a = pair('a'), b = pair('b'), loads = [];
  const session = createDossierSession({
    loadContext: () => { const next = deferred(); loads.push(next); return next.promise; },
  });
  const old = session.select(a), current = session.select(b);
  loads[0].reject(new Error('old terrain failed')); await old;
  assert.equal(session.state.loading, true); assert.equal(session.state.error, null);
  loads[1].resolve(context(b)); await current;
  assert.equal(session.state.context.scenario.id, 'b'); assert.equal(session.state.error, null);
});

test('current terrain failures or mixed grid identities leave no generatable context', async () => {
  const selected = pair('selected'); let providerCalls = 0;
  for (const loadContext of [async () => { throw new Error('missing DEM'); }, async () => context(pair('other'))]) {
    const session = createDossierSession({ loadContext, generateDossier: () => { providerCalls++; } });
    assert.equal(await session.select(selected), false);
    assert.equal(session.state.context, null); assert.equal(session.state.loading, false);
    assert.equal(session.state.errorStage, 'load');
    assert.equal(await session.generate(), false);
  }
  assert.equal(providerCalls, 0);
});

for (const completion of ['success', 'error']) {
  test(`a superseded generation ${completion} and its finally cannot alter a newer request`, async () => {
    const requests = [], session = createDossierSession({
      loadContext: async s => context(s),
      generateDossier: (c, { signal }) => { const next = deferred(); requests.push({ context: c, signal, ...next }); return next.promise; },
    });
    await session.select(pair('a'));
    const old = session.generate();
    await session.select(pair('b'));
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(session.state.dossier, null);
    const current = session.generate();
    if (completion === 'success') requests[0].resolve(dossier('stale A document'));
    else requests[0].reject(new Error('stale A provider failure'));
    assert.equal(await old, false);
    assert.equal(session.state.busy, true); assert.equal(session.state.error, null); assert.equal(session.state.dossier, null);
    requests[1].resolve(dossier('B document')); assert.equal(await current, true);
    assert.equal(session.state.busy, false); assert.equal(session.state.error, null);
    assert.equal(session.state.dossier.markdown, 'B document'); assert.equal(session.state.dossier.scenarioId, 'b');
  });
}

test('generation captures its evidence and filename identity and prevents duplicate provider calls', async () => {
  const pending = deferred(), selected = pair('captured'); let request, calls = 0;
  const session = createDossierSession({
    loadContext: async s => context(s),
    generateDossier: c => { request = c; calls++; return pending.promise; },
  });

  test('generation forwards optional user-provided context without changing factual scenario context', async () => {
    const selected = pair('notes'); let request, options;
    const session = createDossierSession({
      loadContext: async s => context(s),
      generateDossier: async (c, o) => { request = c; options = o; return dossier('notes included'); },
    });
    await session.select(selected);
    assert.equal(await session.generate('Prioritize the northern ridge.'), true);
    assert.deepEqual(request, context(selected));
    assert.equal(options.userNotes, 'Prioritize the northern ridge.');
  });
  await session.select(selected); selected.id = 'external mutation';
  const generating = session.generate();
  assert.equal(await session.generate(), false);
  session.state.context.marker = 'changed after request';
  assert.equal(request.marker, 'captured'); assert.equal(request.scenario.id, 'captured');
  pending.resolve({ ...dossier('captured document'), scenarioId: 'provider cannot rename the selection' });
  await generating;
  assert.equal(calls, 1); assert.equal(session.state.dossier.scenarioId, 'captured');
});

test('current provider failure ends the loader and permits retry using the same ready context', async () => {
  let calls = 0;
  const session = createDossierSession({
    loadContext: async s => context(s),
    generateDossier: async () => { if (++calls === 1) throw new Error('provider unavailable'); return dossier('retry result'); },
  });
  await session.select(pair('retry'));
  assert.equal(await session.generate(), false);
  assert.equal(session.state.busy, false); assert.equal(session.state.errorStage, 'generate');
  assert.equal(await session.generate(), true); assert.equal(session.state.error, null);
});

test('module availability reports absent process evidence and invalid audits as unavailable', () => {
  assert.deepEqual(dossierModuleAvailability({ analogyAudit: { valid: false }, processes: null }), { audit: false, processes: false });
  assert.deepEqual(dossierModuleAvailability({ analogyAudit: { valid: true }, processes: { thermalWindows: [] } }), { audit: true, processes: true });
});
