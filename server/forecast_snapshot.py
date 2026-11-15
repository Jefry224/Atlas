"""Genera assets/data/processes-forecast-snapshot.json: un pronóstico horario de 72 h por sitio.

Lo usa el frontend cuando no hay backend (rotulado ARCHIVO; las horas pueden haber pasado).
Regenerar desde la raíz del repo:
    .venv-server/bin/python -m server.forecast_snapshot
"""

from __future__ import annotations

import asyncio
import json
import sys

import httpx

from .forecast import fetch_open_meteo_forecast
from .snapshot import REPO_ROOT, load_sites
from .telemetry import HTTP_TIMEOUT, USER_AGENT, ProviderError, iso, utc_now

OUT = REPO_ROOT / "assets" / "data" / "processes-forecast-snapshot.json"
# Los escenarios usan el centro de su rejilla 65×65 (wadi-rum se movió a 29.56, 35.42).
SCENARIO_CENTERS = {}
for earth_id in ("lanzarote", "wright-valley", "atacama", "wadi-rum"):
    try:
        grid = json.loads((REPO_ROOT / "assets" / "data" / "scenarios" / "earth" / f"{earth_id}.json").read_text(encoding="utf-8"))
        SCENARIO_CENTERS[earth_id] = tuple(grid["center"])
    except (OSError, ValueError, KeyError):
        pass


async def build() -> dict[str, dict]:
    sites = {**load_sites(), **SCENARIO_CENTERS}
    out: dict[str, dict] = {}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        for site, (lat, lon) in sites.items():
            try:
                data = await fetch_open_meteo_forecast(client, lat, lon)
            except ProviderError as exc:
                print(f"sin pronóstico {site}: {exc}", file=sys.stderr)
                continue
            out[site] = {"site": site, "lat": round(lat, 2), "lon": round(lon, 2), "provider": "snapshot",
                         "live": False, "cached": False, "ageSeconds": 0, "fetchedAt": iso(utc_now()), **data}
            print(f"ok {site}: {len(data['hours'])} h")
            await asyncio.sleep(0.2)
    return out


def main() -> int:
    snapshot = asyncio.run(build())
    if not snapshot:
        print("No se obtuvo ningún pronóstico; no se escribe el archivo.", file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"escrito {OUT} ({len(snapshot)} sitios)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
