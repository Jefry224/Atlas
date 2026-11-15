// Evaluate in the dossier page with Orca; all provider responses are local QA mocks.
(async () => {
  const originalFetch = window.fetch;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  const originalCreateURL = URL.createObjectURL;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
  const select = document.querySelector('#scenario-select');
  const generate = document.querySelector('#generate-dossier');
  const requests = [], checks = [], blobs = new Map();
  let delayedFailure = false, missingEarth = false, slowPolar = true, download, archivedWeather = null, malformedForecast = false;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const capture = () => ({
    selected: select.value, summary: document.querySelector('#context-summary').textContent,
    status: document.querySelector('#dossier-status').textContent,
    output: document.querySelector('#dossier-output').textContent,
    generateDisabled: generate.disabled,
    busy: document.querySelector('.dossier-document').getAttribute('aria-busy'),
    loaderHidden: document.querySelector('#generation-loader').hidden,
    downloadDisabled: document.querySelector('#download-markdown').disabled,
  });
  const waitFor = async predicate => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (Date.now() > deadline) throw new Error('QA condition timed out'); await delay(10); }
  };
  const change = id => { select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })); };
  const ready = async id => { change(id); await waitFor(() => !generate.disabled); };
  const complete = index => requests[index].resolve(json({
    markdown: `# LOCAL QA MOCK: ${requests[index].scenarioId}`,
    provider: 'local-qa-mock', model: null, generatedAt: '2026-11-15T08:00:00Z',
    disclaimer: 'Local QA mock; no external AI request was made.',
  }));
  window.fetch = async (resource, options) => {
    const url = String(resource);
    if (url.includes('/api/telemetry?') || url.includes('/api/processes/forecast?')) {
      const site = new URL(url, location.href).searchParams.get('site');
      if (url.includes('/api/processes/forecast?') && malformedForecast) return json({ hours: { unavailable: true } });
      const value = archivedWeather?.[url.includes('/api/telemetry?') ? 'telemetry' : 'forecast']?.[site];
      return json(value ? { ...value, provider: 'snapshot', live: false } : null);
    }
    if (url === '/api/dossier') {
      const body = JSON.parse(options.body);
      return new Promise((resolve, reject) => requests.push({
        scenarioId: body.context.scenario.id, earthId: body.context.earth.id, targetId: body.context.target.id,
        signal: options.signal, resolve, reject,
      })); // Deliberately ignores abort, testing stale success/error/finally guards.
    }
    if (slowPolar && url.endsWith('/earth/wright-valley.json')) await delay(1200);
    if (url.endsWith('/earth/la-corona.json')) {
      if (missingEarth) throw new Error('Local QA missing DEM');
      if (delayedFailure) { await delay(400); throw new Error('Local QA stale DEM failure'); }
    }
    return originalFetch(resource, options);
  };
  URL.createObjectURL = function (blob) { const url = originalCreateURL.call(URL, blob); blobs.set(url, blob); return url; };
  HTMLAnchorElement.prototype.click = function () { download = { filename: this.download, blob: blobs.get(this.href) }; };
  try {
    // Same delayed Wright Valley -> Atacama sequence as the coordinator's baseline reproduction.
    change('polar-shadow');
    const loading = capture();
    generate.dispatchEvent(new Event('click'));
    assert(loading.generateDisabled && loading.downloadDisabled, 'Loading must gate generation and downloads');
    assert(!loading.summary.includes('Atacama') && !loading.summary.includes('Jezero'), 'Loading retained stale context');
    await delay(30); change('hyperarid-salt');
    await waitFor(() => !generate.disabled); await delay(1400);
    const corrected = capture();
    assert(corrected.selected === 'hyperarid-salt' && corrected.summary.includes('Atacama') && corrected.summary.includes('Jezero'), 'Late polar load replaced the selected pair');
    assert(!corrected.summary.includes('Wright Valley') && corrected.status.includes('Module 3 processes: unavailable'), 'Summary/status falsely reports stale or missing evidence');
    assert(requests.length === 0, 'Generation ran while loading');
    checks.push({ name: 'reverse terrain completion and loading gate', passed: true, loading, corrected });
    slowPolar = false;

    await ready('lava-tube'); generate.click(); await waitFor(() => requests.length === 1);
    await ready('hyperarid-salt'); generate.click(); await waitFor(() => requests.length === 2);
    assert(requests[0].signal.aborted, 'Switch did not cancel the old generation');
    complete(0); await delay(30);
    const duringNew = capture();
    assert(duringNew.busy === 'true' && duringNew.generateDisabled && !duringNew.loaderHidden, 'Old success/finally cleared the newer loader');
    assert(!duringNew.output.includes('LOCAL QA MOCK'), 'Old document appeared under the new pair');
    complete(1); await waitFor(() => capture().busy === 'false');
    assert(capture().output.includes('hyperarid-salt'), 'Current response did not publish');
    checks.push({ name: 'old provider success/finally during new generation', passed: true, duringNew, completed: capture() });

    await ready('lava-tube'); generate.click(); await waitFor(() => requests.length === 3);
    await ready('wind-canyon'); generate.click(); await waitFor(() => requests.length === 4);
    requests[2].reject(new Error('Local QA stale provider failure')); await delay(30);
    const afterOldError = capture();
    assert(afterOldError.busy === 'true' && afterOldError.status.includes('Generating'), 'Old error/finally disrupted the newer request');
    complete(3); await waitFor(() => capture().busy === 'false');
    document.querySelector('#download-markdown').click();
    const markdown = await download.blob.text();
    assert(download.filename === 'selene-ops-mission-dossier-wind-canyon.md' && markdown.includes('wind-canyon'), 'Download filename/content identity diverged');
    checks.push({ name: 'old provider error/finally and matching Markdown download', passed: true, afterOldError, filename: download.filename, markdown });

    missingEarth = true; change('lava-tube');
    await waitFor(() => capture().status.includes('cannot be generated safely'));
    const failure = capture(); generate.dispatchEvent(new Event('click')); await delay(30);
    assert(failure.generateDisabled && failure.downloadDisabled && requests.length === 4, 'Failed terrain allowed stale generation/export');
    assert(!failure.output.includes('LOCAL QA MOCK'), 'Failed terrain retained old output');
    checks.push({ name: 'current terrain failure clears context/output and blocks generation', passed: true, failure });
    missingEarth = false;

    delayedFailure = true; change('lava-tube'); await delay(30); await ready('hyperarid-salt'); await delay(500);
    assert(capture().status.includes('Scenario context is ready') && capture().summary.includes('Atacama'), 'Late terrain error replaced ready state');
    checks.push({ name: 'late terrain failure cannot replace a newer ready state', passed: true, current: capture() });
    delayedFailure = false;

    const discovery = [...select.options].find(option => option.dataset.kind === 'discovery');
    assert(discovery, 'Remote Discovery options were lost');
    await ready(discovery.value);
    assert(capture().status.includes('Module 2 audit: included') && capture().status.includes('Module 3 processes: unavailable'), 'Discovery or availability status regressed');
    checks.push({ name: 'remote Discovery selection retains valid context and honest module status', passed: true, current: capture() });
    archivedWeather = {
      telemetry: await (await originalFetch('assets/data/telemetry-snapshot.json')).json(),
      forecast: await (await originalFetch('assets/data/processes-forecast-snapshot.json')).json(),
    };
    await ready('hyperarid-salt');
    assert(capture().status.includes('Module 3 processes: included') && capture().summary.includes('Archived or modelled weather data'), 'Available archived process evidence was omitted or called current');
    checks.push({ name: 'archived process evidence is included and labelled honestly', passed: true, current: capture() });
    malformedForecast = true;
    await ready('hyperarid-salt');
    assert(capture().status.includes('Module 3 processes: unavailable') && capture().status.includes('Module 2 audit: included'), 'Malformed optional forecast incorrectly blocked valid terrain context');
    checks.push({ name: 'malformed optional forecast stays unavailable without blocking valid terrain', passed: true, current: capture() });
    return JSON.stringify({ passed: true, scope: 'Actual dossier UI; published DEMs; null optional weather; local provider mocks only', checks,
      requests: requests.map(({ scenarioId, earthId, targetId, signal }) => ({ scenarioId, earthId, targetId, aborted: signal.aborted })),
    });
  } finally {
    window.fetch = originalFetch; HTMLAnchorElement.prototype.click = originalAnchorClick; URL.createObjectURL = originalCreateURL;
  }
})()
