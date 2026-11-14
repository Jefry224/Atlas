import json

import httpx
import pytest
import respx

from server import main

OM_FORECAST = {
    "timezone": "America/Santiago", "utc_offset_seconds": -10800,
    "hourly": {
        "time": ["2026-11-14T20:00", "2026-11-14T21:00", "2026-11-14T22:00"],
        "temperature_2m": [20.0, 19.1, 17.4],
        "soil_temperature_0cm": [25.2, 23.8, 22.2],
        "wind_speed_10m": [2.3, 0.7, 1.9],
        "wind_gusts_10m": [9.0, 4.5, 4.0],
        "shortwave_radiation": [83.0, 0.0, 0.0],
        "relative_humidity_2m": [56, 54, 45],
        "precipitation": [0.0, 0.0, 0.0],
    },
}

MM_FORECAST = {
    "status": "OK",
    "data": [
        {"parameter": p, "coordinates": [{"lat": -24.1, "lon": -70.14, "dates": [
            {"date": "2026-11-14T23:00:00Z", "value": v}, {"date": "2026-11-15T00:00:00Z", "value": v - 1}]}]}
        for p, v in [("t_2m:C", 20.0), ("t_0m:C", 25.0), ("wind_speed_10m:ms", 3.0),
                     ("wind_gusts_10m_1h:ms", 9.0), ("global_rad:W", 80.0),
                     ("relative_humidity_2m:p", 50.0), ("precip_1h:mm", 0.0)]
    ],
}

SNAP = {"atacama": {"site": "atacama", "lat": -24.1, "lon": -70.14, "provider": "snapshot", "live": False,
                    "cached": False, "ageSeconds": 0, "fetchedAt": "2026-11-14T17:00:00Z",
                    "timezone": "America/Santiago", "utcOffsetSeconds": -10800,
                    "hours": [{"time": "2026-11-14T23:00:00Z", "tempC": 20.0, "groundTempC": 25.0, "windMs": 2.0,
                               "gustMs": 9.0, "radiationWm2": 80.0, "rhPct": 50.0, "precipMm": 0.0}],
                    "source": {"label": "snapshot de prueba", "url": "https://open-meteo.com/en/docs"}}}

URL = "/api/processes/forecast?lat=-24.102&lon=-70.138&site=atacama"


@pytest.fixture(autouse=True)
def forecast_isolated(monkeypatch, tmp_path):
    snap = tmp_path / "processes-forecast-snapshot.json"
    snap.write_text(json.dumps(SNAP), encoding="utf-8")
    monkeypatch.setattr(main.forecast_service, "snapshot_path", snap)
    monkeypatch.setattr(main.forecast_service, "_snapshot", None)
    main.forecast_service.clear()
    yield


@respx.mock
def test_open_meteo_forecast_shape_and_utc(client):
    route = respx.get("https://api.open-meteo.com/v1/forecast").mock(return_value=httpx.Response(200, json=OM_FORECAST))
    r = client.get(URL)
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "open-meteo" and body["live"] is True and body["cached"] is False
    assert body["timezone"] == "America/Santiago" and body["utcOffsetSeconds"] == -10800
    # 20:00 local (UTC−3) → 23:00Z
    assert body["hours"][0]["time"] == "2026-11-14T23:00:00Z"
    assert set(body["hours"][0]) == {"time", "tempC", "groundTempC", "windMs", "gustMs", "radiationWm2", "rhPct", "precipMm"}
    assert body["hours"][0]["groundTempC"] == 25.2
    params = route.calls[0].request.url.params
    assert params["forecast_hours"] == "72" and "soil_temperature_0cm" in params["hourly"]


@respx.mock
def test_forecast_cached_second_call(client):
    route = respx.get("https://api.open-meteo.com/v1/forecast").mock(return_value=httpx.Response(200, json=OM_FORECAST))
    client.get(URL)
    second = client.get(URL).json()
    assert route.call_count == 1 and second["cached"] is True and second["live"] is True


@respx.mock
def test_forecast_falls_back_to_snapshot(client):
    respx.get("https://api.open-meteo.com/v1/forecast").mock(return_value=httpx.Response(500))
    body = client.get(URL).json()
    assert body["provider"] == "snapshot" and body["live"] is False


@respx.mock
def test_forecast_503_without_provider_or_snapshot(client):
    respx.get("https://api.open-meteo.com/v1/forecast").mock(return_value=httpx.Response(500))
    r = client.get("/api/processes/forecast?lat=60&lon=10")
    assert r.status_code == 503 and r.json() == {"error": "forecast-unavailable"}


@respx.mock
def test_meteomatics_forecast_when_credentials(client, monkeypatch):
    monkeypatch.setenv("METEOMATICS_USERNAME", "u")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "p")
    respx.get(url__regex=r"https://api\.meteomatics\.com/now--now\+72H:PT1H/.*").mock(
        return_value=httpx.Response(200, json=MM_FORECAST))
    body = client.get(URL).json()
    assert body["provider"] == "meteomatics"
    assert [h["time"] for h in body["hours"]] == ["2026-11-14T23:00:00Z", "2026-11-15T00:00:00Z"]
    assert body["hours"][1]["tempC"] == 19.0 and body["hours"][0]["groundTempC"] == 25.0


@respx.mock
def test_meteomatics_failure_uses_open_meteo(client, monkeypatch):
    monkeypatch.setenv("METEOMATICS_USERNAME", "u")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "p")
    respx.get(url__regex=r"https://api\.meteomatics\.com/.*").mock(return_value=httpx.Response(401))
    respx.get("https://api.open-meteo.com/v1/forecast").mock(return_value=httpx.Response(200, json=OM_FORECAST))
    assert client.get(URL).json()["provider"] == "open-meteo"


def test_forecast_validates_input(client):
    assert client.get("/api/processes/forecast?lat=95&lon=0").status_code == 422
    assert client.get("/api/processes/forecast?lat=0&lon=0&site=../x").status_code == 422
