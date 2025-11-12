// Service Worker для МедКарта (CureScroll)
// Версия кэша
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `curescroll-${CACHE_VERSION}`;

// Ресурсы для кэширования
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/manifest.json'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Установка Service Worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Кэшируем основные ресурсы');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Ошибка кэширования:', error);
      })
  );
  
  // Немедленная активация
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация Service Worker');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Немедленный контроль всех клиентов
  return self.clients.claim();
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Игнорируем запросы к API и chrome-extension
  if (url.protocol === 'chrome-extension:' || 
      url.hostname.includes('googleapis.com') || 
      url.hostname.includes('generativelanguage.googleapis.com')) {
    return;
  }
  
  // Network First для HTML (всегда свежие данные)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Клонируем ответ для кэша
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Если офлайн - возвращаем из кэша
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Возвращаем офлайн страницу
            return caches.match('/index.html');
          });
        })
    );
    return;
  }
  
  // Cache First для статики (JS, CSS, изображения)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(request).then((response) => {
        // Не кэшируем не-успешные ответы
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        
        // Клонируем ответ для кэша
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        return response;
      });
    })
  );
});

// Обработка сообщений
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker загружен');
