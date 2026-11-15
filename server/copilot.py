"""Copiloto «Flight Director» (contrato §3, POST /api/copilot).

Proveedor: API compatible con OpenAI si OPENAI_API_KEY;
si no hay clave, el endpoint responde 503 {"error":"no-ai-provider"} y el
frontend usa copilot-rules.mjs.
"""

from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path
from typing import Any

import httpx

from .telemetry import iso, utc_now
from .context_projection import MAX_LEAVES, MAX_LIST_ITEMS, project_context

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "flight_director.md"
DEFAULT_OPENAI_BASE_URL = "https://ai.edream.dev/v1"
DEFAULT_OPENAI_MODEL = "gpt-6.1-sol"
DEFAULT_OPENAI_FALLBACK_MODEL = "gemini-3.8-flash"
AI_TIMEOUT = httpx.Timeout(30.0, connect=5.0)
MAX_OUTPUT_TOKENS = 1024
MAX_INPUT_TOKENS = 272_000

DISCLAIMER = (
    "Simulación educativa A.R.E.S. Twin. Respuesta generada por IA usando solo los datos del "
    "contexto enviado; la telemetría «live» es de modelo meteorológico y los valores de literatura "
    "o modelo están marcados como tales. No es telemetría de misión ni un «% de similitud planetaria»."
)


class AIProviderError(Exception):
    pass


def ai_provider_name() -> str:
    return "openai" if os.environ.get("OPENAI_API_KEY") else "none"


def system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def input_token_count(system: str, user: str, history: list[dict[str, str]] | None = None) -> int:
    """Estima tokens con una aproximación conservadora de cuatro bytes UTF-8 por token."""
    total_bytes = len(system.encode("utf-8")) + len(user.encode("utf-8"))
    total_bytes += sum(len(message["content"].encode("utf-8")) for message in history or [])
    return math.ceil(total_bytes / 4)


# ------------------------------------------------------------ contexto plano

def _alias(path: str) -> str:
    """earth.telemetry.values.temperatureC -> earth.telemetry.temperatureC (forma del contrato)."""
    return path.replace(".telemetry.values.", ".telemetry.")


def flatten_context(context: Any) -> dict[str, Any]:
    """Project facts with independent decision budgets and explicit coverage."""
    return project_context(context)


def build_user_message(question: str, flat: dict[str, Any]) -> str:
    lines = [f"{path} = {json.dumps(value, ensure_ascii=False)}" for path, value in flat.items()]
    return (
        "CONTEXTO (ruta = valor; solo puedes usar estos datos):\n"
        + "contextProjection describes transport coverage only, never scientific evidence. Omitted facts remain unavailable; omission does not establish absence of a hazard or a successful result.\n"
        + "\n".join(lines)
        + "\n\nPREGUNTA DEL OPERADOR:\n"
        + question.strip()
    )


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)
_PATH = r"(?:earth|target|rover|similarity|processes|analogyAudit|calibration|earthExpedition|expedition|activeRun|scenario|site|dem|landing|preparation|identity|contextIdentity)(?:\.[A-Za-z_]\w*|\[\d+\])+"
_TECHNICAL_CITATION = re.compile(rf"\s*\[({_PATH})\]")
_FIELD_REFERENCE = re.compile(rf"\b{_PATH}")


def _display_context_value(path: str, flat: dict[str, Any]) -> str:
    value = flat.get(_alias(path))
    if value is None:
        return "sin dato"
    if isinstance(value, bool):
        return "sí" if value else "no"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def clean_answer(text: str, flat: dict[str, Any]) -> str:
    """Replace machine-readable context paths with their actual values in visible prose."""
    def replace_citation(match: re.Match[str]) -> str:
        path = match.group(1)
        return f" ({_display_context_value(path, flat)})"

    cleaned = _TECHNICAL_CITATION.sub(replace_citation, text)

    def replace_field(match: re.Match[str]) -> str:
        path = match.group(0)
        return _display_context_value(path, flat)

    cleaned = _FIELD_REFERENCE.sub(replace_field, cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"([,:;])\s*([,.!?])", r"\2", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def parse_model_output(text: str, flat: dict[str, Any]) -> tuple[str, list[str]]:
    """Extrae {answer, grounded}; filtra rutas que no existen en el contexto."""
    raw = _FENCE.sub("", text.strip())
    answer, grounded = raw, []
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end > start:
        try:
            data = json.loads(raw[start:end + 1])
            if isinstance(data, dict) and isinstance(data.get("answer"), str):
                answer = data["answer"]
                grounded = [g for g in data.get("grounded", []) if isinstance(g, str)]
        except ValueError:
            pass
    valid: list[str] = []
    for path in grounded:
        path = _alias(path.strip())
        if path in flat and path not in valid:
            valid.append(path)
    return clean_answer(answer, flat), valid


# ---------------------------------------------------------------- proveedores

async def _call_openai(client: httpx.AsyncClient, messages: list[dict[str, str]], model: str) -> tuple[str, str]:
    base_url = os.environ.get("OPENAI_BASE_URL", DEFAULT_OPENAI_BASE_URL).rstrip("/")
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": MAX_OUTPUT_TOKENS,
    }
    resp = await client.post(f"{base_url}/chat/completions", json=body,
                             headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"})
    resp.raise_for_status()
    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    if not isinstance(text, str):
        raise TypeError("respuesta content no es texto")
    return text, data.get("model", model)


def _chat_messages(system: str, user: str, history: list[dict[str, str]]) -> list[dict[str, str]]:
    return [{"role": "system", "content": system}, *history, {"role": "user", "content": user}]


async def ask(question: str, context: dict[str, Any], history: list[dict[str, str]] | None = None) -> dict[str, Any]:
    provider = ai_provider_name()
    if provider == "none":
        raise AIProviderError("no-ai-provider")
    flat = flatten_context(context)
    system, user = system_prompt(), build_user_message(question, flat)
    if input_token_count(system, user, history) > MAX_INPUT_TOKENS:
        raise AIProviderError("input-too-large")
    messages = _chat_messages(system, user, history or [])
    primary = os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
    fallback = os.environ.get("OPENAI_FALLBACK_MODEL", DEFAULT_OPENAI_FALLBACK_MODEL)
    last_error: Exception | None = None
    for model_name in dict.fromkeys([primary, fallback]):
        try:
            async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
                text, model = await _call_openai(client, messages, model_name)
            answer, grounded = parse_model_output(text, flat)
            if not answer:
                raise AIProviderError("respuesta vacía")
            break
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, AIProviderError) as exc:
            last_error = exc
    else:
        raise AIProviderError(f"{provider}: modelos agotados ({type(last_error).__name__})") from last_error
    return {"answer": answer, "provider": provider, "model": model, "grounded": grounded,
            "generatedAt": iso(utc_now()), "disclaimer": DISCLAIMER}
