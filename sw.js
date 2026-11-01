/*! Smart Dictation Player — service worker (v0.0.1.d)
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 service worker policy
 * Network-first for the shell (so a publish lands immediately), cache-first
 * for audio and fonts, and two preserved caches that are never purged:
 * 'sdp-youdao-v1' (dictionary audio) and 'sdp-audio-clips' (lecturer/Alice). */
'use strict';

var SW_VERSION = 'sdp-v0.0.1.d';
var SHELL_CACHE = 'sdp-v0.0.1.d-shell';
var PRESERVE_CACHES = ['sdp-youdao-v1', 'sdp-audio-clips'];
var YOUDAO_CACHE = 'sdp-youdao-v1';
var CLIP_CACHE = 'sdp-audio-clips';
var NETWORK_TIMEOUT = 4000;

var SHELL = [
  './',
  './index.html',
  './assets/css/sdp-ui.css',
  './data/data-meter.js',
  './data/sdp-data-sync.js',
  './data/sdp-audio-speech.js',
  './data/sdp-dictation-engine.js',
  './data/sdp-ui-views.js',
  './data/studio.js',
  './data/version.json',
  './data/config.json',
  './data/session.json',
  './assets/fonts/NotoSansSinhala-Regular.woff2',
  './assets/fonts/NotoSansSinhala-Bold.woff2',
  './manifest.webmanifest',
  './data.html',
  './data/index.html'
];

function isYoutubeAudio(url) {
  return url.indexOf('dict.youdao.com') >= 0 || /[?&]audio=/.test(url) || /\/dictvoice/.test(url);
}
function isClipAudio(url) {
  return /assets\/audio\/session-w/.test(url) || url.indexOf('blob:') === 0 || /elevenlabs/i.test(url);
}
function isFontOrIcon(url) {
  return /\.(woff2|woff|ttf|png|svg|ico|webp)(\?|$)/i.test(url) || url.indexOf('/assets/fonts/') >= 0;
}
function isShellRequest(url) {
  return /\.(html|json|js|css|webmanifest)(\?|$)/i.test(url) || url.indexOf('/data/') >= 0;
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request, { ignoreSearch: false }).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (res) {
        /* Opaque dictionary audio is still worth storing: it replays offline. */
        if (res && (res.ok || res.type === 'opaque')) {
          try { cache.put(request, res.clone()); } catch (e) {}
        }
        return res;
      });
    });
  });
}

/* D-M2: only a real navigation may fall back to the HTML shell. A JSON fetch
   that lands on index.html makes JSON.parse() throw and the whole boot fail
   with a syntax error, so JSON/data requests get cached JSON or an honest
   HTTP 503 JSON body instead. */
function offlineJson() {
  return new Response('{"ok":false,"error":"offline"}', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
function isNavigable(request) {
  return !!request && request.mode === 'navigate';
}
function isJsonRequest(request, url) {
  return /\.json(\?|$)/i.test(url || '') || (request && request.headers &&
    String(request.headers.get('Accept') || '').indexOf('application/json') >= 0);
}
function networkFirst(request) {
  var url = request && request.url ? request.url : '';
  var navigable = isNavigable(request);
  var jsonish = isJsonRequest(request, url);
  return caches.open(SHELL_CACHE).then(function (cache) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        cache.match(request).then(function (hit) {
          if (hit) { resolve(hit); return; }
          if (navigable) { resolve(cache.match('./index.html').then(function (shell) { return shell || offlineJson(); })); return; }
          resolve(jsonish ? offlineJson() : new Response('Offline', { status: 503, statusText: 'Offline' }));
        });
      }, NETWORK_TIMEOUT);
      fetch(request).then(function (res) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (res && res.ok) {
          try { cache.put(request, res.clone()); } catch (e) {}
        }
        resolve(res);
      }).catch(function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cache.match(request).then(function (hit) {
          if (hit) { resolve(hit); return; }
          if (navigable) {
            cache.match('./index.html').then(function (shell) {
              resolve(shell || offlineJson());
            });
            return;
          }
          resolve(jsonish ? offlineJson() : new Response('Offline', { status: 503, statusText: 'Offline' }));
        });
      });
    });
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (path) {
        return cache.add(new Request(path, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        var keep = name === SHELL_CACHE || PRESERVE_CACHES.indexOf(name) >= 0;
        /* Everything else under the sdp- prefix is a retired version. */
        if (!keep && name.indexOf('sdp-') === 0) return caches.delete(name);
        return Promise.resolve(false);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (!request || request.method !== 'GET') return;
  var url = request.url || '';

  if (isYoutubeAudio(url)) { event.respondWith(cacheFirst(request, YOUDAO_CACHE)); return; }
  if (isClipAudio(url)) { event.respondWith(cacheFirst(request, CLIP_CACHE)); return; }
  if (isFontOrIcon(url)) { event.respondWith(cacheFirst(request, SHELL_CACHE)); return; }
  if (request.mode === 'navigate') { event.respondWith(networkFirst(request)); return; }
  if (url.indexOf(self.location.origin) === 0 && isShellRequest(url)) { event.respondWith(networkFirst(request)); return; }
});

self.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data === 'sdp:skip-waiting' || data.action === 'skipWaiting') self.skipWaiting();
  if (data.action === 'version' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: SW_VERSION, shell: SHELL_CACHE });
  }
  /* S4: cache the 30 word-audio URLs on demand (offline downloader, R6 §4).
     Youdao dictionary audio goes into the preserved sdp-youdao-v1 cache;
     lecturer/Alice clips go into sdp-audio-clips. Both caches are preserved
     across upgrades and are never purged. */
  if (data && data.type === 'sdp:cache-words' && Array.isArray(data.urls) && event.source) {
    var urls = data.urls, done = 0;
    function next() {
      if (done >= urls.length) {
        event.source.postMessage({ type: 'sdp:cache-progress', cached: done, total: urls.length });
        return;
      }
      var url = String(urls[done++]);
      var cacheName = isYoutubeAudio(url) ? YOUDAO_CACHE : CLIP_CACHE;
      caches.open(cacheName).then(function (cache) {
        return fetch(url).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) {
            try { cache.put(url, res.clone()); } catch (e) {}
          }
          return res;
        }, function () { return null; }).then(next, next);
      });
    }
    next();
  }
});
