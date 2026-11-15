import json
import time
from datetime import datetime, timezone

import httpx
import pytest
import respx

from server import copilot, main, telemetry

OPEN_METEO_OK = {
    "latitude": -24.1, "longitude": -70.14,
    "current_units": {"shortwave_radiation": "W/m²", "temperature_2m": "°C", "wind_speed_10m": "m/s",
                      "wind_gusts_10m": "m/s", "relative_humidity_2m": "%", "cloud_cover": "%",
                      "surface_pressure": "hPa", "wind_direction_10m": "°", "precipitation": "mm"},
    "current": {"time": "2026-11-14T17:00", "interval": 900, "shortwave_radiation": 1148.0,
                "temperature_2m": 29.4, "wind_speed_10m": 6.2, "wind_gusts_10m": 12.4,
                "relative_humidity_2m": 25, "cloud_cover": 16, "surface_pressure": 983.27,
                "wind_direction_10m": 225.0, "precipitation": 0.4},
}

METEOMATICS_OK = {
    "version": "3.0", "status": "OK",
    "data": [
        {"parameter": p, "coordinates": [{"lat": -24.1, "lon": -70.14,
                                          "dates": [{"date": "2026-11-14T17:05:00Z", "value": v}]}]}
        for p, v in [("global_rad:W", 1100.5), ("t_2m:C", 28.9), ("wind_speed_10m:ms", 5.5),
                     ("wind_gusts_10m_1h:ms", 11.0), ("relative_humidity_2m:p", 24.0),
                     ("total_cloud_cover:p", 10.0), ("sfc_pressure:Pa", 98234.5),
                     ("wind_dir_10m:d", 210.0), ("precip_1h:mm", 0.6)]
    ],
}

VALUE_KEYS = {"solarRadiationWm2", "temperatureC", "windSpeedMs", "windGustMs", "relativeHumidityPct",
              "cloudCoverPct", "surfacePressurePa", "windDirDeg", "precipMm"}
TOP_KEYS = {"site", "lat", "lon", "observedAt", "provider", "live", "cached", "ageSeconds", "values", "source",
            "fetchedAt", "observationAgeSeconds"}


@pytest.fixture(autouse=True)
def telemetry_clock(monkeypatch):
    # Las observaciones simuladas tienen una fecha fija: vigencia determinista, sin red.
    now = datetime(2026, 11, 14, 17, 10, tzinfo=timezone.utc)
    monkeypatch.setattr(telemetry.time, "time", lambda: now.timestamp())
    monkeypatch.setattr(telemetry, "utc_now", lambda: now)

CONTEXT = {
    "scenario": {"id": "hyperarid-salt", "title": "Sal hiperárida", "focus": "térmico"},
    "earth": {"id": "atacama", "name": "Atacama",
              "telemetry": {"provider": "open-meteo", "live": True,
                            "values": {"temperatureC": 29.4, "windSpeedMs": 6.2}}},
    "rover": {"batteryPct": 82, "pitchDeg": 3.1},
    "similarity": {"index": 71, "comparable": True},
}


# ------------------------------------------------------------------ health

def test_health_shape(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": "2.0.0",
                        "providers": {"weather": "open-meteo", "ai": "none"}}


def test_health_reports_configured_providers(client, monkeypatch):
    monkeypatch.setenv("METEOMATICS_USERNAME", "u")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "p")
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    assert client.get("/api/health").json()["providers"] == {"weather": "meteomatics", "ai": "openai"}


# --------------------------------------------------------------- telemetry

@respx.mock
def test_telemetry_open_meteo_shape(client):
    route = respx.get(telemetry.OPEN_METEO_URL).mock(return_value=httpx.Response(200, json=OPEN_METEO_OK))
    r = client.get("/api/telemetry", params={"lat": -24.102, "lon": -70.138, "site": "atacama"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == TOP_KEYS
    assert set(body["values"]) == VALUE_KEYS
    assert body["provider"] == "open-meteo" and body["live"] is True and body["cached"] is False
    assert body["site"] == "atacama" and body["lat"] == -24.1 and body["lon"] == -70.14
    assert body["observedAt"] == "2026-11-14T17:00:00Z"
    assert body["values"]["temperatureC"] == 29.4
    assert body["values"]["surfacePressurePa"] == 98327.0
    assert body["values"]["windDirDeg"] == 225.0 and body["values"]["precipMm"] == 0.4
    assert body["observationAgeSeconds"] == 600 and body["ageSeconds"] == 0
    assert body["fetchedAt"] == "2026-11-14T17:10:00Z"
    assert body["source"]["url"].startswith("https://")
    q = route.calls.last.request.url.params
    assert q["wind_speed_unit"] == "ms"
    assert "shortwave_radiation" in q["current"] and "cloud_cover" in q["current"]
    assert "surface_pressure" in q["current"] and "pressure_msl" not in q["current"]
    assert "wind_direction_10m" in q["current"] and "precipitation" in q["current"]


@respx.mock
def test_telemetry_cache_hits_within_ttl(client):
    route = respx.get(telemetry.OPEN_METEO_URL).mock(return_value=httpx.Response(200, json=OPEN_METEO_OK))
    first = client.get("/api/telemetry", params={"lat": -24.102, "lon": -70.138}).json()
    # Misma celda de 0.01° -> caché
    second = client.get("/api/telemetry", params={"lat": -24.1049, "lon": -70.1351}).json()
    assert route.call_count == 1
    assert first["cached"] is False and second["cached"] is True and second["live"] is True
    assert second["values"] == first["values"]
    # Otra celda -> nueva consulta
    client.get("/api/telemetry", params={"lat": -24.2, "lon": -70.138})
    assert route.call_count == 2


@respx.mock
def test_telemetry_cache_expires(client, monkeypatch):
    route = respx.get(telemetry.OPEN_METEO_URL).mock(return_value=httpx.Response(200, json=OPEN_METEO_OK))
    client.get("/api/telemetry", params={"lat": 10, "lon": 10})
    real = time.time
    monkeypatch.setattr(telemetry.time, "time", lambda: real() + telemetry.CACHE_TTL_SECONDS + 1)
    r = client.get("/api/telemetry", params={"lat": 10, "lon": 10}).json()
    assert route.call_count == 2 and r["cached"] is False


@respx.mock
def test_telemetry_stale_cache_when_provider_fails(client, monkeypatch):
    route = respx.get(telemetry.OPEN_METEO_URL)
    route.side_effect = [httpx.Response(200, json=OPEN_METEO_OK), httpx.ConnectError("caído")]
    client.get("/api/telemetry", params={"lat": 10, "lon": 10})
    real = time.time
    monkeypatch.setattr(telemetry.time, "time", lambda: real() + 3600)
    r = client.get("/api/telemetry", params={"lat": 10, "lon": 10}).json()
    assert r["provider"] == "open-meteo" and r["cached"] is True and r["live"] is False
    assert r["ageSeconds"] >= 3600


@respx.mock
def test_telemetry_falls_back_to_snapshot(client):
    respx.get(telemetry.OPEN_METEO_URL).mock(return_value=httpx.Response(500))
    r = client.get("/api/telemetry", params={"lat": -24.102, "lon": -70.138, "site": "atacama"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == TOP_KEYS
    assert body["provider"] == "snapshot" and body["live"] is False
    assert body["values"]["temperatureC"] == 29.4
    assert body["values"]["surfacePressurePa"] is None  # Archivo previo a la extensión.
    assert body["ageSeconds"] >= 0


@respx.mock
def test_telemetry_snapshot_nearest_site_without_id(client):
    respx.get(telemetry.OPEN_METEO_URL).mock(side_effect=httpx.ReadTimeout("lento"))
    body = client.get("/api/telemetry", params={"lat": -24.3, "lon": -70.0}).json()
    assert body["provider"] == "snapshot" and body["site"] == "atacama"


@respx.mock
def test_telemetry_503_when_nothing_available(client):
    respx.get(telemetry.OPEN_METEO_URL).mock(return_value=httpx.Response(502))
    r = client.get("/api/telemetry", params={"lat": 0, "lon": 0})
    assert r.status_code == 503 and r.json() == {"error": "telemetry-unavailable"}


@respx.mock
def test_telemetry_meteomatics_when_configured(client, monkeypatch):
    monkeypatch.setenv("METEOMATICS_USERNAME", "user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "pass")
    mm = respx.get(url__startswith=telemetry.METEOMATICS_URL).mock(
        return_value=httpx.Response(200, json=METEOMATICS_OK))
    om = respx.get(telemetry.OPEN_METEO_URL).mock(return_value=httpx.Response(200, json=OPEN_METEO_OK))
    body = client.get("/api/telemetry", params={"lat": -24.102, "lon": -70.138}).json()
    assert body["provider"] == "meteomatics" and body["live"] is True
    assert body["values"]["windGustMs"] == 11.0 and body["observedAt"] == "2026-11-14T17:05:00Z"
    assert body["values"]["surfacePressurePa"] == 98234.5
    assert body["values"]["windDirDeg"] == 210.0 and body["values"]["precipMm"] == 0.6
    assert mm.call_count == 1 and om.call_count == 0
    req = mm.calls.last.request
    assert "t_2m:C" in str(req.url) and req.headers["authorization"].startswith("Basic ")
    assert "sfc_pressure:Pa" in str(req.url) and "msl_pressure" not in str(req.url)
    assert "wind_dir_10m:d" in str(req.url) and "precip_1h:mm" in str(req.url)


@respx.mock
def test_meteomatics_daily_budget_falls_back_to_open_meteo(client, monkeypatch):
    monkeypatch.setenv("METEOMATICS_USERNAME", "user")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "pass")
    monkeypatch.setattr(main.telemetry_service, "meteomatics_daily_budget", 1)
    mm = respx.get(url__startswith=telemetry.METEOMATICS_URL).mock(
        return_value=httpx.Response(200, json=METEOMATICS_OK))
    respx.get(telemetry.OPEN_METEO_URL).mock(return_value=httpx.Response(200, json=OPEN_METEO_OK))
    assert client.get("/api/telemetry", params={"lat": 1, "lon": 1}).json()["provider"] == "meteomatics"
    assert client.get("/api/telemetry", params={"lat": 2, "lon": 2}).json()["provider"] == "open-meteo"
    assert mm.call_count == 1


@pytest.mark.parametrize("params", [
    {"lat": 91, "lon": 0}, {"lat": -90.5, "lon": 0}, {"lat": 0, "lon": 181}, {"lat": 0, "lon": -200},
    {"lat": "abc", "lon": 0}, {"lat": "nan", "lon": 0}, {"lon": 0}, {"lat": 0},
    {"lat": 0, "lon": 0, "site": "../etc"}, {"lat": 0, "lon": 0, "site": "A" * 10},
])
def test_telemetry_rejects_bad_input(client, params):
    r = client.get("/api/telemetry", params=params)
    assert r.status_code == 422
    assert r.json()["error"] == "invalid-input"


# ----------------------------------------------------------------- copilot

def test_copilot_503_without_ai_provider(client):
    r = client.post("/api/copilot", json={"question": "¿Estado?", "context": CONTEXT})
    assert r.status_code == 503 and r.json() == {"error": "no-ai-provider"}


@respx.mock
def test_copilot_openai_compatible_provider(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    model_out = json.dumps({"answer": "ESTADO: NOMINAL. Temperatura 29,4 °C [live].",
                            "grounded": ["earth.telemetry.values.temperatureC", "rover.batteryPct",
                                         "inventado.campo"]})
    monkeypatch.setenv("OPENAI_BASE_URL", "https://ai.edream.dev/v1/")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-6.1-sol")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "gpt-6.1-sol")
    route = respx.post("https://ai.edream.dev/v1/chat/completions").mock(
        return_value=httpx.Response(200, json={"choices": [{"message": {"content": model_out}}],
                                               "model": "gpt-6.1-sol"}))
    r = client.post("/api/copilot", json={"question": "¿Puedo avanzar?", "context": CONTEXT})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"answer", "provider", "model", "grounded", "generatedAt", "disclaimer"}
    assert body["provider"] == "openai" and body["model"] == "gpt-6.1-sol"
    # rutas en forma de contrato; las inexistentes se descartan
    assert body["grounded"] == ["earth.telemetry.temperatureC", "rover.batteryPct"]
    assert "simulación" in body["disclaimer"].lower()
    sent = json.loads(route.calls.last.request.content)
    assert route.calls.last.request.headers["authorization"] == "Bearer test-key"
    assert sent["messages"][0]["role"] == "system" and "Flight Director" in sent["messages"][0]["content"]
    assert "earth.telemetry.temperatureC = 29.4" in sent["messages"][1]["content"]
    assert sent["model"] == "gpt-6.1-sol"


@respx.mock
def test_copilot_forwards_browser_history_as_standard_chat_messages(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-6.1-sol")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "gpt-6.1-sol")
    route = respx.post("https://ai.edream.dev/v1/chat/completions").mock(
        return_value=httpx.Response(200, json={"choices": [{"message": {"content":
            '{"answer":"La primera pregunta fue hello which model are you?","grounded":[]}'}}]}))

    response = client.post("/api/copilot", json={
        "question": "¿Cuál fue la primera pregunta?", "context": {},
        "history": [{"role": "user", "content": "hello which model are you?"},
                    {"role": "assistant", "content": "Soy el asistente."}],
    })

    assert response.status_code == 200
    sent_messages = json.loads(route.calls.last.request.content)["messages"]
    assert sent_messages[0]["role"] == "system"
    assert sent_messages[1:3] == [
        {"role": "user", "content": "hello which model are you?"},
        {"role": "assistant", "content": "Soy el asistente."},
    ]
    assert sent_messages[-1]["role"] == "user"
    assert "¿Cuál fue la primera pregunta?" in sent_messages[-1]["content"]


def test_copilot_removes_internal_field_citations_from_visible_answer():
    answer, grounded = copilot.parse_model_output(
        "Los datos están en vivo [earth.telemetry.live] y se actualizaron "
        "a las 03:43 [earth.telemetry.observedAt]. La curva publicada "
        "[target.thermal.minK] aún debe compararse con la fuente. "
        "Matriz [analogyAudit.matrix[5].status].",
        {"earth.telemetry.live": True, "earth.telemetry.observedAt": "03:43",
         "target.thermal.minK": 100, "analogyAudit.matrix[5].status": "unknown"},
    )

    assert answer == "Los datos están en vivo (sí) y se actualizaron a las 03:43 (03:43). La curva publicada (100) aún debe compararse con la fuente. Matriz (unknown)."
    assert grounded == []


def test_copilot_keeps_internal_citations_in_grounded_but_not_answer():
    answer, grounded = copilot.parse_model_output(json.dumps({
        "answer": "La curva está publicada [target.thermal.minK].",
        "grounded": ["target.thermal.minK"],
    }), {"target.thermal.minK": 100})

    assert answer == "La curva está publicada (100)."
    assert grounded == ["target.thermal.minK"]


@respx.mock
def test_copilot_uses_fallback_model_when_primary_fails(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    primary = respx.post("https://ai.edream.dev/v1/chat/completions").mock(side_effect=[
        httpx.Response(503),
        httpx.Response(200, json={"choices": [{"message": {"content":
            '{"answer":"Respaldo activo.","grounded":[]}'}}], "model": "gemini-3.8-flash"}),
    ])
    monkeypatch.setenv("OPENAI_MODEL", "gpt-6.1-sol")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "gemini-3.8-flash")

    response = client.post("/api/copilot", json={"question": "Prueba", "context": {}})

    assert response.status_code == 200
    assert response.json()["model"] == "gemini-3.8-flash"
    assert [json.loads(call.request.content)["model"] for call in primary.calls] == [
        "gpt-6.1-sol", "gemini-3.8-flash",
    ]


def test_copilot_input_token_limit_returns_413_before_provider_call(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(copilot, "input_token_count", lambda system, user, history=None: copilot.MAX_INPUT_TOKENS + 1)
    response = client.post("/api/copilot", json={"question": "¿Estado?", "context": CONTEXT})
    assert response.status_code == 413
    assert response.json() == {"error": "context-too-large"}


@respx.mock
def test_copilot_provider_failure_is_503(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "gemini-3.8-flash")
    respx.post("https://ai.edream.dev/v1/chat/completions").mock(return_value=httpx.Response(503))
    r = client.post("/api/copilot", json={"question": "hola", "context": {}})
    assert r.status_code == 503 and r.json() == {"error": "ai-provider-unavailable"}


@pytest.mark.parametrize("payload,status", [
    ({"question": "", "context": {}}, 422),
    ({"question": "   ", "context": {}}, 422),
    ({"question": "x" * (main.MAX_QUESTION_CHARS + 1), "context": {}}, 422),
    ({"context": {}}, 422),
    ({"question": "ok", "context": "no-es-objeto"}, 422),
])
def test_copilot_validation(client, monkeypatch, payload, status):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    assert client.post("/api/copilot", json=payload).status_code == status


@respx.mock
def test_copilot_rate_limit(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(main.copilot_limiter, "per_ip", 2)
    respx.post("https://ai.edream.dev/v1/chat/completions").mock(
        return_value=httpx.Response(200, json={"choices": [{"message": {
            "content": '{"answer":"ok","grounded":[]}'}}]}))
    codes = [client.post("/api/copilot", json={"question": "q", "context": {}}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# ------------------------------------------------------------------ static

def test_static_index_served(client):
    r = client.get("/")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    assert client.get("/data.js").status_code == 200


@pytest.mark.parametrize("path", [
    "/server/main.py", "/server/", "/server/prompts/flight_director.md", "/server/requirements.txt",
    "/.git/config", "/.git/HEAD", "/.gitignore", "/.venv-server/pyvenv.cfg", "/.env", "/.aws/credentials",
    "/scripts/terrain_metrics.py", "/scripts/deploy-cloudrun.sh", "/Dockerfile", "/.dockerignore",
    "/server/__pycache__/main.cpython-314.pyc", "/assets/../server/main.py", "/%2e%2e/etc/passwd",
])
def test_sensitive_paths_not_served(client, path):
    r = client.get(path)
    assert r.status_code == 404, path


def test_unknown_api_route_is_json_404(client):
    r = client.get("/api/nope")
    assert r.status_code == 404 and r.json() == {"error": "not-found"}


def test_cors_localhost_allowed_and_foreign_rejected(client):
    ok = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in bad.headers


def test_is_blocked_path_unit():
    assert main.is_blocked_path("server/main.py")
    assert main.is_blocked_path("assets/x/.hidden")
    assert not main.is_blocked_path("assets/data/telemetry-snapshot.json")
    assert not main.is_blocked_path("index.html")
