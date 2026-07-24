const CACHE_NAME = '__CACHE_NAME__';
const PRECACHE_URLS = __PRECACHE_URLS__;

// 安裝時一次保存完整應用程式外殼，確保離線仍可開啟匯入與監控介面。
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 啟用新版快取後移除同一 PWA 的舊版本，避免裝置長期累積過期資產。
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('tc-pwa-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 導覽採網路優先並以離線首頁保底；同網域靜態資產採快取優先。
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => cachedResponse || fetch(request))
  );
});
