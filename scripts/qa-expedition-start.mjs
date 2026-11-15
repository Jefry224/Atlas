// Browser regression using the real UI and published DEM; requires an existing Playwright installation.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = process.env.EXPEDITION_QA_OUTPUT || '/tmp/atlas-expedition-ux';
const base = process.env.EXPEDITION_QA_URL || 'http://127.0.0.1:8259/';
const webgl = process.env.EXPEDITION_QA_WEBGL === '1';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.stack || e.message));
await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
await page.addInitScript(() => {
  window.expeditionBlobs = [];
  const create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = blob => { window.expeditionBlobs.push(blob); return create(blob); };
});
const check = (name, valid = true) => { assert.ok(valid, name); checks.push(name); console.log('PASS', name); };
const phase = value => page.waitForFunction(value => document.querySelector('#earth-expedition')?.dataset.phase === value, value, { timeout: 30000 });
const click = selector => page.locator(selector).click();
const report = () => page.evaluate(async () => {
  const count = window.expeditionBlobs.length;
  document.querySelector('[data-exp-export="json"]').click();
  return JSON.parse(await window.expeditionBlobs[count].text());
});
async function fill(selector, value) {
  await page.locator(selector).fill(String(value));
  await page.locator(selector).dispatchEvent('change');
}
async function confirm() {
  await click('[data-exp-step="3"]');
  check('Review requires explicit acknowledgement', await page.locator('[data-exp-confirm]').isDisabled());
  await page.locator('#exp-reviewed').check();
  await click('[data-exp-confirm]');
  await phase('ready');
  check('Confirmation focuses Start expedition', await page.evaluate(() => document.activeElement.matches('[data-exp-play]')));
}
try {
  await page.goto(new URL(webgl ? '' : '?qa=webgl', base).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.scenario-button').length === 4);
  await click('[data-site="atacama"]');
  await click('#view-terrain');
  await phase('draft');
  if (webgl) check('The 3D renderer is active without the fallback', await page.locator('#scene-fallback').isHidden() && await page.locator('#atlas-scene').isVisible());
  await fill('[data-exp-input="slopeLimitDeg"]', 30);
  await click('[data-exp-step="2"]');
  while (await page.locator('[data-exp-stop]').count() > 2) {
    await click('[data-exp-stop="2"]');
    await page.getByRole('button', { name: 'Remove stop', exact: true }).click();
  }
  for (const [i, x] of [[0, -75], [1, 0]]) {
    await click(`[data-exp-stop="${i}"]`);
    await fill('[data-exp-input="stop-x"]', x);
    await fill('[data-exp-input="stop-z"]', 0);
  }
  await page.getByRole('button', { name: '+ Add stop', exact: true }).click();
  await fill('[data-exp-input="stop-x"]', 75);
  await fill('[data-exp-input="stop-z"]', 0);
  await confirm();
  const ready = await report();
  check('Confirmed rover is held with no time or evidence', ready.inspections.length === 0 && ready.rover.simSeconds === 0 && !ready.startedAtUTC);
  await page.locator('#earth-expedition').screenshot({ path: `${out}/desktop-ready.png` });
  await click('[data-exp-play]');
  await phase('running');
  await page.waitForFunction(() => parseFloat(document.querySelector('[data-exp-metrics]').textContent) > 3);
  const started = await report();
  check('One Start moves the real rover without Inspect or Resume', started.rover.distanceM > 3 && started.inspections.length === 1 && started.inspections[0].recordingMethod === 'departure-baseline');
  await click('[data-exp-play]');
  await phase('paused');
  const paused = await report();
  await page.waitForTimeout(500);
  const held = await report();
  check('Pause freezes rover, time and energy', JSON.stringify(paused.rover) === JSON.stringify(held.rover) && JSON.stringify(paused.observations) === JSON.stringify(held.observations));
  await click('#mission-play');
  await phase('running');
  await phase('inspection');
  check('Arrival offers one relevant primary action', await page.locator('[data-exp-primary]').count() === 1 && await page.locator('[data-exp-inspect]').innerText() === 'Inspect & continue');
  await page.locator('.exp-inspection-note summary').click();
  await page.locator('[data-exp-note]').fill('Validate this terrain with field lidar.');
  await click('#view-globe');
  await click('#view-terrain');
  await phase('inspection');
  check('Inspection note survives leaving and returning to the expedition', await page.locator('[data-exp-note]').inputValue() === 'Validate this terrain with field lidar.');
  await page.locator('#earth-expedition').screenshot({ path: `${out}/desktop-inspection.png` });
  await click('[data-exp-inspect]');
  await phase('running');
  const continued = await report();
  check('Inspect & continue records the note and resumes in one click', continued.inspections.length === 2 && continued.inspections[1].note === 'Validate this terrain with field lidar.' && continued.inspections[1].recordingMethod === 'operator-inspection');
  await phase('inspection');
  check('Last stop clearly offers the final inspection', await page.locator('[data-exp-inspect]').innerText() === 'Record final inspection' && await page.locator('[data-exp-inspect-stay]').count() === 0);
  await click('[data-exp-inspect]');
  await phase('review');
  check('Final inspection focuses report closure', await page.evaluate(() => document.activeElement.matches('[data-exp-finish]')));
  await click('[data-exp-finish]');
  await phase('finished');
  const finished = await report();
  check('Closed report contains baseline and both explicit inspections', finished.inspections.length === 3 && finished.decision.status === 'Advance to targeted validation');
  await writeFile(`${out}/completed.json`, JSON.stringify(finished, null, 2));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Reset & revise preparation', exact: true }).click();
  await phase('draft');
  await confirm();
  check('Mobile shows the primary action before the map', await page.evaluate(() => document.querySelector('[data-exp-play]').getBoundingClientRect().top < document.querySelector('[data-exp-map]').getBoundingClientRect().top));
  check('Mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#earth-expedition').screenshot({ path: `${out}/mobile-ready.png` });
  await click('#pilot-manual');
  await click('[data-exp-play]');
  await phase('running');
  const manual = await report();
  await page.waitForTimeout(400);
  const manualHeld = await report();
  check('Manual start stays under operator control with clear guidance', manualHeld.rover.distanceM === manual.rover.distanceM && manualHeld.rover.mode === 'manual' && (await page.locator('[data-exp-guidance]').innerText()).includes('Drive to stop 2'));
  await click('[data-exp-play]');
  await click('#pilot-auto');
  await click('[data-exp-play]');
  await phase('inspection');
  await click('[data-exp-inspect-stay]');
  await phase('paused');
  const stay = await report();
  await page.waitForTimeout(300);
  check('Record & stay paused preserves an explicit hold', (await report()).rover.distanceM === stay.rover.distanceM && stay.inspections.length === 2);
  await click('[data-exp-finish]');
  await phase('finished');
  check('Finishing early keeps an honest incomplete decision', (await report()).decision.status === 'Revise the reconnaissance plan');
  check('No uncaught browser errors', errors.length === 0);
  await writeFile(`${out}/results.json`, JSON.stringify({ passed: checks.length, checks, errors, webgl, scope: 'Actual Mission Control UI; published Earth DEM; local weather archives; desktop and mobile; no external providers.' }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, out }));
} catch (error) {
  await writeFile(`${out}/failure.json`, JSON.stringify({ message: error.message, errors, checks }, null, 2));
  try { await page.screenshot({ path: `${out}/failure.png`, fullPage: true, timeout: 5000 }); } catch { /* Preserve the original failure if the browser is unavailable. */ }
  throw error;
} finally { await browser.close(); }
