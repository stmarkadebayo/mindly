"""Speech to text with Whisper, either hosted (fast) or on this machine.

Hosted: an OpenAI-compatible /audio/transcriptions endpoint (Groq serves open Whisper models there).
Local:  faster-whisper on the CPU; the model loads once, on first use.
"""

import time
from functools import lru_cache
from pathlib import Path

import httpx

from . import config

MIME = {"webm": "audio/webm", "ogg": "audio/ogg", "mp4": "audio/mp4", "m4a": "audio/mp4",
        "wav": "audio/wav", "mp3": "audio/mpeg", "aiff": "audio/aiff"}
# Whisper treats this as the text that came just before the audio: it nudges spelling and vocabulary (abeg, not "a beg").
# Keep it short; a longer prompt makes Whisper invent sentences when it hears only noise.
CONTEXT_PROMPT = "Nigerian English and Pidgin: abeg, wahala, dey, wetin, oga."
# Segments Whisper is this unsure of are almost always invented from noise (real speech scores about -0.3).
MIN_CONFIDENCE = -1.3
NO_SPEECH_CUTOFF = 0.6  # hosted Whisper reports how likely each segment is silence; drop the likely ones

# One client for the life of the process, so connections to the speech service are reused (no handshake per note).
_client = httpx.Client(timeout=httpx.Timeout(60, connect=10))


class ASRError(RuntimeError):
    """The speech service failed or was unreachable (as opposed to the audio being unreadable)."""

    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


RETRY_STATUS = {408, 425, 429, 500, 502, 503, 504}
BACKOFF = (0.4, 1.2)  # seconds to wait before the second and third attempt


def transcribe(path: Path, language: str | None = None) -> dict:
    return _remote(path, language) if config.ASR_API_KEY else _local(path, language)


def _remote_once(path: Path, language: str | None, model: str) -> dict:
    data = {"model": model, "response_format": "verbose_json", "temperature": "0", "prompt": CONTEXT_PROMPT}
    if language:
        data["language"] = language
    audio = path.read_bytes()
    err = ASRError("The speech service failed.")
    for attempt in range(len(BACKOFF) + 1):
        try:
            resp = _client.post(
                f"{config.ASR_BASE_URL}/audio/transcriptions",
                headers={"Authorization": f"Bearer {config.ASR_API_KEY}"},
                data=data,
                files={"file": (path.name, audio, MIME.get(path.suffix.lstrip("."), "application/octet-stream"))},
            )
        except httpx.HTTPError as exc:
            err = ASRError("Couldn't reach the speech service.", retryable=True)
        else:
            if resp.status_code == 200:
                body = resp.json()
                segments = body.get("segments")
                if segments:
                    text = " ".join(s["text"].strip() for s in segments
                                    if s.get("no_speech_prob", 0) < NO_SPEECH_CUTOFF and s.get("avg_logprob", 0) > MIN_CONFIDENCE).strip()
                else:
                    text = (body.get("text") or "").strip()
                return {"text": text, "language": body.get("language")}
            err = ASRError(f"The speech service returned an error ({resp.status_code}).", retryable=resp.status_code in RETRY_STATUS)
        if not err.retryable:
            raise err
        if attempt < len(BACKOFF):
            time.sleep(BACKOFF[attempt])
    raise err


def _remote(path: Path, language: str | None) -> dict:
    """Hosted Whisper. Transient failures are retried; if the main model keeps failing, the fallback model is tried."""
    models = [config.ASR_MODEL] + ([config.ASR_FALLBACK_MODEL] if config.ASR_FALLBACK_MODEL and config.ASR_FALLBACK_MODEL != config.ASR_MODEL else [])
    err = ASRError("The speech service failed.")
    for model in models:
        try:
            return _remote_once(path, language, model)
        except ASRError as exc:
            err = exc
    raise err


@lru_cache(maxsize=1)
def _model():
    from faster_whisper import WhisperModel

    return WhisperModel(config.WHISPER_MODEL, device="cpu", compute_type="int8")


def _local(path: Path, language: str | None) -> dict:
    # vad_filter drops silence, so an empty or silent recording yields no text instead of hallucinations.
    segments, info = _model().transcribe(str(path), language=language, vad_filter=True, beam_size=5,
                                       initial_prompt=CONTEXT_PROMPT, condition_on_previous_text=False)
    text = " ".join(s.text.strip() for s in segments).strip()
    return {"text": text, "language": info.language}
