import { assessSurface, compactSurface, surfaceMarkdown, EMPTY_ROCK, EMPTY_CAVITY, MARIUS_REFERENCE, SURFACE_LIMIT } from './surface-assessment.mjs';

const node = (tag, text = '', cls = '') => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
const number = value => Number.isFinite(value) ? Number(value.toPrecision(5)).toLocaleString('en-US') : 'unavailable';
const action = (label, run) => { const b = node('button', label); b.type = 'button'; b.addEventListener('click', run); return b; };
const svgNode = (name, attributes, text = '') => { const n = document.createElementNS('http://www.w3.org/2000/svg', name); for (const [k, v] of Object.entries(attributes)) n.setAttribute(k, v); n.textContent = text; return n; };

export function createSurfaceLab(root, { onChange = () => {}, onAsk = () => {} } = {}) {
  let context = null, revision = 0, shape = 'rock', basis = 'operator-hypothesis';
  let rock = { ...EMPTY_ROCK }, cavity = { ...EMPTY_CAVITY }, report = null;
  let results, diagram, inputNotice;
  function snapshot() { return context ? { ...structuredClone(report), capturedAtUTC: new Date().toISOString(), revision } : null; }
  function changed() { revision++; update(); onChange(); }
  function field(key, label, input, owner) {
    const wrap = node('label', label), control = node('input'); control.type = 'number'; control.step = 'any';
    control.min = key === 'uncertaintyPct' ? '0' : '0.000001'; control.max = key === 'uncertaintyPct' ? '99.999' : '100000';
    control.value = input[key] ?? ''; control.placeholder = 'unavailable'; control.dataset.surfaceInput = `${owner}.${key}`;
    control.addEventListener('change', () => { input[key] = control.value === '' ? null : Number(control.value); if (owner === 'cavity') basis = 'operator-hypothesis'; changed(); });
    wrap.append(control); return wrap;
  }
  function download(format) {
    const current = snapshot(); if (!current) return;
    const content = format === 'json' ? JSON.stringify(current, null, 2) : surfaceMarkdown(current);
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' }));
    const a = node('a'); a.href = url; a.download = `surface-${context.body}-${context.siteId}-${revision}.${format}`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function draw() {
    diagram.replaceChildren();
    const svg = svgNode('svg', { viewBox: '0 0 420 230', role: 'img', 'aria-label': `${shape === 'rock' ? 'Ellipsoid rock' : 'Vertical pit'} schematic scaled to the entered dimensions; no feature detection or geolocation` });
    svg.append(svgNode('text', { x: 18, y: 24, class: 'surface-svg-note' }, 'GEOMETRIC SCHEMATIC · NO DETECTION'));
    const input = shape === 'rock' ? rock : cavity, height = shape === 'rock' ? input.heightM : input.depthM;
    if (!Number.isFinite(input.lengthM) || !Number.isFinite(height) || input.lengthM <= 0 || height <= 0 || !report[shape].valid) {
      svg.append(svgNode('text', { x: 20, y: 115 }, 'Enter positive length and height/depth to draw the model.')); diagram.append(svg); return;
    }
    const scale = Math.min(300 / input.lengthM, 135 / height), w = input.lengthM * scale, h = height * scale, x = 210 - w / 2;
    if (shape === 'rock') {
      svg.append(svgNode('line', { x1: 24, y1: 184, x2: 396, y2: 184, class: 'surface-ground' }));
      svg.append(svgNode('ellipse', { cx: 210, cy: 184 - h / 2, rx: w / 2, ry: h / 2, class: 'surface-rock' }));
      svg.append(svgNode('path', { d: `M${x} ${184 - h / 2} Q210 ${184 - h * .85} ${x + w} ${184 - h / 2}`, class: 'surface-wire' }));
      if (Number.isFinite(rock.clearanceM)) { const cy = 184 - Math.min(145, rock.clearanceM * scale); svg.append(svgNode('line', { x1: 26, x2: 394, y1: cy, y2: cy, class: 'surface-clearance' })); }
    } else {
      svg.append(svgNode('path', { d: `M24 54 H${x} V${54 + h} H${x + w} V54 H396`, class: 'surface-pit' }));
      svg.append(svgNode('line', { x1: x, x2: x + w, y1: 54, y2: 54, class: 'surface-clearance' }));
      svg.append(svgNode('text', { x: 20, y: 211, class: 'surface-svg-note' }, 'Connected void and roof geometry: unknown'));
    }
    svg.append(svgNode('text', { x: 210, y: shape === 'rock' ? 210 : 44, 'text-anchor': 'middle' }, `${number(input.lengthM)} m long · ${number(input.widthM)} m wide`));
    svg.append(svgNode('text', { x: 18, y: 74 }, `${number(height)} m ${shape === 'rock' ? 'height' : 'depth'}`));
    diagram.append(svg);
  }
  function metric(label, value, unit, detail = '') {
    const box = node('div', '', 'surface-metric'); box.append(node('span', label), node('strong', `${value} ${unit}`), node('small', detail)); return box;
  }
  function update() {
    if (!context || !results) return;
    report = assessSurface(context, rock, cavity, basis);
    const estimate = report[shape]; results.replaceChildren();
    inputNotice.textContent = shape === 'cavity' && estimate.source ? `PUBLISHED INPUTS · ${estimate.source.name}. Editing any input switches this case to an operator hypothesis.` : 'OPERATOR HYPOTHESIS · No rock or cavity has been detected. Empty values remain unknown. Inputs are not instrument readings.';
    const metrics = node('div', '', 'surface-metrics');
    if (shape === 'rock') {
      metrics.append(metric('Ellipsoid envelope', number(estimate.volumeM3.nominal), 'm³', `Conditional bounds: ${number(estimate.volumeM3.min)}–${number(estimate.volumeM3.max)} m³`),
        metric('Conditional mass', `${number(estimate.massKg.min)}–${number(estimate.massKg.max)}`, 'kg', 'Requires assumed density bounds; no composition inferred.'),
        metric(`${context.body} weight model`, `${number(estimate.weightN.min)}–${number(estimate.weightN.max)}`, 'N', `Gravity: ${number(estimate.gravityMs2)} m/s²; mass is unchanged.`),
        metric('Height / proposed clearance', number(estimate.heightToClearance), '×', 'A geometry ratio, not wheel or traversability validation.'));
    } else {
      metrics.append(metric('Elliptical opening', number(estimate.openingAreaM2.nominal), 'm²'), metric('Vertical pit envelope', number(estimate.pitEnvelopeM3.nominal), 'm³', `Conditional bounds: ${number(estimate.pitEnvelopeM3.min)}–${number(estimate.pitEnvelopeM3.max)} m³`),
        metric('Ideal gravity-only drop', number(estimate.idealDropSeconds), 's', `At rest; ${number(estimate.gravityMs2)} m/s²; no drag. Not a descent design.`), metric('Opening / Marius inner pit', number(estimate.referenceAreaRatio), '×', 'An area comparison only, not shelter feasibility.'));
    }
    metrics.append(metric('DEM samples across', number(estimate.scale.samplesAcross), '', `Native ${number(estimate.scale.nativeResolutionM)} m · grid ${number(estimate.scale.gridSpacingM)} m`), metric('Survey spacing target', number(estimate.scale.requestedSurveySpacingM), 'm', 'Editorial target: three samples across; no detection guarantee.'));
    results.append(metrics);
    if (!estimate.valid) { const errors = node('p', estimate.errors.join(' '), 'surface-error'); errors.setAttribute('role', 'alert'); results.append(errors); }
    results.append(node('p', estimate.limitation, 'surface-small'), node('p', `Next evidence: ${estimate.next}`, 'surface-next'));
    if (shape === 'cavity') {
      const reference = node('details'); reference.append(node('summary', 'Documented comparison · Marius Hills inner pit'));
      reference.append(node('p', `${MARIUS_REFERENCE.lengthM} × ${MARIUS_REFERENCE.widthM} m inner diameters; ${MARIUS_REFERENCE.depthM} m stereo-derived depth. ${MARIUS_REFERENCE.definition}`));
      const link = node('a', 'LROC Pit Atlas · source ↗'); link.href = MARIUS_REFERENCE.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; reference.append(link); results.append(reference);
    }
    draw(); root.dataset.revision = revision;
  }
  function render() {
    root.replaceChildren(); if (!context) return;
    root.dataset.contextKey = context.key;
    const header = node('header', '', 'panel-heading'); const h = node('h2', 'Rocks & cavities'); h.id = 'surface-heading'; header.append(h, node('span', 'ESTIMATES / SOURCES', 'data-badge')); root.append(header);
    root.append(node('p', `${context.name} · ${context.body.toUpperCase()} · ${context.sessionId || 'no active run'}`, 'surface-context'), node('p', 'Turn dimensions into testable exploration questions. Geometry and input uncertainty change the estimates; missing evidence remains unknown.', 'surface-small'));
    const nav = node('div', '', 'surface-actions'); nav.setAttribute('role', 'group'); nav.setAttribute('aria-label', 'Estimate type');
    for (const [id, label] of [['rock', 'Rock envelope'], ['cavity', 'Cavity / vertical pit']]) { const b = action(label, () => { shape = id; render(); }); b.dataset.surfaceShape = id; b.setAttribute('aria-pressed', shape === id); nav.append(b); }
    root.append(nav); inputNotice = node('p', '', 'surface-basis'); root.append(inputNotice);
    const fields = node('div', '', 'surface-fields'), input = shape === 'rock' ? rock : cavity;
    for (const [key, label] of (shape === 'rock' ? [['lengthM', 'Full length · m'], ['widthM', 'Full width · m'], ['heightM', 'Envelope height · m'], ['uncertaintyPct', 'Assumed axis uncertainty · %'], ['densityMinKgM3', 'Assumed density min · kg/m³'], ['densityMaxKgM3', 'Assumed density max · kg/m³'], ['clearanceM', 'Proposed rover clearance · m']] : [['lengthM', 'Opening length · m'], ['widthM', 'Opening width · m'], ['depthM', 'Vertical depth · m'], ['uncertaintyPct', 'Assumed axis uncertainty · %']])) fields.append(field(key, label, input, shape));
    root.append(fields);
    const presets = node('div', '', 'surface-actions'); const example = action('Load explicit what-if example', () => {
      if (shape === 'rock') rock = { lengthM: 1, widthM: .8, heightM: .5, uncertaintyPct: 20, densityMinKgM3: 2600, densityMaxKgM3: 3200, clearanceM: .3 };
      else cavity = { lengthM: 10, widthM: 6, depthM: 4, uncertaintyPct: 20 };
      basis = 'operator-hypothesis'; changed(); render();
    }); example.dataset.surfaceExample = ''; presets.append(example);
    if (shape === 'cavity' && context.body === 'moon' && context.siteId === MARIUS_REFERENCE.siteId) {
      const published = action('Use published Marius pit dimensions', () => { cavity = { lengthM: 55, widthM: 49, depthM: 40, uncertaintyPct: null }; basis = MARIUS_REFERENCE.id; changed(); render(); }); published.dataset.surfaceReference = ''; presets.append(published);
    }
    presets.append(action('Clear this estimate', () => { if (shape === 'rock') rock = { ...EMPTY_ROCK }; else cavity = { ...EMPTY_CAVITY }; basis = 'operator-hypothesis'; changed(); render(); })); root.append(presets);
    diagram = node('div', '', 'surface-diagram'); results = node('div'); results.setAttribute('aria-live', 'polite'); root.append(diagram, results);
    const footer = node('div', '', 'surface-actions');
    const ask = action('Ask Flight Director about these estimates ↗', () => onAsk(`Evaluate the ${shape === 'rock' ? 'rock dimensions, conditional mass and rover clearance' : 'cavity geometry, Marius comparison and unresolved roof stability'} in the active context. Which measurements should we acquire next?`)); ask.dataset.surfaceAsk = ''; footer.append(ask);
    for (const format of ['json', 'md']) { const b = action(`Export estimates · ${format.toUpperCase()}`, () => download(format)); b.dataset.surfaceExport = format; footer.append(b); }
    root.append(footer, node('p', `${SURFACE_LIMIT} Working estimates are cleared when the location, DEM or mission session changes.`, 'surface-small')); update();
  }
  return {
    configure(next) { if (next?.key === context?.key) return; context = next; revision = 0; rock = { ...EMPTY_ROCK }; cavity = { ...EMPTY_CAVITY }; basis = 'operator-hypothesis'; report = null; render(); },
    snapshot, compact: () => compactSurface(report, revision), revision: () => revision,
  };
}
