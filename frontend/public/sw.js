// Offline shell: pages and assets are cached as they load (network first), so Mindly opens and records without a
// connection. The API is never touched, and the journal itself lives in IndexedDB, not here.
const CACHE = "mindly-v3";
const SHELL = ["/welcome/", "/icon.svg", "/manifest.webmanifest"];

// Installing never fails just because one file couldn't be fetched.
self.addEventListener("install", (e) => e.waitUntil(
  caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      })
      .catch(async () =>
        (await caches.match(req, { ignoreSearch: true }))
        || (req.mode === "navigate" ? await caches.match("/welcome/") : undefined)
        || Response.error()),
  );
});
