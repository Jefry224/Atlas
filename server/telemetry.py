"""Telemetría meteorológica para los gemelos terrestres (contrato §3).

Proveedores, en orden:
1. Meteomatics (si METEOMATICS_USERNAME y METEOMATICS_PASSWORD existen), con
   presupuesto diario (por defecto 900 de las 1000 consultas/día del plan).
2. Open-Meteo Forecast API (gratuita, sin clave). También es el respaldo si
   Meteomatics falla o agota el presupuesto.
3. Caché vieja (último valor conocido para esas coordenadas, live:false).
4. assets/data/telemetry-snapshot.json (provider:"snapshot", live:false).
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import logging

import httpx

CACHE_TTL_SECONDS = 600
HTTP_TIMEOUT = httpx.Timeout(6.0, connect=3.0)
# Meteomatics tarda ~5–6 s en responder: límite propio, configurable.
METEOMATICS_TIMEOUT = httpx.Timeout(float(os.environ.get("METEOMATICS_TIMEOUT", "20")), connect=5.0)
log = logging.getLogger("ares.weather")
USER_AGENT = "ares-twin/2.0 (+https://github.com/; NASA Space Apps demo)"

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_CURRENT = (
    "shortwave_radiation,temperature_2m,wind_speed_10m,"
    "wind_gusts_10m,relative_humidity_2m,cloud_cover,wind_direction_10m,precipitation"
)
OPEN_METEO_FIELDS = {
    "shortwave_radiation": "solarRadiationWm2",
    "temperature_2m": "temperatureC",
    "wind_speed_10m": "windSpeedMs",
    "wind_gusts_10m": "windGustMs",
    "relative_humidity_2m": "relativeHumidityPct",
    "cloud_cover": "cloudCoverPct",
    "wind_direction_10m": "windDirDeg",
    "precipitation": "precipMm",
}
OPEN_METEO_SOURCE = {
    "label": "Open-Meteo Forecast API · valores «current» de modelo (15 min)",
    "url": "https://open-meteo.com/en/docs",
}

METEOMATICS_URL = "https://api.meteomatics.com"
METEOMATICS_FIELDS = {
    "global_rad:W": "solarRadiationWm2",
    "t_2m:C": "temperatureC",
    "wind_speed_10m:ms": "windSpeedMs",
    "wind_gusts_10m_1h:ms": "windGustMs",
    "relative_humidity_2m:p": "relativeHumidityPct",
    "total_cloud_cover:p": "cloudCoverPct",
    "wind_dir_10m:d": "windDirDeg",
    "precip_1h:mm": "precipMm",
}
METEOMATICS_SOURCE = {
    "label": "Meteomatics Weather API · modelo mix (now)",
    "url": "https://www.meteomatics.com/en/api/getting-started/",
}

VALUE_KEYS = tuple(OPEN_METEO_FIELDS.values())


class ProviderError(Exception):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_iso(value: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if math.isnan(value) or math.isinf(value) or value <= -999:  # Meteomatics usa -999 como «sin dato»
        return None
    return round(float(value), 1)


def cache_key(lat: float, lon: float) -> tuple[float, float]:
    return (round(lat, 2), round(lon, 2))


def weather_provider_name() -> str:
    if os.environ.get("METEOMATICS_USERNAME") and os.environ.get("METEOMATICS_PASSWORD"):
        return "meteomatics"
    return "open-meteo"


# ---------------------------------------------------------------- proveedores

async def fetch_open_meteo(client: httpx.AsyncClient, lat: float, lon: float) -> dict[str, Any]:
    params = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "current": OPEN_METEO_CURRENT,
        "wind_speed_unit": "ms",
        "timezone": "GMT",
    }
    try:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        current = data["current"]
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise ProviderError(f"open-meteo: {exc}") from exc
    observed = parse_iso(f"{current.get('time', '')}Z") or utc_now()
    values = {key: _num(current.get(field)) for field, key in OPEN_METEO_FIELDS.items()}
    if all(v is None for v in values.values()):
        raise ProviderError("open-meteo: respuesta sin valores")
    return {"observedAt": iso(observed), "values": values, "source": dict(OPEN_METEO_SOURCE)}


async def fetch_meteomatics(client: httpx.AsyncClient, lat: float, lon: float) -> dict[str, Any]:
    user = os.environ.get("METEOMATICS_USERNAME", "")
    password = os.environ.get("METEOMATICS_PASSWORD", "")
    url = f"{METEOMATICS_URL}/now/{','.join(METEOMATICS_FIELDS)}/{lat:.4f},{lon:.4f}/json"
    try:
        resp = await client.get(url, params={"model": "mix"}, auth=(user, password), timeout=METEOMATICS_TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()
        values: dict[str, float | None] = {key: None for key in VALUE_KEYS}
        observed: datetime | None = None
        for item in payload["data"]:
            key = METEOMATICS_FIELDS.get(item.get("parameter"))
            if not key:
                continue
            reading = item["coordinates"][0]["dates"][0]
            values[key] = _num(reading.get("value"))
            observed = observed or parse_iso(reading.get("date", ""))
    except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError) as exc:
        raise ProviderError(f"meteomatics: {exc}") from exc
    if all(v is None for v in values.values()):
        raise ProviderError("meteomatics: respuesta sin valores")
    return {"observedAt": iso(observed or utc_now()), "values": values, "source": dict(METEOMATICS_SOURCE)}


# ------------------------------------------------------------------- servicio

class TelemetryService:
    def __init__(self, snapshot_path: Path, ttl: float = CACHE_TTL_SECONDS,
                 meteomatics_daily_budget: int | None = None) -> None:
        self.snapshot_path = snapshot_path
        self.ttl = ttl
        self.meteomatics_daily_budget = meteomatics_daily_budget if meteomatics_daily_budget is not None else int(
            os.environ.get("METEOMATICS_DAILY_BUDGET", "900"))
        self._cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}
        self._locks: dict[tuple[float, float], asyncio.Lock] = {}
        self._mm_day = ""
        self._mm_count = 0
        self._snapshot: dict[str, Any] | None = None
        self._snapshot_mtime = 0.0

    # -- utilidades
    def clear(self) -> None:
        self._cache.clear()
        self._mm_day, self._mm_count = "", 0

    def _meteomatics_allowed(self) -> bool:
        today = utc_now().strftime("%Y-%m-%d")
        if today != self._mm_day:
            self._mm_day, self._mm_count = today, 0
        return self._mm_count < self.meteomatics_daily_budget

    def _load_snapshot(self) -> dict[str, Any]:
        try:
            mtime = self.snapshot_path.stat().st_mtime
            if self._snapshot is None or mtime != self._snapshot_mtime:
                self._snapshot = json.loads(self.snapshot_path.read_text(encoding="utf-8"))
                self._snapshot_mtime = mtime
        except (OSError, ValueError):
            self._snapshot = {}
        return self._snapshot or {}

    async def _fetch_live(self, lat: float, lon: float) -> tuple[str, dict[str, Any]]:
        errors: list[str] = []
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
            if weather_provider_name() == "meteomatics" and self._meteomatics_allowed():
                self._mm_count += 1
                try:
                    return "meteomatics", await fetch_meteomatics(client, lat, lon)
                except ProviderError as exc:
                    log.warning("telemetría: Meteomatics falló, se usa Open-Meteo: %s", exc)
                    errors.append(str(exc))
            try:
                return "open-meteo", await fetch_open_meteo(client, lat, lon)
            except ProviderError as exc:
                log.warning("telemetría: Open-Meteo falló: %s", exc)
                errors.append(str(exc))
        raise ProviderError("; ".join(errors))

    def _snapshot_reading(self, lat: float, lon: float, site: str | None) -> dict[str, Any] | None:
        snapshot = self._load_snapshot()
        entry = snapshot.get(site) if site else None
        if entry is None:
            # Sitio más cercano del snapshot (máx. ~1° ≈ 110 km) para no inventar lecturas lejanas.
            best, best_d = None, 1.0
            for key, item in snapshot.items():
                try:
                    d = math.hypot(item["lat"] - lat, (item["lon"] - lon) * math.cos(math.radians(lat)))
                except (KeyError, TypeError):
                    continue
                if d <= best_d:
                    best, best_d = (key, item), d
            if best is None:
                return None
            site = site or best[0]
            entry = best[1]
        observed = parse_iso(entry.get("observedAt", "")) or utc_now()
        return {
            "site": site,
            "lat": entry.get("lat", lat),
            "lon": entry.get("lon", lon),
            "observedAt": iso(observed),
            "provider": "snapshot",
            "live": False,
            "cached": False,
            "ageSeconds": max(0, int((utc_now() - observed).total_seconds())),
            "values": {k: entry.get("values", {}).get(k) for k in VALUE_KEYS},
            "source": entry.get("source") or {"label": "Instantánea local", "url": ""},
        }

    @staticmethod
    def _response(site: str | None, lat: float, lon: float, provider: str, reading: dict[str, Any],
                  fetched_at: float, *, live: bool, cached: bool) -> dict[str, Any]:
        return {
            "site": site,
            "lat": lat,
            "lon": lon,
            "observedAt": reading["observedAt"],
            "provider": provider,
            "live": live,
            "cached": cached,
            "ageSeconds": max(0, int(time.time() - fetched_at)),
            "values": dict(reading["values"]),
            "source": dict(reading["source"]),
        }

    async def get(self, lat: float, lon: float, site: str | None = None) -> dict[str, Any] | None:
        key = cache_key(lat, lon)
        rlat, rlon = key
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            hit = self._cache.get(key)
            if hit and time.time() - hit[0] < self.ttl:
                provider, reading = hit[1]["provider"], hit[1]["reading"]
                return self._response(site, rlat, rlon, provider, reading, hit[0], live=True, cached=True)
            try:
                provider, reading = await self._fetch_live(lat, lon)
            except ProviderError:
                if hit:  # caché vieja: ya no es «en vivo»
                    return self._response(site, rlat, rlon, hit[1]["provider"], hit[1]["reading"], hit[0],
                                          live=False, cached=True)
                return self._snapshot_reading(lat, lon, site)
            now = time.time()
            self._cache[key] = (now, {"provider": provider, "reading": reading})
            if len(self._cache) > 2000:  # cota de memoria
                oldest = min(self._cache, key=lambda k: self._cache[k][0])
                self._cache.pop(oldest, None)
                self._locks.pop(oldest, None)
            return self._response(site, rlat, rlon, provider, reading, now, live=True, cached=False)
