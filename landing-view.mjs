import * as THREE from './assets/vendor/three.module.min.js';
import { sampleHeight, sampleSlope, gridExtent } from './mission-math.mjs';
const phaseNames = { ready:'Preparar el descenso', preparation:'Reconociendo la región', descent:'Descenso en curso', contact:'Revisar el contacto', deployment:'Desplegando rover', exploration:'Explorar la superficie', 'hard-contact':'Contacto fuera de tolerancias', aborted:'Ensayo interrumpido', unavailable:'Región no evaluable' };
const number = (v, digits = 1) => Number.isFinite(v) ? v.toLocaleString('es', { maximumFractionDigits:digits, minimumFractionDigits:digits }) : '—';
const statusNames = {candidate:'Candidato regional', caution:'Precaución regional', unevaluable:'No evaluable'};
const make = (tag, className, text) => { const e = document.createElement(tag); e.className = className || ''; if (text !== undefined) e.textContent = text; return e; };
const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
const bodyName = (key, profile) => key === 'earth' ? 'TIERRA' : profile?.body === 'moon' ? 'LUNA' : 'MARTE';
const failed = phase => ['hard-contact','aborted','unavailable'].includes(phase);
export function createLandingView(root, { controller, onChoose, onAbort, onAction, onReset, onFocusScene, onExplore, onCompare, onPreparationChange, onConfirmPreparation, isPrepared = () => false, getAnalogue = () => ({}), isReady = () => true, getGrid = () => null, getRoverPose = () => null, isRunning = () => controller.running } = {}) {
  root.innerHTML = `<section class="landing-command" aria-label="Mando del descenso">
    <div class="landing-heading"><p class="eyebrow">ATLAS / MISIÓN AL DESTINO</p><span class="landing-model">MODELO · SI</span></div>
    <ol class="landing-timeline" aria-label="Etapas de misión"><li><b>01</b>Zona</li><li><b>02</b>Análogo</li><li><b>03</b>Descender</li><li><b>04</b>Revisar / desplegar</li><li><b>05</b>Explorar</li></ol>
    <div class="landing-status"><h3 data-flight-phase role="status"></h3><span data-flight-pause hidden>Ⅱ EN PAUSA</span></div>
    <p data-flight-purpose class="landing-purpose"></p>
    <div class="landing-actions"><button type="button" class="landing-primary" data-flight-action>Descender <span aria-hidden="true">↘</span></button><button type="button" class="landing-secondary" data-flight-focus>Ver aterrizaje ↗</button><button type="button" class="landing-secondary" data-flight-plan>Preparar misión</button></div>
    <p class="landing-action-hint" data-flight-next></p>
    <div class="landing-flight-tools"><label>Cámara<select data-flight-camera aria-label="Cámara de descenso"><option value="exterior">Exterior · seguimiento</option><option value="lower">Inferior · contacto</option><option value="orbital">Orbital · región</option></select></label><fieldset class="landing-rate"><legend>Velocidad del vuelo · SIM</legend><div role="group" aria-label="Velocidad de simulación"><button type="button" data-flight-rate="0.5" aria-pressed="false">0,5×</button><button type="button" data-flight-rate="1" aria-pressed="true">1×</button><button type="button" data-flight-rate="2" aria-pressed="false">2×</button><button type="button" data-flight-rate="4" aria-pressed="false">4×</button></div></fieldset></div>
    <div class="landing-readings" data-flight-readings></div>
    <div class="landing-result" data-flight-results hidden><p class="eyebrow">CONTACTO EN EL DESTINO</p><p data-result="target"></p><p data-result="earth"></p></div>
    <div class="landing-explore" data-flight-explore hidden><p data-flight-science></p><button type="button" data-flight-drive>Conducir rover ↓</button><a href="#analogy-audit">Comparar y descargar reporte M2 ↗</a></div>
    <details class="landing-reference"><summary>Análogo y alcance del ensayo</summary>    <section class="landing-analogue"><p class="eyebrow">02 / EVALUAR CON ANÁLOGO</p><h4 data-analogue-title></h4><p data-analogue-purpose></p><p>Sirve para contrastar terreno, pendientes y navegación. La gravedad y la atmósfera son distintas: el clima terrestre no gobierna la nave lunar o marciana. El DEM regional no resuelve patas, rocas ni cavidades.</p><label class="landing-check"><input type="checkbox" data-flight-compare> Comparar análogo · opcional</label><div data-analogue-details hidden><p data-analogue-origin></p><a href="#analogy-audit">Abrir datos, análisis y reporte M2 ↗</a></div></section>
    <details class="landing-scope"><summary>Capas, criterios y límites del ensayo</summary><label class="landing-check"><input type="checkbox" data-flight-slopes checked> Mostrar pendientes regionales en 3D</label><p>Se comparan pendiente, desnivel, distancia científica y cobertura con un ranking heurístico. Amarillo: candidato; naranja: precaución; gris: no evaluable. Los colores no certifican seguridad ni representan probabilidad.</p><p>DEM a 37,5 m por nodo: no resuelve patas, rocas ni el pozo de Marius. Relieve visual ×2; nave esquemática ×6. AGL y dinámica en metros SI sin exageración. Línea discontinua: previsión esquemática; continua: muestras del vuelo simulado.</p><p>Tierra: región automática de ensayo y comparación, sin nave ni segundo aterrizaje. Luna: vacío. Marte: solo tramo propulsado final idealizado; sin entrada, paracaídas ni aerodinámica. El clima terrestre es contexto, nunca fuerzas marcianas. Navegación automática idealizada, sin TRN ni visión NASA implementada.</p><p data-flight-profile></p><a href="docs/descenso-modelo.md" target="_blank" rel="noopener">Modelo y fuentes ↗</a> · <a href="docs/descenso-uso.md" target="_blank" rel="noopener">Guía del descenso ↗</a></details></details>
    <div class="landing-footer"><span data-flight-time></span><button type="button" data-flight-reset>↺ Preparar de nuevo</button><button type="button" data-flight-abort>Interrumpir</button></div>
  </section>
  <dialog class="landing-preparation" data-preparation-dialog aria-labelledby="preparation-title" aria-describedby="preparation-intro">
    <header class="preparation-header"><div><p class="eyebrow">ANTES DEL DESCENSO / DESTINO</p><h3 id="preparation-title" tabindex="-1">Preparar misión</h3><p id="preparation-intro">Elegí zona y carga. Confirmar habilita el inicio; no pone la nave en vuelo.</p></div><button type="button" data-preparation-close aria-label="Cerrar preparación sin iniciar">×</button></header>
    <ol class="preparation-steps" aria-label="Etapas de preparación"><li data-preparation-indicator="zone" aria-current="step"><b>01</b> Zona del destino</li><li data-preparation-indicator="load"><b>02</b> Carga y resumen</li></ol>
    <section class="landing-workbench" aria-label="Preparación regional">
    <div class="landing-guide" data-flight-guide><span aria-hidden="true">⌖</span><p><strong>Tu misión empieza con una elección.</strong> Revisá los candidatos del mapa; después elegí la carga del destino.</p><button type="button" data-flight-dismiss aria-label="Ocultar guía inicial">Entendido ×</button></div>
    <section data-preparation-step="zone">
    <header class="landing-prep-heading"><div><p class="eyebrow">01 / ZONA DEL DESTINO</p><h3>Prepará el contacto en Luna o Marte.</h3></div><span data-flight-lock></span></header>
    <p class="landing-map-note">Mapa del DEM del destino, sin imagen satelital. Azul: elevación relativa. Marco local del objetivo: x este →, z sur ↓. ◇ Ciencia · círculos numerados: contactos propuestos.</p>
    <div class="landing-candidates" data-flight-candidates></div>
    </section>
    <section data-preparation-step="load" hidden>
    <section class="landing-fuel" aria-labelledby="landing-fuel-title"><header><div><p class="eyebrow">CARGA DE PREPARACIÓN</p><h4 id="landing-fuel-title">Una nave. Carga del destino.</h4></div><button type="button" data-flight-full>Restablecer 100 %</button></header><div class="landing-fuel-grid" data-flight-fuel-controls></div><p class="landing-fuel-note">La carga cambia el propelente y la masa inicial en el motor. Un porcentaje no es una probabilidad ni una garantía de contacto. Rover: 350 kg incluidos en la masa seca; la malla NASA no determina la masa.</p><details class="landing-presets"><summary>Ensayos avanzados de fallo</summary><label>Preset de carga<select data-flight-condition><option value="nominal">Perfil nominal · objetivo al 100 %</option><option value="custom">Carga personalizada · controles de arriba</option><option value="target-empty-fuel">Sin propelente · objetivo</option></select></label><p>Elegir un preset actualiza la carga del objetivo. En vuelo quedan bloqueadas.</p></details></section>

    <dl class="preparation-summary" data-preparation-summary aria-label="Resumen de misión"></dl>
    <p class="preparation-warning" data-preparation-warning></p>
    </section>
    </section>
    <footer class="preparation-footer"><p data-preparation-status role="status">Revisá las dos etapas antes de confirmar.</p><div><button type="button" class="landing-secondary" data-preparation-back hidden>← Zona del destino</button><button type="button" class="landing-primary" data-preparation-next>Carga y resumen →</button><button type="button" class="landing-primary" data-preparation-confirm hidden>Confirmar preparación</button></div></footer>
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
    for (const [id,label] of [['altitudeM','Altitud AGL'],['verticalSpeedMs','Vertical'],['horizontalSpeedMs','Horizontal'],['propellantKg','Propelente']]) {
      const row=make('div'), dt=make('dt','',label), dd=make('dd','','—'); row.append(dt,dd); dl.append(row); values[id]=dd;
    }
    const progress=make('progress'); progress.max=100; progress.value=100; progress.setAttribute('aria-label',`Propelente ${key === 'earth' ? 'Tierra' : 'objetivo'} respecto al perfil completo`);
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
        if(!plan?.grid){column.append(make('p','landing-missing','Sin DEM evaluable. No se dibuja una región inventada; podés revisar el resultado no evaluable.'));continue;}
        const map=make('div','landing-region-map');map.dataset.mapBody=key;map.setAttribute('role','group');map.setAttribute('aria-label',`Mapa regional ${bodyName(key,view.profiles?.[key])}; seleccioná un candidato numerado`);
        const canvas=make('canvas');canvas.width=320;canvas.height=320;canvas.setAttribute('aria-hidden','true');map.append(canvas);
        const grid=make('div','landing-map-grid');grid.setAttribute('aria-hidden','true');map.append(grid);
        const extent=(plan.grid.gridSize-1)*plan.grid.spacingMeters,point=plan.zones?.[0]?.sciencePoint||{x:0,z:0};
        const position=(x,z)=>({left:`${8+(x/extent+.5)*84}%`,top:`${8+(z/extent+.5)*84}%`});
        const science=make('span','landing-science','◇');Object.assign(science.style,position(point.x,point.z));science.title='Objetivo científico';map.append(science);
        const north=make('span','landing-map-north','N ↑'),scale=make('span','landing-map-scale',`${number(extent,0)} × ${number(extent,0)} m`);map.append(north,scale);
        const list=make('div','landing-zone-list'),buttons=[];
        for(const [i,zone] of (plan.zones||[]).slice(0,3).entries()){
          const marker=make('button','landing-map-marker',String(i+1));marker.type='button';marker.dataset.zone=zone.id;marker.dataset.body=key;marker.dataset.mapZone=zone.id;marker.dataset.status=zone.status;Object.assign(marker.style,position(zone.x,zone.z));marker.setAttribute('aria-label',`Elegir contacto ${i+1} en ${bodyName(key,view.profiles?.[key])}: pendiente ${number(zone.slopeDeg)} grados, desnivel ${number(zone.reliefM,0)} metros, ciencia a ${number(zone.scienceDistanceM,0)} metros`);map.append(marker);
          const button=make('button','landing-zone');button.type='button';button.dataset.zone=zone.id;button.dataset.body=key;button.dataset.status=zone.status;
          button.append(make('b','landing-zone-number',String(i+1).padStart(2,'0')),make('strong','',statusNames[zone.status]||zone.status),make('span','',`${number(zone.slopeDeg)}° pendiente · ${number(zone.reliefM,0)} m desnivel · ${number(zone.scienceDistanceM,0)} m a ciencia`));button.title=zone.reason||'Evaluación regional';list.append(button);
          for(const element of [marker,button])element.addEventListener('click',()=>selectZone(key,zone.id));buttons.push({zone,marker,button});
        }
        map.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||!event.target.matches('.landing-map-marker'))return;event.preventDefault();const available=buttons.map(b=>b.marker).filter(b=>!b.disabled),index=available.indexOf(event.target),delta=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;available[(index+delta+available.length)%available.length]?.focus();});
        const explanation=make('p','landing-choice-explanation'),source=make('p','landing-dem-source',`${plan.grid.dataset||'DEM'} · paso ${number(plan.grid.spacingMeters)} m / resolución nativa ${number(plan.grid.nativeResolutionMeters)} m.`);
        column.append(map,list,explanation,source);plansDOM[key]={buttons,explanation,canvas};drawMap(key,canvas);
      }
    }
    for(const key of ['target']){
      const dom=plansDOM[key],plan=view.plans?.[key];if(!dom)continue;
      const selected=plan.zones.find(zone=>zone.id===plan.selectedId);
      for(const {zone,marker,button} of dom.buttons)for(const node of [marker,button]){attr(node,'aria-pressed',zone.id===plan.selectedId);prop(node,'disabled',view.active||zone.eligible===false||zone.status==='unevaluable');}
      const index=dom.buttons.findIndex(b=>b.zone.id===plan.selectedId);
      text(dom.explanation,selected?`Contacto ${index+1} elegido · x ${number(selected.x,0)}, z ${number(selected.z,0)} m. Cambiarlo modifica la pendiente, el desnivel regional y la distancia hasta ciencia; no mueve el objetivo científico.`:'Sin candidato elegible: no se fuerza un contacto.');
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
    text(q('[data-analogue-title]'),`Referencia automática · ${analogue.name || 'análogo del escenario'}`);
    text(q('[data-analogue-purpose]'),analogue.purpose || 'La región terrestre del escenario aporta una referencia para el ensayo.');
    const origin=view.explorationOrigins?.earth;
    text(q('[data-analogue-origin]'),origin?`Rover de ensayo en superficie: x ${number(origin.x,0)}, z ${number(origin.z,0)} m; elevación DEM ${number(origin.elevationM)} m. Origen automático, sin seleccionar aterrizaje ni combustible terrestre.`:'Sin origen terrestre válido: el destino puede aterrizar, pero la conducción espejo no está disponible. No se inventa terreno ni posición de ensayo.');
    const purpose=contact?'Contacto del destino calculado. Revisá el resultado y autorizá manualmente el despliegue.':isFailed?'El destino no obtuvo contacto nominal. El rover sigue retenido; reiniciá para ajustar zona o carga.':explore?(mirror?'Rover de ensayo en Tierra → rover espejo simulado en el destino. Desplazamiento relativo sincronizado; cada rover evalúa su propio suelo. Sin enlace con hardware ni copia de coordenadas absolutas.':'Destino desplegado. Conducción espejo no disponible: falta un origen terrestre válido o cobertura del objetivo.'):phase==='deployment'?'Autorización recibida. Desplegando en el contacto del destino; el ensayo terrestre usa su origen automático en superficie.':view.active?'Descenso propulsado final en el destino. Podés cambiar cámara, velocidad o pausar; la comparación terrestre es opcional.':'Prepará la zona y carga del destino. El análogo terrestre automático ayuda a evaluar el terreno; después descendé y revisá el contacto.';
    text(q('[data-flight-purpose]'),purpose); prop(q('[data-flight-plan]'),'hidden',view.active);
    const action=explore&&!mirror?'Espejo no disponible':contact?'Desplegar rover':isFailed?'Volver a preparar':!view.active?(prepared?'Iniciar descenso':'Preparar misión'):`${running?'Ⅱ Pausar':'▷ Reanudar'} ${explore?'exploración':phase==='deployment'?'despliegue':'descenso'}`;
    text(q('[data-flight-action]'),action);attr(q('[data-flight-action]'),'data-action',contact?'deploy':isFailed?'reset':!view.active?(prepared?'start':'prepare'):running?'pause':'resume');
    text(q('[data-flight-next]'),contact?'Siguiente → autorizar tras contacto nominal del destino. Tierra no requiere aterrizaje.':explore?(mirror?'Siguiente → conducir, observar y descargar el reporte.':'Podés revisar el contacto y el reporte; reiniciá para volver a cargar la referencia terrestre.'):isFailed?'Reiniciar permite ajustar de nuevo. Probá restablecer el 100 % de carga.':view.active?'El cambio de velocidad se aplica desde ahora; no reescribe el vuelo.':'Siguiente → el descenso bloquea la zona y la carga. Podés reiniciar para ajustarlas.');
    prop(q('[data-flight-action]'),'disabled',!isReady()||(contact&&view.runs.target?.phase!=='contact')||(explore&&!mirror));
    text(q('[data-flight-time]'),`VUELO ${rate}× SIM · ROVER 20×`);
    prop(q('[data-flight-abort]'),'disabled',!view.active||explore||isFailed);
    prop(q('[data-flight-reset]'),'disabled',!view.active);
    prop(q('[data-flight-condition]'),'disabled',view.active);prop(q('[data-flight-full]'),'disabled',view.active);
    text(q('[data-flight-lock]'),view.active?'PLAN BLOQUEADO · reiniciá para editar':'EDITABLE HASTA DESCENDER');
    for(const button of rateButtons){attr(button,'aria-pressed',Number(button.dataset.flightRate)===rate);prop(button,'disabled',explore||isFailed);}
    prop(q('.landing-flight-tools'),'hidden',explore);
    const profileKey=view.profiles?.target?.id;
    if(profileKey!==profileSignature){profileSignature=profileKey;fuel={earth:100,target:100};syncPreset();}
    for(const key of ['target']){
      const run=view.runs[key],profile=view.profiles?.[key],dom=instruments[key],control=fuelControls[key],propellant=profile?profile.propellantKg*fuel[key]/100:null,mass=profile?profile.dryMassKg+propellant:null;
      if(lastFuelProfile!==profile||lastFuelValue!==fuel.target||lastFuelActive!==view.active){
      attr(control.slider,'aria-label',`Carga de propelente ${bodyName(key,profile)}`);prop(control.slider,'disabled',view.active||!profile);prop(control.slider,'value',String(fuel[key]));attr(control.slider,'aria-valuetext',`${fuel[key]} por ciento, ${number(propellant)} kilogramos de propelente`);text(control.name,bodyName(key,profile));text(control.output,`${fuel[key]} %`);text(control.detail,`${number(propellant)} kg propelente · ${number(mass)} kg masa inicial`);
      lastFuelProfile=profile;lastFuelValue=fuel.target;lastFuelActive=view.active;}
      text(dom.title,`${bodyName(key,profile)} · ${run?phaseNames[run.phase]||run.phase:'POR INICIAR'}`);
      for(const metric of ['altitudeM','verticalSpeedMs','horizontalSpeedMs','propellantKg'])text(dom.values[metric],`${number(metric==='propellantKg'?(run?.propellantKg??propellant):run?.[metric])} ${metric.endsWith('SpeedMs')?'m/s':metric==='propellantKg'?'kg':'m'}`);
      prop(dom.progress,'value',profile?Math.max(0,Math.min(100,(run?.propellantKg??propellant)/profile.propellantKg*100)):0);
      text(dom.detail,`Masa ${number(run?.massKg??mass)} kg · T+ ${number(run?.simSeconds??0)} s SIM`);
      text(q(`[data-result=${key}]`),`${bodyName(key,profile)} — ${run?.outcome?.label||'Sin resultado todavía.'}`);
    }
    text(q('[data-result=earth]'),origin?'TIERRA · Referencia de ensayo en superficie; sin vuelo ni combustible.':'TIERRA · Sin origen de ensayo; conducción espejo no disponible.');
    prop(q('[data-flight-results]'),'hidden',!(contact||isFailed||explore||phase==='deployment'));
    prop(q('[data-flight-explore]'),'hidden',!explore); prop(q('[data-flight-drive]'),'disabled',!mirror);
    if(explore){
    const distances=['earth','target'].map(key=>{const run=view.runs[key],pose=getRoverPose(key),point=run?.target?.sciencePoint||view.plans?.[key]?.sciencePoint;return `${bodyName(key,view.profiles?.[key])}: ${number(pose&&point?Math.hypot(pose.x-point.x,pose.z-point.z):null,0)} m`;});
    text(q('[data-flight-science]'),`◇ Distancia del rover a ciencia · ${distances.join(' · ')}. El diamante rosa orienta la exploración; no traslada el rover hasta él.`);
    }
    if(lastProfileText!==view.profiles?.target){lastProfileText=view.profiles?.target;text(q('[data-flight-profile]'),[view.profiles?.target].filter(Boolean).map(p=>`${p.label}: seco ${number(p.dryMassKg,0)} kg, capacidad ${number(p.propellantKg,0)} kg, Isp ${number(p.ispSeconds,0)} s, empuje máximo ${number(p.thrustMaxN,0)} N. Contacto ≤ ${number(p.touchdownVerticalSpeedMs)} m/s vertical y ≤ ${number(p.touchdownHorizontalSpeedMs)} m/s horizontal (hipótesis de diseño).`).join(' '));}

    if(lastPlanRevision!==view.planRevision||lastPlanActive!==view.active){plansUI(view);lastPlanRevision=view.planRevision;lastPlanActive=view.active;}
    if(prep.open)updatePreparationSummary(view);
    for(const layer of layers.values())layer.slopes.visible=slopes.checked;
  }
  const summaryRows={};
  for(const [key,label] of [['body','Cuerpo de destino'],['zone','Zona elegida'],['slope','Pendiente regional'],['relief','Desnivel regional'],['fuel','Propelente'],['mass','Masa inicial']]) {
    const row=make('div'),dt=make('dt','',label),dd=make('dd','','—');row.append(dt,dd);q('[data-preparation-summary]').append(row);summaryRows[key]=dd;
  }
  function updatePreparationSummary(view) {
    const plan=view.plans?.target,profile=view.profiles?.target,zone=plan?.zones?.find(z=>z.id===plan.selectedId);
    const kg=(profile?.propellantKg??0)*fuel.target/100;
    text(summaryRows.body,bodyName('target',profile));text(summaryRows.zone,zone?`Contacto ${plan.zones.findIndex(item=>item.id===zone.id)+1} · x ${number(zone.x,0)}, z ${number(zone.z,0)} m`:'Sin candidato elegible');
    text(summaryRows.slope,`${number(zone?.slopeDeg)}°`);text(summaryRows.relief,`${number(zone?.reliefM)} m`);text(summaryRows.fuel,`${fuel.target} % · ${number(kg)} kg`);text(summaryRows.mass,`${number(profile?profile.dryMassKg+kg:null)} kg`);
    const valid=Boolean(plan?.grid&&zone&&zone.eligible!==false&&zone.status!=='unevaluable'&&profile);
    prop(q('[data-preparation-next]'),'disabled',!valid);prop(q('[data-preparation-confirm]'),'disabled',!valid||view.active);
    text(q('[data-preparation-warning]'),!valid?'Sin DEM o candidato evaluable: no se puede confirmar ni forzar un descenso.':fuel.target===0?'Ensayo de fallo deliberado: 0 kg de propelente. La nave no tendrá empuje; puede fallar el contacto y el rover permanecerá retenido.':'Evaluación regional del destino, no certificación de seguridad. El DEM no resuelve patas, rocas ni cavidades. Tierra es una referencia opcional, sin segundo aterrizaje.');
    text(q('[data-preparation-status]'),isPrepared(view)?'Preparación confirmada. Podés editar; cambiar zona o carga exige confirmar de nuevo.':preparationStep==='zone'?'1 de 2 · Elegí y revisá un contacto del destino.':'2 de 2 · Revisá la carga y el resumen antes de confirmar.');
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
