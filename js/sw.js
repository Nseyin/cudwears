/* CUDWEARS service worker: network first (so product and price changes show at once), cache as the offline fallback.
   Supabase and other API calls are never cached. */
const CACHE = "cudwears-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.hostname.endsWith("supabase.co") || url.pathname.startsWith("/p/")) return;
  e.respondWith(fetch(req).then(resp => {
    if (resp && resp.ok && (url.origin === location.origin || /cdn|fonts/.test(url.hostname))) { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return resp;
  }).catch(() => caches.match(req)));
});
