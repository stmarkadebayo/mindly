"""Serve NaijaVox (or any Hugging Face Whisper model) behind an OpenAI-style /audio/transcriptions route.

Mindly's second speech engine talks to this. Run it on a laptop to try the model, or on a GPU machine for real use:

    pip install -r requirements-naijavox.txt        # also needs ffmpeg on the machine
    python scripts/naijavox_server.py               # first run downloads the model (about 4 GB)

Then in .env:  ASR_ALT_BASE_URL=http://127.0.0.1:9000/v1

Environment: NAIJAVOX_MODEL (default Axiveri/NaijaVox-2.0), PORT (9000), ALT_API_KEY (optional bearer key).
"""

import os
import tempfile
from functools import lru_cache
from pathlib import Path

import uvicorn
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

MODEL = os.getenv("NAIJAVOX_MODEL", "Axiveri/NaijaVox-2.0")
KEY = os.getenv("ALT_API_KEY", "")
LANGS = {"en", "yo", "ha", "ig", "pcm"}

app = FastAPI()


@lru_cache(maxsize=1)
def pipe():
    import torch
    from transformers import pipeline

    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float16 if device != "cpu" else torch.float32
    return pipeline("automatic-speech-recognition", model=MODEL, device=device, torch_dtype=dtype, chunk_length_s=30)


def auth(authorization: str = Header("")):
    if KEY and authorization != f"Bearer {KEY}":
        raise HTTPException(401, "Bad key.")


@app.post("/v1/audio/transcriptions", dependencies=[Depends(auth)])
async def transcribe(file: UploadFile = File(...), language: str = Form("")):
    suffix = Path(file.filename or "a.webm").suffix or ".webm"
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"audio{suffix}"
        path.write_bytes(await file.read())
        asr = pipe()
        if language in LANGS:
            try:
                return {"text": asr(str(path), generate_kwargs={"language": language})["text"].strip(), "language": language}
            except Exception:
                pass  # a language token this tokenizer can't map: fall back to letting the model decide
        return {"text": asr(str(path))["text"].strip(), "language": None}


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "9000")))
