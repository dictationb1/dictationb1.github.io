/*! Smart Dictation Player — service worker (v0.0.1.g)
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 service worker policy
 * D2: a strict origin gate is the FIRST statement of the fetch handler — only
 * same-origin requests and dict.youdao.com dictionary audio are ever touched.
 * api.elevenlabs.io, api.github.com and raw.githubusercontent.com are never
 * intercepted, never cached and never delayed by this worker. Network-first
 * for the shell and the version.json pointer ({ cache: 'reload' }, 10 s
 * timeout, D3/D4), cache-first for audio and fonts.
 * v0.0.6.f PRESERVES the clip caches ('sdp-audio-clips' + 'sdp-youdao-v1')
 * across upgrades, so a student repeating the same session spends 0 KB of
 * mobile data.
 * v0.0.6.q PILLAR 1 — the LOW-MOBILE-DATA data-JSON law: the boot payloads
 * (data/session.json, data/config.json, data/elevenlabs-audio.json) are
 * served STALE-WHILE-REVALIDATE from SHELL_CACHE: a cached copy of the SAME
 * release (?v= match on the x-sdp-release stamp) answers in < 30 ms with
 * ZERO network traffic, so even a 0-bar / 2G phone boots the full 135-clip
 * voice pack instantly and the clips can never disappear. Only a release
 * change revalidates, and even then the stale copy serves FIRST while the
 * fresh body downloads behind it. data/version.json (the 428-byte pointer)
 * and every fresh ?t= refresh read stay network-first so a publish is never
 * masked by a stale cache. */
'use strict';

var SW_VERSION = 'sdp-v0.0.7.e-s44'; /* v0.0.7.e */
var SHELL_CACHE = 'sdp-v0.0.7.e-s44-shell'; /* v0.0.7.e */
var SW_RELEASE = '0.0.7.e';
var PRESERVE_CACHES = ['sdp-audio-clips', 'sdp-youdao-v1'];
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
  './data/sdp-studio-guide.js',
  './data/sdp-morphe-hooks.js',
  './data/version.json',
  './data/config.json',
  './data/session.json',
  './assets/fonts/NotoSansSinhala-Regular.woff2',
  './assets/fonts/NotoSansSinhala-Bold.woff2',
  './manifest.webmanifest',
  './data/sdp-audio-normalize.js',
  './data/sdp-telemetry.js',
  './data/sdp-selfheal.js',
  './data/sdp-live-lab.js',
  './data/sdp-access-lock.js'
];

/* D2: the only external host this worker may touch is the dictionary audio
   CDN. Matching is hostname/path based — never a broad /[?&]audio=/ or
   /elevenlabs/i regex that could swallow an API request. */
function isYoudaoHost(url) {
  return url.indexOf('dict.youdao.com') >= 0 || url.indexOf('/dictvoice') >= 0;
}
function isLecturerClipPath(pathname) {
  return /\/assets\/audio\/session-w/.test(pathname) || /\/audio\/elevenlabs\//.test(pathname);
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
/* v0.0.6.r — the VOICE-PACK OVERWRITE GUARD: a network-first response for
   data/elevenlabs-audio.json may only replace a cached copy whose
   x-sdp-syncrev stamp is ABSENT (legacy) or older-or-equal. A stale GitHub
   Pages CDN response (the pre-commit pack, minutes before propagation)
   can never clobber the fresher locally-synthesized pack the Studio primed
   into SHELL_CACHE with a higher syncRev. */
function voicePackOverwriteAllowed(cache, cleanUrl, res) {
  if (!/elevenlabs-audio\.json$/.test(cleanUrl)) return Promise.resolve(true);
  return cache.match(cleanUrl, { ignoreSearch: true }).then(function (hit) {
    if (!hit) return true;
    var hitRev = Number(hit.headers.get('x-sdp-syncrev') || 0);
    if (!(hitRev > 0)) return true;
    return res.clone().json().then(function (j) {
      return Number(j && j.syncRev || 0) >= hitRev;
    }).catch(function () { return false; });
  }).catch(function () { return true; });
}
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
          voicePackOverwriteAllowed(cache, cleanUrl, res).then(function (allowed) {
            if (allowed) { try { cache.put(cleanUrl, res.clone()); } catch (e) {} }
          });
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

/* ══ v0.0.6.q PILLAR 1 — STALE-WHILE-REVALIDATE for the boot data JSONs ══
 * The cached body is stamped with the release it was fetched for
 * (x-sdp-release). A boot read (?v=<release>, no tick) is answered from the
 * cache INSTANTLY when the release matches — zero network, zero mobile data,
 * the 135-clip voice pack survives even 0-bar offline boots. When the release
 * differs (a new version shipped) the STALE copy still serves first while a
 * background fetch revalidates the cache — a slow 2G link can never blank
 * the pack or hold the boot hostage. With no cached copy at all this
 * degrades to the classic network-first policy. */
function requestRelease(search) {
  var m = /[?&]v=([^&]+)/.exec(search || '');
  return m ? m[1] : '';
}
function cachePutRelease(cache, cleanUrl, res, release, syncRev) {
  try {
    var headers = new Headers(res.headers);
    if (release) headers.set('x-sdp-release', release);
    if (Number(syncRev) > 0) headers.set('x-sdp-syncrev', String(Number(syncRev)));
    return cache.put(cleanUrl, new Response(res.clone().body, {
      status: res.status, statusText: res.statusText, headers: headers
    }));
  } catch (e) { return Promise.resolve(false); }
}
function staleWhileRevalidateDataJson(request, url) {
  var cleanUrl = url.pathname;
  var want = requestRelease(url.search) || SW_RELEASE;
  return caches.open(SHELL_CACHE).then(function (cache) {
    return cache.match(cleanUrl, { ignoreSearch: true }).then(function (hit) {
      var hitRelease = hit ? (hit.headers.get('x-sdp-release') || '') : '';
      /* Same release (or a legacy un-stamped hit): instant cache serve, and
         v0.0.6.r ALSO fires a NON-BLOCKING background revalidation guarded
         by voicePackOverwriteAllowed so a stale CDN never overwrites a newer
         locally-synthesized pack. */
      if (hit && (!hitRelease || hitRelease === want)) {
        fetch(new Request(cleanUrl + '?t=' + Date.now(), { cache: 'no-store' })).then(function (res) {
          if (!res || !res.ok) return false;
          return voicePackOverwriteAllowed(cache, cleanUrl, res).then(function (allowed) {
            if (!allowed) return false;
            return res.clone().json().then(function (j) {
              return cachePutRelease(cache, cleanUrl, res, want, j && j.syncRev);
            }).catch(function () { return false; });
          });
        }).catch(function () {});
        return hit;
      }
      if (hit) {
        /* A new release shipped: serve the stale body NOW (the zero-drop
           law — the app boots on the old pack instantly) and revalidate the
           cache quietly behind it — v0.0.6.s: the fresh body is stamped with
           its syncRev through cachePutRelease AND guarded by
           voicePackOverwriteAllowed so even this leg can never let a lagging
           CDN overwrite a newer locally synthesized Cloned Voice pack. */
        fetch(new Request(cleanUrl, { cache: 'reload' })).then(function (res) {
          if (!res || !res.ok) return false;
          return voicePackOverwriteAllowed(cache, cleanUrl, res).then(function (allowed) {
            if (!allowed) return false;
            return res.clone().json().then(function (j) {
              return cachePutRelease(cache, cleanUrl, res, want, j && j.syncRev);
            }).catch(function () { return false; });
          });
        }).catch(function () {});
        return hit;
      }
      return networkFirstDataJson(request, url).then(function (res) {
        if (res && res.ok) cachePutRelease(cache, cleanUrl, res, want).catch(function () {});
        return res;
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
   then delete retired caches. v0.0.6.f keeps the audio caches alive so a
   repeated session never re-downloads a single clip. */
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
    /* v0.0.6.q PILLAR 1: data/version.json (the 428-byte pointer) and every
       fresh ?t= refresh read stay network-first; the boot payloads
       (session.json / config.json / elevenlabs-audio.json) are read
       cache-first through the stale-while-revalidate law. */
    var isPointer = /\/data\/version\.json$/i.test(url.pathname);
    var freshRead = url.search.indexOf('t=') >= 0;
    if (!isPointer && !freshRead) {
      event.respondWith(staleWhileRevalidateDataJson(request, url));
      return;
    }
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
