import json,hashlib,datetime,pathlib,time,traceback
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from importlib.machinery import SourceFileLoader
h=SourceFileLoader("ownchrome",str(pathlib.Path(__file__).with_name('owned-chromium.py'))).load_module()
ROOT=pathlib.Path('/home/jefry/dev/personal/S.E.L.E.N.E/Atlas');OUT=ROOT/'docs/evidencias/earth-final-review';OUT.mkdir(exist_ok=True)
result={'method':'Owned native Chromium profile under isolated xvfb-run, attached using connect_over_cdp(no_defaults=True) default context; foreground tab changes yield trusted native visibility; no getters, controller, pose or clocks overridden','executable':'/home/jefry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome','URL':'http://localhost:8231/','startedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'complete':False,'blockedRequests':[],'checks':[]}
for path in ['mission.js','earth-expedition.mjs','earth-expedition-ui.mjs','mission-math.mjs','index.html','physics-evidence.mjs']:
 result.setdefault('sourceHashes',{})[path]=hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
def save(): (OUT/'native-visibility-proof.json').write_text(json.dumps(result,indent=2))
def check(name,value):
 result['checks'].append({'name':name,'passed':bool(value)});save();print(name,value,flush=True);assert value,name
def stamp(page):return page.evaluate('''()=>({hidden:document.hidden,state:document.visibilityState,ownHiddenDescriptor:!!Object.getOwnPropertyDescriptor(document,'hidden'),ownStateDescriptor:!!Object.getOwnPropertyDescriptor(document,'visibilityState'),nativeHiddenGetter:Function.prototype.toString.call(Object.getOwnPropertyDescriptor(Document.prototype,'hidden').get),atUTC:new Date().toISOString(),phase:document.querySelector('#earth-expedition')?.dataset.phase,events:window.nativeVisibilityEvents||[]})''')
def fill(page,selector,value):
 page.locator(selector).fill(str(value));page.locator(selector).dispatch_event('change')
def report(page):
 return page.evaluate("""async()=>{const i=nativeAuditBlobs.length;document.querySelector('[data-exp-export=json]').click();return JSON.parse(await nativeAuditBlobs[i].text())}""")
with sync_playwright() as pw:
 browser=None
 try:
  browser,ownedProcess,ownedProfile,ownedLog=h.launch_native(pw)
  result['browserVersion']=browser.version
  context=browser.contexts[0]
  def route(req):
   u=urlsplit(req.request.url)
   if u.hostname not in ['localhost','127.0.0.1'] or u.port!=8231:
    result['blockedRequests'].append({'url':req.request.url,'reason':'Non-preview request blocked'});req.abort();return
   if u.path.startswith(('/api/telemetry','/api/processes/forecast','/api/copilot','/api/dossier')):
    result['blockedRequests'].append({'path':u.path,'reason':'Weather/provider request locally suppressed; no outside requests'});req.fulfill(status=503,content_type='application/json',body='{"error":"visibility-audit-no-external-provider"}');return
   req.continue_()
  context.route('**/*',route)
  page=context.pages[0];page.set_viewport_size({'width':1440,'height':1000});page.goto('http://localhost:8231/',wait_until='domcontentloaded');page.locator('[data-site=atacama]').wait_for(timeout=30000)
  page.evaluate('''()=>{window.nativeVisibilityEvents=[];window.nativeAuditBlobs=[];const original=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{nativeAuditBlobs.push(b);return original(b)};document.addEventListener('click',e=>{if(e.target.closest?.('a[download]'))e.preventDefault()},true);document.addEventListener('visibilitychange',e=>nativeVisibilityEvents.push({isTrusted:e.isTrusted,hidden:document.hidden,state:document.visibilityState,atUTC:new Date().toISOString(),phase:document.querySelector('#earth-expedition')?.dataset.phase,metrics:document.querySelector('[data-exp-metrics]')?.textContent}))}''')
  page.locator('[data-site=atacama]').click();page.locator('#view-terrain').click();page.wait_for_function("document.querySelector('#earth-expedition').dataset.siteId==='atacama'&&document.querySelector('#earth-expedition').dataset.phase==='draft'",timeout=30000)
  page.locator('[data-exp-step="2"]').click();fill(page,'[data-exp-input=stop-x]',-150);fill(page,'[data-exp-input=stop-z]',0);page.locator('[data-exp-stop="1"]').click();fill(page,'[data-exp-input=stop-x]',150);fill(page,'[data-exp-input=stop-z]',0)
  page.locator('[data-exp-step="3"]').click();page.locator('#exp-reviewed').check();page.locator('[data-exp-confirm]').click();page.locator('[data-exp-play]').click();page.locator('[data-exp-inspect]').click();page.locator('[data-exp-play]').click()
  page.wait_for_function("parseFloat(document.querySelector('[data-exp-metrics]').textContent)>8",timeout=15000)
  result['movingBeforeHide']=report(page);result['visibleBeforeHide']=stamp(page);check('Actual UI started a moving Earth expedition',result['movingBeforeHide']['status']=='running' and result['movingBeforeHide']['rover']['distanceM']>8)
  other=context.new_page();other.goto('about:blank');other.bring_to_front()
  page.wait_for_function('document.hidden===true&&document.visibilityState==="hidden"',timeout=10000,polling=100)
  result['nativeHiddenStart']=stamp(page);result['hiddenBefore']=report(page);result['nativeHiddenAfterFirstExport']=stamp(page)
  # Wall-clock wait, no simulation clock changes; page remains natively hidden.
  time.sleep(2.0)
  result['hiddenAfter']=report(page);result['nativeHiddenEnd']=stamp(page)
  check('Foreground transition produced native trusted hidden visibility',result['nativeHiddenStart']['hidden'] and result['nativeHiddenEnd']['hidden'] and result['nativeHiddenAfterFirstExport']['hidden'] and any(e['isTrusted'] and e['hidden'] and e['state']=='hidden' for e in result['nativeHiddenEnd']['events']))
  check('Visibility getters were never overridden',all(not result[k]['ownHiddenDescriptor'] and not result[k]['ownStateDescriptor'] and '[native code]' in result[k]['nativeHiddenGetter'] for k in ['visibleBeforeHide','nativeHiddenStart','nativeHiddenEnd']))
  a,b=result['hiddenBefore'],result['hiddenAfter']
  check('Native hide paused actual expedition',a['status']=='paused' and b['status']=='paused')
  check('Pose path SIM battery energy and inspections freeze throughout hidden interval',all(a[k]==b[k] for k in ['rover','path','observations','inspections']) and len(a['inspections'])==1)
  result['hiddenWallIntervalSeconds']=(datetime.datetime.fromisoformat(result['nativeHiddenEnd']['atUTC'].replace('Z','+00:00'))-datetime.datetime.fromisoformat(result['nativeHiddenStart']['atUTC'].replace('Z','+00:00'))).total_seconds()
  check('Hidden interval exceeded two real wall seconds',result['hiddenWallIntervalSeconds']>=2)
  page.bring_to_front();page.wait_for_function('document.hidden===false&&document.visibilityState==="visible"',timeout=10000,polling=100)
  result['nativeVisibleReturn']=stamp(page);result['visibleBeforeExplicitResume']=report(page)
  time.sleep(.7);result['visibleStillPaused']=report(page)
  c,d=result['visibleBeforeExplicitResume'],result['visibleStillPaused']
  check('Native visible return remains paused without operator resume',c['status']=='paused' and d['status']=='paused' and all(b[k]==c[k]==d[k] for k in ['rover','path','observations','inspections']) and any(e['isTrusted'] and e['state']=='visible' for e in result['nativeVisibleReturn']['events']))
  page.locator('[data-exp-play]').click();prior=d['rover']['distanceM'];page.wait_for_function("parseFloat(document.querySelector('[data-exp-metrics]').textContent)>"+str(prior+8),timeout=15000)
  result['afterExplicitResume']=report(page)
  r=result['afterExplicitResume'];check('Explicit actual UI resume restarts movement and SIM energy',r['status']=='running' and r['rover']['distanceM']>d['rover']['distanceM'] and r['rover']['simSeconds']>d['rover']['simSeconds'] and r['observations']['energyUsedPct']>d['observations']['energyUsedPct'] and len(r['inspections'])==1)
  page.locator('[data-exp-play]').click();page.locator('[data-exp-finish]').click();result['closedAfterTest']=report(page)
  result['exportTransport']='Actual UI export Blob captured; native anchor downloads prevented to keep artifacts scoped; visibility unchanged before/after captures'
  result['complete']=True;result['outcome']='Native hidden-page freeze and explicit-resume behavior proved';save()
 except Exception as e:
  result['error']=str(e);result['traceback']=traceback.format_exc();save();print(result['traceback'],flush=True);raise
 finally:
  if browser:h.close_native(browser,ownedProcess,ownedProfile,ownedLog)
  result['finalSourceHashes']={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in result['sourceHashes']};result['sourceHashesUnchanged']=result['finalSourceHashes']==result['sourceHashes']
  result['browserClosed']=True;result['finishedAtUTC']=datetime.datetime.now(datetime.timezone.utc).isoformat();save()
