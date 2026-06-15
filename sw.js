const CACHE_NAME = 'pump-calc-v1';
// Относительные пути (корректно для подпапок GitHub Pages)
const CORE_ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Кэшируем по одному, игнорируя ошибки отдельных файлов
      await Promise.allSettled(
        CORE_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res.ok) await cache.put(url, res);
          } catch (err) {
            console.warn(`⚠️ Не закэшировано: ${url}`, err);
          }
        })
      );
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API Supabase — только сеть (кэшировать токены/ответы API нельзя)
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Статика + CDN: CacheFirst → Network → Fallback
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        // Кэшируем успешные GET-запросы (включая CDN)
        if (request.method === 'GET' && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => {
        // Если offline и это переход по ссылке — отдаём главную страницу
        if (request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
