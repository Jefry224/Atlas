import subprocess,tempfile,pathlib,time
CHROME='/home/jefry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome'
def launch_native(pw):
 profile=tempfile.TemporaryDirectory(prefix='earth-native-visibility-')
 log=open(pathlib.Path(profile.name)/'chromium.log','w')
 proc=subprocess.Popen([CHROME,'--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-features=MediaRouter,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch','--password-store=basic','--use-mock-keychain','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile.name,'about:blank'],stdout=log,stderr=log)
 try:
  portfile=pathlib.Path(profile.name)/'DevToolsActivePort';end=time.monotonic()+15
  while not portfile.exists() and time.monotonic()<end:time.sleep(.1)
  lines=portfile.read_text().splitlines();browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+lines[0],no_defaults=True)
  return browser,proc,profile,log
 except:
  proc.terminate();proc.wait(timeout=10);log.close();profile.cleanup();raise

def close_native(browser,proc,profile,log):
 try:browser.close()
 finally:
  if proc.poll() is None:proc.terminate();proc.wait(timeout=10)
  log.close();profile.cleanup()
