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


def test_room_mode_keeps_shaky_segments_and_flags_them(monkeypatch, audio):
    segs = [{"text": " God is faithful.", "no_speech_prob": 0.7, "avg_logprob": -1.6}]
    fake_endpoint(monkeypatch, lambda r: httpx.Response(200, json={"language": "english", "segments": segs}))
    assert asr.transcribe(audio)["text"] == ""  # normal mode treats it as noise
    out = asr.transcribe(audio, room=True)
    assert out["text"] == "God is faithful." and out["uncertain"] is True


def test_a_hint_echoed_back_is_not_speech(monkeypatch, audio):
    fake_endpoint(monkeypatch, lambda r: httpx.Response(200, json={"text": "Nigerian English and Pidgin.", "language": "en"}))
    assert asr.transcribe(audio)["text"] == ""


def test_hard_to_hear_passages_are_marked_in_normal_mode_too(monkeypatch, audio):
    segs = [{"text": " I met Tunde today.", "no_speech_prob": 0.01, "avg_logprob": -0.3},
            {"text": " His cousin is called Ayodele.", "no_speech_prob": 0.05, "avg_logprob": -1.15}]
    fake_endpoint(monkeypatch, lambda r: httpx.Response(200, json={"language": "english", "segments": segs}))
    out = asr.transcribe(audio)
    assert out["text"] == "I met Tunde today. His cousin is called Ayodele."   # the plain text is untouched
    assert out["uncertain"] is True
    assert out["marked"] == "I met Tunde today. ⟦His cousin is called Ayodele.⟧"


def test_clear_speech_has_no_marks(monkeypatch, audio):
    segs = [{"text": " All good here.", "no_speech_prob": 0.01, "avg_logprob": -0.2}]
    fake_endpoint(monkeypatch, lambda r: httpx.Response(200, json={"language": "english", "segments": segs}))
    out = asr.transcribe(audio)
    assert "marked" not in out and "uncertain" not in out
