import * as THREE from './assets/vendor/three.module.min.js';
import { sampleHeight, sampleSlope, gridExtent } from './mission-math.mjs';
const phaseNames = { ready:'Prepare the descent', preparation:'Surveying the region', descent:'Descent in progress', contact:'Review touchdown', deployment:'Deploying rover', exploration:'Explore the surface', 'hard-contact':'Touchdown outside tolerances', aborted:'Test interrupted', unavailable:'Region not assessable' };
const number = (v, digits = 1) => Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits:digits, minimumFractionDigits:digits }) : '—';
const statusNames = {candidate:'Regional candidate', caution:'Regional caution', unevaluable:'Not assessable'};
const make = (tag, className, text) => { const e = document.createElement(tag); e.className = className || ''; if (text !== undefined) e.textContent = text; return e; };
const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
const bodyName = (key, profile) => key === 'earth' ? 'EARTH' : profile?.body === 'moon' ? 'MOON' : 'MARS';
const failed = phase => ['hard-contact','aborted','unavailable'].includes(phase);
export function createLandingView(root, { controller, onChoose, onAbort, onAction, onReset, onFocusScene, onExplore, onCompare, onPreparationChange, onConfirmPreparation, isPrepared = () => false, getAnalogue = () => ({}), isReady = () => true, getGrid = () => null, getRoverPose = () => null, isRunning = () => controller.running } = {}) {
  root.innerHTML = `<section class="landing-command" aria-label="Descent controls">
    <div class="landing-heading"><p class="eyebrow">ATLAS / MISSION TO DESTINATION</p><span class="landing-model">MODEL · SI</span></div>
    <ol class="landing-timeline" aria-label="Mission stages"><li><b>01</b>Zone</li><li><b>02</b>Analog</li><li><b>03</b>Descend</li><li><b>04</b>Review / deploy</li><li><b>05</b>Explore</li></ol>
    <div class="landing-status"><h3 data-flight-phase role="status"></h3><span data-flight-pause hidden>Ⅱ PAUSED</span></div>
    <p data-flight-purpose class="landing-purpose"></p>
    <div class="landing-actions"><button type="button" class="landing-primary" data-flight-action>Descend <span aria-hidden="true">↘</span></button><button type="button" class="landing-secondary" data-flight-focus>View landing ↗</button><button type="button" class="landing-secondary" data-flight-plan>Prepare mission</button></div>
    <p class="landing-action-hint" data-flight-next></p>
    <div class="landing-flight-tools"><label>Camera<select data-flight-camera aria-label="Descent camera"><option value="exterior">Exterior · tracking</option><option value="lower">Lower · touchdown</option><option value="orbital">Orbital · region</option></select></label><fieldset class="landing-rate"><legend>Flight speed · SIM</legend><div role="group" aria-label="Simulation speed"><button type="button" data-flight-rate="0.5" aria-pressed="false">0.5×</button><button type="button" data-flight-rate="1" aria-pressed="true">1×</button><button type="button" data-flight-rate="2" aria-pressed="false">2×</button><button type="button" data-flight-rate="4" aria-pressed="false">4×</button></div></fieldset></div>
    <div class="landing-readings" data-flight-readings></div>
    <div class="landing-result" data-flight-results hidden><p class="eyebrow">TOUCHDOWN AT DESTINATION</p><p data-result="target"></p><p data-result="earth"></p></div>
    <div class="landing-explore" data-flight-explore hidden><p data-flight-science></p><button type="button" data-flight-drive>Drive rover ↓</button><a href="#analogy-audit">Compare and download M2 report ↗</a></div>
    <details class="landing-reference"><summary>Analog and test scope</summary>    <section class="landing-analogue"><p class="eyebrow">02 / EVALUATE WITH ANALOG</p><h4 data-analogue-title></h4><p data-analogue-purpose></p><p>Use it to compare terrain, slopes and navigation. Gravity and atmosphere differ: Earth weather does not govern the lunar or Martian lander. The regional DEM does not resolve landing legs, rocks or cavities.</p><label class="landing-check"><input type="checkbox" data-flight-compare> Compare analog · optional</label><div data-analogue-details hidden><p data-analogue-origin></p><a href="#analogy-audit">Open data, analysis and M2 report ↗</a></div></section>
    <details class="landing-scope"><summary>Layers, criteria and test limits</summary><label class="landing-check"><input type="checkbox" data-flight-slopes checked> Show regional slopes in 3D</label><p>Slope, relief, science distance and coverage are compared with a heuristic ranking. Yellow: candidate; orange: caution; grey: not assessable. Colors do not certify safety or represent probability.</p><p>DEM at 37.5 m per node: it does not resolve landing legs, rocks or the Marius pit. Visual relief ×2; schematic lander ×6. AGL and dynamics in SI meters without exaggeration. Dashed line: schematic prediction; solid: simulated flight samples.</p><p>Earth: automatic test and comparison region, with no lander or second landing. Moon: vacuum. Mars: only an idealized final powered segment; no entry, parachutes or aerodynamics. Earth weather is context, never Martian forces. Idealized automatic navigation, with no NASA TRN or vision implemented.</p><p data-flight-profile></p><a href="docs/descenso-modelo.md" target="_blank" rel="noopener">Model and sources ↗</a> · <a href="docs/descenso-uso.md" target="_blank" rel="noopener">Descent guide ↗</a></details></details>
    <div class="landing-footer"><span data-flight-time></span><button type="button" data-flight-reset>↺ Prepare again</button><button type="button" data-flight-abort>Interrupt</button></div>
  </section>
  <dialog class="landing-preparation" data-preparation-dialog aria-labelledby="preparation-title" aria-describedby="preparation-intro">
    <header class="preparation-header"><div><p class="eyebrow">BEFORE DESCENT / DESTINATION</p><h3 id="preparation-title" tabindex="-1">Prepare mission</h3><p id="preparation-intro">Choose zone and load. Confirming enables the start; it does not put the lander in flight.</p></div><button type="button" data-preparation-close aria-label="Close preparation without starting">×</button></header>
    <ol class="preparation-steps" aria-label="Preparation stages"><li data-preparation-indicator="zone" aria-current="step"><b>01</b> Destination zone</li><li data-preparation-indicator="load"><b>02</b> Load and summary</li></ol>
    <section class="landing-workbench" aria-label="Regional preparation">
    <div class="landing-guide" data-flight-guide><span aria-hidden="true">⌖</span><p><strong>Your mission starts with a choice.</strong> Review the candidates on the map; then choose the destination load.</p><button type="button" data-flight-dismiss aria-label="Hide initial guide">Got it ×</button></div>
    <section data-preparation-step="zone">
    <header class="landing-prep-heading"><div><p class="eyebrow">01 / DESTINATION ZONE</p><h3>Prepare touchdown on the Moon or Mars.</h3></div><span data-flight-lock></span></header>
    <p class="landing-map-note">Destination DEM map, no satellite imagery. Blue: relative elevation. Target local frame: x east →, z south ↓. ◇ Science · numbered circles: proposed touchdowns.</p>
    <div class="landing-candidates" data-flight-candidates></div>
    </section>
    <section data-preparation-step="load" hidden>
    <section class="landing-fuel" aria-labelledby="landing-fuel-title"><header><div><p class="eyebrow">PREPARATION LOAD</p><h4 id="landing-fuel-title">One lander. Destination load.</h4></div><button type="button" data-flight-full>Reset to 100 %</button></header><div class="landing-fuel-grid" data-flight-fuel-controls></div><p class="landing-fuel-note">The load changes propellant and initial mass in the engine. A percentage is not a probability or a touchdown guarantee. Rover: 350 kg included in the dry mass; the NASA mesh does not determine mass.</p><details class="landing-presets"><summary>Advanced failure tests</summary><label>Load preset<select data-flight-condition><option value="nominal">Nominal profile · target at 100 %</option><option value="custom">Custom load · controls above</option><option value="target-empty-fuel">No propellant · target</option></select></label><p>Choosing a preset updates the target load. Loads are locked during flight.</p></details></section>

    <dl class="preparation-summary" data-preparation-summary aria-label="Mission summary"></dl>
    <p class="preparation-warning" data-preparation-warning></p>
    </section>
    </section>
    <footer class="preparation-footer"><p data-preparation-status role="status">Review both stages before confirming.</p><div><button type="button" class="landing-secondary" data-preparation-back hidden>← Destination zone</button><button type="button" class="landing-primary" data-preparation-next>Load and summary →</button><button type="button" class="landing-primary" data-preparation-confirm hidden>Confirm preparation</button></div></footer>
  </dialog>`;
  const selectors = new Map();
  const q = selector => { if (!selectors.has(selector)) selectors.set(selector, root.querySelector(selector)); return selectors.get(selector); };
  const prop = (node,key,value) => { if(node[key]!==value)node[key]=value; };
  const attr = (node,key,value) => { if(node.getAttribute(key)!==String(value))node.setAttribute(key,String(value)); };
  const prep = q('[data-preparation-dialog]');
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let phaseAnimation=null;
  motionQuery.addEventListener?.('change',event=>{if(event.matches)phaseAnimation?.cancel();});
  let preparationStep='zone', zoneReviewed=false, returnFocus=null;
  function showStep(step, focus=true) {
    preparationStep=step;
    for(const name of ['zone','load']) {
      q(`[data-preparation-step=${name}]`).hidden=name!==step;
      const indicator=q(`[data-preparation-indicator=${name}]`);
      if(name===step)attr(indicator,'aria-current','step');else indicator.removeAttribute('aria-current');
      attr(indicator,'data-complete',name==='zone'&&zoneReviewed);
    }
    q('[data-preparation-back]').hidden=step==='zone';q('[data-preparation-next]').hidden=step!=='zone';q('[data-preparation-confirm]').hidden=step!=='load';
    q('.landing-workbench').scrollTop=0;
    if(focus)(step==='load'?fuelControls.target.slider:root.querySelector('.landing-map-marker:not(:disabled)')||q('#preparation-title')).focus({preventScroll:true});
  }
  function openPreparation() {
    if(controller.active||!isReady())return false;
    returnFocus=document.activeElement;zoneReviewed=false;showStep('zone',false);update();
    if(!prep.open)prep.showModal();updatePreparationSummary(controller.renderState());
    q('#preparation-title').focus({preventScroll:true});return true;
  }
  function closePreparation() { if(prep.open)prep.close(); }
  prep.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...prep.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]')].filter(node=>node.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===q('#preparation-title'))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  prep.addEventListener('close',()=>{ (returnFocus?.isConnected&&!returnFocus.closest('dialog')?returnFocus:q('[data-flight-plan]')).focus({preventScroll:true}); });
  q('[data-preparation-close]').addEventListener('click',closePreparation);
  q('[data-preparation-next]').addEventListener('click',()=>{zoneReviewed=true;showStep('load');});
  q('[data-preparation-back]').addEventListener('click',()=>showStep('zone'));
  q('[data-preparation-confirm]').addEventListener('click',()=>{
    if(preparationStep==='load'&&onConfirmPreparation?.({zoneReviewed,loadReviewed:true})){returnFocus=q('[data-flight-action]');closePreparation();update();q('[data-flight-action]').focus();}
  });
  const camera = q('[data-flight-camera]'), slopes = q('[data-flight-slopes]'), timeline=[...root.querySelectorAll('.landing-timeline li')], rateButtons=[...root.querySelectorAll('[data-flight-rate]')];
  let layers = new Map(), planSignature = null, profileSignature = null, lastPhase = '', lastPlanRevision=-1, lastPlanActive=null, lastFuelProfile=null,lastFuelValue=null,lastFuelActive=null,lastProfileText=null, fuel = {earth:100,target:100};
  const instruments = {}, fuelControls = {}, plansDOM = {};
  for (const key of ['target']) {
    const card = make('article','landing-instruments'), title=make('strong'), dl=make('dl'), values={};
    card.append(title,dl);
    for (const [id,label] of [['altitudeM','AGL altitude'],['verticalSpeedMs','Vertical'],['horizontalSpeedMs','Horizontal'],['propellantKg','Propellant']]) {
      const row=make('div'), dt=make('dt','',label), dd=make('dd','','—'); row.append(dt,dd); dl.append(row); values[id]=dd;
    }
    const progress=make('progress'); progress.max=100; progress.value=100; progress.setAttribute('aria-label',`${key === 'earth' ? 'Earth' : 'Target'} propellant relative to the full profile`);
    const detail=make('p','landing-instrument-detail'); card.append(progress,detail); q('[data-flight-readings]').append(card);
    instruments[key]={card,title,values,progress,detail};
    const label=make('label','landing-fuel-control'), top=make('span'), name=make('strong'), output=make('output'), slider=make('input'), detailFuel=make('span','landing-fuel-mass');
    slider.type='range'; slider.min='0'; slider.max='100'; slider.step='1'; slider.value='100'; slider.dataset.flightFuel=key; slider.id=`landing-fuel-${key}`; output.htmlFor=slider.id;
    top.append(name,output); label.append(top,slider,detailFuel); q('[data-flight-fuel-controls]').append(label); fuelControls[key]={slider,output,name,detail:detailFuel};
    slider.addEventListener('input',()=>{ if(controller.active)return; const value=Number(slider.value);if(value!==fuel[key]){fuel[key]=value;onPreparationChange?.('fuel');} syncPreset(); update(); });
  }
  function syncPreset() {
    q('[data-flight-condition]').value=fuel.target===100?'nominal':fuel.target===0?'target-empty-fuel':'custom';
  }
  function resetPreparation() { closePreparation();zoneReviewed=false; q('[data-flight-compare]').checked=false; q('[data-analogue-details]').hidden=true; fuel={earth:100,target:100}; syncPreset(); planSignature=null;lastPlanRevision=-1; update();if(isReady()&&!root.hidden)openPreparation(); }
  q('[data-flight-condition]').addEventListener('change',event=>{
    if(controller.active)return;
    const preset=event.target.value;
    if(preset==='custom')return;
    const value=preset==='nominal'?100:0;if(fuel.target!==value){fuel={earth:100,target:value};onPreparationChange?.('fuel');}update();
  });
  q('[data-flight-full]').addEventListener('click',()=>{if(!controller.active){if(fuel.target!==100){fuel={earth:100,target:100};onPreparationChange?.('fuel');}syncPreset();update();}});
  q('[data-flight-abort]').addEventListener('click', () => onAbort?.());
  q('[data-flight-action]').addEventListener('click', () => onAction?.());
  q('[data-flight-reset]').addEventListener('click', () => onReset?.());
  q('[data-flight-focus]').addEventListener('click', () => onFocusScene?.());
  q('[data-flight-plan]').addEventListener('click',openPreparation);
  q('[data-flight-drive]').addEventListener('click', () => onExplore?.());
  for(const button of root.querySelectorAll('[data-flight-rate]')) button.addEventListener('click',()=>{controller.setOptions({timeScale:Number(button.dataset.flightRate)}); update();});
  q('[data-flight-dismiss]').addEventListener('click',()=>{q('[data-flight-guide]').hidden=true;try{localStorage.setItem('atlas-landing-guide','target-preparation-v3');}catch{/* session only */}});
  try{q('[data-flight-guide]').hidden=localStorage.getItem('atlas-landing-guide')==='target-preparation-v3';}catch{/* guide remains available */}
  q('[data-flight-compare]').addEventListener('change',event=>{q('[data-analogue-details]').hidden=!event.target.checked;onCompare?.(event.target.checked);});
  function selectZone(key,id) { if(onChoose?.(key,id)){ update(); } }
  function drawMap(key,canvas) {
    const grid=getGrid(key)||layers.get(key)?.terrain.grid;
    const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!grid?.elevation?.length)return;
    const heights=grid.elevation.filter(Number.isFinite),low=Math.min(...heights),high=Math.max(...heights),n=grid.gridSize;
    const image=ctx.createImageData(n,n);
    for(let i=0;i<n*n;i++){const h=grid.elevation[i],t=Number.isFinite(h)?(h-low)/Math.max(1,high-low):0; image.data.set([12+30*t,42+75*t,83+85*t,255],i*4);}
    const raster=document.createElement('canvas');raster.width=n;raster.height=n;raster.getContext('2d').putImageData(image,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(raster,0,0,canvas.width,canvas.height);
  }
  function plansUI(view) {
    const signature=view.plans?.target?.zones;
    if(signature!==planSignature){
      planSignature=signature; const box=q('[data-flight-candidates]');box.replaceChildren();
      for(const key of ['target']){
        const plan=view.plans?.[key],column=make('article','landing-plan-column'),title=make('h4','',`${bodyName(key,view.profiles?.[key])} / CONTACTO REGIONAL`);
        column.append(title);box.append(column); plansDOM[key]=null;
        if(!plan?.grid){column.append(make('p','landing-missing','No assessable DEM. No invented region is drawn; you can review the not-assessable result.'));continue;}
        const map=make('div','landing-region-map');map.dataset.mapBody=key;map.setAttribute('role','group');map.setAttribute('aria-label',`Regional map ${bodyName(key,view.profiles?.[key])}; select a numbered candidate`);
        const canvas=make('canvas');canvas.width=320;canvas.height=320;canvas.setAttribute('aria-hidden','true');map.append(canvas);
        const grid=make('div','landing-map-grid');grid.setAttribute('aria-hidden','true');map.append(grid);
        const extent=(plan.grid.gridSize-1)*plan.grid.spacingMeters,point=plan.zones?.[0]?.sciencePoint||{x:0,z:0};
        const position=(x,z)=>({left:`${8+(x/extent+.5)*84}%`,top:`${8+(z/extent+.5)*84}%`});
        const science=make('span','landing-science','◇');Object.assign(science.style,position(point.x,point.z));science.title='Science target';map.append(science);
        const north=make('span','landing-map-north','N ↑'),scale=make('span','landing-map-scale',`${number(extent,0)} × ${number(extent,0)} m`);map.append(north,scale);
        const list=make('div','landing-zone-list'),buttons=[];
        for(const [i,zone] of (plan.zones||[]).slice(0,3).entries()){
          const marker=make('button','landing-map-marker',String(i+1));marker.type='button';marker.dataset.zone=zone.id;marker.dataset.body=key;marker.dataset.mapZone=zone.id;marker.dataset.status=zone.status;Object.assign(marker.style,position(zone.x,zone.z));marker.setAttribute('aria-label',`Choose touchdown ${i+1} on ${bodyName(key,view.profiles?.[key])}: slope ${number(zone.slopeDeg)} degrees, relief ${number(zone.reliefM,0)} meters, science at ${number(zone.scienceDistanceM,0)} meters`);map.append(marker);
          const button=make('button','landing-zone');button.type='button';button.dataset.zone=zone.id;button.dataset.body=key;button.dataset.status=zone.status;
          button.append(make('b','landing-zone-number',String(i+1).padStart(2,'0')),make('strong','',statusNames[zone.status]||zone.status),make('span','',`${number(zone.slopeDeg)}° slope · ${number(zone.reliefM,0)} m relief · ${number(zone.scienceDistanceM,0)} m to science`));button.title=zone.reason||'Regional assessment';list.append(button);
          for(const element of [marker,button])element.addEventListener('click',()=>selectZone(key,zone.id));buttons.push({zone,marker,button});
        }
        map.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||!event.target.matches('.landing-map-marker'))return;event.preventDefault();const available=buttons.map(b=>b.marker).filter(b=>!b.disabled),index=available.indexOf(event.target),delta=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;available[(index+delta+available.length)%available.length]?.focus();});
        const explanation=make('p','landing-choice-explanation'),source=make('p','landing-dem-source',`${plan.grid.dataset||'DEM'} · spacing ${number(plan.grid.spacingMeters)} m / native resolution ${number(plan.grid.nativeResolutionMeters)} m.`);
        column.append(map,list,explanation,source);plansDOM[key]={buttons,explanation,canvas};drawMap(key,canvas);
      }
    }
    for(const key of ['target']){
      const dom=plansDOM[key],plan=view.plans?.[key];if(!dom)continue;
      const selected=plan.zones.find(zone=>zone.id===plan.selectedId);
      for(const {zone,marker,button} of dom.buttons)for(const node of [marker,button]){attr(node,'aria-pressed',zone.id===plan.selectedId);prop(node,'disabled',view.active||zone.eligible===false||zone.status==='unevaluable');}
      const index=dom.buttons.findIndex(b=>b.zone.id===plan.selectedId);
      text(dom.explanation,selected?`Touchdown ${index+1} selected · x ${number(selected.x,0)}, z ${number(selected.z,0)} m. Changing it alters the slope, regional relief and distance to science; it does not move the science target.`:'No eligible candidate: no touchdown is forced.');
    }
  }
  function update(view=controller.renderState()) {
    const prepared=isPrepared(view), phase=view.phase, running=phase==='exploration'?isRunning():view.running, rate=view.options?.timeScale??1, isFailed=failed(phase), contact=phase==='contact', explore=phase==='exploration';
    attr(root,'data-phase',phase);attr(root,'data-prepared',prepared);attr(root,'data-paused',view.active&&!running&&!contact&&!isFailed);attr(root.closest('.viewport-panel'),'data-landing-stage',phase);
    if(lastPhase!==phase){
      lastPhase=phase;phaseAnimation?.cancel();
      if(!motionQuery.matches)phaseAnimation=q('.landing-status').animate([{opacity:.4,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:400,easing:'ease-out'});
    }
    text(q('[data-flight-phase]'),phaseNames[phase]||phase);prop(q('[data-flight-pause]'),'hidden',!(view.active&&!running&&!contact&&!isFailed));
    const index={ready:0,preparation:1,descent:2,contact:3,deployment:3,exploration:4}[phase]??1;
    timeline.forEach((e,i)=>{attr(e,'data-current',i===index);attr(e,'data-complete',i<index);if(i===index)attr(e,'aria-current','step');else if(e.hasAttribute('aria-current'))e.removeAttribute('aria-current');});
    const mirror=view.mirrorAvailable, analogue=getAnalogue();
    text(q('[data-analogue-title]'),`Automatic reference · ${analogue.name || 'scenario analog'}`);
    text(q('[data-analogue-purpose]'),analogue.purpose || 'The scenario’s Earth region provides a reference for the test.');
    const origin=view.explorationOrigins?.earth;
    text(q('[data-analogue-origin]'),origin?`Surface test rover: x ${number(origin.x,0)}, z ${number(origin.z,0)} m; DEM elevation ${number(origin.elevationM)} m. Automatic origin, with no Earth landing or fuel selected.`:'No valid Earth origin: the destination can land, but mirror driving is unavailable. No terrain or test position is invented.');
    const purpose=contact?'Destination touchdown computed. Review the result and manually authorize deployment.':isFailed?'The destination did not achieve nominal touchdown. The rover stays held; reset to adjust zone or load.':explore?(mirror?'Earth test rover → simulated mirror rover at the destination. Synchronized relative displacement; each rover evaluates its own ground. No hardware link and no copying of absolute coordinates.':'Destination deployed. Mirror driving unavailable: a valid Earth origin or target coverage is missing.'):phase==='deployment'?'Authorization received. Deploying at the destination touchdown; the Earth test uses its automatic surface origin.':view.active?'Final powered descent at the destination. You can change camera, speed or pause; the Earth comparison is optional.':'Prepare the destination zone and load. The automatic Earth analog helps evaluate the terrain; then descend and review the touchdown.';
    text(q('[data-flight-purpose]'),purpose); prop(q('[data-flight-plan]'),'hidden',view.active);
    const action=explore&&!mirror?'Mirror unavailable':contact?'Deploy rover':isFailed?'Prepare again':!view.active?(prepared?'Start descent':'Prepare mission'):`${running?'Ⅱ Pause':'▷ Resume'} ${explore?'exploration':phase==='deployment'?'deployment':'descent'}`;
    text(q('[data-flight-action]'),action);attr(q('[data-flight-action]'),'data-action',contact?'deploy':isFailed?'reset':!view.active?(prepared?'start':'prepare'):running?'pause':'resume');
    text(q('[data-flight-next]'),contact?'Next → authorize after nominal destination touchdown. Earth needs no landing.':explore?(mirror?'Next → drive, observe and download the report.':'You can review the touchdown and the report; reset to reload the Earth reference.'):isFailed?'Resetting lets you adjust again. Try restoring 100 % load.':view.active?'The speed change applies from now on; it does not rewrite the flight.':'Next → descent locks the zone and load. You can reset to adjust them.');
    prop(q('[data-flight-action]'),'disabled',!isReady()||(contact&&view.runs.target?.phase!=='contact')||(explore&&!mirror));
    text(q('[data-flight-time]'),`VUELO ${rate}× SIM · ROVER 20×`);
    prop(q('[data-flight-abort]'),'disabled',!view.active||explore||isFailed);
    prop(q('[data-flight-reset]'),'disabled',!view.active);
    prop(q('[data-flight-condition]'),'disabled',view.active);prop(q('[data-flight-full]'),'disabled',view.active);
    text(q('[data-flight-lock]'),view.active?'PLAN LOCKED · reset to edit':'EDITABLE UNTIL DESCENT');
    for(const button of rateButtons){attr(button,'aria-pressed',Number(button.dataset.flightRate)===rate);prop(button,'disabled',explore||isFailed);}
    prop(q('.landing-flight-tools'),'hidden',explore);
    const profileKey=view.profiles?.target?.id;
    if(profileKey!==profileSignature){profileSignature=profileKey;fuel={earth:100,target:100};syncPreset();}
    for(const key of ['target']){
      const run=view.runs[key],profile=view.profiles?.[key],dom=instruments[key],control=fuelControls[key],propellant=profile?profile.propellantKg*fuel[key]/100:null,mass=profile?profile.dryMassKg+propellant:null;
      if(lastFuelProfile!==profile||lastFuelValue!==fuel.target||lastFuelActive!==view.active){
      attr(control.slider,'aria-label',`Propellant load ${bodyName(key,profile)}`);prop(control.slider,'disabled',view.active||!profile);prop(control.slider,'value',String(fuel[key]));attr(control.slider,'aria-valuetext',`${fuel[key]} percent, ${number(propellant)} kilograms of propellant`);text(control.name,bodyName(key,profile));text(control.output,`${fuel[key]} %`);text(control.detail,`${number(propellant)} kg propellant · ${number(mass)} kg initial mass`);
      lastFuelProfile=profile;lastFuelValue=fuel.target;lastFuelActive=view.active;}
      text(dom.title,`${bodyName(key,profile)} · ${run?phaseNames[run.phase]||run.phase:'NOT STARTED'}`);
      for(const metric of ['altitudeM','verticalSpeedMs','horizontalSpeedMs','propellantKg'])text(dom.values[metric],`${number(metric==='propellantKg'?(run?.propellantKg??propellant):run?.[metric])} ${metric.endsWith('SpeedMs')?'m/s':metric==='propellantKg'?'kg':'m'}`);
      prop(dom.progress,'value',profile?Math.max(0,Math.min(100,(run?.propellantKg??propellant)/profile.propellantKg*100)):0);
      text(dom.detail,`Mass ${number(run?.massKg??mass)} kg · T+ ${number(run?.simSeconds??0)} s SIM`);
      text(q(`[data-result=${key}]`),`${bodyName(key,profile)} — ${run?.outcome?.label||'No result yet.'}`);
    }
    text(q('[data-result=earth]'),origin?'EARTH · Surface test reference; no flight or fuel.':'EARTH · No test origin; mirror driving unavailable.');
    prop(q('[data-flight-results]'),'hidden',!(contact||isFailed||explore||phase==='deployment'));
    prop(q('[data-flight-explore]'),'hidden',!explore); prop(q('[data-flight-drive]'),'disabled',!mirror);
    if(explore){
    const distances=['earth','target'].map(key=>{const run=view.runs[key],pose=getRoverPose(key),point=run?.target?.sciencePoint||view.plans?.[key]?.sciencePoint;return `${bodyName(key,view.profiles?.[key])}: ${number(pose&&point?Math.hypot(pose.x-point.x,pose.z-point.z):null,0)} m`;});
    text(q('[data-flight-science]'),`◇ Rover distance to science · ${distances.join(' · ')}. The pink diamond guides exploration; it does not move the rover to it.`);
    }
    if(lastProfileText!==view.profiles?.target){lastProfileText=view.profiles?.target;text(q('[data-flight-profile]'),[view.profiles?.target].filter(Boolean).map(p=>`${p.label}: dry ${number(p.dryMassKg,0)} kg, capacity ${number(p.propellantKg,0)} kg, Isp ${number(p.ispSeconds,0)} s, max thrust ${number(p.thrustMaxN,0)} N. Touchdown ≤ ${number(p.touchdownVerticalSpeedMs)} m/s vertical and ≤ ${number(p.touchdownHorizontalSpeedMs)} m/s horizontal (design hypothesis).`).join(' '));}

    if(lastPlanRevision!==view.planRevision||lastPlanActive!==view.active){plansUI(view);lastPlanRevision=view.planRevision;lastPlanActive=view.active;}
    if(prep.open)updatePreparationSummary(view);
    for(const layer of layers.values())layer.slopes.visible=slopes.checked;
  }
  const summaryRows={};
  for(const [key,label] of [['body','Destination body'],['zone','Selected zone'],['slope','Regional slope'],['relief','Regional relief'],['fuel','Propellant'],['mass','Initial mass']]) {
    const row=make('div'),dt=make('dt','',label),dd=make('dd','','—');row.append(dt,dd);q('[data-preparation-summary]').append(row);summaryRows[key]=dd;
  }
  function updatePreparationSummary(view) {
    const plan=view.plans?.target,profile=view.profiles?.target,zone=plan?.zones?.find(z=>z.id===plan.selectedId);
    const kg=(profile?.propellantKg??0)*fuel.target/100;
    text(summaryRows.body,bodyName('target',profile));text(summaryRows.zone,zone?`Touchdown ${plan.zones.findIndex(item=>item.id===zone.id)+1} · x ${number(zone.x,0)}, z ${number(zone.z,0)} m`:'No eligible candidate');
    text(summaryRows.slope,`${number(zone?.slopeDeg)}°`);text(summaryRows.relief,`${number(zone?.reliefM)} m`);text(summaryRows.fuel,`${fuel.target} % · ${number(kg)} kg`);text(summaryRows.mass,`${number(profile?profile.dryMassKg+kg:null)} kg`);
    const valid=Boolean(plan?.grid&&zone&&zone.eligible!==false&&zone.status!=='unevaluable'&&profile);
    prop(q('[data-preparation-next]'),'disabled',!valid);prop(q('[data-preparation-confirm]'),'disabled',!valid||view.active);
    text(q('[data-preparation-warning]'),!valid?'No DEM or assessable candidate: a descent cannot be confirmed or forced.':fuel.target===0?'Deliberate failure test: 0 kg of propellant. The lander will have no thrust; touchdown may fail and the rover will stay held.':'Regional assessment of the destination, not a safety certification. The DEM does not resolve landing legs, rocks or cavities. Earth is an optional reference, with no second landing.');
    text(q('[data-preparation-status]'),isPrepared(view)?'Preparation confirmed. You can edit; changing zone or load requires confirming again.':preparationStep==='zone'?'1 of 2 · Choose and review a destination touchdown.':'2 of 2 · Review the load and summary before confirming.');
  }
  function attach(key, terrain, { U = 0.1, EXAG = 2 } = {}) {
    const old = layers.get(key); if (old) { old.root.removeFromParent(); old.root.traverse(o => { o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material?.dispose(); }); }
    const group = new THREE.Group(); group.visible=!root.hidden; terrain.scene.add(group);
    const ground = (x,z) => { const h = sampleHeight(terrain.grid,x,z); return h === null ? 0 : (h-terrain.base)*EXAG*U; };
    const mat = color => new THREE.MeshStandardMaterial({color,roughness:0.65,metalness:0.3});
    const lander = new THREE.Group(), scale = 6*U;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6*scale,1.8*scale,1.5*scale,8),mat(0xd4b778)); body.position.y = 2*scale;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3*scale,0.15*scale,2.3*scale),mat(0xe6eef6)); deck.position.y = 2.85*scale;
    const engine = new THREE.Mesh(new THREE.ConeGeometry(0.65*scale,1.2*scale,16,1,true),mat(0x718391)); engine.position.y = 0.9*scale; engine.rotation.x = Math.PI;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.045*scale,0.045*scale,2.5*scale,6),mat(0xe6eef6)); antenna.position.set(0.8*scale,4*scale,0);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6*scale,12,8,0,Math.PI*2,0,Math.PI/2),mat(0x459ded)); dish.rotation.z = Math.PI/3; dish.position.set(0.8*scale,5.2*scale,0);
    lander.add(body,deck,engine,antenna,dish);
    const footGeometry = new THREE.CylinderGeometry(0.45*scale,0.5*scale,0.1*scale,12);
    for (const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]) {
      const foot = new THREE.Mesh(footGeometry,mat(0x9caebe)); foot.position.set(Math.sin(a)*3*scale,0.05*scale,Math.cos(a)*3*scale); lander.add(foot);
      const from = new THREE.Vector3(Math.sin(a)*1.3*scale,2*scale,Math.cos(a)*1.3*scale), delta = foot.position.clone().sub(from);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09*scale,0.09*scale,delta.length(),8),mat(0xe6eef6)); leg.position.copy(from.addScaledVector(delta,0.5)); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); lander.add(leg);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45*scale,4*scale,12),new THREE.MeshBasicMaterial({color:0x8edcff,transparent:true,opacity:0.65,depthWrite:false})); flame.rotation.x = Math.PI; flame.position.y = -1.1*scale; lander.add(flame);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(3.3*scale,32),new THREE.MeshBasicMaterial({color:0x030c16,transparent:true,opacity:0.3,depthWrite:false})); shadow.rotation.x = -Math.PI/2;
    const rings = new THREE.Group(), slopePoints = [], slopeColors = [];
    if (terrain.grid) {
      const half = gridExtent(terrain.grid)/2;
      for (let z=-half;z<=half;z+=terrain.grid.spacingMeters*2) for (let x=-half;x<=half;x+=terrain.grid.spacingMeters*2) {
        const slope = sampleSlope(terrain.grid,x,z), c = new THREE.Color(slope === null ? 0x8393a1 : slope>12 ? 0xff895b : 0xe4cf68);
        slopePoints.push(x*U,ground(x,z)+0.45,z*U); slopeColors.push(c.r,c.g,c.b);
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(slopePoints,3)); geometry.setAttribute('color',new THREE.Float32BufferAttribute(slopeColors,3));
    const points = new THREE.Points(geometry,new THREE.PointsMaterial({size:1.4,vertexColors:true,transparent:true,opacity:0.5,depthWrite:false}));
    const science = new THREE.Mesh(new THREE.OctahedronGeometry(2,0),new THREE.MeshBasicMaterial({color:0xef83dc,wireframe:true})); science.position.set(0,ground(0,0)+3,0); rings.add(science);
    const trailGeometry = new THREE.BufferGeometry(); trailGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(1200*3),3)); trailGeometry.setDrawRange(0,0);
    const trail = new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:0x7fe7fa})); trail.frustumCulled = false;
    const predicted = new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xded995,dashSize:2,gapSize:1}));
    group.add(lander,shadow,rings,points,trail,predicted);
    layers.set(key,{root:group,lander,shadow,rings,slopes:points,trail,predicted,flame,ground,terrain,U,EXAG,zoneSignature:null,cameraPose:null}); update(); if(plansDOM[key]?.canvas)drawMap(key,plansDOM[key].canvas);
  }
  function scene(key, view=controller.renderState()) {
    const layer = layers.get(key); if (!layer) return;
    const plan = view.plans?.[key], profile = view.profiles?.[key];
    const zonePreview=plan?.zones?.find(z=>z.id===plan.selectedId);
    const run=view.runs[key] || (key==='target'&&zonePreview&&profile?{x:zonePreview.x+profile.startOffsetXM,z:zonePreview.z+profile.startOffsetZM,altitudeM:profile.startAltitudeM}:null);
    layer.root.visible = !root.hidden && Boolean(layer.terrain.grid);
    const signature = view.planRevision;
    if (signature !== layer.zoneSignature) {
      layer.zoneSignature = signature;
      for (const child of [...layer.rings.children].slice(1)) { child.geometry?.dispose(); child.material?.dispose(); layer.rings.remove(child); }
      for (const zone of (key==='target'?plan?.zones || []:[]).slice(0,3)) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(7,plan.selectedId===zone.id ? 8.6:7.5,48),new THREE.MeshBasicMaterial({color:zone.status==='unevaluable'?0x8393a1:zone.status==='caution'?0xff895b:0xe4cf68,side:THREE.DoubleSide})); ring.rotation.x=-Math.PI/2; ring.position.set(zone.x*layer.U,layer.ground(zone.x,zone.z)+0.6,zone.z*layer.U); layer.rings.add(ring);
      }
      const zone = plan?.zones.find(z=>z.id===plan.selectedId);
      const p = key==='target' && zone && profile ? [new THREE.Vector3((zone.x+profile.startOffsetXM)*layer.U,layer.ground(zone.x+profile.startOffsetXM,zone.z+profile.startOffsetZM)+profile.startAltitudeM*layer.U,(zone.z+profile.startOffsetZM)*layer.U),new THREE.Vector3(zone.x*layer.U,layer.ground(zone.x,zone.z),zone.z*layer.U)] : [];
      layer.predicted.geometry.dispose(); layer.predicted.geometry=new THREE.BufferGeometry().setFromPoints(p); layer.predicted.computeLineDistances();
    }
    layer.lander.visible = key==='target' && Boolean(run && Number.isFinite(run.x) && Number.isFinite(run.z) && Number.isFinite(run.altitudeM));
    layer.shadow.visible = layer.lander.visible;
    if (layer.lander.visible) {
      layer.lander.position.set(run.x*layer.U,layer.ground(run.x,run.z)+run.altitudeM*layer.U,run.z*layer.U);
      layer.lander.rotation.set((run.pitchDeg || 0)*Math.PI/180,0,(run.rollDeg || 0)*Math.PI/180);
      layer.flame.visible = run.thrustN>0 && view.phase==='descent';
      layer.flame.scale.y = 0.4+Math.min(1,run.thrustN/(profile?.thrustMaxN || 1));
      layer.shadow.position.set(run.x*layer.U,layer.ground(run.x,run.z)+0.25,run.z*layer.U); layer.shadow.material.opacity = 0.32/(1+run.altitudeM/80);
    }
    if(layer.historyRevision!==view.historyRevision){
      const history=view.history,positions=layer.trail.geometry.attributes.position;
      // A retained ring can shift at 1200 samples; rebuild only when a new sample/reset arrives.
      let count=0;for(const row of history){const r=row[key];if(!r||!Number.isFinite(r.x)||!Number.isFinite(r.altitudeM))continue;positions.setXYZ(count++,r.x*layer.U,layer.ground(r.x,r.z)+r.altitudeM*layer.U,r.z*layer.U);}
      positions.needsUpdate=true;layer.trail.geometry.setDrawRange(0,count);layer.historyRevision=view.historyRevision;
    }
  }
  function setCamera(key, cam, view=controller.renderState()) {
    const layer=layers.get(key);if(!layer)return false;
    if(view.deployed && view.mirrorAvailable){
      const pose=layer.cameraPose;if(!pose)return false;
      const now=performance.now();layer.deployedAt??=now;
      const t=Math.min(1,(now-layer.deployedAt)/700),blend=t*t*(3-2*t);
      if(t>=1||motionQuery.matches){layer.cameraPose=null;return false;}
      cam.position.lerpVectors(pose.position,cam.position,blend);cam.quaternion.slerpQuaternions(pose.quaternion,cam.quaternion,blend);return true;
    }
    const run=view.runs[key],zone=view.plans?.[key]?.zones.find(z=>z.id===view.plans[key].selectedId);
    const x=(key==='earth'?view.explorationOrigins?.earth?.x??0:run?.x??zone?.x??0)*layer.U,z=(key==='earth'?view.explorationOrigins?.earth?.z??0:run?.z??zone?.z??0)*layer.U,y=layer.ground(x/layer.U,z/layer.U)+(run?.altitudeM||0)*layer.U;
    const position=new THREE.Vector3(),look=new THREE.Vector3();
    const mode=key==='earth'||!view.active||view.phase==='preparation'?'orbital':camera.value;
    if(mode==='orbital'){position.set(x+80,y+110,z+90);look.set(x,layer.ground(x/layer.U,z/layer.U),z);}
    else if(mode==='lower'){position.set(x+1,y+1.5,z+1);look.set((zone?.x||0)*layer.U,layer.ground(zone?.x||0,zone?.z||0),(zone?.z||0)*layer.U);}
    else{position.set(x+15,y+10,z+22);look.set(x,y+1.4,z);}
    const now=performance.now();
    if(!layer.cameraPose){layer.cameraPose={position:position.clone(),look:look.clone(),at:now,mode,transition:0};}
    const pose=layer.cameraPose;
    if(mode!==pose.mode){pose.mode=mode;pose.transition=now+550;}
    const smoothing=now<pose.transition&&!motionQuery.matches;
    const alpha=smoothing?1-Math.exp(-Math.min(.1,(now-pose.at)/1000)*9):1;
    pose.position.lerp(position,alpha);pose.look.lerp(look,alpha);pose.at=now;
    cam.near=.15;cam.fov=45;cam.position.copy(pose.position);cam.lookAt(pose.look);pose.quaternion=cam.quaternion.clone();return true;
  }
  function setVisible(visible) { for(const layer of layers.values())layer.root.visible=visible&&Boolean(layer.terrain.grid); }
  return {update,attach,scene,setCamera,setVisible,resetPreparation,openPreparation,closePreparation, fuelPercent:()=>fuel.target, initialConditions: () => ({target:{propellantKg:(controller.renderState().profiles?.target?.propellantKg??0)*fuel.target/100}})};
}
