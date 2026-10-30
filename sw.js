/* Smart Dictation Player — Service Worker (v56 / 6.2.0)
 * GitHub Pages static hosting. Two strategies:
 *   - Stale-While-Revalidate for the app shell so updates land within one
 *     navigation while offline practice keeps working.
 *   - Cache-First for versioned media and audio clips so wallpapers and studio
 *     clips never re-download after ten minutes and work 100% offline.
 */
'use strict';

var VERSION = 'sdp-v56';
var SHELL = [
  './',
  './index.html',
  './data.html',
  './data/studio.js',
  './data/data-meter.js',
  './data/session.json',
  './data/config.json',
  './data/version.json',
  './data/media-manifest.json',
  './manifest.webmanifest',
  './sw.js'
];
var CACHE = VERSION + '-shell';
var MEDIA_CACHE = VERSION + '-media';

function safeFetch(url, init) {
  try { return fetch(url, init || {}); } catch (e) { return Promise.reject(e); }
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE && k !== MEDIA_CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isMedia(url) {
  return /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a|aac|opus)(?:[?#]|$)/i.test(url) ||
    /\/assets\//.test(url) || /\/audio\//.test(url);
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isMedia(req.url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var network = safeFetch(req).then(function (resp) {
            if (resp && resp.ok) {
              var copy = resp.clone();
              cache.put(req, copy).catch(function () {});
            }
            return resp;
          }).catch(function () { return cached; });
          return cached || network;
        });
      })
    );
    return;
  }

  // App shell: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = safeFetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); }).catch(function () {});
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
