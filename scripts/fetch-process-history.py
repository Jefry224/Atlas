#!/usr/bin/env python3
"""A.R.E.S. Twin · Módulo 3 (procesos dinámicos): Sentinel-1 RTC backscatter history of the Earth analogues.

For each Earth scenario twin (lanzarote, wright-valley, atacama, wadi-rum) it builds a ~12-month time series of
Sentinel-1 RTC gamma0 (Microsoft Planetary Computer, collection sentinel-1-rtc) over the same 2400 m window used
by scripts/fetch-scenarios-earth.py, and derives simple, documented change indicators:

  * Scene selection: all RTC items intersecting the window in the last 365 days are listed; only the dominant
    relative orbit (most acquisitions; same pass direction and incidence geometry) is kept to avoid geometric
    artefacts. The year is split into half-month bins and the first scene of each bin with >= 90 % valid pixels
    is taken (~24 scenes); the most recent valid acquisition of that orbit is always the last scene, and the
    previous acquisition of the same orbit is forced in as penultimate scene so the last pair is a true
    repeat-pass pair.
  * Per scene: gamma0 (VV; HH where only HH exists) warped by nearest neighbour to a 240×240 grid at 10 m on a
    site-centred azimuthal-equidistant projection (same `warp` as fetch-scenarios-earth.py); mean and std of
    10·log10(gamma0) over valid pixels, valid-pixel fraction.
  * deltaDb = mean(t) − mean(t−1). changeFlag = |Δ| > 1.5 dB, or (|Δ| > 2σ_Δ and |Δ| ≥ 0.5 dB) where σ_Δ is a
    robust std (1.4826·MAD) of all Δ of the site.
  * lastPairChangedFraction: fraction of pixels valid in both of the last two scenes where |Δ pixel| > 3 dB, after
    a 5×5 boxcar (50 m) in linear power to damp speckle.
  * Optional precipitation: Open-Meteo Archive (ERA5-based reanalysis) daily precipitation_sum; precipMm is the
    sum over the scene day and the two previous days (UTC). A flagged change with precipMm ≥ 1 mm is reported as
    «coincidente con precipitación». No causal claim is made.

Reproducible and cached (STAC selections, per-scene rasters, precipitation) under
$XDG_CACHE_HOME/ares-twin-processes; outputs are reused unless --force. A failing site never aborts the run and
nothing is synthesised: a site without data gets an empty series and an explanatory note.

Run:
  .venv-data/bin/python scripts/fetch-process-history.py [--force] [site ...]
"""
import argparse, collections, datetime, importlib.util, json, math, os, pathlib, sys, traceback, urllib.parse, urllib.request

import numpy as np
from rasterio.enums import Resampling

ROOT = pathlib.Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('fetch_scenarios_earth', ROOT / 'scripts/fetch-scenarios-earth.py')
fe = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fe)  # reuse catalog(), warp(), window_lonlat_bbox(), item_record(), GDAL env and SITES

OUT = ROOT / 'assets/data/processes'
CACHE = pathlib.Path(os.environ.get('XDG_CACHE_HOME', pathlib.Path.home() / '.cache')) / 'ares-twin-processes'
COLLECTION = 'sentinel-1-rtc'
LOOKBACK_DAYS = 365
PX, RES = 240, 10.0                     # 240 × 10 m = 2400 m window
MIN_VALID = 0.90
FLAG_ABS_DB, FLAG_MIN_DB, FLAG_SIGMA = 1.5, 0.5, 2.0
PIXEL_CHANGE_DB, BOXCAR = 3.0, 5
RAIN_MM, RAIN_DAYS = 1.0, 3
OPEN_METEO = 'https://archive-api.open-meteo.com/v1/archive'
SITE_IDS = ['lanzarote', 'wright-valley', 'atacama', 'wadi-rum']


def log(*a):
    print(*a, flush=True)


def cached_json(key, fn, force=False):
    p = CACHE / f'{key}.json'
    if p.exists() and not force:
        return json.loads(p.read_text())
    val = fn()
    CACHE.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(val))
    return val


def pol_of(rec):
    return 'vv' if 'vv' in rec['assets'] else 'hh' if 'hh' in rec['assets'] else None


# ---------------------------------------------------------------- scene selection
def list_items(ident, lat, lon, end):
    start = end - datetime.timedelta(days=LOOKBACK_DAYS)

    def search():
        items = fe.catalog().search(collections=[COLLECTION], bbox=fe.window_lonlat_bbox(lat, lon, 0),
                                    datetime=f'{start}/{end}').items()
        return [fe.item_record(i) for i in items]
    recs = cached_json(f'{ident}-items-{end}', search)
    recs = [r for r in recs if pol_of(r)]
    recs.sort(key=lambda r: r['datetime'])
    return recs


def dominant_orbit(recs):
    cnt = collections.Counter((r['properties'].get('sat:relative_orbit'), r['properties'].get('sat:orbit_state'),
                               pol_of(r)) for r in recs)
    return cnt.most_common(1)[0][0], cnt


def half_month_bin(dt):
    return (dt[:7], 0 if int(dt[8:10]) < 16 else 1)


# ---------------------------------------------------------------- rasters
def scene_raster(ident, rec, lat, lon):
    npy = CACHE / f'{ident}-{rec["id"]}.npy'
    if npy.exists():
        return np.load(npy)
    arr, _ = fe.warp(fe.sign(rec['assets'][pol_of(rec)]), lat, lon, PX, RES, Resampling.nearest, 1)
    arr = arr.astype('float32')
    arr[~(np.isfinite(arr) & (arr > 0))] = np.nan
    CACHE.mkdir(parents=True, exist_ok=True)
    np.save(npy, arr)
    return arr


def stats(arr):
    valid = np.isfinite(arr)
    vf = float(valid.mean())
    if not valid.any():
        return None, None, vf
    db = 10 * np.log10(arr[valid])
    return float(db.mean()), float(db.std()), vf


def boxcar(arr, k):
    """NaN-aware k×k moving mean (linear power)."""
    v = np.isfinite(arr)
    a = np.where(v, arr, 0).astype('float64')
    pad = k // 2
    a = np.pad(a, pad)
    w = np.pad(v.astype('float64'), pad)
    s = np.zeros(arr.shape)
    n = np.zeros(arr.shape)
    for dy in range(k):
        for dx in range(k):
            s += a[dy:dy + arr.shape[0], dx:dx + arr.shape[1]]
            n += w[dy:dy + arr.shape[0], dx:dx + arr.shape[1]]
    out = np.full(arr.shape, np.nan)
    ok = v & (n > 0)
    out[ok] = s[ok] / n[ok]
    return out


def changed_fraction(a, b, smooth):
    if smooth:
        a, b = boxcar(a, BOXCAR), boxcar(b, BOXCAR)
    both = np.isfinite(a) & np.isfinite(b)
    if both.sum() == 0:
        return None
    d = 10 * np.log10(b[both]) - 10 * np.log10(a[both])
    return float((np.abs(d) > PIXEL_CHANGE_DB).mean())


# ---------------------------------------------------------------- precipitation
def precipitation(ident, lat, lon, start, end):
    def fetch():
        q = urllib.parse.urlencode(dict(latitude=lat, longitude=lon, start_date=start, end_date=end,
                                        daily='precipitation_sum', timezone='GMT'))
        req = urllib.request.Request(f'{OPEN_METEO}?{q}', headers={'User-Agent': 'ares-twin-data-script'})
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)
        return dict(zip(d['daily']['time'], d['daily']['precipitation_sum']))
    return cached_json(f'{ident}-precip-{start}-{end}', fetch)


def precip_window(daily, date):
    d0 = datetime.date.fromisoformat(date)
    vals = [daily.get(str(d0 - datetime.timedelta(days=i))) for i in range(RAIN_DAYS)]
    if any(v is None for v in vals):
        return None
    return round(float(sum(vals)), 1)


# ---------------------------------------------------------------- site assembly
def empty_record(ident, cfg, pol, notes):
    return {'site': ident, 'center': [cfg['lat'], cfg['lon']], 'collection': COLLECTION, 'polarization': pol,
            'windowMeters': 2400, 'fetchedAt': now_iso(), 'series': [], 'lastPairChangedFraction': None,
            'method': method_text(pol or 'VV/HH', None), 'interpretation': 'Sin datos suficientes para interpretar cambios.',
            'license': 'CC BY 4.0 (Sentinel-1 RTC, Planetary Computer)', 'credit': 'Contains modified Copernicus Sentinel data',
            'source': 'https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc', 'notes': notes}


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()


def method_text(pol, orbit):
    o = f'órbita relativa {orbit[0]} ({orbit[1]})' if orbit else 'órbita relativa dominante'
    return (f'Sentinel-1 RTC gamma0 {pol} (aplanada por terreno), solo {o} para mantener la geometría de iluminación. '
            f'Ventana 2400 m centrada en el sitio (240×240 px a 10 m, proyección acimutal equidistante, vecino más próximo). '
            f'Una escena por quincena (la primera con ≥{int(MIN_VALID * 100)} % de píxeles válidos) en los últimos '
            f'{LOOKBACK_DAYS} días; las dos últimas son pasadas consecutivas de la misma órbita. meanDb/stdDb = media y '
            f'desviación de 10·log10(gamma0). deltaDb = meanDb(t) − meanDb(t−1). changeFlag = |Δ| > {FLAG_ABS_DB} dB, '
            f'o |Δ| > {FLAG_SIGMA:g}σ_Δ con |Δ| ≥ {FLAG_MIN_DB} dB (σ_Δ robusta = 1.4826·MAD de los Δ del sitio). '
            f'lastPairChangedFraction = fracción de píxeles con |Δ| > {PIXEL_CHANGE_DB:g} dB entre las dos últimas escenas '
            f'tras un filtro de media {BOXCAR}×{BOXCAR} ({BOXCAR * int(RES)} m) en potencia lineal para reducir el speckle. '
            f'precipMm = precipitación diaria acumulada del día de la escena y los {RAIN_DAYS - 1} anteriores (UTC), '
            f'Open-Meteo Archive (reanálisis, celda ~0.1°–0.25°); null si no disponible.')


def select_scenes(ident, recs, orbit, lat, lon):
    same = [r for r in recs if (r['properties'].get('sat:relative_orbit'), r['properties'].get('sat:orbit_state'), pol_of(r)) == orbit]
    # last two valid acquisitions (true repeat-pass pair)
    tail = []
    for r in reversed(same):
        arr = scene_raster(ident, r, lat, lon)
        if stats(arr)[2] >= MIN_VALID:
            tail.insert(0, r)
        else:
            log(f'  skip {r["id"]} (valid < {MIN_VALID})')
        if len(tail) == 2:
            break
    cutoff = tail[0]['datetime'] if tail else '9999'
    chosen, seen = [], set()
    for r in same:
        if r['datetime'] >= cutoff:
            break
        b = half_month_bin(r['datetime'])
        if b in seen or b == half_month_bin(cutoff):
            continue
        arr = scene_raster(ident, r, lat, lon)
        if stats(arr)[2] >= MIN_VALID:
            chosen.append(r)
            seen.add(b)
        else:
            log(f'  skip {r["id"]} (valid < {MIN_VALID})')
    return chosen + tail, len(same)


def robust_sigma(x):
    x = np.asarray(x, float)
    if len(x) < 3:
        return None
    return float(1.4826 * np.median(np.abs(x - np.median(x))))


def build(ident, force=False):
    cfg = fe.SITES[ident]
    dest = OUT / f'{ident}.json'
    if dest.exists() and not force:
        log('cached', ident)
        return json.loads(dest.read_text())
    lat, lon = cfg['lat'], cfg['lon']
    log('site', ident, lat, lon)
    end = datetime.date.today()
    notes = []
    try:
        recs = list_items(ident, lat, lon, end)
    except Exception as e:
        rec = empty_record(ident, cfg, None, [f'Sin serie: la búsqueda STAC de {COLLECTION} falló ({e}).'])
        write(dest, rec)
        return rec
    if not recs:
        rec = empty_record(ident, cfg, None, [f'Sin serie: ninguna escena {COLLECTION} con VV o HH cubre la ventana en '
                                              f'los últimos {LOOKBACK_DAYS} días.'])
        write(dest, rec)
        return rec
    orbit, counts = dominant_orbit(recs)
    pol = orbit[2].upper()
    scenes, n_orbit = select_scenes(ident, recs, orbit, lat, lon)
    log(f'  orbit {orbit} {n_orbit} items, {len(scenes)} selected; all: {counts.most_common()}')

    series, rasters = [], []
    for r in scenes:
        arr = scene_raster(ident, r, lat, lon)
        m, s, vf = stats(arr)
        series.append({'date': r['datetime'][:10], 'datetime': r['datetime'], 'platform': r['properties'].get('platform'),
                       'relativeOrbit': r['properties'].get('sat:relative_orbit'),
                       'orbitState': r['properties'].get('sat:orbit_state'),
                       'meanDb': round(m, 2), 'stdDb': round(s, 2), 'validFraction': round(vf, 4),
                       'deltaDb': None, 'changeFlag': False, 'precipMm': None, 'item': r['id']})
        rasters.append(arr)

    deltas = []
    for i in range(1, len(series)):
        d = round(series[i]['meanDb'] - series[i - 1]['meanDb'], 2)
        series[i]['deltaDb'] = d
        deltas.append(d)
    sig = robust_sigma(deltas)
    for p in series[1:]:
        a = abs(p['deltaDb'])
        p['changeFlag'] = bool(a > FLAG_ABS_DB or (sig is not None and a > FLAG_SIGMA * sig and a >= FLAG_MIN_DB))

    last_frac = last_raw = None
    if len(rasters) >= 2:
        last_frac = changed_fraction(rasters[-2], rasters[-1], True)
        last_raw = changed_fraction(rasters[-2], rasters[-1], False)

    rain_ok = False
    if series:
        try:
            first = datetime.date.fromisoformat(series[0]['date']) - datetime.timedelta(days=RAIN_DAYS)
            daily = precipitation(ident, lat, lon, str(first), str(end))
            for p in series:
                p['precipMm'] = precip_window(daily, p['date'])
            rain_ok = True
        except Exception as e:
            log('  precipitation failed', e)
            notes.append(f'Precipitación no disponible (Open-Meteo Archive falló: {e}); precipMm = null.')

    # keep the JSON light: drop helper fields not in the contract except the STAC item id
    for p in series:
        p.pop('datetime')

    flagged = [p for p in series if p['changeFlag']]
    rainy = [p for p in flagged if p['precipMm'] is not None and p['precipMm'] >= RAIN_MM]
    years = sorted({p['date'][:4] for p in series})
    sig_txt = f'{sig:.2f}' if sig is not None else 'n/d'

    interp = interpretation(ident, series, flagged, rainy, rain_ok, last_frac, pol)
    notes += [
        f'Órbita usada: relativa {orbit[0]} ({orbit[1]}), polarización {pol}; {n_orbit} adquisiciones de esa órbita en el '
        f'periodo, {len(series)} seleccionadas. Otras órbitas presentes: '
        + ', '.join(f'{k[0]} {k[1]} ({v})' for k, v in counts.most_common() if k != orbit) + '.' if len(counts) > 1 else
        f'Órbita usada: relativa {orbit[0]} ({orbit[1]}), polarización {pol}; {n_orbit} adquisiciones, {len(series)} seleccionadas.',
        f'σ_Δ robusta del sitio = {sig_txt} dB; escenas marcadas: {len(flagged)} de {max(len(series) - 1, 0)} pares.',
        (f'Fracción de píxeles con |Δ| > {PIXEL_CHANGE_DB:g} dB en el último par sin filtrar: {last_raw:.3f} '
         f'(dominada por speckle; el valor publicado usa el filtro {BOXCAR}×{BOXCAR}).') if last_raw is not None else
        'Sin par final válido para la fracción de píxeles con cambio.',
        'Un cambio de retrodispersión puede deberse a humedad del suelo (lluvia/rocío), migración o removilización de arena, '
        'nieve/hielo o escarcha, vegetación efímera o diferencias residuales de geometría/calibración; este producto no '
        'atribuye causas.',
        'La precipitación de reanálisis es una estimación a escala de celda (decenas de km) y puede no reflejar lluvia local.'
        if rain_ok else 'Sin cruce con precipitación.',
    ]
    if pol == 'HH':
        notes.append('Polarización HH: en esta zona Sentinel-1 solo adquiere HH (modo polar); los dB no son comparables con VV.')
    if ident == 'wright-valley':
        notes.append('En los valles secos la precipitación del reanálisis es nieve en equivalente de agua y muy incierta; '
                     'la cobertura antártica de Sentinel-1 es irregular, por lo que puede haber huecos de varios meses.')
    rec = {
        'site': ident, 'center': [lat, lon], 'collection': COLLECTION, 'polarization': pol, 'windowMeters': 2400,
        'fetchedAt': now_iso(), 'series': series,
        'lastPairChangedFraction': round(last_frac, 4) if last_frac is not None else None,
        'method': method_text(pol, orbit), 'interpretation': interp,
        'license': 'CC BY 4.0 (Sentinel-1 RTC, Planetary Computer)',
        'credit': f'Contains modified Copernicus Sentinel data {"–".join([years[0], years[-1]] if len(years) > 1 else years)}',
        'source': 'https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc',
        'notes': notes,
    }
    write(dest, rec)
    log(f'  {len(series)} scenes {series[0]["date"] if series else "-"}..{series[-1]["date"] if series else "-"} '
        f'flagged={[(p["date"], p["deltaDb"], p["precipMm"]) for p in flagged]} lastPair={rec["lastPairChangedFraction"]}')
    return rec


def interpretation(ident, series, flagged, rainy, rain_ok, last_frac, pol):
    if len(series) < 2:
        return 'Serie insuficiente para evaluar cambios superficiales.'
    means = [p['meanDb'] for p in series]
    rng = max(means) - min(means)
    parts = [f'Entre {series[0]["date"]} y {series[-1]["date"]} la media de gamma0 {pol} en la ventana osciló entre '
             f'{min(means):.1f} y {max(means):.1f} dB (rango {rng:.1f} dB).']
    if not flagged:
        parts.append('No se marcó ningún cambio entre escenas consecutivas: la superficie parece estable a escala de '
                     'la ventana en este periodo.')
    else:
        desc = []
        for p in flagged:
            s = f'{p["date"]} (Δ {p["deltaDb"]:+.1f} dB'
            if p['precipMm'] is not None:
                s += f', {p["precipMm"]:.1f} mm en 72 h' + (' — coincidente con precipitación' if p in rainy else '')
            desc.append(s + ')')
        parts.append(f'Se marcaron {len(flagged)} cambio(s): ' + '; '.join(desc) + '.')
        if all(abs(p['deltaDb']) <= FLAG_ABS_DB for p in flagged):
            parts.append(f'Todos son menores de {FLAG_ABS_DB} dB: anomalías estadísticas frente a la variabilidad propia '
                         'del sitio, del orden de la incertidumbre radiométrica de Sentinel-1 (~0.5–1 dB).')
        if any(p['deltaDb'] > 0 for p in rainy):
            parts.append('Los aumentos de retrodispersión coincidentes con precipitación son compatibles con un posible '
                         'aumento de humedad superficial, sin que ello demuestre la causa.')
        idx = {p['date']: i for i, p in enumerate(series)}
        rebounds = [p for p in flagged if p['deltaDb'] < 0 and idx[p['date']] >= 2
                    and series[idx[p['date']] - 1]['changeFlag']
                    and series[idx[p['date']] - 1]['deltaDb'] * p['deltaDb'] < 0]
        if rebounds:
            many = len(rebounds) > 1
            parts.append(('Los cambios del ' if many else 'El cambio del ') + ', '.join(p['date'] for p in rebounds)
                         + (' invierten el anterior' if many else ' invierte el anterior') + ': posible retorno al nivel '
                         'previo (p. ej. secado), es decir, un episodio transitorio y no un cambio persistente.')
        others = [p for p in flagged if p not in rainy and p not in rebounds]
        if others:
            cause = {'wright-valley': 'posible nieve, escarcha o cambio en el hielo/permafrost superficial',
                     'wadi-rum': 'posible removilización de arena o humedad no registrada',
                     'atacama': 'posible humedad por niebla/camanchaca o lluvia local no registrada, o cambios de costra',
                     'lanzarote': 'posible humedad local o efectos residuales de geometría'}.get(ident, 'causa no determinada')
            parts.append(f'Para los cambios sin precipitación registrada cabe {cause}; no se afirma la causa.')
    if last_frac is not None:
        parts.append(f'Entre las dos últimas pasadas, el {last_frac * 100:.1f} % de los píxeles (filtrados a 50 m) varió '
                     f'más de {PIXEL_CHANGE_DB:g} dB.')
    if not rain_ok:
        parts.append('No se dispuso de precipitación para cruzar las fechas.')
    return ' '.join(parts)


def write(dest, rec):
    validate(rec)
    text = json.dumps(rec, ensure_ascii=False, separators=(',', ':'))
    assert len(text.encode()) < 50_000, f'{dest.name} ≥ 50 KB'
    OUT.mkdir(parents=True, exist_ok=True)
    dest.write_text(text + '\n')
    log(f'  saved {dest.relative_to(ROOT)} ({len(text.encode()) // 1024} KB)')


def finite(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def validate(rec):
    s = rec['series']
    dates = [p['date'] for p in s]
    assert dates == sorted(dates) and len(set(dates)) == len(dates), 'dates not strictly ordered'
    for i, p in enumerate(s):
        datetime.date.fromisoformat(p['date'])
        assert finite(p['meanDb']) and finite(p['stdDb']) and finite(p['validFraction']), p
        assert 0 <= p['validFraction'] <= 1 and -50 < p['meanDb'] < 20
        assert (p['deltaDb'] is None) == (i == 0) and (p['deltaDb'] is None or finite(p['deltaDb']))
        assert isinstance(p['changeFlag'], bool)
        assert p['precipMm'] is None or (finite(p['precipMm']) and p['precipMm'] >= 0)
    f = rec['lastPairChangedFraction']
    assert f is None or (finite(f) and 0 <= f <= 1)
    if not s:
        assert rec['notes'], 'empty series needs an explanation'


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('sites', nargs='*', default=SITE_IDS)
    ap.add_argument('--force', action='store_true', help='rebuild outputs (STAC listings are cached per day, rasters per item)')
    args = ap.parse_args()
    ok = []
    for ident in args.sites:
        try:
            build(ident, args.force)
            ok.append(ident)
        except Exception as e:
            log('FAILED', ident)
            traceback.print_exc()
            try:  # still leave an explicit, empty record rather than nothing
                if args.force or not (OUT / f'{ident}.json').exists():
                    write(OUT / f'{ident}.json', empty_record(ident, fe.SITES[ident], None,
                                                              [f'Sin serie: el procesamiento falló ({type(e).__name__}: {e}).']))
            except Exception:
                traceback.print_exc()
    log(f'Complete: {len(ok)}/{len(args.sites)} sites ({", ".join(ok)}).')
    return 0 if len(ok) == len(args.sites) else 1


if __name__ == '__main__':
    sys.exit(main())
