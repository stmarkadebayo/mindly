# Mindly

**Think out loud, feel lighter, get unstuck.** A private, voice-first journal. Tap the orb, talk the way you think, and get a clear written page in your own words. When you want, a gentle companion helps you reflect, grounded in what you've actually written.

> Built for OPEN//BUILD 2026 (OSCA Ile-Ife Hacktoberfest) with open-weight models.

- **Live app:** https://mindly-ai.duckdns.org (sign up with any email and a password of 8+ characters; there is no email verification)
- **Code:** https://github.com/stmarkadebayo/mindly
- **Use a laptop or a phone.** The layout adapts: a journal sidebar on desktop, a roomier single column on tablets, and the original phone layout under 700 px.

## Why

Most people's best thoughts arrive when they can't write them down: on a walk, in a danfo, at 2 a.m., in the shower. Journaling is one of the simplest ways to process feelings and sort out ideas, yet almost nobody keeps it up:

- **A blank page is a wall.** For people who struggle to start (procrastinators, people with ADHD-style attention, anyone overwhelmed), the cost of opening a notes app and organising a thought is enough to skip it. Talking has no such cost.
- **Typing is slower than thinking.** Thoughts fade before a phone keyboard catches them.
- **Voice notes are a graveyard.** People already talk to their phones, but a 4-minute rambling recording is never listened to again. Nothing is searchable, titled or connected to anything else.
- **Old entries are never reread,** so patterns in mood, sleep, stress and ideas stay invisible.

Mindly keeps the speed of a voice note and adds what voice notes lack: a clean written page, a title, a mood, and a companion that remembers what you said last month and helps you find the pattern or the next small step. It is for **wellbeing and for thinking**: processing a hard day, capturing an idea, or untangling a task you keep avoiding.

**Intended users:** students and young professionals, starting with university students in Nigeria; plus creatives, people who find starting hard, and anyone who thinks better out loud. They already live in voice notes, often mixing English with Pidgin or Yoruba, want a private place to think, and won't stick with anything that feels like a form. Mindly is a journal, not a therapist or a medical service.

### What we heard from students

Before building, we asked students six questions (how they capture thoughts, what stops them, which language they think in, who they turn to, and whether they'd trust an app). Four students answered. It is a very small, informal sample, so we treat it as a guide, not as proof. Here is what came up and what we did about it:

| What they told us | What Mindly does |
|---|---|
| *"I don't have the energy to write everything down"*, *"I don't know where to start or how to put my feelings into words"*, *"I feel lazy to note things down"* | Talking replaces typing. There is no blank page, and Mindly writes the page for you. Three prompts help when you don't know where to start. |
| Some already send **voice notes to themselves**; others type in a notes app, brain-dump on paper, or keep it in their heads | One tap to talk. The recording becomes a titled, searchable written entry, which a voice note never becomes. |
| People think and speak in **English mixed with Yoruba**, or switch language depending on how they feel | Speech and writing are built for code-switching: language hints for Yoruba and Hausa, a Pidgin vocabulary hint for the speech model, and a writer that never translates or "corrects" a switch. The chat replies in your language, including Pidgin. |
| **Privacy** was the main worry, along with **backup** | The journal lives on your device, not on our server. App lock, full export and delete-everything are in Settings. Export is the backup for now (see limitations). |
| One person would use it *"if the app is helpful with action steps"*; another already breaks problems down with a chatbot | The companion offers two or three small practical steps when you're stuck, and Insights ends with "Something to try". |
| People turn to a trusted person, or prefer to think alone | Mindly doesn't replace people. It is a private place to think first, and it points to real support when it matters. |

## What it does

| | |
|---|---|
| **Talk, don't type** | The orb lives on Home. Tap it (or a prompt) and it rises and grows while the rest of the screen softens away. There's no blank page in between: the written page opens when you finish. The orb reacts to the frequencies of your voice and swirls on its own while Mindly writes. Tap the orb to pause and resume. |
| **A real page, automatically** | Your words are transcribed and rewritten into a clean first-person entry with a title. Fillers go and obvious speech-recognition slips are fixed; your facts, feelings and phrasing stay. No summarising, no advice, no translation. |
| **Edit and keep going** | The page is editable and autosaves. Tap the orb again to keep talking, and the new part is added to the end. If you type while Mindly is still writing, your typing wins. Note tools add headings, bold, checklists, bullets, numbered lists, starred lines, dividers, timestamps and photos (kept on the device). |
| **Three prompts when you're stuck** | Chosen from the goals you pick in onboarding. Tap one and start talking. |
| **Mood, minimally** | One tap after recording (Low, Meh, Okay, Good, Great). Insights shows two weeks as a thin line. No streaks, on purpose. |
| **Reflect** | Tap the Reflect button on any entry for a short insight that connects it to related past entries, each linked as a source. |
| **Chat** | A companion (type or speak) that helps you get things out, make sense of them, and pick one small next step. Replies stream in as they're written, in the language you write in. It isn't a therapist or a general assistant. |
| **Insights: "From your words"** | After three entries, the model reads your recent entries and shows the themes that keep coming up, a few things it noticed (each linking to the entries behind it), and one small thing to try. It is cached on your device until your entries change. |
| **Sample journal** | New here? Tap "Try a sample journal" on the empty Home screen (or choose it on the landing page before signing up) to add 11 example entries, in English, Pidgin and a little Yoruba, to your own browser. They are ordinary entries you can edit, add to, record onto and remove in Settings, so you can see Insights, Reflect and Chat working straight away. |
| **Search** | Search your journal by any word; "exams" finds "exam", "sleeping" finds "sleep". |
| **Safety** | If an entry or message suggests someone may be in danger, Mindly shows Nigerian crisis lines (SURPIN, 112). |
| **Private by design** | The journal (text, audio and photos) lives on the device. The server keeps only the account. App lock (PIN), export everything, delete the journal or the whole account. |
| **Works offline** | Recording and reading work offline. Recordings made offline are queued and written up when you're back online. It installs as a PWA. |
| **Made for every screen** | Phone: one column. Tablet: a wider column. Desktop: a journal sidebar with your entries beside the page, chat and recording. Keyboard: while recording, Space pauses or resumes, Enter finishes and Esc discards; on Home, Space starts. |

**Screens:** Landing (signed out, on tablet and desktop), Welcome, Sign up and Sign in (email or Google), Onboarding, Home, Entry, Reflect and Chat, Insights, Settings, Privacy, Support, Terms.

## How it uses open-weight models

| Role | Model | Licence | Where it runs |
|---|---|---|---|
| Speech to text | [**Whisper large-v3-turbo**](https://huggingface.co/openai/whisper-large-v3-turbo) (hosted, the fast path) or **Whisper small** via [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (on the server's CPU) | MIT | Hosted: any OpenAI-compatible `/audio/transcriptions` endpoint (Groq by default). Local: the API machine. |
| Writing the page | [**Google Gemma 4 26B-A4B-it**](https://huggingface.co/google/gemma-4-26B-A4B-it) | Apache 2.0 | Any OpenAI-compatible endpoint (OpenRouter by default, or local Ollama) |
| Reflect, Chat and Insights | **Gemma 4 26B-A4B-it** with tool calling | Apache 2.0 | Same |

**Licences, checked on the Hugging Face model pages on 29 October 2026 (details and the model comparison are in [docs/MODELS.md](docs/MODELS.md)):** Whisper large-v3-turbo is MIT; Gemma 4 26B-A4B-it is Apache 2.0 and not gated. Open weights do not automatically mean fully open source, so we checked both and credit them below.

**Why these:** Whisper is the strongest openly licensed speech model that is also available as a very fast hosted endpoint, and it can run on an ordinary CPU as a fallback. Gemma 4 26B-A4B supports tool calling and activates only about 4B parameters per token, so it is quick and cheap (on the order of a tenth of a cent per entry). Everything can be self-hosted later by changing two URLs.

**The model does real work, under strict limits** ([`mindly/writer.py`](mindly/writer.py), [`mindly/reflect.py`](mindly/reflect.py), [`mindly/asr.py`](mindly/asr.py)):

- **Better speech for how we talk:** the speech model gets a short hint ("Nigerian English and Pidgin: abeg, wahala, dey, wetin, oga") so Pidgin words come out right ("abeg", not "a beg"). Segments the model is unsure of are dropped, which stops it inventing sentences from background noise.
- **Faithful writing:** the prompt forbids adding, summarising, translating or moralising. It fixes only obvious recognition errors and never guesses a name, number or place. The transcript is passed as delimited data, so instructions spoken inside a recording are ignored.
- **An agent over your own journal:** the app sends the entries a request needs, and the server builds a throwaway full-text index (SQLite FTS5, BM25, Porter stemming) and gives the model two read-only tools, `search_journal` and `read_entry`, for up to four rounds per reply. Nothing is stored afterwards.
- **Grounded citations:** entries are numbered per request. Any citation of an entry the model wasn't actually shown is removed before you see the reply. The UI shows which entries each insight is drawn from.
- **Guardrails:** the companion has a clear role (listen, reflect, at most one gentle question, help pick one small step), doesn't diagnose, and turns down unrelated tasks. A keyword check adds the support card for crisis language; it never blocks anything. Text hidden inside journal entries is treated as content, not instructions.

## Architecture

```
Browser (Next.js + TypeScript, PWA)                   API (FastAPI, stateless)
IndexedDB: entries, audio, photos, chats ──audio──▶  /api/transcribe   hosted Whisper (or local)
Orb · Recorder · offline queue            ◀──text───  /api/write        Gemma 4 → faithful page + title
Responsive shell (sidebar on desktop)     ──text───▶  /api/companion    Gemma 4 agent, streamed
                                                      /api/insights     themes, patterns, one thing to try
                                                      accounts.db       users + hashed session tokens only
```

Journals stay on the device; the server is stateless apart from accounts. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for tenancy, security controls, the latency budget and the scaling path, and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/AWS-SETUP.md](docs/AWS-SETUP.md) for hosting. The live app runs on one AWS EC2 instance (Docker, with Caddy for HTTPS).

## Run it

Requirements: Python 3.10+ and Node 20+.

```bash
git clone https://github.com/stmarkadebayo/mindly.git && cd mindly
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                       # then add LLM_API_KEY (and ASR_API_KEY for fast speech)
(cd frontend && npm ci && npm run build)   # builds the app into frontend/out
uvicorn mindly.main:app --port 8001        # serves the API and the app
```

Open http://localhost:8001 and allow microphone access. Tap "Try a sample journal" on the empty Home screen to fill the journal with example entries. Keys come from [OpenRouter](https://openrouter.ai) (language model) and [Groq](https://console.groq.com) (hosted Whisper); both have free tiers.

- **Speech:** with `ASR_API_KEY` set, audio goes to a hosted Whisper endpoint and comes back in about a second. Without it, Whisper runs on this machine: `pip install -r requirements-local-asr.txt` (the first recording downloads the model, about 480 MB for `small`).
- **Google sign-in (optional):** create an OAuth client ID of type *Web application* in Google Cloud Console, add your site's origin under Authorized JavaScript origins, and set `GOOGLE_CLIENT_ID`. Email sign-in works without it.
- **Fully local models:** set `LLM_BASE_URL=http://localhost:11434/v1` and `WRITER_MODEL` / `REFLECT_MODEL` to a Gemma model served by Ollama.
- **Frontend development:** keep the API running and run `npm run dev` in `frontend/`; open http://localhost:3000.
- **Docker:** `docker build -t mindly . && docker run -p 8080:8080 -v mindly-data:/data --env-file .env mindly`
- **On a phone:** browsers allow the microphone only over HTTPS (or localhost), so deploy it first; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Dependencies

Python (`requirements.txt`): FastAPI, Uvicorn, httpx, Pydantic, python-dotenv, python-multipart. Optional (`requirements-local-asr.txt`): faster-whisper. Dev (`requirements-dev.txt`): pytest. Web (`frontend/package.json`): Next.js, React, TypeScript.

## Test it

```bash
pip install -r requirements-dev.txt && python -m pytest -q    # API: 48 tests, no key or network needed
cd frontend && npx tsc --noEmit && npm run build              # web app: types and a production build
```

The tests cover accounts (sign up, sign in and out, Google token checks, deletion), the AI endpoints (sign-in required, quotas, silence reported as "no speech", unsupported audio rejected), hosted speech (silence filtering, outages reported as 502), the writer, the crisis-language check, search (including word variants), and the companion agent against a scripted fake model, including streaming, tool rounds, and removal of citations the model made up. CI runs the same checks on every push.

We also tried the companion against the real model with a made-up journal: it searched and read entries when asked, cited them correctly, ignored instructions hidden inside an entry, answered Pidgin in Pidgin, declined unrelated tasks, and showed the support card for crisis language.

## Known limitations

- **Languages:** Whisper handles English and Nigerian English well and short Pidgin phrases reasonably. Yoruba and Hausa are experimental, and **Igbo isn't supported by Whisper**. The app says so during onboarding. The next step is a Nigerian code-switching model such as [yecsASR](https://huggingface.co/LyngualLabs/yecsASR-omni-llm) (Yoruba and English).
- **Record yourself only, and the licences are part of the terms.** Users confirm both in onboarding, and the Terms page repeats them. Whisper's model card advises against transcribing people without their consent; Mindly is built for your own voice and says so in its terms.
- **Not therapy:** Mindly can't diagnose, monitor or respond to emergencies. The keyword safety check is simple and will miss things; the support card is a floor, not a guarantee.
- **The journal is tied to one browser.** Clearing site data deletes it. Export regularly; export is the only backup today. Cross-device sync would need end-to-end encryption to keep the privacy promise, and we have not built it.
- **App lock is a screen lock, not encryption at rest.**
- **Retrieval is keyword-based** (with stemming): it misses connections without shared words ("couldn't sleep" vs "insomnia"). Small open embedding models are the next step.
- **Single process:** rate limits and quotas are in memory and accounts use SQLite. See the scaling path in the architecture doc.
- **Speech latency** depends on the speech service. The local fallback is much slower on a CPU.
- **Helpline numbers** (SURPIN 0800 078 7746, emergency 112) were checked against public directories in October 2026. Re-verify them before any real launch.
- **Prototype scale:** the live demo is one small server with a daily AI limit per account.
- **Evidence:** our student interviews had four responses. We have not run a usability study or measured transcription accuracy on a Nigerian speech test set.

## Project layout

```
mindly/               API
  main.py             routes, security headers, quotas
  accounts.py         users and sessions (scrypt passwords, hashed session tokens)
  asr.py              speech to text: hosted Whisper or local faster-whisper
  llm.py              OpenAI-compatible client, with streaming
  writer.py           transcript → faithful page and title
  reflect.py          companion agent: retrieval, tools, citation checks, guardrails
  insights.py         themes, patterns and one thing to try, from recent entries
  search.py           per-request full-text index
  safety.py           crisis-language check
frontend/             web app (Next.js App Router, TypeScript)
  app/                screens
  components/         orb, voice dock, entry editor, sidebar shell, dialogs, session and route guard
  lib/                orb engine, recorder, pipeline, IndexedDB store, chat streaming, context picker
tests/                pytest suite
docs/                 architecture, models, deployment
deploy/               Caddyfile and backup script
```

## Background and acknowledgements

- The Mindly concept (orb capture, reflection, "faithful writing" rules) comes from a product brief our team wrote before the challenge. The code in this repository was written during OPEN//BUILD (Oct 25–29, 2026).
- **Models:** OpenAI Whisper large-v3-turbo (MIT), Google Gemma 4 26B-A4B-it (Apache 2.0). Hosted inference through Groq and OpenRouter.
- **Libraries:** Next.js and React (MIT), FastAPI (MIT), Starlette (BSD), Uvicorn (BSD), httpx (BSD), Pydantic (MIT), python-dotenv (BSD), faster-whisper (MIT), PyAV (BSD).
- **Fonts and sign-in:** Patrick Hand (SIL Open Font License) via Google Fonts; Google Identity Services.
- **Infrastructure:** Docker, Caddy (Apache 2.0), AWS, DuckDNS (free domain), GitHub Actions.
- **Helpline information:** SURPIN (Suicide Research and Prevention Initiative), via LifeLine International and findahelpline.com.
- **Student interviews:** four students shared their experience of journaling and trust; their answers are summarised without names.
- **AI-assisted development:** AI coding assistants were used throughout for writing and reviewing code, tests and documentation, and for debugging and deployment. The team directed the work, tested it, and is responsible for all of it.

## Licence

MIT. See [LICENSE](LICENSE).
