import { createAuditPanel } from './analog-audit-ui.mjs';
import { prefixElementIds } from './scoped-ids.mjs';
import { earthAnalysisInput } from './earth-analysis.mjs';
import { demIdentity } from './earth-expedition.mjs';
import { sampleSlope, localCoordinates } from './mission-math.mjs';

const node=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};

export function createEarthAnalysis(root,{auditTemplate,getReferences,loadGrid,getForecast,loadHistory,getProcesses,getTelemetry,onChange=()=>{}}) {
  let current=null,reference=null,targetGrid=null,generation=0,visible=false,input=null,lastTelemetry=null;
  let data={phase:'loading',processes:null,processHistory:undefined};
  const choices=new Map();
  const header=node('section','','earth-analysis-summary'),title=node('h2','Earth expedition · test workspace'),status=node('p','','earth-analysis-status');status.setAttribute('role','status');
  const label=node('label','Planetary comparison reference'),select=node('select');select.dataset.earthAnalysisReference='';label.append(select);
  header.append(title,status,label,node('p','Inspect this Earth location against an explicit Moon/Mars reference. The rover stays on Earth. The proposed equipment profile belongs to the reference scenario; it is not a measurement of this site.'));
  const panel=auditTemplate;prefixElementIds(panel,'earth-');panel.hidden=false;
  const tracking=panel.querySelector('.m2-follow'),trackingDetails=node('details','','earth-analysis-log');
  tracking.querySelector('.panel-note').textContent='Independent Earth field-test log. Samples every 10 s while this expedition view is active; weather follows the selected Earth location. Reference or expedition-session changes start a separate M2 log. Destination landing records are kept separate.';
  panel.insertBefore(panel.querySelector('[data-nasa-bench]'),tracking);
  trackingDetails.append(node('summary','Mission log, proposed equipment and Excel report'),tracking);panel.append(trackingDetails);
  root.append(header,panel);
  const audit=createAuditPanel(panel,{idPrefix:'earth-'});
  const notify=()=>{if(visible)onChange();};
  function updateAudit(){
    if(!current||!reference)return;
    input=earthAnalysisInput({...current,reference,targetGrid,telemetry:getTelemetry(current.site.id)});
    panel.hidden=!input;
    if(input){lastTelemetry=input.telemetry;audit.update(input);}
  }
  function renderStatus(){
    if(!current)return;
    if(!input){status.textContent=`${current.site.name} · No matching source Earth DEM is available. The M2 inspector needs this site's published elevation grid.`;return;}
    status.textContent=`${current.site.name} · EARTH · reference ${reference?.targetLabel||reference?.targetId||'loading'} (${reference?.body||'unknown'}). ${data.phase==='loading'?'Loading local forecast and reference data…':data.phase==='ready'?'Source forecast and reference analysis ready.':'No sourced hourly forecast is available here; terrain inspection and the isolated process lab remain available.'}`;
  }
  async function refresh(){
    const token=++generation,context=current,selected=reference;
    targetGrid=null;data={phase:'loading',site:context.site,scenario:selected,processes:null,processHistory:undefined};updateAudit();renderStatus();notify();
    const targetPromise=loadGrid(selected.target).then(grid=>{
      if(token!==generation)return null;targetGrid=earthAnalysisInput({...context,reference:selected,targetGrid:grid})?.targetGrid||null;updateAudit();notify();return targetGrid;
    }).catch(()=>null);
    try{
      const [target,forecast,history,processes]=await Promise.all([targetPromise,getForecast(context.site.id,context.grid?.center||[context.site.lat,context.site.lon]),loadHistory(context.site.id).catch(()=>null),getProcesses()]);
      if(token!==generation)return;
      const matching=forecast?.site===context.site.id?forecast:null;
      data={phase:matching&&processes?'ready':'unavailable',site:context.site,scenario:selected,processHistory:history,processes:matching&&processes?processes.analyzeProcesses(matching,target):null};
    }catch{
      if(token!==generation)return;data={...data,phase:'unavailable',processHistory:null,processes:null};
    }
    renderStatus();notify();
  }
  select.addEventListener('change',()=>{reference=getReferences().find(s=>s.id===select.value);if(!current||!reference)return;choices.set(current.site.id,reference.id);refresh();});
  return {
    configure(context){
      const same=current?.site.id===context.site.id&&demIdentity(current?.grid)===demIdentity(context.grid);
      current=context;
      if(same){updateAudit();renderStatus();return;}
      const references=getReferences();reference=references.find(s=>s.id===choices.get(context.site.id))||context.scenario||references[0];
      select.replaceChildren(...references.map(s=>{const option=node('option',`${s.targetLabel||s.targetId} · ${s.body.toUpperCase()}`);option.value=s.id;return option;}));
      if(!reference){status.textContent='Loading published comparison references…';return;}
      select.value=reference.id;refresh();
    },
    setSession(sessionId){if(!current||current.sessionId===sessionId)return;current={...current,sessionId};updateAudit();renderStatus();notify();},
    loading(){generation++;current=null;reference=null;input=null;targetGrid=null;data={phase:'loading',processes:null,processHistory:undefined};panel.hidden=true;status.textContent='Loading the selected Earth DEM…';notify();},
    setVisible(value){visible=value;root.hidden=!value;if(value)notify();},
    tick(rover){
      if(!visible||!current||!input)return;
      const telemetry=getTelemetry(current.site.id);if(telemetry!==lastTelemetry)updateAudit();
      const center=current.grid.center,coords=center?localCoordinates({lat:center[0],lon:center[1]},rover.x,rover.z):{};
      audit.tick(rover,{latitude:coords.lat??null,longitude:coords.lon??null,slopeDeg:sampleSlope(current.grid,rover.x,rover.z)});
    },
    processes:()=>data,
    context:()=>input?{...input.analysisContext,audit:audit.context()}:null,
    scopeKey:()=>input?.scopeKey||'loading',
    snapshot:()=>input?audit.dossier():null,
    dispose(){generation++;audit.dispose();},
  };
}
