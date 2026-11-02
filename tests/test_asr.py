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


def test_alternative_engine_uses_its_own_endpoint_and_sends_no_whisper_hint(monkeypatch, audio):
    seen = {}

    def handler(request):
        seen["url"], seen["auth"], seen["body"] = str(request.url), request.headers["authorization"], request.content
        return httpx.Response(200, json={"text": "How you dey", "language": "pcm"})

    monkeypatch.setattr(config, "ASR_ALT_STYLE", "openai")  # whatever the local .env says
    monkeypatch.setattr(config, "ASR_ALT_BASE_URL", "http://alt.test/v1")
    monkeypatch.setattr(config, "ASR_ALT_API_KEY", "altkey")
    monkeypatch.setattr(asr, "_client", httpx.Client(transport=httpx.MockTransport(handler)))
    assert asr.transcribe(audio, alt=True)["text"] == "How you dey"
    assert seen["url"] == "http://alt.test/v1/audio/transcriptions" and seen["auth"] == "Bearer altkey"
    assert b"NaijaVox-2.0" in seen["body"] and b'name="prompt"' not in seen["body"]


def test_storm_engine_posts_to_transcribe_with_its_key_and_a_language(monkeypatch, audio):
    seen = {}

    def handler(request):
        seen["url"], seen["key"], seen["body"] = str(request.url), request.headers["x-api-key"], request.content
        return httpx.Response(200, json={"text": " you don tok am "})

    monkeypatch.setattr(config, "ASR_ALT_STYLE", "storm")
    monkeypatch.setattr(config, "ASR_ALT_BASE_URL", "http://storm.test")
    monkeypatch.setattr(config, "ASR_ALT_API_KEY", "k")
    monkeypatch.setattr(asr, "_client", httpx.Client(transport=httpx.MockTransport(handler)))
    assert asr.transcribe(audio, language="pcm", alt=True) == {"text": "you don tok am", "language": "pcm"}
    assert seen["url"] == "http://storm.test/transcribe" and seen["key"] == "k"
    assert asr.transcribe(audio, language="fr", alt=True)["language"] == "en"  # unsupported: the configured default
