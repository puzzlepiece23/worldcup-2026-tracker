// App-shell cache: serve instantly from cache, refresh in the background.
// Live scores (ESPN, cross-origin) always go straight to the network.
const CACHE = 'wc26-shell-v1';
const SHELL = [
  './', './index.html', './style.css', './app.js', './data.js', './fixtures.js',
  './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then(resp => { if (resp.ok) cache.put(e.request, resp.clone()); return resp; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
