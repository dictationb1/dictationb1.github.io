/* Smart Dictation Player — Service Worker (v60 / 9.0.0.2)
 * GitHub Pages static hosting.
 *   - Network-First + cache fallback for the app shell documents & scripts, so
 *     a returning student can never be stuck on an old learning-tools.js.
 *   - Cache-First for versioned media/audio, stored as FULL responses.
 *   - HTTP Range/206 support: slice a cached full response, or answer the
 *     range from the network while a background full fetch fills the cache.
 */
'use strict';

var VERSION = 'v60-9.0.0.2';
var APP_VERSION = '9.0.0.2';
var MEDIA_MAX_ENTRIES = 160;
var CACHE_APP = 'sdp-app-' + VERSION;
var CACHE_DATA = 'sdp-data-' + VERSION;
var CACHE_MEDIA = 'sdp-media-' + VERSION;

var SHELL = [
  './',
  './index.html',
  './data.html',
  './data/index.html',
  './version.json',
  './data/version.json',
  './manifest.webmanifest',
  './data/learning-tools.js',
  './data/studio.js',
  './data/data-meter.js',
  './data/session.json',
  './data/config.json',
  './data/media-manifest.json',
  './data/elevenlabs-audio.json',
  './assets/fonts/NotoSansSinhala-Regular.woff2',
  './assets/fonts/NotoSansSinhala-Bold.woff2',
  './assets/audio/guide-si-1.mp3',
  './assets/audio/guide-si-2.mp3',
  './assets/audio/guide-si-3.mp3',
  './assets/audio/guide-si-4.mp3',
  './assets/audio/guide-si-5.mp3',
  './assets/audio/guide-si-6.mp3'
];

/* documents + scripts that changed in this build: always ask the network first */
var NETWORK_FIRST = [
  '/index.html',
  '/data.html',
  '/data/index.html',
  '/index',
  '/version.json',
  '/data/version.json',
  '/data/learning-tools.js',
  '/data/studio.js',
  '/data/data-meter.js',
  '/sw.js'
];

function isNetworkFirst(url) {
  var p = url.pathname.replace(/\/+$/, '');
  if (p === '' || p === '/dictationb1.github.io') return true;
  for (var i = 0; i < NETWORK_FIRST.length; i++) {
    if (p === NETWORK_FIRST[i] || p.slice(-NETWORK_FIRST[i].length) === NETWORK_FIRST[i]) return true;
  }
  if (/[?&]v=/.test(url.search)) return true;
  return false;
}

function isDataAsset(url) {
  return /\.(json|webmanifest)$/i.test(url.pathname) || /\/data\//.test(url.pathname);
}

function pruneMediaCache(cache, maxEntries) {
  return cache.keys().then(function (keys) {
    if (keys.length <= maxEntries) return;
    var removals = keys.slice(0, keys.length - maxEntries);
    return Promise.all(removals.map(function (k) { return cache.delete(k); }));
  });
}

function safeFetch(url, init) {
  try { return fetch(url, init || {}); } catch (e) { return Promise.reject(e); }
}

function isMedia(url) {
  return /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a|aac|opus)(?:[?#]|$)/i.test(url) ||
    /\/assets\/.+\.(mp4|webm|mov|m4v)$/i.test(url) || /\/audio\//.test(url);
}

function parseRange(header, size) {
  var m = /bytes=(\d*)-(\d*)/.exec(String(header || '')), start, end;
  if (!m) return null;
  if (m[1] === '' && m[2] === '') return null;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start > end || start >= size) return { invalid: true, size: size };
  return { start: start, end: end, size: size };
}

function rangeResponse(full, range) {
  return full.arrayBuffer().then(function (buf) {
    if (range.invalid) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + range.size, 'Accept-Ranges': 'bytes' } });
    }
    var slice = buf.slice(range.start, range.end + 1);
    var headers = new Headers(full.headers);
    headers.set('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + range.size);
    headers.set('Content-Length', String(slice.byteLength));
    headers.set('Accept-Ranges', 'bytes');
    return new Response(slice, { status: 206, statusText: 'Partial Content', headers: headers });
  });
}

function fullKey(req) {
  try { var u = new URL(req.url); u.search = ''; u.hash = ''; return u.toString(); } catch (e) { return req.url; }
}

function backgroundFull(cache, req) {
  var key = fullKey(req);
  return cache.match(key).then(function (hit) {
    if (hit) return hit;
    return safeFetch(key, { credentials: 'same-origin' }).then(function (resp) {
      if (resp && resp.ok && resp.status === 200) { try { cache.put(key, resp.clone()); } catch (e) {} }
      return resp;
    }).catch(function () { return null; });
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then(function (cache) {
        /* never let one 404 block the whole install */
        return Promise.all(SHELL.map(function (url) {
          return cache.add(url).catch(function () { return null; });
        }));
      })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE_APP && k !== CACHE_DATA && k !== CACHE_MEDIA && k !== 'sdp-youdao-v1';
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return caches.open(CACHE_MEDIA).then(function (cache) { return pruneMediaCache(cache, MEDIA_MAX_ENTRIES); });
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* ---- media: cache-first with range support ---- */
  if (isMedia(req.url)) {
    var rangeHeader = req.headers.get('Range');
    event.respondWith(
      caches.open(CACHE_MEDIA).then(function (cache) {
        var key = fullKey(req);
        return cache.match(key).then(function (cached) {
          if (rangeHeader && cached && cached.status === 200) {
            var r = parseRange(rangeHeader, Number(cached.headers.get('Content-Length')) || 0);
            if (r) return rangeResponse(cached.clone(), r);
          }
          if (cached && !rangeHeader) {
            event.waitUntil(backgroundFull(cache, req));
            return cached;
          }
          var network = safeFetch(req).then(function (resp) {
            if (resp && resp.ok && resp.status === 200 && !rangeHeader) {
              try { cache.put(key, resp.clone()); } catch (e) {}
            }
            return resp;
          }).catch(function () { return cached || Response.error(); });
          if (rangeHeader) event.waitUntil(backgroundFull(cache, req));
          return network;
        });
      })
    );
    return;
  }

  /* ---- app shell documents & scripts: NETWORK FIRST, cache fallback ---- */
  if (isNetworkFirst(url)) {
    event.respondWith(
      safeFetch(req, { credentials: 'same-origin', cache: 'no-cache' }).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          var bucket = isDataAsset(url) ? CACHE_DATA : CACHE_APP;
          caches.open(bucket).then(function (cache) { cache.put(req, copy); }).catch(function () {});
        }
        return resp;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          return caches.match(req).then(function (exact) { return exact || Response.error(); });
        });
      })
    );
    return;
  }

  /* ---- everything else: stale-while-revalidate ---- */
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = safeFetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          var bucket = isDataAsset(url) ? CACHE_DATA : CACHE_APP;
          caches.open(bucket).then(function (cache) { cache.put(req, copy); }).catch(function () {});
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) self.skipWaiting();
});
