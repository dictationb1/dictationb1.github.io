/*! Smart Dictation Player — service worker (v0.0.1.e)
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 service worker policy
 * D2: a strict origin gate is the FIRST statement of the fetch handler — only
 * same-origin requests and dict.youdao.com dictionary audio are ever touched.
 * api.elevenlabs.io, api.github.com and raw.githubusercontent.com are never
 * intercepted, never cached and never delayed by this worker. Network-first
 * for the shell and data JSON ({ cache: 'reload' }, 10 s timeout, D3/D4),
 * cache-first for audio and fonts, and two preserved caches that are never
 * purged: 'sdp-youdao-v1' (dictionary audio) and 'sdp-audio-clips'
 * (lecturer/Alice). */
'use strict';

var SW_VERSION = 'sdp-v0.0.1.e';
var SHELL_CACHE = 'sdp-v0.0.1.e-shell';
var PRESERVE_CACHES = ['sdp-youdao-v1', 'sdp-audio-clips'];
var YOUDAO_CACHE = 'sdp-youdao-v1';
var CLIP_CACHE = 'sdp-audio-clips';
var AUDIO_CACHE = CLIP_CACHE;
var NETWORK_TIMEOUT = 10000; /* D3: slow classroom links get 10 s, not 4 s */

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

/* D2: the only external host this worker may touch is the dictionary audio
   CDN. Matching is hostname/path based — never a broad /[?&]audio=/ or
   /elevenlabs/i regex that could swallow an API request. */
function isYoudaoHost(url) {
  return url.indexOf('dict.youdao.com') >= 0 || url.indexOf('/dictvoice') >= 0;
}
function isLecturerClipPath(pathname) {
  return /\/assets\/audio\/session-w/.test(pathname);
}
function isFontOrIcon(url) {
  return /\.(woff2|woff|ttf|png|svg|ico|webp)(\?|$)/i.test(url) || url.indexOf('/assets/fonts/') >= 0;
}
function isShellRequest(url) {
  return /\.(html|json|js|css|webmanifest)(\?|$)/i.test(url) || url.indexOf('/data/') >= 0;
}
function isDataJsonPath(pathname) {
  return /\/data\/[^\/]+\.json$/i.test(pathname);
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

/* D3/D4: data JSON is fetched with { cache: 'reload' } so the browser's
   10-minute HTTP cache can never serve a stale version.json, the network
   window is 10 s, and the fallback cache match ignores the ?t= cache-buster.
   A ?t= request is never written into SHELL_CACHE — only its clean pathname
   is cached, and activate() purges any ?t= key that older versions left. */
function networkFirstDataJson(request, url) {
  return caches.open(SHELL_CACHE).then(function (cache) {
    return new Promise(function (resolve) {
      var settled = false;
      var cleanUrl = url.pathname;
      function fallback() {
        return cache.match(url.pathname, { ignoreSearch: true }).then(function (hit) {
          return hit || offlineJson();
        });
      }
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        fallback().then(resolve);
      }, NETWORK_TIMEOUT);
      fetch(new Request(request.url, { cache: 'reload' })).then(function (res) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (res && res.ok) {
          try { cache.put(cleanUrl, res.clone()); } catch (e) {}
          resolve(res);
          return;
        }
        fallback().then(function (hit) { resolve(res && res.status ? res : hit); }, function () { resolve(res || offlineJson()); });
      }).catch(function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fallback().then(resolve);
      });
    });
  });
}

function networkFirstShell(request, url) {
  var navigable = isNavigable(request);
  var jsonish = isJsonRequest(request, url.href);
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
          try { if (String(request.url).indexOf('?t=') < 0) cache.put(request, res.clone()); } catch (e) {}
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

/* Purge every cache-busted '?t=' entry the v0.0.1.d worker left behind (D4),
   then delete retired caches. The two preserved audio caches survive. */
function purgeQueryKeys(cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.keys().then(function (requests) {
      return Promise.all(requests.map(function (req) {
        if (String(req.url).indexOf('?t=') >= 0) return cache.delete(req);
        return Promise.resolve(false);
      }));
    }).catch(function () { return false; });
  });
}

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      var kept = [];
      names.forEach(function (name) {
        var keep = name === SHELL_CACHE || PRESERVE_CACHES.indexOf(name) >= 0;
        /* Everything else under the sdp- prefix is a retired version. */
        if (keep) kept.push(name);
        else if (name.indexOf('sdp-') === 0) return caches.delete(name);
      });
      return Promise.all(kept.map(purgeQueryKeys));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ══ D2: the origin gate is the very first check of every fetch ══════════
   Same-origin requests and dict.youdao.com dictionary audio are served by the
   policies below. EVERY other host — api.elevenlabs.io, api.github.com,
   raw.githubusercontent.com, fonts, CDNs — returns immediately without
   event.respondWith(), so the browser's own network stack handles it and the
   worker can never cache or delay a key check, a version probe or a relay. */
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (!request || request.method !== 'GET') return;
  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  var sameOrigin = url.origin === self.location.origin;
  var isDictAudio = url.hostname === 'dict.youdao.com' || isLecturerClipPath(url.pathname);
  if (!sameOrigin && !isDictAudio) return; /* D2: never intercept third-party hosts */
  if (isDictAudio) {
    event.respondWith(cacheFirst(request, url.hostname === 'dict.youdao.com' ? YOUDAO_CACHE : AUDIO_CACHE));
    return;
  }
  if (isDataJsonPath(url.pathname)) {
    event.respondWith(networkFirstDataJson(request, url));
    return;
  }
  if (request.mode === 'navigate' || isShellRequest(url.href)) {
    event.respondWith(networkFirstShell(request, url));
  }
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
      var cacheName = isYoudaoHost(url) ? YOUDAO_CACHE : CLIP_CACHE;
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
