"""Minimal client for an OpenAI-compatible chat API serving open-weight models."""

import json
import time
from collections.abc import Iterator

import httpx

from . import config


class LLMError(RuntimeError):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable  # a timeout, a dropped connection, a rate limit or a server error: worth another go


# Statuses that usually clear up on their own.
RETRY_STATUS = {408, 425, 429, 500, 502, 503, 504}
BACKOFF = (0.4, 1.2)  # seconds to wait before the second and third attempt

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


def _models(model: str) -> list[str]:
    fallback = config.LLM_FALLBACK_MODEL
    return [model] + ([fallback] if fallback and fallback != model else [])


def _chat_once(model: str, messages, tools, temperature, client, max_tokens) -> dict:
    url, headers, payload = _request(model, messages, tools, temperature, max_tokens, stream=False)
    err = LLMError("Model request failed.")
    for attempt in range(len(BACKOFF) + 1):
        try:
            resp = (client or _client).post(url, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            err = LLMError(f"Could not reach the model service: {exc}", retryable=True)
        else:
            if resp.status_code == 200:
                try:
                    return resp.json()["choices"][0]["message"]
                except (ValueError, KeyError, IndexError, TypeError):
                    err = LLMError("The model service returned an unreadable reply.", retryable=True)
            else:
                err = LLMError(f"Model request failed ({resp.status_code}): {resp.text[:200]}", retryable=resp.status_code in RETRY_STATUS)
        if not err.retryable:
            raise err
        if attempt < len(BACKOFF):
            time.sleep(BACKOFF[attempt])
    raise err


def chat(model: str, messages: list[dict], tools: list[dict] | None = None, temperature: float = 0.3,
         client: httpx.Client | None = None, max_tokens: int | None = None) -> dict:
    """Send one chat request and return the assistant message. Transient failures are retried, then the fallback model is tried."""
    err = LLMError("Model request failed.")
    for m in _models(model):
        try:
            return _chat_once(m, messages, tools, temperature, client, max_tokens)
        except LLMError as exc:
            err = exc
    raise err


def _stream_once(model: str, messages, tools, temperature, client, max_tokens) -> Iterator[tuple[str, object]]:
    url, headers, payload = _request(model, messages, tools, temperature, max_tokens, stream=True)
    content: list[str] = []
    calls: dict[int, dict] = {}
    try:
        with (client or _client).stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                resp.read()
                raise LLMError(f"Model request failed ({resp.status_code}): {resp.text[:200]}", retryable=resp.status_code in RETRY_STATUS)
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
        raise LLMError(f"Could not reach the model service: {exc}", retryable=True) from exc
    tool_calls = [{**calls[i], "id": calls[i]["id"] or f"call_{i}"} for i in sorted(calls)]
    yield "done", {"content": "".join(content), "tool_calls": tool_calls}


def chat_stream(model: str, messages: list[dict], tools: list[dict] | None = None, temperature: float = 0.3,
                client: httpx.Client | None = None, max_tokens: int | None = None) -> Iterator[tuple[str, object]]:
    """Stream one chat request.

    Yields ("delta", text) as words arrive, then a final ("done", {"content": str, "tool_calls": [...]}).
    A failure before any words have been sent is retried, then the fallback model is tried; once words have
    reached the person it can't be retried without repeating them, so the error is raised.
    """
    err = LLMError("Model request failed.")
    for m in _models(model):
        for attempt in range(len(BACKOFF) + 1):
            started = False
            try:
                for kind, value in _stream_once(m, messages, tools, temperature, client, max_tokens):
                    started = started or kind == "delta"
                    yield kind, value
                return
            except LLMError as exc:
                err = exc
                if started:
                    raise
                if not exc.retryable:
                    break
                if attempt < len(BACKOFF):
                    time.sleep(BACKOFF[attempt])
    raise err
