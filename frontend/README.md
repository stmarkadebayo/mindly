# Mindly web app

Next.js (App Router) and TypeScript. It builds to a static export (`npm run build` writes `out/`), which the API
serves, so the whole product deploys as one container. See the [project README](../README.md).

Screens are phone-first. `components/Shell.tsx` adds a journal sidebar on screens 1100 px and wider, and `app/welcome/page.tsx` is a landing page on screens 700 px and wider. Layout rules for wider screens are at the end of `app/screens.css`.

```bash
npm ci
npm run dev        # http://localhost:3000, proxies /api to the API on :8001
npm run build      # static export into out/
npx tsc --noEmit   # type-check
```
