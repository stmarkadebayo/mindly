# Architecture

Mindly is a small, stateless API in front of two hosted open-weight models, plus a web app that keeps each person's journal on their own device. The design goal is simple to run, safe by default, and able to grow by changing configuration before changing code.

```
Browser (Next.js + TypeScript, installable PWA)                     API (FastAPI, stateless)
───────────────────────────────────────────────                     ─────────────────────────
IndexedDB, one database per account:                                /api/auth/*       sign up / in / out, Google
  entries · recordings · conversations                              /api/transcribe   audio ──▶ hosted Whisper ──▶ text
Orb (Web Audio FFT → canvas)                                        /api/write        text  ──▶ Gemma 4 ──▶ page + title
Recorder (MediaRecorder, 32 kbps, 15 min cap)                       /api/companion    text + a few entries ──▶ Gemma 4
Pipeline: saved → transcribing → writing → done                       /stream         the same, as it is written
  (queued when offline, resumed when back online)                   accounts.db       users + hashed session tokens only
```

## Tenancy: one account, one private journal

- **A tenant is an account.** Everything personal is partitioned by account id.
- **Journals never live on the server.** Entries, audio and conversations are stored in the browser's IndexedDB, in a database named for the account id, so two people sharing a device don't see each other's journal. The server holds only identity: email, name, a scrypt password hash (or a Google subject id), onboarding answers, and hashed session tokens.
- **The AI endpoints are stateless.** A request carries the few entries it needs and the server forgets them when it responds. There is no per-tenant data to migrate, back up, leak or delete on the server (except the account itself, which `DELETE /api/me` removes).
- **Per-tenant limits.** `DAILY_AI_LIMIT` caps AI calls per account per day, so one account can't spend the whole API budget.

## What leaves the device, and when

| Action | Sent | To | Kept |
|---|---|---|---|
| Record | the audio file | this API, then the Whisper host | deleted straight after transcription |
| Write the page | the transcript (and the prompt you answered) | this API, then the language model | no |
| Reflect / Talk | your message, the entry being read, and up to ~30 relevant or recent entries, each trimmed | this API, then the language model | no |

The browser decides which entries a chat request carries (`frontend/lib/context.ts`: the entry being read, the entries most like the conversation, and the latest few, each trimmed to 1,200 characters). That keeps requests small and fast, and sends as little of a journal as a reply needs.

## Security

| Concern | What we do |
|---|---|
| Passwords | scrypt with a per-user salt; minimum length enforced; sign-in throttled per email and per IP |
| Sessions | random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` over HTTPS); only a SHA-256 hash is stored; 30-day expiry; sign-out deletes it |
| Cross-site requests | `SameSite=Lax` plus an `Origin` check that refuses state-changing API calls from another site |
| Google sign-in | the ID token is verified with Google: audience, issuer, expiry and verified email |
| Browser hardening | Content-Security-Policy (no framing, same-origin connections plus Google sign-in), `nosniff`, `Referrer-Policy`, `Permissions-Policy` (microphone for this site only) |
| Caching | API responses are `Cache-Control: no-store`; app pages are revalidated on every load so a new deploy shows up at once; hashed asset files are cached for a year |
| Model providers | On OpenRouter, requests are restricted to providers that don't collect or train on prompts (`LLM_DENY_DATA_COLLECTION`, on by default). Don't enable OpenRouter's "Broadcast" trace export: it would copy prompts, which contain journal text, to a third-party tool |
| Abuse | audio capped at 25 MB; JSON bodies bounded; chat context capped at 400 KB; per-account daily AI quota |
| Prompt injection | transcripts and journal text are passed as delimited data; the model cannot reach anything except two read-only search tools over the entries it was sent; every citation it makes is checked against entries it was actually shown |
| Secrets | environment variables only; `.env` is git-ignored; the API never logs request bodies |
| Safety | crisis language adds a support card with Nigerian helplines; the companion has a written protocol and refuses to act as a general assistant |
| API surface | `/docs` and `/openapi.json` are disabled |

Known gaps (see the README's limitations): the app lock is a screen lock, not encryption at rest; the journal is tied to one browser until encrypted sync exists.

## Latency

The path a note takes is **record → upload → transcribe → write → show**. The hosted figures below were measured on 29 October 2026 with a 44-second note over a home connection, against the real services; the on-server figure is an estimate. Expect more variation on mobile data and at busy times.

| Step | Hosted (default when `ASR_API_KEY` is set) | On the server's CPU |
|---|---|---|
| Upload (32 kbps ≈ 240 KB) | ~0.5–1.5 s on mobile data | same |
| Transcribe | **0.9–1.2 s warm** (Whisper large-v3-turbo on Groq; 3–8 s for the very first request after a restart) | ~15–30 s (estimate; Whisper small, int8) |
| Write the page | **median ~3 s** (Gemma 4 26B-A4B; individual calls ranged 1.5–15 s depending on which provider served them) | same |
| **After you tap Done** | **~4–6 s typically** | **~20–35 s** |

What is already in place: a lower recording bitrate; persistent keep-alive connections to the speech and language services (no TLS handshake per request); transcription starts the moment recording ends; the write step starts the moment the transcript arrives; and all steps are saved on the device first, so a dropped connection resumes instead of restarting.

Next, in order of impact:

1. **Transcribe while the person is still talking.** Cut the recording into self-contained chunks every ~15 s (PCM or Opus, no gaps), upload each as it is finished, and transcribe in parallel. Time after Done then drops to "last chunk + write", roughly 1–2 s.
2. **Show the transcript immediately as a draft** and swap in the written page when it arrives, so words are on screen at the end of the speech step rather than after the language model.
3. **Stream the writing step** like the chat reply already is.
4. **Run the API near the user** (see DEPLOYMENT.md) and keep one machine always warm so there are no cold starts.
5. **A smaller writing model** (8–12B class) as an option, trading some fidelity for speed.

## Chat

The companion's reply is streamed as newline-delimited JSON, so the first words appear in about a second (measured 0.6–1.3 s, with the whole reply done in 1.6–2.2 s) instead of after the full reply. The user's message is saved and shown before the request starts; the reply is capped at 500 tokens; related entries are found with a small in-memory full-text index built per request, so the model usually answers on the first round without using tools; and if it does call a tool, the draft is reset and the final answer replaces it with citations checked.

## Scaling path

Today it runs as one container with SQLite for accounts. Nothing is stateful except that database and the in-memory rate limiter, so:

1. **One machine, vertical.** Enough for thousands of accounts; the AI work happens on hosted services, not the API machine.
2. **More machines.** Move accounts from SQLite to Postgres (the whole surface is `mindly/accounts.py`) and the rate limiter to Redis (`Limiter` in `main.py`); then run any number of identical containers behind a load balancer.
3. **Self-host the models** when volume justifies it: point `LLM_BASE_URL` and `ASR_BASE_URL` at vLLM or any OpenAI-compatible server. No application code changes.
4. **Optional encrypted sync** for the journal (end-to-end, keys derived on the device) to lift the one-browser limit without giving the server readable data.
