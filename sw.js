const CACHE_NAME = 'yasai-v8';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.webmanifest'
];

// インストール
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 通信
self.addEventListener('fetch', event => {

  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Apps Scriptなど外部APIはキャッシュしない
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // app.js / config.js / index.html は最新版を優先
  if (
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/config.js') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/')
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));

          return response;
        })
        .catch(() => caches.match(request))
    );

    return;
  }

  // CSS・画像などはキャッシュを利用
  event.respondWith(
    caches.match(request)
      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(request)
          .then(response => {

            if (
              !response ||
              response.status !== 200
            ) {
              return response;
            }

            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy));

            return response;
          });

      })
  );
});
