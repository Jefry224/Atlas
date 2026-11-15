import json,pathlib,hashlib,datetime,traceback
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from importlib.machinery import SourceFileLoader
h=SourceFileLoader('ownchrome',str(pathlib.Path(__file__).with_name('owned-chromium.py'))).load_module()
ROOT=pathlib.Path('/home/jefry/dev/personal/S.E.L.E.N.E/Atlas');OUT=ROOT/'docs/evidencias/earth-final-review';r={'method':'Owned isolated native Chromium; actual Jezero UI followed by isolated renderer fixture built from exact current mission.js functions and imported current physics-evidence.mjs','noProviderCalls':True,'complete':False,'startedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
r['normalActualDestinationUI']=json.loads((OUT/'physics-recheck-initial-assumption.json').read_text())['actualDestinationUI']
r['fixtureExplanation']='Initial normal destination used archived telemetry fallback correctly; second actual UI run explicitly suppresses both provider and archived telemetry to test unknown input'
paths=['mission.js','physics-evidence.mjs','sim-physics.mjs'];r['sourceHashes']={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}
def save(): (OUT/'physics-findings-recheck.json').write_text(json.dumps(r,indent=2))
with sync_playwright() as pw:
 b,proc,profile,log=h.launch_native(pw)
 try:
  c=b.contexts[0]
  def route(req):
   u=urlsplit(req.request.url)
   if u.hostname not in ['localhost','127.0.0.1'] or u.port!=8231:req.abort();return
   if u.path.startswith(('/api/telemetry','/api/processes/forecast','/api/copilot','/api/dossier')) or u.path=='/assets/data/telemetry-snapshot.json':req.fulfill(status=503,content_type='application/json',body='{"error":"independent-recheck-no-provider"}');return
   req.continue_()
  c.route('**/*',route);p=c.pages[0];p.set_viewport_size({'width':1440,'height':1000});p.goto('http://localhost:8231/',wait_until='domcontentloaded');p.locator('[data-scenario=hyperarid-salt]').click();p.wait_for_function("document.querySelector('#physics-plain').textContent.includes('REGIONAL TILT / DEM MODEL')",timeout=30000)
  r['actualDestinationUI']=p.evaluate("()=>({scenario:document.querySelector('[data-scenario=\"hyperarid-salt\"]').getAttribute('aria-pressed'),text:document.querySelector('#physics-plain').innerText,cards:[...document.querySelectorAll('#physics-plain li')].map(n=>({label:n.querySelector('.k').textContent,title:n.querySelector('.v').textContent,detail:n.querySelector('.d').textContent,tone:n.querySelector('.v').dataset.tone||null}))})")
  t=r['actualDestinationUI']['text'];assert 'regional tilt' in t and 'not a local stability certification' in t and 'Sin riesgo' not in t and 'Earth unknown' in t and 'Target critical' in t and 'thermal state unavailable' in t
  # Independent minimal same-origin fixture: no application/controller state is injected.
  fixture=c.new_page();fixture.goto('http://localhost:8231/physics-evidence.mjs',wait_until='domcontentloaded');fixture.set_content('<!doctype html><title>Independent current physics renderer fixture</title><ul id="physics-plain"></ul>')
  r['fixtures']=fixture.evaluate('''async()=>{
    const source=await (await fetch('/mission.js',{cache:'no-store'})).text();
    const helpers=await import('/physics-evidence.mjs');
    const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
    const lines=source.split('\\n');
    const setup=['const idNodes=new Map();',lines.find(s=>s.startsWith('const $ =')),lines.find(s=>s.startsWith('const num =')),lines.find(s=>s.startsWith('const finite ='))].join('\\n');
    const exactFunctions=extract('function el(', '\\nconst ENGINE')+'\\n'+extract('function plainCard(', '\\nfunction renderComparePlain')+'\\n'+extract('function renderPhysicsPlain(', '\\nfunction renderSimilarityPlain');
    const render=new Function('regionalTiltSummary','thermalPairSummary',setup+'\\n'+exactFunctions+'\\nreturn renderPhysicsPlain;')(helpers.regionalTiltSummary,helpers.thermalPairSummary);
    const capture=p=>{render({solarW:null,loadW:40,battery:100,...p});return [...document.querySelectorAll('#physics-plain li')].map(n=>({label:n.querySelector('.k').textContent,title:n.querySelector('.v').textContent,detail:n.querySelector('.d').textContent,tone:n.querySelector('.v').dataset.tone||null}))};
    const result={sourceFunctions:['el','plainCard','renderPhysicsPlain'],tilt:[],thermal:[],malformedThermal:[]};
    const states={nominal:{level:'nominal',marginK:30},caution:{level:'caution',marginK:7},critical:{level:'critical',marginK:-10},unknown:{level:'unknown',marginK:null}};
    for(const [name,input] of Object.entries({low:{pitch:1,roll:2},zero:{pitch:0,roll:0},moderate:{pitch:-6,roll:2},elevated:{pitch:1,roll:-12},missing:{},partialPitch:{pitch:3,roll:null},partialRoll:{pitch:undefined,roll:-8},nonfinite:{pitch:Infinity,roll:NaN}})){
      const cards=capture({...input,earthThermal:states.nominal,targetThermal:states.nominal});const card=cards[2];const partial=!Number.isFinite(input.pitch)||!Number.isFinite(input.roll);if(partial&&(!card.title.includes('unavailable')||!card.detail.includes('Both components are required')))throw Error('Partial attitude became a combined tilt');if(/Sin riesgo|no rollover risk|safe zone/i.test(card.title+card.detail)||!card.detail.includes('not a local stability certification')||card.tone==='good')throw Error('Unsupported safety conclusion');result.tilt.push({name,input:{pitch:Number.isFinite(input.pitch)?input.pitch:null,roll:Number.isFinite(input.roll)?input.roll:null},card});
    }
    for(const [earth,earthThermal]of Object.entries(states))for(const [target,targetThermal]of Object.entries(states)){
      const card=capture({pitch:1,roll:2,earthThermal,targetThermal})[1];if(!card.title.includes('Earth '+earth)||!card.title.includes('Target '+target))throw Error('Thermal state dropped');const bothNominal=earth==='nominal'&&target==='nominal';if(card.detail.includes('Both inputs are nominal')!==bothNominal||(card.tone==='good')!==bothNominal)throw Error('False joint nominal result');if((earth==='unknown'||target==='unknown')&&!card.detail.includes('thermal state unavailable'))throw Error('Missing input inferred');if((earth==='critical'||target==='critical')&&!card.detail.includes('outside the illustrative operating range'))throw Error('Critical input lost');result.thermal.push({earth,target,card});
    }
    for(const input of [{level:'nominal'},{level:'nominal',marginK:-2},{level:'caution',marginK:22},{level:'critical',marginK:12},{level:'future',marginK:30}]){const card=capture({earthThermal:input,targetThermal:states.nominal})[1];if(!card.title.includes('Earth unknown')||card.tone==='good')throw Error('Malformed thermal state accepted');result.malformedThermal.push({input,card})}
    return result;
  }''')
  r['complete']=True;r['F1']='Resolved: actual regional tilt card and eight exact-renderer fixtures retain limits and unknown components without safety certification';r['F2']='Resolved: actual Earth-unknown/target-critical UI plus all sixteen state pairs and five malformed-input fixtures retain distinct thermal source states';save();print(json.dumps({'actual':r['actualDestinationUI']['text'],'tiltFixtures':len(r['fixtures']['tilt']),'thermalPairs':len(r['fixtures']['thermal']),'malformedInputs':len(r['fixtures']['malformedThermal']),'F1':r['F1'],'F2':r['F2']},indent=2))
 except Exception as e:r['error']=str(e);r['traceback']=traceback.format_exc();save();raise
 finally:
  h.close_native(b,proc,profile,log);r['browserClosed']=True;r['finalSourceHashes']={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths};r['sourceHashesUnchanged']=r['sourceHashes']==r['finalSourceHashes'];r['finishedAtUTC']=datetime.datetime.now(datetime.timezone.utc).isoformat();save()
