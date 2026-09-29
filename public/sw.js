'use strict';

const CACHE = 'studymate-v2';
const SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/store.js',
  '/js/ui.js',
  '/js/nav.js',
  '/js/chrome.js',
  '/js/render.js',
  '/js/pages/dashboard.js',
  '/js/pages/stats.js',
  '/js/pages/subjects.js',
  '/js/pages/tests.js',
  '/js/pages/ai.js',
  '/js/pages/tasks.js',
  '/js/pages/notes.js',
  '/js/pages/timetable.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // API requests always hit the network.
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first for app shell, with network fallback that re-caches.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
