import { compactSurface, surfaceMarkdown, SURFACE_LIMIT } from './surface-assessment.mjs';
import { automaticSurface } from './surface-evidence.mjs';

const node = (tag, text = '', cls = '') => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
const number = value => Number.isFinite(value) ? Number(value.toPrecision(5)).toLocaleString('en-US') : 'not measured';
const action = (label, run) => { const b = node('button', label); b.type = 'button'; b.addEventListener('click', run); return b; };
const svgNode = (tag, attrs, text = '') => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value); n.textContent = text; return n; };

function profileChart(terrain) {
  const box = node('figure', '', 'surface-profile');
  const svg = svgNode('svg', { viewBox:'0 0 440 200', role:'img', 'aria-label':'Actual east–west DEM profile, with distance and elevation in metres; this is regional terrain, not a rock cross-section' });
  const profile = terrain.profile, heights = profile.map(p => p.heightM), min = Math.min(...heights), max = Math.max(...heights), span = max - min || 1;
  const x = d => 48 + d / terrain.extentM * 376, y = h => 158 - (h - min) / span * 125;
  for (const height of [min,(min+max)/2,max]) {
    svg.append(svgNode('line',{x1:48,x2:424,y1:y(height),y2:y(height),class:'surface-profile-grid'}),svgNode('text',{x:42,y:y(height)+4,'text-anchor':'end'},number(height)));
  }
  svg.append(svgNode('path',{d:profile.map((p,i)=>`${i?'L':'M'}${x(p.distanceM)},${y(p.heightM)}`).join(' '),class:'surface-profile-line'}));
  svg.append(svgNode('text',{x:48,y:182},'0 m · WEST'),svgNode('text',{x:424,y:182,'text-anchor':'end'},`${number(terrain.extentM)} m · EAST`));
  box.append(svg,node('figcaption','Actual DEM profile · elevation in metres · central row. Regional relief does not describe an individual rock.'));
  return box;
}

export function createSurfaceLab(root, { onAsk = () => {} } = {}) {
  let context = null, report = null;
  const snapshot = () => report ? { ...structuredClone(report), capturedAtUTC:new Date().toISOString(), revision:0 } : null;
  function download(format) {
    const current = snapshot(); if (!current) return;
    const content = format === 'json' ? JSON.stringify(current,null,2) : surfaceMarkdown(current);
    const url = URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json':'text/markdown;charset=utf-8'}));
    const a=node('a');a.href=url;a.download=`surface-${context.body}-${context.siteId}.${format}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function metric(label,value,unit,detail) {
    const box=node('div','','surface-metric');box.append(node('span',label),node('strong',`${number(value)} ${unit}`),node('small',detail));return box;
  }
  function source(label,url) {
    if(!url)return node('p','No source geometry supplied.','surface-small');
    const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
  }
  function render() {
    root.replaceChildren();if(!report)return;
    const a=report.automatic,t=a.terrain,v=report.cavity;
    root.dataset.contextKey=context.key;root.dataset.mode='automatic';root.dataset.siteId=context.siteId;root.dataset.body=context.body;
    const heading=node('header','','panel-heading'),title=node('h2','Surface, rocks & cavities');title.id='surface-heading';heading.append(title,node('span',t?'AUTO · DEM EVIDENCE':'AUTO · SOURCE GAPS','data-badge'));
    root.append(heading,node('p',`${context.name} · ${context.body.toUpperCase()} · ${context.body==='earth'?'EARTH EXPEDITION':'DESTINATION MISSION'}`,'surface-context'),node('p','Updated automatically from the active location and its published DEM. No manual dimensions or reference-loading step is required.','surface-small'));
    if(t){
      const metrics=node('div','','surface-metrics');metrics.dataset.surfaceMetrics='';
      metrics.append(metric('Regional relief · P95–P5',t.reliefP95P5M,'m','Elevation variation across this source window.'),metric('Regional slope · P90',t.slopeP90Deg,'°','90th percentile slope; not a wheel-scale slope.'),
        metric(t.triMeanM===null?'Adjacent-node relief':'Published TRI',t.triMeanM??t.meanNeighbourReliefM,'m',t.triMeanM===null?'Mean absolute height change between adjacent nodes.':'Published terrain ruggedness at the DEM scale.'),metric('Effective DEM scale',t.effectiveScaleM,'m',`Native ${number(t.nativeResolutionM)} m · grid ${number(t.gridSpacingM)} m.`));
      root.append(metrics,profileChart(t),node('p',`${t.dataset} · ${number(t.extentM)} m window`,'surface-small'),source('View elevation source ↗',t.source));
    }else root.append(node('p','Loading the matching source DEM, or no valid DEM is published for this location. No terrain values are inferred.','surface-small'));
    const rocks=node('section','','surface-evidence-card');rocks.dataset.surfaceRocks='';rocks.append(node('h3','Rocks & obstacle survey'),node('p',a.rockStatus),node('p','Use the relief and roughness above to select survey sectors. Individual block volume, mass and rover clearance need calibrated close-range stereo/lidar and material evidence.','surface-small'));
    const cavity=node('section','','surface-evidence-card');cavity.dataset.surfaceCavity='';cavity.append(node('h3',v.source?'Published local pit · loaded automatically':'Cavity evidence at this location'),node('p',a.cavityStatus));
    if(v.source){
      const metrics=node('div','','surface-metrics');metrics.append(metric('Inner opening',v.inputs.lengthM,'m',`${number(v.inputs.lengthM)} × ${number(v.inputs.widthM)} m · published stereo estimate.`),metric('Vertical depth',v.inputs.depthM,'m','Published stereo estimate; uncertainty not supplied.'),metric('Opening area · derived',v.openingAreaM2.nominal,'m²','Elliptical opening model.'),metric('Pit envelope · derived',v.pitEnvelopeM3.nominal,'m³','Cylindrical approximation; not connected cave volume.'));cavity.append(metrics);
    }
    if(a.cavityContextSource)cavity.append(source('View local cavity source ↗',a.cavityContextSource));
    cavity.append(node('p','Connected cave volume, roof thickness, stability and safe access remain unresolved.','surface-small'));
    root.append(rocks,cavity);
    const footer=node('div','','surface-actions');const ask=action('Ask Flight Director about this terrain ↗',()=>onAsk('Evaluate the automatic rock, obstacle and cavity evidence for this active location. Explain the DEM values, their scale and the next measurements.'));ask.dataset.surfaceAsk='';footer.append(ask);
    for(const format of ['json','md']){const b=action(`Export surface evidence · ${format.toUpperCase()}`,()=>download(format));b.dataset.surfaceExport=format;footer.append(b);}
    root.append(footer,node('p',SURFACE_LIMIT,'surface-small'));
  }
  return {
    configure(next,grid=null){if(next?.key===context?.key)return;context=next;report=next?automaticSurface(next,grid):null;render();},
    snapshot,compact:()=>compactSurface(report),revision:()=>0,
  };
}
