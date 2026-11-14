"""Copiloto «Flight Director» (contrato §3, POST /api/copilot).

Proveedor: Gemini si GEMINI_API_KEY; si no, Anthropic si ANTHROPIC_API_KEY;
si no hay ninguno, el endpoint responde 503 {"error":"no-ai-provider"} y el
frontend usa copilot-rules.mjs.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import httpx

from .telemetry import iso, utc_now

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "flight_director.md"
DEFAULT_GEMINI_MODEL = "gemini-flash-latest"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
AI_TIMEOUT = httpx.Timeout(30.0, connect=5.0)
MAX_OUTPUT_TOKENS = 1024
MAX_LEAVES = 400
MAX_LIST_ITEMS = 24

DISCLAIMER = (
    "Simulación educativa A.R.E.S. Twin. Respuesta generada por IA usando solo los datos del "
    "contexto enviado; la telemetría «live» es de modelo meteorológico y los valores de literatura "
    "o modelo están marcados como tales. No es telemetría de misión ni un «% de similitud planetaria»."
)


class AIProviderError(Exception):
    pass


def ai_provider_name() -> str:
    if os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    return "none"


def system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


# ------------------------------------------------------------ contexto plano

def _alias(path: str) -> str:
    """earth.telemetry.values.temperatureC -> earth.telemetry.temperatureC (forma del contrato)."""
    return path.replace(".telemetry.values.", ".telemetry.")


def flatten_context(context: Any) -> dict[str, Any]:
    """Aplana el contexto en {ruta: valor hoja}. Recorta listas largas (p. ej. curvas)."""
    out: dict[str, Any] = {}

    def walk(node: Any, path: str) -> None:
        if len(out) >= MAX_LEAVES:
            return
        if isinstance(node, dict):
            for key, value in node.items():
                walk(value, f"{path}.{key}" if path else str(key))
        elif isinstance(node, list):
            if node and all(not isinstance(v, (dict, list)) for v in node) and len(node) <= MAX_LIST_ITEMS:
                out[_alias(path)] = node
                return
            for i, value in enumerate(node[:MAX_LIST_ITEMS]):
                walk(value, f"{path}[{i}]")
            if len(node) > MAX_LIST_ITEMS:
                out[_alias(path) + ".length"] = len(node)
        else:
            out[_alias(path)] = node

    walk(context, "")
    return out


def build_user_message(question: str, flat: dict[str, Any]) -> str:
    lines = [f"{path} = {json.dumps(value, ensure_ascii=False)}" for path, value in flat.items()]
    return (
        "CONTEXTO (ruta = valor; solo puedes usar estos datos):\n"
        + "\n".join(lines)
        + "\n\nPREGUNTA DEL OPERADOR:\n"
        + question.strip()
    )


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


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
    return answer.strip(), valid


# ---------------------------------------------------------------- proveedores

async def _call_gemini(client: httpx.AsyncClient, system: str, user: str) -> tuple[str, str]:
    model = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "responseMimeType": "application/json",
        },
    }
    resp = await client.post(GEMINI_URL.format(model=model), json=body,
                             headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    resp.raise_for_status()
    data = resp.json()
    parts = data["candidates"][0]["content"]["parts"]
    text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    return text, data.get("modelVersion", model)


async def _call_anthropic(client: httpx.AsyncClient, system: str, user: str) -> tuple[str, str]:
    model = os.environ.get("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)
    body = {
        "model": model,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    resp = await client.post(ANTHROPIC_URL, json=body, headers={
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": "2023-06-01",
    })
    resp.raise_for_status()
    data = resp.json()
    text = "".join(block.get("text", "") for block in data["content"] if block.get("type") == "text")
    return text, data.get("model", model)


async def ask(question: str, context: dict[str, Any]) -> dict[str, Any]:
    provider = ai_provider_name()
    if provider == "none":
        raise AIProviderError("no-ai-provider")
    flat = flatten_context(context)
    system, user = system_prompt(), build_user_message(question, flat)
    call = _call_gemini if provider == "gemini" else _call_anthropic
    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            text, model = await call(client, system, user)
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
        raise AIProviderError(f"{provider}: {type(exc).__name__}") from exc
    answer, grounded = parse_model_output(text, flat)
    if not answer:
        raise AIProviderError(f"{provider}: respuesta vacía")
    return {
        "answer": answer,
        "provider": provider,
        "model": model,
        "grounded": grounded,
        "generatedAt": iso(utc_now()),
        "disclaimer": DISCLAIMER,
    }
