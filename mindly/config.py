"""Runtime settings from environment variables (or a local .env file)."""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# --- Language model: any OpenAI-compatible endpoint serving an open-weight model (OpenRouter, Groq, Ollama, vLLM...) ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
WRITER_MODEL = os.getenv("WRITER_MODEL", "google/gemma-4-26b-a4b-it")
REFLECT_MODEL = os.getenv("REFLECT_MODEL", WRITER_MODEL)
# If the main model keeps failing, try this one (same family is best, so the prompts behave the same). Empty means none.
LLM_FALLBACK_MODEL = os.getenv("LLM_FALLBACK_MODEL", "")
# OpenRouter only: route requests solely to providers that don't collect or train on prompts. A journal should
# never be fair game, so this is on unless you turn it off.
LLM_DENY_DATA_COLLECTION = os.getenv("LLM_DENY_DATA_COLLECTION", "1").lower() not in ("0", "false", "no")

# --- Speech to text ---
# With ASR_API_KEY set, audio goes to a hosted Whisper endpoint (an OpenAI-compatible /audio/transcriptions route).
# That is the fast path: a minute of speech comes back in about a second. Without a key, Whisper runs on this
# machine through faster-whisper (install requirements-local-asr.txt), which is slower on a CPU.
ASR_API_KEY = os.getenv("ASR_API_KEY", "")
ASR_BASE_URL = os.getenv("ASR_BASE_URL", "https://api.groq.com/openai/v1")
ASR_MODEL = os.getenv("ASR_MODEL", "whisper-large-v3-turbo")
# If the hosted speech model keeps failing, try this one (for Groq, the non-turbo large-v3). Empty means none.
ASR_FALLBACK_MODEL = os.getenv("ASR_FALLBACK_MODEL", "")
# Optional second speech engine for side-by-side testing (the toggle in the app header), e.g. NaijaVox served by
# scripts/naijavox_server.py. Empty means the toggle shows it as not connected.
ASR_ALT_BASE_URL = os.getenv("ASR_ALT_BASE_URL", "")
ASR_ALT_MODEL = os.getenv("ASR_ALT_MODEL", "NaijaVox-2.0")
ASR_ALT_API_KEY = os.getenv("ASR_ALT_API_KEY", "")
ASR_ALT_LABEL = os.getenv("ASR_ALT_LABEL", "NaijaVox")
# "openai": an OpenAI-style /audio/transcriptions route (scripts/naijavox_server.py). "storm": STORM-OS ASR, which takes
# POST /transcribe with an x-api-key header and needs the language named (it does not detect it).
ASR_ALT_STYLE = os.getenv("ASR_ALT_STYLE", "openai")
ASR_ALT_LANGUAGE = os.getenv("ASR_ALT_LANGUAGE", "en")  # used by "storm" when the person hasn't chosen a speech language
# STORM-OS ASR (Nigerian languages). If set, and no other second engine is configured, it becomes the second engine.
STORM_ASR_BASE_URL = os.getenv("STORM_ASR_BASE_URL", "")
STORM_ASR_API_KEY = os.getenv("STORM_ASR_API_KEY", "")
if STORM_ASR_BASE_URL and not ASR_ALT_BASE_URL:
    ASR_ALT_BASE_URL, ASR_ALT_API_KEY, ASR_ALT_STYLE, ASR_ALT_LABEL = STORM_ASR_BASE_URL.rstrip("/"), STORM_ASR_API_KEY, "storm", "STORM"
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")  # used only for on-machine speech recognition

# --- Accounts ---
# Google Identity Services client ID (type "Web application"). Leave empty to offer email sign-in only.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# AI requests (transcribe, write, talk) allowed per account per day, to protect the API budget.
DAILY_AI_LIMIT = int(os.getenv("DAILY_AI_LIMIT", "300"))

DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "data"))

# --- Daily reminder (web push). Generate keys with scripts/vapid_keys.py. Without them the reminder is switched off. ---
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:hello@mindly.app")

# --- Plans. Everyone starts with a free Pro trial (accounts.TRIAL_DAYS); after it, free accounts get a daily speech allowance. ---
FREE_DAILY_SECONDS = int(os.getenv("FREE_DAILY_SECONDS", "600"))
PRO_PRICE_LABEL = os.getenv("PRO_PRICE_LABEL", "$7/month")
# Paystack subscriptions. Without the secret key the upgrade button is hidden. The plan is made in the Paystack dashboard;
# PAYSTACK_AMOUNT is its price in the smallest unit (kobo or cents), which Paystack requires even though the plan decides.
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PLAN_CODE = os.getenv("PAYSTACK_PLAN_CODE", "")
PAYSTACK_AMOUNT = int(os.getenv("PAYSTACK_AMOUNT", "700000"))
