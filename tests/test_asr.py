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
