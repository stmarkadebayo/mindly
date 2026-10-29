# Deployment

One container serves the API and the web app. It needs HTTPS (browsers only allow the microphone on secure origins), a small persistent disk for the account database, and three outbound connections: the language model, the speech service, and optionally Google sign-in.

## Configuration

| Variable | Needed? | What it is |
|---|---|---|
| `LLM_API_KEY` | **Required** | Key for the language-model endpoint (OpenRouter by default). Writes pages and powers Reflect and Talk. |
| `ASR_API_KEY` | Recommended | Key for a hosted Whisper endpoint (Groq by default). Without it, speech runs on the server's CPU, which is much slower and needs `requirements-local-asr.txt`. |
| `GOOGLE_CLIENT_ID` | Optional | Turns on Google sign-in. Email sign-in works without it. |
| `DATA_DIR` | Production | Where `accounts.db` lives. Mount a persistent volume here (the Dockerfile uses `/data`). |
| `DAILY_AI_LIMIT` | Optional | AI calls per account per day (default 300). |
| `LLM_BASE_URL`, `WRITER_MODEL`, `REFLECT_MODEL`, `ASR_BASE_URL`, `ASR_MODEL` | Optional | Swap providers or models. Any OpenAI-compatible endpoint serving an open-weight model works. |

There is nothing else to connect: no database server, object store, email service or queue.

## Run the container

```bash
docker build -t mindly .
docker run -p 8080:8080 -v mindly-data:/data --env-file .env mindly
```

Add `--build-arg LOCAL_ASR=1` to include on-server Whisper.

## Where to host it

**Recommended: Fly.io for the API, optionally Cloudflare in front.**

- Fly.io runs the Docker image as is, has a persistent volume for SQLite, terminates TLS, and can keep one machine always on. It has a Johannesburg region (`jnb`), the closest to Nigeria on its list; Frankfurt (`fra`) and London (`lhr`) are also reasonable. Because transcription and writing happen on hosted services, the API machine can be small (shared 1 CPU, 512 MB to 1 GB).
- Putting **Cloudflare** in front adds a CDN for the static app with a point of presence in Lagos, plus DDoS protection. It is optional.

```bash
fly launch --no-deploy --region jnb        # accept the Dockerfile; pick a unique app name
fly volumes create mindly_data --size 1 --region jnb
```

In `fly.toml`, mount the volume and keep a machine warm:

```toml
[mounts]
  source = "mindly_data"
  destination = "/data"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "off"
  min_machines_running = 1
```

```bash
fly secrets set LLM_API_KEY=... ASR_API_KEY=... GOOGLE_CLIENT_ID=...
fly deploy
```

**Alternatives**

| Platform | Good for | Watch out for |
|---|---|---|
| Hugging Face Space (Docker) | A free, no-card demo link for judges | Free disk is wiped on restart, so accounts reset (fine for a demo). Sleeps when idle, so open it before presenting. |
| Render | Easy Git-based deploys | Free tier cold-starts; the persistent disk is paid. |
| Railway | Fast setup | Paid; no Africa region. |
| A VPS (Hetzner, DigitalOcean) | Cheapest always-on option | You run TLS (Caddy makes it one line) and updates yourself. |

## Cost

| Item | Roughly | Notes |
|---|---|---|
| API machine on Fly.io | **~$3.2–3.8/month** for a shared 1-CPU, 512 MB machine, plus **$0.15/GB/month** for the volume | Fly's current price list should be checked at fly.io/docs/about/pricing; new accounts get no ongoing free tier, only a short trial. A VPS or a free Hugging Face Space can be cheaper. |
| Speech (Groq, Whisper large-v3-turbo) | **$0.04 per hour of audio** (Groq's listed price) | One-minute note ≈ $0.0007 |
| Language model (OpenRouter, Gemma 4 26B-A4B) | about **$0.00006 per written page** and about $0.0001 per chat reply (measured) | Open models are cheap here; DeepSeek isn't cheaper for this task |
| Example | 1,000 people writing 10 one-minute notes and 10 chat messages a month ≈ **$8–9 of AI + ~$4 hosting** | |

## Before going live

- [ ] `LLM_API_KEY` and `ASR_API_KEY` set as platform secrets, not in the image or repo.
- [ ] HTTPS on. Test the microphone on a phone.
- [ ] Persistent volume mounted at `DATA_DIR`.
- [ ] Google sign-in: your live URL added under **Authorized JavaScript origins** in the OAuth client, and the consent screen published (so people outside your test list can sign in).
- [ ] Budget alerts on the language-model and speech providers.
- [ ] Helpline numbers in the app re-verified (SURPIN 0800 078 7746, emergency 112).
- [ ] If more than one machine is needed: Postgres for accounts and Redis for rate limits first (see ARCHITECTURE.md).
