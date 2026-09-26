// Service worker: keeps the app shell on the device so it opens without internet.
// Case data never goes through here — it comes live from Supabase (plus the app's own offline copy).
const VERSION = "v1.3.14";
const SHELL = `shell-${VERSION}`, STATIC = "static-v2";
const APP = ["./", "index.html", "app.js", "core.js", "icons.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png"];
// Pinned third-party files never change at the same URL, so they can be cache-first forever.
const PINNED = ["vendor/supabase.js", "vendor/xlsx.full.min.js", "vendor/fonts/fonts.css", "vendor/fonts/BalooBhaijaan2-arabic.woff2", "vendor/fonts/BalooBhaijaan2-latin.woff2"];

self.addEventListener("install", e => {
  e.waitUntil(Promise.all([caches.open(SHELL).then(c => c.addAll(APP)), caches.open(STATIC).then(c => c.addAll(PINNED))]).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== STATIC).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if(e.request.method !== "GET" || u.origin !== location.origin) return;   // Supabase calls are never cached here
  if(u.pathname.includes("/vendor/")){
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(STATIC).then(c => c.put(e.request, copy)); return res; })));
    return;
  }
  // App files: network first (so updates arrive immediately), cache when offline.
  e.respondWith(fetch(e.request).then(res => { if(res.ok){ const copy = res.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); } return res; })
    .catch(() => caches.match(e.request).then(r => r || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
