/* 我的工作台 · Service Worker
 * 作用：静态资源离线缓存 + 二次打开秒开 + 支持一键刷新到最新版
 * 策略：导航请求 stale-while-revalidate；其他静态资源 cache-first(后台刷新)
 */
const CACHE = 'wb-cache-v2';
const PRECACHE = ['./', './index.html', './books-data.js', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 不缓存跨域

  if (req.mode === 'navigate') {
    // HTML：网络优先（确保部署后用户立即看到最新版），离线时回退缓存
    e.respondWith(
      fetch(req).then(res => { putInCache(req, res.clone()); return res; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // 静态资源：缓存优先，命中则在后台刷新
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => { putInCache(req, res.clone()); return res; }).catch(() => cached);
      return cached || network;
    })
  );
});

function putInCache(req, res) {
  if (!res || res.status !== 200) return;
  caches.open(CACHE).then(c => c.put(req, res));
}
