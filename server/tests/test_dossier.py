import json

import httpx
import respx

from server import dossier


def test_dossier_requires_ai_provider(client):
    response = client.post("/api/dossier", json={"context": {}})
    assert response.status_code == 503
    assert response.json() == {"error": "no-ai-provider"}


def test_dossier_requires_all_expected_sections():
    complete = "\n".join(f"## {heading}\nText" for heading in dossier.REQUIRED_HEADINGS)
    assert dossier.has_required_sections(complete)
    complete_h1 = "\n".join(f"# {heading}\nText" for heading in dossier.REQUIRED_HEADINGS)
    assert dossier.has_required_sections(complete_h1)
    assert not dossier.has_required_sections("## Mission objective\nOnly a partial response")


def test_dossier_fallback_is_complete_and_labelled():
    result = dossier.create_fallback({"scenario": {"focus": "testing"}}, "incomplete-dossier", "Check the north ridge.")
    assert result["provider"] == "local-template"
    assert result["model"] is None
    assert dossier.has_required_sections(result["markdown"])
    assert "fallback" in result["disclaimer"].lower()
    assert "> Check the north ridge." in result["markdown"]


@respx.mock
def test_dossier_uses_openai_compatible_provider(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://ai.edream.dev/v1")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "test-model")
    route = respx.post("https://ai.edream.dev/v1/chat/completions").mock(return_value=httpx.Response(200, json={
        "choices": [{"message": {"content": "\n".join(f"## {heading}\nUse supplied evidence only." for heading in dossier.REQUIRED_HEADINGS)}}], "model": "test-model",
    }))
    response = client.post("/api/dossier", json={"context": {"scenario": {"id": "demo", "title": "Demo"}}})
    assert response.status_code == 200
    body = response.json()
    assert body["markdown"].startswith("## Mission objective")
    assert body["provider"] == "openai" and body["model"] == "test-model"
    sent = json.loads(route.calls.last.request.content)
    assert sent["messages"][0]["role"] == "system"
    assert "S.E.L.E.N.E. Ops" in sent["messages"][0]["content"]
    assert sent["messages"][1]["role"] == "user"


@respx.mock
def test_dossier_uses_fallback_once_after_incomplete_primary_response(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://ai.edream.dev/v1")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "fallback-model")
    complete = "\n".join(f"## {heading}\nComplete." for heading in dossier.REQUIRED_HEADINGS)
    route = respx.post("https://ai.edream.dev/v1/chat/completions").mock(side_effect=[
        httpx.Response(200, json={"choices": [{"message": {"content": "## Mission objective\nPartial."}}]}),
        httpx.Response(200, json={"choices": [{"message": {"content": complete}}], "model": "fallback-model"}),
    ])
    response = client.post("/api/dossier", json={"context": {"scenario": {"id": "demo"}}})
    assert response.status_code == 200
    assert len(route.calls) == 2
    assert json.loads(route.calls[0].request.content)["model"] == "test-model"
    assert json.loads(route.calls[1].request.content)["model"] == "fallback-model"


@respx.mock
def test_dossier_passes_optional_user_notes_as_unverified_and_generates_section(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "test-model")
    markdown = "\n".join(f"## {heading}\nUse supplied evidence only." for heading in dossier.REQUIRED_HEADINGS)
    route = respx.post("https://ai.edream.dev/v1/chat/completions").mock(return_value=httpx.Response(200, json={
        "choices": [{"message": {"content": markdown}}], "model": "test-model",
    }))

    response = client.post("/api/dossier", json={
        "context": {"scenario": {"id": "demo"}},
        "userNotes": "Prioritize the northern ridge during field planning.",
    })

    assert response.status_code == 200
    sent = json.loads(route.calls.last.request.content)
    user_message = sent["messages"][-1]["content"]
    assert "USER-PROVIDED COMMENTS (unverified" in user_message
    assert "Prioritize the northern ridge during field planning." in user_message
    assert "## User-provided context" in response.json()["markdown"]


def test_dossier_rejects_excessive_user_notes(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    response = client.post("/api/dossier", json={"userNotes": "x" * 4001})
    assert response.status_code == 422
