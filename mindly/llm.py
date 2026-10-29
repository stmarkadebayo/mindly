"""Minimal client for an OpenAI-compatible chat API serving open-weight models."""

import json
from collections.abc import Iterator

import httpx

from . import config


class LLMError(RuntimeError):
    pass


# One client for the life of the process, so connections are reused (no handshake per message).
_client = httpx.Client(timeout=httpx.Timeout(90, connect=10))


def _request(model: str, messages: list[dict], tools: list[dict] | None, temperature: float, max_tokens: int | None, stream: bool):
    if not config.LLM_API_KEY and "localhost" not in config.LLM_BASE_URL:
        raise LLMError("LLM_API_KEY is not set. Copy .env.example to .env and add your key.")
    payload: dict = {"model": model, "messages": messages, "temperature": temperature}
    if tools:
        payload["tools"] = tools
    if max_tokens:
        payload["max_tokens"] = max_tokens
    if config.LLM_DENY_DATA_COLLECTION and "openrouter.ai" in config.LLM_BASE_URL:
        payload["provider"] = {"data_collection": "deny"}
    if stream:
        payload["stream"] = True
    # Local servers like Ollama need no key; an empty Bearer header is invalid, so omit it.
    headers = {"Authorization": f"Bearer {config.LLM_API_KEY}"} if config.LLM_API_KEY else {}
    return f"{config.LLM_BASE_URL}/chat/completions", headers, payload


def chat(model: str, messages: list[dict], tools: list[dict] | None = None, temperature: float = 0.3,
         client: httpx.Client | None = None, max_tokens: int | None = None) -> dict:
    """Send one chat request and return the assistant message."""
    url, headers, payload = _request(model, messages, tools, temperature, max_tokens, stream=False)
    try:
        resp = (client or _client).post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach the model service: {exc}") from exc
    if resp.status_code != 200:
        raise LLMError(f"Model request failed ({resp.status_code}): {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]


def chat_stream(model: str, messages: list[dict], tools: list[dict] | None = None, temperature: float = 0.3,
                client: httpx.Client | None = None, max_tokens: int | None = None) -> Iterator[tuple[str, object]]:
    """Stream one chat request.

    Yields ("delta", text) as words arrive, then a final ("done", {"content": str, "tool_calls": [...]}).
    """
    url, headers, payload = _request(model, messages, tools, temperature, max_tokens, stream=True)
    content: list[str] = []
    calls: dict[int, dict] = {}
    try:
        with (client or _client).stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                resp.read()
                raise LLMError(f"Model request failed ({resp.status_code}): {resp.text[:200]}")
            for line in resp.iter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    delta = (json.loads(data).get("choices") or [{}])[0].get("delta") or {}
                except json.JSONDecodeError:
                    continue
                if delta.get("content"):
                    content.append(delta["content"])
                    yield "delta", delta["content"]
                for part in delta.get("tool_calls") or []:
                    slot = calls.setdefault(part.get("index", 0), {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                    slot["id"] = part.get("id") or slot["id"]
                    fn = part.get("function") or {}
                    slot["function"]["name"] += fn.get("name") or ""
                    slot["function"]["arguments"] += fn.get("arguments") or ""
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach the model service: {exc}") from exc
    tool_calls = [{**calls[i], "id": calls[i]["id"] or f"call_{i}"} for i in sorted(calls)]
    yield "done", {"content": "".join(content), "tool_calls": tool_calls}
