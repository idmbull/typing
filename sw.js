// sw.js
const CACHE_NAME = 'idm-dictation-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './scripts/main.js',
    './scripts/app.js',
    './scripts/dictation-app.js',
    './scripts/loader.js',
    './scripts/renderer.js',
    './scripts/state.js',
    './scripts/theme.js',
    './scripts/utils.js',
    // Thư viện (nên tải về máy thay vì CDN)
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js' 
];

// 1. Cài đặt Service Worker
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Lấy dữ liệu từ Cache khi offline hoặc mạng chậm
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});

// 3. Xóa cache cũ khi update phiên bản mới
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});