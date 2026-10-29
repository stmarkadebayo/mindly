# Mindly

**Think out loud, feel lighter, get unstuck.** A private, voice-first journal. Tap the orb, talk the way you think, and get a clear written page in your own words. When you want, a gentle companion helps you reflect, grounded in what you've actually written.**

> Built for OPEN//BUILD 2026 (OSCA Ile-Ife Hacktoberfest) with open-weight models.

## Why

Most people's best thoughts arrive when they can't write them down: on a walk, in a danfo, at 2 a.m., in the shower. Journaling is one of the simplest ways to process feelings and sort out ideas, yet almost nobody keeps it up:

- **A blank page is a wall.** For people who struggle to start (procrastinators, people with ADHD-style attention, anyone overwhelmed), the cost of opening a notes app and organising a thought is enough to skip it. Talking has no such cost.
- **Typing is slower than thinking.** Thoughts fade before a phone keyboard catches them. Creatives lose half-formed ideas this way; students lose the day's worries until they pile up at night.
- **Voice notes are a graveyard.** People already talk to their phones, but a 4-minute rambling recording is never listened to again. Nothing is searchable, titled or connected to anything else.
- **Old entries are never reread,** so patterns in mood, sleep, stress and ideas stay invisible.

Mindly keeps the speed of a voice note and adds what voice notes lack: a clean written page, a title, a mood, and a companion that remembers what you said last month and helps you find the pattern or the next small step. It is for **wellbeing and for thinking**: processing a hard day, capturing an idea, or untangling a task you keep avoiding.

**Intended users:** students and young professionals, starting with university students in Nigeria; plus creatives, people who find starting hard, and anyone who thinks better out loud. They already live in voice notes, often mixing English with Pidgin, want a private place to think, and won't stick with anything that feels like a form. Mindly is a journal, not a therapist or a medical service.

## What it does

| | |
|---|---|
| **Talk, don't type** | The orb lives on Home. Tap it (or a prompt) and it rises and grows while the rest of the screen softens away. There's no blank page in between: the written page opens when you finish. The orb reacts to the frequencies of your voice (lows swell it, mids move its edge, highs shimmer it from lavender toward glacier blue) and swirls on its own while Mindly writes. |
| **A real page, automatically** | Your words are transcribed and rewritten into a clean first-person entry with a title. Fillers go; your facts, feelings and phrasing stay. No summarising, no advice, no translation. |
| **Edit and keep going** | The page is editable and autosaves. Tap the orb again to keep talking, and the new part is added to the end. If you type while Mindly is still writing, your typing wins. |
| **Three prompts when you're stuck** | Chosen from the goals you pick in onboarding. Tap one and start talking. |
| **Mood, minimally** | One tap after recording (Low, Meh, Okay, Good, Great). Insights shows two weeks as a thin line. No streaks, on purpose. |
| **Reflect** | Tap the Reflect button on any entry for a short insight that connects it to related past entries, each linked as a source. |
| **Chat** | A companion (type or speak) that helps you get things out, make sense of them, and pick one small next step. Replies stream in as they're written. It isn't a therapist or a general assistant. |
| **Safety** | If an entry or message suggests someone may be in danger, Mindly shows Nigerian crisis lines (SURPIN, 112). |
| **Private by design** | The journal (text and audio) lives on the device. The server keeps only the account. App lock (PIN), export everything, delete the journal or the whole account. |
| **Works offline** | Recording and reading work offline. Recordings made offline are queued and written up when you're back online. It installs as a PWA. |

**Screens:** Welcome, Sign up and Sign in (email or Google), Onboarding, Home, Entry, Reflect and Chat, Insights, Settings, Privacy, Support, Terms.

## How it uses open-weight models

| Role | Model | Licence | Where it runs |
|---|---|---|---|
| Speech to text | **Whisper large-v3-turbo** (hosted, the fast path) or **Whisper small** via [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (on the server's CPU) | MIT | Hosted: any OpenAI-compatible `/audio/transcriptions` endpoint (Groq by default). Local: the API machine. |
| Writing the page | **Google Gemma 4 26B-A4B-it** | Apache 2.0 | Any OpenAI-compatible endpoint (OpenRouter by default, or local Ollama) |
| Reflect and Chat | **Gemma 4 26B-A4B-it** with tool calling | Apache 2.0 | Same |

**Licences, checked on the model cards on 29 October 2026 (details and the model comparison are in [docs/MODELS.md](docs/MODELS.md)):** Whisper large-v3-turbo is MIT; Gemma 4 26B-A4B-it is Apache 2.0 (its card links Google's Gemma 4 licence page). Neither model is gated.

**Why these:** Whisper is the strongest openly licensed speech model that is also available as a very fast hosted endpoint, and it can run on an ordinary CPU as a fallback. Gemma 4 26B-A4B supports tool calling and activates only about 4B parameters per token, so it is quick and cheap (on the order of a tenth of a cent per entry). Everything can be self-hosted later by changing two URLs.

**The model does real work, under strict limits** ([`mindly/writer.py`](mindly/writer.py), [`mindly/reflect.py`](mindly/reflect.py)):

- **Faithful writing:** the prompt forbids adding, summarising, translating or moralising. The transcript is passed as delimited data, so instructions spoken inside a recording are ignored.
- **An agent over your own journal:** the app sends the entries a request needs, and the server builds a throwaway full-text index (SQLite FTS5, BM25) and gives the model `search_journal` and `read_entry` tools. Nothing is stored afterwards.
- **Grounded citations:** entries are numbered per request. Any citation of an entry the model wasn't actually shown is removed before you see the reply. The UI shows which entries each insight is drawn from.
- **Guardrails:** the companion has a clear role (listen, reflect, at most one gentle question, help pick one small step), doesn't diagnose, and turns down unrelated tasks. A keyword check adds the support card for crisis language; it never blocks anything.

## Architecture

```
Browser (Next.js + TypeScript, PWA)                   API (FastAPI, stateless)
IndexedDB: entries, audio, chats      ──audio──▶     /api/transcribe   hosted Whisper (or local)
Orb · Recorder · offline queue        ◀──text───     /api/write        Gemma 4 → faithful page + title
                                      ──text───▶     /api/companion    Gemma 4 agent, streamed
                                                      accounts.db       users + hashed session tokens only
```

Journals stay on the device; the server is stateless apart from accounts. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for tenancy, security controls, the latency budget and the scaling path, and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for hosting.

## Run it

Requirements: Python 3.10+ and Node 20+.

```bash
git clone <this repo> && cd mindly
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                       # then add LLM_API_KEY (and ASR_API_KEY for fast speech)
(cd frontend && npm ci && npm run build)   # builds the app into frontend/out
uvicorn mindly.main:app --port 8001        # serves the API and the app
```

Open http://localhost:8001 and allow microphone access.

- **Speech:** with `ASR_API_KEY` set, audio goes to a hosted Whisper endpoint and comes back in about a second. Without it, Whisper runs on this machine: `pip install -r requirements-local-asr.txt` (the first recording downloads the model, about 480 MB for `small`).
- **Google sign-in (optional):** create an OAuth client ID of type *Web application* in Google Cloud Console, add your site's origin under Authorized JavaScript origins, and set `GOOGLE_CLIENT_ID`. Email sign-in works without it.
- **Fully local models:** set `LLM_BASE_URL=http://localhost:11434/v1` and `WRITER_MODEL` / `REFLECT_MODEL` to a Gemma model served by Ollama.
- **Frontend development:** keep the API running and run `npm run dev` in `frontend/`; open http://localhost:3000.
- **Docker:** `docker build -t mindly . && docker run -p 8080:8080 -v mindly-data:/data --env-file .env mindly`
- **On a phone:** browsers allow the microphone only over HTTPS (or localhost), so deploy it first; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Test it

```bash
pip install -r requirements-dev.txt && python -m pytest -q    # API: 42 tests, no key or network needed
cd frontend && npx tsc --noEmit && npm run build              # web app: types and a production build
```

The tests cover accounts (sign up, sign in and out, Google token checks, deletion), the AI endpoints (sign-in required, quotas, silence reported as "no speech", unsupported audio rejected), hosted speech (silence filtering, outages reported as 502), the writer, the crisis-language check, search, and the companion agent against a scripted fake model, including streaming, tool rounds, and removal of citations the model made up. CI runs the same checks on every push.

## Known limitations

- **Languages:** Whisper handles English and Nigerian English well and short Pidgin phrases reasonably. Yoruba and Hausa are experimental, and **Igbo isn't supported by Whisper**. The app says so during onboarding. The next step is a Nigerian code-switching model such as [yecsASR](https://huggingface.co/LyngualLabs/yecsASR-omni-llm) (Yoruba and English).
- **Record yourself only, and the licences are part of the terms.** Users confirm both in onboarding, and the Terms page repeats them. Whisper's model card advises against transcribing people without their consent; Mindly is built for your own voice and says so in its terms.
- **Not therapy:** Mindly can't diagnose, monitor or respond to emergencies. The keyword safety check is simple and will miss things; the support card is a floor, not a guarantee.
- **The journal is tied to one browser.** Clearing site data deletes it. Export regularly. Cross-device sync would need end-to-end encryption to keep the privacy promise.
- **App lock is a screen lock, not encryption at rest.**
- **Keyword retrieval** misses connections without shared words ("couldn't sleep" vs "insomnia"). Small open embedding models are the next step.
- **Single process:** rate limits and quotas are in memory and accounts use SQLite. See the scaling path in the architecture doc.
- **Speech latency** depends on the speech service. The local fallback is much slower on a CPU.
- **Helpline numbers** (SURPIN 0800 078 7746, emergency 112) were checked against public directories in October 2026. Re-verify them before any real launch.

## Project layout

```
mindly/               API
  main.py             routes, security headers, quotas
  accounts.py         users and sessions (scrypt passwords, hashed session tokens)
  asr.py              speech to text: hosted Whisper or local faster-whisper
  llm.py              OpenAI-compatible client, with streaming
  writer.py           transcript → faithful page and title
  reflect.py          companion agent: retrieval, tools, citation checks, guardrails
  search.py           per-request full-text index
  safety.py           crisis-language check
frontend/             web app (Next.js App Router, TypeScript)
  app/                screens
  components/         orb, hand-drawn graphics, dialogs, session and route guard
  lib/                orb engine, recorder, pipeline, IndexedDB store, chat streaming, context picker
tests/                pytest suite
docs/                 architecture and deployment
```

## Background and acknowledgements

- The Mindly concept (orb capture, reflection, "faithful writing" rules) comes from a product brief our team wrote before the challenge. The code in this repository was written during OPEN//BUILD (Oct 25–29, 2026).
- **Models:** OpenAI Whisper (MIT), Google Gemma 4 (Apache 2.0). Hosted inference through Groq and OpenRouter.
- **Libraries:** Next.js and React (MIT), FastAPI (MIT), Starlette (BSD), Uvicorn (BSD), httpx (BSD), Pydantic (MIT), python-dotenv (BSD), faster-whisper (MIT), PyAV (BSD).
- **Fonts and sign-in:** Patrick Hand (SIL Open Font License) via Google Fonts; Google Identity Services.
- **Helpline information:** SURPIN (Suicide Research and Prevention Initiative), via LifeLine International and findahelpline.com.
- **AI-assisted development:** AI coding tools were used for parts of the code and documentation; the team reviewed, tested and is responsible for all of it.

## Licence

MIT. See [LICENSE](LICENSE).
