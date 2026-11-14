"""Regenera assets/data/telemetry-snapshot.json con UNA lectura real de Open-Meteo.

Uso (desde la raíz del repo):
    .venv-server/bin/python -m server.snapshot            # escribe el archivo
    .venv-server/bin/python -m server.snapshot --dry-run  # solo imprime

Sitios: los 14 de data.js + «wadi-rum» (solo escenario, contrato §1).
Formato: { "<siteId>": <respuesta de /api/telemetry> } con provider "snapshot" y live:false.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import httpx

from .telemetry import (OPEN_METEO_CURRENT, OPEN_METEO_FIELDS, OPEN_METEO_URL, USER_AGENT, _num, iso,
                        parse_iso, utc_now)

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_JS = REPO_ROOT / "data.js"
OUT_PATH = REPO_ROOT / "assets" / "data" / "telemetry-snapshot.json"
EXTRA_SITES = {"wadi-rum": (29.57, 35.42)}

_SITE_RE = re.compile(r"id:\s*'([a-z0-9-]+)'.*?lat:\s*(-?\d+(?:\.\d+)?),\s*lon:\s*(-?\d+(?:\.\d+)?)", re.S)


def load_sites() -> dict[str, tuple[float, float]]:
    text = DATA_JS.read_text(encoding="utf-8")
    sites = {sid: (float(lat), float(lon)) for sid, lat, lon in _SITE_RE.findall(text)}
    if len(sites) != 14:
        raise SystemExit(f"Se esperaban 14 sitios en data.js y se encontraron {len(sites)}")
    sites.update(EXTRA_SITES)
    return sites


def fetch(sites: dict[str, tuple[float, float]]) -> dict[str, dict]:
    ids = list(sites)
    params = {
        "latitude": ",".join(f"{sites[i][0]:.4f}" for i in ids),
        "longitude": ",".join(f"{sites[i][1]:.4f}" for i in ids),
        "current": OPEN_METEO_CURRENT,
        "wind_speed_unit": "ms",
        "timezone": "GMT",
    }
    resp = httpx.get(OPEN_METEO_URL, params=params, timeout=30, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    payload = resp.json()
    if isinstance(payload, dict):
        payload = [payload]
    fetched = iso(utc_now())
    out: dict[str, dict] = {}
    for sid, item in zip(ids, payload, strict=True):
        current = item["current"]
        observed = parse_iso(f"{current['time']}Z")
        lat, lon = sites[sid]
        out[sid] = {
            "site": sid,
            "lat": lat,
            "lon": lon,
            "observedAt": iso(observed) if observed else fetched,
            "provider": "snapshot",
            "live": False,
            "cached": False,
            "ageSeconds": 0,
            "values": {key: _num(current.get(field)) for field, key in OPEN_METEO_FIELDS.items()},
            "source": {
                "label": f"Instantánea de Open-Meteo Forecast API («current», modelo) tomada el {fetched}; no es en vivo",
                "url": "https://open-meteo.com/en/docs",
            },
        }
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    snapshot = fetch(load_sites())
    text = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    if args.dry_run:
        sys.stdout.write(text)
    else:
        OUT_PATH.write_text(text, encoding="utf-8")
        print(f"Escrito {OUT_PATH.relative_to(REPO_ROOT)} ({len(snapshot)} sitios)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
