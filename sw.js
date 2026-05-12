const CACHE_NAME = 'planrun-v35';
const ASSETS = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/user-profile-service.js',
  './assets/js/storage-service.js',
  './assets/js/ai-coach.js',
  './config/config.js',
  './manifest.json',
  './assets/img/logo.jpeg',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap'
];

// INSTALL
self.addEventListener('install', (event) => {

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );

  self.skipWaiting();
});

// ACTIVATE
self.addEventListener('activate', (event) => {

  event.waitUntil(
    caches.keys().then((keys) => {

      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', (event) => {

  // IGNORA REQUISIÇÕES NÃO-GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(

    fetch(event.request)

      .then((response) => {

        // NÃO CACHEIA RESPOSTA INVÁLIDA
        if (!response || response.status !== 200) {
          return response;
        }

        const clone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });

        return response;
      })

      .catch(() => {
        return caches.match(event.request);
      })
  );
});