/* Smart Dictation Player — Service Worker (v60 / 9.0.0.3)
 * GitHub Pages static hosting.
 *   - Stale-While-Revalidate for the app shell.
 *   - Cache-First for versioned media/audio, stored as FULL responses.
 *   - HTTP Range/206 support: slice a cached full response, or answer the
 *     range from the network while a background full fetch fills sdp-v60-media.
 */
'use strict';

var VERSION = 'sdp-v60-9.0.0.3';
var APP_VERSION = '9.0.0.3';
var SW_VERSION = 'sdp-v60-9.0.0.3';
var MEDIA_MAX_ENTRIES = 160;
var SHELL = [
  './',
  './index.html',
  './data.html',
  './data/index.html',
  './data/studio.js',
  './data/data-meter.js',
  './data/learning-tools.js',
  './assets/fonts/NotoSansSinhala-Regular.woff2',
  './assets/fonts/NotoSansSinhala-Bold.woff2',
  './data/session.json',
  './data/config.json',
  './data/version.json',
  './data/media-manifest.json',
  './data/elevenlabs-audio.json',
  './manifest.webmanifest',
  './sw.js',
  './assets/audio/guide-si-1.mp3',
  './assets/audio/guide-si-2.mp3',
  './assets/audio/guide-si-3.mp3',
  './assets/audio/guide-si-4.mp3',
  './assets/audio/guide-si-5.mp3',
  './assets/audio/guide-si-6.mp3'
];
var CACHE = VERSION + '-shell';
var MEDIA_CACHE = VERSION + '-media';

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
function isFreshAsset(url) {
  return /\.(html|js|json)(\?|$)/i.test(url) || /\/$/.test(url);
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
    caches.open(CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (u) {
        return fetch(u, { cache: 'reload' }).then(function (r) {
          return r && r.ok ? cache.put(u, r) : null;
        })['catch'](function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })['catch'](function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        if (k === 'sdp-youdao-v1') return false;
        return k.indexOf('9.0.0.3') === -1;
      }).map(function (k) { return caches.delete(k); }))
    }).then(function () {
      return caches.open(MEDIA_CACHE).then(function (cache) {
        return pruneMediaCache(cache, MEDIA_MAX_ENTRIES);
      });
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || isFreshAsset(url.pathname + url.search)) {
    event.respondWith(
      safeFetch(req, { cache: 'no-cache' }).then(function (resp) {
        if (resp && resp.status === 200) {
          try {
            var copy = resp.clone();
            caches.open(CACHE).then(function (cache) { return cache.put(req, copy); })['catch'](function () { return null; });
          } catch (err) {}
        }
        return resp;
      })['catch'](function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          return caches.match('./index.html').then(function (shell) { return shell || Response.error(); });
        });
      })
    );
    return;
  }

  if (isMedia(req.url)) {
    var rangeHeader = req.headers.get('Range');
    event.respondWith(
      caches.open(MEDIA_CACHE).then(function (cache) {
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
