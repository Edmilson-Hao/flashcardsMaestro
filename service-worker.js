const CACHE_NAME = 'maestro-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './palavras.txt',
  './manifest.json',
  './icon.png',    // Adicionado ao Cache
  './splash.png',  // Adicionado ao Cache
  './js/app.js',
  './js/db.js',
  './js/scheduler.js',
  './js/ui.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});