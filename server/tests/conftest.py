import json
import sys
from pathlib import Path

import socket
import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from server import main  # noqa: E402

ENV_KEYS = ("METEOMATICS_USERNAME", "METEOMATICS_PASSWORD", "GEMINI_API_KEY", "ANTHROPIC_API_KEY",
            "GEMINI_MODEL", "ANTHROPIC_MODEL")

SNAPSHOT = {
    "atacama": {
        "site": "atacama", "lat": -24.102, "lon": -70.138, "observedAt": "2026-11-14T17:00:00Z",
        "provider": "snapshot", "live": False, "cached": False, "ageSeconds": 0,
        "values": {"solarRadiationWm2": 1148.0, "temperatureC": 29.4, "windSpeedMs": 6.2, "windGustMs": 12.4,
                   "relativeHumidityPct": 25.0, "cloudCoverPct": 16.0},
        "source": {"label": "snapshot de prueba", "url": "https://open-meteo.com/en/docs"},
    }
}


@pytest.fixture(autouse=True)
def isolated(monkeypatch, tmp_path):
    for key in ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    snap = tmp_path / "telemetry-snapshot.json"
    snap.write_text(json.dumps(SNAPSHOT), encoding="utf-8")
    monkeypatch.setattr(main.telemetry_service, "snapshot_path", snap)
    monkeypatch.setattr(main.telemetry_service, "_snapshot", None)
    main.telemetry_service.clear()
    main.copilot_limiter.reset()

    # Red bloqueada: cualquier conexión real (no simulada con respx) falla en el test.
    def _no_network(*args, **kwargs):
        raise RuntimeError("Acceso a red no permitido en tests")

    monkeypatch.setattr(socket.socket, "connect", _no_network)
    monkeypatch.setattr(socket, "getaddrinfo", _no_network)
    yield


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c
