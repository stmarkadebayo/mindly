"""FastAPI server for Mindly.

The server handles accounts and runs the AI steps. It does not store journals: entries, audio and
conversations live on the person's device and are sent here only for the request that needs them.
"""

import json
import tempfile
import time
from urllib.parse import urlparse
from collections import defaultdict
from pathlib import Path
from typing import Literal

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config, llm
from .accounts import Accounts, AuthError
from .asr import ASRError
from .reflect import companion, companion_events
from .insights import insights as insights_for
from .safety import needs_support
from .writer import WritingError, write_entry

COOKIE = "mindly_session"
MAX_AUDIO_BYTES = 25 * 1024 * 1024
AUDIO_TYPES = {"webm", "ogg", "mp4", "m4a", "wav", "mp3", "aiff"}
WHISPER_HINTS = {"en", "yo"}

app = FastAPI(title="Mindly", docs_url=None, redoc_url=None, openapi_url=None)  # no public API docs
accounts = Accounts(config.DATA_DIR / "accounts.db")


# --- security -----------------------------------------------------------------

CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client; "
       "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob:; "
       "media-src 'self' blob:; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; "
       "worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def security(request: Request, call_next):
    # Cookies are SameSite=Lax already; this also refuses state-changing API calls that a browser says came from another site.
    if request.method not in SAFE_METHODS and request.url.path.startswith("/api/"):
        origin = request.headers.get("origin")
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if origin and urlparse(origin).netloc != host:
            return Response(json.dumps({"detail": "Cross-site request refused."}), status_code=403, media_type="application/json")
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "microphone=(self), camera=(), geolocation=(), payment=()"
    path = request.url.path
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"  # nothing personal is ever cached by a browser or proxy
    elif path.startswith("/_next/static/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"  # file names change with every build
    elif response.status_code == 200:
        response.headers["Cache-Control"] = "no-cache"  # pages are revalidated, so a new deploy shows up straight away
    return response


# --- limits -----------------------------------------------------------------

class Limiter:
    """In-memory fixed-window counters. Enough for one server process."""

    def __init__(self):
        self.hits = defaultdict(list)

    def allow(self, key: str, limit: int, window: float) -> bool:
        now = time.time()
        recent = [t for t in self.hits[key] if t > now - window]
        self.hits[key] = recent
        if len(recent) >= limit:
            return False
        recent.append(now)
        return True


limiter = Limiter()


def limit(key: str, n: int, window: float, message: str):
    if not limiter.allow(key, n, window):
        raise HTTPException(429, message)


# --- auth -------------------------------------------------------------------

def current_user(request: Request) -> dict:
    user = accounts.session_user(request.cookies.get(COOKIE))
    if not user:
        raise HTTPException(401, "Please sign in.")
    return user


def start_session(request: Request, response: Response, user: dict) -> dict:
    response.set_cookie(COOKIE, accounts.new_session(user["id"]), max_age=30 * 86400, httponly=True,
                        samesite="lax", secure=request.url.scheme == "https")
    return user


class SignUp(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(max_length=200)
    name: str = Field(default="", max_length=80)


class SignIn(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(max_length=200)


class GoogleCredential(BaseModel):
    credential: str = Field(max_length=5000)


@app.get("/api/config")
def public_config():
    return {"google_client_id": config.GOOGLE_CLIENT_ID or None}


@app.post("/api/auth/signup")
def sign_up(body: SignUp, request: Request, response: Response):
    limit(f"signup:{request.client.host}", 5, 3600, "Too many sign-ups from here. Try again later.")
    try:
        user = accounts.sign_up(body.email, body.password, body.name)
    except AuthError as exc:
        raise HTTPException(400, str(exc))
    return start_session(request, response, user)


@app.post("/api/auth/login")
def sign_in(body: SignIn, request: Request, response: Response):
    limit(f"login:{body.email.lower()}", 8, 600, "Too many attempts. Wait a few minutes and try again.")
    limit(f"login-ip:{request.client.host}", 40, 600, "Too many attempts from here. Wait a few minutes and try again.")
    try:
        user = accounts.sign_in(body.email, body.password)
    except AuthError as exc:
        raise HTTPException(401, str(exc))
    return start_session(request, response, user)


def verify_google(credential: str) -> dict:
    """Check a Google Identity Services ID token with Google and return its claims."""
    resp = httpx.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential}, timeout=10)
    claims = resp.json() if resp.status_code == 200 else {}
    if (claims.get("aud") != config.GOOGLE_CLIENT_ID
            or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com")
            or claims.get("email_verified") not in ("true", True)
            or int(claims.get("exp", 0)) < time.time()):
        raise HTTPException(401, "Google sign-in could not be verified.")
    return claims


@app.post("/api/auth/google")
def google_sign_in(body: GoogleCredential, request: Request, response: Response):
    if not config.GOOGLE_CLIENT_ID:
        raise HTTPException(400, "Google sign-in isn't configured on this server.")
    claims = verify_google(body.credential)
    user = accounts.google(claims["sub"], claims["email"], claims.get("name", ""))
    return start_session(request, response, user)


@app.post("/api/auth/logout")
def sign_out(request: Request, response: Response):
    accounts.end_session(request.cookies.get(COOKIE))
    response.delete_cookie(COOKIE)
    return {"ok": True}


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    profile: dict | None = None


@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    return user


@app.put("/api/me")
def update_me(body: ProfileUpdate, user: dict = Depends(current_user)):
    return accounts.update(user["id"], body.name, body.profile)


@app.delete("/api/me")
def delete_me(request: Request, response: Response, user: dict = Depends(current_user)):
    accounts.delete(user["id"])
    response.delete_cookie(COOKIE)
    return {"ok": True}


# --- AI steps (stateless) ------------------------------------------------------

def ai_quota(user: dict):
    limit(f"ai:{user['id']}", config.DAILY_AI_LIMIT, 86400,
          "You've reached today's AI limit for this prototype. Your journal still works; try again tomorrow.")


@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), language: str = Form(""),
                           user: dict = Depends(current_user)):
    ai_quota(user)
    ext = (audio.filename or "audio.webm").rsplit(".", 1)[-1].lower()
    if ext not in AUDIO_TYPES:
        raise HTTPException(415, "Unsupported audio format.")
    data = await audio.read()
    if not data:
        raise HTTPException(400, "The recording was empty.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "This recording is too large (25 MB maximum).")
    from .asr import transcribe

    # The audio is written to a temporary file only for decoding, then deleted.
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"audio.{ext}"
        path.write_bytes(data)
        try:
            # Whisper has no Pidgin; for anything it doesn't know, let it auto-detect.
            result = transcribe(path, language if language in WHISPER_HINTS else None)
        except ASRError as exc:
            raise HTTPException(502, str(exc))
        except Exception:
            raise HTTPException(400, "This recording couldn't be decoded. Try recording again.")
    words = len(result["text"].split())
    return {**result, "no_speech": words < 2}


class WriteRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=30_000)
    prompt: str | None = Field(default=None, max_length=300)
    continuing: bool = False


@app.post("/api/write")
def write(body: WriteRequest, user: dict = Depends(current_user)):
    ai_quota(user)
    try:
        written = write_entry(body.transcript, body.prompt, body.continuing)
    except (llm.LLMError, WritingError) as exc:
        raise HTTPException(502, str(exc))
    return {**written, "support": needs_support(body.transcript)}


class JournalEntry(BaseModel):
    id: str = Field(max_length=64)
    created: str = Field(max_length=40)
    title: str | None = Field(default=None, max_length=200)
    body: str = Field(default="", max_length=20_000)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class CompanionRequest(BaseModel):
    entries: list[JournalEntry] = Field(default_factory=list, max_length=200)
    messages: list[Message] = Field(default_factory=list, max_length=60)
    anchor_id: str | None = Field(default=None, max_length=64)


MAX_CONTEXT_CHARS = 400_000  # per request; the app sends far less (see frontend/lib/context.ts)


def check_companion(body: "CompanionRequest"):
    if not body.anchor_id and not body.messages:
        raise HTTPException(400, "Say something first.")
    if sum(len(e.body) + len(e.title or "") for e in body.entries) > MAX_CONTEXT_CHARS:
        raise HTTPException(413, "That's more journal text than Mindly can read at once.")


@app.post("/api/companion/stream")
def talk_stream(body: CompanionRequest, user: dict = Depends(current_user)):
    """The reply as newline-delimited JSON events, so words appear while the model is still writing."""
    ai_quota(user)
    check_companion(body)

    def events():
        try:
            for event in companion_events([e.model_dump() for e in body.entries], [m.model_dump() for m in body.messages],
                                          body.anchor_id, user["name"] or None):
                yield json.dumps(event) + "\n"
        except ValueError as exc:
            yield json.dumps({"t": "error", "v": str(exc)}) + "\n"
        except llm.LLMError as exc:
            yield json.dumps({"t": "error", "v": str(exc)}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson", headers={"X-Accel-Buffering": "no"})


@app.post("/api/companion")
def talk(body: CompanionRequest, user: dict = Depends(current_user)):
    ai_quota(user)
    check_companion(body)
    try:
        return companion([e.model_dump() for e in body.entries], [m.model_dump() for m in body.messages],
                         body.anchor_id, user["name"] or None)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except llm.LLMError as exc:
        raise HTTPException(502, str(exc))


class InsightsRequest(BaseModel):
    entries: list[JournalEntry] = Field(max_length=60)


@app.post("/api/insights")
def ai_insights(body: InsightsRequest, user: dict = Depends(current_user)):
    ai_quota(user)
    if sum(len(e.body) for e in body.entries) > MAX_CONTEXT_CHARS:
        raise HTTPException(413, "That's more journal text than Mindly can read at once.")
    try:
        return insights_for([e.model_dump() for e in body.entries], user["name"] or None)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except llm.LLMError as exc:
        raise HTTPException(502, str(exc))


@app.get("/api/health")
def health():
    return {"writer_model": config.WRITER_MODEL, "reflect_model": config.REFLECT_MODEL,
            "speech": f"hosted:{config.ASR_MODEL}" if config.ASR_API_KEY else f"local:{config.WHISPER_MODEL}", "llm_key_set": bool(config.LLM_API_KEY),
            "google_sign_in": bool(config.GOOGLE_CLIENT_ID)}


# --- web app ------------------------------------------------------------------
# The Next.js frontend is built as a static export (frontend/out) and served from here, so the
# whole app is one process. Registered last, so every /api route above takes precedence.

WEB = config.ROOT / "frontend" / "out"
if WEB.exists():
    app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
