"""Speech to text with Whisper, either hosted (fast) or on this machine.

Hosted: an OpenAI-compatible /audio/transcriptions endpoint (Groq serves open Whisper models there).
Local:  faster-whisper on the CPU; the model loads once, on first use.
"""

import re
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


def _echoes_prompt(text: str) -> bool:
    """On quiet or near-silent audio Whisper can repeat the hint back as if it were speech; treat that as no speech."""
    words = re.findall(r"[a-z']+", text.lower())
    hint = set(re.findall(r"[a-z']+", CONTEXT_PROMPT.lower()))
    # A real "abeg, oga" must survive, so only the descriptive lead-in ("Nigerian English and Pidgin") counts as an echo.
    return bool({"nigerian", "pidgin"} & set(words)) and all(w in hint for w in words)
NO_SPEECH_CUTOFF = 0.6  # hosted Whisper reports how likely each segment is silence; drop the likely ones
# Room mode (a sermon, a lecture, a speaker across the hall): distant, echoey speech scores worse on both measures
# even when the words are right, so the filters are loosened and shaky segments are kept and flagged, not dropped.
ROOM_MIN_CONFIDENCE = -2.2
ROOM_NO_SPEECH_CUTOFF = 0.9
UNSURE_BELOW = -1.0  # a kept segment scoring under this is reported as uncertain
SHAKY_OPEN, SHAKY_CLOSE = "\u27e6", "\u27e7"  # wrap a passage in these when it was hard to hear; the writer carries them into the page


def _mark(kept: list[dict]) -> tuple[str, bool]:
    """The text of the kept segments, with the shaky ones wrapped in marks, and whether any were shaky."""
    parts, shaky = [], False
    for s in kept:
        text = s["text"].strip()
        if s.get("avg_logprob", 0) < UNSURE_BELOW:
            shaky = True
            text = f"{SHAKY_OPEN}{text}{SHAKY_CLOSE}"
        parts.append(text)
    return " ".join(parts).strip(), shaky

# One client for the life of the process, so connections to the speech service are reused (no handshake per note).
_client = httpx.Client(timeout=httpx.Timeout(60, connect=10))


class ASRError(RuntimeError):
    """The speech service failed or was unreachable (as opposed to the audio being unreadable)."""

    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


RETRY_STATUS = {408, 425, 429, 500, 502, 503, 504}
BACKOFF = (0.4, 1.2)  # seconds to wait before the second and third attempt


def transcribe(path: Path, language: str | None = None, room: bool = False) -> dict:
    return _remote(path, language, room) if config.ASR_API_KEY else _local(path, language)


def _remote_once(path: Path, language: str | None, model: str, room: bool = False) -> dict:
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
                uncertain, marked = False, ""
                if segments:
                    min_conf, cutoff = (ROOM_MIN_CONFIDENCE, ROOM_NO_SPEECH_CUTOFF) if room else (MIN_CONFIDENCE, NO_SPEECH_CUTOFF)
                    kept = [s for s in segments if s.get("no_speech_prob", 0) < cutoff and s.get("avg_logprob", 0) > min_conf]
                    marked, uncertain = _mark(kept)
                    text = " ".join(s["text"].strip() for s in kept).strip()
                else:
                    text = (body.get("text") or "").strip()
                if _echoes_prompt(text):
                    text = ""
                result = {"text": text, "language": body.get("language")}
                if body.get("duration"):
                    result["duration"] = body["duration"]
                if uncertain and text:
                    result["uncertain"] = True
                    result["marked"] = marked
                return result
            err = ASRError(f"The speech service returned an error ({resp.status_code}).", retryable=resp.status_code in RETRY_STATUS)
        if not err.retryable:
            raise err
        if attempt < len(BACKOFF):
            time.sleep(BACKOFF[attempt])
    raise err


def _remote(path: Path, language: str | None, room: bool = False) -> dict:
    """Hosted speech. Transient failures are retried; if the main model keeps failing, the fallback model is tried."""
    models = [config.ASR_MODEL] + ([config.ASR_FALLBACK_MODEL] if config.ASR_FALLBACK_MODEL and config.ASR_FALLBACK_MODEL != config.ASR_MODEL else [])
    err = ASRError("The speech service failed.")
    for model in models:
        try:
            return _remote_once(path, language, model, room)
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
    heard = [{"text": s.text, "avg_logprob": s.avg_logprob} for s in segments]
    text = " ".join(s["text"].strip() for s in heard).strip()
    if _echoes_prompt(text):
        text = ""
    result = {"text": text, "language": info.language, "duration": info.duration}
    marked, shaky = _mark(heard)
    if shaky and text:
        result["uncertain"], result["marked"] = True, marked
    return result
