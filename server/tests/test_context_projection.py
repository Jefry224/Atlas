"""Provider-wire regression tests: no credentials, services or generated data."""

import json
from copy import deepcopy
import shutil
import subprocess
from pathlib import Path

import httpx
import pytest
import respx

from server import copilot, dossier, main
from server.context_projection import MAX_SERIALIZED_BYTES, MAX_TEXT_CHARS


@pytest.fixture(autouse=True)
def isolated_dossier_rate_limit():
    # The shared fixture resets copilot only. Provider-wire tests must not
    # consume the following module's dossier request allowance.
    main.dossier_limiter.reset()
    yield
    main.dossier_limiter.reset()


@pytest.fixture(scope="module")
def published_contexts():
    node = shutil.which("node") or "/home/jefry/.nvm/versions/node/v22.22.3/bin/node"
    result = subprocess.run(
        [node, str(Path(__file__).with_name("provider_context_fixture.mjs"))],
        check=True, capture_output=True, text=True, timeout=30,
    )
    return json.loads(result.stdout)


def _prompt_fields(message):
    return {path: json.loads(value) for line in message.splitlines()[1:] if " = " in line
            for path, value in [line.split(" = ", 1)]}


@pytest.mark.parametrize("endpoint", ["copilot", "dossier"])
@pytest.mark.parametrize("shape", ["dossier", "destination", "expedition"])
@respx.mock
def test_actual_provider_request_preserves_published_decisions(client, monkeypatch, published_contexts, shape, endpoint):
    context = deepcopy(published_contexts[shape])
    # Defensive provider filtering also applies if a caller accidentally sends
    # a full run/grid instead of the compact browser context.
    context["history"] = ["EXCLUDED_CONTEXT_HISTORY"] * 60
    context["grid"] = {"elevation": ["EXCLUDED_RASTER"] * 5000}
    context["path"] = ["EXCLUDED_PATH"] * 5000
    if shape == "expedition":
        context["earthExpedition"]["events"] = [{"detail": "EXCLUDED_RUN_HISTORY"}] * 60
    monkeypatch.setenv("OPENAI_API_KEY", "mock-key-no-credentials")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://provider.invalid/v1")
    monkeypatch.setenv("OPENAI_MODEL", "mock-context-model")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "mock-context-model")
    cited = "earthExpedition.sessionId" if shape == "expedition" else "scenario.id"
    content = json.dumps({"answer": f"Supplied identity [{cited}]", "grounded": [cited, "missing.invented"]}) if endpoint == "copilot" else "\n".join(f"## {h}\nUse supplied evidence." for h in dossier.REQUIRED_HEADINGS)
    route = respx.post("https://provider.invalid/v1/chat/completions").mock(return_value=httpx.Response(200, json={
        "choices": [{"message": {"content": content}}], "model": "mock-context-model",
    }))
    response = client.post(f"/api/{endpoint}", json={"context": context, **({"question": "What decision is supported?"} if endpoint == "copilot" else {})})
    assert response.status_code == 200, response.text
    assert len(route.calls) == 1
    request = json.loads(route.calls.last.request.content)
    assert "EXCLUDED_" not in request["messages"][-1]["content"]
    fields = _prompt_fields(request["messages"][-1]["content"])
    # The endpoint's size check, the actual request and citation grounding must
    # use exactly the same projection, including real JSON null values.
    assert fields == copilot.flatten_context(context)
    assert len(fields) <= copilot.MAX_LEAVES
    assert fields["hazards"] is None
    assert fields["unavailableModules"]
    assert fields["contextProjection"]["version"] == "provider-context/1"
    if shape == "expedition":
        assert fields["earthExpedition.sessionId"] == "provider-fixture-earth-session"
        assert fields["earthExpedition.site.id"] == "la-corona"
        assert fields["earthExpedition.objective.id"] == "shelter"
        assert fields["earthExpedition.preparation.config.payloadKg"] == 12
        assert fields["earthExpedition.preparation.stops[1].x"] == context["earthExpedition"]["preparation"]["stops"][1]["x"]
        assert fields["earthExpedition.observations.energyUsedPct"] > 0
        assert fields["earthExpedition.inspections[0].materialMeasurement"] is None
        assert fields["earthExpedition.inspections[1].slopeDeg"] == context["earthExpedition"]["inspections"][1]["slopeDeg"]
        assert fields["earthExpedition.inspections[1].sourceDEM"] == context["earthExpedition"]["inspections"][1]["sourceDEM"]
        assert fields["earthExpedition.decision.status"] == "Advance to targeted validation"
        assert fields["earthExpedition.benchmark.reason"]
        assert "topography" in fields["earthExpedition.benchmark.comparison.scope"]
        for key in ("source", "nativeResolutionMeters", "spacingMeters", "fetchedAtUTC"):
            assert fields[f"earthExpedition.dem.{key}"] == context["earthExpedition"]["dem"][key]
        assert fields["earthExpedition.limitations"]
    else:
        assert fields["scenario.id"] == context["scenario"]["id"]
        assert fields["earth.id"] == context["earth"]["id"]
        assert fields["target.id"] == context["target"]["id"]
        assert fields["analogyAudit.matrix[8].status"] == context["analogyAudit"]["matrix"][8]["status"]
        assert fields["analogyAudit.calibration.gravity.offloadForceN"] == context["analogyAudit"]["calibration"]["gravity"]["offloadForceN"]
        assert fields["analogyAudit.calibration.thermal.universalCorrectionFactor"] is None
        assert fields["processes.best.kind"]
        for key in ("start", "end", "hours"):
            assert fields[f"processes.best.{key}"] == context["processes"]["best"][key]
        if shape == "dossier":
            assert len(context["forecast"]["hours"]) == 72
            assert fields["forecast.source.url"] == context["forecast"]["source"]["url"]
            assert fields["forecast.fetchedAt"] == context["forecast"]["fetchedAt"]
            assert fields["earth.nativeResolutionMeters"] == context["earth"]["nativeResolutionMeters"]
            assert fields["target.thermal.source"] == context["target"]["thermal"]["source"]
            assert fields["analogyAudit.calibration.origins.earthPressurePa.kind"] == "unknown"
            assert fields["processes.caveats"]
            coverage = fields["contextProjection.sections.environment"]
            assert any(e["path"] == "forecast.hours" and e["totalItems"] == 72 for e in coverage["examples"])
        else:
            assert fields["preparation.sessionId"] == context["preparation"]["sessionId"]
            assert fields["analogyAudit.landing.missionId"] == context["preparation"]["sessionId"]
            assert fields["analogyAudit.landing.runs.target.outcome.code"] == "within-model-tolerances"
            assert fields["analogyAudit.landing.plans.target.selectedId"]
            assert fields["analogyAudit.limitation"]
            assert fields["earth.telemetry.source.url"] == context["earth"]["telemetry"]["source"]["url"]
            assert fields["analogyAudit.landing.plans.target.selected.nativeResolutionMeters"] == context["analogyAudit"]["landing"]["plans"]["target"]["selected"]["nativeResolutionMeters"]
    factual_paths = [p for p in fields if not p.startswith("contextProjection")]
    assert not any(part in p.split(".") for p in factual_paths for part in ("path", "history", "elevation", "events", "curve"))
    assert not any(p.startswith("forecast.hours[") or p.startswith("processes.hours[") for p in factual_paths)
    if endpoint == "copilot":
        assert response.json()["grounded"] == [cited]
        assert f"[{cited}]" not in response.json()["answer"]


def test_projection_keeps_legacy_aliases_and_nulls():
    context = {"earth": {"telemetry": {"values": {"temperatureC": None, "windSpeedMs": 0}}}, "rover": {"batteryPct": 82}, "notes": ["archive", "model"]}
    flat = copilot.flatten_context(context)
    assert flat["earth.telemetry.temperatureC"] is None
    assert flat["earth.telemetry.windSpeedMs"] == 0
    assert flat["rover.batteryPct"] == 82
    assert flat["notes"] == ["archive", "model"]


def test_list_coverage_does_not_claim_discarded_items_survived():
    flat = copilot.flatten_context({"evidence": [{"id": i, "value": i + .25} for i in range(60)]})
    coverage = flat["contextProjection.sections.other"]
    assert coverage["eligibleFields"] == 48
    assert coverage["retainedFields"] == 48
    assert not coverage["complete"]
    assert coverage["examples"] == [{"path": "evidence", "reason": "list-items", "totalItems": 60, "inspectedItems": 24, "omittedItems": 36, "inspectedStartIndex": 36}]
    assert flat["evidence[59].value"] == 59.25
    assert "evidence[35].id" not in flat


def test_overload_is_deterministic_and_reports_leaf_omissions(published_contexts):
    context = {**published_contexts["dossier"], **published_contexts["destination"], **published_contexts["expedition"]}
    flat = copilot.flatten_context(context)
    reversed_context = {k: context[k] for k in reversed(context)}
    assert flat == copilot.flatten_context(reversed_context)
    assert len(flat) <= copilot.MAX_LEAVES
    for prefix in ("scenario.id", "earthExpedition.sessionId", "earthExpedition.objective.id", "earthExpedition.decision.status", "analogyAudit.matrix[8].status", "analogyAudit.calibration.gravity.offloadForceN", "analogyAudit.landing.runs.target.outcome.code", "processes.best.kind", "unavailableModules"):
        assert prefix in flat
    coverage = [v for k, v in flat.items() if k.startswith("contextProjection.sections.")]
    assert any(v["omittedEligibleFields"] > 0 for v in coverage)
    assert sum(v["retainedFields"] for v in coverage) == len(flat) - len(coverage) - 1
    for v in coverage:
        assert v["retainedFields"] + v["omittedEligibleFields"] == v["eligibleFields"]


def test_malformed_and_raw_data_are_bounded_and_never_disclosed():
    cyclic = {}; cyclic["loop"] = cyclic
    context = {"scenario": {"id": "bounded", "null": None},
               "earthExpedition": {"sessionId": "current", "objective": {"id": "shelter"}, "decision": {"status": "incomplete"},
                                   "path": ["EXCLUDED_RAW_SECRET"] * 10000, "grid": {"elevation": ["EXCLUDED_RASTER_SECRET"] * 10000}},
               "forecast": {"hours": [{"raw": "EXCLUDED_HOURLY_SECRET"}] * 10000},
               "history": ["EXCLUDED_HISTORY_SECRET"], "malformed": cyclic,
               "large": [{f"field{i}": "x" * MAX_TEXT_CHARS for i in range(200)}] * 40,
               "invalid": {"number": float("nan"), "text": "y" * (MAX_TEXT_CHARS + 1), "object": object(), "unicode": "\ud800", "integer": 1 << 20000},
               "a.b": "UNSAFE_KEY_SECRET"}
    flat = copilot.flatten_context(context)
    encoded = json.dumps(flat, ensure_ascii=False, allow_nan=False)
    assert len(encoded.encode()) <= MAX_SERIALIZED_BYTES
    assert len(flat) <= copilot.MAX_LEAVES
    assert flat["scenario.null"] is None
    assert "EXCLUDED_" not in encoded and "UNSAFE_KEY_SECRET" not in encoded
    reasons = {k for p, v in flat.items() if p.startswith("contextProjection.sections.") for k in v["omissionCounts"]}
    assert {"cycle", "non-finite-number", "text-too-long", "non-json-value", "unsafe-or-long-key", "object-fields", "invalid-unicode", "oversized-integer"} <= reasons
    assert all(not v["complete"] for p, v in flat.items() if p in {"contextProjection.sections.expedition", "contextProjection.sections.environment", "contextProjection.sections.other"})


def test_large_identity_branch_cannot_starve_other_roots_or_recurse_unbounded():
    deep = {"null": None}
    for _ in range(40):
        deep = {"child": deep}
    context = {
        "scenario": {"id": "scenario-current"},
        "earth": {"id": "earth-current", "source": "published-earth-source", "metadata": {
            f"row{i}": {f"column{j}": i + j for j in range(128)} for i in range(128)}},
        "target": {"id": "target-current", "source": "published-target-source", "nativeResolutionMeters": None},
        "earthExpedition": {"sessionId": "session-current", "objective": {"id": "shelter"}, "decision": {"status": "incomplete"}},
        "deep": deep,
    }
    flat = copilot.flatten_context(context)
    for path, value in {"scenario.id": "scenario-current", "earth.id": "earth-current", "target.id": "target-current", "target.source": "published-target-source", "target.nativeResolutionMeters": None, "earthExpedition.decision.status": "incomplete"}.items():
        assert path in flat and flat[path] == value
    assert flat["contextProjection.sections.identity"]["omissionCounts"]["node-budget; descendants not inspected"] > 0
    assert flat["contextProjection.sections.other"]["omissionCounts"]["depth; descendants not inspected"] > 0
    assert len(json.dumps(flat, ensure_ascii=False).encode()) <= MAX_SERIALIZED_BYTES
