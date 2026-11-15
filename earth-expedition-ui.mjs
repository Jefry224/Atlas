// Scoped DOM adapter; destination landing and M2 tracking are never inputs to this controller.
import { createExpedition, OBJECTIVES, LIMITATIONS, evaluatePlan, confirmExpedition, startExpedition,
  pauseExpedition, advanceExpedition, setExpeditionMode, inspectStop, finishExpedition, expeditionDecision, expeditionReport,
  expeditionMarkdown, expeditionContext, answerExpedition, demIdentity } from './earth-expedition.mjs';
import { validGrid, gridExtent, roverLimit, sampleHeight, elevationRange } from './mission-math.mjs';
const ns = 'http://www.w3.org/2000/svg';
const n = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : 'unavailable';
const make = (tag, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; if (cls) node.className = cls; return node; };
const button = (text, action, cls = '') => { const b = make('button', text, cls); b.type = 'button'; b.addEventListener('click', action); return b; };
const link = (text, url) => { const a = make('a', text); try { const parsed = new URL(url); if (['https:', 'http:'].includes(parsed.protocol)) a.href = parsed.href; } catch { /* Missing source stays unlinked. */ } a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
const set = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
const field = (label, control) => { const box = make('label', '', 'exp-field'); box.append(make('span', label), control); return box; };
const phases = { draft: 'Prepare', ready: 'Confirmed · ready', running: 'Traverse in progress', paused: 'Paused · continue when ready', inspection: 'At stop · inspection required', review: 'All stops inspected · review evidence', blocked: 'Stopped by constraint', finished: 'Expedition complete' };

export function createEarthExpedition(root, { onState, getTelemetry = () => null, getSurfaceAssessment = () => null, onDirector = () => {}, onBenchmark = () => {}, getReferences = () => [], onSelectReference = () => {}, onFocusScene = () => {}, announce = () => {} } = {}) {
  let session = null, visible = false, step = 1, selected = 0, error = '', reviewed = false, lastTick = 0, lastPhase = '', map = null, inspectionNote = '';
  let contextKey = null, sourceContext = null, evaluation = null;
  const archive = [];
  const state = () => ({ rover: session?.rover, running: session?.phase === 'running', started: Boolean(session?.startedAtUTC), phase: session?.phase || 'loading', mode:session?.activeMode||'auto' });
  function notify() { onState?.({ ...state(), stops: session?.stops || [] }); }
  function terrainPlan() { return evaluation ||= evaluatePlan(session.grid, session.config, session.stops); }
  function captureEnvironment() { if(session&&session.phase!=='finished'){session.latestTelemetry=getTelemetry(session.site.id,session.grid?.center);session.surfaceAssessment=getSurfaceAssessment(session.sessionId);} }
  function status(message) { error = message; announce(message); render(); }
  function download(format, report = null) {
    if (!report) { captureEnvironment(); report = expeditionReport(session); }
    const text = format === 'md' ? expeditionMarkdown(report) : JSON.stringify(report, null, 2);
    const blob = new Blob([text], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json' });
    const url = URL.createObjectURL(blob), a = make('a');
    a.href = url; a.download = `earth-expedition-${report.site.id}-${report.sessionId.slice(-8)}.${format}`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    announce(`Earth expedition ${format.toUpperCase()} report downloaded.`);
  }
  function archiveCurrent() {
    if (session?.startedAtUTC) { captureEnvironment(); if (session.phase !== 'finished') finishExpedition(session); archive.unshift(expeditionReport(session)); if (archive.length > 3) archive.pop(); }
  }
  function reset({ keepPlan = true } = {}) {
    if (!sourceContext || (keepPlan && root.dataset.phase==='loading')) return;
    archiveCurrent();
    session = createExpedition({ ...sourceContext, ...(keepPlan && session ? { config: session.config, stops: session.stops } : {}) });
    step = 1; selected = 0; reviewed = false; error = ''; inspectionNote = ''; evaluation = null; root.dataset.sessionId=session.sessionId;root.dataset.siteId=session.site.id;root.dataset.phase=session.phase; notify(); render();
  }
  function changed() {
    reviewed = false; evaluation = null; error = '';
    notify(); render();
  }
  function inputNumber(key, value, min, max, increment = 1) {
    const input = make('input'); input.type = 'number'; input.value = value; input.min = min; input.max = max; input.step = increment; input.required = true;
    input.dataset.expInput = key;
    input.addEventListener('change', () => { session.config[key] = input.value === '' ? NaN : Number(input.value); changed(); });
    return input;
  }
  function sectionHeading(kicker, heading, text) {
    const box = make('div', '', 'exp-section-head'); box.append(make('p', kicker, 'exp-kicker'), make('h3', heading)); if (text) box.append(make('p', text)); return box;
  }
  function objectiveSection() {
    const box = make('div', '', 'exp-objective');
    const references=getReferences();
    if(references.length){
      const picker=make('select');picker.dataset.expReference='';
      const placeholder=make('option','Explore an existing paired Earth window…');placeholder.value='';picker.append(placeholder);
      for(const reference of references){const option=make('option',`${reference.earthLabel||reference.earthId} → ${reference.targetLabel||reference.targetId}`);option.value=reference.id;picker.append(option);}
      picker.addEventListener('change',()=>{const reference=references.find(item=>item.id===picker.value);if(reference)onSelectReference(reference);});
      box.append(field('Paired Earth DEM windows · catalogue sites remain in the site list',picker));
    }
    box.append(sectionHeading('01 / MISSION INTENT', 'What will Earth help you test?', 'Select the operational question and a conceptual payload. Every inspection records terrain context; no mineral or subsurface measurement is simulated.'));
    const select = make('select'); select.dataset.expInput = 'objective'; select.id = 'exp-objective';
    for (const [id, o] of Object.entries(OBJECTIVES)) { const option = make('option', o.title); option.value = id; option.selected = id === session.config.objective; select.append(option); }
    select.addEventListener('change', () => { session.config.objective = select.value; changed(); });
    box.append(field('Operational objective', select));
    const objective = OBJECTIVES[session.config.objective];
    box.append(make('p', objective.task, 'exp-task'),make('p',`Supports: ${objective.supports}`),make('p',`Unresolved: ${objective.unresolved}`));
    const equipment = make('div', '', 'exp-equipment'); equipment.append(make('strong', objective.equipment), make('p', 'Equipment concept only. Payload mass and active equipment affect the illustrative energy allowance. No instrument readings are invented.'));
    box.append(equipment);
    const fields = make('div', '', 'exp-fields');
    fields.append(field('Payload mass · kg', inputNumber('payloadKg', session.config.payloadKg, 0, 80)),
      field('Regional slope ceiling · °', inputNumber('slopeLimitDeg', session.config.slopeLimitDeg, 1, 30, .5)),
      field('SIM drive allowance · %', inputNumber('energyBudgetPct', session.config.energyBudgetPct, 1, 80, .5)));
    box.append(fields, make('p', 'Design limits are operator assumptions, not rover certification. Energy is an uncalibrated model at 0.8 m/s and SIM ×20; the estimate covers driving only. Scene weather presets affect rendering; sourced environment is recorded separately and does not drive this energy model.', 'exp-small'));
    const evidence = make('details', '', 'exp-source-details'); evidence.append(make('summary', 'Why this site? Documentary evidence & sources'));
    // shortcut: catalogue summaries and source labels retain their inherited language until catalogue localization.
    evidence.append(make('p', sourceContext.site.summary || 'Site context is documented by the source links below.'));
    for (const source of session.site.sources) evidence.append(link(source.label, source.url));
    box.append(evidence);
    return box;
  }
  function evidenceStrip() {
    const grid = session.grid, box = make('div', '', 'exp-dem-strip');
    if (!validGrid(grid)) { box.append(make('strong', 'Earth DEM unavailable'), make('p', 'Preparation and driving are blocked. The site sources remain accessible; switch site or retry DEM in Data & resources.')); return box; }
    box.append(make('strong', `${grid.gridSize} × ${grid.gridSize} · ${grid.spacingMeters} m grid spacing`),
      make('p', `${grid.nativeResolutionMeters || 'Unknown'} m native resolution · ${gridExtent(grid)} × ${gridExtent(grid)} m coverage · ${n(elevationRange(grid).relief)} m full-window elevation range`),
      link(grid.dataset || 'Published DEM', grid.source), make('small', `Fetched ${grid.fetchedAt || 'time unavailable'} · centre ${grid.center?.map(v => n(v, 5)).join(', ') || 'unavailable'} · elevation ×2 in 3D, true elevations in this map.`));
    if (sourceContext.fallbackNote) box.append(make('p', sourceContext.fallbackNote, 'exp-notice'));
    box.append(make('small', 'Grid spacing and native resolution differ. Interpolated slopes cannot reveal wheel-scale obstacles or validate access.'));
    return box;
  }
  function mapView(editable) {
    const container = make('div', '', 'exp-map-wrap');
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 360 300'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', editable ? 'Earth DEM traverse map. Arrow keys move the selected stop by one grid spacing; Enter applies numeric coordinates. Use the labeled coordinate inputs as an alternative.' : 'Earth DEM map with confirmed stops, the planned traverse, actual rover path and position.');
    svg.classList.add('exp-map'); svg.dataset.expMap = ''; if (editable) svg.tabIndex = 0;
    const base = document.createElementNS(ns, 'g'), overlay = document.createElementNS(ns, 'g'); svg.append(base, overlay);
    const grid = session.grid;
    function shape(tag, attrs, text, parent = base) { const s = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) s.setAttribute(key, value); if (text !== undefined) s.textContent = text; parent.append(s); return s; }
    const extent = gridExtent(grid), point = (x, z) => [30 + (x / extent + .5) * 300, (z / extent + .5) * 300];
    if (validGrid(grid)) {
      const range = elevationRange(grid), cells = Math.min(grid.gridSize - 1, 24), size = 300 / cells;
      for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
        const height = sampleHeight(grid, (c + .5) / cells * extent - extent / 2, (r + .5) / cells * extent - extent / 2);
        const t = (height - range.min) / Math.max(1, range.relief);
        shape('rect', { x: 30 + c * size, y: r * size, width: size + .3, height: size + .3, fill: `hsl(${175 - t * 115} 24% ${19 + t * 22}%)` });
      }
    } else shape('rect', { x: 30, y: 0, width: 300, height: 300, fill: '#10232b' });
    shape('text', { x: 12, y: 17, fill: '#e1f1ef', 'font-size': 12 }, 'N ↑');
    shape('text', { x: 334, y: 150, fill: '#e1f1ef', 'font-size': 12 }, 'E');
    const draw = () => {
      overlay.replaceChildren();
      shape('polyline', { points: session.stops.filter(s => Number.isFinite(s.x) && Number.isFinite(s.z)).map(s => point(s.x, s.z).join(',')).join(' '), fill: 'none', stroke: '#ffc778', 'stroke-width': 2, 'stroke-dasharray': '5 4' }, undefined, overlay);
      if (session.rover.path.length) shape('polyline', { points: session.rover.path.map(([x, z]) => point(x, z).join(',')).join(' '), fill: 'none', stroke: '#70f2c8', 'stroke-width': 3 }, undefined, overlay);
      session.stops.forEach((stop, i) => {
        if (!Number.isFinite(stop.x) || !Number.isFinite(stop.z)) return;
        const [cx, cy] = point(stop.x, stop.z);
        shape('circle', { cx, cy, r: selected === i && editable ? 10 : 8, fill: session.inspections.some(s => s.stopIndex === i) ? '#70f2c8' : '#ffc778', stroke: '#061825', 'stroke-width': 2 }, undefined, overlay);
        shape('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', fill: '#061825', 'font-size': 11, 'font-weight': 700 }, String(i + 1), overlay);
      });
      if (session.confirmedAtUTC) { const [cx, cy] = point(session.rover.x, session.rover.z); shape('circle', { cx, cy, r: 4, fill: '#fff', stroke: '#061825', 'stroke-width': 1 }, undefined, overlay); }
    };
    map = { draw };
    if (editable) {
      const relocate = (x, z) => { if (!validGrid(grid)) return; session.stops[selected].x = Math.round(x); session.stops[selected].z = Math.round(z); changed(); root.querySelector('[data-exp-map]')?.focus({ preventScroll: true }); };
      svg.addEventListener('click', event => { const rect = svg.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width * 360, y = (event.clientY - rect.top) / rect.height * 300; if (x >= 30 && x <= 330) relocate((x - 30) / 300 * extent - extent / 2, y / 300 * extent - extent / 2); });
      svg.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const stop = session.stops[selected], jump = grid?.spacingMeters || 300, limit = roverLimit(grid);
        relocate(Math.max(-limit, Math.min(limit, stop.x + (event.key === 'ArrowRight' ? jump : event.key === 'ArrowLeft' ? -jump : 0))), Math.max(-limit, Math.min(limit, stop.z + (event.key === 'ArrowDown' ? jump : event.key === 'ArrowUp' ? -jump : 0))));
      });
    }
    draw(); container.append(svg, make('p', 'Elevation tint: low teal → high sand · dashed amber: plan · mint: travelled · white: rover. N up; x east, z south.', 'exp-map-legend'));
    if (editable) container.append(make('p', 'Click the map or use its arrow keys to move the selected stop. Coordinates are metres from the actual DEM centre; stop 1 is the Earth rover start.', 'exp-small'));
    return container;
  }
  function traverseSection() {
    const box = make('div'); box.append(sectionHeading('02 / DEM RECONNAISSANCE', 'Build a terrain inspection traverse', 'Inspect distinct regional terrain cells. Stops are candidate observations, not confirmed samples, safe zones or a mapped cave entrance.'));
    box.append(evidenceStrip());
    const layout = make('div', '', 'exp-traverse-layout'); layout.append(mapView(true));
    const editor = make('div', '', 'exp-stop-editor');
    const list = make('ol', '', 'exp-stops');
    session.stops.forEach((stop, i) => { const li = make('li'); const b = button(`${i + 1}. ${stop.name} · ${n(stop.x, 0)}, ${n(stop.z, 0)} m`, () => { selected = i; render(); }); b.setAttribute('aria-pressed', String(selected === i)); b.dataset.expStop = i; li.append(b); list.append(li); });
    editor.append(list);
    const stop = session.stops[selected];
    const name = make('input'); name.value = stop.name; name.maxLength = 60; name.dataset.expInput = 'stopName'; name.addEventListener('change', () => { stop.name = name.value.trim().slice(0, 60) || `Stop ${selected + 1}`; changed(); });
    editor.append(field('Selected stop name', name));
    const coords = make('div', '', 'exp-coordinates');
    for (const [key, label] of [['x', 'East x · m'], ['z', 'South z · m']]) {
      const input = make('input'); input.type = 'number'; input.value = stop[key]; input.min = -roverLimit(session.grid); input.max = roverLimit(session.grid); input.step = 1; input.dataset.expInput = `stop-${key}`;
      input.addEventListener('change', () => { stop[key] = input.value === '' ? NaN : Number(input.value); changed(); }); coords.append(field(label, input));
    }
    editor.append(coords);
    const actions = make('div', '', 'exp-actions');
    const add = button('+ Add stop', () => { const d = session.grid?.spacingMeters || 300; session.stops.push({ name: `Inspection ${session.stops.length + 1}`, x: 0, z: Math.min(roverLimit(session.grid), d * (session.stops.length - 1)) }); selected = session.stops.length - 1; changed(); }); add.disabled = session.stops.length >= 6;
    const remove = button('Remove stop', () => { session.stops.splice(selected, 1); selected = Math.max(0, selected - 1); changed(); }); remove.disabled = session.stops.length <= 2;
    const earlier = button('Move earlier', () => { [session.stops[selected - 1], session.stops[selected]] = [session.stops[selected], session.stops[selected - 1]]; selected--; changed(); }); earlier.disabled = selected === 0;
    actions.append(add, remove, earlier); editor.append(actions);
    layout.append(editor); box.append(layout, planStatus()); return box;
  }
  function planStatus() {
    const plan = terrainPlan(), box = make('div', '', `exp-plan-status ${plan.valid ? '' : 'exp-invalid'}`);
    box.dataset.expValidation = plan.valid ? 'valid' : 'invalid';
    if (plan.distanceM !== null) box.append(make('strong', `${n(plan.distanceM, 0)} m traverse · ${n(plan.simSeconds / 60)} min SIM · ${n(plan.energyEstimatePct, 2)}% drive estimate · ${n(plan.maxSlopeDeg)}° maximum regional slope`));
    if (!plan.valid) { box.append(make('strong', 'Preparation needs revision')); const list = make('ul'); for (const message of plan.errors) list.append(make('li', message)); box.append(list); }
    else box.append(make('p', 'Direct legs satisfy the selected regional slope and drive allowance in this model. This does not establish field access, obstacle clearance or a return route.'));
    return box;
  }
  function reviewSection() {
    const box = make('div'); box.append(sectionHeading('03 / OPERATOR REVIEW', 'Confirm an Earth field reconnaissance plan', 'Confirm the plan, then start when ready. Start records the departure DEM baseline at stop 1 and begins the traverse to stop 2.'));
    const summary = make('dl', '', 'exp-review');
    for (const [label, value] of [['Earth window', session.site.name], ['Question', OBJECTIVES[session.config.objective].task], ['Payload', `${OBJECTIVES[session.config.objective].equipment} · ${session.config.payloadKg} kg`], ['Constraints', `${session.config.slopeLimitDeg}° regional slope ceiling · ${session.config.energyBudgetPct}% SIM drive allowance`], ['Stops', session.stops.map((s, i) => `${i + 1}. ${s.name} (${s.x}, ${s.z} m)`).join(' → ')]]) summary.append(make('dt', label), make('dd', value));
    box.append(summary, evidenceStrip(), planStatus());
    const check = make('input'); check.type = 'checkbox'; check.checked = reviewed; check.id = 'exp-reviewed'; check.addEventListener('change', () => { reviewed = check.checked; const confirm = root.querySelector('[data-exp-confirm]'); if (confirm) confirm.disabled = !reviewed || !terrainPlan().valid; });
    const label = make('label', '', 'exp-consent'); label.append(check, make('span', 'I reviewed the Earth DEM, payload, limits and stops. I understand that regional topography and simulated energy do not certify a planetary mission or a field route.'));
    box.append(label);
    const confirm = button('Confirm expedition plan', () => { if (confirmExpedition(session, reviewed)) { error = ''; notify(); render(); announce('Plan confirmed. Start expedition will record the departure baseline and begin the traverse.'); } else status('Preparation could not be confirmed. Review the DEM, constraints and stops.'); }, 'exp-primary'); confirm.dataset.expConfirm = ''; confirm.disabled = !reviewed || !terrainPlan().valid;
    box.append(confirm); return box;
  }
  function benchmarkSection() {
    const box = make('details', '', 'exp-benchmark'); box.open = session.phase === 'finished';
    const benchmark = session.benchmark; box.append(make('summary', benchmark.scenario ? `Planetary reference · ${benchmark.scenario.targetName}` : 'Planetary reference · missing benchmark'));
    box.append(make('p', benchmark.reason));
    if (benchmark.comparison?.index !== null && benchmark.comparison?.index !== undefined) box.append(make('p', `${benchmark.comparison.index}/100 regional topography index · ${benchmark.comparison.comparable ? 'scale comparable' : 'scale caveat: indicative only'}. Editorial weights; no planetary similarity, field feasibility or certification.`, 'exp-notice'));
    if (benchmark.comparison?.components?.length) {
      const table = make('table'); const head = make('tr'); for (const text of ['Metric', 'Earth', 'Reference']) head.append(make('th', text)); table.append(head);
      const labels = { slopeP50Deg: 'Median slope · °', slopeP90Deg: 'Slope p90 · °', reliefP95P5M: 'Relief p95–p5 · m', triMeanM: 'Mean TRI · m' };
      for (const c of benchmark.comparison.components) { const row = make('tr'); row.append(make('th', labels[c.key] || c.key), make('td', n(c.earth)), make('td', n(c.target))); table.append(row); }
      box.append(table);
    }
    const target = benchmark.targetDEM;
    if (target) box.append(make('p', `Reference: ${target.dataset} · ${target.spacingMeters} m grid spacing · ${target.nativeResolutionMeters || 'unknown'} m native resolution.`), link('Reference DEM source ↗', target.source));
    box.append(make('p', OBJECTIVES[session.config.objective].unresolved));
    if (sourceContext.scenario) box.append(button('Open destination mission separately ↗', () => onBenchmark(sourceContext.scenario)));
    return box;
  }
  function runSection() {
    const box = make('div', '', 'exp-run');
    const journey = make('ol', '', 'exp-journey'); journey.setAttribute('aria-label', 'Expedition progress');
    const stage = session.phase === 'ready' ? 0 : session.phase === 'inspection' ? 2 : session.phase === 'review' ? 3 : session.phase === 'finished' ? 4 : 1;
    for (const [i, label] of ['Plan confirmed', 'Traverse', 'Inspect stops', 'Review evidence'].entries()) {
      const item = make('li', label); item.dataset.state = i < stage ? 'done' : i === stage ? 'current' : 'upcoming';
      if (i === stage) item.setAttribute('aria-current', 'step'); journey.append(item);
    }
    box.append(journey);
    const layout = make('div', '', 'exp-traverse-layout exp-run-layout');
    const operations = make('div', '', 'exp-operations');
    const stop = session.stops[session.nextStop];
    const guidance = {
      ready: ['Your plan is ready', `Start records the DEM baseline at ${session.stops[0].name} and sets off toward ${session.stops[1].name}. No extra inspection or resume is needed at departure.`],
      running: [session.activeMode === 'manual' ? `Drive to stop ${session.nextStop + 1}` : `On the way to stop ${session.nextStop + 1}`, session.activeMode === 'manual' ? 'Use the drive pad or focus the 3D scene and use WASD or arrow keys. The rover will stop for inspection on arrival.' : 'Auto is following your confirmed traverse. The rover will stop when it reaches the next inspection point.'],
      paused: ['Traverse paused', 'Your position and evidence are saved in this session. Resume when you are ready to continue.'],
      inspection: [`Stop ${session.nextStop + 1} reached · ${stop?.name || ''}`, session.nextStop === session.stops.length - 1 ? 'Record the final DEM inspection, then review and close your expedition.' : 'Record this DEM inspection and continue to the next stop in one action, or record it and stay paused.'],
      review: ['All planned stops recorded', 'Review the collected evidence, then finish to close your report.'],
      blocked: ['Traverse stopped', 'A confirmed constraint has been reached. Review the reason below, then finish with partial evidence or revise the plan.'],
      finished: ['Evidence closed', 'Download your field report or revise the plan for a new expedition.'],
    }[session.phase];
    const command = make('div', '', 'exp-command'); command.dataset.expGuidance = ''; command.setAttribute('role', 'status');
    command.append(make('p', session.phase === 'ready' ? 'READY FOR DEPARTURE' : phases[session.phase].toUpperCase(), 'exp-kicker'), make('h3', guidance[0]), make('p', guidance[1]));
    operations.append(command);
    const progress = make('p', '', 'exp-progress'); progress.dataset.expProgress = ''; operations.append(progress);
    const meter = make('progress'); meter.max = session.stops.length; meter.value = session.inspections.length; meter.setAttribute('aria-label', 'Planned inspection stops completed'); operations.append(meter);
    const metrics = make('p', '', 'exp-run-metrics'); metrics.dataset.expMetrics = ''; operations.append(metrics);
    const live = make('p'); live.dataset.expNext = ''; operations.append(live);
    const actions = make('div', '', 'exp-actions');
    if (['ready', 'running', 'paused', 'finished'].includes(session.phase)) {
      const play = button(session.phase === 'finished' ? 'Expedition closed' : session.phase === 'running' ? 'Pause traverse' : session.phase === 'ready' ? 'Start expedition' : 'Resume traverse', () => toggle(), session.phase === 'finished' ? '' : 'exp-primary');
      play.dataset.expPlay = ''; if (session.phase !== 'finished') play.dataset.expPrimary = ''; play.disabled = session.phase === 'finished'; actions.append(play);
    }
    if (session.phase === 'inspection') {
      const note = make('textarea'); note.maxLength = 500; note.rows = 2; note.value = inspectionNote; note.dataset.expNote = ''; note.placeholder = 'Optional interpretation or future measurement (max 500 characters)';
      note.addEventListener('input', () => { inspectionNote = note.value; });
      const notes = make('details', '', 'exp-inspection-note'); notes.open = Boolean(inspectionNote); notes.append(make('summary', 'Add an operator note (optional)'), field('Operator note', note)); operations.append(notes);
      const inspect = button(session.nextStop === session.stops.length - 1 ? 'Record final inspection' : 'Inspect & continue', () => recordStop(true), 'exp-primary');
      inspect.dataset.expInspect = ''; inspect.dataset.expPrimary = ''; actions.append(inspect);
      if (session.nextStop < session.stops.length - 1) {
        const stay = button('Record & stay paused', () => recordStop(false)); stay.dataset.expInspectStay = ''; actions.append(stay);
      }
    }
    if (session.startedAtUTC && session.phase !== 'finished') {
      const finish = button(session.phase === 'review' ? 'Finish & review evidence' : 'Finish early…', () => { captureEnvironment(); if (finishExpedition(session)) { error = ''; notify(); render(); announce('Earth expedition finished. Review findings and export the report.'); } }, session.phase === 'review' ? 'exp-primary' : '');
      finish.dataset.expFinish = ''; if (session.phase === 'review' || session.phase === 'blocked') finish.dataset.expPrimary = ''; actions.append(finish);
    }
    operations.append(actions);
    const checklist = make('ol', '', 'exp-run-stops'); checklist.setAttribute('aria-label', 'Confirmed stops');
    session.stops.forEach((planned, i) => {
      const recorded = session.inspections.find(item => item.stopIndex === i), item = make('li');
      item.dataset.state = recorded ? 'done' : i === session.nextStop ? 'current' : 'upcoming';
      if (!recorded && i === session.nextStop) item.setAttribute('aria-current', 'step');
      item.append(make('span', String(i + 1), 'exp-stop-number'), make('span', planned.name), make('small', recorded ? recorded.recordingMethod === 'departure-baseline' ? 'Departure baseline' : 'Recorded' : i === session.nextStop ? session.phase === 'inspection' ? 'Inspect now' : session.phase === 'ready' ? 'Departure' : 'Next stop' : 'Upcoming'));
      checklist.append(item);
    });
    operations.append(checklist, make('p', 'SIM ×20 · Arrival tolerance 5 m. Departure records DEM context only; later stops require your inspection. No material measurements are simulated.', 'exp-small'));
    if (session.blockedReason) operations.append(make('p', session.blockedReason, 'exp-error'));
    layout.append(operations, mapView(false)); box.append(layout);
    const results = make('ol', '', 'exp-findings');
    for (const inspection of session.inspections) {
      const li = make('li'); li.append(make('strong', `${inspection.stopIndex + 1}. ${inspection.name}${inspection.recordingMethod === 'departure-baseline' ? ' · departure DEM baseline' : ''}`), make('p', inspection.finding), make('small', `${inspection.atUTC} UTC · ${n(inspection.simSeconds)} SIM s · ${n(inspection.position.lat, 5)}, ${n(inspection.position.lon, 5)} · ${inspection.terrain.spacingMeters} m grid spacing`));
      const env = inspection.environment;
      li.append(make('p', env ? `Site/window environment (${env.kind}, ${env.timestampUTC || 'time unavailable'}): air ${n(env.values.temperatureC)} °C · wind ${n(env.values.windSpeedMs)} m/s. These are not stop measurements.` : 'Environment: no sourced site/window data available; no values inferred.'));
      if (env?.source?.url) li.append(link('Environmental source ↗', env.source.url));
      if (inspection.note) li.append(make('p', `Operator note: ${inspection.note}`)); results.append(li);
    }
    if (session.inspections.length) box.append(make('h3', 'Inspected stop evidence'), results);
    if (session.phase === 'finished' || session.phase === 'review' || session.phase === 'blocked') {
      const decision = expeditionDecision(session), result = make('div', '', 'exp-decision'); result.append(make('p', 'DECISION / NEXT VALIDATION', 'exp-kicker'), make('h3', decision.status), make('p', decision.rationale));
      result.append(make('h4', 'What this supports'), make('p', decision.strengths.join(' ')), make('h4', 'Where the analogy breaks'), make('p', decision.breakdowns.join(' ')), make('h4', 'Next actions'));
      const next = make('ol'); for (const action of decision.nextSteps) next.append(make('li', action)); result.append(next); box.append(result);
    }
    return box;
  }
  function recordStop(continueTraverse) {
    inspectionNote = root.querySelector('[data-exp-note]')?.value ?? inspectionNote;
    captureEnvironment();
    if (!inspectStop(session, { telemetry: session.latestTelemetry, note: inspectionNote })) { status('Drive to within 5 SIM metres of the next confirmed stop before inspecting.'); return; }
    inspectionNote = ''; error = '';
    if (continueTraverse && session.phase === 'paused') startExpedition(session);
    notify(); render();
    announce(session.phase === 'review' ? 'Final inspection recorded. Finish to close your report.' : session.phase === 'running' ? `Inspection recorded. Continuing to stop ${session.nextStop + 1}.` : 'Inspection recorded. Traverse paused.');
  }
  function tickReadings() {
    if (!session) return;
    const r = session.rover, next = session.stops[session.nextStop];
    set(root.querySelector('[data-exp-progress]'), `${session.inspections.length} / ${session.stops.length} stops inspected · ${phases[session.phase]}`);
    set(root.querySelector('[data-exp-metrics]'), `${n(r.distance, 0)} m travelled · ${n(r.elapsed, 0)} SIM s · ${n(r.battery)}% battery · ${n(session.observations.energyUsedPct, 2)} / ${session.config.energyBudgetPct}% allowance used`);
    set(root.querySelector('[data-exp-next]'), session.phase==='finished'?`Evidence closed with ${session.inspections.length}/${session.stops.length} stops inspected. Download the report or reset to prepare a new expedition.`:next ? `Next: ${session.nextStop + 1}. ${next.name} · ${n(Math.hypot(next.x - r.x, next.z - r.z), 0)} m away · regional slope ceiling ${session.config.slopeLimitDeg}°` : 'Every planned stop has evidence. Finish the expedition to close the decision report.');
    map?.draw();
  }
  function render() {
    root.hidden = !visible;
    if (!session) { root.replaceChildren(make('p', 'Loading the selected Earth DEM…', 'exp-loading')); root.dataset.phase = 'loading'; return; }
    const active = document.activeElement?.dataset.expInput, restoreFocus = root.contains(document.activeElement);
    root.dataset.phase = session.phase; root.dataset.siteId = session.site.id; root.dataset.sessionId = session.sessionId;
    root.dataset.inspected = session.inspections.length; root.dataset.confirmed = Boolean(session.confirmedAtUTC);
    lastPhase = session.phase; map = null;
    const header = make('header', '', 'exp-header'), title = make('div');
    title.append(make('p', 'EARTH ANALOGUE / FIELD EXPEDITION', 'exp-kicker'), make('h2', 'Turn terrain into a testable plan'), make('p', `${session.site.name} · ${phases[session.phase]}`));
    const shortcuts=make('div','','exp-header-actions');shortcuts.append(make('span','EARTH · DEM + SIM','exp-domain'),button('3D scene & drive controls ↓',onFocusScene),button('Flight Director AI ↓',onDirector));header.append(title,shortcuts);
    root.replaceChildren(header);
    if (error) { const message = make('p', error, 'exp-error'); message.setAttribute('role', 'alert'); root.append(message); }
    if (session.phase === 'draft') {
      const nav = make('nav', '', 'exp-steps'); nav.setAttribute('aria-label', 'Earth expedition preparation');
      for (const [number, label] of [[1, 'Objective & payload'], [2, 'Terrain & stops'], [3, 'Review & confirm']]) {
        const b = button(`${number} · ${label}`, () => { step = number; error = ''; render(); }); b.setAttribute('aria-current', step === number ? 'step' : 'false'); b.dataset.expStep = number; nav.append(b);
      }
      root.append(nav, step === 1 ? objectiveSection() : step === 2 ? traverseSection() : reviewSection());
      const footer = make('div', '', 'exp-actions exp-wizard-actions');
      if (step > 1) footer.append(button('← Back', () => { step--; render(); }));
      if (step < 3) { const next = button(step === 1 ? 'Plan terrain stops →' : 'Review preparation →', () => { step++; render(); }, 'exp-primary'); next.dataset.expNextStep = ''; footer.append(next); }
      root.append(footer);
    } else root.append(runSection());
    root.append(benchmarkSection());
    const footer = make('footer', '', 'exp-footer');
    const exports = make('div', '', 'exp-actions');
    exports.append(button('Copy copilot context', async () => {
      captureEnvironment();
      try { await navigator.clipboard.writeText(JSON.stringify({ earthExpedition: expeditionContext(session) }, null, 2)); announce('Bounded Earth expedition context copied.'); } catch { status('Clipboard unavailable. Download the JSON evidence report instead.'); }
    }));
    for (const [format, label] of [['md', 'Download field report · MD'], ['json', 'Download evidence · JSON']]) { const b = button(label, () => download(format)); b.dataset.expExport = format; exports.append(b); }
    if (session.phase !== 'draft') exports.append(button('Reset & revise preparation', () => reset()));
    footer.append(exports, make('p', 'Local report: plan, sources, inspected stops, timestamps, model limits and next validation actions. Independent of destination landing, Mission Dossier and M2 exports.', 'exp-small'));
    if (archive.length) { const history = make('details'); history.append(make('summary', `Previous expedition reports (${archive.length}, in this tab)`)); for (const report of archive) history.append(button(`${report.site.name} · ${report.inspections.length} stops · MD`, () => download('md', report))); footer.append(history); }
    const limits = make('details'); limits.append(make('summary', 'Model limits & evidence domains')); for (const text of LIMITATIONS) limits.append(make('p', text)); footer.append(limits); root.append(footer);
    tickReadings();
    if (active) [...root.querySelectorAll('[data-exp-input]')].find(node => node.dataset.expInput === active)?.focus({ preventScroll: true });
    else if (restoreFocus) (root.querySelector('[data-exp-primary]:enabled') || root.querySelector('[data-exp-confirm]') || root.querySelector('[aria-current="step"] button') || root.querySelector('button:enabled'))?.focus({ preventScroll: true });
  }
  function toggle() {
    if (!session || root.dataset.phase==='loading') { announce('The selected Earth DEM is still loading. Prepare this window after it loads.'); return false; }
    if (session.phase === 'draft') { step = 1; render(); root.scrollIntoView({ block: 'start', behavior: 'instant' }); root.querySelector('select')?.focus({ preventScroll: true }); announce('Prepare and explicitly confirm this Earth expedition before starting.'); return false; }
    if (session.phase === 'running') pauseExpedition(session);
    else {
      captureEnvironment();
      if (!startExpedition(session)) { announce(session.phase === 'inspection' ? 'Inspect the current planned stop before resuming.' : 'Finish the evidence review or reset to revise this expedition.'); return false; }
    }
    error = ''; notify(); render();
    announce(session.phase === 'running' ? session.activeMode === 'manual' ? 'Expedition active in Manual. Use the drive controls to move.' : `Traversing to stop ${session.nextStop + 1}.` : 'Traverse paused.'); return true;
  }
  return {
    configure(context) {
      const key = `${context.site.id}:${demIdentity(context.grid)}:${context.scenario?.id || ''}:${demIdentity(context.targetGrid)}`;
      sourceContext = context;
      if (key !== contextKey) { contextKey = key; reset({ keepPlan: false }); }
      else { notify(); render(); }
    },
    loading(siteId) { if (session?.site.id !== siteId) { pauseExpedition(session || {}); notify(); root.dataset.phase = 'loading'; root.dataset.siteId=siteId; root.dataset.sessionId=''; root.replaceChildren(make('p', 'Loading the selected Earth DEM…', 'exp-loading')); } },
    setVisible(value) { visible = value; if (!value && session) { pauseExpedition(session, 'Earth expedition view closed'); notify(); } root.hidden = !value; if (value) render(); },
    suspend() { if (session) { pauseExpedition(session, 'Switched to another mission domain'); notify(); render(); } },
    toggle, reset, state,
    setMode(mode){if(setExpeditionMode(session,mode)){notify();render();}},
    nextStop:()=>session&&session.phase!=='finished'&&session.nextStop<session.stops.length?session.nextStop:null,
    focus(){ root.scrollIntoView({block:'start',behavior:'instant'});(root.querySelector('[data-exp-primary]:enabled')||root.querySelector('button:enabled'))?.focus({preventScroll:true}); },
    stops:()=>session?.stops.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.z)).map(s=>[s.x,s.z])||[],
    step(dt, { running, mode, throttle, turn, hidden } = {}) {
      if (!session || !visible || hidden) return;
      if (!running && session.phase === 'running') pauseExpedition(session);
      if (session.phase === 'running') advanceExpedition(session, dt, { mode, throttle, turn });
      if (session.phase !== lastPhase) { notify(); render(); }
      const now = performance.now(); if (now - lastTick > 160) { lastTick = now; tickReadings(); }
    },
    report(siteId) { if (!session || (siteId && session.site.id!==siteId) || root.dataset.phase==='loading') return null; captureEnvironment(); return expeditionReport(session); },
    context() { if (!session || root.dataset.phase==='loading') return null; captureEnvironment(); return expeditionContext(session); },
    answer(question, capturedContext) { const context = capturedContext === undefined ? this.context() : capturedContext; return context ? answerExpedition(question, context) : { answer: 'The Earth expedition is still loading. Select a site and prepare a source-backed traverse.', provider: 'rules', generatedAt: new Date().toISOString(), grounded: [], disclaimer: 'No evidence inferred while loading.' }; },
  };
}
