"""Contrato de presión local y vigencia con proveedores simulados, sin red."""

from copy import deepcopy
from datetime import datetime, timezone
import json

import httpx
import pytest
import respx

from server import main, telemetry
from server.tests.test_api import METEOMATICS_OK, OPEN_METEO_OK

NOW = datetime(2026, 11, 14, 17, 10, tzinfo=timezone.utc).timestamp()
PARAMS = {"lat": -24.102, "lon": -70.138, "site": "atacama"}


@pytest.fixture(autouse=True)
def clock(monkeypatch):
    monkeypatch.setattr(telemetry.time, "time", lambda: NOW)
    monkeypatch.setattr(telemetry, "utc_now", lambda: datetime.fromtimestamp(NOW, timezone.utc))


@pytest.mark.parametrize("value,unit,expected", [
    (983.271, "hPa", 98327.1), (98327.1, "Pa", 98327.1),
    (100, "hPa", 10000.0), (1200, "hPa", 120000.0),
    (None, "hPa", None), (False, "hPa", None), (True, "Pa", None),
    ("983.2", "hPa", None), (-999, "hPa", None), (-888, "hPa", None),
    (-777, "Pa", None), (-666, "Pa", None), (0, "hPa", None), (-1, "Pa", None),
    (99.9, "hPa", None), (1200.1, "hPa", None),
    (98327, "hPa", None), (983.2, "Pa", None),
    (983.2, None, None), (983.2, "unknown", None), (983.2, {}, None),
    (983.2, "mbar", None), (983.2, "hpa", None), (983.2, " hPa", None),
    (float("nan"), "Pa", None), (float("inf"), "Pa", None),
    (10 ** 1000, "Pa", None),
])
def test_pressure_conversion_validation(value, unit, expected):
    assert telemetry._pressure_pa(value, unit) == expected


@pytest.mark.parametrize("value,unit", [(None, "hPa"), (-999, "hPa"), (983, "unknown"),
                                        (983, None), (983, {}), (999999, "hPa"), (False, "hPa")])
@respx.mock
def test_open_meteo_optional_pressure_keeps_other_weather(client, value, unit):
    payload = deepcopy(OPEN_METEO_OK)
    payload["current"]["surface_pressure"] = value
    payload["current_units"]["surface_pressure"] = unit
    respx.get(telemetry.OPEN_METEO_URL).respond(200, json=payload)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["provider"] == "open-meteo" and body["live"] is True
    assert body["values"]["surfacePressurePa"] is None
    assert body["values"]["temperatureC"] == 29.4


@respx.mock
def test_open_meteo_absent_pressure_does_not_use_msl(client):
    payload = deepcopy(OPEN_METEO_OK)
    del payload["current"]["surface_pressure"]
    payload["current"]["pressure_msl"] = 1013.25
    respx.get(telemetry.OPEN_METEO_URL).respond(200, json=payload)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["values"]["surfacePressurePa"] is None
    assert body["values"]["windSpeedMs"] == 6.2


@pytest.mark.parametrize("units", [None, {}, "unknown", {"surface_pressure": "unknown"}])
@respx.mock
def test_unknown_units_cannot_be_accepted_as_si(client, units):
    payload = deepcopy(OPEN_METEO_OK)
    payload["current_units"] = units
    respx.get(telemetry.OPEN_METEO_URL).respond(200, json=payload)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["provider"] == "snapshot" and body["live"] is False


@pytest.mark.parametrize("observed,expected,age", [
    ("2026-11-14T17:00", True, 600),
    ("2026-11-14T17:00:00Z", True, 600),
    ("2026-11-14T11:00:00-06:00", True, 600),
    ("2026-11-14T16:40", True, 1800),
    ("2026-11-14T16:39:59Z", False, 1801),
    ("2026-11-13T17:10", False, 86400),
    ("2026-11-14T17:15", True, 0),
    ("2026-11-14T17:15:01Z", False, 0),
    (None, False, None), (1234, False, None), ("invalid", False, None),
    ("2026-11-14", False, None),
    ("0001-01-01T00:00:00+23:59", False, None),
])
@respx.mock
def test_recent_fetch_does_not_reset_observation_age(client, observed, expected, age):
    payload = deepcopy(OPEN_METEO_OK)
    payload["current"]["time"] = observed
    route = respx.get(telemetry.OPEN_METEO_URL).respond(200, json=payload)
    first = client.get("/api/telemetry", params=PARAMS).json()
    second = client.get("/api/telemetry", params=PARAMS).json()
    assert first["live"] is expected and second["live"] is expected
    assert first["ageSeconds"] == 0 and first["observationAgeSeconds"] == age
    assert first["observedAt"] == second["observedAt"]
    if age is None:
        assert first["observedAt"] is None
    assert first["cached"] is False and second["cached"] is True
    assert route.call_count == 1


@respx.mock
def test_cached_observation_can_become_stale_before_cache_ttl(client, monkeypatch):
    payload = deepcopy(OPEN_METEO_OK)
    payload["current"]["time"] = "2026-11-14T16:41Z"
    route = respx.get(telemetry.OPEN_METEO_URL).respond(200, json=payload)
    first = client.get("/api/telemetry", params=PARAMS).json()
    monkeypatch.setattr(telemetry.time, "time", lambda: NOW + 61)
    second = client.get("/api/telemetry", params=PARAMS).json()
    assert first["live"] is True and second["live"] is False
    assert second["ageSeconds"] == 61 and second["observationAgeSeconds"] == 1801
    assert first["fetchedAt"] == second["fetchedAt"]
    assert second["cached"] is True and route.call_count == 1


@respx.mock
def test_old_cache_format_gains_null_pressure_without_fetch(client):
    key = telemetry.cache_key(PARAMS["lat"], PARAMS["lon"])
    main.telemetry_service._cache[key] = (NOW, {
        "provider": "open-meteo", "reading": {
            "observedAt": "2026-11-14T17:00:00Z", "values": {"temperatureC": 25.5},
            "source": {"label": "modelo de caché anterior", "url": "https://open-meteo.com/en/docs"},
        },
    })
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["cached"] is True and body["live"] is True
    assert body["values"]["surfacePressurePa"] is None and body["values"]["temperatureC"] == 25.5


@respx.mock
def test_explicit_provider_failure_preserves_cached_observation(client, monkeypatch):
    route = respx.get(telemetry.OPEN_METEO_URL)
    route.side_effect = [httpx.Response(200, json=OPEN_METEO_OK), httpx.Response(503)]
    first = client.get("/api/telemetry", params=PARAMS).json()
    monkeypatch.setattr(telemetry.time, "time", lambda: NOW + 601)
    stale = client.get("/api/telemetry", params=PARAMS).json()
    assert stale["live"] is False and stale["cached"] is True
    assert stale["provider"] == first["provider"] and stale["source"] == first["source"]
    assert stale["values"] == first["values"] and stale["observedAt"] == first["observedAt"]
    assert stale["fetchedAt"] == first["fetchedAt"]
    assert stale["ageSeconds"] == 601 and stale["observationAgeSeconds"] == 1201


@pytest.mark.parametrize("observed", [None, "invalid", 1234])
@respx.mock
def test_old_snapshot_does_not_invent_observation_or_pressure(client, observed):
    service = main.telemetry_service
    entry = {"atacama": {"observedAt": observed, "values": {"temperatureC": 25},
                          "source": {"label": "modelo archivado", "url": "https://open-meteo.com/en/docs"}}}
    service.snapshot_path.write_text(json.dumps(entry))
    respx.get(telemetry.OPEN_METEO_URL).respond(503)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["provider"] == "snapshot" and body["live"] is False
    assert body["observedAt"] is None and body["observationAgeSeconds"] is None
    assert body["fetchedAt"] is None and body["ageSeconds"] is None
    assert body["values"]["surfacePressurePa"] is None
    assert body["values"]["temperatureC"] == 25
    assert body["source"] == entry["atacama"]["source"]


@pytest.mark.parametrize("value", [None, -999, -888, -777, -666, 0, 1000000, "98000", False])
@respx.mock
def test_meteomatics_invalid_pressure_does_not_remove_weather(client, monkeypatch, value):
    monkeypatch.setenv("METEOMATICS_USERNAME", "test-user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "test-password")
    payload = deepcopy(METEOMATICS_OK)
    next(item for item in payload["data"] if item["parameter"] == "sfc_pressure:Pa")["coordinates"][0]["dates"][0]["value"] = value
    route = respx.get(url__startswith=telemetry.METEOMATICS_URL).respond(200, json=payload)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["provider"] == "meteomatics" and body["live"] is True
    assert body["values"]["surfacePressurePa"] is None
    assert body["values"]["temperatureC"] == 28.9 and route.call_count == 1


@pytest.mark.parametrize("pressure", [
    {"parameter": "sfc_pressure:Pa", "coordinates": []},
    {"parameter": "sfc_pressure:Pa", "coordinates": [{"dates": None}]},
    {"parameter": "sfc_pressure:Pa", "coordinates": [{"dates": [{}]}]},
    {"parameter": "sfc_pressure:hPa", "coordinates": [{"dates": [{"value": 980}]}]},
    {"parameter": "sfc_pressure:unknown", "coordinates": [{"dates": [{"value": 980}]}]},
    {"parameter": "msl_pressure:Pa", "coordinates": [{"dates": [{"value": 101325}]}]},
    None,
])
@respx.mock
def test_meteomatics_missing_or_malformed_pressure_is_optional(client, monkeypatch, pressure):
    monkeypatch.setenv("METEOMATICS_USERNAME", "test-user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "test-password")
    payload = deepcopy(METEOMATICS_OK)
    pressure_index = next(i for i, item in enumerate(payload["data"]) if item["parameter"] == "sfc_pressure:Pa")
    payload["data"][pressure_index] = pressure
    respx.get(url__startswith=telemetry.METEOMATICS_URL).respond(200, json=payload)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["provider"] == "meteomatics" and body["live"] is True
    assert body["values"]["surfacePressurePa"] is None
    assert body["values"]["windSpeedMs"] == 5.5


@respx.mock
def test_meteomatics_response_without_pressure_keeps_weather(client, monkeypatch):
    monkeypatch.setenv("METEOMATICS_USERNAME", "test-user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "test-password")
    payload = deepcopy(METEOMATICS_OK)
    payload["data"] = [item for item in payload["data"] if item["parameter"] != "sfc_pressure:Pa"]
    route = respx.get(url__startswith=telemetry.METEOMATICS_URL).respond(200, json=payload)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["provider"] == "meteomatics" and body["live"] is True
    assert body["values"]["surfacePressurePa"] is None
    assert body["values"]["temperatureC"] == 28.9 and route.call_count == 1


@pytest.mark.parametrize("status", [400, 403, 422])
@respx.mock
def test_meteomatics_pressure_rejected_retries_base_weather_with_budget(client, monkeypatch, status):
    monkeypatch.setenv("METEOMATICS_USERNAME", "test-user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "test-password")
    payload = deepcopy(METEOMATICS_OK)
    payload["data"] = [item for item in payload["data"] if item["parameter"] != "sfc_pressure:Pa"]
    route = respx.get(url__startswith=telemetry.METEOMATICS_URL)
    route.side_effect = [httpx.Response(status), httpx.Response(200, json=payload),
                         httpx.Response(200, json=payload)]
    first = client.get("/api/telemetry", params=PARAMS).json()
    second = client.get("/api/telemetry", params={"lat": 1, "lon": 1}).json()
    assert first["provider"] == second["provider"] == "meteomatics"
    assert first["values"]["surfacePressurePa"] is None
    assert first["values"]["temperatureC"] == 28.9
    assert "sfc_pressure:Pa" in str(route.calls[0].request.url)
    assert all("sfc_pressure" not in str(c.request.url) for c in route.calls[1:])
    assert main.telemetry_service._mm_count == route.call_count == 3


@respx.mock
def test_pressure_retry_cannot_exceed_meteomatics_budget(client, monkeypatch):
    monkeypatch.setenv("METEOMATICS_USERNAME", "test-user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "test-password")
    monkeypatch.setattr(main.telemetry_service, "meteomatics_daily_budget", 1)
    mm = respx.get(url__startswith=telemetry.METEOMATICS_URL).respond(403)
    om = respx.get(telemetry.OPEN_METEO_URL).respond(200, json=OPEN_METEO_OK)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert mm.call_count == 1 and om.call_count == 1
    assert main.telemetry_service._mm_count == 1
    assert body["provider"] == "open-meteo" and body["values"]["surfacePressurePa"] == 98327


@respx.mock
def test_meteomatics_error_status_is_not_live(client, monkeypatch):
    monkeypatch.setenv("METEOMATICS_USERNAME", "test-user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "test-password")
    payload = deepcopy(METEOMATICS_OK)
    payload["status"] = "ERROR"
    respx.get(url__startswith=telemetry.METEOMATICS_URL).respond(200, json=payload)
    respx.get(telemetry.OPEN_METEO_URL).respond(500)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["provider"] == "snapshot" and body["live"] is False


@pytest.mark.parametrize("date,expected", [("2026-11-13T17:10Z", "2026-11-13T17:10:00Z"), (None, None)])
@respx.mock
def test_meteomatics_uses_oldest_or_unknown_observation(client, monkeypatch, date, expected):
    monkeypatch.setenv("METEOMATICS_USERNAME", "test-user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "test-password")
    payload = deepcopy(METEOMATICS_OK)
    next(item for item in payload["data"] if item["parameter"] == "sfc_pressure:Pa")["coordinates"][0]["dates"][0]["date"] = date
    respx.get(url__startswith=telemetry.METEOMATICS_URL).respond(200, json=payload)
    body = client.get("/api/telemetry", params=PARAMS).json()
    assert body["provider"] == "meteomatics" and body["live"] is False
    assert body["observedAt"] == expected and body["ageSeconds"] == 0
