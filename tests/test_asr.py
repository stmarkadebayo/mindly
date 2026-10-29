"""Hosted speech recognition, tested against a fake endpoint (no key or network needed)."""

import httpx
import pytest

from mindly import asr, config


@pytest.fixture
def audio(tmp_path):
    p = tmp_path / "note.webm"
    p.write_bytes(b"fake-audio")
    return p


def fake_endpoint(monkeypatch, handler):
    monkeypatch.setattr(config, "ASR_API_KEY", "key")
    monkeypatch.setattr(asr, "_client", httpx.Client(transport=httpx.MockTransport(handler)))


def test_hosted_speech_drops_segments_that_are_probably_silence(monkeypatch, audio):
    seen = {}

    def handler(request):
        seen["auth"] = request.headers["authorization"]
        seen["body"] = request.content
        return httpx.Response(200, json={"language": "english", "segments": [
            {"text": " I finally called my sister.", "no_speech_prob": 0.02},
            {"text": " Thank you.", "no_speech_prob": 0.93},  # the usual hallucination on silence
        ]})

    fake_endpoint(monkeypatch, handler)
    out = asr.transcribe(audio, language="en")
    assert out == {"text": "I finally called my sister.", "language": "english"}
    assert seen["auth"] == "Bearer key"
    assert b'name="language"' in seen["body"] and b"whisper-large-v3-turbo" in seen["body"]


def test_hosted_speech_falls_back_to_plain_text(monkeypatch, audio):
    fake_endpoint(monkeypatch, lambda r: httpx.Response(200, json={"text": " hello there ", "language": "en"}))
    assert asr.transcribe(audio)["text"] == "hello there"


def test_hosted_speech_errors_are_reported_not_raised_as_http_errors(monkeypatch, audio):
    fake_endpoint(monkeypatch, lambda r: httpx.Response(503, text="busy"))
    with pytest.raises(asr.ASRError):
        asr.transcribe(audio)

    def down(request):
        raise httpx.ConnectError("no route")

    fake_endpoint(monkeypatch, down)
    with pytest.raises(asr.ASRError):
        asr.transcribe(audio)


def test_hosted_speech_retries_a_busy_service(monkeypatch, audio):
    calls = []

    def handler(request):
        calls.append(1)
        if len(calls) < 3:
            return httpx.Response(503)
        return httpx.Response(200, json={"text": "hello there", "language": "en"})

    fake_endpoint(monkeypatch, handler)
    assert asr.transcribe(audio)["text"] == "hello there" and len(calls) == 3


def test_hosted_speech_uses_the_fallback_model(monkeypatch, audio):
    monkeypatch.setattr(config, "ASR_FALLBACK_MODEL", "whisper-large-v3")
    models = []

    def handler(request):
        models.append(b"whisper-large-v3-turbo" in request.content)
        if b"whisper-large-v3-turbo" in request.content:
            return httpx.Response(500)
        return httpx.Response(200, json={"text": "hello there", "language": "en"})

    fake_endpoint(monkeypatch, handler)
    assert asr.transcribe(audio)["text"] == "hello there"
    assert models == [True, True, True, False]   # three tries on the main model, then the fallback


def test_hosted_speech_does_not_retry_a_bad_key(monkeypatch, audio):
    calls = []
    fake_endpoint(monkeypatch, lambda r: calls.append(1) or httpx.Response(401))
    with pytest.raises(asr.ASRError):
        asr.transcribe(audio)
    assert len(calls) == 1
