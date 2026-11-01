/*! Smart Dictation Player — service worker (v0.0.1.a)
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 service worker policy
 * Network-first for the shell (so a publish lands immediately), cache-first
 * for audio and fonts, and two preserved caches that are never purged:
 * 'sdp-youdao-v1' (dictionary audio) and 'sdp-audio-clips' (lecturer/Alice). */
'use strict';

var SW_VERSION = 'sdp-v0.0.1.a';
var SHELL_CACHE = 'sdp-v0.0.1.a-shell';
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

function networkFirst(request) {
  return caches.open(SHELL_CACHE).then(function (cache) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        cache.match(request).then(function (hit) {
          resolve(hit || cache.match('./index.html').then(function (shell) { return shell; }));
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
          cache.match('./index.html').then(function (shell) {
            resolve(shell || new Response('Offline', { status: 503, statusText: 'Offline' }));
          });
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
});
