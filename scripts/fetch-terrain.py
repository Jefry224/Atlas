#!/usr/bin/env python3
"""Download small, attributed non-commercial demo snapshots. No credentials.
81 Copernicus GLO-90 samples + one EOxCloudless image per site; never a live feed.
Run: python3 scripts/fetch-terrain.py (existing snapshots are reused).
"""
import datetime, json, math, pathlib, subprocess, time, urllib.parse, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/data'
OUT.mkdir(parents=True, exist_ok=True)
sites = json.loads(subprocess.check_output(['node', '-e', 'console.log(JSON.stringify(require("./data.js")))'], cwd=ROOT))
manifest = {}
for site in sites:
    ident, lat, lon = site['id'], site['lat'], site['lon']
    dest = OUT / f'{ident}.json'
    if dest.exists():
        manifest[ident] = json.loads(dest.read_text()); print('cached', ident, flush=True); continue
    n, spacing = 9, 300
    dlat = spacing / 111320
    dlon = dlat / math.cos(math.radians(lat))
    coords = [(round(lat + (4-r)*dlat, 7), round(lon + (c-4)*dlon, 7)) for r in range(n) for c in range(n)]
    params = urllib.parse.urlencode({'latitude': ','.join(str(p[0]) for p in coords), 'longitude': ','.join(str(p[1]) for p in coords)})
    url = 'https://api.open-meteo.com/v1/elevation?' + params
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'AnalogAtlasHackathon/2.0 (educational prototype)'})
        with urllib.request.urlopen(req, timeout=35) as response: data = json.load(response)
        heights = data['elevation']
        if len(heights) != 81 or not all(isinstance(h,(int,float)) and math.isfinite(h) for h in heights): raise ValueError('DEM missing samples')
        bbox = [lon-4*dlon, lat-4*dlat, lon+4*dlon, lat+4*dlat]
        record = {'site': ident, 'center': [lat,lon], 'gridSize': n, 'spacingMeters': spacing, 'extentMeters':2400, 'bbox':bbox, 'elevation':heights, 'dataset':'Copernicus DEM 2021 GLO-90', 'nativeResolutionMeters':90, 'provider':'Open-Meteo', 'source':'https://open-meteo.com/en/docs/elevation-api', 'requestUrl':url, 'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'imagery':None}
        image_params = urllib.parse.urlencode({'service':'WMS','request':'GetMap','version':'1.1.1','layers':'s2cloudless-2024','srs':'EPSG:4326','bbox':','.join(str(v) for v in bbox),'width':768,'height':768,'format':'image/jpeg'})
        image_url = 'https://tiles.maps.eox.at/wms?' + image_params
        try:
            with urllib.request.urlopen(image_url, timeout=35) as response: image=response.read()
            if not image.startswith(b'\xff\xd8'): raise ValueError('No JPEG returned')
            (OUT / f'{ident}.jpg').write_bytes(image)
            record['imagery']={'path':f'assets/data/{ident}.jpg','layer':'s2cloudless-2024','year':2024,'requestUrl':image_url,'credit':'EOxCloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)','license':'https://creativecommons.org/licenses/by-nc-sa/4.0/','source':'https://maps.eox.at/'}
        except Exception as error: print('Imagery unavailable',ident,str(error),flush=True)
        dest.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
        manifest[ident]=record
        print('saved',ident,'DEM',min(heights),max(heights),'image',bool(record['imagery']),flush=True)
    except Exception as error: print('DEM unavailable',ident,str(error),flush=True)
    time.sleep(1.2)
(OUT / 'terrain-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Complete: {len(manifest)}/{len(sites)} sites. Failed sites are NOT synthesized.',flush=True)
