// 墨韻 MòYùn Service Worker
// 版本號 - 更新時請遞增
const CACHE_VERSION = 'moyun-v1.1.0';
const CACHE_NAME = `moyun-cache-${CACHE_VERSION}`;

// 需要快取的核心資源
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/config.js',
  './js/utils.js',
  './js/storage.js',
  './js/offline.js',
  './js/ui.js',
  './js/doc-manager.js',
  './js/char-manager.js',
  './js/ai-engine.js',
  './js/auth-manager.js',
  './js/app.js',
];

// Install 事件 - 安裝 Service Worker 並快取資源
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installed successfully');
        return self.skipWaiting(); // 立即啟用新的 Service Worker
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate 事件 - 清除舊版本快取
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activated successfully');
        return self.clients.claim(); // 立即控制所有頁面
      })
  );
});

// Fetch 事件 - 攔截網路請求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只處理同源請求
  if (url.origin !== location.origin) {
    return;
  }

  // 網路優先策略（Network First）
  // 對於寫作平台來說，優先使用最新版本，但離線時可以回退到快取
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 如果網路請求成功，更新快取
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // 網路請求失敗，嘗試從快取獲取
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[Service Worker] Serving from cache:', request.url);
              return cachedResponse;
            }

            // 如果快取也沒有，返回離線頁面提示
            return new Response(
              '<h1>離線模式</h1><p>無法連接到網路，請檢查您的網路連接。</p>',
              {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              }
            );
          });
      })
  );
});

// Message 事件 - 處理來自頁面的訊息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
