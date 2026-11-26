const CACHE_NAME = 'galactica-rss-web-v4.2';
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-16.png',
  './icon-48.png',
  './icon-128.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Estratégia Network-First para navegação (inclusive URLs recebidas pelo Web Share Target)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!url.search) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', cloned));
          }
          return response;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Estratégia Cache-First para manifest.json, ícones e recursos estáticos locais
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      });
    })
  );
});