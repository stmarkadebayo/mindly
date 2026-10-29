# Contributing

Thanks for helping. Mindly is small on purpose, so the best contributions keep it that way.

## Set up

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
(cd frontend && npm ci)
```

Run the API with `uvicorn mindly.main:app --port 8001 --reload` and the web app with `npm run dev` in `frontend/` (http://localhost:3000, which proxies `/api` to the API).

## Before you open a pull request

```bash
python -m pytest -q
cd frontend && npx tsc --noEmit && npm run build
```

- Add or update a test for any behaviour you change. The API tests need no key or network; use the scripted fake models in `tests/test_ai.py` as a pattern.
- Keep journal content out of logs, error messages and URLs.
- Don't add a service the app doesn't need. Prefer configuration over new moving parts.
- Design: lists are plain rows with hairlines, not cards; one accent colour used sparingly; no gradients except the orb; no emoji icons.

## Reporting problems

Open an issue with what you did, what you expected and what happened. For anything security-related, see [SECURITY.md](SECURITY.md) instead.
