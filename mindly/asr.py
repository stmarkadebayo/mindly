"""Speech to text with Whisper, either hosted (fast) or on this machine.

Hosted: an OpenAI-compatible /audio/transcriptions endpoint (Groq serves open Whisper models there).
Local:  faster-whisper on the CPU; the model loads once, on first use.
"""

from functools import lru_cache
from pathlib import Path

import httpx

from . import config

MIME = {"webm": "audio/webm", "ogg": "audio/ogg", "mp4": "audio/mp4", "m4a": "audio/mp4",
        "wav": "audio/wav", "mp3": "audio/mpeg", "aiff": "audio/aiff"}
NO_SPEECH_CUTOFF = 0.6  # hosted Whisper reports how likely each segment is silence; drop the likely ones

# One client for the life of the process, so connections to the speech service are reused (no handshake per note).
_client = httpx.Client(timeout=httpx.Timeout(60, connect=10))


class ASRError(RuntimeError):
    """The speech service failed or was unreachable (as opposed to the audio being unreadable)."""


def transcribe(path: Path, language: str | None = None) -> dict:
    return _remote(path, language) if config.ASR_API_KEY else _local(path, language)


def _remote(path: Path, language: str | None) -> dict:
    data = {"model": config.ASR_MODEL, "response_format": "verbose_json", "temperature": "0"}
    if language:
        data["language"] = language
    try:
        resp = _client.post(
            f"{config.ASR_BASE_URL}/audio/transcriptions",
            headers={"Authorization": f"Bearer {config.ASR_API_KEY}"},
            data=data,
            files={"file": (path.name, path.read_bytes(), MIME.get(path.suffix.lstrip("."), "application/octet-stream"))},
        )
    except httpx.HTTPError as exc:
        raise ASRError("Couldn't reach the speech service.") from exc
    if resp.status_code != 200:
        raise ASRError(f"The speech service returned an error ({resp.status_code}).")
    body = resp.json()
    segments = body.get("segments")
    if segments:
        text = " ".join(s["text"].strip() for s in segments if s.get("no_speech_prob", 0) < NO_SPEECH_CUTOFF).strip()
    else:
        text = (body.get("text") or "").strip()
    return {"text": text, "language": body.get("language")}


@lru_cache(maxsize=1)
def _model():
    from faster_whisper import WhisperModel

    return WhisperModel(config.WHISPER_MODEL, device="cpu", compute_type="int8")


def _local(path: Path, language: str | None) -> dict:
    # vad_filter drops silence, so an empty or silent recording yields no text instead of hallucinations.
    segments, info = _model().transcribe(str(path), language=language, vad_filter=True, beam_size=5)
    text = " ".join(s.text.strip() for s in segments).strip()
    return {"text": text, "language": info.language}
