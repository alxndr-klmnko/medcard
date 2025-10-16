const CACHE_NAME = 'medkarta-v4';
const STATIC_CACHE = 'medkarta-static-v4';
const DYNAMIC_CACHE = 'medkarta-dynamic-v4';

// Файлы для кэширования при установке
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/logo192.png',
  '/logo512.png'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('SW: Caching static files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('SW: Installation complete');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('SW: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activation complete');
      return self.clients.claim();
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем Chrome extension запросы
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Стратегия: Cache First для статики, Network First для API
  if (request.destination === 'document') {
    // HTML страницы - Network First с fallback на index.html
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Кэшируем успешные ответы
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback на index.html для SPA
          return caches.match('/index.html');
        })
    );
  } else if (request.destination === 'script' || 
             request.destination === 'style' || 
             request.destination === 'image') {
    // Статические ресурсы - Cache First
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              // Кэшируем новые ресурсы
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            });
        })
    );
  } else {
    // Остальные запросы - Network First
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  }
});
