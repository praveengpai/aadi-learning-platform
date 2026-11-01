// Platform service worker: keeps the app shell and module screens available offline.
// API data is cached by the shell itself (per user); the SW never caches /api/.
const CACHE = 'aadi-shell-v3';
const SHELL = ['/', '/index.html', '/shell/styles.css', '/shell/app.js', '/shell/kit.js', '/shell/core-views.js', '/img/cif-mark.png', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin && u.pathname.startsWith('/api/')) return;
  // network first, fall back to cache — so updates arrive when online, and the app still opens offline
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && (u.origin === location.origin || u.host.includes('fonts.g'))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then((r) => r || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});
